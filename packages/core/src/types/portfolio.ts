/**
 * Portfolio types for PolyScope
 */

export interface TokenBalance {
  symbol: string;
  balance: string;
  balanceUsd: number;
  decimals: number;
  address?: string;
  chain?: string;
}

export interface ChainPortfolio {
  chain: string;
  chainId: number;
  balances: TokenBalance[];
  totalValue: number;
}

export interface Portfolio {
  address: string;
  ensName?: string;
  chain: string;
  balances: Record<string, TokenBalance>;
  positionsValue: number;
  totalValue: number;
  pnl: {
    realized: number;
    unrealized: number;
    total: number;
  };
  updatedAt: string;
  chains?: ChainPortfolio[];
}

export interface PortfolioSummary {
  address: string;
  totalValue: number;
  positionsCount: number;
  topHoldings: TokenBalance[];
  pnl24h: number;
}