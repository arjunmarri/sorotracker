import React from 'react';

/**
 * Normalizes an author handle into clean handle without '@'
 */
export function cleanHandle(handle?: string): string {
  if (!handle) return '';
  return handle.trim().replace(/^@+/, '');
}

/**
 * Returns full x.com profile URL for a handle
 */
export function getProfileUrl(handle?: string): string {
  const clean = cleanHandle(handle);
  return clean ? `https://x.com/${clean}` : 'https://x.com';
}

/**
 * Returns formatted handle with '@' prefix
 */
export function formatHandle(handle?: string): string {
  const clean = cleanHandle(handle);
  return clean ? `@${clean}` : '';
}

/**
 * Strips raw concatenated handle/timestamps from scraped author names
 * e.g. "DAIR.AI@dair_ai·Sep 8" -> "DAIR.AI"
 */
export function cleanAuthorDisplayName(name?: string, handle?: string): string {
  if (!name) return 'User';
  let cleaned = name.trim();
  if (handle) {
    const handleWithoutAt = cleanHandle(handle);
    const handleIndex = cleaned.search(new RegExp(`@${handleWithoutAt}\\b`, 'i'));
    if (handleIndex > 0) {
      cleaned = cleaned.substring(0, handleIndex).trim();
    }
  }
  // Remove trailing ·date or ·time patterns like ·Sep 8, ·10h, ·Jun 12, 2019
  cleaned = cleaned.replace(/·.*$/, '').trim();
  // Remove trailing @handle if still present
  cleaned = cleaned.replace(/@[a-zA-Z0-9_]+$/, '').trim();
  return cleaned || name;
}

// Reserved non-user paths on x.com that shouldn't be formatted as an author @username
const RESERVED_X_PATHS = new Set([
  'home', 'explore', 'notifications', 'messages', 'i', 'search',
  'settings', 'hashtag', 'login', 'signup', 'tos', 'privacy', 'intent'
]);

// Regex to tokenize tweet text into profile URLs, mentions, hashtags, and generic links
const TWEET_TOKEN_REGEX = /(https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/([a-zA-Z0-9_]{1,15})(?:\/)?(?:\?[^\s]*)?(?=[)\s.,;!?]|$))|(https?:\/\/[^\s]+)|(@[a-zA-Z0-9_]{1,15}\b)|(#[\w\u0080-\uFFFF]+)/gi;

/**
 * Renders tweet text with interactive hyperlinks for usernames, @mentions, and URLs.
 * Converts user profile links such as https://x.com/AndrewYNg into @AndrewYNg hyperlinks.
 */
export function renderTweetText(text: string): React.ReactNode {
  if (!text) return null;

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // Reset regex index
  TWEET_TOKEN_REGEX.lastIndex = 0;

  while ((match = TWEET_TOKEN_REGEX.exec(text)) !== null) {
    const fullMatch = match[0];
    const matchIndex = match.index;

    // Push preceding plain text
    if (matchIndex > lastIndex) {
      elements.push(text.substring(lastIndex, matchIndex));
    }

    const xUserUrl = match[1];
    const xUsername = match[2];
    const generalUrl = match[3];
    const mention = match[4];
    const hashtag = match[5];

    if (xUserUrl && xUsername && !RESERVED_X_PATHS.has(xUsername.toLowerCase())) {
      // Matched profile link like https://x.com/AndrewYNg -> Display as @AndrewYNg linking to https://x.com/AndrewYNg
      elements.push(
        <a
          key={`x-user-${matchIndex}`}
          href={`https://x.com/${xUsername}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sky-600 hover:text-sky-700 hover:underline font-semibold font-mono inline-flex items-center gap-0.5"
          title={`View @${xUsername} on X`}
          onClick={(e) => e.stopPropagation()}
        >
          @{xUsername}
        </a>
      );
    } else if (mention) {
      // Matched @mention -> Display as @AndrewYNg linking to https://x.com/AndrewYNg
      const handle = mention.slice(1);
      elements.push(
        <a
          key={`mention-${matchIndex}`}
          href={`https://x.com/${handle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sky-600 hover:text-sky-700 hover:underline font-medium font-mono"
          title={`View @${handle} on X`}
          onClick={(e) => e.stopPropagation()}
        >
          {mention}
        </a>
      );
    } else if (hashtag) {
      // Matched hashtag
      const tagText = hashtag.slice(1);
      elements.push(
        <a
          key={`hashtag-${matchIndex}`}
          href={`https://x.com/hashtag/${tagText}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sky-600 hover:text-sky-700 hover:underline font-medium"
          onClick={(e) => e.stopPropagation()}
        >
          {hashtag}
        </a>
      );
    } else if (generalUrl) {
      // Matched generic URL
      elements.push(
        <a
          key={`url-${matchIndex}`}
          href={generalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sky-600 hover:text-sky-700 hover:underline break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {generalUrl}
        </a>
      );
    } else {
      elements.push(fullMatch);
    }

    lastIndex = matchIndex + fullMatch.length;
  }

  // Push remaining text
  if (lastIndex < text.length) {
    elements.push(text.substring(lastIndex));
  }

  return elements;
}
