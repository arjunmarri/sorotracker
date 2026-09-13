import React, { useState } from 'react';
import { 
  ExternalLink, 
  Heart, 
  Repeat2, 
  Bookmark, 
  Trash2, 
  Copy, 
  Check, 
  Globe, 
  CheckCircle2
} from 'lucide-react';
import { XHistoryRecord, ContentFilterCategory, ReaderFontSize } from '../types';
import { SnippetLabelBadges } from './SnippetLabelBadges';
import { VerifiedBadge } from './VerifiedBadge';
import { getProfileUrl, formatHandle, renderTweetText, cleanAuthorDisplayName } from '../lib/tweetFormatter';

interface RecordCardProps {
  record: XHistoryRecord;
  onDelete: (id: string) => void;
  onSelectAuthor?: (author: string) => void;
  onSelectCategory?: (category: ContentFilterCategory) => void;
  compact?: boolean;
  isRead?: boolean;
  onToggleRead?: (id: string) => void;
  fontSize?: ReaderFontSize;
}

const RecordCardComponent: React.FC<RecordCardProps> = ({
  record,
  onDelete,
  onSelectAuthor,
  onSelectCategory,
  compact = false,
  isRead = false,
  onToggleRead,
  fontSize = 'md'
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

  // Font size classes for body text based on reader setting
  const getBodyTextClasses = () => {
    switch (fontSize) {
      case 'sm':
        return 'text-[13px] leading-[1.6]';
      case 'lg':
        return 'text-[16.5px] leading-[1.75] font-normal';
      case 'md':
      default:
        return 'text-[14.5px] leading-[1.68] font-normal';
    }
  };

  // Compact List Mode (Pristine White Background & Crisp Borders)
  if (compact) {
    return (
      <div 
        id={`record-${record.id}`}
        className="bg-white border border-slate-200 hover:border-slate-400 rounded-xl p-3.5 transition-all duration-150 flex flex-col md:flex-row md:items-center justify-between gap-3 group shadow-2xs hover:shadow-xs"
      >
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {/* Avatar */}
          <a 
            href={getProfileUrl(record.authorHandle)}
            target="_blank"
            rel="noopener noreferrer"
            className="w-8 h-8 rounded-full bg-slate-100 shrink-0 overflow-hidden border border-slate-200 block hover:ring-2 hover:ring-sky-400 transition"
            title={`View ${record.authorName} on X`}
            onClick={(e) => e.stopPropagation()}
          >
            {record.authorAvatarUrl ? (
              <img 
                src={record.authorAvatarUrl} 
                alt={record.authorName} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-bold text-xs text-slate-700">
                {record.authorName.slice(0, 1).toUpperCase()}
              </div>
            )}
          </a>

          {/* Details */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <a
                href={getProfileUrl(record.authorHandle)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-xs text-slate-900 truncate hover:underline hover:text-sky-600 transition-colors"
                title={`View ${cleanAuthorDisplayName(record.authorName, record.authorHandle)} on X`}
                onClick={(e) => e.stopPropagation()}
              >
                {cleanAuthorDisplayName(record.authorName, record.authorHandle)}
              </a>
              {record.isVerified && (
                <VerifiedBadge size={14} className="w-3.5 h-3.5 shrink-0" />
              )}
              <a
                href={getProfileUrl(record.authorHandle)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-sky-600 hover:text-sky-700 hover:underline font-mono font-medium transition-colors"
                title={`Open ${formatHandle(record.authorHandle)} on X`}
                onClick={(e) => e.stopPropagation()}
              >
                {formatHandle(record.authorHandle)}
              </a>
              {onSelectAuthor && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSelectAuthor(record.authorHandle);
                  }}
                  className="text-[10px] text-slate-400 hover:text-slate-800 font-mono hover:underline cursor-pointer"
                  title={`Filter by ${formatHandle(record.authorHandle)}`}
                >
                  filter
                </button>
              )}
              <span className="text-slate-300 text-[10px]">•</span>
              <span className="text-slate-500 text-[11px] font-mono">{formatDate(record.createdAt)}</span>
              {record.syncedAt && (
                <>
                  <span className="text-slate-300 text-[10px] hidden sm:inline">•</span>
                  <span
                    className="text-slate-400 text-[10px] font-mono hidden sm:inline"
                    title={`Synced: ${new Date(record.syncedAt).toLocaleString()}`}
                  >
                    Synced {formatDate(record.syncedAt)}
                  </span>
                </>
              )}
            </div>

            <div className="text-xs text-slate-800 mt-1 line-clamp-2 leading-relaxed font-sans">
              {renderTweetText(record.text)}
            </div>

            {/* Topic label & Engagement counts in compact mode */}
            <div className="flex items-center gap-2.5 flex-wrap mt-2">
              {/* Engagement counts */}
              {((record.metrics?.likes !== undefined && record.metrics.likes > 0) || (record.metrics?.retweets !== undefined && record.metrics.retweets > 0)) && (
                <div className="flex items-center gap-2.5 font-mono text-[11px] text-slate-600">
                  {record.metrics?.likes !== undefined && record.metrics.likes > 0 && (
                    <span className="flex items-center gap-1" title={`${record.metrics.likes} likes`}>
                      <Heart className="w-3 h-3 text-rose-500 fill-rose-500/10" />
                      {record.metrics.likes.toLocaleString()}
                    </span>
                  )}
                  {record.metrics?.retweets !== undefined && record.metrics.retweets > 0 && (
                    <span className="flex items-center gap-1" title={`${record.metrics.retweets} reposts`}>
                      <Repeat2 className="w-3 h-3 text-emerald-600" />
                      {record.metrics.retweets.toLocaleString()}
                    </span>
                  )}
                </div>
              )}

              {/* Topic Labels */}
              <SnippetLabelBadges 
                record={record} 
                onSelectCategory={onSelectCategory} 
              />
            </div>

            {/* Extracted Links in compact mode */}
            {record.links && record.links.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {record.links.map((link, i) => (
                  <a
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-mono bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-950 px-2 py-0.5 rounded border border-slate-200 transition truncate max-w-xs"
                  >
                    <Globe className="w-3 h-3 shrink-0 text-slate-400" />
                    <span className="truncate">{link.title || link.displayUrl}</span>
                    <ExternalLink className="w-2.5 h-2.5 shrink-0 ml-0.5 opacity-60" />
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
                : 'bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border-slate-200 hover:border-emerald-300'
            }`}
            title={isRead ? 'Move back to active snippets' : 'Mark as read and move to Caught up'}
          >
            <CheckCircle2 className={`w-3 h-3 ${isRead ? 'text-emerald-600' : 'text-slate-400'}`} />
            <span>{isRead ? 'Caught up' : 'Mark as read'}</span>
          </button>
          <a
            href={record.tweetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 text-xs transition"
            title="Open on X"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button
            onClick={handleCopyLink}
            className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 text-xs transition cursor-pointer"
            title="Copy Tweet URL"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => onDelete(record.id)}
            className="p-1.5 rounded-lg bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-700 border border-slate-200 text-xs transition cursor-pointer"
            title="Delete record"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // Full Card Mode (Pure White Background, Pristine Typography, High Contrast)
  return (
    <article 
      id={`record-${record.id}`}
      className="bg-white border border-slate-200 hover:border-slate-400 rounded-2xl p-4 sm:p-5 transition-all duration-200 shadow-xs hover:shadow-md flex flex-col justify-between group"
    >
      <div>
        {/* Top Header on Top of Snippet: Status & Mark as Read */}
        <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-100 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 font-mono text-[11px]">
            <span className={`w-2 h-2 rounded-full ${isRead ? 'bg-emerald-500 ring-2 ring-emerald-100' : 'bg-slate-300'}`}></span>
            <span className="font-medium text-slate-600">Snippet</span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-400 font-mono">#{record.id.slice(-6)}</span>
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
                : 'bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border-slate-200 hover:border-emerald-300 shadow-2xs group/btn'
            }`}
            title={isRead ? 'Move back to active snippets' : 'Mark as read and move to Caught up'}
          >
            <CheckCircle2 className={`w-3.5 h-3.5 ${isRead ? 'text-emerald-600' : 'text-slate-400 group-hover/btn:text-emerald-600'} transition`} />
            <span>{isRead ? 'Caught up' : 'Mark as read'}</span>
          </button>
        </div>

        {/* Author Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Avatar */}
            <a 
              href={getProfileUrl(record.authorHandle)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-full bg-slate-100 shrink-0 overflow-hidden border border-slate-200 block hover:ring-2 hover:ring-sky-400 transition"
              title={`View ${record.authorName} on X`}
              onClick={(e) => e.stopPropagation()}
            >
              {record.authorAvatarUrl ? (
                <img 
                  src={record.authorAvatarUrl} 
                  alt={record.authorName} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-bold text-xs text-slate-700">
                  {record.authorName.slice(0, 1).toUpperCase()}
                </div>
              )}
            </a>

            {/* Names */}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <a
                  href={getProfileUrl(record.authorHandle)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-xs text-slate-900 truncate hover:underline hover:text-sky-600 transition-colors"
                  title={`View ${cleanAuthorDisplayName(record.authorName, record.authorHandle)} on X`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {cleanAuthorDisplayName(record.authorName, record.authorHandle)}
                </a>
                {record.isVerified && (
                  <VerifiedBadge size={16} className="w-4 h-4 shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <a
                  href={getProfileUrl(record.authorHandle)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-sky-600 hover:text-sky-700 hover:underline font-mono truncate transition-colors font-medium inline-block"
                  title={`Open ${formatHandle(record.authorHandle)} on X`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {formatHandle(record.authorHandle)}
                </a>
                {onSelectAuthor && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onSelectAuthor(record.authorHandle);
                    }}
                    className="text-[10px] text-slate-400 hover:text-slate-800 font-mono hover:underline cursor-pointer"
                    title={`Filter by ${formatHandle(record.authorHandle)}`}
                  >
                    filter
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Date & X Permlink */}
          <div className="flex items-center gap-1.5 shrink-0 text-slate-500 text-xs">
            {record.isBookmarked && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20 shrink-0" title="Bookmarked directly on X">
                <Bookmark className="w-2.5 h-2.5 fill-amber-500 text-amber-600" />
                Bookmarked
              </span>
            )}
            {record.syncedAt && (
              <span
                className="text-[10px] text-slate-400 font-mono hidden md:inline"
                title={`Synced to SoroTrack: ${new Date(record.syncedAt).toLocaleString()}`}
              >
                Synced {formatDate(record.syncedAt)}
              </span>
            )}
            <span className="text-[11px] font-mono">{formatDate(record.createdAt)}</span>
            <a
              href={record.tweetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded hover:bg-slate-100 hover:text-slate-900 transition"
              title="Open Original Tweet on X"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Main Tweet Body Text (Comfortable, High-Contrast Reading on White) */}
        <div className={`${getBodyTextClasses()} text-slate-900 whitespace-pre-wrap break-words mb-3.5 font-sans tracking-[-0.008em]`}>
          {renderTweetText(record.text)}
        </div>

        {/* Media Preview (if present) */}
        {record.media && record.media.length > 0 && (
          <div className="mb-3.5 rounded-xl overflow-hidden border border-slate-200 max-h-64 bg-slate-100">
            {record.media.map((m, idx) => (
              <img 
                key={idx}
                src={m.url} 
                alt="Tweet attachment" 
                className="w-full h-full object-cover max-h-64"
                referrerPolicy="no-referrer"
              />
            ))}
          </div>
        )}

        {/* Extracted External Links Preview (Crisp White Card) */}
        {record.links && record.links.length > 0 && (
          <div className="space-y-2 mb-3.5">
            {record.links.map((link, idx) => (
              <a
                key={idx}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-slate-50/70 hover:bg-slate-100/90 border border-slate-200 hover:border-slate-400 rounded-xl p-3 transition-all group/link"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono font-medium text-slate-700 uppercase tracking-wider bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
                    {link.domain}
                  </span>
                  <ExternalLink className="w-3 h-3 text-slate-400 group-hover/link:text-slate-900 transition" />
                </div>
                {link.title && (
                  <h4 className="text-xs font-sans font-bold text-slate-900 line-clamp-1 group-hover/link:underline transition">
                    {link.title}
                  </h4>
                )}
                {link.description && (
                  <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5 leading-relaxed">
                    {link.description}
                  </p>
                )}
                <div className="text-[10px] text-slate-400 font-mono truncate mt-1">
                  {(() => {
                    const profileMatch = link.url.match(/https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/([a-zA-Z0-9_]{1,15})\/?$/i);
                    if (profileMatch) {
                      return <span className="text-sky-600 font-semibold font-mono">@{profileMatch[1]}</span>;
                    }
                    return link.url;
                  })()}
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
                className="text-[10px] font-mono text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Footer: Metrics, Topic Label & Actions */}
      <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-3 text-slate-500 text-xs">
        {/* Engagement counts & Topic Label side-by-side */}
        <div className="flex items-center gap-2.5 flex-wrap min-w-0">
          {/* Engagement counts */}
          {((record.metrics?.likes !== undefined && record.metrics.likes > 0) ||
            (record.metrics?.retweets !== undefined && record.metrics.retweets > 0) ||
            (record.metrics?.bookmarks !== undefined && record.metrics.bookmarks > 0)) && (
            <div className="flex items-center gap-2.5 font-mono text-[11px]">
              {record.metrics?.likes !== undefined && record.metrics.likes > 0 && (
                <span className="flex items-center gap-1 text-slate-600" title={`${record.metrics.likes} likes`}>
                  <Heart className="w-3 h-3 text-rose-500 fill-rose-500/10" />
                  {record.metrics.likes.toLocaleString()}
                </span>
              )}
              {record.metrics?.retweets !== undefined && record.metrics.retweets > 0 && (
                <span className="flex items-center gap-1 text-slate-600" title={`${record.metrics.retweets} reposts`}>
                  <Repeat2 className="w-3 h-3 text-emerald-600" />
                  {record.metrics.retweets.toLocaleString()}
                </span>
              )}
              {record.metrics?.bookmarks !== undefined && record.metrics.bookmarks > 0 && (
                <span className="flex items-center gap-1 text-slate-600" title={`${record.metrics.bookmarks} bookmarks`}>
                  <Bookmark className="w-3 h-3 text-slate-700" />
                  {record.metrics.bookmarks.toLocaleString()}
                </span>
              )}
            </div>
          )}

          {/* Topic Label beside likes and retweets in same font-size */}
          <SnippetLabelBadges 
            record={record} 
            onSelectCategory={onSelectCategory} 
          />
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopyLink}
            className="p-1 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition cursor-pointer"
            title="Copy Tweet URL"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => onDelete(record.id)}
            className="p-1 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-700 transition cursor-pointer"
            title="Delete from archive"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
};

export const RecordCard = React.memo(RecordCardComponent);
