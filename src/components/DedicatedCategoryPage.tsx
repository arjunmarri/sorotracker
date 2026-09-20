import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  Tag, 
  Layers, 
  Search, 
  X, 
  Filter, 
  RotateCcw, 
  CheckCircle2, 
  Grid, 
  List, 
  Info, 
  ChevronDown, 
  ChevronUp, 
  ArrowUpDown,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { XHistoryRecord, SubTopic, TopicClusterGroup, ContentFilterCategory, ReaderFontSize } from '../types';
import { recordMatchesCluster } from '../lib/topicClustering';
import { recordMatchesSubTopic } from '../lib/subtopics';
import { RecordCard } from './RecordCard';

interface DedicatedCategoryPageProps {
  category: TopicClusterGroup;
  allCategories: TopicClusterGroup[];
  onSelectCategory: (category: TopicClusterGroup) => void;
  onBackToTimeline: () => void;
  records: XHistoryRecord[];
  onDeleteRecord: (id: string) => void;
  onSelectAuthor: (author: string) => void;
  onSelectCategoryFilter?: (cat: ContentFilterCategory) => void;
  readSnippetIds: string[];
  onToggleRead: (id: string) => void;
  initialSubTopic?: SubTopic | null;
  fontSize?: ReaderFontSize;
}

export const DedicatedCategoryPage: React.FC<DedicatedCategoryPageProps> = ({
  category,
  allCategories,
  onSelectCategory,
  onBackToTimeline,
  records,
  onDeleteRecord,
  onSelectAuthor,
  onSelectCategoryFilter,
  readSnippetIds,
  onToggleRead,
  initialSubTopic = null,
  fontSize = 'md'
}) => {
  // Subtopic filter state
  const [selectedSubTopic, setSelectedSubTopic] = useState<SubTopic | null>(initialSubTopic);
  const [subTopicSearch, setSubTopicSearch] = useState('');
  const [subTopicSortOrder, setSubTopicSortOrder] = useState<'count' | 'alpha'>('count');
  const [isCategoryInfoOpen, setIsCategoryInfoOpen] = useState(false);

  // Content search & view state
  const [recordsSearch, setRecordsSearch] = useState('');
  const [sortBy, setSortBy] = useState<'latest_date' | 'oldest_date' | 'latest_synced' | 'oldest_synced' | 'likes' | 'retweets'>('latest_date');
  const [viewMode, setViewMode] = useState<'cards' | 'compact'>('cards');
  const [snippetFeedTab, setSnippetFeedTab] = useState<'active' | 'caught_up'>('active');

  // Reset selected subtopic when category changes unless specified
  useEffect(() => {
    setSelectedSubTopic(initialSubTopic);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [category.id, initialSubTopic]);

  // 1. All records that belong to this category
  const categoryRecords = useMemo(() => {
    return records.filter(r => recordMatchesCluster(r, category));
  }, [records, category]);

  // 2. Sorted and filtered subtopics for the top filter section
  const processedSubTopics = useMemo(() => {
    const list = [...(category.topics || [])];

    // Filter by search query in top filter section
    let filtered = list;
    if (subTopicSearch.trim()) {
      const q = subTopicSearch.toLowerCase();
      filtered = list.filter(st => 
        st.label.toLowerCase().includes(q) || 
        (st.keywords || []).some(k => k.toLowerCase().includes(q))
      );
    }

    // Sort by count (descending) or alphabetically
    filtered.sort((a, b) => {
      if (subTopicSortOrder === 'alpha') {
        return a.label.localeCompare(b.label);
      }
      return (b.count ?? 0) - (a.count ?? 0);
    });

    return filtered;
  }, [category.topics, subTopicSearch, subTopicSortOrder]);

  // 3. Filter category records by selected subtopic and search query
  const filteredCategoryRecords = useMemo(() => {
    let result = categoryRecords;

    // Filter by selected subtopic
    if (selectedSubTopic) {
      result = result.filter(r => recordMatchesSubTopic(r, selectedSubTopic));
    }

    // Filter by text search
    if (recordsSearch.trim()) {
      const q = recordsSearch.toLowerCase();
      result = result.filter(r => 
        (r.text && r.text.toLowerCase().includes(q)) ||
        (r.authorHandle && r.authorHandle.toLowerCase().includes(q)) ||
        (r.authorName && r.authorName.toLowerCase().includes(q)) ||
        (r.urlMetadata?.title && r.urlMetadata.title.toLowerCase().includes(q))
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      if (sortBy === 'latest_synced') {
        const timeB = new Date(b.syncedAt || b.createdAt || 0).getTime();
        const timeA = new Date(a.syncedAt || a.createdAt || 0).getTime();
        return timeB - timeA;
      }
      if (sortBy === 'oldest_synced') {
        const timeA = new Date(a.syncedAt || a.createdAt || 0).getTime();
        const timeB = new Date(b.syncedAt || b.createdAt || 0).getTime();
        return timeA - timeB;
      }
      if (sortBy === 'oldest_date') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sortBy === 'newest') {
        const timeB = new Date(b.scannedAt || b.createdAt || 0).getTime();
        const timeA = new Date(a.scannedAt || a.createdAt || 0).getTime();
        return timeB - timeA;
      }
      if (sortBy === 'oldest') {
        const timeA = new Date(a.scannedAt || a.createdAt || 0).getTime();
        const timeB = new Date(b.scannedAt || b.createdAt || 0).getTime();
        return timeA - timeB;
      }
      if (sortBy === 'likes') {
        return (b.likeCount || 0) - (a.likeCount || 0);
      }
      if (sortBy === 'retweets') {
        return (b.retweetCount || 0) - (a.retweetCount || 0);
      }
      // default: latest_date
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return result;
  }, [categoryRecords, selectedSubTopic, recordsSearch, sortBy]);

  const readSnippetSet = useMemo(() => new Set(readSnippetIds), [readSnippetIds]);

  // Split into active and caught up
  const activeRecords = useMemo(() => {
    return filteredCategoryRecords.filter(r => !readSnippetSet.has(r.id));
  }, [filteredCategoryRecords, readSnippetSet]);

  const caughtUpRecords = useMemo(() => {
    return filteredCategoryRecords.filter(r => readSnippetSet.has(r.id));
  }, [filteredCategoryRecords, readSnippetSet]);

  const displayedRecords = useMemo(() => {
    return snippetFeedTab === 'active' ? activeRecords : caughtUpRecords;
  }, [snippetFeedTab, activeRecords, caughtUpRecords]);

  // Pagination / Infinite scrolling (load 25 latest by default, rest on scroll)
  const [visibleCount, setVisibleCount] = useState<number>(25);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisibleCount(25);
  }, [category.id, selectedSubTopic, recordsSearch, sortBy, snippetFeedTab]);

  const visibleRecords = useMemo(() => {
    return displayedRecords.slice(0, visibleCount);
  }, [displayedRecords, visibleCount]);

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && visibleCount < displayedRecords.length) {
          setTimeout(() => {
            setVisibleCount(prev => Math.min(prev + 25, displayedRecords.length));
          }, 100);
        }
      },
      { rootMargin: '300px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [visibleCount, displayedRecords.length]);

  const handleSubTopicClick = (topic: SubTopic) => {
    if (selectedSubTopic?.id === topic.id) {
      setSelectedSubTopic(null);
    } else {
      setSelectedSubTopic(topic);
    }
  };

  const handleClearAllFilters = () => {
    setSelectedSubTopic(null);
    setRecordsSearch('');
  };

  return (
    <div id="dedicated-category-page" className="w-full max-w-7xl mx-auto space-y-6 animate-fadeIn pb-16">
      
      {/* Navigation & Breadcrumbs Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#EAE6DD]">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            id="back-to-timeline-btn"
            onClick={onBackToTimeline}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-stone-800 bg-white hover:bg-stone-100 border border-[#DDD7CC] shadow-2xs hover:border-stone-400 transition cursor-pointer active:scale-95"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-stone-600" />
            <span>Back to Timeline</span>
          </button>

          <span className="text-stone-300">/</span>

          <span className="text-xs text-stone-500 font-sans">Categories</span>

          <span className="text-stone-300">/</span>

          <div className="flex items-center gap-1.5">
            {category.number && (
              <span className="font-mono text-[11px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                {category.number}
              </span>
            )}
            <span className="text-xs font-sans font-bold text-slate-900 truncate max-w-[240px] sm:max-w-none">
              {category.name}
            </span>
          </div>
        </div>

        {/* Category Switcher Dropdown */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-slate-500 font-sans hidden md:inline">Switch Category:</span>
          <select
            id="category-page-switcher"
            value={category.id}
            onChange={(e) => {
              const target = allCategories.find(c => c.id === e.target.value);
              if (target) onSelectCategory(target);
            }}
            className="text-xs py-1.5 px-2.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:border-slate-600 cursor-pointer font-medium max-w-[280px]"
          >
            {allCategories.map(cat => (
              <option key={cat.id} value={cat.id}>
                {cat.number ? `${cat.number}. ` : ''}{cat.name} ({cat.totalSnippets})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Category Hero Header Banner */}
      <div 
        id="category-hero-card"
        className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 shadow-xs relative overflow-hidden"
      >
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2 max-w-3xl">
            <div className="flex items-center gap-2 flex-wrap">
              {category.number && (
                <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs">
                  Category #{category.number}
                </span>
              )}
              {category.isOthers && (
                <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200">
                  Universal Absorption
                </span>
              )}
              <span className="font-mono text-xs text-slate-600 bg-slate-50 px-2.5 py-0.5 rounded-md border border-slate-200">
                {categoryRecords.length} total snippets
              </span>
              <span className="font-mono text-xs text-slate-600 bg-slate-50 px-2.5 py-0.5 rounded-md border border-slate-200">
                {category.topics.length} sub-topics
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-sans font-bold text-slate-900 tracking-tight leading-snug">
              {category.name}
            </h1>

            {category.description && (
              <p className="text-sm text-slate-600 leading-relaxed font-sans">
                {category.description}
              </p>
            )}
          </div>

          {/* Definition & Classification Signal Toggle */}
          {(category.definition || category.classificationSignals || category.disambiguation) && (
            <div className="shrink-0">
              <button
                type="button"
                id="toggle-category-info-btn"
                onClick={() => setIsCategoryInfoOpen(prev => !prev)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer border ${
                  isCategoryInfoOpen
                    ? 'bg-amber-100 text-amber-950 border-amber-300'
                    : 'bg-white hover:bg-stone-50 text-stone-700 border-[#DDD7CC]'
                }`}
              >
                <Info className="w-3.5 h-3.5 text-amber-700" />
                <span>{isCategoryInfoOpen ? 'Hide Guide' : 'Classification Guide'}</span>
                {isCategoryInfoOpen ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          )}
        </div>

        {/* Collapsible Classification Guide Box */}
        {isCategoryInfoOpen && (
          <div className="mt-4 pt-4 border-t border-[#EAE5DA] grid grid-cols-1 md:grid-cols-3 gap-4 text-xs bg-amber-50/60 p-4 rounded-xl border border-amber-200/80 leading-relaxed">
            {category.definition && (
              <div>
                <h4 className="font-serif font-bold text-amber-950 text-xs mb-1">Definition</h4>
                <p className="text-stone-700">{category.definition}</p>
              </div>
            )}
            {category.classificationSignals && (
              <div>
                <h4 className="font-serif font-bold text-amber-950 text-xs mb-1">Classification Signals</h4>
                <p className="text-stone-700">{category.classificationSignals}</p>
              </div>
            )}
            {category.disambiguation && (
              <div>
                <h4 className="font-serif font-bold text-amber-950 text-xs mb-1">Disambiguation</h4>
                <p className="text-stone-700">{category.disambiguation}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* TOP SECTION: All Sub-topics as Filters (Mandated User Requirement) */}
      <section 
        id="category-subtopics-filter-section"
        className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E5E1D7] shadow-xs space-y-3.5"
      >
        {/* Sub-topics Filter Bar Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#EAE6DD]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-stone-100 text-stone-800">
              <Tag className="w-4 h-4 text-stone-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-serif font-bold text-stone-900">
                  Sub-topic Filters
                </h2>
                <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-[#EFECE5] text-stone-700 border border-[#DDD7CB]">
                  {category.topics.length} total
                </span>
              </div>
              <p className="text-[11px] text-stone-500 font-sans">
                Click any sub-topic below to instantly filter snippets within this category
              </p>
            </div>
          </div>

          {/* Sub-topic Search & Sort Controls */}
          <div className="flex items-center gap-2">
            {/* Search Subtopics */}
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
              <input
                type="text"
                value={subTopicSearch}
                onChange={(e) => setSubTopicSearch(e.target.value)}
                placeholder="Search sub-topics..."
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-[#FAF9F6] border border-[#DDD7CC] rounded-lg focus:outline-hidden focus:border-stone-600 text-stone-800 placeholder-stone-400 transition"
              />
              {subTopicSearch && (
                <button
                  type="button"
                  onClick={() => setSubTopicSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Sort Subtopics */}
            <button
              type="button"
              id="toggle-subtopic-sort-btn"
              onClick={() => setSubTopicSortOrder(prev => prev === 'count' ? 'alpha' : 'count')}
              title={`Sorting by ${subTopicSortOrder === 'count' ? 'Count (Descending)' : 'Alphabetical (A-Z)'}`}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-stone-50 border border-[#DDD7CC] text-stone-700 transition cursor-pointer shrink-0"
            >
              <ArrowUpDown className="w-3 h-3 text-stone-500" />
              <span className="hidden sm:inline">{subTopicSortOrder === 'count' ? 'By Count' : 'A-Z'}</span>
            </button>
          </div>
        </div>

        {/* Active Filter Strip (when a subtopic is selected) */}
        {selectedSubTopic && (
          <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-300 text-slate-800 flex items-center justify-between gap-3 text-xs animate-fadeIn shadow-2xs">
            <div className="flex items-center gap-2 min-w-0">
              <Filter className="w-3.5 h-3.5 text-slate-700 shrink-0" />
              <span className="truncate">
                Active Sub-topic: <strong className="font-semibold text-slate-900">{selectedSubTopic.label}</strong>
              </span>
              <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-slate-200/90 text-slate-800 font-semibold shrink-0">
                {activeRecords.length + caughtUpRecords.length} snippets
              </span>
            </div>
            <button
              type="button"
              id="clear-active-subtopic-btn"
              onClick={() => setSelectedSubTopic(null)}
              className="inline-flex items-center gap-1 text-xs font-mono text-slate-600 hover:text-slate-900 underline cursor-pointer shrink-0"
            >
              <X className="w-3 h-3" />
              <span>Show All Sub-topics</span>
            </button>
          </div>
        )}

        {/* Sub-topic Filter Pills Container: Displays ALL Subtopics */}
        <div className="flex flex-wrap gap-2 max-h-72 overflow-y-auto pr-1 py-1">
          {/* "All Sub-topics" Default Pill */}
          <button
            type="button"
            id="subtopic-filter-all"
            onClick={() => setSelectedSubTopic(null)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer select-none border ${
              selectedSubTopic === null
                ? 'bg-slate-200/90 text-slate-800 border-slate-300 shadow-2xs font-semibold'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-300'
            }`}
          >
            <span>All Sub-topics</span>
            <span 
              className={`font-mono text-[10px] px-1.5 py-0.2 rounded shrink-0 ${
                selectedSubTopic === null ? 'bg-slate-300/80 text-slate-800 font-semibold' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {categoryRecords.length}
            </span>
          </button>

          {/* Render Every Subtopic in Category as an Interactive Filter */}
          {processedSubTopics.map((subTopic) => {
            const isSelected = selectedSubTopic?.id === subTopic.id;
            const count = subTopic.count ?? 0;

            return (
              <button
                key={subTopic.id}
                id={`subtopic-filter-${subTopic.id}`}
                type="button"
                onClick={() => handleSubTopicClick(subTopic)}
                title={`${subTopic.label} (${count} snippets) - Click to filter`}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer select-none active:scale-95 border ${
                  isSelected
                    ? 'bg-slate-200/90 text-slate-800 border-slate-300 shadow-2xs font-semibold'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-300'
                }`}
              >
                <span>{subTopic.label}</span>
                <span 
                  className={`font-mono text-[10px] px-1.5 py-0.2 rounded shrink-0 ${
                    isSelected ? 'bg-slate-300/80 text-slate-800 font-semibold' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}

          {processedSubTopics.length === 0 && (
            <div className="py-3 px-4 text-xs text-stone-500 italic">
              No sub-topics match "{subTopicSearch}".
              <button
                type="button"
                onClick={() => setSubTopicSearch('')}
                className="ml-2 text-stone-800 underline font-semibold cursor-pointer"
              >
                Reset search
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Snippets Feed Controls & Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        {/* Left: Active vs Caught Up Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            id="cat-feed-active-tab"
            onClick={() => setSnippetFeedTab('active')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 border ${
              snippetFeedTab === 'active'
                ? 'bg-slate-200/90 text-slate-800 border-slate-300 font-semibold shadow-2xs'
                : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
            <span>Active Snippets</span>
            <span className="font-mono text-[11px] opacity-80">({activeRecords.length})</span>
          </button>

          <button
            type="button"
            id="cat-feed-caught-up-tab"
            onClick={() => setSnippetFeedTab('caught_up')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 border ${
              snippetFeedTab === 'caught_up'
                ? 'bg-emerald-100/90 text-emerald-900 border-emerald-300 font-semibold shadow-2xs'
                : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Caught up</span>
            <span className="font-mono text-[11px] opacity-80">({caughtUpRecords.length})</span>
          </button>

          <span className="text-xs text-stone-500 font-sans hidden sm:inline ml-1">
            Showing <strong>{displayedRecords.length}</strong> of {filteredCategoryRecords.length} snippets
          </span>
        </div>

        {/* Right: Search within category & Sort/View Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search within category records */}
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
            <input
              type="text"
              value={recordsSearch}
              onChange={(e) => setRecordsSearch(e.target.value)}
              placeholder="Search in this category..."
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-[#DDD7CC] rounded-lg focus:outline-hidden focus:border-stone-600 text-stone-800 placeholder-stone-400 transition"
            />
            {recordsSearch && (
              <button
                type="button"
                onClick={() => setRecordsSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Sort By Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="text-xs py-1.5 px-2.5 bg-white border border-[#DDD7CC] rounded-lg text-stone-800 focus:outline-hidden focus:border-stone-600 cursor-pointer font-medium"
          >
            <option value="latest_date">Latest Date</option>
            <option value="oldest_date">Oldest Date</option>
            <option value="latest_synced">Recently Synced</option>
            <option value="oldest_synced">Earliest Synced</option>
            <option value="newest">Newest Scanned</option>
            <option value="oldest">Oldest Scanned</option>
            <option value="likes">Most Likes</option>
            <option value="retweets">Most Retweets</option>
          </select>

          {/* View Mode Toggle: Grid vs Compact */}
          <div className="flex items-center bg-slate-100/90 border border-slate-200 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              title="Card grid view"
              className={`p-1.5 rounded-md transition cursor-pointer ${
                viewMode === 'cards' ? 'bg-white text-slate-900 font-semibold shadow-2xs border border-slate-300/80' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('compact')}
              title="Compact list view"
              className={`p-1.5 rounded-md transition cursor-pointer ${
                viewMode === 'compact' ? 'bg-white text-slate-900 font-semibold shadow-2xs border border-slate-300/80' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Snippets Feed Grid / List */}
      {displayedRecords.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-[#EAE5DA] p-8 space-y-3">
          <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mx-auto text-stone-400">
            <Filter className="w-5 h-5" />
          </div>
          <h3 className="text-base font-serif font-bold text-stone-800">
            No snippets found
          </h3>
          <p className="text-xs text-stone-500 max-w-md mx-auto">
            {selectedSubTopic 
              ? `No ${snippetFeedTab === 'active' ? 'active' : 'caught-up'} snippets match sub-topic "${selectedSubTopic.label}".`
              : `No snippets match your current search criteria in this category.`}
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            {selectedSubTopic && (
              <button
                type="button"
                onClick={() => setSelectedSubTopic(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-stone-900 text-white hover:bg-black transition cursor-pointer"
              >
                Clear sub-topic filter
              </button>
            )}
            {recordsSearch && (
              <button
                type="button"
                onClick={() => setRecordsSearch('')}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white hover:bg-stone-100 text-stone-700 border border-[#DDD7CC] transition cursor-pointer"
              >
                Reset search
              </button>
            )}
          </div>
        </div>
      ) : viewMode === 'compact' ? (
        <div className="space-y-2">
          {visibleRecords.map(record => (
            <RecordCard
              key={record.id}
              record={record}
              onDelete={onDeleteRecord}
              onSelectAuthor={onSelectAuthor}
              onSelectCategory={onSelectCategoryFilter}
              compact={true}
              fontSize={fontSize}
              isRead={readSnippetSet.has(record.id)}
              onToggleRead={onToggleRead}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleRecords.map(record => (
            <RecordCard
              key={record.id}
              record={record}
              onDelete={onDeleteRecord}
              onSelectAuthor={onSelectAuthor}
              onSelectCategory={onSelectCategoryFilter}
              compact={false}
              fontSize={fontSize}
              isRead={readSnippetSet.has(record.id)}
              onToggleRead={onToggleRead}
            />
          ))}
        </div>
      )}

      {/* Infinite Scroll Sentinel */}
      {displayedRecords.length > 0 && (
        visibleCount < displayedRecords.length ? (
          <div ref={loadMoreSentinelRef} className="py-8 flex flex-col items-center justify-center gap-2">
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-xl bg-white border border-[#E5E2DA] shadow-2xs text-xs font-mono text-stone-600">
              <div className="w-3.5 h-3.5 border-2 border-stone-300 border-t-stone-800 rounded-full animate-spin" />
              <span>Loading more snippets ({visibleRecords.length} of {displayedRecords.length})...</span>
            </div>
          </div>
        ) : displayedRecords.length > 25 ? (
          <div className="py-6 text-center text-xs font-mono text-stone-500 border-t border-[#EAE6DD] mt-6">
            <span>All {displayedRecords.length} snippets loaded</span>
          </div>
        ) : null
      )}
    </div>
  );
};
