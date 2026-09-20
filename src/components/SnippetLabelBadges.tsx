import React from 'react';
import { 
  FileText, 
  Zap, 
  BarChart3, 
  Newspaper, 
  MessageSquareQuote, 
  Radio, 
  Compass, 
  Smile, 
  AlertTriangle,
  BookOpen,
  Bookmark,
  Rocket,
  Megaphone,
  Palette,
  ShoppingBag,
  Tag
} from 'lucide-react';
import { XHistoryRecord, ContentFilterCategory } from '../types';
import { getSnippetLabels, CATEGORY_META_MAP, ALL_CATEGORY_OPTIONS } from '../lib/contentFilter';

interface SnippetLabelBadgesProps {
  record: XHistoryRecord;
  onSelectCategory?: (category: ContentFilterCategory) => void;
  className?: string;
  size?: 'sm' | 'xs';
}

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  white_paper: FileText,
  news_announcements: Newspaper,
  tutorials_guides: BookOpen,
  cheat_sheets_lists: Bookmark,
  commentary_essays: MessageSquareQuote,
  project_demos: Rocket,
  memes_humour: Smile,
  polemics_debate: Megaphone,
  creative_arts: Palette,
  promotional_pitches_others: ShoppingBag
};

const SnippetLabelBadgesComponent: React.FC<SnippetLabelBadgesProps> = ({
  record,
  onSelectCategory,
  className = '',
  size = 'xs'
}) => {
  // Each snippet can have multiple labels up to max 3
  const labels = getSnippetLabels(record);

  if (!labels || labels.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {labels.map(cat => {
        const meta = CATEGORY_META_MAP[cat] || ALL_CATEGORY_OPTIONS.find(o => o.id === cat);
        if (!meta) return null;
        const Icon = CATEGORY_ICONS[cat] || Tag;

        return (
          <button
            key={cat}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectCategory && onSelectCategory(cat);
            }}
            title={`${meta.label}: ${meta.description} (Click to filter)`}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border transition cursor-pointer select-none ${meta.colorClasses.badge} hover:opacity-90 hover:shadow-2xs active:scale-95`}
          >
            {Icon && <Icon className="w-3 h-3 shrink-0 opacity-80" />}
            <span className="truncate">{meta.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export const SnippetLabelBadges = React.memo(SnippetLabelBadgesComponent);
