import React, { useState, useMemo } from 'react';
import { 
  Bot, 
  Sparkles, 
  TrendingUp, 
  RefreshCw, 
  ExternalLink, 
  Bookmark, 
  BookmarkCheck, 
  Heart, 
  Repeat, 
  Eye, 
  CheckCircle2, 
  Clock, 
  Compass, 
  Flame, 
  Layers, 
  Search, 
  Check, 
  Globe,
  Radio
} from 'lucide-react';
import { TopContentItem, AgentRunStatus, TweetMetrics } from '../types';
import { VerifiedBadge } from './VerifiedBadge';

interface TopContentViewProps {
  items: TopContentItem[];
  agentStatus: AgentRunStatus;
  isLoading: boolean;
  onRunAgent: (forceRefresh?: boolean) => Promise<void>;
  onSaveToTimeline: (item: TopContentItem) => Promise<void>;
  onToggleReadLater?: (itemId: string) => void;
  isReadLater?: (itemId: string) => boolean;
}

export const TopContentView: React.FC<TopContentViewProps> = ({
  items,
  agentStatus,
  isLoading,
  onRunAgent,
  onSaveToTimeline,
  onToggleReadLater,
  isReadLater
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'rank' | 'volume' | 'likes'>('rank');
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach(it => {
      if (it.category) set.add(it.category);
    });
    return ['all', ...Array.from(set)];
  }, [items]);

  // Filter and sort items
  const filteredItems = useMemo(() => {
    return items
      .filter(item => {
        const matchesCategory = selectedCategory === 'all' || item.category.toLowerCase() === selectedCategory.toLowerCase();
        const matchesSearch = !searchQuery.trim() || 
          item.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.viralSnippet.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.tags && item.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())));
        return matchesCategory && matchesSearch;
      })
      .sort((a, b) => {
        if (sortBy === 'rank') {
          return (a.rank || 99) - (b.rank || 99);
        }
        if (sortBy === 'likes') {
          return (b.metrics?.likes || 0) - (a.metrics?.likes || 0);
        }
        if (sortBy === 'volume') {
          const parseVol = (v?: string) => {
            if (!v) return 0;
            const num = parseFloat(v.replace(/[^0-9.]/g, '')) || 0;
            if (v.toLowerCase().includes('m')) return num * 1000000;
            if (v.toLowerCase().includes('k')) return num * 1000;
            return num;
          };
          return parseVol(b.volume) - parseVol(a.volume);
        }
        return 0;
      });
  }, [items, selectedCategory, searchQuery, sortBy]);

  const handleSaveItem = async (item: TopContentItem) => {
    if (savingIds.has(item.id) || savedIds.has(item.id)) return;
    setSavingIds(prev => new Set(prev).add(item.id));
    try {
      await onSaveToTimeline(item);
      setSavedIds(prev => new Set(prev).add(item.id));
    } finally {
      setSavingIds(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  const getCategoryBadgeClass = (category: string) => {
    const c = category.toLowerCase();
    if (c.includes('tech') || c.includes('ai')) {
      return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900';
    }
    if (c.includes('business') || c.includes('market')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900';
    }
    if (c.includes('science') || c.includes('space')) {
      return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-900';
    }
    if (c.includes('news') || c.includes('world')) {
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900';
    }
    return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-700';
  };

  const getSentimentBadge = (sentiment?: string) => {
    switch (sentiment) {
      case 'breaking':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900 animate-pulse">
            <Flame className="w-2.5 h-2.5" />
            Breaking
          </span>
        );
      case 'positive':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
            <TrendingUp className="w-2.5 h-2.5" />
            Positive
          </span>
        );
      case 'controversial':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
            <Radio className="w-2.5 h-2.5" />
            High Debate
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Agent Command & Status Header */}
      <div className="bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-850 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="p-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-stone-900">
                <Bot className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold font-sans tracking-tight text-slate-900 dark:text-stone-100">
                Top Content & Trending Discussions
              </h2>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                Live Agent
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-stone-400 max-w-2xl leading-relaxed">
              SoroTrack Autonomous Agent scans 𝕏 in the background to grab live trending topics, viral snippets, and community sentiment without requiring you to visit or scroll the explore page.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              id="run-agent-now-btn"
              type="button"
              disabled={isLoading || agentStatus.isRunning}
              onClick={() => onRunAgent(true)}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-stone-900 dark:hover:bg-stone-100 transition shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading || agentStatus.isRunning ? 'animate-spin' : ''}`} />
              <span>{isLoading || agentStatus.isRunning ? 'Agent Scanning 𝕏...' : 'Run Autonomous Agent'}</span>
            </button>
          </div>
        </div>

        {/* Agent Telemetry & Status Bar */}
        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-stone-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-stone-400">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5 font-mono">
              <span className="text-slate-400 dark:text-stone-500">Status:</span>
              <span className="font-semibold text-slate-800 dark:text-stone-200">
                {agentStatus.isRunning ? 'Scanning 𝕏 in Background' : 'Agent Ready'}
              </span>
            </div>

            {agentStatus.lastRunAt && (
              <div className="flex items-center gap-1.5 font-mono">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Last Scan: {new Date(agentStatus.lastRunAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            )}

            <div className="flex items-center gap-1.5 font-mono">
              <Compass className="w-3.5 h-3.5 text-slate-400" />
              <span>Monitored Topics: <strong className="text-slate-800 dark:text-stone-200">{items.length}</strong></span>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px]">
            <Globe className="w-3.5 h-3.5 text-slate-400" />
            <span>Autonomous Mode: <strong>Zero User Interaction Required</strong></span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          {categories.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                selectedCategory.toLowerCase() === cat.toLowerCase()
                  ? 'bg-slate-900 text-white font-semibold dark:bg-white dark:text-stone-900 shadow-2xs'
                  : 'bg-white dark:bg-stone-900 text-slate-600 dark:text-stone-400 hover:bg-slate-100 dark:hover:bg-stone-800 border border-slate-200 dark:border-stone-850'
              }`}
            >
              {cat === 'all' ? 'All Topics' : cat}
            </button>
          ))}
        </div>

        {/* Search and Sort */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search top topics..."
              className="pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-850 text-slate-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-slate-400 w-44 sm:w-56"
            />
          </div>

          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-850 text-slate-700 dark:text-stone-300 font-mono cursor-pointer focus:outline-none"
          >
            <option value="rank">Sort: Rank (#1..)</option>
            <option value="volume">Sort: Post Volume</option>
            <option value="likes">Sort: Likes & Viral</option>
          </select>
        </div>
      </div>

      {/* Grid of Trending Content Items */}
      {filteredItems.length === 0 ? (
        <div className="bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-850 rounded-2xl p-12 text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 dark:bg-stone-800 flex items-center justify-center text-slate-500">
            <Bot className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-slate-900 dark:text-stone-100">No matching trending topics found</h3>
            <p className="text-xs text-slate-500 dark:text-stone-400 max-w-sm mx-auto">
              Run the autonomous agent to scan 𝕏 or adjust your search filters above.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onRunAgent(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white dark:bg-white dark:text-stone-900 cursor-pointer shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Launch Agent Scan</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredItems.map(item => {
            const isSaving = savingIds.has(item.id);
            const isSaved = savedIds.has(item.id);
            const inReadLater = isReadLater ? isReadLater(item.id) : false;

            return (
              <div
                key={item.id}
                id={`trending-card-${item.id}`}
                className="bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-850 rounded-2xl p-5 hover:border-slate-300 dark:hover:border-stone-700 transition flex flex-col justify-between shadow-2xs group"
              >
                <div className="space-y-3.5">
                  {/* Card Header: Rank, Category, Sentiment, Volume */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-lg bg-slate-900 text-white dark:bg-stone-100 dark:text-stone-900">
                        #{item.rank}
                      </span>
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${getCategoryBadgeClass(item.category)}`}>
                        {item.category}
                      </span>
                      {getSentimentBadge(item.sentiment)}
                    </div>

                    {item.volume && (
                      <span className="text-xs font-mono font-semibold text-slate-500 dark:text-stone-400">
                        {item.volume}
                      </span>
                    )}
                  </div>

                  {/* Topic Title */}
                  <div className="space-y-1.5">
                    <a
                      href={item.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group/title inline-flex items-center gap-1.5 text-base font-bold text-slate-900 dark:text-stone-100 hover:text-blue-600 dark:hover:text-blue-400 transition"
                    >
                      <span className="font-sans">{item.topic}</span>
                      <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover/title:opacity-100 transition text-slate-400" />
                    </a>
                    <p className="text-xs text-slate-600 dark:text-stone-300 leading-relaxed">
                      {item.summary}
                    </p>
                  </div>

                  {/* Viral Tweet / Community Excerpt */}
                  {item.viralSnippet && (
                    <div className="bg-slate-50 dark:bg-stone-950/60 border border-slate-100 dark:border-stone-800 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-800 dark:text-stone-200">
                            {item.authorName}
                          </span>
                          {item.isVerified && <VerifiedBadge />}
                          <span className="text-slate-400 font-mono text-[11px]">
                            {item.authorHandle}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">Top Post</span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-stone-300 italic leading-relaxed">
                        "{item.viralSnippet}"
                      </p>
                    </div>
                  )}

                  {/* Metrics Bar */}
                  {item.metrics && (
                    <div className="flex items-center gap-4 text-xs font-mono text-slate-400 dark:text-stone-500 pt-1">
                      {item.metrics.likes !== undefined && (
                        <div className="flex items-center gap-1" title="Likes">
                          <Heart className="w-3.5 h-3.5 text-rose-500/80" />
                          <span>{item.metrics.likes.toLocaleString()}</span>
                        </div>
                      )}
                      {item.metrics.retweets !== undefined && (
                        <div className="flex items-center gap-1" title="Reposts">
                          <Repeat className="w-3.5 h-3.5 text-emerald-500/80" />
                          <span>{item.metrics.retweets.toLocaleString()}</span>
                        </div>
                      )}
                      {item.metrics.views && (
                        <div className="flex items-center gap-1" title="Estimated Impressions">
                          <Eye className="w-3.5 h-3.5 text-blue-500/80" />
                          <span>{item.metrics.views}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Action Bar */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-stone-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isSaving || isSaved}
                      onClick={() => handleSaveItem(item)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                        isSaved
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900'
                          : 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-stone-900 dark:hover:bg-stone-100 shadow-2xs'
                      }`}
                      title="Save this topic permanently to your SoroTrack personal archive"
                    >
                      {isSaved ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>Archived</span>
                        </>
                      ) : isSaving ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Bookmark className="w-3.5 h-3.5" />
                          <span>Save to Archive</span>
                        </>
                      )}
                    </button>

                    {onToggleReadLater && (
                      <button
                        type="button"
                        onClick={() => onToggleReadLater(item.id)}
                        className={`p-1.5 rounded-xl border text-xs transition cursor-pointer ${
                          inReadLater
                            ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                            : 'bg-slate-50 dark:bg-stone-800 border-slate-200 dark:border-stone-700 text-slate-600 dark:text-stone-300 hover:bg-slate-100'
                        }`}
                        title={inReadLater ? 'Remove from Read Later' : 'Read Later'}
                      >
                        {inReadLater ? <BookmarkCheck className="w-4 h-4 fill-current text-amber-500" /> : <Bookmark className="w-4 h-4" />}
                      </button>
                    )}
                  </div>

                  <a
                    href={item.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-stone-400 dark:hover:text-stone-100 transition"
                  >
                    <span>View on 𝕏</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
