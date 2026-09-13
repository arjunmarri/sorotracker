export interface ExtractedLink {
  url: string;
  displayUrl: string;
  domain: string;
  title?: string;
  description?: string;
}

export interface MediaItem {
  type: 'image' | 'video' | 'gif';
  url: string;
  previewUrl?: string;
}

export interface TweetMetrics {
  replies?: number;
  retweets?: number;
  likes?: number;
  bookmarks?: number;
  views?: string;
}

export interface XHistoryRecord {
  id: string;
  tweetUrl: string;
  authorName: string;
  authorHandle: string;
  authorAvatarUrl?: string;
  isVerified?: boolean;
  text: string;
  createdAt: string;
  scannedAt: string;
  links: ExtractedLink[];
  media: MediaItem[];
  metrics?: TweetMetrics;
  tags?: string[];
  labels?: ContentFilterCategory[];
  sourcePage?: string;
  isBookmarked?: boolean;
  bookmarkedAt?: string;
  syncedAt?: string;
}

export type SortOption = 'latest_date' | 'oldest_date' | 'latest_synced' | 'oldest_synced' | 'newest' | 'oldest' | 'likes' | 'retweets';

export interface SubTopic {
  id: string;
  label: string;
  count?: number;
  keywords: string[];
  parentTopic?: string;
  description?: string;
}

export interface TopicClusterGroup {
  id: string;
  number?: number;
  name: string;
  definition?: string;
  classificationSignals?: string;
  disambiguation?: string;
  description?: string;
  topics: SubTopic[];
  totalSnippets: number;
  isOthers?: boolean;
}

export interface TopicCluster {
  topic: string;
  description: string;
  keyPoints: string[];
  keywords?: string[];
  subTopics?: SubTopic[];
  sampleTweetIds?: string[];
}

export interface CuratedLinkSummary {
  title: string;
  url: string;
  domain: string;
  relevance: string;
}

export interface AISummaryResult {
  executiveSummary?: string;
  topicClusters: TopicCluster[];
  curatedLinks: CuratedLinkSummary[];
  takeaways?: string[];
  generatedAt: string;
}

export interface ExtensionConfig {
  dashboardUrl: string;
  autoSync: boolean;
  minScrollWaitMs: number;
  includeBookmarks: boolean;
}

export type UserRole = 'admin' | 'editor' | 'viewer';
export type UserStatus = 'active' | 'suspended';

export interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  lastLoginAt?: string;
}

export type SiteTheme = 'warm-neutral' | 'editorial-slate' | 'midnight-dark' | 'emerald-archive' | 'minimal-light';

export interface SiteSettings {
  id?: string;
  siteName: string;
  tagline: string;
  theme: SiteTheme;
  footerContent: string;
  footerCopyright: string;
  updatedAt?: string;
  updatedBy?: string;
}

export type ReaderFontSize = 'sm' | 'md' | 'lg';

export type ContentFilterCategory = 
  | 'white_paper'
  | 'news_announcements'
  | 'tutorials_guides'
  | 'cheat_sheets_lists'
  | 'commentary_essays'
  | 'project_demos'
  | 'memes_humour'
  | 'polemics_debate'
  | 'creative_arts'
  | 'promotional_pitches_others';

export interface ContentFilterOption {
  id: ContentFilterCategory;
  number?: number;
  label: string;
  description: string;
  examples: string;
  type: 'high_signal' | 'noise';
  colorClasses: {
    badge: string;
    text: string;
    bg: string;
    border: string;
  };
}
