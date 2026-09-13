import React, { useState, useRef, useCallback } from 'react';
import { 
  X, 
  Upload, 
  FileCode, 
  CheckCircle2, 
  AlertTriangle, 
  Layers, 
  ArrowRight, 
  ExternalLink,
  Tag,
  Globe,
  Loader2,
  ChevronDown,
  ChevronUp,
  Sparkles
} from 'lucide-react';
import { XHistoryRecord } from '../types';
import { getSnippetLabels } from '../lib/contentFilter';

interface ImportJsonModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingRecords: XHistoryRecord[];
  onImportSuccess: (importedCount: number, duplicatesCount: number) => void;
  initialFile?: File | null;
}

interface AnalyzedDuplicate {
  record: any;
  reason: string;
  matchedId?: string;
  matchedUrl?: string;
}

export const ImportJsonModal: React.FC<ImportJsonModalProps> = ({
  isOpen,
  onClose,
  existingRecords,
  onImportSuccess,
  initialFile = null
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(initialFile);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Analysis state
  const [rawCount, setRawCount] = useState<number>(0);
  const [uniqueRecords, setUniqueRecords] = useState<XHistoryRecord[]>([]);
  const [duplicates, setDuplicates] = useState<AnalyzedDuplicate[]>([]);
  const [showDuplicateList, setShowDuplicateList] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Normalizer for various JSON exports
  const normalizeRecords = useCallback((inputData: any): XHistoryRecord[] => {
    let list: any[] = [];
    if (Array.isArray(inputData)) {
      list = inputData;
    } else if (inputData && typeof inputData === 'object') {
      if (Array.isArray(inputData.records)) list = inputData.records;
      else if (Array.isArray(inputData.bookmarks)) list = inputData.bookmarks;
      else if (Array.isArray(inputData.tweets)) list = inputData.tweets;
      else if (Array.isArray(inputData.data)) list = inputData.data;
      else if (Array.isArray(inputData.items)) list = inputData.items;
      else if (inputData.id || inputData.text || inputData.tweetUrl) list = [inputData];
    }

    const validRecords: XHistoryRecord[] = [];
    const nowIso = new Date().toISOString();

    for (let i = 0; i < list.length; i++) {
      const raw = list[i];
      if (!raw || typeof raw !== 'object') continue;

      const item = raw.tweet ? raw.tweet : raw;

      let id = item.id || item.id_str || item.tweetId || item.tweet_id;
      if (!id && typeof item.tweetUrl === 'string') {
        const match = item.tweetUrl.match(/status\/(\d+)/);
        if (match) id = match[1];
      }
      if (!id && typeof item.url === 'string') {
        const match = item.url.match(/status\/(\d+)/);
        if (match) id = match[1];
      }
      if (!id) {
        const textSeed = (item.text || item.full_text || item.title || '') + (item.createdAt || item.created_at || '');
        if (!textSeed.trim()) continue;
        let hash = 0;
        for (let c = 0; c < textSeed.length; c++) {
          hash = (hash << 5) - hash + textSeed.charCodeAt(c);
          hash |= 0;
        }
        id = 'imp_' + Math.abs(hash).toString(36);
      }
      id = String(id);

      const text = (item.text || item.full_text || item.body || item.title || '').trim();
      if (!text && !item.tweetUrl && !item.url) continue;

      let tweetUrl = item.tweetUrl || item.url || '';
      if (!tweetUrl && /^\d+$/.test(id)) {
        const cleanHandle = item.authorHandle ? item.authorHandle.replace(/^@/, '') : 'i';
        tweetUrl = `https://x.com/${cleanHandle}/status/${id}`;
      }

      let authorName = item.authorName || item.author || item.user?.name || 'X User';
      let authorHandle = item.authorHandle || (item.user?.screen_name ? `@${item.user.screen_name}` : '@x_user');
      if (!authorHandle.startsWith('@')) authorHandle = `@${authorHandle}`;
      let authorAvatarUrl = item.authorAvatarUrl || item.authorAvatar || item.user?.profile_image_url_https || '';

      let createdAt = item.createdAt || item.created_at || nowIso;
      try {
        const d = new Date(createdAt);
        if (!isNaN(d.getTime())) createdAt = d.toISOString();
      } catch {
        createdAt = nowIso;
      }

      let links: any[] = [];
      if (Array.isArray(item.links)) {
        links = item.links.map((l: any) => {
          if (typeof l === 'string') {
            try {
              const parsed = new URL(l);
              return { url: l, displayUrl: parsed.hostname, domain: parsed.hostname.replace(/^www\./, '') };
            } catch {
              return { url: l, displayUrl: l, domain: 'external' };
            }
          }
          return {
            url: l.url || '',
            displayUrl: l.displayUrl || l.url || '',
            domain: l.domain || (l.url ? new URL(l.url).hostname.replace(/^www\./, '') : ''),
            title: l.title,
            description: l.description
          };
        }).filter((l: any) => l.url);
      } else if (item.entities?.urls && Array.isArray(item.entities.urls)) {
        links = item.entities.urls.map((u: any) => {
          const expanded = u.expanded_url || u.url;
          try {
            const parsed = new URL(expanded);
            return { url: expanded, displayUrl: u.display_url || parsed.hostname, domain: parsed.hostname.replace(/^www\./, '') };
          } catch {
            return { url: expanded, displayUrl: expanded, domain: 'external' };
          }
        });
      }

      let media: any[] = [];
      if (Array.isArray(item.media)) {
        media = item.media;
      } else if (item.extended_entities?.media && Array.isArray(item.extended_entities.media)) {
        media = item.extended_entities.media.map((m: any) => ({
          type: m.type === 'video' ? 'video' : 'image',
          url: m.media_url_https || m.media_url || m.url
        }));
      }

      let metrics = item.metrics || {};
      if (item.favorite_count !== undefined) metrics.likes = item.favorite_count;
      if (item.retweet_count !== undefined) metrics.retweets = item.retweet_count;
      if (item.reply_count !== undefined) metrics.replies = item.reply_count;

      let tags: string[] = Array.isArray(item.tags) ? [...item.tags] : [];
      if (tags.length === 0 && text) {
        const hashtagMatches = text.match(/#[\w\u0080-\uFFFF]+/g);
        if (hashtagMatches) {
          tags = hashtagMatches.map(h => h.replace(/^#/, ''));
        }
      }

      validRecords.push({
        id,
        tweetUrl,
        authorName,
        authorHandle,
        authorAvatarUrl,
        isVerified: Boolean(item.isVerified || item.user?.verified),
        text,
        createdAt,
        scannedAt: item.scannedAt || nowIso,
        syncedAt: item.syncedAt || item.scannedAt || nowIso,
        isBookmarked: Boolean(item.isBookmarked || item.tags?.includes('bookmark')),
        bookmarkedAt: item.bookmarkedAt,
        links,
        media,
        metrics,
        tags,
        labels: item.labels,
        sourcePage: item.sourcePage || 'extension_imported_json'
      });
    }

    return validRecords;
  }, []);

  // Process file and perform duplicate checking
  const processJsonFile = useCallback((file: File) => {
    setSelectedFile(file);
    setIsParsing(true);
    setParseError(null);
    setShowDuplicateList(false);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);
        const normalized = normalizeRecords(parsed);

        if (normalized.length === 0) {
          setParseError('No valid tweet or bookmark records found in this JSON file.');
          setIsParsing(false);
          return;
        }

        setRawCount(normalized.length);

        // Build existing lookup tables
        const existingIds = new Set(existingRecords.map(r => r.id));
        const existingUrls = new Set<string>();
        existingRecords.forEach(r => {
          if (r.tweetUrl) {
            existingUrls.add(r.tweetUrl.toLowerCase().replace(/\/photo\/\d+/, '').replace(/\/analytics/, '').replace(/\/+$/, ''));
          }
        });

        const foundDuplicates: AnalyzedDuplicate[] = [];
        const nonDuplicates: XHistoryRecord[] = [];
        const seenInFileIds = new Set<string>();

        normalized.forEach(item => {
          const normUrl = item.tweetUrl ? item.tweetUrl.toLowerCase().replace(/\/photo\/\d+/, '').replace(/\/analytics/, '').replace(/\/+$/, '') : '';
          
          if (seenInFileIds.has(item.id)) {
            foundDuplicates.push({
              record: item,
              reason: 'Repeated within this JSON file',
              matchedId: item.id
            });
            return;
          }

          if (existingIds.has(item.id)) {
            foundDuplicates.push({
              record: item,
              reason: 'Already exists in SoroTrack database (Matching ID)',
              matchedId: item.id
            });
            seenInFileIds.add(item.id);
            return;
          }

          if (normUrl && existingUrls.has(normUrl)) {
            foundDuplicates.push({
              record: item,
              reason: 'Already exists in SoroTrack database (Matching Tweet URL)',
              matchedUrl: item.tweetUrl
            });
            seenInFileIds.add(item.id);
            return;
          }

          seenInFileIds.add(item.id);
          nonDuplicates.push(item);
        });

        setDuplicates(foundDuplicates);
        setUniqueRecords(nonDuplicates);
        setIsParsing(false);
      } catch (err: any) {
        setParseError(`JSON Parsing Error: ${err.message || 'Invalid syntax'}`);
        setIsParsing(false);
      }
    };

    reader.onerror = () => {
      setParseError('Failed to read file from disk.');
      setIsParsing(false);
    };

    reader.readAsText(file);
  }, [existingRecords, normalizeRecords]);

  // Initial file check
  React.useEffect(() => {
    if (initialFile && isOpen) {
      processJsonFile(initialFile);
    }
  }, [initialFile, isOpen, processJsonFile]);

  // Reset on open/close
  const handleClose = () => {
    setSelectedFile(null);
    setParseError(null);
    setUniqueRecords([]);
    setDuplicates([]);
    setRawCount(0);
    setIsParsing(false);
    setIsSubmitting(false);
    onClose();
  };

  // Perform backend import & trigger content organization
  const handleConfirmImport = async () => {
    if (uniqueRecords.length === 0) return;

    setIsSubmitting(true);
    setParseError(null);

    try {
      const response = await fetch('/api/import/json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: uniqueRecords })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${response.status}: Failed to import records`);
      }

      const resData = await response.json();
      onImportSuccess(uniqueRecords.length, duplicates.length);
      handleClose();
    } catch (err: any) {
      console.error('[Import Error]', err);
      setParseError(err.message || 'Failed to complete import.');
      setIsSubmitting(false);
    }
  };

  // Drag and drop handlers
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json') {
        setParseError('Please drop a valid .json file.');
        return;
      }
      processJsonFile(file);
    }
  };

  if (!isOpen) return null;

  // Extract organization preview metrics
  const uniqueLabelsCount: Record<string, number> = {};
  const uniqueDomainsCount: Record<string, number> = {};
  let totalExtractedLinks = 0;

  uniqueRecords.forEach(r => {
    const labels = getSnippetLabels(r);
    labels.forEach(l => {
      uniqueLabelsCount[l] = (uniqueLabelsCount[l] || 0) + 1;
    });
    (r.links || []).forEach(link => {
      totalExtractedLinks++;
      if (link.domain) {
        uniqueDomainsCount[link.domain] = (uniqueDomainsCount[link.domain] || 0) + 1;
      }
    });
  });

  const topPreviewDomains = Object.entries(uniqueDomainsCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div 
        id="import-json-modal-card"
        className="relative w-full max-w-2xl bg-white dark:bg-[#0F172A] border border-stone-200 dark:border-stone-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/70 dark:bg-stone-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                Import JSON to SoroTrack
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Directly import & organize archive files from the browser extension
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          
          {/* File Picker / Drop Zone */}
          {!selectedFile ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 ${
                isDragOver 
                  ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20' 
                  : 'border-stone-300 dark:border-stone-700 hover:border-indigo-400 dark:hover:border-indigo-600 bg-stone-50/40 dark:bg-stone-900/20'
              }`}
            >
              <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <FileCode className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-stone-800 dark:text-stone-200">
                  Click to select or drag and drop a JSON file
                </p>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                  Supports SoroTrack export files, Chrome extension local storage JSON, or Twitter bookmark archives
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) processJsonFile(file);
                }}
              />
            </div>
          ) : (
            <div className="flex items-center justify-between p-3.5 bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 rounded-xl">
              <div className="flex items-center gap-3 overflow-hidden">
                <FileCode className="w-5 h-5 text-indigo-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-stone-900 dark:text-stone-100 truncate">
                    {selectedFile.name}
                  </p>
                  <p className="text-[11px] text-stone-500 font-mono">
                    {(selectedFile.size / 1024).toFixed(1)} KB • {rawCount} records detected
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedFile(null);
                  setUniqueRecords([]);
                  setDuplicates([]);
                  setRawCount(0);
                  setParseError(null);
                }}
                disabled={isSubmitting}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium px-2.5 py-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition cursor-pointer"
              >
                Change File
              </button>
            </div>
          )}

          {/* Loading Indicator */}
          {isParsing && (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-stone-500 text-xs">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              <span>Checking for duplicates and analyzing content...</span>
            </div>
          )}

          {/* Parse Error Notification */}
          {parseError && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
              <div className="flex-1">{parseError}</div>
            </div>
          )}

          {/* Duplicate Check Results */}
          {!isParsing && selectedFile && rawCount > 0 && (
            <div className="space-y-4">
              
              {/* Status Comparison Cards */}
              <div className="grid grid-cols-2 gap-3">
                
                {/* Unique Records Card */}
                <div className={`p-4 rounded-xl border transition ${
                  uniqueRecords.length > 0 
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/80 text-emerald-950 dark:text-emerald-200' 
                    : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider font-mono">
                      New Unique Records
                    </span>
                    <CheckCircle2 className={`w-4 h-4 ${uniqueRecords.length > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-400'}`} />
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold font-mono">
                      {uniqueRecords.length}
                    </span>
                    <span className="text-xs text-stone-500">
                      / {rawCount} in file
                    </span>
                  </div>
                  <p className="text-[11px] mt-1 opacity-80">
                    {uniqueRecords.length > 0 
                      ? 'No duplicates found. Ready to organize into feed!' 
                      : 'All items already archived.'}
                  </p>
                </div>

                {/* Duplicates Detected Card */}
                <div className={`p-4 rounded-xl border transition ${
                  duplicates.length > 0 
                    ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/80 text-amber-950 dark:text-amber-200' 
                    : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider font-mono">
                      Duplicates Checked
                    </span>
                    {duplicates.length > 0 ? (
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    )}
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold font-mono">
                      {duplicates.length}
                    </span>
                    <span className="text-xs text-stone-500">
                      skipped
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <p className="text-[11px] opacity-80">
                      {duplicates.length === 0 
                        ? '0 duplicates detected (clean file)' 
                        : 'Identified & protected from re-writing'}
                    </p>
                    {duplicates.length > 0 && (
                      <button
                        onClick={() => setShowDuplicateList(prev => !prev)}
                        className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                      >
                        <span>{showDuplicateList ? 'Hide' : 'Review'}</span>
                        {showDuplicateList ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    )}
                  </div>
                </div>

              </div>

              {/* Collapsible Duplicates Inspection List */}
              {showDuplicateList && duplicates.length > 0 && (
                <div className="p-3.5 bg-stone-100/70 dark:bg-stone-900/90 border border-stone-200 dark:border-stone-800 rounded-xl space-y-2 max-h-48 overflow-y-auto">
                  <div className="text-xs font-semibold text-stone-700 dark:text-stone-300 flex items-center justify-between pb-1 border-b border-stone-200 dark:border-stone-800">
                    <span>Detected Duplicate Posts ({duplicates.length})</span>
                    <span className="text-[10px] text-stone-500 font-mono">Will be skipped to preserve database quota</span>
                  </div>
                  {duplicates.map((dup, idx) => (
                    <div key={idx} className="text-[11px] text-stone-600 dark:text-stone-400 py-1.5 border-b border-stone-200/50 dark:border-stone-800/50 last:border-0">
                      <div className="flex items-center gap-1.5 font-medium text-stone-800 dark:text-stone-200">
                        <span>{dup.record.authorName || dup.record.authorHandle || 'Post'}</span>
                        <span className="text-stone-400 font-mono">({dup.record.id})</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 ml-auto">
                          Duplicate
                        </span>
                      </div>
                      <p className="line-clamp-1 text-stone-500 mt-0.5">
                        {dup.record.text || dup.record.tweetUrl}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Automatic Content Organization Preview (when unique records > 0) */}
              {uniqueRecords.length > 0 && (
                <div className="p-4 bg-stone-50/80 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-stone-900 dark:text-stone-100">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span>Automatic Content Organization Preview</span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {/* Categories Classified */}
                    <div className="p-2.5 bg-white dark:bg-stone-850 rounded-lg border border-stone-200 dark:border-stone-800">
                      <div className="flex items-center gap-1.5 text-stone-600 dark:text-stone-400 font-medium mb-1.5">
                        <Tag className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Identified Snippet Categories</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(uniqueLabelsCount).length > 0 ? (
                          Object.entries(uniqueLabelsCount).slice(0, 4).map(([label, count]) => (
                            <span key={label} className="px-2 py-0.5 rounded text-[10px] bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-mono">
                              {label.replace('_', ' ')} ({count})
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] text-stone-400">Technical posts & discussion</span>
                        )}
                      </div>
                    </div>

                    {/* Extracted Links & Domains */}
                    <div className="p-2.5 bg-white dark:bg-stone-850 rounded-lg border border-stone-200 dark:border-stone-800">
                      <div className="flex items-center gap-1.5 text-stone-600 dark:text-stone-400 font-medium mb-1.5">
                        <Globe className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Extracted Links ({totalExtractedLinks})</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {topPreviewDomains.length > 0 ? (
                          topPreviewDomains.map(([domain, count]) => (
                            <span key={domain} className="px-2 py-0.5 rounded text-[10px] bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-mono">
                              {domain} ({count})
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] text-stone-400">Direct X status references</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-stone-500">
                    Importing will automatically organize these records into the <strong>Executive Summary briefing</strong>, <strong>Canonical Topic Clusters</strong>, <strong>Word Cloud</strong>, and <strong>Link Directory</strong>.
                  </p>
                </div>
              )}

              {/* No unique records info notice */}
              {uniqueRecords.length === 0 && duplicates.length > 0 && (
                <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 text-indigo-900 dark:text-indigo-200 text-xs">
                  <strong>Archive is already complete:</strong> All {duplicates.length} records in this JSON file are already present in your SoroTrack archive. No duplicate entries will be added.
                </div>
              )}

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-900/50 flex items-center justify-between">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-semibold hover:bg-stone-50 dark:hover:bg-stone-750 transition cursor-pointer"
          >
            Cancel
          </button>

          {uniqueRecords.length > 0 ? (
            <button
              type="button"
              id="confirm-import-json-btn"
              onClick={handleConfirmImport}
              disabled={isSubmitting || isParsing}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Organizing & Saving...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>Organize & Import {uniqueRecords.length} Record{uniqueRecords.length > 1 ? 's' : ''}</span>
                </>
              )}
            </button>
          ) : selectedFile && rawCount > 0 ? (
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-lg bg-stone-800 hover:bg-stone-900 text-white text-xs font-semibold transition cursor-pointer"
            >
              Done
            </button>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Choose JSON File</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
