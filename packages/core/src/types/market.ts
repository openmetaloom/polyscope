/**
 * Market types for PolyScope
 */

export interface Market {
  id: string;
  title: string;
  description?: string;
  category: string;
  subcategory?: string;
  imageUrl?: string;
  resolutionSource?: string;
  volume: number;
  liquidity: number;
  price: number;
  prices: {
    yes: number;
    no: number;
  };
  endDate: string;
  createdAt: string;
  status: 'active' | 'resolved' | 'closed';
  outcomes?: MarketOutcome[];
}

export interface MarketOutcome {
  id: string;
  name: string;
  price: number;
  probability: number;
}

export interface MarketSearchParams {
  limit?: number;
  offset?: number;
  category?: string;
  search?: string;
  sort?: 'volume' | 'liquidity' | 'created' | 'ending';
  order?: 'asc' | 'desc';
  status?: 'active' | 'resolved' | 'all';
}

export interface MarketSearchResponse {
  markets: Market[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}