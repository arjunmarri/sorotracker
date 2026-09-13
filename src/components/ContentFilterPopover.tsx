import React from 'react';
import { SlidersHorizontal, Check, X, ShieldAlert, Sparkles, RotateCcw, ChevronUp } from 'lucide-react';
import { ContentFilterCategory, ContentFilterOption } from '../types';
import { FILTER_OUT_OPTIONS, HIGH_SIGNAL_OPTIONS } from '../lib/contentFilter';

interface ContentFilterSectionProps {
  isOpen: boolean;
  onClose: () => void;
  activeFilters: ContentFilterCategory[];
  onToggleFilter: (category: ContentFilterCategory) => void;
  onSetAllFilters: (categories: ContentFilterCategory[]) => void;
  onClearFilters: () => void;
  categoryCounts: Record<ContentFilterCategory, number>;
  totalFilteredCount: number;
}

export const ContentFilterSection: React.FC<ContentFilterSectionProps> = ({
  isOpen,
  onClose,
  activeFilters,
  onToggleFilter,
  onSetAllFilters,
  onClearFilters,
  categoryCounts,
  totalFilteredCount
}) => {
  if (!isOpen) return null;

  const hasActiveFilters = activeFilters.length > 0;

  const handleSelectAll = () => {
    onSetAllFilters(FILTER_OUT_OPTIONS.map(o => o.id));
  };

  return (
    <section 
      id="content-filter-expanded-section"
      aria-label="Content Filter Settings"
      className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 mb-5 shadow-xs transition-all duration-200"
    >
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 mb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-slate-900 text-white shadow-2xs">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-serif font-bold text-slate-900 tracking-tight">
              Content & Noise Filtering
            </h3>
            {hasActiveFilters && (
              <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                {activeFilters.length} active {activeFilters.length === 1 ? 'rule' : 'rules'}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 font-sans mt-1">
            Filter out low-signal noise categories to keep your archive focused on technical insights and product engineering.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
          {hasActiveFilters ? (
            <button
              type="button"
              id="filter-section-clear-btn"
              onClick={onClearFilters}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium shadow-2xs transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Reset all</span>
            </button>
          ) : (
            <button
              type="button"
              id="filter-section-select-all-btn"
              onClick={handleSelectAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-black text-white text-xs font-medium shadow-2xs transition cursor-pointer"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span>Filter out all noise</span>
            </button>
          )}

          <button
            type="button"
            id="filter-section-close-btn"
            onClick={onClose}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 text-xs font-medium transition cursor-pointer"
            title="Collapse filter section"
          >
            <ChevronUp className="w-3.5 h-3.5" />
            <span className="text-[11px]">Collapse</span>
          </button>
        </div>
      </div>

      {/* Filter Out Categories Grid */}
      <div className="mb-4">
        <div className="text-[11px] font-mono uppercase tracking-wider text-stone-500 font-semibold mb-2.5 flex items-center justify-between">
          <span>Categories to Filter Out</span>
          <span className="text-[11px] text-stone-500 font-normal">
            Check any category to exclude from active timeline
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {FILTER_OUT_OPTIONS.map((option) => {
            const isChecked = activeFilters.includes(option.id);
            const count = categoryCounts[option.id] || 0;

            return (
              <label
                key={option.id}
                id={`filter-opt-${option.id}`}
                className={`flex items-start gap-3 p-3 rounded-xl border transition cursor-pointer select-none ${
                  isChecked
                    ? 'bg-amber-50/80 border-amber-300 shadow-2xs ring-1 ring-amber-400/30'
                    : 'bg-white border-slate-200 hover:border-slate-400 hover:bg-slate-50'
                }`}
              >
                <div className="pt-0.5 shrink-0">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => onToggleFilter(option.id)}
                    className="sr-only"
                  />
                  <div className={`w-4 h-4 rounded flex items-center justify-center border transition ${
                    isChecked
                      ? 'bg-amber-800 border-amber-800 text-white'
                      : 'bg-white border-stone-300'
                  }`}>
                    {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-xs font-semibold text-stone-900">
                      {option.number}. {option.label}
                    </span>
                    {count > 0 && (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium shrink-0 ${
                        isChecked
                          ? 'bg-amber-200/80 text-amber-950 font-semibold'
                          : 'bg-[#EFEBE3] text-stone-600 border border-[#DCD6CA]'
                      }`}>
                        {count} {count === 1 ? 'post' : 'posts'}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-stone-600 leading-snug mt-1">
                    {option.description}
                  </p>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* High-Signal Categories Informational Strip */}
      <div className="p-3 bg-[#F4F0E6]/70 border border-[#E0DBD0] rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-2.5 text-xs">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-700 shrink-0" />
          <span className="font-medium text-stone-900">High-Signal Categories automatically kept:</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {HIGH_SIGNAL_OPTIONS.map((opt) => {
              const count = categoryCounts[opt.id] || 0;
              return (
                <span 
                  key={opt.id} 
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${opt.colorClasses.badge}`}
                >
                  {opt.label} ({count})
                </span>
              );
            })}
          </div>
        </div>

        <div className="text-[11px] font-mono text-stone-500 shrink-0">
          {totalFilteredCount > 0 ? (
            <span className="text-amber-800 font-semibold">
              Currently hiding {totalFilteredCount} {totalFilteredCount === 1 ? 'post' : 'posts'} from view
            </span>
          ) : (
            <span>Showing all posts</span>
          )}
        </div>
      </div>
    </section>
  );
};

// Export as both ContentFilterSection and ContentFilterPopover for seamless compatibility
export const ContentFilterPopover = ContentFilterSection;

