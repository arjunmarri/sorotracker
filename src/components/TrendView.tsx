import React from 'react';
import { 
  ArrowLeft, 
  TrendingUp, 
  Sparkles, 
  RefreshCw, 
  Layers, 
  Calendar, 
  Zap, 
  ExternalLink,
  BookOpen
} from 'lucide-react';
import { XHistoryRecord, AISummaryResult } from '../types';
import { TopicClusterGroup } from '../lib/topicClustering';
import { SummarySection } from './SummarySection';

interface TrendViewProps {
  records: XHistoryRecord[];
  summary: AISummaryResult | null;
  isLoading: boolean;
  onRefresh: () => void;
  onAskQuestion: (query: string) => Promise<string>;
  onBackToTimeline: () => void;
  topicClusters?: TopicClusterGroup[];
  onSelectCluster?: (cluster: TopicClusterGroup) => void;
}

export const TrendView: React.FC<TrendViewProps> = ({
  records,
  summary,
  isLoading,
  onRefresh,
  onAskQuestion,
  onBackToTimeline,
  topicClusters = [],
  onSelectCluster
}) => {
  // Compute basic stats
  const totalSnippets = records.length;
  
  const past7DaysCount = React.useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return records.filter(r => {
      const ts = r.scannedAt || r.syncedAt || r.createdAt;
      if (!ts) return false;
      const t = typeof ts === 'number' ? ts : new Date(ts).getTime();
      return !isNaN(t) && t >= sevenDaysAgo;
    }).length;
  }, [records]);

  const authorsCount = React.useMemo(() => {
    const authors = new Set(records.map(r => r.authorHandle).filter(Boolean));
    return authors.size;
  }, [records]);

  return (
    <div id="trend-view-container" className="space-y-6 animate-fade-in">
      {/* Navigation & Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-stone-800">
        <div className="flex items-center gap-3">
          <button
            id="trend-back-to-timeline-btn"
            type="button"
            onClick={onBackToTimeline}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-stone-850 hover:bg-slate-50 dark:hover:bg-stone-800 text-slate-800 dark:text-stone-200 text-xs font-semibold border border-slate-300 dark:border-stone-700 shadow-2xs transition cursor-pointer group"
            title="Return to snippet timeline"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>Back to Timeline</span>
          </button>
          
          <div className="h-4 w-px bg-slate-300 dark:bg-stone-700 hidden sm:block" />

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Submenu: Trend & Activity
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            id="trend-resynthesize-btn"
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-semibold shadow-2xs transition cursor-pointer disabled:opacity-50"
            title="Trigger AI synthesis across your archive"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-amber-300 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Synthesizing...' : 'Re-synthesize Trend'}</span>
          </button>
        </div>
      </div>

      {/* Hero Overview Banner */}
      <div className="p-6 rounded-2xl bg-linear-to-r from-slate-900 via-slate-850 to-slate-900 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-amber-400 via-emerald-400 to-transparent pointer-events-none" />
        
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold tracking-wide uppercase bg-white/10 text-amber-300 border border-white/15 mb-3">
            <Sparkles className="w-3 h-3 text-amber-300" />
            Archive Intelligence & Ingestion Velocity
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-tight mb-2">
            Trend
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 font-sans leading-relaxed">
            High-signal executive synthesis, distilled takeaways, and 7-day ingestion velocity derived from your {totalSnippets} collected knowledge snippets.
          </p>
        </div>

        {/* Quick Metrics Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/10 relative z-10">
          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium mb-1">
              <BookOpen className="w-3 h-3 text-slate-300" />
              <span>Total Snippets</span>
            </div>
            <div className="text-lg font-bold font-mono text-white">
              {totalSnippets}
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium mb-1">
              <Zap className="w-3 h-3 text-emerald-400" />
              <span>Past 7 Days</span>
            </div>
            <div className="text-lg font-bold font-mono text-emerald-300">
              +{past7DaysCount}
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-amber-400 font-medium mb-1">
              <Layers className="w-3 h-3 text-amber-400" />
              <span>Indexed Clusters</span>
            </div>
            <div className="text-lg font-bold font-mono text-amber-300">
              {topicClusters.length}
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-blue-400 font-medium mb-1">
              <Calendar className="w-3 h-3 text-blue-400" />
              <span>Unique Sources</span>
            </div>
            <div className="text-lg font-bold font-mono text-blue-300">
              {authorsCount}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content: Trend Synthesis + Weekly Activity Chart */}
      <SummarySection
        summary={summary}
        isLoading={isLoading}
        onRefresh={onRefresh}
        onAskQuestion={onAskQuestion}
        records={records}
      />

      {/* Quick Navigation into Topic Clusters */}
      {topicClusters.length > 0 && onSelectCluster && (
        <div className="bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-800 rounded-2xl p-5 shadow-2xs">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-stone-800">
            <div>
              <h3 className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-stone-400 font-bold">
                Explore Topic Clusters
              </h3>
              <p className="text-xs text-slate-600 dark:text-stone-400 font-sans mt-0.5">
                Dive directly into categorized snippet clusters from your trends
              </p>
            </div>
            <button
              onClick={onBackToTimeline}
              className="text-xs text-slate-700 dark:text-stone-300 hover:text-black dark:hover:text-white font-medium flex items-center gap-1 transition cursor-pointer"
            >
              <span>View full timeline</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {topicClusters.slice(0, 6).map(cluster => (
              <div
                key={cluster.id}
                onClick={() => {
                  onSelectCluster(cluster);
                  onBackToTimeline();
                }}
                className="p-3 rounded-xl border border-slate-200 dark:border-stone-700 bg-slate-50/70 dark:bg-stone-850 hover:bg-white dark:hover:bg-stone-800 hover:border-slate-300 dark:hover:border-stone-600 transition cursor-pointer group shadow-2xs"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-900 dark:text-stone-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition font-sans">
                    {cluster.name}
                  </span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-stone-700 text-slate-700 dark:text-stone-300">
                    {cluster.totalSnippets}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-stone-400 font-sans line-clamp-2 leading-relaxed">
                  {cluster.description || 'Curated snippets with shared technical domain taxonomy.'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Back Button */}
      <div className="flex justify-center pt-2 pb-8">
        <button
          type="button"
          onClick={onBackToTimeline}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white dark:bg-stone-850 hover:bg-slate-50 dark:hover:bg-stone-800 text-slate-800 dark:text-stone-200 text-xs font-semibold border border-slate-300 dark:border-stone-700 shadow-xs transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Snippet Timeline</span>
        </button>
      </div>
    </div>
  );
};
