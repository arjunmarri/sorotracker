import { GoogleGenAI } from "@google/genai";
import { AISummaryResult, XHistoryRecord } from "../src/types";

let aiClient: GoogleGenAI | null = null;
let cachedSummary: AISummaryResult | null = null;
let lastSummaryTimestamp = 0;
const SUMMARY_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

export function invalidateSummaryCache() {
  cachedSummary = null;
  lastSummaryTimestamp = 0;
}

function getGenAI(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

/**
 * Robust JSON extraction helper that extracts valid JSON even if wrapped
 * in markdown fences or accompanied by explanatory preamble/epilogue.
 */
export function extractAndParseJSON<T = any>(rawText: string, fallback: T): T {
  if (!rawText || typeof rawText !== 'string') return fallback;
  const trimmed = rawText.trim();

  // 1. Direct parse
  try {
    return JSON.parse(trimmed);
  } catch {}

  // 2. Code block extraction
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {}
  }

  // 3. Outermost object boundaries { ... }
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    } catch {}
  }

  // 4. Outermost array boundaries [ ... ]
  const firstBracket = trimmed.indexOf('[');
  const lastBracket = trimmed.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    try {
      return JSON.parse(trimmed.slice(firstBracket, lastBracket + 1));
    } catch {}
  }

  return fallback;
}

/**
 * Resilient Gemini API invocation with:
 * 1. Fast, highly available model order starting with gemini-3.1-flash-lite
 * 2. Instant break on 429 quota exhaustion (no waiting 40s on exhausted quota)
 * 3. Minimal backoff for transient 503 errors
 */
async function callGeminiWithFallback(
  ai: GoogleGenAI,
  params: {
    prompt: string;
    systemInstruction?: string;
    responseMimeType?: string;
  }
): Promise<string> {
  const modelsToTry = [
    "gemini-3.1-flash-lite",
    "gemini-3.8-flash",
    "gemini-flash-latest"
  ];

  let lastError: any = null;

  for (let m = 0; m < modelsToTry.length; m++) {
    const model = modelsToTry[m];
    try {
      const config: Record<string, any> = {};
      if (params.systemInstruction) {
        config.systemInstruction = params.systemInstruction;
      }
      if (params.responseMimeType) {
        config.responseMimeType = params.responseMimeType;
      }

      const response = await ai.models.generateContent({
        model,
        contents: params.prompt,
        config: Object.keys(config).length > 0 ? config : undefined
      });

      if (response.text) {
        return response.text;
      }
    } catch (err: any) {
      lastError = err;
      const errMessage = (err?.message || '').toLowerCase();
      const errStatus = err?.status || err?.code || (err?.error && err.error.code);

      // If quota is exhausted on this model, switch immediately to next model
      const isQuota = errStatus === 429 || 
                      errMessage.includes('quota') || 
                      errMessage.includes('resource_exhausted');
      if (isQuota) {
        continue;
      }

      // If temporary overload (503), do a single quick retry with 250ms delay
      const is503 = errStatus === 503 || errMessage.includes('overloaded') || errMessage.includes('temporarily');
      if (is503) {
        await new Promise(resolve => setTimeout(resolve, 250));
        try {
          const retryRes = await ai.models.generateContent({
            model,
            contents: params.prompt,
            config: params.responseMimeType ? { responseMimeType: params.responseMimeType } : undefined
          });
          if (retryRes.text) return retryRes.text;
        } catch {}
      }
    }
  }

  throw lastError || new Error('Gemini models temporarily unavailable');
}

export async function getOrGenerateSummary(records: XHistoryRecord[], force = false): Promise<AISummaryResult> {
  if (records.length === 0) {
    return {
      topicClusters: [],
      curatedLinks: [],
      generatedAt: new Date().toISOString()
    };
  }

  // Return cached summary if fresh and force is not set
  const isFresh = cachedSummary && (Date.now() - lastSummaryTimestamp < SUMMARY_CACHE_TTL_MS);
  if (!force && isFresh && cachedSummary) {
    return cachedSummary;
  }

  // Generate with safety timeout race
  const summaryPromise = summarizeArchive(records);
  const timeoutPromise = new Promise<AISummaryResult>((resolve) => {
    setTimeout(() => {
      resolve(generateFallbackSummary(records));
    }, 6000); // 6 second hard deadline
  });

  const result = await Promise.race([summaryPromise, timeoutPromise]);
  cachedSummary = result;
  lastSummaryTimestamp = Date.now();
  return result;
}

export async function summarizeArchive(records: XHistoryRecord[]): Promise<AISummaryResult> {
  if (records.length === 0) {
    return {
      topicClusters: [],
      curatedLinks: [],
      generatedAt: new Date().toISOString()
    };
  }

  const ai = getGenAI();

  if (!ai) {
    return generateFallbackSummary(records);
  }

  // Select 20 representative records, truncating long text to keep tokens concise and response rapid (<2s)
  const context = records.slice(0, 20).map((r, i) => {
    const cleanText = (r.text || '').replace(/\n+/g, ' ').slice(0, 240);
    const linkStr = (r.links || []).slice(0, 2).map(l => `[${l.domain}] ${l.url}`).join("; ");
    return `[Post #${i + 1}] @${r.authorHandle}: "${cleanText}" ${linkStr ? `Links: ${linkStr}` : ''}`;
  }).join("\n\n");

  try {
    const prompt = `Analyze this reading history and classify it strictly into the 10 canonical topics:
1. White Papers & Research Summaries
2. News & Product Announcements
3. Tutorials, How-Tos & Technical Guides
4. Curated Cheat Sheets, Roadmaps & Lists
5. Commentary, Essays & Thought Leadership
6. Project Demos & Build Showcases
7. Memes, Satire & Internet Humour
8. Polemics, Debate Clips & Citizen Journalism
9. Creative Arts, Cinema & Visual Media
10. Promotional Pitches & Others (also absorbs any outside content)

Strictly no other category should be present.

---
${context}
---

Generate topic clusters selected from these 10 categories. For each topic:
- topic: One of the 10 canonical category names above
- description: 1-2 sentence overview
- keyPoints: 2 distinct takeaways
- keywords: 3-5 search keywords
- subTopics: 2-4 specific subtopics, each having "id", "label", and "keywords" (array of 2-3 words)
- sampleTweetIds: empty array

Curate up to 5 external links found in the posts with title, url, domain, relevance.

Return strictly in this JSON format:
{
  "topicClusters": [
    {
      "topic": "string",
      "description": "string",
      "keyPoints": ["string"],
      "keywords": ["string"],
      "subTopics": [{"id": "string", "label": "string", "keywords": ["string"]}],
      "sampleTweetIds": []
    }
  ],
  "curatedLinks": [
    {"title": "string", "url": "string", "domain": "string", "relevance": "string"}
  ]
}`;

    const rawJson = await callGeminiWithFallback(ai, {
      prompt,
      responseMimeType: "application/json",
      systemInstruction: "You are an expert tech curator and research assistant. Return strictly valid JSON."
    });

    const parsed = extractAndParseJSON<{ topicClusters?: any[]; curatedLinks?: any[] }>(rawJson, {});

    if (Array.isArray(parsed.topicClusters) && parsed.topicClusters.length > 0) {
      return {
        topicClusters: parsed.topicClusters,
        curatedLinks: Array.isArray(parsed.curatedLinks) ? parsed.curatedLinks : [],
        generatedAt: new Date().toISOString()
      };
    } else {
      return generateFallbackSummary(records);
    }
  } catch (error: any) {
    return generateFallbackSummary(records);
  }
}

export async function askArchiveQuestion(question: string, records: XHistoryRecord[]): Promise<string> {
  const ai = getGenAI();
  if (!ai) {
    return queryArchiveHeuristically(question, records);
  }

  const context = records.slice(0, 40).map((r, i) => {
    const linkStr = (r.links || []).map(l => `${l.title || l.domain} (${l.url})`).join(", ");
    return `[Post ${i + 1}] by @${r.authorHandle} (${r.authorName}):
"${r.text}"
Links: ${linkStr || 'None'}`;
  }).join("\n\n");

  const prompt = `You are an assistant answering questions about the user's bookmarked X history and links.
Archive context:
${context}

User question: "${question}"

Answer the user directly, citing the author (@handle) and specific links or tweets where relevant.`;

  try {
    const answer = await callGeminiWithFallback(ai, {
      prompt,
      systemInstruction: "You are an expert archive assistant. Give direct, informative answers citing the relevant authors, handles, and URLs."
    });
    return answer || "No response generated.";
  } catch (err: any) {
    console.warn(`[Gemini Service Notice] Question answering falling back to keyword search due to model demand: ${err?.message || 503}`);
    return queryArchiveHeuristically(question, records);
  }
}

function queryArchiveHeuristically(question: string, records: XHistoryRecord[]): string {
  const qLower = question.toLowerCase();
  const tokens = qLower.split(/\s+/).filter(t => t.length > 2);

  const scored = records.map(r => {
    let score = 0;
    const textLower = r.text.toLowerCase();
    const authorLower = (r.authorName + " " + r.authorHandle).toLowerCase();
    
    if (textLower.includes(qLower)) score += 10;
    tokens.forEach(t => {
      if (textLower.includes(t)) score += 2;
      if (authorLower.includes(t)) score += 3;
      (r.links || []).forEach(l => {
        if ((l.title || l.url || l.domain).toLowerCase().includes(t)) score += 2;
      });
    });
    return { record: r, score };
  }).filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return `I found no direct mention of "${question}" in your ${records.length} archived records. Try searching for specific tools, author handles, or topics like "AI", "design", or "frameworks".`;
  }

  const topMatches = scored.slice(0, 3).map(({ record: m }) => {
    const linkStr = (m.links || []).map(l => `\n    ↳ [${l.domain}] ${l.url}`).join('');
    return `• @${m.authorHandle} (${m.authorName}):\n  "${m.text.slice(0, 180)}..."${linkStr}`;
  });

  return `Found ${scored.length} matching post(s) from your reading archive:\n\n${topMatches.join('\n\n')}`;
}

export function generateFallbackSummary(records: XHistoryRecord[]): AISummaryResult {
  const domainCounts = new Map<string, number>();
  const allLinks: { title: string; url: string; domain: string; relevance: string }[] = [];
  const tagCounts = new Map<string, number>();

  records.forEach(r => {
    (r.tags || []).forEach(t => {
      tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
    });

    (r.links || []).forEach(l => {
      domainCounts.set(l.domain, (domainCounts.get(l.domain) || 0) + 1);
      allLinks.push({
        title: l.title || l.displayUrl || l.url,
        url: l.url,
        domain: l.domain,
        relevance: `Curated from @${r.authorHandle} (${r.authorName})`
      });
    });
  });

  const topDomains = Array.from(domainCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(e => e[0]);

  const topTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(e => e[0]);

  const authorsCount = new Set(records.map(r => r.authorHandle)).size;

  return {
    topicClusters: [
      {
        topic: "White Papers & Research Summaries",
        description: "Formal academic preprints, empirical studies, and institutional research papers.",
        keyPoints: [
          "Rigorous evaluations of reasoning-oriented architectures and training dynamics.",
          "Mathematical formulations and benchmark ablations across frontier models."
        ],
        keywords: ["arxiv", "paper", "preprint", "evals", "benchmark", "deepmind", "stanford", "empirical"],
        subTopics: [
          { id: "sub_arxiv_papers", label: "arXiv Preprints & Formal Research", keywords: ["arxiv", "paper", "preprint", "empirical study", "methodology"] },
          { id: "sub_neural_networks", label: "Neural Networks & Deep Learning", keywords: ["neural", "network", "deep learning", "weights", "training"] }
        ]
      },
      {
        topic: "News & Product Announcements",
        description: "Time-sensitive updates on major model releases, developer APIs, and platform launches.",
        keyPoints: [
          "Public API access and official version upgrades from core research labs.",
          "Rapid developer ecosystem adoption for newly deployed frontier architectures."
        ],
        keywords: ["introducing", "now available", "just dropped", "announcing", "model release", "public api"],
        subTopics: [
          { id: "sub_llm_models", label: "Foundation Model Releases (LLMs)", keywords: ["llm", "gpt", "claude", "gemini", "llama", "deepseek"] },
          { id: "sub_public_apis", label: "Public APIs & Platform Changes", keywords: ["public api", "api release", "changelog", "sdk release"] }
        ]
      },
      {
        topic: "Tutorials, How-Tos & Technical Guides",
        description: "Step-by-step implementation walkthroughs, code snippets, and configuration architectures.",
        keyPoints: [
          "Hands-on terminal configurations and resilient client-server pipelines.",
          "Practical blueprints for deterministic linting, typing, and system design."
        ],
        keywords: ["tutorial", "how to", "step by step", "from scratch", "walkthrough", "code", "guide"],
        subTopics: [
          { id: "sub_code_walkthroughs", label: "Step-by-Step Code Walkthroughs", keywords: ["tutorial", "how to", "step by step", "walkthrough"] },
          { id: "sub_python_related", label: "Python-related", keywords: ["python", "pytorch", "fastapi", "pandas", "numpy"] }
        ]
      },
      {
        topic: "Project Demos & Build Showcases",
        description: "Interactive screencasts, proof-of-concept experiments, and real-world hardware/software prototypes.",
        keyPoints: [
          "Working prototype showcases built over weekend hackathons.",
          "Open source proof-of-concept repositories demonstrating practical applications."
        ],
        keywords: ["look what i built", "demo", "prototype", "proof of concept", "screencast", "weekend hack"],
        subTopics: [
          { id: "sub_working_prototypes", label: "Working Prototypes & Build Demos", keywords: ["look what i built", "demo", "prototype", "showcase"] }
        ]
      }
    ],
    curatedLinks: allLinks.slice(0, 8),
    generatedAt: new Date().toISOString()
  };
}
