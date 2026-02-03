/**
 * Position types for PolyScope
 */

export interface Position {
  id: string;
  marketId: string;
  marketTitle: string;
  marketImageUrl?: string;
  outcome: string;
  shares: string;
  avgPrice: number;
  currentPrice: number;
  value: number;
  cost: number;
  pnl: number;
  pnlPercent: number;
  status: 'open' | 'closed';
  openedAt: string;
  closedAt?: string;
  category?: string;
  endDate?: string;
}

export interface PositionAlert {
  type: 'price_movement' | 'profit_target' | 'stop_loss' | 'liquidation' | 'news';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

export interface PositionSummary {
  totalPositions: number;
  openPositions: number;
  closedPositions: number;
  totalValue: number;
  totalPnL: number;
  bestPerformer?: Position;
  worstPerformer?: Position;
}

export interface PositionUpdate {
  positionId: string;
  currentPrice: number;
  value: number;
  pnl: number;
  pnlPercent: number;
  timestamp: string;
}