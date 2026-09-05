/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { SummarySection } from './components/SummarySection';
import { FilterBar } from './components/FilterBar';
import { RecordCard } from './components/RecordCard';
import { LinkDirectoryView } from './components/LinkDirectoryView';
import { XHistoryRecord, AISummaryResult } from './types';
import { ExtensionDrawer, ExtensionDrawerTab } from './components/ExtensionDrawer';
import { 
  Inbox, 
  Sparkles, 
  Puzzle,
  RotateCcw, 
  CheckCircle2, 
  AlertCircle,
  Link2,
  ExternalLink,
  Plus,
  CheckCheck
} from 'lucide-react';

export default function App() {
  const [records, setRecords] = useState<XHistoryRecord[]>([]);
  const [stats, setStats] = useState<{
    totalArchived: number;
    filteredCount: number;
    totalLinks: number;
    topDomains: Array<[string, number]>;
    topAuthors: Array<[string, number]>;
  }>({
    totalArchived: 0,
    filteredCount: 0,
    totalLinks: 0,
    topDomains: [],
    topAuthors: []
  });

  const [isLoadingRecords, setIsLoadingRecords] = useState(true);
  const [summary, setSummary] = useState<AISummaryResult | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isExtensionDrawerOpen, setIsExtensionDrawerOpen] = useState(false);
  const [extensionDrawerTab, setExtensionDrawerTab] = useState<ExtensionDrawerTab>('download');
  const [storageStatus, setStorageStatus] = useState<{
    isCloudReady?: boolean;
    isQuotaExhausted?: boolean;
    quotaNotice?: string | null;
    upgradeUrl?: string;
    pricingUrl?: string;
  } | null>(null);
  const [isQuotaBannerDismissed, setIsQuotaBannerDismissed] = useState(false);

  const handleOpenExtensionDrawer = (tab: ExtensionDrawerTab = 'download') => {
    setExtensionDrawerTab(tab);
    setIsExtensionDrawerOpen(true);
  };

  // Filters & Views
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAuthor, setSelectedAuthor] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [topicKeywords, setTopicKeywords] = useState<string[]>([]);
  const [hasLinksOnly, setHasLinksOnly] = useState(false);
  const [hasMediaOnly, setHasMediaOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'latest_date' | 'oldest_date' | 'newest' | 'oldest' | 'likes' | 'retweets'>('latest_date');
  const [viewMode, setViewMode] = useState<'cards' | 'compact' | 'links'>('cards');

  // Snippet Read Status (persisted in localStorage)
  const [readSnippetIds, setReadSnippetIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('soro_read_snippets');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [snippetFeedTab, setSnippetFeedTab] = useState<'active' | 'caught_up'>('active');

  useEffect(() => {
    try {
      localStorage.setItem('soro_read_snippets', JSON.stringify(readSnippetIds));
    } catch {}
  }, [readSnippetIds]);

  const handleToggleReadSnippet = (id: string) => {
    setReadSnippetIds(prev => {
      if (prev.includes(id)) {
        showToast('Moved snippet back to active archive', 'info');
        return prev.filter(x => x !== id);
      } else {
        showToast('Marked snippet as read & moved to Caught up', 'success');
        return [...prev, id];
      }
    });
  };

  const handleRestoreAllSnippets = () => {
    setReadSnippetIds([]);
    showToast('Restored all snippets to active archive', 'info');
  };

  // Notifications
  const [toast, setToast] = useState<{ message: string; type?: 'info' | 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Fetch records from backend
  const fetchRecords = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('q', searchQuery);
      if (selectedAuthor) params.append('author', selectedAuthor);
      if (selectedTopic) {
        params.append('topic', selectedTopic);
        if (topicKeywords.length > 0) {
          params.append('keywords', topicKeywords.join(','));
        }
      }
      if (hasLinksOnly) params.append('hasLinks', 'true');
      if (hasMediaOnly) params.append('hasMedia', 'true');
      if (sortBy) params.append('sort', sortBy);

      const res = await fetch(`/api/records?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRecords(data.records || []);
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (err: any) {
      console.error('Error fetching records:', err);
    } finally {
      setIsLoadingRecords(false);
    }
  }, [searchQuery, selectedAuthor, selectedTopic, topicKeywords, hasLinksOnly, hasMediaOnly, sortBy]);

  // Initial load
  useEffect(() => {
    fetchRecords();
    fetch('/api/storage/status')
      .then(res => res.json())
      .then(data => setStorageStatus(data))
      .catch(() => {});
  }, [fetchRecords]);

  // Generate initial summary automatically once records are loaded
  useEffect(() => {
    if (records.length > 0 && !summary && !isSummarizing) {
      handleGenerateSummary(false);
    }
  }, [records.length]);

  // Handle AI Summary Generation
  const handleGenerateSummary = async (showToastNotice = true) => {
    setIsSummarizing(true);
    if (showToastNotice) {
      showToast('Generating AI Summary from browsing records...', 'info');
    }
    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSummary(data);
      if (showToastNotice) {
        showToast('AI Summary generated successfully!', 'success');
      }
    } catch (err: any) {
      console.error('Error generating summary:', err);
      showToast('Failed to generate summary.', 'error');
    } finally {
      setIsSummarizing(false);
    }
  };

  // Handle Ask Archive Question
  const handleAskQuestion = async (question: string): Promise<string> => {
    const res = await fetch('/api/ai/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    });
    if (!res.ok) throw new Error('Query failed');
    const data = await res.json();
    return data.answer || 'No answer found.';
  };

  // Handle Delete Record
  const handleDeleteRecord = async (id: string) => {
    try {
      const res = await fetch(`/api/records/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setRecords(prev => prev.filter(r => r.id !== id));
        showToast('Record removed from archive.');
        fetchRecords();
      }
    } catch (err) {
      console.error('Failed to delete record:', err);
    }
  };

  // Handle Clear All Records
  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to clear all saved records from the archive?')) return;
    try {
      await fetch('/api/records', { method: 'DELETE' });
      setRecords([]);
      setSummary(null);
      showToast('Archive cleared.');
      fetchRecords();
    } catch (err) {
      console.error('Failed to clear records:', err);
    }
  };

  const handleSelectTopic = (topicName: string, keywords?: string[]) => {
    if (selectedTopic === topicName) {
      setSelectedTopic(null);
      setTopicKeywords([]);
      showToast('Cleared topic filter', 'info');
    } else {
      setSelectedTopic(topicName);
      setTopicKeywords(keywords || []);
      showToast(`Filtering archive by: ${topicName}`, 'info');
    }
  };

  const handleClearTopicFilter = () => {
    setSelectedTopic(null);
    setTopicKeywords([]);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedAuthor('');
    setSelectedTopic(null);
    setTopicKeywords([]);
    setHasLinksOnly(false);
    setHasMediaOnly(false);
  };

  const activeRecords = records.filter(r => !readSnippetIds.includes(r.id));
  const caughtUpRecords = records.filter(r => readSnippetIds.includes(r.id));
  const displayedRecords = snippetFeedTab === 'active' ? activeRecords : caughtUpRecords;

  const handleMarkAllSnippetsRead = () => {
    const currentActiveIds = activeRecords.map(r => r.id);
    if (currentActiveIds.length === 0) return;
    setReadSnippetIds(prev => Array.from(new Set([...prev, ...currentActiveIds])));
    showToast(`Marked ${currentActiveIds.length} snippet${currentActiveIds.length > 1 ? 's' : ''} as read`, 'success');
  };

  return (
    <div className="min-h-screen bg-[#FDFCFB] text-[#1A1A1A] flex flex-col font-sans selection:bg-stone-200">
      
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-[#1A1A1A] border border-stone-800 text-xs font-mono text-[#FDFCFB] shadow-2xl animate-fade-in">
          {toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-400" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Header */}
      <Header
        onOpenExtensionDrawer={() => handleOpenExtensionDrawer('download')}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Quota Status Notice Banner */}
        {storageStatus?.isQuotaExhausted && !isQuotaBannerDismissed && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50/90 border border-amber-200/80 text-amber-950 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm animate-fade-in">
            <div className="flex items-start sm:items-center gap-3">
              <div className="p-1.5 bg-amber-100 rounded-lg text-amber-800 shrink-0">
                <AlertCircle className="w-4 h-4" />
              </div>
              <div>
                <div className="font-medium text-amber-900 flex items-center gap-2">
                  <span>Firestore Daily Write Quota Reached</span>
                  <span className="px-2 py-0.5 text-[11px] font-mono bg-amber-200/60 text-amber-900 rounded-full">Free Tier Limit: 20k writes/day</span>
                </div>
                <p className="text-xs text-amber-800/90 mt-0.5">
                  SoroTracker local disk storage is actively safeguarding all records without data loss. Direct cloud writes will automatically resume when Google Cloud resets the daily quota tomorrow.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              {storageStatus.upgradeUrl && (
                <a
                  href={storageStatus.upgradeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-900 hover:bg-amber-950 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  <span>Upgrade Database</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              <button
                onClick={() => setIsQuotaBannerDismissed(true)}
                className="px-2.5 py-1.5 text-xs text-amber-800 hover:text-amber-950 font-medium hover:bg-amber-100 rounded-lg transition-colors cursor-pointer"
                title="Dismiss notice"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* AI Summary Section */}
        <SummarySection
          summary={summary}
          isLoading={isSummarizing}
          onRefresh={() => handleGenerateSummary(true)}
          onAskQuestion={handleAskQuestion}
          selectedTopic={selectedTopic}
          onSelectTopic={handleSelectTopic}
          onClearTopicFilter={handleClearTopicFilter}
          caughtUpSnippets={caughtUpRecords}
          onToggleReadSnippet={handleToggleReadSnippet}
          onRestoreAllSnippets={handleRestoreAllSnippets}
          onDeleteRecord={handleDeleteRecord}
          onSelectAuthor={(handle) => setSelectedAuthor(handle)}
        />

        {/* Filter and Search Bar */}
        <FilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedAuthor={selectedAuthor}
          onAuthorChange={setSelectedAuthor}
          selectedTopic={selectedTopic}
          onClearTopic={handleClearTopicFilter}
          hasLinksOnly={hasLinksOnly}
          onToggleHasLinks={() => setHasLinksOnly(prev => !prev)}
          hasMediaOnly={hasMediaOnly}
          onToggleHasMedia={() => setHasMediaOnly(prev => !prev)}
          sortBy={sortBy}
          onSortChange={setSortBy}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          availableAuthors={stats.topAuthors}
          totalCount={stats.totalArchived}
          filteredCount={records.length}
          onClearFilters={handleClearFilters}
        />

        {/* Feed Header Toolbar on Top of All Snippets */}
        {!isLoadingRecords && records.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-[#EAE6DD] text-xs">
            <div className="flex items-center gap-2">
              <button
                id="tab-feed-active"
                onClick={() => setSnippetFeedTab('active')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                  snippetFeedTab === 'active'
                    ? 'bg-[#1A1A1A] text-white shadow-xs'
                    : 'bg-white hover:bg-stone-100 text-stone-700 border border-[#DDD7CC]'
                }`}
              >
                <span>Active Snippets</span>
                <span className="font-mono text-[11px] opacity-80">({activeRecords.length})</span>
              </button>

              <button
                id="tab-feed-caught-up"
                onClick={() => setSnippetFeedTab('caught_up')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                  snippetFeedTab === 'caught_up'
                    ? 'bg-[#1A1A1A] text-white shadow-xs'
                    : 'bg-white hover:bg-stone-100 text-stone-700 border border-[#DDD7CC]'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Caught up</span>
                <span className="font-mono text-[11px] opacity-80">({caughtUpRecords.length})</span>
              </button>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              {snippetFeedTab === 'active' && activeRecords.length > 0 && (
                <button
                  id="mark-all-snippets-read-btn"
                  onClick={handleMarkAllSnippetsRead}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-emerald-50 text-stone-800 hover:text-emerald-800 border border-[#DDD7CC] hover:border-emerald-300 text-xs font-medium transition cursor-pointer shadow-2xs"
                  title="Mark all current active snippets as read"
                >
                  <CheckCheck className="w-3.5 h-3.5 text-stone-500" />
                  <span>Mark all snippets as read</span>
                </button>
              )}

              {snippetFeedTab === 'caught_up' && caughtUpRecords.length > 0 && (
                <button
                  id="restore-all-snippets-btn"
                  onClick={handleRestoreAllSnippets}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-stone-100 text-stone-800 border border-[#DDD7CC] text-xs font-medium transition cursor-pointer shadow-2xs"
                  title="Restore all caught-up snippets back to active"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-stone-500" />
                  <span>Restore all to active</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Records Content Area */}
        {isLoadingRecords ? (
          <div className="py-20 text-center text-stone-500 text-xs font-mono">
            <div className="inline-block w-8 h-8 border-2 border-stone-800 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p>Loading archived records from GCP Firestore...</p>
          </div>
        ) : records.length === 0 ? (
          /* Empty state */
          <div className="bg-white border border-[#E5E2DA] rounded-2xl p-10 text-center max-w-xl mx-auto my-8 shadow-2xs">
            <div className="w-14 h-14 rounded-2xl bg-stone-100 border border-[#DDD7CD] text-stone-700 flex items-center justify-center mx-auto mb-4">
              <Inbox className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-serif font-bold text-[#1A1A1A] mb-2">
              No Records Archived Yet
            </h3>
            <p className="text-xs text-stone-600 mb-6 leading-relaxed font-sans max-w-md mx-auto">
              Scan your bookmarks or browsing history at <strong className="text-stone-900 font-mono">x.com/i/history</strong> using the extension to populate your archive.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => handleOpenExtensionDrawer('download')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1A1A1A] hover:bg-black text-[#FDFCFB] text-xs font-mono uppercase tracking-wider shadow-xs transition cursor-pointer"
              >
                <Puzzle className="w-4 h-4 text-amber-300" />
                <span>Get Extension (.zip)</span>
              </button>

              <a
                href="https://x.com/i/history"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-[#FAF9F5] text-stone-800 border border-[#DDD7CD] text-xs font-mono uppercase tracking-wider transition cursor-pointer"
              >
                <span>Open x.com/i/history</span>
              </a>

              <button
                onClick={() => handleOpenExtensionDrawer('setup')}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-mono uppercase tracking-wider transition cursor-pointer"
              >
                <span>Setup Guide</span>
              </button>
            </div>
          </div>
        ) : displayedRecords.length === 0 ? (
          /* Empty state for the current tab (Active or Caught Up) */
          snippetFeedTab === 'active' ? (
            <div className="bg-white border border-[#E5E2DA] rounded-2xl p-8 text-center max-w-md mx-auto my-6 shadow-2xs">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-3 border border-emerald-300">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-serif font-bold text-stone-900 mb-1">
                All Active Snippets Caught Up!
              </h3>
              <p className="text-xs text-stone-600 mb-4 leading-relaxed font-sans">
                You've marked all {records.length} snippets as read. You can view them anytime in the <strong>Caught up</strong> tab or feed.
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setSnippetFeedTab('caught_up')}
                  className="px-3 py-1.5 rounded-lg bg-[#1A1A1A] text-white text-xs font-medium transition cursor-pointer"
                >
                  View Caught up ({caughtUpRecords.length})
                </button>
                <button
                  onClick={handleRestoreAllSnippets}
                  className="px-3 py-1.5 rounded-lg bg-white border border-[#DDD7CC] hover:bg-stone-50 text-stone-700 text-xs font-medium transition cursor-pointer"
                >
                  Restore All to Active
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-[#E5E2DA] rounded-2xl p-8 text-center max-w-md mx-auto my-6 shadow-2xs">
              <CheckCircle2 className="w-10 h-10 text-stone-300 mx-auto mb-2" />
              <h3 className="text-base font-serif font-bold text-stone-900 mb-1">
                No Caught Up Snippets Yet
              </h3>
              <p className="text-xs text-stone-500 mb-4 leading-relaxed font-sans">
                Click <strong>"Mark as read"</strong> on top of any snippet card to organize it here.
              </p>
              <button
                onClick={() => setSnippetFeedTab('active')}
                className="px-3 py-1.5 rounded-lg bg-[#1A1A1A] text-white text-xs font-medium transition cursor-pointer"
              >
                Back to Active Snippets ({activeRecords.length})
              </button>
            </div>
          )
        ) : viewMode === 'links' ? (
          /* Link-Centric Directory View */
          <LinkDirectoryView records={displayedRecords} />
        ) : viewMode === 'compact' ? (
          /* Compact List View */
          <div className="space-y-2.5">
            {displayedRecords.map(record => (
              <RecordCard
                key={record.id}
                record={record}
                onDelete={handleDeleteRecord}
                onSelectAuthor={(handle) => setSelectedAuthor(handle)}
                compact={true}
                isRead={readSnippetIds.includes(record.id)}
                onToggleRead={handleToggleReadSnippet}
              />
            ))}
          </div>
        ) : (
          /* Default Grid Cards View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedRecords.map(record => (
              <RecordCard
                key={record.id}
                record={record}
                onDelete={handleDeleteRecord}
                onSelectAuthor={(handle) => setSelectedAuthor(handle)}
                compact={false}
                isRead={readSnippetIds.includes(record.id)}
                onToggleRead={handleToggleReadSnippet}
              />
            ))}
          </div>
        )}

      </main>

      {/* Extension Slide-Over Right Drawer (Download, Extension Setup & Code) */}
      <ExtensionDrawer
        isOpen={isExtensionDrawerOpen}
        onClose={() => setIsExtensionDrawerOpen(false)}
        defaultTab={extensionDrawerTab}
      />

    </div>
  );
}
