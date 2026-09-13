import React, { useState } from 'react';
import { 
  X, 
  Trash2, 
  AlertTriangle, 
  RefreshCw, 
  Database, 
  Sparkles, 
  EyeOff 
} from 'lucide-react';

interface ClearSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSnippetCount: number;
  onClearSessionView: () => void;
  onClearSessionStorage: () => Promise<void>;
  onClearAllStorage: () => Promise<void>;
}

export const ClearSessionModal: React.FC<ClearSessionModalProps> = ({
  isOpen,
  onClose,
  activeSnippetCount,
  onClearSessionView,
  onClearSessionStorage,
  onClearAllStorage
}) => {
  const [selectedOption, setSelectedOption] = useState<'view' | 'session_storage' | 'all'>('view');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleExecute = async () => {
    setIsProcessing(true);
    try {
      if (selectedOption === 'view') {
        onClearSessionView();
        onClose();
      } else if (selectedOption === 'session_storage') {
        await onClearSessionStorage();
        onClose();
      } else if (selectedOption === 'all') {
        await onClearAllStorage();
        onClose();
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div 
      id="clear-session-modal-overlay" 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div 
        id="clear-session-modal"
        className="bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-stone-800 bg-slate-50/50 dark:bg-stone-850/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-stone-100 font-sans">
                Clear Session Snippets
              </h2>
              <p className="text-xs text-slate-500 dark:text-stone-400 font-sans">
                {activeSnippetCount} snippet{activeSnippetCount !== 1 ? 's' : ''} currently loaded in session
              </p>
            </div>
          </div>
          <button
            id="clear-session-close-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-stone-300 hover:bg-slate-100 dark:hover:bg-stone-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-600 dark:text-stone-300 font-sans leading-relaxed">
            Select an option to clear snippets stored in your current session:
          </p>

          <div className="space-y-3">
            {/* Option 1: Clear Session View */}
            <label 
              className={`flex items-start gap-3 p-3.5 rounded-xl border transition cursor-pointer ${
                selectedOption === 'view'
                  ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20 ring-1 ring-indigo-500'
                  : 'border-slate-200 dark:border-stone-800 hover:bg-slate-50 dark:hover:bg-stone-850'
              }`}
            >
              <input
                type="radio"
                name="clear-option"
                checked={selectedOption === 'view'}
                onChange={() => setSelectedOption('view')}
                className="mt-1 text-indigo-600 focus:ring-indigo-500"
              />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-xs font-semibold text-slate-900 dark:text-stone-100">
                    Clear Active Session View
                  </span>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-stone-800 text-slate-600 dark:text-stone-400">
                    Recommended
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-stone-400 leading-normal">
                  Resets the current browser session view and active filters. Stored database archives remain intact.
                </p>
              </div>
            </label>

            {/* Option 2: Clear Session Stored Snippets */}
            <label 
              className={`flex items-start gap-3 p-3.5 rounded-xl border transition cursor-pointer ${
                selectedOption === 'session_storage'
                  ? 'border-amber-500 bg-amber-50/40 dark:bg-amber-950/20 ring-1 ring-amber-500'
                  : 'border-slate-200 dark:border-stone-800 hover:bg-slate-50 dark:hover:bg-stone-850'
              }`}
            >
              <input
                type="radio"
                name="clear-option"
                checked={selectedOption === 'session_storage'}
                onChange={() => setSelectedOption('session_storage')}
                className="mt-1 text-amber-600 focus:ring-amber-500"
              />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <EyeOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-semibold text-slate-900 dark:text-stone-100">
                    Clear Session Buffer & Extension Cache
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-stone-400 leading-normal">
                  Clears the local session buffer, in-memory snippets, and extension JSON temporary store.
                </p>
              </div>
            </label>

            {/* Option 3: Complete Archive Wipe */}
            <label 
              className={`flex items-start gap-3 p-3.5 rounded-xl border transition cursor-pointer ${
                selectedOption === 'all'
                  ? 'border-red-500 bg-red-50/40 dark:bg-red-950/20 ring-1 ring-red-500'
                  : 'border-slate-200 dark:border-stone-800 hover:bg-slate-50 dark:hover:bg-stone-850'
              }`}
            >
              <input
                type="radio"
                name="clear-option"
                checked={selectedOption === 'all'}
                onChange={() => setSelectedOption('all')}
                className="mt-1 text-red-600 focus:ring-red-500"
              />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                  <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                    Permanently Delete All Stored Snippets
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-stone-400 leading-normal">
                  Permanently deletes all archived snippets from both local disk and Google Cloud Firestore.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-stone-850 border-t border-slate-100 dark:border-stone-800 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-stone-400 hover:bg-slate-200 dark:hover:bg-stone-800 rounded-lg transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            id="clear-session-confirm-btn"
            type="button"
            onClick={handleExecute}
            disabled={isProcessing}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white rounded-lg transition cursor-pointer shadow-xs ${
              selectedOption === 'all' 
                ? 'bg-red-600 hover:bg-red-700' 
                : selectedOption === 'session_storage'
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Clearing...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Clear</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
