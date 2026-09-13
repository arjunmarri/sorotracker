import { XHistoryRecord, TopicCluster, SubTopic } from '../types';

interface RecordSearchProfile {
  combined: string;
  rawTagsSet: Set<string>;
  cleanTagsSet: Set<string>;
}

const recordProfileCache = new Map<string, RecordSearchProfile>();

export function getRecordSearchProfile(record: XHistoryRecord): RecordSearchProfile {
  if (record.id && recordProfileCache.has(record.id)) {
    return recordProfileCache.get(record.id)!;
  }

  const text = (record.text || '').toLowerCase();
  const author = `${record.authorName || ''} ${record.authorHandle || ''}`.toLowerCase();
  const rawTags = (record.tags || []).map(t => t.toLowerCase().trim());
  const cleanTags = rawTags.map(t => t.replace(/^[#@]/, ''));
  const linkTexts = (record.links || []).map(l => `${l.title || ''} ${l.domain || ''} ${l.url || ''}`.toLowerCase()).join(' ');
  const combined = `${text} ${author} ${rawTags.join(' ')} ${cleanTags.join(' ')} ${linkTexts}`;

  const profile: RecordSearchProfile = {
    combined,
    rawTagsSet: new Set(rawTags),
    cleanTagsSet: new Set(cleanTags)
  };

  if (record.id) {
    recordProfileCache.set(record.id, profile);
  }
  return profile;
}

// Pre-compiled regex cache to avoid compiling RegExps in tight loops
const compiledRegexCache = new Map<string, RegExp>();

function getCompiledRegex(pattern: string, flags: string): RegExp {
  const key = `${flags}:${pattern}`;
  let rx = compiledRegexCache.get(key);
  if (!rx) {
    rx = new RegExp(pattern, flags);
    compiledRegexCache.set(key, rx);
  }
  return rx;
}

/**
 * High-precision, high-performance keyword matcher for snippet text, tags, and metadata
 */
export function recordMatchesKeywords(record: XHistoryRecord, keywords: string[]): boolean {
  if (!keywords || keywords.length === 0) return false;
  
  const profile = getRecordSearchProfile(record);

  for (let i = 0; i < keywords.length; i++) {
    const keyword = keywords[i];
    const kw = keyword.toLowerCase().trim();
    if (!kw) continue;

    // Direct tag match using O(1) set lookup
    const cleanKw = kw.replace(/^[#@]/, '');
    if (profile.rawTagsSet.has(kw) || profile.cleanTagsSet.has(cleanKw)) {
      return true;
    }

    // If keyword starts with #
    if (kw.startsWith('#')) {
      if (profile.combined.includes(kw)) return true;
      const escaped = cleanKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const hashRegex = getCompiledRegex(`(?:^|\\s|[.,!?;:(])#${escaped}(?:$|\\s|[.,!?;:)-])`, 'i');
      if (hashRegex.test(profile.combined)) return true;
      continue;
    }

    // For short 2-4 letter words (e.g. ai, llm, rag, api, ui, dx, ml, py), use boundary check
    if (kw.length <= 4) {
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = getCompiledRegex(`(?:^|\\s|[.,!?;:(#])(${escaped})(?:$|\\s|[.,!?;:)-])`, 'i');
      if (regex.test(profile.combined)) return true;
      continue;
    }

    if (profile.combined.includes(kw)) {
      return true;
    }
  }

  return false;
}

/**
 * Checks whether a snippet matches a given sub-topic
 */
export function recordMatchesSubTopic(record: XHistoryRecord, subTopic: SubTopic): boolean {
  if (!subTopic) return false;
  const keywords = [...subTopic.keywords, subTopic.label];
  return recordMatchesKeywords(record, keywords);
}

/**
 * Filter an array of records to those matching a specific sub-topic
 */
export function filterRecordsBySubTopic(records: XHistoryRecord[], subTopic: SubTopic): XHistoryRecord[] {
  return records.filter(r => recordMatchesSubTopic(r, subTopic));
}

// Canonical sub-topic library covering common tech, AI, system design & startup themes
interface SubTopicDefinition {
  id: string;
  label: string;
  keywords: string[];
  defaultParentTopic: string;
}

/**
 * Unification mapping for topic keywords:
 * - Combines LLM, #LLM, #llm, Large Language Models together into "Large Language Models (LLMs)"
 * - Combines Python, #python, #Python, and Python ecosystem keywords together into "Python-related"
 */
export function getCanonicalTopicMapping(rawTagOrLabel: string): {
  canonicalId: string;
  canonicalLabel: string;
  canonicalParentTopic: string;
  extraKeywords: string[];
} | null {
  const trimmed = (rawTagOrLabel || '').trim();
  const lower = trimmed.toLowerCase();
  const clean = lower.replace(/^[#@]/, '').trim();

  // 1. LLM & Large Language Models group:
  // Combines: LLM, #LLM, #llm, Large Language Models, Large Language Model, LLMs, #LLMs
  if (
    clean === 'llm' ||
    clean === 'llms' ||
    clean === 'largelanguagemodel' ||
    clean === 'largelanguagemodels' ||
    lower.includes('large language model') ||
    lower === '#llm' ||
    lower === '#llms' ||
    trimmed === 'LLM' ||
    trimmed === '#LLM'
  ) {
    return {
      canonicalId: 'sub_llm_models',
      canonicalLabel: 'Large Language Models (LLMs)',
      canonicalParentTopic: 'News & Product Announcements',
      extraKeywords: [
        'llm',
        '#llm',
        '#LLM',
        'LLM',
        'large language model',
        'large language models',
        'large language models (llms)',
        'llms',
        '#llms'
      ]
    };
  }

  // 2. Python-related group:
  // Combines: python, #python, #Python, Python, python3, pytorch, fastapi, pandas, numpy, django, flask, jupyter, pydantic, poetry, pip, scikit-learn, etc.
  const isPython = (
    clean === 'python' ||
    clean === 'python3' ||
    clean === 'py' ||
    clean === 'pythonic' ||
    clean === 'python-related' ||
    clean.startsWith('python-') ||
    clean.endsWith('-python') ||
    lower === '#python' ||
    lower === '#python3' ||
    lower === '#fastapi' ||
    lower === '#pytorch' ||
    lower === '#pandas' ||
    lower === '#django' ||
    lower === '#flask' ||
    lower === '#numpy' ||
    lower === '#jupyter' ||
    ['fastapi', 'pytorch', 'pandas', 'numpy', 'django', 'flask', 'jupyter', 'pydantic', 'poetry', 'pip', 'scikit-learn', 'scikit', 'matplotlib', 'scipy', 'pep'].includes(clean) ||
    /python|pytorch|fastapi|pandas|django|flask|jupyter|pydantic/i.test(clean)
  );

  if (isPython) {
    return {
      canonicalId: 'sub_python_related',
      canonicalLabel: 'Python-related',
      canonicalParentTopic: 'Tutorials, How-Tos & Technical Guides',
      extraKeywords: [
        'python',
        '#python',
        '#Python',
        'Python',
        'python-related',
        'python3',
        'pytorch',
        'fastapi',
        'pandas',
        'numpy',
        'django',
        'flask',
        'jupyter',
        'pydantic',
        'poetry',
        'pip',
        'scikit-learn',
        'pep',
        'py'
      ]
    };
  }

  return null;
}

const CANONICAL_SUBTOPIC_DEFINITIONS: SubTopicDefinition[] = [
  // 1. White Papers & Research Summaries
  {
    id: 'sub_arxiv_papers',
    label: 'arXiv Preprints & Formal Research',
    keywords: ['arxiv', 'paper', 'preprint', 'empirical study', 'researchers', 'deepmind', 'stanford', 'mit', 'berkeley', 'methodology', 'algorithmic theory', 'banger paper', 'they propose a method'],
    defaultParentTopic: 'White Papers & Research Summaries'
  },
  {
    id: 'sub_neural_networks',
    label: 'Neural Networks & Deep Learning',
    keywords: ['neural network', 'deep learning', 'backpropagation', 'weights', 'activation', 'perceptron', 'pmmp', 'illustrated guide'],
    defaultParentTopic: 'White Papers & Research Summaries'
  },
  {
    id: 'sub_reasoning_evals',
    label: 'Reasoning & Alignment Evals',
    keywords: ['reasoning', 'chain of thought', 'cot', 'test-time compute', 'rlhf', 'benchmark', 'alignment', 'evals', 'hallucination'],
    defaultParentTopic: 'White Papers & Research Summaries'
  },
  {
    id: 'sub_fine_tuning_quant',
    label: 'Fine-Tuning & Quantization',
    keywords: ['fine-tuning', 'lora', 'qlora', 'quantization', 'gguf', 'awq', 'vllm', 'ollama', 'weights', 'training'],
    defaultParentTopic: 'White Papers & Research Summaries'
  },

  // 2. News & Product Announcements
  {
    id: 'sub_llm_models',
    label: 'Foundation Model Releases (LLMs)',
    keywords: [
      'llm',
      '#llm',
      '#LLM',
      'LLM',
      'large language model',
      'large language models',
      'large language models (llms)',
      'llms',
      '#llms',
      'gpt',
      'claude',
      'gemini',
      'llama',
      'mistral',
      'deepseek',
      'introducing',
      'now available',
      'just dropped',
      'model release',
      'live in beta'
    ],
    defaultParentTopic: 'News & Product Announcements'
  },
  {
    id: 'sub_public_apis',
    label: 'Public APIs & Platform Changes',
    keywords: ['public api', 'api release', 'platform change', 'official statement', 'general availability', 'ga release', 'changelog', 'sdk release'],
    defaultParentTopic: 'News & Product Announcements'
  },

  // 3. Tutorials, How-Tos & Technical Guides
  {
    id: 'sub_code_walkthroughs',
    label: 'Step-by-Step Code Walkthroughs',
    keywords: ['tutorial', 'how-to', 'how to', 'step 1', 'step 2', 'here is how', 'from scratch', 'walkthrough', 'step-by-step', 'build your own'],
    defaultParentTopic: 'Tutorials, How-Tos & Technical Guides'
  },
  {
    id: 'sub_python_related',
    label: 'Python-related',
    keywords: [
      'python',
      '#python',
      '#Python',
      'Python',
      'python-related',
      'python3',
      'pytorch',
      'fastapi',
      'pandas',
      'numpy',
      'django',
      'flask',
      'jupyter',
      'pydantic',
      'poetry',
      'pip',
      'scikit-learn',
      'matplotlib',
      'scipy',
      'pep',
      'py'
    ],
    defaultParentTopic: 'Tutorials, How-Tos & Technical Guides'
  },
  {
    id: 'sub_agents_workflows',
    label: 'Agentic Workflows & Multi-Agent',
    keywords: ['agent', 'agentic', 'tool use', 'function calling', 'autonomous', 'workflow', 'orchestration', 'langchain'],
    defaultParentTopic: 'Tutorials, How-Tos & Technical Guides'
  },
  {
    id: 'sub_rag_search',
    label: 'RAG & Vector Search',
    keywords: ['rag', 'retrieval', 'vector', 'embedding', 'chroma', 'pinecone', 'search', 'similarity'],
    defaultParentTopic: 'Tutorials, How-Tos & Technical Guides'
  },
  {
    id: 'sub_system_design',
    label: 'System Design & Architecture',
    keywords: ['system design', 'distributed systems', 'playbook', 'scalability', 'microservices', 'load balancer', 'systemdesignone', 'architectural'],
    defaultParentTopic: 'Tutorials, How-Tos & Technical Guides'
  },
  {
    id: 'sub_frontend_react',
    label: 'Frontend Frameworks & React',
    keywords: ['react', 'next.js', 'vite', 'frontend', 'components', 'state management', 'hydration', 'dom'],
    defaultParentTopic: 'Tutorials, How-Tos & Technical Guides'
  },
  {
    id: 'sub_typescript_tooling',
    label: 'TypeScript & Type Systems',
    keywords: ['typescript', 'javascript', 'compiler', 'type safety', 'linter', 'eslint', 'tsc'],
    defaultParentTopic: 'Tutorials, How-Tos & Technical Guides'
  },
  {
    id: 'sub_backend_apis',
    label: 'Backend & High-Throughput APIs',
    keywords: ['backend', 'api', 'express', 'node', 'database', 'postgres', 'sqlite', 'caching', 'redis'],
    defaultParentTopic: 'Tutorials, How-Tos & Technical Guides'
  },
  {
    id: 'sub_devops_infra',
    label: 'Cloud Infrastructure & DevOps',
    keywords: ['docker', 'kubernetes', 'aws', 'gcp', 'cloud run', 'serverless', 'ci/cd', 'deployment'],
    defaultParentTopic: 'Tutorials, How-Tos & Technical Guides'
  },

  // 4. Curated Cheat Sheets, Roadmaps & Lists
  {
    id: 'sub_learning_roadmaps',
    label: 'Roadmaps & Learning Paths',
    keywords: ['roadmap', 'roadmap to learn', 'learning path', 'syllabus', 'curriculum', 'study guide'],
    defaultParentTopic: 'Curated Cheat Sheets, Roadmaps & Lists'
  },
  {
    id: 'sub_cheatsheets_infographics',
    label: 'Cheat Sheets & Infographics',
    keywords: ['cheat sheet', 'cheatsheet', 'infographic', 'high-density', 'reference guide', 'quick reference'],
    defaultParentTopic: 'Curated Cheat Sheets, Roadmaps & Lists'
  },
  {
    id: 'sub_books_reading',
    label: 'Curated Lists & Book Collections',
    keywords: ['book collection', 'books to read', 'top resources', 'top 10', 'top 5', 'top tools', 'bookmark this collection', 'reading list', 'directory'],
    defaultParentTopic: 'Curated Cheat Sheets, Roadmaps & Lists'
  },

  // 5. Commentary, Essays & Thought Leadership
  {
    id: 'sub_startup_execution',
    label: 'Startups & Strategic Analysis',
    keywords: ['startup', 'founder', 'venture', 'growth', 'market', 'pitch', 'investor', 'seed', 'capex', 'product market fit', 'i believe', 'i think', 'macroeconomic'],
    defaultParentTopic: 'Commentary, Essays & Thought Leadership'
  },
  {
    id: 'sub_engineering_culture',
    label: 'Thought Leadership & Paradigms',
    keywords: ['i wrote about', 'perspective', 'culture', 'paradigm', 'speculative essay', 'critique', 'manifesto', 'thesis'],
    defaultParentTopic: 'Commentary, Essays & Thought Leadership'
  },

  // 6. Project Demos & Build Showcases
  {
    id: 'sub_working_prototypes',
    label: 'Working Prototypes & Build Demos',
    keywords: ['look what i built', 'look what we built', 'i built', 'show-and-tell', 'prototype', 'proof of concept', 'poc', 'screencast', 'screen recording', 'demo', 'showcase', '15 minutes later'],
    defaultParentTopic: 'Project Demos & Build Showcases'
  },

  // 7. Memes, Satire & Internet Humour
  {
    id: 'sub_memes_humour',
    label: 'Dev Humor & Satirical Memes',
    keywords: ['meme', 'satire', 'humour', 'humor', 'joke', 'lmao', 'lol', 'shitpost', 'funny', 'parody', 'irony', 'developer joke', 'absurdist', 'sarcastic', 'pun'],
    defaultParentTopic: 'Memes, Satire & Internet Humour'
  },

  // 8. Polemics, Debate Clips & Citizen Journalism
  {
    id: 'sub_polemics_debate',
    label: 'Socio-Political & Debate Clips',
    keywords: ['polemic', 'debate clip', 'citizen journalism', 'protest', 'exposed', 'riots', 'partisan', 'political', 'hypocrisy', 'bias', 'media callout'],
    defaultParentTopic: 'Polemics, Debate Clips & Citizen Journalism'
  },

  // 9. Creative Arts, Cinema & Visual Media
  {
    id: 'sub_creative_arts',
    label: 'Cinema, Generative Art & Architecture',
    keywords: ['cinema', 'visual media', 'creative arts', 'film', 'movie', 'director', 'photography', 'fine art', 'architecture', 'midjourney prompt', 'art credit', 'render'],
    defaultParentTopic: 'Creative Arts, Cinema & Visual Media'
  },

  // 10. Promotional Pitches & Others
  {
    id: 'sub_promotional_pitches',
    label: 'Lead Magnets & Cohort Pitches',
    keywords: ['reply send', 'reply "send"', 'join our cohort', 'lead magnet', 'promotional pitch', 'paid community', 'discount code', 'affiliate link', 'buy now', 'presale'],
    defaultParentTopic: 'Promotional Pitches & Others'
  }
];

/**
 * Dynamically extract and build rich sub-topics based on the actual snippets
 * and link them to parent topics.
 */
export function buildSubTopicsFromSnippets(
  records: XHistoryRecord[],
  parentClusters: TopicCluster[] = []
): {
  enrichedClusters: TopicCluster[];
  allSubTopics: SubTopic[];
  subTopicCounts: Record<string, number>;
} {
  const subTopicMap = new Map<string, SubTopic>();
  const subTopicCounts: Record<string, number> = {};

  // Helper to register or update a sub-topic with count
  const registerSubTopic = (sub: SubTopic) => {
    let count = 0;
    const keywords = [...sub.keywords, sub.label];
    for (let i = 0; i < records.length; i++) {
      if (recordMatchesKeywords(records[i], keywords)) {
        count++;
      }
    }
    const enriched: SubTopic = {
      ...sub,
      count
    };
    subTopicMap.set(sub.id, enriched);
    subTopicCounts[sub.id] = count;
    return enriched;
  };

  // 1. Register canonical definitions first
  CANONICAL_SUBTOPIC_DEFINITIONS.forEach(def => {
    registerSubTopic({
      id: def.id,
      label: def.label,
      keywords: def.keywords,
      parentTopic: def.defaultParentTopic
    });
  });

  // 2. Discover additional sub-topics directly from snippets (e.g. hashtags and key entity bigrams)
  const hashtagCounts = new Map<string, number>();
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const tags = r.tags || [];
    for (let j = 0; j < tags.length; j++) {
      const clean = tags[j].replace(/^#/, '').trim();
      if (clean && clean.length >= 2) {
        hashtagCounts.set(clean, (hashtagCounts.get(clean) || 0) + 1);
      }
    }

    // Also extract inline hashtags from text #Keyword
    const inlineHashMatches = (r.text || '').match(/#([a-zA-Z0-9_]{2,30})/g);
    if (inlineHashMatches) {
      for (let k = 0; k < inlineHashMatches.length; k++) {
        const clean = inlineHashMatches[k].replace(/^#/, '').trim();
        if (clean && clean.length >= 2) {
          hashtagCounts.set(clean, (hashtagCounts.get(clean) || 0) + 1);
        }
      }
    }
  }

  // Add top hashtags as snippet-derived subtopics (prioritize canonical or recurring tags, cap at top 40)
  const sortedHashtags = Array.from(hashtagCounts.entries())
    .filter(([tag, count]) => getCanonicalTopicMapping(tag) !== null || count >= 2 || records.length < 20)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40);

  sortedHashtags.forEach(([tag]) => {
    const canonical = getCanonicalTopicMapping(tag);
    if (canonical) {
      // Merge keywords into existing canonical topic
      const existing = subTopicMap.get(canonical.canonicalId);
      if (existing) {
        const mergedKeywords = Array.from(new Set([...existing.keywords, tag, `#${tag}`, ...canonical.extraKeywords]));
        registerSubTopic({
          ...existing,
          label: canonical.canonicalLabel,
          keywords: mergedKeywords
        });
      } else {
        registerSubTopic({
          id: canonical.canonicalId,
          label: canonical.canonicalLabel,
          keywords: Array.from(new Set([tag, `#${tag}`, ...canonical.extraKeywords])),
          parentTopic: canonical.canonicalParentTopic
        });
      }
      return; // Do NOT create separate hashtag subtopic
    }

    const id = `sub_tag_${tag.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    if (!subTopicMap.has(id)) {
      // Find suitable parent topic
      let parent = 'Software Architecture & Modern Web Engineering';
      const tagLower = tag.toLowerCase();
      if (/ai|llm|gpt|neural|ml|model|agent/i.test(tagLower)) {
        parent = 'Artificial Intelligence & Computational Systems';
      } else if (/startup|founder|vc|market|book/i.test(tagLower)) {
        parent = 'Technical Strategy & Founder Insights';
      }

      registerSubTopic({
        id,
        label: `#${tag}`,
        keywords: [tag, `#${tag}`],
        parentTopic: parent
      });
    }
  });

  // 3. Process sub-topics from AI-generated TopicClusters if present
  parentClusters.forEach(cluster => {
    if (cluster.subTopics && Array.isArray(cluster.subTopics)) {
      cluster.subTopics.forEach(st => {
        const canonical = getCanonicalTopicMapping(st.label);
        if (canonical) {
          const existing = subTopicMap.get(canonical.canonicalId);
          const keywords = Array.from(new Set([...(existing?.keywords || []), ...(st.keywords || []), ...canonical.extraKeywords]));
          registerSubTopic({
            id: canonical.canonicalId,
            label: canonical.canonicalLabel,
            keywords,
            parentTopic: canonical.canonicalParentTopic,
            description: st.description || existing?.description
          });
          return;
        }

        const id = st.id || `sub_${st.label.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
        registerSubTopic({
          id,
          label: st.label,
          keywords: st.keywords || [st.label],
          parentTopic: cluster.topic,
          description: st.description
        });
      });
    }
  });

  // 4. Final consolidation pass: merge any remaining sub-topic that matches LLM or Python-related
  const toDeleteIds: string[] = [];
  subTopicMap.forEach((st, id) => {
    const canonical = getCanonicalTopicMapping(st.label);
    if (canonical && id !== canonical.canonicalId) {
      toDeleteIds.push(id);
      const target = subTopicMap.get(canonical.canonicalId);
      if (target) {
        target.keywords = Array.from(new Set([...target.keywords, ...st.keywords, st.label]));
      }
    }
  });
  toDeleteIds.forEach(id => {
    subTopicMap.delete(id);
    delete subTopicCounts[id];
  });

  // Re-verify counts for consolidated topics
  ['sub_llm_models', 'sub_python_related'].forEach(canonicalId => {
    const target = subTopicMap.get(canonicalId);
    if (target) {
      registerSubTopic(target);
    }
  });

  // 5. Group sub-topics into enriched TopicClusters
  // If parentClusters are provided, associate subtopics with them
  let enrichedClusters: TopicCluster[] = [];

  if (parentClusters.length > 0) {
    enrichedClusters = parentClusters.map(cluster => {
      // Sub-topics that belong to this cluster
      const clusterSubTopics: SubTopic[] = [];
      const clusterKeywords = (cluster.keywords || []).map(k => k.toLowerCase());

      subTopicMap.forEach(st => {
        const isExplicitParent = st.parentTopic?.toLowerCase() === cluster.topic.toLowerCase();
        const matchesClusterKeyword = st.keywords.some(k => clusterKeywords.includes(k.toLowerCase()));

        if (isExplicitParent || matchesClusterKeyword) {
          clusterSubTopics.push({
            ...st,
            parentTopic: cluster.topic
          });
        }
      });

      // Sort by count descending
      clusterSubTopics.sort((a, b) => (b.count || 0) - (a.count || 0));

      return {
        ...cluster,
        subTopics: clusterSubTopics
      };
    });
  } else {
    // Group all sub-topics by their default parent topics
    const groups = new Map<string, SubTopic[]>();
    subTopicMap.forEach(st => {
      const parent = st.parentTopic || 'General Technology';
      if (!groups.has(parent)) groups.set(parent, []);
      groups.get(parent)!.push(st);
    });

    enrichedClusters = Array.from(groups.entries()).map(([topicName, subs]) => {
      subs.sort((a, b) => (b.count || 0) - (a.count || 0));
      return {
        topic: topicName,
        description: `Curated sub-topics and discussion threads across ${topicName}.`,
        keyPoints: [`Synthesized from ${subs.length} active sub-topics across snippets.`],
        subTopics: subs
      };
    });
  }

  // Compile all subtopics list sorted by count descending (exclude zero counts unless total records is small)
  const allSubTopics = Array.from(subTopicMap.values())
    .filter(st => records.length === 0 || (st.count && st.count > 0))
    .sort((a, b) => (b.count || 0) - (a.count || 0));

  return {
    enrichedClusters,
    allSubTopics,
    subTopicCounts
  };
}

/**
 * Filter sub-topics list based on a selected parent topic
 * "When a user clicks then automatically show only these sub-topics."
 */
export function getSubTopicsForTopic(
  selectedTopic: string | null,
  allClusters: TopicCluster[],
  allSubTopics: SubTopic[]
): SubTopic[] {
  if (!selectedTopic) {
    return allSubTopics;
  }

  // Find the selected cluster
  const cluster = allClusters.find(c => c.topic.toLowerCase() === selectedTopic.toLowerCase());
  if (cluster && cluster.subTopics && cluster.subTopics.length > 0) {
    return cluster.subTopics;
  }

  // Fallback: match by parentTopic property
  const filtered = allSubTopics.filter(st => 
    st.parentTopic && st.parentTopic.toLowerCase() === selectedTopic.toLowerCase()
  );

  return filtered.length > 0 ? filtered : allSubTopics;
}
