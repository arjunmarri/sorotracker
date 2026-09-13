import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Search, 
  X, 
  Sparkles,
  Inbox
} from 'lucide-react';
import { 
  XHistoryRecord, 
  ContentFilterCategory, 
  SubTopic, 
  ReaderFontSize,
  SortOption 
} from '../types';
import { TopicClusterGroup } from '../lib/topicClustering';
import { FilterBar } from './FilterBar';
import { RecordCard } from './RecordCard';

interface SearchPageProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onBackToTimeline: () => void;
  records: XHistoryRecord[];
  totalArchivedCount: number;
  matchingCount: number;
  selectedAuthor: string;
  onAuthorChange: (author: string) => void;
  availableAuthors: Array<[string, number]>;
  selectedCategory: ContentFilterCategory | null;
  onCategoryChange: (category: ContentFilterCategory | null) => void;
  categoryCounts?: Record<ContentFilterCategory, number>;
  selectedCluster?: TopicClusterGroup | null;
  onClearCluster?: () => void;
  selectedSubTopic?: SubTopic | null;
  onClearSubTopic?: () => void;
  hasLinksOnly: boolean;
  onToggleHasLinks: () => void;
  hasMediaOnly: boolean;
  onToggleHasMedia: () => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  viewMode: 'cards' | 'compact';
  onViewModeChange: (mode: 'cards' | 'compact') => void;
  fontSize: ReaderFontSize;
  onFontSizeChange: (size: ReaderFontSize) => void;
  onClearFilters: () => void;
  onDeleteRecord: (id: string) => void;
  onSelectAuthor: (handle: string) => void;
  onSelectCategory?: (category: ContentFilterCategory) => void;
  readSnippetSet: Set<string>;
  onToggleReadSnippet: (id: string) => void;
  isLoading?: boolean;
}

export const SearchPage: React.FC<SearchPageProps> = ({
  searchQuery,
  onSearchChange,
  onBackToTimeline,
  records,
  totalArchivedCount,
  matchingCount,
  selectedAuthor,
  onAuthorChange,
  availableAuthors,
  selectedCategory,
  onCategoryChange,
  categoryCounts,
  selectedCluster,
  onClearCluster,
  selectedSubTopic,
  onClearSubTopic,
  hasLinksOnly,
  onToggleHasLinks,
  hasMediaOnly,
  onToggleHasMedia,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
  fontSize,
  onFontSizeChange,
  onClearFilters,
  onDeleteRecord,
  onSelectAuthor,
  onSelectCategory,
  readSnippetSet,
  onToggleReadSnippet,
  isLoading = false
}) => {
  const [pageLimit, setPageLimit] = useState(30);

  const displayedRecords = records.slice(0, pageLimit);
  const hasMore = records.length > pageLimit;

  return (
    <div id="search-page-container" className="space-y-5 animate-fade-in w-full">
      {/* Top Search Page Navigation & Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            id="search-page-back-btn"
            onClick={onBackToTimeline}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 transition cursor-pointer flex items-center gap-1.5 text-xs font-semibold shrink-0"
            title="Return to Timeline"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Timeline</span>
          </button>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-sans font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Search className="w-4 h-4 text-slate-700" />
                <span>Search Results</span>
              </h1>
              {searchQuery && (
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
                  "{searchQuery}"
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 font-sans mt-0.5">
              Found <strong className="font-semibold text-slate-800">{matchingCount}</strong> matching {matchingCount === 1 ? 'record' : 'records'} across your archive
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            id="search-page-clear-search-btn"
            onClick={onBackToTimeline}
            className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
          >
            <X className="w-3.5 h-3.5" />
            <span>Clear Search</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Options Bar (Shown on the Search Page) */}
      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        selectedAuthor={selectedAuthor}
        onAuthorChange={onAuthorChange}
        selectedCluster={selectedCluster}
        onClearCluster={onClearCluster}
        selectedSubTopic={selectedSubTopic}
        onClearSubTopic={onClearSubTopic}
        selectedCategory={selectedCategory}
        onCategoryChange={onCategoryChange}
        categoryCounts={categoryCounts}
        hasLinksOnly={hasLinksOnly}
        onToggleHasLinks={onToggleHasLinks}
        hasMediaOnly={hasMediaOnly}
        onToggleHasMedia={onToggleHasMedia}
        sortBy={sortBy}
        onSortChange={onSortChange}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        fontSize={fontSize}
        onFontSizeChange={onFontSizeChange}
        availableAuthors={availableAuthors}
        totalCount={totalArchivedCount}
        filteredCount={matchingCount}
        onClearFilters={onClearFilters}
      />

      {/* Search Results List */}
      <div id="search-results-list" className="space-y-3">
        {displayedRecords.length > 0 ? (
          <>
            <div className={viewMode === 'compact' ? 'space-y-2' : 'grid grid-cols-1 md:grid-cols-2 gap-4'}>
              {displayedRecords.map(record => (
                <RecordCard
                  key={record.id}
                  record={record}
                  onDelete={onDeleteRecord}
                  onSelectAuthor={onSelectAuthor}
                  onSelectCategory={onSelectCategory}
                  viewMode={viewMode}
                  fontSize={fontSize}
                  isRead={readSnippetSet.has(record.id)}
                  onToggleRead={onToggleReadSnippet}
                />
              ))}
            </div>

            {/* Pagination / Load More */}
            {hasMore && (
              <div className="pt-6 pb-2 text-center">
                <button
                  type="button"
                  id="search-page-load-more-btn"
                  onClick={() => setPageLimit(prev => prev + 30)}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                  Load More Results ({records.length - pageLimit} remaining)
                </button>
              </div>
            )}
          </>
        ) : (
          /* Empty Search Results State */
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 text-slate-500 flex items-center justify-center mx-auto shadow-2xs">
              <Inbox className="w-6 h-6 text-slate-400" />
            </div>
            <h3 className="font-sans font-bold text-slate-900 text-base">
              No matching posts found
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              No posts matched your search for "{searchQuery}" with the currently applied filters. Try relaxing your filters or searching for different keywords or author handles.
            </p>
            <div className="pt-2 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={onClearFilters}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-xs font-semibold transition cursor-pointer"
              >
                Reset Filters
              </button>
              <button
                type="button"
                onClick={onBackToTimeline}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                Return to Timeline
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
