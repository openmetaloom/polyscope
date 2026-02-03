/**
 * News types for PolyScope
 */

export interface NewsArticle {
  id: string;
  title: string;
  summary?: string;
  content?: string;
  url: string;
  source: string;
  publishedAt: string;
  category: string;
  imageUrl?: string;
  sentiment?: Sentiment;
  relatedMarkets?: string[];
  tags?: string[];
}

export interface Sentiment {
  score: number;
  label: 'positive' | 'negative' | 'neutral';
  confidence?: number;
}

export interface NewsFeedParams {
  limit?: number;
  category?: string;
  source?: string;
  search?: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
}

export interface NewsFeedResponse {
  articles: NewsArticle[];
  meta: {
    total: number;
    sources: string[];
    categories: string[];
  };
}

export interface TradingSignal {
  type: 'buy' | 'sell' | 'hold' | 'watch';
  confidence: number;
  source: string;
  reason: string;
  marketId?: string;
  timestamp: string;
}