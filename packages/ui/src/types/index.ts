export interface Portfolio {
  totalValue: number;
  spotValue: number;
  polymarketValue: number;
  pnl24h: number;
  pnl24hPercent: number;
  chains: {
    name: string;
    value: number;
    percentage: number;
  }[];
  tokens: TokenHolding[];
}

export interface TokenHolding {
  symbol: string;
  name: string;
  balance: number;
  price: number;
  value: number;
  logoUrl?: string;
  chain: string;
}

export interface Position {
  id: string;
  marketId: string;
  marketTitle: string;
  outcome: 'YES' | 'NO';
  entryPrice: number;
  currentPrice: number;
  shares: number;
  value: number;
  pnl: number;
  pnlPercent: number;
  endDate: string;
  status: 'hold' | 'take_profit' | 'stop_loss' | 'close';
  tokenId: string;
  imageUrl?: string;
  category?: string;
}

export interface Market {
  id: string;
  title: string;
  description?: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  liquidity: number;
  endDate: string;
  status: 'open' | 'closed' | 'resolved';
  category?: string;
  imageUrl?: string;
  tokenIdYes: string;
  tokenIdNo: string;
  resolution?: 'YES' | 'NO' | null;
}

export interface MarketPriceHistory {
  timestamp: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
}

export interface NewsItem {
  id: string;
  title: string;
  content?: string;
  source: string;
  url?: string;
  publishedAt: string;
  category?: string;
  isSignal?: boolean;
  sentiment?: 'bullish' | 'bearish' | 'neutral';
  relatedMarkets?: string[];
}

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface EnsResolutionResult {
  address: string;
  ensName?: string;
  isValid: boolean;
  error?: string;
}
