import React, { useEffect, useRef } from 'react';
import { 
  Search, 
  Filter, 
  Link as LinkIcon, 
  Image as ImageIcon, 
  ArrowUpDown, 
  X, 
  LayoutGrid, 
  List, 
  Tag,
  Layers,
  Type,
  Globe,
  SlidersHorizontal
} from 'lucide-react';
import { ContentFilterCategory, SubTopic, ReaderFontSize, SortOption, ContentFilterOption } from '../types';
import { TopicClusterGroup } from '../lib/topicClustering';
import { ALL_CATEGORY_OPTIONS } from '../lib/contentFilter';

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedDomain?: string;
  onDomainChange?: (d: string) => void;
  selectedAuthor: string;
  onAuthorChange: (a: string) => void;
  selectedCategory?: ContentFilterCategory | null;
  onCategoryChange?: (c: ContentFilterCategory | null) => void;
  selectedTopic?: string | null;
  onClearTopic?: () => void;
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
  fontSize?: ReaderFontSize;
  onFontSizeChange?: (size: ReaderFontSize) => void;
  availableDomains?: Array<[string, number]>;
  availableAuthors: Array<[string, number]>;
  categoryCounts?: Record<ContentFilterCategory, number>;
  categories?: ContentFilterOption[];
  totalCount: number;
  filteredCount: number;
  isFilterSectionOpen?: boolean;
  onToggleFilterSection?: () => void;
  activeContentFilterCount?: number;
  onClearFilters: () => void;
}

const FilterBarComponent: React.FC<FilterBarProps> = ({
  searchQuery,
  onSearchChange,
  selectedDomain = '',
  onDomainChange,
  availableDomains = [],
  selectedAuthor,
  onAuthorChange,
  selectedCategory,
  onCategoryChange,
  selectedTopic,
  onClearTopic,
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
  fontSize = 'md',
  onFontSizeChange,
  availableAuthors,
  categoryCounts,
  categories,
  totalCount,
  filteredCount,
  isFilterSectionOpen,
  onToggleFilterSection,
  activeContentFilterCount = 0,
  onClearFilters
}) => {
  const activeCategories = categories || ALL_CATEGORY_OPTIONS;
  const searchInputRef = useRef<HTMLInputElement>(null);
  const hasActiveFilters = searchQuery || selectedAuthor || selectedDomain || selectedCategory || selectedTopic || selectedCluster || selectedSubTopic || hasLinksOnly || hasMediaOnly;

  // Listen for '/' key to quickly focus the search bar (Linear / GitHub navigation pattern)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is already typing in an input, textarea, or contentEditable
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        if (e.key === 'Escape' && target === searchInputRef.current) {
          searchInputRef.current?.blur();
        }
        return;
      }

      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div id="filter-bar" className="bg-white border border-slate-200 rounded-2xl p-4 mb-5 space-y-3.5 shadow-xs">
      {/* Top row: Search input & Ergonomic View / Font controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Field */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search tweets, authors (@handle), or link keywords... (Press '/' to focus)"
            className="w-full bg-slate-50/80 border border-slate-200 rounded-xl pl-10 pr-16 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-800 transition"
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {searchQuery ? (
              <button
                onClick={() => onSearchChange('')}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-white border border-slate-200 rounded shadow-2xs">
                /
              </kbd>
            )}
          </div>
        </div>

        {/* Top row controls: View Mode & Reading Typography size */}
        <div className="flex items-center gap-2.5 self-end sm:self-auto flex-wrap">
          {/* Reader Font Size Selector */}
          {onFontSizeChange && (
            <div className="flex items-center bg-slate-100/90 border border-slate-200 p-0.5 rounded-xl text-xs" title="Adjust Reader Font Size">
              <span className="px-2 text-[10px] font-mono font-medium text-slate-500 uppercase tracking-wider hidden lg:inline">
                Size
              </span>
              <button
                type="button"
                onClick={() => onFontSizeChange('sm')}
                className={`px-2 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  fontSize === 'sm'
                    ? 'bg-white text-slate-950 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Small font (Compact scanning)"
              >
                A-
              </button>
              <button
                type="button"
                onClick={() => onFontSizeChange('md')}
                className={`px-2 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  fontSize === 'md'
                    ? 'bg-white text-slate-950 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Standard font (Optimal reading)"
              >
                A
              </button>
              <button
                type="button"
                onClick={() => onFontSizeChange('lg')}
                className={`px-2 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  fontSize === 'lg'
                    ? 'bg-white text-slate-950 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Large font (Relaxed focused reading)"
              >
                A+
              </button>
            </div>
          )}

          {/* View Mode Switcher */}
          <div className="flex items-center bg-slate-100/90 border border-slate-200 p-0.5 rounded-xl">
            <button
              onClick={() => onViewModeChange('cards')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white text-slate-900 font-semibold shadow-2xs border border-slate-300/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
              title="Grid Cards View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Cards</span>
            </button>

            <button
              onClick={() => onViewModeChange('compact')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                viewMode === 'compact'
                  ? 'bg-white text-slate-900 font-semibold shadow-2xs border border-slate-300/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
              title="Compact List View"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Compact</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom row: Filter chips, Domain & Author selects, Sorting */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-100 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Quick Filter: Has Links */}
          <button
            onClick={onToggleHasLinks}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition cursor-pointer ${
              hasLinksOnly
                ? 'bg-slate-200/90 border-slate-300 text-slate-800 font-semibold shadow-2xs'
                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <LinkIcon className="w-3 h-3 text-slate-700" />
            <span>Has Links</span>
          </button>

          {/* Quick Filter: Has Media */}
          <button
            id="filter-has-media"
            onClick={onToggleHasMedia}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition cursor-pointer ${
              hasMediaOnly
                ? 'bg-slate-200/90 border-slate-300 text-slate-800 font-semibold shadow-2xs'
                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <ImageIcon className="w-3 h-3 text-slate-700" />
            <span>Has Images</span>
          </button>

          {/* Quick Filter: Content Noise Filtering */}
          {onToggleFilterSection && (
            <button
              id="filter-noise-toggle-btn"
              type="button"
              onClick={onToggleFilterSection}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition cursor-pointer text-xs ${
                isFilterSectionOpen || (activeContentFilterCount > 0)
                  ? 'bg-slate-200/90 text-slate-900 border-slate-300 font-semibold shadow-2xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
              }`}
              title="Toggle content noise category rules (Memes, Pitches, Polemics)"
            >
              <SlidersHorizontal className="w-3 h-3 text-slate-700" />
              <span>Noise Filter</span>
              {activeContentFilterCount > 0 && (
                <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-amber-200 text-amber-900 font-bold">
                  {activeContentFilterCount}
                </span>
              )}
            </button>
          )}

          {/* Author Filter Dropdown */}
          <div className="relative">
            <select
              value={selectedAuthor}
              onChange={(e) => onAuthorChange(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:border-slate-800 cursor-pointer appearance-none pr-6 font-mono text-[11px]"
            >
              <option value="">All Authors</option>
              {availableAuthors.map(([handle, count]) => (
                <option key={handle} value={handle}>
                  {handle} ({count})
                </option>
              ))}
            </select>
            <Filter className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Domain Filter Dropdown */}
          {availableDomains && availableDomains.length > 0 && (
            <div className="relative">
              <select
                id="filter-domain-select"
                value={selectedDomain}
                onChange={(e) => onDomainChange && onDomainChange(e.target.value)}
                className={`border rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-slate-800 cursor-pointer appearance-none pr-6 font-mono text-[11px] transition ${
                  selectedDomain
                    ? 'bg-slate-200/90 text-slate-800 border-slate-300 font-semibold shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-800'
                }`}
              >
                <option value="">All Domains</option>
                {availableDomains.map(([domain, count]) => (
                  <option key={domain} value={domain}>
                    {domain} ({count})
                  </option>
                ))}
              </select>
              <Globe className={`w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${selectedDomain ? 'text-slate-700' : 'text-slate-400'}`} />
            </div>
          )}

          {/* Category / Label Filter Dropdown */}
          <div className="relative">
            <select
              value={selectedCategory || ''}
              onChange={(e) => onCategoryChange && onCategoryChange(e.target.value ? (e.target.value as ContentFilterCategory) : null)}
              className={`border rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-slate-800 cursor-pointer appearance-none pr-6 font-mono text-[11px] transition ${
                selectedCategory 
                  ? 'bg-slate-200/90 text-slate-800 border-slate-300 font-semibold shadow-2xs' 
                  : 'bg-white border-slate-200 text-slate-800'
              }`}
            >
              <option value="">All Labels</option>
              <optgroup label="High-Signal & Productive">
                {activeCategories.filter(o => o.type === 'high_signal').map((cat) => {
                  const count = categoryCounts ? categoryCounts[cat.id] : undefined;
                  return (
                    <option key={cat.id} value={cat.id}>
                      {cat.label} {count !== undefined ? `(${count})` : ''}
                    </option>
                  );
                })}
              </optgroup>
              <optgroup label="Noise / Casual">
                {activeCategories.filter(o => o.type === 'noise').map((cat) => {
                  const count = categoryCounts ? categoryCounts[cat.id] : undefined;
                  return (
                    <option key={cat.id} value={cat.id}>
                      {cat.label} {count !== undefined ? `(${count})` : ''}
                    </option>
                  );
                })}
              </optgroup>
            </select>
            <Tag className={`w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${selectedCategory ? 'text-slate-700' : 'text-slate-400'}`} />
          </div>

          {/* Active Category Badge */}
          {selectedCategory && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-300 text-xs font-semibold shadow-2xs">
              <span>Label: {activeCategories.find(c => c.id === selectedCategory)?.label || selectedCategory}</span>
              {onCategoryChange && (
                <button
                  onClick={() => onCategoryChange(null)}
                  className="hover:text-rose-600 text-slate-500 cursor-pointer"
                  title="Clear Category Filter"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          )}

          {/* Active Domain Badge */}
          {selectedDomain && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-300 text-xs font-semibold shadow-2xs">
              <Globe className="w-3 h-3 text-slate-600" />
              <span>Domain: {selectedDomain}</span>
              {onDomainChange && (
                <button
                  onClick={() => onDomainChange('')}
                  className="hover:text-rose-600 text-slate-500 cursor-pointer"
                  title="Clear Domain Filter"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          )}

          {/* Active Cluster Filter Badge */}
          {selectedCluster && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-300 text-xs font-semibold shadow-2xs">
              <Layers className="w-3 h-3 text-slate-600" />
              <span>Cluster: {selectedCluster.name} ({selectedCluster.totalSnippets})</span>
              {onClearCluster && (
                <button
                  onClick={onClearCluster}
                  className="hover:text-rose-600 text-slate-500 cursor-pointer"
                  title="Clear Cluster Filter"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          )}

          {/* Active Topic Filter Badge */}
          {selectedTopic && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-300 text-xs font-semibold shadow-2xs">
              <span>Topic: {selectedTopic}</span>
              {onClearTopic && (
                <button
                  onClick={onClearTopic}
                  className="hover:text-rose-600 text-slate-500 cursor-pointer"
                  title="Clear Topic Filter"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          )}

          {/* Active SubTopic Filter Badge */}
          {selectedSubTopic && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-300 text-xs font-semibold shadow-2xs">
              <span>Topic: {selectedSubTopic.label} ({selectedSubTopic.count ?? 0})</span>
              {onClearSubTopic && (
                <button
                  onClick={onClearSubTopic}
                  className="hover:text-rose-600 text-slate-500 cursor-pointer"
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
              className="text-xs text-rose-600 hover:text-rose-800 font-medium ml-1 cursor-pointer flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        {/* Right side: Sort control & count */}
        <div className="flex items-center gap-3">
          <span className="text-slate-500">
            Showing <strong className="text-slate-900 font-mono">{filteredCount}</strong> of <span className="font-mono">{totalCount}</span>
          </span>

          <div className="flex items-center gap-1 text-slate-500">
            <ArrowUpDown className="w-3 h-3 text-slate-400" />
            <select
              id="sort-by-select"
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as any)}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800 focus:outline-none focus:border-slate-800 cursor-pointer"
            >
              <option value="latest_date">Latest by Date</option>
              <option value="oldest_date">Oldest by Date</option>
              <option value="latest_synced">Recently Synced (Newest)</option>
              <option value="oldest_synced">Earliest Synced</option>
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

export const FilterBar = React.memo(FilterBarComponent);
