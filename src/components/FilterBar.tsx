import React from 'react';
import { 
  Search, 
  Filter, 
  Link as LinkIcon, 
  Image as ImageIcon, 
  ArrowUpDown, 
  X, 
  LayoutGrid, 
  List, 
  Compass
} from 'lucide-react';

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedDomain?: string;
  onDomainChange?: (d: string) => void;
  selectedAuthor: string;
  onAuthorChange: (a: string) => void;
  selectedTopic?: string | null;
  onClearTopic?: () => void;
  hasLinksOnly: boolean;
  onToggleHasLinks: () => void;
  hasMediaOnly: boolean;
  onToggleHasMedia: () => void;
  sortBy: 'latest_date' | 'oldest_date' | 'newest' | 'oldest' | 'likes' | 'retweets';
  onSortChange: (sort: 'latest_date' | 'oldest_date' | 'newest' | 'oldest' | 'likes' | 'retweets') => void;
  viewMode: 'cards' | 'compact' | 'links';
  onViewModeChange: (mode: 'cards' | 'compact' | 'links') => void;
  availableDomains?: Array<[string, number]>;
  availableAuthors: Array<[string, number]>;
  totalCount: number;
  filteredCount: number;
  onClearFilters: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchQuery,
  onSearchChange,
  selectedAuthor,
  onAuthorChange,
  selectedTopic,
  onClearTopic,
  hasLinksOnly,
  onToggleHasLinks,
  hasMediaOnly,
  onToggleHasMedia,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
  availableAuthors,
  totalCount,
  filteredCount,
  onClearFilters
}) => {
  const hasActiveFilters = searchQuery || selectedAuthor || selectedTopic || hasLinksOnly || hasMediaOnly;

  return (
    <div id="filter-bar" className="bg-white border border-[#E5E2DA] rounded-xl p-3.5 mb-6 space-y-3 shadow-xs">
      {/* Top row: Search input & View toggles */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Field */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search tweet text, authors (@handle), or link keywords..."
            className="w-full bg-[#FAF9F6] border border-[#DDD7CC] rounded-lg pl-9 pr-8 py-2 text-xs text-[#1A1A1A] placeholder-stone-400 focus:outline-none focus:border-stone-800 transition"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center self-end sm:self-auto bg-[#F4F1EA] border border-[#E0DBD0] p-0.5 rounded-lg">
          <button
            onClick={() => onViewModeChange('cards')}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
              viewMode === 'cards'
                ? 'bg-[#1A1A1A] text-[#FDFCFB] shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
            title="Grid Cards View"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Cards</span>
          </button>

          <button
            onClick={() => onViewModeChange('compact')}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
              viewMode === 'compact'
                ? 'bg-[#1A1A1A] text-[#FDFCFB] shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
            title="Compact List View"
          >
            <List className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Compact</span>
          </button>

          <button
            onClick={() => onViewModeChange('links')}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
              viewMode === 'links'
                ? 'bg-[#1A1A1A] text-[#FDFCFB] shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
            title="Extracted Links Directory View"
          >
            <Compass className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Links Radar</span>
          </button>
        </div>
      </div>

      {/* Bottom row: Filter chips, Domain & Author selects, Sorting */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#EAE6DD] text-xs">
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Quick Filter: Has Links */}
          <button
            onClick={onToggleHasLinks}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition cursor-pointer ${
              hasLinksOnly
                ? 'bg-[#1A1A1A] border-[#1A1A1A] text-[#FDFCFB] font-medium'
                : 'bg-[#FAF9F6] border-[#DDD7CC] text-stone-700 hover:border-stone-400'
            }`}
          >
            <LinkIcon className="w-3 h-3" />
            <span>Has Links</span>
          </button>

          {/* Quick Filter: Has Media */}
          <button
            id="filter-has-media"
            onClick={onToggleHasMedia}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition cursor-pointer ${
              hasMediaOnly
                ? 'bg-[#1A1A1A] border-[#1A1A1A] text-[#FDFCFB] font-medium'
                : 'bg-[#FAF9F6] border-[#DDD7CC] text-stone-700 hover:border-stone-400'
            }`}
          >
            <ImageIcon className="w-3 h-3" />
            <span>Has Images</span>
          </button>

          {/* Author Filter Dropdown */}
          <div className="relative">
            <select
              value={selectedAuthor}
              onChange={(e) => onAuthorChange(e.target.value)}
              className="bg-[#FAF9F6] border border-[#DDD7CC] rounded-lg px-2.5 py-1 text-xs text-stone-800 focus:outline-none focus:border-stone-800 cursor-pointer appearance-none pr-6 font-mono text-[11px]"
            >
              <option value="">All Authors</option>
              {availableAuthors.map(([handle, count]) => (
                <option key={handle} value={handle}>
                  {handle} ({count})
                </option>
              ))}
            </select>
            <Filter className="w-3 h-3 text-stone-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Active Topic Filter Badge */}
          {selectedTopic && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1A1A1A] text-[#FDFCFB] text-xs font-medium">
              <span>Topic: {selectedTopic}</span>
              {onClearTopic && (
                <button
                  onClick={onClearTopic}
                  className="hover:text-stone-300 cursor-pointer"
                  title="Clear Topic Filter"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          )}

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              className="text-xs text-rose-700 hover:text-rose-900 font-medium ml-1 cursor-pointer flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        {/* Right side: Sort control & count */}
        <div className="flex items-center gap-3">
          <span className="text-stone-500">
            Showing <strong className="text-stone-900 font-mono">{filteredCount}</strong> of <span className="font-mono">{totalCount}</span>
          </span>

          <div className="flex items-center gap-1 text-stone-500">
            <ArrowUpDown className="w-3 h-3 text-stone-400" />
            <select
              id="sort-by-select"
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as any)}
              className="bg-[#FAF9F6] border border-[#DDD7CC] rounded-lg px-2 py-1 text-xs text-stone-800 focus:outline-none focus:border-stone-800 cursor-pointer"
            >
              <option value="latest_date">Latest by Date</option>
              <option value="oldest_date">Oldest by Date</option>
              <option value="newest">Newest Scanned</option>
              <option value="oldest">Oldest Scanned</option>
              <option value="likes">Most Likes</option>
              <option value="retweets">Most Reposts</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
