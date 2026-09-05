import React, { useState } from 'react';
import { 
  ExternalLink, 
  Heart, 
  Repeat2, 
  MessageCircle, 
  Bookmark, 
  Trash2, 
  Copy, 
  Check, 
  Globe, 
  BadgeCheck,
  Calendar,
  Share2,
  CheckCircle2
} from 'lucide-react';
import { XHistoryRecord } from '../types';

interface RecordCardProps {
  record: XHistoryRecord;
  onDelete: (id: string) => void;
  onSelectAuthor?: (author: string) => void;
  compact?: boolean;
  isRead?: boolean;
  onToggleRead?: (id: string) => void;
}

export const RecordCard: React.FC<RecordCardProps> = ({
  record,
  onDelete,
  onSelectAuthor,
  compact = false,
  isRead = false,
  onToggleRead
}) => {
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(record.tweetUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString(undefined, { 
        month: 'short', 
        day: 'numeric',
        year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
      });
    } catch {
      return isoStr;
    }
  };

  // Compact List Mode
  if (compact) {
    return (
      <div 
        id={`record-${record.id}`}
        className="bg-white border border-[#E5E2DA] hover:border-[#1A1A1A] rounded-xl p-3.5 transition flex flex-col md:flex-row md:items-center justify-between gap-3 group shadow-2xs"
      >
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-[#EAE6DD] shrink-0 overflow-hidden border border-[#D5D0C5]">
            {record.authorAvatarUrl ? (
              <img 
                src={record.authorAvatarUrl} 
                alt={record.authorName} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-bold text-xs text-stone-700">
                {record.authorName.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-xs text-[#1A1A1A] truncate">
                {record.authorName}
              </span>
              {record.isVerified && (
                <BadgeCheck className="w-3.5 h-3.5 text-stone-800 shrink-0" />
              )}
              <button
                onClick={() => onSelectAuthor && onSelectAuthor(record.authorHandle)}
                className="text-[11px] text-stone-500 hover:text-black font-mono cursor-pointer"
              >
                {record.authorHandle}
              </button>
              <span className="text-stone-300 text-[10px]">•</span>
              <span className="text-stone-500 text-[11px] font-mono">{formatDate(record.createdAt)}</span>
            </div>

            <p className="text-xs text-stone-700 mt-1 line-clamp-2 leading-relaxed font-sans">
              {record.text}
            </p>

            {/* Extracted Links in compact mode */}
            {record.links && record.links.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {record.links.map((link, i) => (
                  <a
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-mono bg-[#FAF9F5] hover:bg-[#F2EFE8] text-stone-700 hover:text-black px-2 py-0.5 rounded border border-[#DDD7CC] transition truncate max-w-xs"
                  >
                    <Globe className="w-3 h-3 shrink-0 text-stone-500" />
                    <span className="truncate">{link.title || link.displayUrl}</span>
                    <ExternalLink className="w-2.5 h-2.5 shrink-0 ml-0.5" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-1.5 self-end md:self-center shrink-0">
          <button
            id={`mark-read-compact-${record.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleRead && onToggleRead(record.id);
            }}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer border ${
              isRead
                ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                : 'bg-white hover:bg-emerald-50 text-stone-700 hover:text-emerald-800 border-[#DDD7CC] hover:border-emerald-300'
            }`}
            title={isRead ? 'Move back to active snippets' : 'Mark as read and move to Caught up'}
          >
            <CheckCircle2 className={`w-3 h-3 ${isRead ? 'text-emerald-600' : 'text-stone-400'}`} />
            <span>{isRead ? 'Caught up' : 'Mark as read'}</span>
          </button>
          <a
            href={record.tweetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg bg-[#FAF9F5] hover:bg-[#F2EFE8] text-stone-600 hover:text-black border border-[#E2DDD3] text-xs transition"
            title="Open on X"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button
            onClick={handleCopyLink}
            className="p-1.5 rounded-lg bg-[#FAF9F5] hover:bg-[#F2EFE8] text-stone-600 hover:text-black border border-[#E2DDD3] text-xs transition cursor-pointer"
            title="Copy Tweet URL"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => onDelete(record.id)}
            className="p-1.5 rounded-lg bg-[#FAF9F5] hover:bg-rose-50 text-stone-500 hover:text-rose-700 border border-[#E2DDD3] text-xs transition cursor-pointer"
            title="Delete record"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // Full Card Mode
  return (
    <div 
      id={`record-${record.id}`}
      className="bg-white border border-[#E5E2DA] hover:border-[#1A1A1A] rounded-2xl p-4 transition-all duration-150 shadow-2xs flex flex-col justify-between group"
    >
      <div>
        {/* Top Header on Top of Snippet: Mark as read button */}
        <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-[#F0ECE4] text-xs">
          <div className="flex items-center gap-1.5 text-stone-500 font-mono text-[11px]">
            <span className={`w-1.5 h-1.5 rounded-full ${isRead ? 'bg-emerald-500' : 'bg-stone-400'}`}></span>
            <span className="font-medium text-stone-700">Snippet</span>
            <span className="text-stone-300">•</span>
            <span className="text-stone-400 font-mono">#{record.id.slice(-6)}</span>
          </div>

          <button
            id={`mark-read-${record.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleRead && onToggleRead(record.id);
            }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer border ${
              isRead
                ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300 shadow-2xs'
                : 'bg-white hover:bg-emerald-50 text-stone-700 hover:text-emerald-800 border-[#DDD7CC] hover:border-emerald-300 shadow-2xs group/btn'
            }`}
            title={isRead ? 'Move back to active snippets' : 'Mark as read and move to Caught up'}
          >
            <CheckCircle2 className={`w-3.5 h-3.5 ${isRead ? 'text-emerald-600' : 'text-stone-400 group-hover/btn:text-emerald-600'} transition`} />
            <span>{isRead ? 'Caught up' : 'Mark as read'}</span>
          </button>
        </div>

        {/* Author Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Avatar */}
            <div className="w-9 h-9 rounded-full bg-[#EAE6DD] shrink-0 overflow-hidden border border-[#D5D0C5]">
              {record.authorAvatarUrl ? (
                <img 
                  src={record.authorAvatarUrl} 
                  alt={record.authorName} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-bold text-xs text-stone-700">
                  {record.authorName.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>

            {/* Names */}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-xs text-[#1A1A1A] truncate hover:underline">
                  {record.authorName}
                </h3>
                {record.isVerified && (
                  <BadgeCheck className="w-3.5 h-3.5 text-stone-800 shrink-0" />
                )}
              </div>
              <button
                onClick={() => onSelectAuthor && onSelectAuthor(record.authorHandle)}
                className="text-[11px] text-stone-500 hover:text-black font-mono block truncate cursor-pointer"
              >
                {record.authorHandle}
              </button>
            </div>
          </div>

          {/* Date & X Permlink */}
          <div className="flex items-center gap-1.5 shrink-0 text-stone-500 text-xs">
            <span className="text-[11px] font-mono">{formatDate(record.createdAt)}</span>
            <a
              href={record.tweetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded hover:bg-[#FAF9F5] hover:text-black transition"
              title="Open Original Tweet on X"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Tweet Text */}
        <div className="text-xs text-stone-800 leading-relaxed whitespace-pre-wrap break-words mb-3.5 font-sans">
          {record.text}
        </div>

        {/* Media Preview (if present) */}
        {record.media && record.media.length > 0 && (
          <div className="mb-3.5 rounded-xl overflow-hidden border border-[#E5E2DA] max-h-56 bg-stone-100">
            {record.media.map((m, idx) => (
              <img 
                key={idx}
                src={m.url} 
                alt="Tweet attachment" 
                className="w-full h-full object-cover max-h-56"
                referrerPolicy="no-referrer"
              />
            ))}
          </div>
        )}

        {/* Extracted External Links Radar Banner */}
        {record.links && record.links.length > 0 && (
          <div className="space-y-2 mb-3.5">
            {record.links.map((link, idx) => (
              <a
                key={idx}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-[#FAF9F5] hover:bg-[#F2EFE8] border border-[#DDD7CD] hover:border-black rounded-xl p-3 transition group/link"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono font-medium text-stone-800 uppercase tracking-wider bg-[#EDE8DF] px-2 py-0.5 rounded border border-[#DDD7CC]">
                    {link.domain}
                  </span>
                  <ExternalLink className="w-3 h-3 text-stone-400 group-hover/link:text-black transition" />
                </div>
                {link.title && (
                  <h4 className="text-xs font-serif font-bold text-[#1A1A1A] line-clamp-1 group-hover/link:underline transition">
                    {link.title}
                  </h4>
                )}
                {link.description && (
                  <p className="text-[11px] text-stone-600 line-clamp-2 mt-0.5">
                    {link.description}
                  </p>
                )}
                <div className="text-[10px] text-stone-500 font-mono truncate mt-1.5">
                  {link.url}
                </div>
              </a>
            ))}
          </div>
        )}

        {/* Tags */}
        {record.tags && record.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {record.tags.map((tag, tIdx) => (
              <span 
                key={tIdx}
                className="text-[10px] font-mono text-stone-600 bg-[#FAF9F5] border border-[#DDD7CD] px-2 py-0.5 rounded"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Footer: Metrics & Actions */}
      <div className="pt-2.5 border-t border-[#EAE6DD] flex items-center justify-between text-stone-500 text-xs">
        {/* Engagement counts */}
        <div className="flex items-center gap-3 font-mono text-[11px]">
          {record.metrics?.likes !== undefined && record.metrics.likes > 0 && (
            <span className="flex items-center gap-1 text-stone-600">
              <Heart className="w-3 h-3 text-rose-500" />
              {record.metrics.likes.toLocaleString()}
            </span>
          )}
          {record.metrics?.retweets !== undefined && record.metrics.retweets > 0 && (
            <span className="flex items-center gap-1 text-stone-600">
              <Repeat2 className="w-3 h-3 text-emerald-600" />
              {record.metrics.retweets.toLocaleString()}
            </span>
          )}
          {record.metrics?.bookmarks !== undefined && record.metrics.bookmarks > 0 && (
            <span className="flex items-center gap-1 text-stone-600">
              <Bookmark className="w-3 h-3 text-stone-700" />
              {record.metrics.bookmarks.toLocaleString()}
            </span>
          )}
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopyLink}
            className="p-1 rounded hover:bg-[#FAF9F5] hover:text-black transition cursor-pointer"
            title="Copy Tweet URL"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => onDelete(record.id)}
            className="p-1 rounded hover:bg-rose-50 hover:text-rose-700 transition cursor-pointer"
            title="Delete from archive"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
