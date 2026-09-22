import React, { useState, useEffect } from 'react';
import { 
  X, 
  Trash2, 
  RotateCcw, 
  AlertTriangle, 
  CheckCircle2, 
  ExternalLink,
  Clock,
  Sparkles,
  Inbox
} from 'lucide-react';
import { XHistoryRecord } from '../types';
import { cleanAuthorDisplayName, formatHandle } from '../lib/tweetFormatter';

interface RecycledBinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreRecords: (ids: string[]) => Promise<void>;
  onPermanentDelete: (ids: string[]) => Promise<void>;
  onEmptyBin: () => Promise<void>;
}

export const RecycledBinModal: React.FC<RecycledBinModalProps> = ({
  isOpen,
  onClose,
  onRestoreRecords,
  onPermanentDelete,
  onEmptyBin
}) => {
  const [recycledRecords, setRecycledRecords] = useState<XHistoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [isConfirmingEmpty, setIsConfirmingEmpty] = useState(false);
  const [isProcessingAll, setIsProcessingAll] = useState(false);

  const fetchRecycled = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/records/recycled');
      if (res.ok) {
        const data = await res.json();
        setRecycledRecords(data.records || []);
      }
    } catch (err) {
      console.error('Failed to load recycled records:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRecycled();
      setIsConfirmingEmpty(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRestoreOne = async (id: string) => {
    setActionLoadingId(id);
    try {
      await onRestoreRecords([id]);
      setRecycledRecords(prev => prev.filter(r => r.id !== id));
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteOne = async (id: string) => {
    setActionLoadingId(id);
    try {
      await onPermanentDelete([id]);
      setRecycledRecords(prev => prev.filter(r => r.id !== id));
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRestoreAll = async () => {
    if (recycledRecords.length === 0) return;
    setIsProcessingAll(true);
    try {
      const allIds = recycledRecords.map(r => r.id);
      await onRestoreRecords(allIds);
      setRecycledRecords([]);
    } finally {
      setIsProcessingAll(false);
    }
  };

  const handleExecuteEmptyBin = async () => {
    setIsProcessingAll(true);
    try {
      await onEmptyBin();
      setRecycledRecords([]);
      setIsConfirmingEmpty(false);
    } finally {
      setIsProcessingAll(false);
    }
  };

  const formatRecycledTime = (isoString?: string) => {
    if (!isoString) return 'Recently';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Recently';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div 
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center border border-rose-200">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 font-sans flex items-center gap-2">
                Recycled Bin
                {recycledRecords.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-rose-100 text-rose-800 border border-rose-200">
                    {recycledRecords.length}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 font-sans">
                Snippets moved here to clean your dashboard. Restore them anytime or empty permanently.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Toolbar if items exist */}
        {recycledRecords.length > 0 && (
          <div className="px-6 py-3 border-b border-slate-200 bg-white flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs font-mono text-slate-600">
              {recycledRecords.length} snippet{recycledRecords.length === 1 ? '' : 's'} in bin
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRestoreAll}
                disabled={isProcessingAll}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-700" />
                <span>Restore All ({recycledRecords.length})</span>
              </button>

              {isConfirmingEmpty ? (
                <div className="flex items-center gap-1.5 animate-fade-in">
                  <span className="text-xs text-rose-700 font-medium">Are you sure?</span>
                  <button
                    type="button"
                    onClick={handleExecuteEmptyBin}
                    disabled={isProcessingAll}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition cursor-pointer disabled:opacity-50 shadow-2xs"
                  >
                    Yes, Empty Bin
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsConfirmingEmpty(false)}
                    className="px-2 py-1.5 rounded-lg text-xs text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsConfirmingEmpty(true)}
                  disabled={isProcessingAll}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-800 border border-rose-200 hover:border-rose-300 transition cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Empty Bin</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {isLoading ? (
            <div className="py-16 text-center text-slate-500">
              <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs font-mono">Loading recycled snippets...</p>
            </div>
          ) : recycledRecords.length === 0 ? (
            <div className="py-16 text-center max-w-sm mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3 border border-slate-200">
                <Inbox className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 mb-1 font-sans">
                Recycled Bin is Empty
              </h3>
              <p className="text-xs text-slate-500 font-sans leading-relaxed">
                When you filter your feed by authors, domains, or labels, you can select snippets and send them here to keep your dashboard clean.
              </p>
            </div>
          ) : (
            recycledRecords.map(record => (
              <div 
                key={record.id}
                className="bg-slate-50/60 border border-slate-200 hover:border-slate-300 rounded-xl p-4 transition flex flex-col sm:flex-row sm:items-start justify-between gap-4 group"
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="font-bold text-slate-900 font-sans">
                      {cleanAuthorDisplayName(record.authorName, record.authorHandle)}
                    </span>
                    <span className="text-slate-500 font-mono text-[11px]">
                      {formatHandle(record.authorHandle)}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      Recycled {formatRecycledTime(record.recycledAt)}
                    </span>
                    {record.labels && record.labels.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-200/70 text-slate-700">
                        {record.labels[0]}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-700 font-sans leading-relaxed line-clamp-3">
                    {record.text}
                  </p>

                  {record.links && record.links.length > 0 && (
                    <div className="flex items-center gap-1.5 text-[11px] text-sky-600 font-mono">
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span className="truncate">{record.links[0].title || record.links[0].domain}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center sm:flex-col gap-2 shrink-0 justify-end">
                  <button
                    type="button"
                    onClick={() => handleRestoreOne(record.id)}
                    disabled={actionLoadingId === record.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition cursor-pointer shadow-2xs disabled:opacity-50"
                    title="Restore snippet to dashboard"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteOne(record.id)}
                    disabled={actionLoadingId === record.id}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-slate-400 hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer disabled:opacity-50"
                    title="Permanently erase this record"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="sm:hidden">Delete</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-slate-400" />
            <span>Recycled snippets are kept safely until you permanently empty the bin.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-900 text-white transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
