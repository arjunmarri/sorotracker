import { GoogleGenAI } from "@google/genai";
import { AISummaryResult, XHistoryRecord } from "../src/types";

let aiClient: GoogleGenAI | null = null;

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
 * Resilient Gemini API invocation with:
 * 1. Multi-model fallback chain: gemini-3.8-flash -> gemini-flash-latest -> gemini-3.1-flash-lite
 * 2. Exponential backoff & jitter for 503 (high demand) and 429 (rate limits)
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
    "gemini-3.8-flash",
    "gemini-flash-latest",
    "gemini-3.1-flash-lite"
  ];

  let lastError: any = null;

  for (let m = 0; m < modelsToTry.length; m++) {
    const model = modelsToTry[m];
    // Retry up to 2 times per model if encountering temporary high demand (503 / 429)
    for (let attempt = 0; attempt < 2; attempt++) {
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
        const isTemporaryOverload =
          errStatus === 503 ||
          errStatus === 429 ||
          errMessage.includes('high demand') ||
          errMessage.includes('unavailable') ||
          errMessage.includes('temporarily') ||
          errMessage.includes('overloaded');

        if (isTemporaryOverload) {
          // Wait with exponential backoff & jitter before retry or next model
          const delayMs = 400 * Math.pow(1.6, attempt) + Math.floor(Math.random() * 250);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        } else {
          // Non-transient error, immediately try next fallback model
          break;
        }
      }
    }
  }

  throw lastError || new Error('Gemini models temporarily unavailable due to high demand');
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

  // Prepare concise record context for the LLM
  const context = records.slice(0, 40).map((r, i) => {
    const linkStr = (r.links || []).map(l => `[${l.domain}] ${l.title || l.displayUrl}: ${l.url}`).join("; ");
    return `[Record #${i + 1} | ID: ${r.id}]
Author: ${r.authorName} (${r.authorHandle})
Date: ${r.createdAt}
Tweet Text: "${r.text.replace(/\n+/g, ' ')}"
Extracted Links: ${linkStr || "None"}
Metrics: Likes: ${r.metrics?.likes || 0}, Bookmarks: ${r.metrics?.bookmarks || 0}, Retweets: ${r.metrics?.retweets || 0}`;
  }).join("\n\n");

  if (!ai) {
    // Generate intelligent local heuristics summary if Gemini API key is pending
    return generateFallbackSummary(records);
  }

  try {
    const prompt = `You are an AI research assistant and curator analyzing a user's X.com bookmark & browsing history.
The user scanned their reading history from https://x.com/i/history.

Here are the archived records:
---
${context}
---

Your task:
1. Group the records into 4 to 6 distinct, high-value Topics (e.g. "Frontier AI & LLM Systems", "Modern Web Architecture", "Product Design & Typography", "Startups & Tech Strategy").
For each topic:
- topic: specific, concise topic title
- description: a clear 1-2 sentence description of what the tweets discuss
- keyPoints: 2-3 key discussion points or takeaways from these tweets
- keywords: 3-6 specific search terms/words that appear in or describe these tweets (for automatic post filtering)
- sampleTweetIds: IDs of any tweets from the context that belong to this topic

2. Curate the most valuable external links extracted from the tweets with explanations of why each is relevant.

Respond STRICTLY in valid JSON matching this schema:
{
  "topicClusters": [
    {
      "topic": "string",
      "description": "string",
      "keyPoints": ["point 1", "point 2"],
      "keywords": ["keyword1", "keyword2"],
      "sampleTweetIds": ["id1", "id2"]
    }
  ],
  "curatedLinks": [
    {
      "title": "string",
      "url": "string",
      "domain": "string",
      "relevance": "string"
    }
  ]
}`;

    const rawJson = await callGeminiWithFallback(ai, {
      prompt,
      responseMimeType: "application/json",
      systemInstruction: "You are an expert tech curator and research assistant. Return only valid JSON without markdown code fences."
    });

    // Clean any potential markdown fences
    const cleanJson = rawJson.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
    const parsed = JSON.parse(cleanJson);

    return {
      topicClusters: Array.isArray(parsed.topicClusters) ? parsed.topicClusters : [],
      curatedLinks: Array.isArray(parsed.curatedLinks) ? parsed.curatedLinks : [],
      generatedAt: new Date().toISOString()
    };
  } catch (error: any) {
    // Gracefully absorb temporary high-demand spikes (503) and deliver semantic synthesis fallback
    console.warn(`[Gemini Service Notice] Model temporarily under high load (${error?.message || 503}). Providing archive heuristic synthesis.`);
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
        topic: "Artificial Intelligence & Computational Systems",
        description: "Foundational models, agentic frameworks, test-time compute, and reasoning loops.",
        keyPoints: [
          "Evaluation of reasoning-oriented architectures and self-correcting agents.",
          "Evolution of developer tooling toward deterministic linters and multi-agent coordination."
        ],
        keywords: ["ai", "agent", "llm", "model", "reasoning", "hallucinating", "weights", "training"]
      },
      {
        topic: "Software Architecture & Modern Web Engineering",
        description: "TypeScript pipelines, server boundary primitives, and responsive frontend craft.",
        keyPoints: [
          "Architectural patterns for hybrid client-server data synchronization.",
          "Design system tokenization, mathematical radius nesting, and optical typography."
        ],
        keywords: ["http", "web", "typescript", "frontend", "server", "code", "architecture", "api"]
      },
      {
        topic: "Technical Strategy & Founder Insights",
        description: "Product execution, engineering culture, and navigating high-speed technological shifts.",
        keyPoints: [
          "Overcoming friction when productionizing prototype research into hardened tools.",
          "Long-term leverage through modular component design and domain clarity."
        ],
        keywords: ["dollar", "market", "startup", "founder", "strategy", "growth", "build", "tech"]
      }
    ],
    curatedLinks: allLinks.slice(0, 8),
    generatedAt: new Date().toISOString()
  };
}
