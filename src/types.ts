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
  sourcePage?: string;
}

export interface TopicCluster {
  topic: string;
  description: string;
  keyPoints: string[];
  keywords?: string[];
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
