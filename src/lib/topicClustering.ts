import { SubTopic, TopicClusterGroup, XHistoryRecord } from '../types';
import { recordMatchesKeywords } from './subtopics';

export type { TopicClusterGroup };

// Strict Canonical Topic Definitions based directly on user specifications
export interface CanonicalTopicTemplate {
  id: string;
  number: number;
  name: string;
  definition: string;
  classificationSignals: string;
  disambiguation: string;
  description: string;
  matchKeywords: string[];
}

export const CANONICAL_TOPICS: CanonicalTopicTemplate[] = [
  {
    id: 'cluster_white_papers',
    number: 1,
    name: 'White Papers & Research Summaries',
    definition: 'Posts analyzing, summarizing, or reviewing formal academic papers, arXiv preprints, empirical studies, or institutional research findings.',
    classificationSignals: 'References to paper titles, academic authors/institutions (e.g., DeepMind, Cornell, Stanford), arXiv links, theoretical formulations, benchmark evaluations, or phrases like "banger paper," "researchers discover," or "they propose a method".',
    disambiguation: 'Differentiated from News & Product Announcements by its focus on methodology, algorithmic theory, and research conclusions rather than commercial availability or brand milestones.',
    description: 'Formal academic papers, arXiv preprints, empirical studies, and institutional research findings.',
    matchKeywords: [
      'arxiv', 'arxiv.org', 'paper', 'white paper', 'banger paper', 'researchers discover', 'propose a method',
      'they propose', 'empirical study', 'pre-print', 'preprint', 'deepmind', 'cornell', 'stanford', 'mit',
      'berkeley', 'theoretical formulation', 'benchmark evaluation', 'methodology', 'algorithmic theory',
      'research conclusions', 'research findings', 'abstract', 'citation', 'conference', 'neurips', 'icml',
      'iclr', 'cvpr', 'acl', 'peer review', 'empirical results', 'state of the art', 'sota', 'neural architecture'
    ]
  },
  {
    id: 'cluster_news_announcements',
    number: 2,
    name: 'News & Product Announcements',
    definition: 'Time-sensitive broadcast communications detailing new software versions, model releases, public APIs, corporate launches, or official platform changes.',
    classificationSignals: 'Keywords such as "introducing," "now available," "just dropped," "announcing," "rolling out," "live in beta," or official statements from company accounts and executives.',
    disambiguation: 'Differentiated from Project Demos because it represents an official release of a product or service to the public, rather than an individual experimentation demo.',
    description: 'Time-sensitive announcements, new model releases, public APIs, and corporate launches.',
    matchKeywords: [
      'introducing', 'now available', 'just dropped', 'announcing', 'announcement', 'rolling out', 'roll out',
      'live in beta', 'official statement', 'public api', 'corporate launch', 'platform change', 'version release',
      'v1.', 'v2.', 'general availability', 'ga release', 'official release', 'changelog', 'model release',
      'software version', 'new feature', 'launches', 'launching', 'released', 'now live', 'major update'
    ]
  },
  {
    id: 'cluster_tutorials_guides',
    number: 3,
    name: 'Tutorials, How-Tos & Technical Guides',
    definition: 'Educational, instructive walkthroughs providing step-by-step guidance, code snippets, or configuration patterns to solve a specific technical task.',
    classificationSignals: 'Procedural formatting ("step 1, step 2"), "here is how to," terminal commands, implementation walkthroughs, code repositories, or phrases like "from scratch".',
    disambiguation: 'Differentiated from Curated Cheat Sheets by its sequential, explanatory instructional flow, rather than an unranked index of links or tools.',
    description: 'Step-by-step technical guides, code snippets, terminal commands, and implementation walkthroughs.',
    matchKeywords: [
      'tutorial', 'how-to', 'how to', 'here is how', 'step 1', 'step 2', 'step-by-step', 'from scratch',
      'terminal command', 'code snippet', 'walkthrough', 'technical guide', 'configuration pattern', 'cookbook',
      'getting started', 'build your own', 'implementation guide', 'hands-on', 'diy guide', 'code repository'
    ]
  },
  {
    id: 'cluster_cheat_sheets_lists',
    number: 4,
    name: 'Curated Cheat Sheets, Roadmaps & Lists',
    definition: 'Compilations of reference materials, high-density infographics, structured learning paths, tool directories, or recommended account indices.',
    classificationSignals: 'Bulleted lists of tools/accounts, syllabus links, "roadmap to learn X," "cheat sheet," "top N resources," "bookmark this collection," or reading lists.',
    disambiguation: 'Differentiated from Tutorials because it catalogs multiple resources or topics broadly rather than teaching a single procedural concept end-to-end.',
    description: 'Compilations of reference materials, infographics, learning paths, tool directories, and indices.',
    matchKeywords: [
      'cheat sheet', 'cheatsheet', 'roadmap', 'roadmap to learn', 'curated list', 'top resources', 'top 10',
      'top 5', 'top tools', 'bookmark this collection', 'reading list', 'directory', 'syllabus', 'infographic',
      'compilation', 'reference materials', 'learning path', 'tool directory', 'recommended accounts', 'mega thread',
      'awesome list', 'collection of tools', 'curated index'
    ]
  },
  {
    id: 'cluster_commentary_essays',
    number: 5,
    name: 'Commentary, Essays & Thought Leadership',
    definition: 'Opinion-driven essays, philosophical discussions, strategic industry analysis, macroeconomic critiques, and personal reflections on technological or business directions.',
    classificationSignals: 'First-person introspective language ("I wrote about," "I believe," "I think"), speculative essays, macroeconomic projections (e.g., CapEx returns), and arguments regarding industry paradigms.',
    disambiguation: 'Differentiated from News by its subjective, interpretive, or critical perspective rather than straightforward factual reporting.',
    description: 'Opinion essays, strategic industry analysis, macroeconomic critiques, and paradigm reflections.',
    matchKeywords: [
      'commentary', 'essay', 'thought leadership', 'i wrote about', 'i believe', 'i think', 'in my opinion',
      'my take', 'philosophical', 'macroeconomic', 'capex', 'industry analysis', 'paradigm', 'perspective',
      'reflections', 'speculative essay', 'critique', 'strategic', 'thesis', 'manifesto', 'viewpoint', 'analysis'
    ]
  },
  {
    id: 'cluster_project_demos',
    number: 6,
    name: 'Project Demos & Build Showcases',
    definition: '"Show-and-tell" displays of working prototypes, proof-of-concept experiments, hobbyist hardware setups, or practical tool applications created by an individual or team.',
    classificationSignals: 'Screencasts, screen recordings, benchmark test clips, statements such as "look what I built," "15 minutes later: Boom," or showcase pictures of running hardware setups.',
    disambiguation: 'Differentiated from Tutorials because it highlights the output and capabilities of the build rather than providing comprehensive step-by-step instructions for replication.',
    description: 'Working prototypes, build showcases, screencasts, and proof-of-concept experiments.',
    matchKeywords: [
      'look what i built', 'look what we built', 'i built', 'we built', 'show-and-tell', 'prototype',
      'proof of concept', 'poc', 'screencast', 'screen recording', 'demo', 'showcase', '15 minutes later',
      'hardware setup', 'working prototype', 'weekend project', 'side project', 'experiment', 'test clip',
      'check out this demo', 'show and tell', 'maker build'
    ]
  },
  {
    id: 'cluster_memes_humour',
    number: 7,
    name: 'Memes, Satire & Internet Humour',
    definition: 'Content intended purely for entertainment, comedic relief, hyperbolic parody, developer irony, or viral social humor.',
    classificationSignals: 'Absurdist scenarios, sarcastic commentary, self-deprecating developer jokes, viral video captions, physics/science puns, or punchy comedic one-liners.',
    disambiguation: 'Differentiated by the lack of serious informational, academic, or instructional intent.',
    description: 'Entertainment, comedic relief, hyperbolic parody, developer irony, and internet humor.',
    matchKeywords: [
      'meme', 'satire', 'humour', 'humor', 'joke', 'lmao', 'lol', 'shitpost', 'funny', 'parody', 'irony',
      'developer joke', 'absurdist', 'sarcastic', 'self-deprecating', 'viral caption', 'pun', 'comedic',
      'one-liner', 'comedy', 'comic', 'punchline', 'satirical'
    ]
  },
  {
    id: 'cluster_polemics_debate',
    number: 8,
    name: 'Polemics, Debate Clips & Citizen Journalism',
    definition: 'Emotionally charged socio-political media, political protest documentation, television debate snippets, partisan commentary, or accusations of bias/hypocrisy.',
    classificationSignals: 'Political hashtags, protest coverage, media callouts, debate video clips, partisan vocabulary ("exposed," "protest," "riots," political party references).',
    disambiguation: 'Differentiated by its sociopolitical and adversarial focus, distinct from technical or professional industry discourse.',
    description: 'Socio-political debate, television clips, citizen journalism, and ideological discourse.',
    matchKeywords: [
      'polemic', 'debate clip', 'citizen journalism', 'protest', 'exposed', 'riots', 'partisan', 'political',
      'hypocrisy', 'bias', 'media callout', 'television debate', 'sociopolitical', 'activism', 'scandal',
      'adversarial', 'controversy', 'election', 'court', 'rally', 'politicians', 'ideological'
    ]
  },
  {
    id: 'cluster_creative_arts',
    number: 9,
    name: 'Creative Arts, Cinema & Visual Media',
    definition: 'Aesthetic, cultural, or artistic media posts focused on film retrospectives, digital art renders, architecture, photography, and fine art appreciation.',
    classificationSignals: 'Art credits, image-generation model prompts (e.g., Midjourney), film ranking tags, mentions of directors/actors, or photographic showcases of residential design.',
    disambiguation: 'Differentiated by its focus on visual and narrative aesthetics rather than software utilities, engineering, or socio-political debate.',
    description: 'Film retrospectives, digital art renders, architecture, photography, and fine art appreciation.',
    matchKeywords: [
      'cinema', 'visual media', 'creative arts', 'film', 'movie', 'director', 'photography', 'fine art',
      'architecture', 'midjourney prompt', 'midjourney', 'art credit', 'digital art', 'aesthetic', 'render',
      'gallery', 'cinematography', 'retrospective', 'design showcase', 'art exhibition', 'photographer'
    ]
  },
  {
    id: 'cluster_promotional_pitches_others',
    number: 10,
    name: 'Promotional Pitches & Others',
    definition: 'Marketing-focused content designed to capture leads, drive traffic to a commercial service, promote paid communities, or solicit social engagement via gating.',
    classificationSignals: 'Calls to action such as "Reply \'Send\' to get X," "join our cohort," explicit advertising copy, affiliate/UTM links, or commercial product promotions.',
    disambiguation: 'Differentiated from open educational materials by the requirement of transactional engagement (comments, retweets, paid signups) to access the resource. If any content is outside then add it to "Promotional Pitches & Others". Strictly no other category should be present and replace all existing ones with these.',
    description: 'Marketing content, lead magnets, commercial product promotions, and all outside content.',
    matchKeywords: [
      'reply send', 'reply "send"', 'join our cohort', 'lead magnet', 'promotional pitch', 'paid community',
      'discount code', 'limited spots', 'affiliate link', 'utm_', 'buy now', 'presale', 'free masterclass',
      'comment to receive', 'sign up for my course', 'ad copy', 'sponsor', 'sponsored', 'enroll now',
      'special offer', 'promo code'
    ]
  }
];

// Alias for backwards compatibility if needed
export const CANONICAL_DOMAINS = CANONICAL_TOPICS;

/**
 * Clusters extracted topics into the 10 canonical topic clusters strictly defined by user requirements.
 * Any unassigned topics and outside content are strictly added to "Promotional Pitches & Others".
 * Strictly no other category is present.
 */
export function clusterTopics(
  allSubTopics: SubTopic[],
  records: XHistoryRecord[],
  maxClusters: number = 10
): TopicClusterGroup[] {
  // 1. Initialize buckets for all 10 canonical topics
  const buckets = new Map<string, {
    template: CanonicalTopicTemplate;
    topics: SubTopic[];
  }>();

  CANONICAL_TOPICS.forEach(topic => {
    buckets.set(topic.id, {
      template: topic,
      topics: []
    });
  });

  const unassignedTopics: SubTopic[] = [];

  // 2. Assign subtopics into the 10 canonical topic buckets
  (allSubTopics || []).forEach(st => {
    const labelLower = st.label.toLowerCase();
    const keywords = (st.keywords || []).map(k => k.toLowerCase());
    const parentLower = (st.parentTopic || '').toLowerCase();

    let bestTopicId: string | null = null;
    let maxMatchScore = 0;

    CANONICAL_TOPICS.forEach(topic => {
      let score = 0;
      const topicNameLower = topic.name.toLowerCase();

      // Direct parent topic equality check
      if (parentLower && (topicNameLower.includes(parentLower) || parentLower.includes(topicNameLower))) {
        score += 10;
      }

      // Exact title or keyword matching
      topic.matchKeywords.forEach(kw => {
        if (labelLower === kw) score += 6;
        else if (labelLower.includes(kw)) score += 3;

        if (parentLower.includes(kw)) score += 2;
        if (keywords.some(k => k === kw)) score += 3;
        else if (keywords.some(k => k.includes(kw))) score += 1;
      });

      if (score > maxMatchScore) {
        maxMatchScore = score;
        bestTopicId = topic.id;
      }
    });

    if (bestTopicId && maxMatchScore >= 2) {
      buckets.get(bestTopicId)!.topics.push(st);
    } else {
      unassignedTopics.push(st);
    }
  });

  // Strictly route all unassigned topics into topic 10: "Promotional Pitches & Others"
  if (unassignedTopics.length > 0) {
    const othersBucket = buckets.get('cluster_promotional_pitches_others');
    if (othersBucket) {
      othersBucket.topics.push(...unassignedTopics);
    }
  }

  // Pre-calculate which records match topics 1 through 9
  const matchedInOneToNine = new Set<string>();
  const topicsOneToNine = CANONICAL_TOPICS.filter(t => t.number !== 10);

  topicsOneToNine.forEach(template => {
    const assigned = buckets.get(template.id)!.topics;
    const combinedKeywords = [
      ...template.matchKeywords,
      template.name,
      ...assigned.flatMap(t => [...t.keywords, t.label])
    ];
    (records || []).forEach(r => {
      if (recordMatchesKeywords(r, combinedKeywords)) {
        matchedInOneToNine.add(r.id);
      }
    });
  });

  // 3. Build the 10 topic groups with accurate record snippet counts
  const resultClusters: TopicClusterGroup[] = [];

  CANONICAL_TOPICS.forEach(template => {
    const bucket = buckets.get(template.id)!;
    const assignedTopics = bucket.topics;

    let matchingRecords: XHistoryRecord[] = [];

    if (template.number === 10) {
      // Topic 10: matches explicit promotional keywords OR any record that falls outside categories 1-9
      const combinedKeywords = [
        ...template.matchKeywords,
        template.name,
        ...assignedTopics.flatMap(t => [...t.keywords, t.label])
      ];

      matchingRecords = (records || []).filter(r => {
        const matchesPromo = recordMatchesKeywords(r, combinedKeywords);
        const isOutside = !matchedInOneToNine.has(r.id);
        return matchesPromo || isOutside;
      });
    } else {
      const combinedKeywords = [
        ...template.matchKeywords,
        template.name,
        ...assignedTopics.flatMap(t => [...t.keywords, t.label])
      ];
      matchingRecords = (records || []).filter(r => recordMatchesKeywords(r, combinedKeywords));
    }

    const totalSnippets = matchingRecords.length;
    assignedTopics.sort((a, b) => (b.count ?? 0) - (a.count ?? 0));

    resultClusters.push({
      id: template.id,
      number: template.number,
      name: template.name,
      definition: template.definition,
      classificationSignals: template.classificationSignals,
      disambiguation: template.disambiguation,
      description: template.description,
      topics: assignedTopics,
      totalSnippets,
      isOthers: template.number === 10
    });
  });

  return resultClusters;
}

  // Memoization cache for cluster matching
const clusterMatchCache = new Map<string, boolean>();

/**
 * Checks if a record matches any topic or signal in a cluster group.
 * If topic 10 ("Promotional Pitches & Others"), matches promo keywords or any outside content.
 */
export function recordMatchesCluster(record: XHistoryRecord, cluster: TopicClusterGroup): boolean {
  if (!cluster || !record) return false;

  const cacheKey = `${record.id}:${cluster.id}`;
  if (record.id && clusterMatchCache.has(cacheKey)) {
    return clusterMatchCache.get(cacheKey)!;
  }

  const canonical = CANONICAL_TOPICS.find(c => c.id === cluster.id);
  const clusterKeywords: string[] = [
    ...(canonical ? canonical.matchKeywords : []),
    ...(cluster.topics || []).flatMap(t => [...(t.keywords || []), t.label])
  ];

  let matches = false;
  if (cluster.number === 10 || cluster.id === 'cluster_promotional_pitches_others') {
    if (recordMatchesKeywords(record, clusterKeywords)) {
      matches = true;
    } else {
      // Outside content check: does it match any of clusters 1 through 9?
      const otherTemplates = CANONICAL_TOPICS.filter(t => t.number !== 10);
      const matchesAnyOther = otherTemplates.some(t => recordMatchesKeywords(record, [...t.matchKeywords, t.name]));
      matches = !matchesAnyOther;
    }
  } else if (clusterKeywords.length > 0) {
    matches = recordMatchesKeywords(record, clusterKeywords);
  }

  if (record.id) {
    clusterMatchCache.set(cacheKey, matches);
  }
  return matches;
}
