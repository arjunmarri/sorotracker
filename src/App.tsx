/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Header } from './components/Header';
import { SummarySection } from './components/SummarySection';
import { FilterBar } from './components/FilterBar';
import { RecordCard } from './components/RecordCard';
import { XHistoryRecord, AISummaryResult, UserProfile, SiteSettings, SiteTheme, ContentFilterCategory, SubTopic, ReaderFontSize, SortOption, TopContentItem, AgentRunStatus, SubmenuType } from './types';
import { ExtensionDrawer, ExtensionDrawerTab } from './components/ExtensionDrawer';
import { AdminPanel } from './components/AdminPanel';
import { AuthModal } from './components/AuthModal';
import { ImportJsonModal } from './components/ImportJsonModal';
import { Footer } from './components/Footer';
import { ContentFilterSection } from './components/ContentFilterPopover';
import { filterTimelineRecords, getSnippetLabels, ALL_CATEGORY_OPTIONS, setCustomCategories } from './lib/contentFilter';
import { buildSubTopicsFromSnippets, filterRecordsBySubTopic } from './lib/subtopics';
import { clusterTopics, recordMatchesCluster, TopicClusterGroup } from './lib/topicClustering';
import { TopicsSidebar } from './components/TopicsSidebar';
import { DedicatedCategoryPage } from './components/DedicatedCategoryPage';
import { TrendView } from './components/TrendView';
import { TopContentView } from './components/TopContentView';
import { SearchPage } from './components/SearchPage';
import { ClearSessionModal } from './components/ClearSessionModal';
import { RecycledBinModal } from './components/RecycledBinModal';
import { CleanDashboardBar } from './components/CleanDashboardBar';
import { onUserChange, logoutUser } from './lib/auth';
import { applyThemeToDOM } from './lib/theme';
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
  CheckCheck,
  Globe,
  SlidersHorizontal,
  Layers,
  ArrowUp,
  BookOpen,
  EyeOff,
  Trash2,
  X,
  Search,
  ArrowLeft,
  Bookmark,
  TrendingUp,
  LayoutList,
  Bot
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

  // Notifications
  const [toast, setToast] = useState<{ 
    message: string; 
    type?: 'info' | 'success' | 'error';
    action?: { label: string; onClick: () => void };
  } | null>(null);

  const showToast = useCallback((
    message: string, 
    type: 'info' | 'success' | 'error' = 'success',
    action?: { label: string; onClick: () => void }
  ) => {
    setToast({ message, type, action });
    setTimeout(() => {
      setToast(current => (current?.message === message ? null : current));
    }, action ? 7000 : 3500);
  }, []);

  // User Authentication & Admin Management
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // Direct JSON Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importInitialFile, setImportInitialFile] = useState<File | null>(null);

  const handleOpenImportModal = (file?: File) => {
    if (file) {
      setImportInitialFile(file);
    } else {
      setImportInitialFile(null);
    }
    setIsImportModalOpen(true);
  };

  const handleImportSuccess = async (importedCount: number, duplicatesCount: number) => {
    await fetchRecords();
    if (duplicatesCount === 0) {
      showToast(`Successfully imported and organized ${importedCount} records!`, 'success');
    } else {
      showToast(`Organized ${importedCount} new records (${duplicatesCount} duplicate${duplicatesCount > 1 ? 's' : ''} skipped)`, 'success');
    }
  };

  // Site Configuration & Branding Settings
  const [siteSettings, setSiteSettings] = useState<SiteSettings>({
    siteName: 'SoroTrack',
    tagline: 'Preserve and analyze your 𝕏 bookmarks, history & references',
    theme: 'warm-neutral',
    footerContent: 'Automated 𝕏 bookmarks & reading history archive with zero-reflow extraction, AI semantic discovery, and manual sync protection.',
    footerCopyright: '© 2026 SoroTrack. All rights reserved.',
    updatedAt: new Date().toISOString(),
    updatedBy: 'system'
  });

  const handleOpenExtensionDrawer = (tab: ExtensionDrawerTab = 'download') => {
    setExtensionDrawerTab(tab);
    setIsExtensionDrawerOpen(true);
  };

  // Filters & Views
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const [selectedAuthor, setSelectedAuthor] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<TopicClusterGroup | null>(null);
  const [selectedSubTopic, setSelectedSubTopic] = useState<SubTopic | null>(null);
  const [topicKeywords, setTopicKeywords] = useState<string[]>([]);
  const [hasLinksOnly, setHasLinksOnly] = useState(false);
  const [hasMediaOnly, setHasMediaOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [viewMode, setViewMode] = useState<'cards' | 'compact'>('cards');
  
  // Submenu Navigation State ('timeline' | 'trend' | 'read-later' | 'top-content' | 'recycled-bin')
  const [activeSubmenu, setActiveSubmenu] = useState<SubmenuType>('timeline');

  // Autonomous SoroTrack Agent & Top Content State
  const [topContentItems, setTopContentItems] = useState<TopContentItem[]>([]);
  const [agentStatus, setAgentStatus] = useState<AgentRunStatus>({
    isRunning: false,
    lastRunStatus: 'idle',
    totalItemsFound: 0,
    mode: 'cloud',
    autoScanIntervalMin: 60
  });
  const [isLoadingAgent, setIsLoadingAgent] = useState(false);

  const handleSelectSubmenu = useCallback((menu: SubmenuType) => {
    setActiveSubmenu(menu);
    if (menu === 'read-later') {
      setIsReadLaterOnly(true);
    } else {
      setIsReadLaterOnly(false);
    }
    setActiveCategoryPageId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleToggleTrendSubmenu = useCallback(() => {
    setActiveSubmenu(prev => prev === 'trend' ? 'timeline' : 'trend');
    setActiveCategoryPageId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Pagination / Infinite Scrolling state (Load 25 latest snippets by default, rest on scroll)
  const [visibleCount, setVisibleCount] = useState<number>(25);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);

  // Topics Sidebar visibility state (Maximized by default per user request)
  const [isTopicsSidebarOpen, setIsTopicsSidebarOpen] = useState<boolean>(true);

  // Expandable Content Filter Section state
  const [isFilterSectionOpen, setIsFilterSectionOpen] = useState<boolean>(false);

  useEffect(() => {
    try {
      localStorage.setItem('soro_topics_sidebar_open', JSON.stringify(isTopicsSidebarOpen));
    } catch {}
  }, [isTopicsSidebarOpen]);

  // Reader Font Size Setting (persisted in localStorage)
  const [readerFontSize, setReaderFontSize] = useState<ReaderFontSize>(() => {
    try {
      const saved = localStorage.getItem('soro_reader_font_size');
      return (saved === 'sm' || saved === 'md' || saved === 'lg') ? saved : 'md';
    } catch {
      return 'md';
    }
  });

  const handleFontSizeChange = (size: ReaderFontSize) => {
    setReaderFontSize(size);
    try {
      localStorage.setItem('soro_reader_font_size', size);
    } catch {}
  };

  // Scroll-to-top floating button state
  const [showScrollToTop, setShowScrollToTop] = useState<boolean>(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollToTop(window.scrollY > 350);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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

  const readSnippetSet = useMemo(() => new Set(readSnippetIds), [readSnippetIds]);

  useEffect(() => {
    try {
      localStorage.setItem('soro_read_snippets', JSON.stringify(readSnippetIds));
    } catch {}
  }, [readSnippetIds]);

  const handleToggleReadSnippet = useCallback((id: string) => {
    setReadSnippetIds(prev => {
      if (prev.includes(id)) {
        showToast('Moved snippet back to active archive', 'info');
        return prev.filter(x => x !== id);
      } else {
        showToast('Marked snippet as read & moved to Caught up', 'success');
        return [...prev, id];
      }
    });
  }, [showToast]);

  const handleRestoreAllSnippets = useCallback(() => {
    setReadSnippetIds([]);
    showToast('Restored all snippets to active archive', 'info');
  }, [showToast]);

  // Read Later / To-Read Status (persisted in localStorage under 'to-read')
  const [toReadSnippetIds, setToReadSnippetIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('to-read');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isReadLaterOnly, setIsReadLaterOnly] = useState<boolean>(false);

  const toReadSnippetSet = useMemo(() => new Set(toReadSnippetIds), [toReadSnippetIds]);

  useEffect(() => {
    try {
      localStorage.setItem('to-read', JSON.stringify(toReadSnippetIds));
    } catch {}
  }, [toReadSnippetIds]);

  const handleToggleReadLater = useCallback((id: string) => {
    setToReadSnippetIds(prev => {
      if (prev.includes(id)) {
        showToast('Removed snippet from Read Later list', 'info');
        return prev.filter(x => x !== id);
      } else {
        showToast('Saved snippet to Read Later list', 'success');
        return [...prev, id];
      }
    });
  }, [showToast]);

  // Content Filters for pure technical & productive consumption
  const [activeContentFilters, setActiveContentFilters] = useState<ContentFilterCategory[]>(() => {
    try {
      const saved = localStorage.getItem('soro_content_filters');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('soro_content_filters', JSON.stringify(activeContentFilters));
    } catch {}
  }, [activeContentFilters]);

  const handleToggleContentFilter = useCallback((category: ContentFilterCategory) => {
    setActiveContentFilters(prev => {
      const exists = prev.includes(category);
      const next = exists ? prev.filter(c => c !== category) : [...prev, category];
      showToast(exists ? `Restored ${category.replace('_', ' ')}` : `Filtering out ${category.replace('_', ' ')}`, 'info');
      return next;
    });
  }, [showToast]);

  // Anon Mode State & Handlers
  const [isAnonMode, setIsAnonMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('soro_anon_mode') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleAnonMode = useCallback(async () => {
    const nextVal = !isAnonMode;
    setIsAnonMode(nextVal);
    try {
      localStorage.setItem('soro_anon_mode', String(nextVal));
      await fetch('/api/anon-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextVal })
      });
    } catch (e) {
      console.warn('Failed to sync anon mode with server:', e);
    }
    if (nextVal) {
      showToast('🕶️ Anon Mode enabled: No snippets will be stored.', 'info');
    } else {
      showToast('Anon Mode disabled: Snippets will be stored normally.', 'success');
    }
  }, [isAnonMode, showToast]);

  // Clear Session State & Handlers
  const [isClearSessionModalOpen, setIsClearSessionModalOpen] = useState(false);

  const handleClearSessionView = useCallback(() => {
    setRecords([]);
    setSearchQuery('');
    setSelectedTopic(null);
    setSelectedCluster(null);
    setSelectedSubTopic(null);
    setSelectedAuthor('');
    setSelectedCategory(null);
    setStats({
      totalArchived: 0,
      filteredCount: 0,
      totalLinks: 0,
      topDomains: [],
      topAuthors: []
    });
    showToast('Active session view cleared.', 'info');
  }, [showToast]);

  const handleClearSessionStorage = useCallback(async () => {
    try {
      const recordIds = records.map(r => r.id);
      const res = await fetch('/api/session/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordIds })
      });
      const data = await res.json();
      setRecords([]);
      setSearchQuery('');
      setSelectedTopic(null);
      setSelectedCluster(null);
      setSelectedSubTopic(null);
      setSelectedAuthor('');
      setSelectedCategory(null);
      showToast(`Cleared ${data.deletedCount || recordIds.length} session snippet(s) from storage`, 'success');
    } catch (err: any) {
      showToast(`Clear error: ${err.message}`, 'error');
    }
  }, [records, showToast]);

  const handleClearAllStorage = useCallback(async () => {
    try {
      const recordIds = records.map(r => r.id);
      const res = await fetch('/api/session/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordIds })
      });
      const data = await res.json();
      setRecords([]);
      setSearchQuery('');
      setSelectedTopic(null);
      setSelectedCluster(null);
      setSelectedSubTopic(null);
      setSelectedAuthor('');
      setSelectedCategory(null);
      showToast(`Permanently deleted ${data.deletedCount || 0} snippet(s)`, 'success');
    } catch (err: any) {
      showToast(`Clear error: ${err.message}`, 'error');
    }
  }, [records, showToast]);

  // Fetch records from backend using debouncedSearchQuery to eliminate lag during typing
  const fetchRecords = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (debouncedSearchQuery) params.append('q', debouncedSearchQuery);
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
      if (data.records && Array.isArray(data.records)) {
        setRecords(data.records);
        try {
          (window as any).__SOROTRACK_VIEWER_DATA__ = data.records;
        } catch {}
      } else {
        setRecords([]);
      }
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (err: any) {
      console.error('Error fetching records:', err);
    } finally {
      setIsLoadingRecords(false);
    }
  }, [debouncedSearchQuery, selectedAuthor, selectedTopic, topicKeywords, hasLinksOnly, hasMediaOnly, sortBy]);

  // Initial load
  useEffect(() => {
    fetchRecords();
    fetch('/api/storage/status')
      .then(res => res.json())
      .then(data => setStorageStatus(data))
      .catch(() => {});
  }, [fetchRecords]);

  // Auth State Listener
  useEffect(() => {
    const unsubscribe = onUserChange((user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Keyboard shortcut listener (Ctrl+Alt+A or Cmd+Alt+A or Ctrl+Shift+A) & URL trigger for admin access
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.altKey || e.shiftKey) && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        if (currentUser?.role === 'admin') {
          setIsAdminOpen(prev => !prev);
        } else {
          setIsAuthOpen(true);
        }
      }
    };

    const checkUrlTrigger = () => {
      const hash = window.location.hash.toLowerCase();
      const search = window.location.search.toLowerCase();
      if (hash === '#admin' || hash === '#login' || search.includes('admin=true') || search.includes('login=true')) {
        if (currentUser?.role === 'admin') {
          setIsAdminOpen(true);
        } else {
          setIsAuthOpen(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('hashchange', checkUrlTrigger);
    checkUrlTrigger();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('hashchange', checkUrlTrigger);
    };
  }, [currentUser]);

  // Fetch Site Settings & Apply Theme / Page Title
  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data: SiteSettings = await res.json();
        setSiteSettings(data);
        if (data.customCategories && data.customCategories.length > 0) {
          setCustomCategories(data.customCategories);
        }
        applyThemeToDOM(data.theme || 'warm-neutral');
        if (data.siteName) {
          document.title = `${data.siteName} — ${data.tagline || '𝕏 Archive & Reference Index'}`;
        }
      }
    } catch (err) {
      console.warn('Failed to load site settings:', err);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Fetch Autonomous Agent Top Content
  const fetchTopContent = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/top-content');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.items)) {
          setTopContentItems(data.items);
        }
        if (data.status) {
          setAgentStatus(data.status);
        }
      }
    } catch (err) {
      console.warn('[App] Error fetching top content:', err);
    }
  }, []);

  useEffect(() => {
    fetchTopContent();
  }, [fetchTopContent]);

  // Run SoroTrack Autonomous Agent to scan X
  const handleRunAgent = useCallback(async (forceRefresh = false) => {
    setIsLoadingAgent(true);
    setAgentStatus(prev => ({ ...prev, isRunning: true }));
    try {
      const res = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceRefresh })
      });
      const data = await res.json();
      if (res.ok && data.items) {
        setTopContentItems(data.items);
        if (data.status) setAgentStatus(data.status);
        showToast(data.message || `Autonomous agent found ${data.items.length} trending topics on 𝕏!`, 'success');
      } else {
        showToast(data.error || 'Agent scan failed', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to communicate with autonomous agent', 'error');
    } finally {
      setIsLoadingAgent(false);
    }
  }, [showToast]);

  // Save trending topic directly to user's permanent timeline
  const handleSaveToTimeline = useCallback(async (item: TopContentItem) => {
    try {
      const res = await fetch('/api/agent/save-to-timeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item })
      });
      const data = await res.json();
      if (res.ok) {
        await fetchRecords();
        showToast(`"${item.topic}" saved to your permanent SoroTrack timeline!`, 'success');
      } else {
        showToast(data.error || 'Failed to save item', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error saving item to archive', 'error');
    }
  }, [fetchRecords, showToast]);

  // Handle Update Site Settings
  const handleUpdateSettings = async (newSettings: Partial<SiteSettings>) => {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSettings)
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to update settings');
    }
    const updated: SiteSettings = await res.json();
    setSiteSettings(updated);
    if (updated.customCategories) {
      setCustomCategories(updated.customCategories);
    }
    applyThemeToDOM(updated.theme);
    if (updated.siteName) {
      document.title = `${updated.siteName} — ${updated.tagline || '𝕏 Archive & Reference Index'}`;
    }
  };

  const handleThemeChange = (theme: SiteTheme) => {
    applyThemeToDOM(theme);
  };

  const handleToggleTheme = async () => {
    const isCurrentlyDark = siteSettings.theme === 'midnight-dark';
    const nextTheme: SiteTheme = isCurrentlyDark ? 'warm-neutral' : 'midnight-dark';
    try {
      await handleUpdateSettings({ theme: nextTheme });
      showToast(`Switched to ${isCurrentlyDark ? 'Light' : 'Dark'} theme`, 'info');
    } catch {
      applyThemeToDOM(nextTheme);
      setSiteSettings(prev => ({ ...prev, theme: nextTheme }));
    }
  };

  // Handle Export Full Archive as JSON
  const handleExportJsonArchive = () => {
    const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(siteSettings.siteName || 'sorotrack').toLowerCase()}-archive-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${records.length} records to JSON archive file`, 'success');
  };

  // Generate initial summary automatically once records are loaded
  useEffect(() => {
    if (records.length > 0 && !summary && !isSummarizing) {
      handleGenerateSummary(false);
    }
  }, [records.length]);

  // Handle AI Summary Generation
  const handleGenerateSummary = async (showToastNotice = true, force = false) => {
    setIsSummarizing(true);
    if (showToastNotice) {
      showToast('Generating AI Summary from browsing records...', 'info');
    }
    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ force })
      });

      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        const errText = await res.text().catch(() => '');
        console.warn(`[Summary API Notice] Server response status ${res.status}:`, errText.slice(0, 80));
        if (showToastNotice) {
          showToast('Using latest archive intelligence.', 'info');
        }
        return;
      }

      const data = await res.json();
      if (data && Array.isArray(data.topicClusters)) {
        setSummary(data);
        if (showToastNotice) {
          showToast('AI Summary generated successfully!', 'success');
        }
      }
    } catch (err: any) {
      console.warn('Summary generation notice:', err?.message || err);
      if (showToastNotice) {
        showToast('Archive insights updated.', 'info');
      }
    } finally {
      setIsSummarizing(false);
    }
  };

  // Handle Ask Archive Question
  const handleAskQuestion = async (question: string): Promise<string> => {
    try {
      const res = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ question })
      });
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        return 'Service temporarily busy. Please try asking again shortly.';
      }
      const data = await res.json();
      return data.answer || 'No answer found in the archive.';
    } catch {
      return 'Could not retrieve answer. Please try again.';
    }
  };

  // Handle Delete Record
  const handleDeleteRecord = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/records/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setRecords(prev => prev.filter(r => r.id !== id));
        showToast('Record removed from archive.');
      }
    } catch (err) {
      console.error('Failed to delete record:', err);
    }
  }, [showToast]);

  const handleSelectAuthor = useCallback((handle: string) => {
    setSelectedAuthor(handle);
  }, []);

  // Handle Clear All Records
  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to clear all saved records from the archive?')) return;
    try {
      await fetch('/api/records', { method: 'DELETE' });
      setRecords([]);
      setSummary(null);
      showToast('All records cleared successfully.', 'info');
      fetchRecords();
    } catch (err) {
      console.error('Failed to clear records:', err);
    }
  };

  // Topics Extraction and Dynamic Clustering (Max 10 clusters, small topics in "Others")
  const { allSubTopics } = useMemo(() => {
    return buildSubTopicsFromSnippets(records, summary?.topicClusters || []);
  }, [records, summary?.topicClusters]);

  const topicClusters = useMemo(() => {
    return clusterTopics(allSubTopics, records, 10);
  }, [allSubTopics, records]);

  // Dedicated Category Page navigation state
  const [activeCategoryPageId, setActiveCategoryPageId] = useState<string | null>(null);

  const currentCategoryPage = useMemo(() => {
    if (!activeCategoryPageId) return null;
    return topicClusters.find(c => c.id === activeCategoryPageId) || null;
  }, [activeCategoryPageId, topicClusters]);

  const handleNavigateToCategoryPage = (cluster: TopicClusterGroup) => {
    setActiveCategoryPageId(cluster.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToTimeline = () => {
    setActiveCategoryPageId(null);
    setActiveSubmenu('timeline');
    setIsReadLaterOnly(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectCluster = (cluster: TopicClusterGroup | null) => {
    if (selectedCluster?.id === cluster?.id) {
      setSelectedCluster(null);
      setSelectedSubTopic(null);
      showToast('Cleared cluster filter', 'info');
    } else {
      setSelectedCluster(cluster);
      setSelectedSubTopic(null);
      if (cluster) {
        showToast(`Filtering by cluster: ${cluster.name} (${cluster.totalSnippets})`, 'info');
      }
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

  const [selectedCategory, setSelectedCategory] = useState<ContentFilterCategory | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<string>('');

  const handleClearTopicFilter = () => {
    setSelectedTopic(null);
    setSelectedCluster(null);
    setSelectedSubTopic(null);
    setTopicKeywords([]);
  };

  const handleSelectSubTopic = (subTopic: SubTopic | null) => {
    if (selectedSubTopic?.id === subTopic?.id) {
      setSelectedSubTopic(null);
      showToast('Cleared topic filter', 'info');
    } else {
      setSelectedSubTopic(subTopic);
      if (subTopic) {
        showToast(`Filtering by topic: ${subTopic.label} (${subTopic.count ?? 0})`, 'info');
      }
    }
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedAuthor('');
    setSelectedDomain('');
    setSelectedTopic(null);
    setSelectedCluster(null);
    setSelectedCategory(null);
    setSelectedSubTopic(null);
    setTopicKeywords([]);
    setHasLinksOnly(false);
    setHasMediaOnly(false);
    setIsReadLaterOnly(false);
    setActiveSubmenu('timeline');
  };

  const handleSelectCategory = useCallback((cat: ContentFilterCategory) => {
    setSelectedCategory(prev => {
      if (prev === cat) {
        showToast('Cleared category filter', 'info');
        return null;
      } else {
        const meta = ALL_CATEGORY_OPTIONS.find(c => c.id === cat);
        showToast(`Filtering by: ${meta?.label || cat}`, 'info');
        return cat;
      }
    });
  }, [showToast]);

  // Content filtering for clean technical & productive consumption
  const { filteredRecords: cleanedRecords, excludedRecords: contentFilteredOutRecords, categoryCounts } = useMemo(() => {
    return filterTimelineRecords(records, activeContentFilters);
  }, [records, activeContentFilters]);

  // Cluster filter if selected
  const clusterFilteredRecords = useMemo(() => {
    if (!selectedCluster) return cleanedRecords;
    return cleanedRecords.filter(r => recordMatchesCluster(r, selectedCluster));
  }, [cleanedRecords, selectedCluster]);

  // Topic filter if selected
  const topicFilteredRecords = useMemo(() => {
    if (!selectedSubTopic) return clusterFilteredRecords;
    return filterRecordsBySubTopic(clusterFilteredRecords, selectedSubTopic);
  }, [clusterFilteredRecords, selectedSubTopic]);

  // Single category/label filter if clicked or selected
  const categoryFilteredRecords = useMemo(() => {
    if (!selectedCategory) return topicFilteredRecords;
    return topicFilteredRecords.filter(r => getSnippetLabels(r).includes(selectedCategory));
  }, [topicFilteredRecords, selectedCategory]);

  // Domain filter if selected (e.g. github.com, arxiv.org, youtube.com)
  const domainFilteredRecords = useMemo(() => {
    if (!selectedDomain) return categoryFilteredRecords;
    const cleanFilter = selectedDomain.toLowerCase().trim();
    return categoryFilteredRecords.filter(r => 
      r.links && r.links.some(l => l.domain && l.domain.toLowerCase().replace(/^www\./, '').includes(cleanFilter))
    );
  }, [categoryFilteredRecords, selectedDomain]);

  // Author filter if selected
  const authorFilteredRecords = useMemo(() => {
    if (!selectedAuthor) return domainFilteredRecords;
    const authLower = selectedAuthor.toLowerCase();
    return domainFilteredRecords.filter(r => 
      (r.authorHandle && r.authorHandle.toLowerCase() === authLower) ||
      (r.authorName && r.authorName.toLowerCase() === authLower)
    );
  }, [domainFilteredRecords, selectedAuthor]);

  // Has links filter if enabled
  const linksFilteredRecords = useMemo(() => {
    if (!hasLinksOnly) return authorFilteredRecords;
    return authorFilteredRecords.filter(r => Boolean(r.links && r.links.length > 0));
  }, [authorFilteredRecords, hasLinksOnly]);

  // Has media / images filter if enabled
  const mediaFilteredRecords = useMemo(() => {
    if (!hasMediaOnly) return linksFilteredRecords;
    return linksFilteredRecords.filter(r => Boolean(r.media && r.media.length > 0));
  }, [linksFilteredRecords, hasMediaOnly]);

  // Read Later / To-Read list filter if enabled
  const readLaterFilteredRecords = useMemo(() => {
    if (!isReadLaterOnly) return mediaFilteredRecords;
    return mediaFilteredRecords.filter(r => toReadSnippetSet.has(r.id));
  }, [mediaFilteredRecords, isReadLaterOnly, toReadSnippetSet]);

  // In-line search query filter
  const searchFilteredRecords = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return readLaterFilteredRecords;
    const q = debouncedSearchQuery.toLowerCase().trim();
    return readLaterFilteredRecords.filter(r => {
      if (r.text && r.text.toLowerCase().includes(q)) return true;
      if (r.authorName && r.authorName.toLowerCase().includes(q)) return true;
      if (r.authorHandle && r.authorHandle.toLowerCase().includes(q)) return true;
      if (r.tags && r.tags.some(t => t.toLowerCase().includes(q))) return true;
      if (r.links && r.links.some(l => 
        (l.title && l.title.toLowerCase().includes(q)) ||
        (l.domain && l.domain.toLowerCase().includes(q)) ||
        (l.url && l.url.toLowerCase().includes(q))
      )) return true;
      return false;
    });
  }, [readLaterFilteredRecords, debouncedSearchQuery]);

  // Sort records based on selected SortOption
  const displayedRecords = useMemo(() => {
    const list = [...searchFilteredRecords];
    list.sort((a, b) => {
      switch (sortBy) {
        case 'newest': {
          const timeA = new Date(a.scannedAt || a.syncedAt || a.createdAt || 0).getTime();
          const timeB = new Date(b.scannedAt || b.syncedAt || b.createdAt || 0).getTime();
          return timeB - timeA;
        }
        case 'latest_date':
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        case 'oldest_date':
          return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
        case 'likes':
          return (b.metrics?.likes || 0) - (a.metrics?.likes || 0);
        case 'retweets':
          return (b.metrics?.retweets || 0) - (a.metrics?.retweets || 0);
        default: {
          const timeA = new Date(a.scannedAt || a.syncedAt || a.createdAt || 0).getTime();
          const timeB = new Date(b.scannedAt || b.syncedAt || b.createdAt || 0).getTime();
          return timeB - timeA;
        }
      }
    });
    return list;
  }, [searchFilteredRecords, sortBy]);

  // Available authors list computed with fallback
  const availableAuthors = useMemo<Array<[string, number]>>(() => {
    if (stats.topAuthors && stats.topAuthors.length > 0) {
      return stats.topAuthors;
    }
    const counts: Record<string, number> = {};
    records.forEach(r => {
      const handle = r.authorHandle || r.authorName;
      if (handle) {
        counts[handle] = (counts[handle] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);
  }, [stats.topAuthors, records]);

  // Available link domains computed from all records
  const availableDomains = useMemo<Array<[string, number]>>(() => {
    const counts: Record<string, number> = {};
    records.forEach(r => {
      if (r.links && r.links.length > 0) {
        r.links.forEach(l => {
          if (l.domain) {
            const cleanDomain = l.domain.toLowerCase().replace(/^www\./, '');
            counts[cleanDomain] = (counts[cleanDomain] || 0) + 1;
          }
        });
      }
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30);
  }, [records]);

  // Reset pagination to 25 whenever active filters or search change
  useEffect(() => {
    setVisibleCount(25);
  }, [
    debouncedSearchQuery, 
    selectedAuthor, 
    selectedDomain,
    selectedTopic, 
    selectedCluster, 
    selectedSubTopic, 
    selectedCategory, 
    hasLinksOnly, 
    hasMediaOnly, 
    sortBy, 
    activeContentFilters
  ]);

  // Sliced records for non-blocking 60fps progressive rendering (25 by default)
  const visibleRecords = useMemo(() => {
    return displayedRecords.slice(0, visibleCount);
  }, [displayedRecords, visibleCount]);

  // Infinite Scroll: dynamically load next 25 snippets when user scrolls towards bottom
  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && visibleCount < displayedRecords.length) {
          setIsLoadingMore(true);
          const timer = setTimeout(() => {
            setVisibleCount(prev => Math.min(prev + 25, displayedRecords.length));
            setIsLoadingMore(false);
          }, 100);
          return () => clearTimeout(timer);
        }
      },
      { rootMargin: '300px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [visibleCount, displayedRecords.length]);

  const handleMarkAllSnippetsRead = () => {
    const currentIds = displayedRecords.map(r => r.id);
    if (currentIds.length === 0) return;
    setReadSnippetIds(prev => Array.from(new Set([...prev, ...currentIds])));
    showToast(`Marked ${currentIds.length} snippet${currentIds.length > 1 ? 's' : ''} as read`, 'success');
  };

  // Clean Dashboard & Recycled Bin State
  const [selectedSnippetIds, setSelectedSnippetIds] = useState<Set<string>>(new Set());
  const [isRecycledBinOpen, setIsRecycledBinOpen] = useState(false);
  const [recycledCount, setRecycledCount] = useState<number>(0);
  const [isSendingToRecycle, setIsSendingToRecycle] = useState(false);

  // Fetch recycled records count
  const fetchRecycledCount = useCallback(async () => {
    try {
      const res = await fetch('/api/records/recycled');
      if (res.ok) {
        const data = await res.json();
        setRecycledCount(data.count || 0);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchRecycledCount();
  }, [fetchRecycledCount]);

  // Determine if clean dashboard filter mode is active (filtered by author, domain, or label)
  const isCleanDashboardFilterActive = Boolean(
    selectedAuthor || 
    selectedDomain || 
    selectedCategory || 
    (activeContentFilters && activeContentFilters.length > 0)
  );

  // Build active filter summary text
  const activeFilterSummary = useMemo(() => {
    const parts: string[] = [];
    if (selectedAuthor) parts.push(`Author: @${selectedAuthor.replace(/^@/, '')}`);
    if (selectedDomain) parts.push(`Domain: ${selectedDomain}`);
    if (selectedCategory) parts.push(`Label: ${selectedCategory.replace('_', ' ')}`);
    if (activeContentFilters && activeContentFilters.length > 0 && !selectedCategory) {
      parts.push(`Labels (${activeContentFilters.length})`);
    }
    return parts.join(' • ') || 'Filtered Content';
  }, [selectedAuthor, selectedDomain, selectedCategory, activeContentFilters]);

  // Reset selected snippet IDs when filters change
  useEffect(() => {
    setSelectedSnippetIds(new Set());
  }, [selectedAuthor, selectedDomain, selectedCategory, activeContentFilters, debouncedSearchQuery]);

  // Matching snippet IDs on current filtered dashboard
  const matchingSnippetIds = useMemo(() => displayedRecords.map(r => r.id), [displayedRecords]);

  // Selected count strictly among matching snippets
  const selectedCount = useMemo(() => {
    let count = 0;
    for (const id of matchingSnippetIds) {
      if (selectedSnippetIds.has(id)) count++;
    }
    return count;
  }, [matchingSnippetIds, selectedSnippetIds]);

  const isAllSelected = matchingSnippetIds.length > 0 && selectedCount === matchingSnippetIds.length;

  const handleToggleSelectAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedSnippetIds(new Set());
    } else {
      setSelectedSnippetIds(new Set(matchingSnippetIds));
    }
  }, [isAllSelected, matchingSnippetIds]);

  const handleToggleSelectSnippet = useCallback((id: string) => {
    setSelectedSnippetIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedSnippetIds(new Set());
  }, []);

  // Restore records from recycled bin
  const handleRestoreRecords = useCallback(async (ids: string[]) => {
    try {
      const res = await fetch('/api/records/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchRecords();
      await fetchRecycledCount();
      showToast(`Restored ${ids.length} snippet${ids.length > 1 ? 's' : ''} to dashboard.`, 'success');
    } catch (err: any) {
      showToast(`Failed to restore snippets: ${err.message}`, 'error');
    }
  }, [fetchRecords, fetchRecycledCount, showToast]);

  // Send records to recycled bin
  const handleSendToRecycleBin = useCallback(async () => {
    const idsToSend = selectedSnippetIds.size > 0 
      ? Array.from(selectedSnippetIds) 
      : matchingSnippetIds;
    if (idsToSend.length === 0) return;

    setIsSendingToRecycle(true);
    try {
      const res = await fetch('/api/records/recycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: idsToSend })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const count = data.count || idsToSend.length;
      
      // Remove from active records list
      setRecords(prev => prev.filter(r => !idsToSend.includes(r.id)));
      setSelectedSnippetIds(new Set());
      await fetchRecycledCount();

      showToast(
        `Sent ${count} snippet${count > 1 ? 's' : ''} to Recycled Bin to clean dashboard.`,
        'success',
        {
          label: 'Undo',
          onClick: async () => {
            await handleRestoreRecords(idsToSend);
          }
        }
      );
    } catch (err: any) {
      showToast(`Failed to send to recycled bin: ${err.message}`, 'error');
    } finally {
      setIsSendingToRecycle(false);
    }
  }, [selectedSnippetIds, matchingSnippetIds, fetchRecycledCount, handleRestoreRecords, showToast]);

  // Permanently delete individual records from recycled bin
  const handlePermanentDelete = useCallback(async (ids: string[]) => {
    try {
      for (const id of ids) {
        await fetch(`/api/records/${id}`, { method: 'DELETE' });
      }
      await fetchRecycledCount();
      showToast(`Permanently deleted snippet.`, 'info');
    } catch (err: any) {
      showToast(`Failed to delete snippet: ${err.message}`, 'error');
    }
  }, [fetchRecycledCount, showToast]);

  // Permanently empty recycled bin
  const handleEmptyRecycleBin = useCallback(async () => {
    try {
      const res = await fetch('/api/records/recycled', { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchRecycledCount();
      showToast(`Recycled Bin has been emptied.`, 'info');
    } catch (err: any) {
      showToast(`Failed to empty recycled bin: ${err.message}`, 'error');
    }
  }, [fetchRecycledCount, showToast]);

  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-stone-950 text-slate-900 flex flex-col font-sans selection:bg-slate-200">
      
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-white shadow-2xl animate-fade-in max-w-md">
          {toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span className="flex-1">{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              onClick={() => {
                toast.action?.onClick();
                setToast(null);
              }}
              className="px-2.5 py-1 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] cursor-pointer transition shadow-2xs shrink-0"
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}

      {/* Top Header */}
      <Header
        siteName={siteSettings.siteName}
        tagline={siteSettings.tagline}
        currentUser={currentUser}
        onOpenExtensionDrawer={() => handleOpenExtensionDrawer('download')}
        onOpenAdmin={() => setIsAdminOpen(true)}
        onOpenAuth={() => setIsAuthOpen(true)}
        onLogout={async () => {
          await logoutUser();
          showToast('Signed out successfully', 'info');
        }}
        onExportJson={handleExportJsonArchive}
        onOpenImportJson={() => handleOpenImportModal()}
        onLogoClick={handleBackToTimeline}
        onOpenClearSession={() => setIsClearSessionModalOpen(true)}
        recycledCount={recycledCount}
        onOpenRecycledBin={() => setIsRecycledBinOpen(true)}
        onOpenTopContent={() => handleSelectSubmenu('top-content')}
        currentTheme={siteSettings.theme}
        onToggleTheme={handleToggleTheme}
      />

      {/* Anon Mode Notification Banner */}
      {isAnonMode && (
        <div id="anon-mode-top-banner" className="bg-amber-500/10 border-b border-amber-500/25 px-4 py-2 text-xs text-amber-800 dark:text-amber-200">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <EyeOff className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 animate-pulse" />
              <span>
                <strong className="font-semibold">Anon Mode Active:</strong> No snippets are being stored or synchronized to the database or JSON files.
              </span>
            </div>
            <button
              id="anon-mode-banner-turn-off-btn"
              onClick={handleToggleAnonMode}
              className="text-xs text-amber-700 dark:text-amber-300 hover:underline font-semibold cursor-pointer shrink-0"
            >
              Turn Off
            </button>
          </div>
        </div>
      )}

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
                  SoroTrack local disk storage is actively safeguarding all records without data loss. Direct cloud writes will automatically resume when Google Cloud resets the daily quota tomorrow.
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

        {/* Submenu Navigation Bar */}
        <div id="app-submenu-bar" className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-850 p-2 sm:p-2.5 rounded-2xl shadow-2xs">
          <nav className="flex items-center gap-1.5 overflow-x-auto">
            <button
              id="submenu-timeline-tab"
              type="button"
              onClick={() => handleSelectSubmenu('timeline')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                activeSubmenu === 'timeline' && !activeCategoryPageId
                  ? 'bg-slate-900 text-white font-semibold shadow-2xs dark:bg-white dark:text-stone-900'
                  : 'text-slate-600 dark:text-stone-400 hover:bg-slate-100 dark:hover:bg-stone-800 hover:text-slate-900 dark:hover:text-stone-200'
              }`}
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span>Timeline</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                activeSubmenu === 'timeline' && !activeCategoryPageId
                  ? 'bg-slate-800 dark:bg-stone-200 text-slate-200 dark:text-stone-800'
                  : 'bg-slate-100 dark:bg-stone-800 text-slate-500 dark:text-stone-400'
              }`}>
                {records.length}
              </span>
            </button>

            <button
              id="submenu-trend-tab"
              type="button"
              onClick={() => handleSelectSubmenu('trend')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                activeSubmenu === 'trend'
                  ? 'bg-emerald-600 text-white font-semibold shadow-2xs'
                  : 'text-slate-600 dark:text-stone-400 hover:bg-slate-100 dark:hover:bg-stone-800 hover:text-slate-900 dark:hover:text-stone-200'
              }`}
            >
              <TrendingUp className={`w-3.5 h-3.5 ${activeSubmenu === 'trend' ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`} />
              <span>Trend & Weekly Activity</span>
            </button>

            <button
              id="submenu-top-content-tab"
              type="button"
              onClick={() => handleSelectSubmenu('top-content')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                activeSubmenu === 'top-content'
                  ? 'bg-blue-600 text-white font-semibold shadow-2xs'
                  : 'text-slate-600 dark:text-stone-400 hover:bg-slate-100 dark:hover:bg-stone-800 hover:text-slate-900 dark:hover:text-stone-200'
              }`}
            >
              <Bot className={`w-3.5 h-3.5 ${activeSubmenu === 'top-content' ? 'text-white' : 'text-blue-600 dark:text-blue-400'}`} />
              <span>Top Content</span>
              {topContentItems.length > 0 && (
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                  activeSubmenu === 'top-content' ? 'bg-blue-700 text-white' : 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300'
                }`}>
                  {topContentItems.length}
                </span>
              )}
            </button>

            <button
              id="submenu-readlater-tab"
              type="button"
              onClick={() => handleSelectSubmenu('read-later')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                activeSubmenu === 'read-later'
                  ? 'bg-amber-500 text-white font-semibold shadow-2xs'
                  : 'text-slate-600 dark:text-stone-400 hover:bg-slate-100 dark:hover:bg-stone-800 hover:text-slate-900 dark:hover:text-stone-200'
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${activeSubmenu === 'read-later' || toReadSnippetIds.length > 0 ? 'fill-current text-amber-300' : ''}`} />
              <span>Read Later</span>
              {toReadSnippetIds.length > 0 && (
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                  activeSubmenu === 'read-later' ? 'bg-amber-600 text-white' : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                }`}>
                  {toReadSnippetIds.length}
                </span>
              )}
            </button>

            {recycledCount > 0 && (
              <button
                id="submenu-recycled-bin-tab"
                type="button"
                onClick={() => setIsRecycledBinOpen(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                title={`Recycled Bin (${recycledCount} items)`}
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                <span>Recycled Bin</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300">
                  {recycledCount}
                </span>
              </button>
            )}
          </nav>

          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-stone-400 px-2 self-end sm:self-center">
            <span className="font-mono text-[11px]">{records.length} items collected</span>
          </div>
        </div>

        {/* Main Content Layout: Top Content View, Dedicated Trend Submenu, Dedicated Category Page, or Timeline View */}
        {activeSubmenu === 'top-content' ? (
          <TopContentView
            items={topContentItems}
            agentStatus={agentStatus}
            isLoading={isLoadingAgent}
            onRunAgent={handleRunAgent}
            onSaveToTimeline={handleSaveToTimeline}
            onToggleReadLater={handleToggleReadLater}
            isReadLater={(id) => toReadSnippetIds.includes(id)}
          />
        ) : activeSubmenu === 'trend' ? (
          <TrendView
            records={records}
            summary={summary}
            isLoading={isSummarizing}
            onRefresh={() => handleGenerateSummary(true)}
            onAskQuestion={handleAskQuestion}
            onBackToTimeline={handleBackToTimeline}
            topicClusters={topicClusters}
            onSelectCluster={(cluster) => {
              handleSelectCluster(cluster);
              setActiveSubmenu('timeline');
            }}
          />
        ) : currentCategoryPage ? (
          <DedicatedCategoryPage
            category={currentCategoryPage}
            allCategories={topicClusters}
            onSelectCategory={(cat) => {
              setActiveCategoryPageId(cat.id);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onBackToTimeline={handleBackToTimeline}
            records={records}
            onDeleteRecord={handleDeleteRecord}
            onSelectAuthor={(handle) => setSelectedAuthor(handle)}
            onSelectCategoryFilter={handleSelectCategory}
            readSnippetIds={readSnippetIds}
            onToggleRead={handleToggleReadSnippet}
            toReadSnippetIds={toReadSnippetIds}
            onToggleReadLater={handleToggleReadLater}
            initialSubTopic={selectedSubTopic}
            fontSize={readerFontSize}
          />
        ) : (
          <div className="flex flex-col lg:flex-row items-start gap-6">

          {/* Left Column: Timeline View with FilterBar, Search & Records */}
          <div className="flex-1 min-w-0 w-full">
            {/* Filter Bar with All Search, Filters, View Modes, and Sort Options */}
            <FilterBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              selectedDomain={selectedDomain}
              onDomainChange={setSelectedDomain}
              availableDomains={availableDomains}
              selectedAuthor={selectedAuthor}
              onAuthorChange={setSelectedAuthor}
              selectedCluster={selectedCluster}
              onClearCluster={() => handleSelectCluster(null)}
              selectedTopic={selectedTopic}
              onClearTopic={handleClearTopicFilter}
              selectedSubTopic={selectedSubTopic}
              onClearSubTopic={() => handleSelectSubTopic(null)}
              selectedCategory={selectedCategory}
              onCategoryChange={handleSelectCategory}
              categoryCounts={categoryCounts}
              categories={siteSettings?.customCategories || ALL_CATEGORY_OPTIONS}
              hasLinksOnly={hasLinksOnly}
              onToggleHasLinks={() => setHasLinksOnly(prev => !prev)}
              hasMediaOnly={hasMediaOnly}
              onToggleHasMedia={() => setHasMediaOnly(prev => !prev)}
              sortBy={sortBy}
              onSortChange={setSortBy}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              fontSize={readerFontSize}
              onFontSizeChange={handleFontSizeChange}
              availableAuthors={availableAuthors}
              totalCount={stats.totalArchived || records.length}
              filteredCount={displayedRecords.length}
              isFilterSectionOpen={isFilterSectionOpen}
              onToggleFilterSection={() => setIsFilterSectionOpen(prev => !prev)}
              activeContentFilterCount={activeContentFilters.length}
              onClearFilters={handleClearFilters}
              isReadLaterOnly={isReadLaterOnly}
              onToggleReadLaterOnly={() => setIsReadLaterOnly(prev => !prev)}
              toReadCount={toReadSnippetIds.length}
              isAiBriefingOpen={activeSubmenu === 'trend'}
              onToggleAiBriefing={handleToggleTrendSubmenu}
            />

            {/* Expandable Content Filter Section when opened */}
            {isFilterSectionOpen && (
              <div className="mb-4">
                <ContentFilterSection
                  isOpen={isFilterSectionOpen}
                  onClose={() => setIsFilterSectionOpen(false)}
                  activeFilters={activeContentFilters}
                  onToggleFilter={handleToggleContentFilter}
                  onSetAllFilters={setActiveContentFilters}
                  onClearFilters={() => setActiveContentFilters([])}
                  categoryCounts={categoryCounts}
                  totalFilteredCount={contentFilteredOutRecords.length}
                />
              </div>
            )}

            {/* In-feed Active Search Banner when search is active */}
            {debouncedSearchQuery.trim() !== '' && (
              <div className="mb-5 p-3.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs shadow-2xs animate-fade-in">
                <div className="flex items-center gap-2 flex-wrap">
                  <Search className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-slate-600">
                    Search results for <strong className="text-slate-900 font-mono">"{debouncedSearchQuery}"</strong>
                  </span>
                  <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
                    {displayedRecords.length} {displayedRecords.length === 1 ? 'match' : 'matches'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 underline font-medium cursor-pointer"
                >
                  <X className="w-3 h-3" />
                  <span>Clear search</span>
                </button>
              </div>
            )}

            {/* Active topic or filter chips if any are selected */}
            {(selectedCluster || selectedSubTopic || selectedCategory || selectedDomain || selectedAuthor || hasLinksOnly || hasMediaOnly || isReadLaterOnly) && (
              <div className="mb-4 p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs shadow-2xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-slate-500 font-medium">Filtered by:</span>
                  {isReadLaterOnly && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 font-semibold">
                      <Bookmark className="w-3 h-3 text-amber-600 fill-amber-500" />
                      Read Later ({toReadSnippetIds.length})
                      <button onClick={() => setIsReadLaterOnly(false)} className="hover:text-rose-600 cursor-pointer" title="Exit Read Later view"><X className="w-3 h-3" /></button>
                    </span>
                  )}
                  {selectedCluster && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 font-medium">
                      Cluster: {selectedCluster.name}
                      <button onClick={() => handleSelectCluster(null)} className="hover:text-rose-600 cursor-pointer"><X className="w-3 h-3" /></button>
                    </span>
                  )}
                  {selectedSubTopic && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 font-medium">
                      Topic: {selectedSubTopic.label}
                      <button onClick={() => handleSelectSubTopic(null)} className="hover:text-rose-600 cursor-pointer"><X className="w-3 h-3" /></button>
                    </span>
                  )}
                  {selectedCategory && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 font-medium">
                      Category: {selectedCategory}
                      <button onClick={() => setSelectedCategory(null)} className="hover:text-rose-600 cursor-pointer"><X className="w-3 h-3" /></button>
                    </span>
                  )}
                  {selectedDomain && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 font-medium">
                      <Globe className="w-3 h-3 text-slate-600" />
                      Domain: {selectedDomain}
                      <button onClick={() => setSelectedDomain('')} className="hover:text-rose-600 cursor-pointer"><X className="w-3 h-3" /></button>
                    </span>
                  )}
                  {selectedAuthor && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 font-medium">
                      Author: {selectedAuthor}
                      <button onClick={() => setSelectedAuthor('')} className="hover:text-rose-600 cursor-pointer"><X className="w-3 h-3" /></button>
                    </span>
                  )}
                  {hasLinksOnly && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 font-medium">
                      Has Links
                      <button onClick={() => setHasLinksOnly(false)} className="hover:text-rose-600 cursor-pointer"><X className="w-3 h-3" /></button>
                    </span>
                  )}
                  {hasMediaOnly && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 font-medium">
                      Has Media
                      <button onClick={() => setHasMediaOnly(false)} className="hover:text-rose-600 cursor-pointer"><X className="w-3 h-3" /></button>
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="text-xs text-slate-500 hover:text-slate-900 underline shrink-0 cursor-pointer"
                >
                  Clear filters
                </button>
              </div>
            )}

            {/* Clean Dashboard Toolbar: Shown when user filters by authors, domains, or labels */}
            {isCleanDashboardFilterActive && displayedRecords.length > 0 && (
              <CleanDashboardBar
                totalMatching={displayedRecords.length}
                selectedCount={selectedCount}
                isAllSelected={isAllSelected}
                onToggleSelectAll={handleToggleSelectAll}
                onSendToRecycleBin={handleSendToRecycleBin}
                onClearSelection={handleClearSelection}
                activeFilterSummary={activeFilterSummary}
                recycledCount={recycledCount}
                onOpenRecycledBin={() => setIsRecycledBinOpen(true)}
                isSending={isSendingToRecycle}
              />
            )}

            {/* Records Content Area */}
        {isLoadingRecords && records.length === 0 ? (
          <div className="p-12 text-center text-stone-500 bg-white border border-[#E5E2DA] rounded-2xl shadow-2xs">
            <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-800 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs font-mono text-stone-600">Loading archived posts...</p>
          </div>
        ) : records.length === 0 ? (
          <div className="bg-white border border-[#E5E2DA] rounded-2xl p-8 text-center max-w-md mx-auto my-6 shadow-2xs">
            <div className="w-12 h-12 rounded-full bg-stone-100 text-stone-600 flex items-center justify-center mx-auto mb-3 border border-stone-200">
              <Inbox className="w-6 h-6" />
            </div>
            <h3 className="text-base font-serif font-bold text-stone-900 mb-1">
              No Archived Posts Yet
            </h3>
            <p className="text-xs text-stone-600 mb-4 leading-relaxed font-sans">
              Use the browser extension to archive posts or import a JSON export to explore your reading list and topic clusters.
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => handleOpenExtensionDrawer('download')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-stone-900 hover:bg-black text-white text-xs font-mono uppercase tracking-wider transition cursor-pointer"
              >
                <Puzzle className="w-3.5 h-3.5 text-amber-300" />
                <span>Get Extension</span>
              </button>
              <button
                type="button"
                onClick={() => handleOpenImportModal()}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white hover:bg-stone-50 border border-[#DDD7CC] text-stone-800 text-xs font-mono uppercase tracking-wider transition cursor-pointer"
              >
                <span>Import JSON</span>
              </button>
            </div>
          </div>
        ) : displayedRecords.length === 0 ? (
          /* Empty state for the current tab (Active or Caught Up or Filtered Out) */
          activeContentFilters.length > 0 && contentFilteredOutRecords.length > 0 && cleanedRecords.length === 0 ? (
            <div className="bg-white border border-[#E5E2DA] rounded-2xl p-8 text-center max-w-md mx-auto my-6 shadow-2xs">
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto mb-3 border border-amber-300">
                <SlidersHorizontal className="w-6 h-6" />
              </div>
              <h3 className="text-base font-serif font-bold text-stone-900 mb-1">
                Timeline Fully Cleaned Up
              </h3>
              <p className="text-xs text-stone-600 mb-4 leading-relaxed font-sans">
                All {records.length} archived posts match your active content filters. Reset filters to view all posts.
              </p>
              <button
                onClick={() => {
                  setActiveContentFilters([]);
                  showToast('Restored all filtered posts to timeline', 'info');
                }}
                className="px-3.5 py-1.5 rounded-lg bg-[#1A1A1A] hover:bg-black text-white text-xs font-medium transition cursor-pointer"
              >
                Reset Content Filters
              </button>
            </div>
          ) : isReadLaterOnly ? (
            <div className="bg-white border border-[#E5E2DA] rounded-2xl p-8 text-center max-w-md mx-auto my-6 shadow-2xs">
              <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3 border border-amber-200">
                <Bookmark className="w-6 h-6" />
              </div>
              <h3 className="text-base font-serif font-bold text-stone-900 mb-1">
                Your Read Later List is Empty
              </h3>
              <p className="text-xs text-stone-600 mb-4 leading-relaxed font-sans">
                Click the "Read Later" button on any snippet in your archive to save it to your reading list.
              </p>
              <button
                onClick={() => setIsReadLaterOnly(false)}
                className="px-3.5 py-1.5 rounded-lg bg-[#1A1A1A] hover:bg-black text-white text-xs font-medium transition cursor-pointer"
              >
                Browse All Snippets
              </button>
            </div>
          ) : (searchQuery || selectedAuthor || selectedTopic || selectedCluster || selectedSubTopic || selectedCategory) ? (
            <div className="bg-white border border-[#E5E2DA] rounded-2xl p-8 text-center max-w-md mx-auto my-6 shadow-2xs">
              <div className="w-12 h-12 rounded-full bg-stone-100 text-stone-600 flex items-center justify-center mx-auto mb-3 border border-stone-200">
                <RotateCcw className="w-6 h-6" />
              </div>
              <h3 className="text-base font-serif font-bold text-stone-900 mb-1">
                No Matching Posts
              </h3>
              <p className="text-xs text-stone-600 mb-4 leading-relaxed font-sans">
                No archived posts match your active search or filter criteria.
              </p>
              <button
                onClick={handleClearFilters}
                className="px-3.5 py-1.5 rounded-lg bg-[#1A1A1A] hover:bg-black text-white text-xs font-medium transition cursor-pointer"
              >
                Clear All Filters
              </button>
            </div>
          ) : (
            <div className="bg-white border border-[#E5E2DA] rounded-2xl p-8 text-center max-w-md mx-auto my-6 shadow-2xs">
              <p className="text-xs text-stone-500 font-sans">
                No posts to display in this feed.
              </p>
            </div>
          )
        ) : viewMode === 'compact' ? (
          /* Compact List View */
          <div className="space-y-2.5">
            {visibleRecords.map(record => (
              <RecordCard
                key={record.id}
                record={record}
                onDelete={handleDeleteRecord}
                onSelectAuthor={handleSelectAuthor}
                onSelectCategory={handleSelectCategory}
                compact={true}
                fontSize={readerFontSize}
                isRead={readSnippetSet.has(record.id)}
                onToggleRead={handleToggleReadSnippet}
                isReadLater={toReadSnippetSet.has(record.id)}
                onToggleReadLater={handleToggleReadLater}
                selectable={isCleanDashboardFilterActive}
                isSelected={selectedSnippetIds.has(record.id)}
                onToggleSelect={handleToggleSelectSnippet}
              />
            ))}
          </div>
        ) : (
          /* Default Grid Cards View */
          <div className={`grid grid-cols-1 md:grid-cols-2 ${isTopicsSidebarOpen ? 'xl:grid-cols-2 2xl:grid-cols-3' : 'lg:grid-cols-3'} gap-4`}>
            {visibleRecords.map(record => (
              <RecordCard
                key={record.id}
                record={record}
                onDelete={handleDeleteRecord}
                onSelectAuthor={handleSelectAuthor}
                onSelectCategory={handleSelectCategory}
                compact={false}
                fontSize={readerFontSize}
                isRead={readSnippetSet.has(record.id)}
                onToggleRead={handleToggleReadSnippet}
                isReadLater={toReadSnippetSet.has(record.id)}
                onToggleReadLater={handleToggleReadLater}
                selectable={isCleanDashboardFilterActive}
                isSelected={selectedSnippetIds.has(record.id)}
                onToggleSelect={handleToggleSelectSnippet}
              />
            ))}
          </div>
        )}

        {/* Infinite Scroll Sentinel & Pagination Status */}
        {displayedRecords.length > 0 && (
          visibleCount < displayedRecords.length ? (
            <div ref={loadMoreSentinelRef} className="py-8 flex flex-col items-center justify-center gap-2">
              <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-xl bg-white border border-slate-200 shadow-2xs text-xs font-mono text-slate-600">
                <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin" />
                <span>Loading more snippets ({visibleRecords.length} of {displayedRecords.length})...</span>
              </div>
            </div>
          ) : displayedRecords.length > 25 ? (
            <div className="py-6 text-center text-xs font-mono text-slate-500 border-t border-slate-200 mt-6">
              <span>All {displayedRecords.length} snippets loaded</span>
            </div>
          ) : null
        )}

          </div>

          {/* Right Column: Topics Sidebar (Expanded or Minimized Symbol) */}
          <TopicsSidebar
            clusters={topicClusters}
            selectedCluster={selectedCluster}
            onSelectCluster={handleSelectCluster}
            selectedSubTopic={selectedSubTopic}
            onSelectSubTopic={handleSelectSubTopic}
            onNavigateToCategoryPage={handleNavigateToCategoryPage}
            isOpen={isTopicsSidebarOpen}
            onToggleOpen={() => setIsTopicsSidebarOpen(prev => !prev)}
            onClose={() => setIsTopicsSidebarOpen(false)}
            onOpen={() => setIsTopicsSidebarOpen(true)}
            archiveSearchQuery={searchQuery}
            onArchiveSearchChange={setSearchQuery}
            onArchiveSearchSubmit={(q) => setSearchQuery(q)}
          />

        </div>
        )}

      </main>

      {/* Website Footer with customizable content and branding */}
      <Footer
        settings={siteSettings}
        currentUser={currentUser}
        onOpenAdmin={() => setIsAdminOpen(true)}
        onOpenExtensionDrawer={() => handleOpenExtensionDrawer('setup')}
        onExportJson={handleExportJsonArchive}
        onImportJson={() => handleOpenImportModal()}
      />

      {/* Extension Slide-Over Right Drawer (Download, Setup & Import/Export) */}
      <ExtensionDrawer
        isOpen={isExtensionDrawerOpen}
        onClose={() => setIsExtensionDrawerOpen(false)}
        defaultTab={extensionDrawerTab}
        onOpenAdmin={() => setIsAdminOpen(true)}
        onExportJson={handleExportJsonArchive}
        onOpenImportJson={handleOpenImportModal}
      />

      {/* Admin Panel Control Center */}
      <AdminPanel
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        currentUser={currentUser}
        settings={siteSettings}
        onUpdateSettings={handleUpdateSettings}
        onThemeChange={handleThemeChange}
      />

      {/* User Login & Registration Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={(user) => {
          setCurrentUser(user);
          showToast(`Welcome back, ${user.displayName || user.email}!`, 'success');
        }}
      />

      {/* Direct JSON Import from Extension or Backup Modal */}
      <ImportJsonModal
        isOpen={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false);
          setImportInitialFile(null);
        }}
        existingRecords={records}
        onImportSuccess={handleImportSuccess}
        initialFile={importInitialFile}
      />

      {/* Clear Session Modal */}
      <ClearSessionModal
        isOpen={isClearSessionModalOpen}
        onClose={() => setIsClearSessionModalOpen(false)}
        activeSnippetCount={records.length}
        onClearSessionView={handleClearSessionView}
        onClearSessionStorage={handleClearSessionStorage}
        onClearAllStorage={handleClearAllStorage}
      />

      {/* Recycled Bin Modal */}
      <RecycledBinModal
        isOpen={isRecycledBinOpen}
        onClose={() => setIsRecycledBinOpen(false)}
        onRestoreRecords={handleRestoreRecords}
        onPermanentDelete={handlePermanentDelete}
        onEmptyBin={handleEmptyRecycleBin}
      />

      {/* Floating Scroll to Top Button */}
      {showScrollToTop && (
        <button
          id="scroll-to-top-btn"
          type="button"
          onClick={scrollToTop}
          aria-label="Scroll back to top"
          className="fixed bottom-6 right-6 z-40 p-3 rounded-full bg-white hover:bg-slate-100 text-slate-700 shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center border border-slate-300"
          title="Back to Top"
        >
          <ArrowUp className="w-4 h-4 text-slate-700" />
        </button>
      )}

    </div>
  );
}
