import { XHistoryRecord, ContentFilterCategory, ContentFilterOption } from '../types';

/**
 * 10 Canonical Content Categories
 * Strictly defined according to user classification rules and signals.
 * If any content is outside, it is routed to "Promotional Pitches & Others".
 */

export const ALL_CATEGORY_OPTIONS: ContentFilterOption[] = [
  {
    id: 'white_paper',
    number: 1,
    label: 'White Papers & Research Summaries',
    description: 'Posts analyzing, summarizing, or reviewing formal academic papers, arXiv preprints, empirical studies, or institutional research findings.',
    examples: 'e.g., arXiv preprints, academic authors/institutions (DeepMind, Stanford), theoretical formulations, "banger paper", "we propose a method"',
    type: 'high_signal',
    colorClasses: {
      badge: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800',
      text: 'text-indigo-700 dark:text-indigo-300',
      bg: 'bg-indigo-50 dark:bg-indigo-950/50',
      border: 'border-indigo-200 dark:border-indigo-800'
    }
  },
  {
    id: 'news_announcements',
    number: 2,
    label: 'News & Product Announcements',
    description: 'Time-sensitive broadcast communications detailing new software versions, model releases, public APIs, corporate launches, or official platform changes.',
    examples: 'e.g., "introducing", "now available", "just dropped", "announcing", "rolling out", "live in beta", official releases',
    type: 'high_signal',
    colorClasses: {
      badge: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800',
      text: 'text-sky-700 dark:text-sky-300',
      bg: 'bg-sky-50 dark:bg-sky-950/50',
      border: 'border-sky-200 dark:border-sky-800'
    }
  },
  {
    id: 'tutorials_guides',
    number: 3,
    label: 'Tutorials, How-Tos & Technical Guides',
    description: 'Educational, instructive walkthroughs providing step-by-step guidance, code snippets, or configuration patterns to solve a specific technical task.',
    examples: 'e.g., procedural formatting ("step 1, step 2"), "here is how to", terminal commands, walkthroughs, "from scratch"',
    type: 'high_signal',
    colorClasses: {
      badge: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
      text: 'text-emerald-800 dark:text-emerald-300',
      bg: 'bg-emerald-50 dark:bg-emerald-950/50',
      border: 'border-emerald-200 dark:border-emerald-800'
    }
  },
  {
    id: 'cheat_sheets_lists',
    number: 4,
    label: 'Curated Cheat Sheets, Roadmaps & Lists',
    description: 'Compilations of reference materials, high-density infographics, structured learning paths, tool directories, or recommended account indices.',
    examples: 'e.g., "cheat sheet", "roadmap to learn X", "top 10 tools", "bookmark this collection", reading lists, directories',
    type: 'high_signal',
    colorClasses: {
      badge: 'bg-cyan-50 text-cyan-800 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-800',
      text: 'text-cyan-800 dark:text-cyan-300',
      bg: 'bg-cyan-50 dark:bg-cyan-950/50',
      border: 'border-cyan-200 dark:border-cyan-800'
    }
  },
  {
    id: 'commentary_essays',
    number: 5,
    label: 'Commentary, Essays & Thought Leadership',
    description: 'Opinion-driven essays, philosophical discussions, strategic industry analysis, macroeconomic critiques, and personal reflections on technological or business directions.',
    examples: 'e.g., "I wrote about", "I believe", speculative essays, macroeconomic projections (CapEx returns), industry paradigms',
    type: 'high_signal',
    colorClasses: {
      badge: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
      text: 'text-amber-800 dark:text-amber-300',
      bg: 'bg-amber-50 dark:bg-amber-950/50',
      border: 'border-amber-200 dark:border-amber-800'
    }
  },
  {
    id: 'project_demos',
    number: 6,
    label: 'Project Demos & Build Showcases',
    description: '"Show-and-tell" displays of working prototypes, proof-of-concept experiments, hobbyist hardware setups, or practical tool applications created by an individual or team.',
    examples: 'e.g., screencasts, "look what I built", "15 minutes later: Boom", benchmark test clips, running hardware setups',
    type: 'high_signal',
    colorClasses: {
      badge: 'bg-violet-50 text-violet-800 border-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-800',
      text: 'text-violet-800 dark:text-violet-300',
      bg: 'bg-violet-50 dark:bg-violet-950/50',
      border: 'border-violet-200 dark:border-violet-800'
    }
  },
  {
    id: 'memes_humour',
    number: 7,
    label: 'Memes, Satire & Internet Humour',
    description: 'Content intended purely for entertainment, comedic relief, hyperbolic parody, developer irony, or viral social humor.',
    examples: 'e.g., absurdist scenarios, sarcastic commentary, self-deprecating developer jokes, viral video captions, physics/science puns',
    type: 'noise',
    colorClasses: {
      badge: 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60',
      text: 'text-rose-700 dark:text-rose-300',
      bg: 'bg-rose-50 dark:bg-rose-950/40',
      border: 'border-rose-200 dark:border-rose-800'
    }
  },
  {
    id: 'polemics_debate',
    number: 8,
    label: 'Polemics, Debate Clips & Citizen Journalism',
    description: 'Emotionally charged socio-political media, political protest documentation, television debate snippets, partisan commentary, or accusations of bias/hypocrisy.',
    examples: 'e.g., political hashtags, protest coverage, media callouts, debate video clips, partisan vocabulary ("exposed", "protest", "riots")',
    type: 'noise',
    colorClasses: {
      badge: 'bg-red-50 text-red-700 border-red-200/80 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/60',
      text: 'text-red-700 dark:text-red-300',
      bg: 'bg-red-50 dark:bg-red-950/40',
      border: 'border-red-200 dark:border-red-800'
    }
  },
  {
    id: 'creative_arts',
    number: 9,
    label: 'Creative Arts, Cinema & Visual Media',
    description: 'Aesthetic, cultural, or artistic media posts focused on film retrospectives, digital art renders, architecture, photography, and fine art appreciation.',
    examples: 'e.g., art credits, image-generation prompts (Midjourney), film ranking tags, director/actor mentions, residential architectural showcases',
    type: 'high_signal',
    colorClasses: {
      badge: 'bg-purple-50 text-purple-700 border-purple-200/80 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/60',
      text: 'text-purple-700 dark:text-purple-300',
      bg: 'bg-purple-50 dark:bg-purple-950/40',
      border: 'border-purple-200 dark:border-purple-800'
    }
  },
  {
    id: 'promotional_pitches_others',
    number: 10,
    label: 'Promotional Pitches & Others',
    description: 'Marketing-focused content designed to capture leads, drive traffic to a commercial service, promote paid communities, or solicit social engagement via gating. Also strictly absorbs all outside content.',
    examples: 'e.g., "Reply \'Send\' to get X", "join our cohort", explicit ad copy, affiliate/UTM links, commercial product promotions, and outside posts',
    type: 'noise',
    colorClasses: {
      badge: 'bg-orange-50 text-orange-700 border-orange-200/80 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800/60',
      text: 'text-orange-700 dark:text-orange-300',
      bg: 'bg-orange-50 dark:bg-orange-950/40',
      border: 'border-orange-200 dark:border-orange-800'
    }
  }
];

export const FILTER_OUT_OPTIONS: ContentFilterOption[] = ALL_CATEGORY_OPTIONS.filter(o => o.type === 'noise');
export const HIGH_SIGNAL_OPTIONS: ContentFilterOption[] = ALL_CATEGORY_OPTIONS.filter(o => o.type === 'high_signal');

export const CATEGORY_META_MAP: Record<ContentFilterCategory, ContentFilterOption> = ALL_CATEGORY_OPTIONS.reduce(
  (acc, opt) => {
    acc[opt.id] = opt;
    return acc;
  },
  {} as Record<ContentFilterCategory, ContentFilterOption>
);

// Academic and Research Domains for White Paper classification signal
const WHITE_PAPER_DOMAINS = [
  'arxiv.org',
  'biorxiv.org',
  'openreview.net',
  'semanticscholar.org',
  'papers.ssrn.com',
  'huggingface.co/papers',
  'doi.org',
  'acm.org',
  'ieee.org',
  'researchgate.net',
  'deepmind.google',
  'stanford.edu',
  'cornell.edu',
  'mit.edu',
  'berkeley.edu'
];

// Official release & announcements authority domains
const OFFICIAL_ANNOUNCEMENT_DOMAINS = [
  'openai.com',
  'anthropic.com',
  'deepmind.google',
  'blog.google',
  'github.blog',
  'microsoft.com',
  'apple.com',
  'bloomberg.com',
  'reuters.com',
  'techcrunch.com',
  'theverge.com'
];

// Regex & heuristic patterns for categorization strictly reflecting user requirements
const PATTERNS: Record<ContentFilterCategory, RegExp[]> = {
  white_paper: [
    /\b(white\s*papers?|research papers?|new paper|our paper|read the paper|paper published)\b/i,
    /\b(arxiv:\s*\d+\.\d+|arxiv\b|biorxiv\b|openreview\b|preprint|peer[- ]reviewed|ablation study|methodology|theorem|lemma)\b/i,
    /\b(banger paper|researchers discover|they propose a method|we propose a method|empirical study|empirical evaluation)\b/i,
    /\b(deepmind|cornell|stanford|mit|berkeley|cmu|abstract:|citation:|bibtex|benchmark evaluations?)\b/i
  ],
  news_announcements: [
    /\b(introducing\b|now available\b|just dropped\b|announcing\b|officially announced|we are excited to announce|released\b|new release)\b/i,
    /\b(rolling out|live in beta|now live|general availability|public api|changelog|v\d+\.\d+|claude 3\.\d+|gpt-4|gemini \d|deepseek|llama \d)\b/i,
    /\b(official statement|corporate announcement|platform update|press release|beta release|now available to all)\b/i
  ],
  tutorials_guides: [
    /\b(how to\b|how-to\b|step by step|step-by-step|guide to\b|tutorial\b|walkthrough\b|code walkthrough|from scratch)\b/i,
    /\b(step 1|step 2|step 3|here is how|here's how to|build your own|quickstart|getting started with|implementation walkthrough)\b/i,
    /\b(terminal commands?|npm install|pip install|cargo add|docker run|git clone|curl -s|bash script)\b/i
  ],
  cheat_sheets_lists: [
    /\b(cheat sheet|cheatsheet|quick reference|reference guide|roadmap to\b|developer roadmap|learning path)\b/i,
    /\b(top \d+\s+(tools|libraries|repos|resources|books|frameworks|accounts)|curated directory|high-density infographic|save this roadmap)\b/i,
    /\b(everything you need to know about|bookmark this collection|reading list|syllabus links?|tool directories?)\b/i
  ],
  commentary_essays: [
    /\b(i wrote about|i believe|i think|my perspective on|in my view|speculative essay|philosophical discussion)\b/i,
    /\b(paradigm shift|macro analysis|founder reflections|reflections on|industry analysis|macroeconomic critique|capex returns?)\b/i,
    /\b(the real problem with|technological trajectory|business directions?|strategic industry analysis)\b/i
  ],
  project_demos: [
    /\b(look what i built|look what we built|i built a|we built a|weekend hack|side project|quick demo of|demo video)\b/i,
    /\b(screencast|screen recording|benchmark test clip|15 minutes later:\s*boom|working prototype|proof of concept|poc demo)\b/i,
    /\b(github\.com\/[a-z0-9_-]+\/[a-z0-9_-]+|hardware setups?|look at this build|built this over the weekend)\b/i
  ],
  memes_humour: [
    /\b(lol\b|lmao\b|rofl\b|shitpost|shitposting|copypasta|memes?\b|humor\b|humour\b|satire\b|parody\b)\b/i,
    /\b(pov:|nobody:|no one:|me when\b|mfw\b|tfw\b|bro really\b|bro thinks?\b|crying laughing|said no one ever|not me doing)\b/i,
    /\b(bruh\b|hahaha|hehehe|ratio['’]?d|ratioed|touch grass|skill issue|physics pun|science pun|developer joke)\b/i,
    /(😭{2,}|💀{2,}|😂{2,}|🤣{2,}|🤡)/
  ],
  polemics_debate: [
    /\b(debate clip|provocative|hypocrisy|media callout|partisan|protest|protests|riots?|censorship)\b/i,
    /\b(socio-political|political exchange|heated debate|unfiltered debate|exposed:|broadcast excerpt|accusations of bias)\b/i,
    /\b(citizen journalism|television debate|political party|democrat|republican|parliament|congress|propaganda)\b/i
  ],
  creative_arts: [
    /\b(cinematography|cinema|film stills|film director|architectural photography|fine art|generative art)\b/i,
    /\b(midjourney prompt|stable diffusion prompt|art credit|aesthetic lighting|composition|rendering|photographic showcase)\b/i,
    /\b(film retrospective|residential design|digital art renders?|visual media|art appreciation)\b/i
  ],
  promotional_pitches_others: [
    /\b(reply ["']?(send|link|yes)["']?|join our cohort|get \d+% off|discount code|free template with code|affiliate link|buy now)\b/i,
    /\b(presale|masterclass registration|dm me for access|lead magnet|commercial service|paid community|gated resource)\b/i,
    /\b(sign up for my|book a call|hire me|sponsorship|sponsored by|promotional offer|special discount)\b/i
  ]
};

// High-performance caches for snippet categorization
const snippetScoreCache = new Map<string, Array<{ category: ContentFilterCategory; score: number }>>();
const snippetLabelsCache = new Map<string, ContentFilterCategory[]>();
const snippetCategoriesCache = new Map<string, ContentFilterCategory[]>();

/**
 * Score all 10 categories for a snippet based strictly on classification signals.
 * If no category matches, Promotional Pitches & Others serves as the universal absorption category.
 */
export function scoreSnippetCategories(record: XHistoryRecord): Array<{ category: ContentFilterCategory; score: number }> {
  if (record.id && snippetScoreCache.has(record.id)) {
    return snippetScoreCache.get(record.id)!;
  }

  const scores: Record<ContentFilterCategory, number> = {
    white_paper: 0,
    news_announcements: 0,
    tutorials_guides: 0,
    cheat_sheets_lists: 0,
    commentary_essays: 0,
    project_demos: 0,
    memes_humour: 0,
    polemics_debate: 0,
    creative_arts: 0,
    promotional_pitches_others: 0
  };

  const rawText = record.text || '';
  const text = rawText.toLowerCase();

  // 1. Check Links and Domains
  if (record.links && record.links.length > 0) {
    for (const link of record.links) {
      const url = (link.url || '').toLowerCase();
      const domain = (link.domain || '').toLowerCase();
      const title = (link.title || '').toLowerCase();

      // White paper domains or PDF extension
      if (WHITE_PAPER_DOMAINS.some(d => domain.includes(d) || url.includes(d)) || url.endsWith('.pdf') || url.includes('.pdf?')) {
        scores.white_paper += 6;
      }

      // Official announcements
      if (OFFICIAL_ANNOUNCEMENT_DOMAINS.some(d => domain.includes(d) || url.includes(d))) {
        scores.news_announcements += 4;
      }

      // Paper or preprints in link title
      if (/\b(paper|arxiv|preprint|rfc|specification|research)\b/i.test(title)) {
        scores.white_paper += 4;
      }
      // GitHub repo links
      if (domain.includes('github.com') || url.includes('github.com')) {
        scores.project_demos += 3;
      }
    }
  }

  // 2. Check Media Types
  if (record.media && record.media.length > 0) {
    if (record.media.some(m => m.type === 'gif')) {
      scores.memes_humour += 5;
    }
    if (record.media.some(m => m.type === 'video')) {
      if (/\b(look what|built|demo|hack)\b/i.test(text)) {
        scores.project_demos += 4;
      } else if (/\b(debate|protest|parliament)\b/i.test(text)) {
        scores.polemics_debate += 4;
      }
    }
  }

  // 3. Check Regex Patterns for all 10 categories
  for (const [cat, regexList] of Object.entries(PATTERNS)) {
    const category = cat as ContentFilterCategory;
    for (const rx of regexList) {
      if (rx.test(rawText) || rx.test(text)) {
        scores[category] += 4;
      }
    }
  }

  // 4. Fallback Rule: "If any content is outside then add it to 'Promotional Pitches & Others'"
  const maxScore = Math.max(...Object.values(scores));
  if (maxScore === 0) {
    scores.promotional_pitches_others = 1;
  }

  const result = Object.entries(scores)
    .map(([category, score]) => ({ category: category as ContentFilterCategory, score }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (record.id) {
    snippetScoreCache.set(record.id, result);
  }
  return result;
}

/**
 * Automatically assign up to max 3 labels to any snippet.
 * If any content is outside then it receives 'promotional_pitches_others'.
 */
export function getSnippetLabels(record: XHistoryRecord): ContentFilterCategory[] {
  if (record.id && snippetLabelsCache.has(record.id)) {
    return snippetLabelsCache.get(record.id)!;
  }

  // If record already has valid labels attached from the new 10 categories, use them capped at 3
  if (record.labels && Array.isArray(record.labels) && record.labels.length > 0) {
    const valid = record.labels.filter(lbl => ALL_CATEGORY_OPTIONS.some(o => o.id === lbl));
    if (valid.length > 0) {
      const sliced = valid.slice(0, 3);
      if (record.id) snippetLabelsCache.set(record.id, sliced);
      return sliced;
    }
  }

  const scored = scoreSnippetCategories(record);
  if (scored.length === 0) {
    const fallback: ContentFilterCategory[] = ['promotional_pitches_others'];
    if (record.id) snippetLabelsCache.set(record.id, fallback);
    return fallback;
  }

  // Pick top labels up to max 3
  const topLabels = scored.slice(0, 3).map(s => s.category);
  if (record.id) {
    snippetLabelsCache.set(record.id, topLabels);
  }
  return topLabels;
}

/**
 * Detect all content categories for filtering purposes.
 */
export function detectContentCategories(record: XHistoryRecord): ContentFilterCategory[] {
  if (record.id && snippetCategoriesCache.has(record.id)) {
    return snippetCategoriesCache.get(record.id)!;
  }

  const scored = scoreSnippetCategories(record);
  const result = scored.length === 0 ? ['promotional_pitches_others' as ContentFilterCategory] : scored.map(s => s.category);
  if (record.id) {
    snippetCategoriesCache.set(record.id, result);
  }
  return result;
}

/**
 * Check if the record matches any active exclusion category.
 */
export function isFilteredOut(
  record: XHistoryRecord,
  activeFilterCategories: ContentFilterCategory[]
): boolean {
  if (!activeFilterCategories || activeFilterCategories.length === 0) {
    return false;
  }

  const recordCategories = detectContentCategories(record);
  return recordCategories.some(cat => activeFilterCategories.includes(cat));
}

/**
 * Filter an array of records according to active filter categories,
 * and calculate live category counts across all 10 canonical categories.
 */
export function filterTimelineRecords(
  records: XHistoryRecord[],
  activeFilterCategories: ContentFilterCategory[]
): {
  filteredRecords: XHistoryRecord[];
  excludedRecords: XHistoryRecord[];
  categoryCounts: Record<ContentFilterCategory, number>;
} {
  const categoryCounts: Record<ContentFilterCategory, number> = {
    white_paper: 0,
    news_announcements: 0,
    tutorials_guides: 0,
    cheat_sheets_lists: 0,
    commentary_essays: 0,
    project_demos: 0,
    memes_humour: 0,
    polemics_debate: 0,
    creative_arts: 0,
    promotional_pitches_others: 0
  };

  // Pre-calculate counts across all records (using up to max 3 labels per snippet)
  for (let i = 0; i < records.length; i++) {
    const labels = getSnippetLabels(records[i]);
    for (let j = 0; j < labels.length; j++) {
      categoryCounts[labels[j]] = (categoryCounts[labels[j]] || 0) + 1;
    }
  }

  if (!activeFilterCategories || activeFilterCategories.length === 0) {
    return {
      filteredRecords: records,
      excludedRecords: [],
      categoryCounts
    };
  }

  const activeSet = new Set(activeFilterCategories);
  const filteredRecords: XHistoryRecord[] = [];
  const excludedRecords: XHistoryRecord[] = [];

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const recordCats = detectContentCategories(r);
    let matched = false;
    for (let c = 0; c < recordCats.length; c++) {
      if (activeSet.has(recordCats[c])) {
        matched = true;
        break;
      }
    }
    if (matched) {
      excludedRecords.push(r);
    } else {
      filteredRecords.push(r);
    }
  }

  return {
    filteredRecords,
    excludedRecords,
    categoryCounts
  };
}
