import React from 'react';
import { Trash2, Check, Sparkles, RotateCcw, AlertCircle } from 'lucide-react';

interface CleanDashboardBarProps {
  totalMatching: number;
  selectedCount: number;
  isAllSelected: boolean;
  onToggleSelectAll: () => void;
  onSendToRecycleBin: () => void;
  onClearSelection: () => void;
  activeFilterSummary: string;
  recycledCount: number;
  onOpenRecycledBin: () => void;
  isSending?: boolean;
}

export const CleanDashboardBar: React.FC<CleanDashboardBarProps> = ({
  totalMatching,
  selectedCount,
  isAllSelected,
  onToggleSelectAll,
  onSendToRecycleBin,
  onClearSelection,
  activeFilterSummary,
  recycledCount,
  onOpenRecycledBin,
  isSending = false
}) => {
  return (
    <section 
      id="clean-dashboard-bar"
      aria-label="Clean Dashboard and Recycled Bin controls"
      className="mb-4 bg-gradient-to-r from-rose-50/70 via-white to-stone-50 border border-rose-200/90 rounded-2xl p-3.5 sm:p-4 shadow-xs animate-fade-in"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5">
        
        {/* Left Side: Summary & Instructions */}
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center border border-rose-200 shrink-0 mt-0.5">
            <Trash2 className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-900 font-sans tracking-tight">
                Clean Dashboard
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                {activeFilterSummary}
              </span>
              <span className="text-xs text-slate-500 font-mono">
                ({totalMatching} snippet{totalMatching === 1 ? '' : 's'})
              </span>
            </div>
            <p className="text-[11.5px] text-slate-600 font-sans mt-0.5">
              Select all or click individual snippet cards to send them to the recycled bin.
            </p>
          </div>
        </div>

        {/* Right Side: Actions (Select All, Count, Send to Bin) */}
        <div className="flex items-center gap-2 flex-wrap shrink-0 justify-start md:justify-end">
          {/* Select All Checkbox Button */}
          <button
            id="clean-bar-select-all-btn"
            type="button"
            onClick={onToggleSelectAll}
            disabled={totalMatching === 0}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer disabled:opacity-50 ${
              isAllSelected
                ? 'bg-rose-50 text-rose-800 border-rose-300 ring-1 ring-rose-200 shadow-2xs'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:border-slate-400'
            }`}
          >
            <div className={`w-3.5 h-3.5 rounded-xs border flex items-center justify-center ${
              isAllSelected ? 'bg-rose-600 border-rose-600 text-white' : 'border-slate-400 bg-white'
            }`}>
              {isAllSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
            </div>
            <span>{isAllSelected ? 'Deselect All' : `Select All (${totalMatching})`}</span>
          </button>

          {/* Selected count pill & clear */}
          {selectedCount > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-1 rounded-lg bg-rose-100 text-rose-900 font-mono text-[11px] font-bold border border-rose-200">
                {selectedCount} selected
              </span>
              <button
                type="button"
                onClick={onClearSelection}
                className="text-[11px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
              >
                Clear
              </button>
            </div>
          )}

          {/* Send to Recycled Bin Button */}
          <button
            id="clean-bar-send-to-bin-btn"
            type="button"
            onClick={onSendToRecycleBin}
            disabled={isSending || totalMatching === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition shadow-2xs hover:shadow-xs cursor-pointer disabled:opacity-50"
            title="Send snippets to the recycled bin"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>
              {selectedCount > 0
                ? `Send ${selectedCount} to Recycled Bin`
                : `Send all ${totalMatching} to Recycled Bin`}
            </span>
          </button>

          {/* View Recycled Bin Link */}
          <button
            id="clean-bar-view-bin-btn"
            type="button"
            onClick={onOpenRecycledBin}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-slate-600 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200 transition cursor-pointer"
            title="View and restore recycled snippets"
          >
            <span>Recycled Bin</span>
            {recycledCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full font-mono text-[10px] font-bold bg-slate-200 text-slate-700">
                {recycledCount}
              </span>
            )}
          </button>
        </div>

      </div>
    </section>
  );
};
