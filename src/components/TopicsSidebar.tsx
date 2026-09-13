import React, { useState, useMemo } from 'react';
import { 
  Layers, 
  Tag, 
  X, 
  ChevronDown, 
  ChevronRight, 
  Search, 
  Filter, 
  RotateCcw, 
  Sparkles,
  ChevronUp,
  PanelRightClose,
  PanelRightOpen,
  Info,
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import { SubTopic } from '../types';
import { TopicClusterGroup } from '../lib/topicClustering';

interface TopicsSidebarProps {
  clusters: TopicClusterGroup[];
  selectedCluster: TopicClusterGroup | null;
  onSelectCluster: (cluster: TopicClusterGroup | null) => void;
  selectedSubTopic: SubTopic | null;
  onSelectSubTopic: (subTopic: SubTopic | null) => void;
  onNavigateToCategoryPage?: (cluster: TopicClusterGroup) => void;
  isOpen?: boolean;
  onToggleOpen?: () => void;
  onClose?: () => void;
  onOpen?: () => void;
  className?: string;
  archiveSearchQuery?: string;
  onArchiveSearchChange?: (q: string) => void;
  onArchiveSearchSubmit?: (q: string) => void;
}

const TopicsSidebarComponent: React.FC<TopicsSidebarProps> = ({
  clusters,
  selectedCluster,
  onSelectCluster,
  selectedSubTopic,
  onSelectSubTopic,
  onNavigateToCategoryPage,
  isOpen = true,
  onToggleOpen,
  onClose,
  onOpen,
  className = '',
  archiveSearchQuery,
  onArchiveSearchChange,
  onArchiveSearchSubmit
}) => {
  const [topicFilterQuery, setTopicFilterQuery] = useState('');
  // Expanded state map for cluster accordions (default: all expanded for quick access)
  const [expandedClusterIds, setExpandedClusterIds] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    clusters.forEach(c => {
      initial[c.id] = true;
    });
    return initial;
  });

  const [infoClusterId, setInfoClusterId] = useState<string | null>(null);

  const totalTopicsCount = useMemo(() => {
    return clusters.reduce((acc, c) => acc + c.topics.length, 0);
  }, [clusters]);

  const toggleClusterExpanded = (id: string) => {
    setExpandedClusterIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleExpandAll = () => {
    const next: Record<string, boolean> = {};
    clusters.forEach(c => {
      next[c.id] = true;
    });
    setExpandedClusterIds(next);
  };

  const handleCollapseAll = () => {
    const next: Record<string, boolean> = {};
    clusters.forEach(c => {
      next[c.id] = false;
    });
    setExpandedClusterIds(next);
  };

  // Filter clusters & topics based on search query
  const filteredClusters = useMemo(() => {
    if (!topicFilterQuery.trim()) return clusters;
    const q = topicFilterQuery.toLowerCase();

    return clusters.map(cluster => {
      const clusterMatches = cluster.name.toLowerCase().includes(q) || 
                             (cluster.description && cluster.description.toLowerCase().includes(q));
      const matchingTopics = cluster.topics.filter(t => 
        t.label.toLowerCase().includes(q) || 
        t.keywords.some(k => k.toLowerCase().includes(q))
      );

      if (clusterMatches) {
        return cluster;
      }
      if (matchingTopics.length > 0) {
        return {
          ...cluster,
          topics: matchingTopics
        };
      }
      return null;
    }).filter((c): c is TopicClusterGroup => c !== null);
  }, [clusters, topicFilterQuery]);

  const hasActiveFilter = selectedCluster !== null || selectedSubTopic !== null;

  const handleClearAllFilters = () => {
    onSelectCluster(null);
    onSelectSubTopic(null);
  };

  const handleClose = () => {
    if (onToggleOpen) {
      onToggleOpen();
    } else if (onClose) {
      onClose();
    }
  };

  const handleOpen = () => {
    if (onToggleOpen) {
      onToggleOpen();
    } else if (onOpen) {
      onOpen();
    }
  };

  // Minimized state: keep a visible minimized symbol at the same right panel, plus a fixed viewport tab
  if (isOpen === false) {
    return (
      <>
        {/* 1. Viewport Fixed Floating Tab (Always visible on right edge regardless of scroll or screen size) */}
        <div 
          id="topics-sidebar-floating-tab-container"
          className="fixed right-0 top-1/3 z-40 select-none flex flex-col gap-1 items-end"
        >
          {/* Quick Search trigger button in floating tab */}
          <button
            type="button"
            id="floating-search-sidebar-btn"
            onClick={() => {
              handleOpen();
              setTimeout(() => {
                document.getElementById('sidebar-archive-search-input')?.focus();
              }, 120);
            }}
            title="Search Archive from Sidebar"
            aria-label="Search Archive"
            className="p-2.5 bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-800 rounded-l-xl shadow-md border-y border-l border-slate-300 cursor-pointer transition-all hover:-translate-x-1"
          >
            <Search className="w-4 h-4 text-slate-700" />
          </button>

          <button
            type="button"
            id="floating-expand-topics-sidebar-btn"
            onClick={handleOpen}
            title={`Expand Topics & Clusters (${clusters.length} clusters, ${totalTopicsCount} topics)`}
            aria-label="Expand Topics panel"
            className="group flex flex-col items-center gap-2 py-3 px-2 bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-800 rounded-l-xl shadow-lg border-y border-l border-slate-300 cursor-pointer transition-all duration-150 hover:-translate-x-1"
          >
            <div className="relative p-1.5 rounded-lg bg-slate-100 group-hover:bg-slate-200 text-slate-800">
              <Layers className="w-4 h-4 text-slate-700" />
              {hasActiveFilter && (
                <span 
                  className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full ring-2 ring-white animate-pulse" 
                  title="Active topic filter applied"
                />
              )}
            </div>

            <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-slate-700 [writing-mode:vertical-rl] rotate-180 py-1">
              Topics
            </span>

            <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
              {clusters.length}
            </span>

            <PanelRightOpen className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700" />
          </button>
        </div>

        {/* 2. In-grid Desktop Minimized Rail (At the right column) */}
        <aside 
          id="topics-sidebar-minimized"
          className={`hidden lg:block shrink-0 lg:sticky lg:top-6 z-20 select-none ${className}`}
        >
          <div className="flex flex-col items-center gap-2">
            {/* Quick search button on rail */}
            <button
              type="button"
              id="rail-search-sidebar-btn"
              onClick={() => {
                handleOpen();
                setTimeout(() => {
                  document.getElementById('sidebar-archive-search-input')?.focus();
                }, 120);
              }}
              title="Search Archive"
              aria-label="Search Archive"
              className="p-3 bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 rounded-2xl shadow-xs transition-all cursor-pointer text-slate-800"
            >
              <Search className="w-5 h-5 text-slate-700" />
            </button>

            <button
              type="button"
              id="expand-topics-sidebar-btn"
              onClick={handleOpen}
              title={`Show Topics & Clusters (${clusters.length} clusters, ${totalTopicsCount} topics)`}
              aria-label="Expand Topics panel"
              className="group relative flex flex-col items-center gap-3 py-4 px-2.5 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-300 hover:border-slate-400 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer text-slate-900 w-14 xl:w-16"
            >
              {/* Minimized Icon Symbol with Pulse Dot if Filter Active */}
              <div className="relative p-2.5 rounded-xl bg-slate-100 text-slate-800 group-hover:scale-105 transition-transform border border-slate-200 shadow-2xs">
                <Layers className="w-5 h-5 text-slate-700" />
                {hasActiveFilter && (
                  <span 
                    className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full ring-2 ring-white animate-pulse" 
                    title="Active topic filter applied"
                  />
                )}
              </div>

              {/* Expand indicator icon */}
              <div className="p-1 rounded-md bg-slate-100 group-hover:bg-slate-200 text-slate-700 transition-colors" title="Expand panel">
                <PanelRightOpen className="w-4 h-4" />
              </div>

              {/* Vertical stylized text */}
              <div className="flex flex-col items-center gap-1.5 py-2 my-0.5">
                <span className="text-xs font-sans font-bold tracking-widest uppercase text-slate-800 [writing-mode:vertical-rl] rotate-180 group-hover:text-slate-950 transition-colors">
                  Topics
                </span>
              </div>

              {/* Cluster count badge */}
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 transition-colors shadow-2xs">
                {clusters.length}
              </span>
            </button>
          </div>
        </aside>
      </>
    );
  }

  return (
    <aside 
      id="topics-sidebar-container"
      className={`w-full lg:w-80 xl:w-88 shrink-0 lg:sticky lg:top-6 z-20 transition-all duration-200 ${className}`}
    >
      <div 
        id="topics-sidebar"
        className="bg-white border border-slate-200 rounded-2xl flex flex-col shadow-xs overflow-hidden"
      >
        {/* Sidebar Header */}
        <div className="p-3.5 sm:p-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 shadow-2xs">
                <Layers className="w-4 h-4 text-slate-700" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-sans font-bold text-slate-900 tracking-tight">
                    Topics
                  </h2>
                  <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    {clusters.length} {clusters.length === 1 ? 'cluster' : 'clusters'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-sans mt-0.5">
                  {totalTopicsCount} extracted topics across your archive
                </p>
              </div>
            </div>

            <button
              type="button"
              id="hide-topics-sidebar-btn"
              onClick={handleClose}
              title="Hide Topics sidebar (minimize to right panel)"
              className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-[#EFECE5] border border-transparent hover:border-[#DDD7CC] transition cursor-pointer flex items-center gap-1 text-xs select-none"
            >
              <PanelRightClose className="w-4 h-4 text-stone-600" />
              <span className="text-[11px] font-medium hidden sm:inline">Hide</span>
            </button>
          </div>

        {/* Archive Search Option (Dedicated Search on the sidebar) */}
        <div className="mb-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              id="sidebar-archive-search-input"
              value={archiveSearchQuery || ''}
              onChange={(e) => onArchiveSearchChange && onArchiveSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && onArchiveSearchSubmit && archiveSearchQuery) {
                  onArchiveSearchSubmit(archiveSearchQuery);
                }
              }}
              placeholder="Search archive... (press Enter)"
              className="w-full pl-8 pr-7 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:border-slate-800 text-slate-900 placeholder-slate-400 shadow-2xs transition"
            />
            {archiveSearchQuery && (
              <button
                type="button"
                id="sidebar-clear-archive-search-btn"
                onClick={() => onArchiveSearchChange && onArchiveSearchChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer p-0.5"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Active Filter Notification Bar */}
        {hasActiveFilter && (
          <div className="mt-2.5 p-2 rounded-lg bg-stone-900 text-white flex items-center justify-between text-xs animate-fadeIn">
            <div className="flex items-center gap-1.5 min-w-0 pr-2">
              <Filter className="w-3.5 h-3.5 text-stone-300 shrink-0" />
              <div className="truncate text-[11px]">
                {selectedSubTopic ? (
                  <span>Topic: <strong className="font-semibold text-white">{selectedSubTopic.label}</strong> ({selectedSubTopic.count ?? 0})</span>
                ) : selectedCluster ? (
                  <span>Cluster: <strong className="font-semibold text-white">{selectedCluster.name}</strong> ({selectedCluster.totalSnippets})</span>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="text-[10px] font-mono text-stone-300 hover:text-white underline shrink-0 cursor-pointer"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Clusters List Container */}
      <div className="p-3 sm:p-3.5 space-y-2.5 overflow-y-auto max-h-[calc(100vh-14rem)] lg:max-h-[calc(100vh-13rem)]">
        {filteredClusters.length === 0 ? (
          <div className="py-8 text-center px-4">
            <p className="text-xs text-stone-500 italic">No topics or clusters match "{topicFilterQuery}".</p>
            <button
              type="button"
              onClick={() => setTopicFilterQuery('')}
              className="mt-2 text-xs text-stone-800 underline font-semibold cursor-pointer"
            >
              Reset filter
            </button>
          </div>
        ) : (
          filteredClusters.map((cluster) => {
            const isClusterExpanded = expandedClusterIds[cluster.id] ?? true;
            const isClusterSelected = selectedCluster?.id === cluster.id && !selectedSubTopic;
            const isOthers = cluster.isOthers;

            return (
              <div
                key={cluster.id}
                id={`cluster-card-${cluster.id}`}
                className={`rounded-xl border transition overflow-hidden ${
                  isClusterSelected
                    ? 'bg-slate-50 border-slate-400 shadow-2xs'
                    : isOthers
                    ? 'bg-slate-50/60 border-slate-200'
                    : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                }`}
              >
                {/* Cluster Header */}
                <div 
                  className={`p-2.5 flex items-center justify-between gap-2 select-none cursor-pointer transition ${
                    isClusterSelected ? 'bg-slate-100/70' : 'hover:bg-slate-50'
                  }`}
                  onClick={() => toggleClusterExpanded(cluster.id)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleClusterExpanded(cluster.id);
                      }}
                      className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                      title={isClusterExpanded ? "Collapse cluster" : "Expand cluster"}
                    >
                      {isClusterExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {cluster.number && (
                          <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-1 py-0.2 rounded border border-slate-200 shrink-0">
                            {cluster.number}
                          </span>
                        )}
                        <h3 className="text-xs font-sans font-bold text-slate-900 truncate">
                          {cluster.name}
                        </h3>
                        {isOthers && (
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-200">
                            Others
                          </span>
                        )}
                        {cluster.definition && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setInfoClusterId(infoClusterId === cluster.id ? null : cluster.id);
                            }}
                            title="View definition, classification signals & disambiguation"
                            className={`p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer ${
                              infoClusterId === cluster.id ? 'text-amber-800 bg-amber-100' : ''
                            }`}
                          >
                            <Info className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Cluster Snippet Count & Filter Button */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {onNavigateToCategoryPage && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateToCategoryPage(cluster);
                        }}
                        title={`Open dedicated category page for ${cluster.name}`}
                        className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded transition cursor-pointer"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}

                    <span 
                      className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${
                        isClusterSelected
                          ? 'bg-slate-200/90 text-slate-800 border-slate-300 font-semibold shadow-2xs'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                      title={`${cluster.totalSnippets} matching snippets`}
                    >
                      {cluster.totalSnippets}
                    </span>

                    {/* Filter by entire cluster button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isClusterSelected) {
                          onSelectCluster(null);
                        } else {
                          onSelectSubTopic(null);
                          onSelectCluster(cluster);
                        }
                      }}
                      title={isClusterSelected ? "Clear cluster filter" : "Filter timeline by this whole cluster"}
                      className={`px-1.5 py-0.5 text-[10px] font-medium rounded transition cursor-pointer flex items-center gap-1 ${
                        isClusterSelected
                          ? 'bg-slate-200/90 text-slate-800 border border-slate-300 font-semibold shadow-2xs'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      <Filter className="w-2.5 h-2.5" />
                      <span>{isClusterSelected ? 'Active' : 'All'}</span>
                    </button>
                  </div>
                </div>

                {/* Info Drawer for Topic Definition, Classification Signals & Disambiguation */}
                {infoClusterId === cluster.id && (
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    className="p-3 bg-amber-50/80 border-t border-b border-amber-200/90 text-[11px] font-sans text-stone-800 space-y-2 leading-relaxed"
                  >
                    {cluster.definition && (
                      <div>
                        <span className="font-semibold text-amber-950 font-serif">Definition: </span>
                        <span className="text-stone-700">{cluster.definition}</span>
                      </div>
                    )}
                    {cluster.classificationSignals && (
                      <div>
                        <span className="font-semibold text-amber-950 font-serif">Classification Signals: </span>
                        <span className="text-stone-700">{cluster.classificationSignals}</span>
                      </div>
                    )}
                    {cluster.disambiguation && (
                      <div>
                        <span className="font-semibold text-amber-950 font-serif">Disambiguation: </span>
                        <span className="text-stone-700">{cluster.disambiguation}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Cluster Body: Topics Chips */}
                {isClusterExpanded && (() => {
                  const sortedTopics = [...cluster.topics].sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
                  const maxSidebarTopics = 20;
                  const displayedTopics = sortedTopics.slice(0, maxSidebarTopics);
                  const hasMoreTopics = sortedTopics.length > maxSidebarTopics;
                  const remainingCount = sortedTopics.length - maxSidebarTopics;

                  return (
                    <div className="p-2.5 pt-1.5 border-t border-slate-100 bg-slate-50/50">
                      {cluster.description && (
                        <p className="text-[10.5px] text-slate-500 font-sans mb-2 leading-relaxed">
                          {cluster.description}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-1.5">
                        {displayedTopics.map((topic) => {
                          const isTopicSelected = selectedSubTopic?.id === topic.id;
                          const count = topic.count ?? 0;

                          return (
                            <button
                              key={topic.id}
                              type="button"
                              onClick={() => {
                                if (isTopicSelected) {
                                  onSelectSubTopic(null);
                                } else {
                                  onSelectCluster(null);
                                  onSelectSubTopic(topic);
                                }
                              }}
                              title={`${topic.label}: ${count} snippets (Click to filter)`}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-sans font-medium transition cursor-pointer select-none active:scale-95 border ${
                                isTopicSelected
                                  ? 'bg-slate-200/90 text-slate-900 border-slate-400 shadow-xs font-semibold'
                                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <span className="break-words text-left leading-tight">{topic.label}</span>
                              <span 
                                className={`font-mono text-[10px] px-1 py-0.1 rounded shrink-0 ${
                                  isTopicSelected
                                    ? 'bg-slate-300/80 text-slate-800 font-semibold'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                ({count})
                              </span>
                            </button>
                          );
                        })}

                        {/* If exceeds 20 subtopics, show the "+more" button per user instructions */}
                        {hasMoreTopics && (
                          <button
                            type="button"
                            id={`more-subtopics-btn-${cluster.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onNavigateToCategoryPage) {
                                onNavigateToCategoryPage(cluster);
                              }
                            }}
                            title={`View all ${sortedTopics.length} sub-topics on dedicated ${cluster.name} page`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-sans font-semibold transition cursor-pointer select-none bg-slate-100 hover:bg-slate-200 text-slate-800 shadow-2xs border border-slate-300 active:scale-95"
                          >
                            <span>+{remainingCount} more</span>
                            <ArrowRight className="w-3 h-3 text-slate-600" />
                          </button>
                        )}
                      </div>

                      {/* Explicit more link for dedicated category page navigation */}
                      {hasMoreTopics && (
                        <div className="mt-2.5 pt-2 border-t border-[#EAE6DD]/70 flex items-center justify-between text-[11px]">
                          <span className="text-stone-500 font-sans text-[10.5px]">
                            Showing top 20 of {sortedTopics.length} sub-topics
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onNavigateToCategoryPage) {
                                onNavigateToCategoryPage(cluster);
                              }
                            }}
                            className="text-stone-900 hover:text-black font-semibold underline flex items-center gap-1 cursor-pointer text-[10.5px]"
                          >
                            <span>Open Category Page</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })
        )}
      </div>

      {/* Sidebar Footer */}
      <div className="p-3 border-t border-[#EAE5DA] bg-[#F7F4EC]/80 flex items-center justify-between text-xs text-stone-600">
        <div className="flex items-center gap-1 text-[11px]">
          <Sparkles className="w-3 h-3 text-stone-500" />
          <span>Click cluster or topic to filter</span>
        </div>
        {hasActiveFilter ? (
          <button
            type="button"
            onClick={handleClearAllFilters}
            className="text-[11px] text-stone-800 hover:text-black font-semibold underline cursor-pointer flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Clear filter</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleClose}
            className="text-[11px] text-stone-600 hover:text-stone-900 font-medium underline cursor-pointer"
          >
            Hide sidebar
          </button>
        )}
      </div>
    </div>
  </aside>
);
};

export const TopicsSidebar = React.memo(TopicsSidebarComponent);
