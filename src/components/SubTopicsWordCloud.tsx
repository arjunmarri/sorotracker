import React, { useState, useMemo } from 'react';
import { X, Tag, Sparkles, Search } from 'lucide-react';
import { SubTopic, TopicCluster } from '../types';

interface SubTopicsWordCloudProps {
  allSubTopics: SubTopic[];
  selectedSubTopic: SubTopic | null;
  onSelectSubTopic: (subTopic: SubTopic | null) => void;
  topicClusters?: TopicCluster[];
  selectedTopic?: string | null;
  onSelectTopic?: (topic: string | null) => void;
  className?: string;
  compact?: boolean;
  onClose?: () => void;
}

export const SubTopicsWordCloud: React.FC<SubTopicsWordCloudProps> = ({
  allSubTopics,
  selectedSubTopic,
  onSelectSubTopic,
  className = '',
  compact = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Handle clicking a topic
  const handleTopicClick = (st: SubTopic) => {
    if (selectedSubTopic?.id === st.id) {
      onSelectSubTopic(null);
    } else {
      onSelectSubTopic(st);
    }
  };

  // Filter topics by search query if provided
  const displayedTopics = useMemo(() => {
    if (!searchQuery.trim()) return allSubTopics;
    const q = searchQuery.toLowerCase();
    return allSubTopics.filter(st => 
      st.label.toLowerCase().includes(q) || 
      st.keywords?.some(k => k.toLowerCase().includes(q))
    );
  }, [allSubTopics, searchQuery]);

  return (
    <div className={`bg-white border border-slate-200 rounded-xl p-4 shadow-2xs ${className}`}>
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 mb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700">
            <Tag className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-sans font-bold text-slate-900 tracking-tight">
                Topics
              </h3>
              <span className="text-[11px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                {displayedTopics.length} {displayedTopics.length === 1 ? 'topic' : 'topics'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-sans mt-0.5">
              Click any topic to filter timeline snippets.
            </p>
          </div>
        </div>

        {/* Controls: Search and Active Filter */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* Quick topic search if there are multiple topics */}
          {allSubTopics.length > 6 && (
            <div className="relative">
              <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter topics..."
                className="pl-6 pr-6 py-0.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-hidden focus:border-slate-400 text-slate-800 placeholder-slate-400 w-32 sm:w-36 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {selectedSubTopic && (
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-200/90 text-slate-800 border border-slate-300 text-[11px] font-medium font-sans shadow-2xs">
                <span>Active: {selectedSubTopic.label} ({selectedSubTopic.count ?? 0})</span>
                <button
                  type="button"
                  onClick={() => onSelectSubTopic(null)}
                  className="hover:text-slate-900 cursor-pointer"
                  title="Clear Topic Filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
              <button
                type="button"
                onClick={() => onSelectSubTopic(null)}
                className="text-[11px] text-slate-600 hover:text-slate-900 underline font-medium cursor-pointer"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Topics Word Cloud */}
      {/* Consistent font size (text-xs) & font family (font-sans) */}
      <div className="flex flex-wrap gap-2 items-center">
        {displayedTopics.length > 0 ? (
          displayedTopics.map(st => {
            const isSelected = selectedSubTopic?.id === st.id;
            const count = st.count ?? 0;

            return (
              <button
                key={st.id}
                type="button"
                onClick={() => handleTopicClick(st)}
                title={`${st.label}: ${count} matching snippets (Click to filter)`}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-sans font-medium transition cursor-pointer select-none active:scale-95 ${
                  isSelected
                    ? 'bg-slate-200/90 text-slate-900 border-slate-400 shadow-2xs font-semibold'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-300 shadow-2xs'
                }`}
              >
                <span className="truncate">{st.label}</span>
                {/* Count displayed within the label */}
                <span 
                  className={`font-mono text-[11px] px-1.5 py-0.2 rounded transition ${
                    isSelected 
                      ? 'bg-slate-300/80 text-slate-800 font-semibold' 
                      : 'bg-slate-100 text-slate-600 font-normal'
                  }`}
                >
                  ({count})
                </span>
              </button>
            );
          })
        ) : (
          <div className="py-4 text-center w-full">
            <p className="text-xs text-slate-500 font-sans italic">
              No topics match "{searchQuery}".
            </p>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="mt-1 text-xs text-slate-800 font-semibold underline cursor-pointer"
            >
              Reset search
            </button>
          </div>
        )}
      </div>

      {/* Bottom Hint */}
      {displayedTopics.length > 0 && !compact && (
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5 font-sans">
            <Sparkles className="w-3 h-3 text-slate-400" />
            <span>Click any topic to automatically show matching snippets in the timeline.</span>
          </span>
          {selectedSubTopic && (
            <button
              type="button"
              onClick={() => onSelectSubTopic(null)}
              className="text-slate-700 hover:text-slate-900 font-medium underline cursor-pointer"
            >
              Clear topic filter
            </button>
          )}
        </div>
      )}
    </div>
  );
};
