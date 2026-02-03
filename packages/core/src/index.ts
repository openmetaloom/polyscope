/**
 * PolyScope Core - Shared Types and Utilities
 */

// Type exports
export * from './types/market';
export * from './types/portfolio';
export * from './types/position';
export * from './types/api';
export * from './types/news';

// Constants
export const APP_NAME = 'PolyScope';
export const APP_VERSION = '2.0.0';

// Chains
export const SUPPORTED_CHAINS = [
  { id: 1, name: 'ethereum', label: 'Ethereum' },
  { id: 8453, name: 'base', label: 'Base' },
  { id: 137, name: 'polygon', label: 'Polygon' },
] as const;

// Categories
export const MARKET_CATEGORIES = [
  'Crypto',
  'Politics',
  'Sports',
  'Entertainment',
  'Science',
  'Business',
  'Technology',
  'Other',
] as const;

// Utility functions
export function formatAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatCurrency(value: number, decimals = 2): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercent(value: number, decimals = 2): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export function isValidEns(name: string): boolean {
  return /^[a-z0-9-]+\.eth$/i.test(name);
}