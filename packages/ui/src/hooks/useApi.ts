import { useState, useEffect, useCallback } from 'react';
import axios, { AxiosError } from 'axios';
import type { Portfolio, Position, Market, NewsItem, ApiError } from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export function usePortfolio(address: string) {
  const [data, setData] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchPortfolio = useCallback(async () => {
    if (!address) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get<Portfolio>(`/portfolio/${address}`);
      setData(response.data);
    } catch (err) {
      const axiosError = err as AxiosError<{ message: string }>;
      setError({
        message: axiosError.response?.data?.message || 'Failed to fetch portfolio',
        status: axiosError.response?.status,
      });
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchPortfolio();
  }, [fetchPortfolio]);

  return { data, loading, error, refetch: fetchPortfolio };
}

export function usePositions(address: string, refreshInterval = 30000) {
  const [data, setData] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchPositions = useCallback(async () => {
    if (!address) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get<Position[]>(`/positions/${address}`);
      setData(response.data);
    } catch (err) {
      const axiosError = err as AxiosError<{ message: string }>;
      setError({
        message: axiosError.response?.data?.message || 'Failed to fetch positions',
        status: axiosError.response?.status,
      });
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchPositions();
    
    if (refreshInterval > 0) {
      const interval = setInterval(fetchPositions, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchPositions, refreshInterval]);

  return { data, loading, error, refetch: fetchPositions };
}

export function useMarkets() {
  const [data, setData] = useState<Market[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchMarkets = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get<Market[]>('/markets');
      setData(response.data);
    } catch (err) {
      const axiosError = err as AxiosError<{ message: string }>;
      setError({
        message: axiosError.response?.data?.message || 'Failed to fetch markets',
        status: axiosError.response?.status,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  const searchMarkets = useCallback(async (query: string) => {
    if (!query.trim()) {
      fetchMarkets();
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get<Market[]>(`/markets/search?q=${encodeURIComponent(query)}`);
      setData(response.data);
    } catch (err) {
      const axiosError = err as AxiosError<{ message: string }>;
      setError({
        message: axiosError.response?.data?.message || 'Failed to search markets',
        status: axiosError.response?.status,
      });
    } finally {
      setLoading(false);
    }
  }, [fetchMarkets]);

  return { data, loading, error, refetch: fetchMarkets, searchMarkets };
}

export function useMarketPrices(tokenId: string, refreshInterval = 30000) {
  const [data, setData] = useState<{ price: number; timestamp: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchPrice = useCallback(async () => {
    if (!tokenId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get(`/prices/${tokenId}`);
      setData(response.data);
    } catch (err) {
      const axiosError = err as AxiosError<{ message: string }>;
      setError({
        message: axiosError.response?.data?.message || 'Failed to fetch price',
        status: axiosError.response?.status,
      });
    } finally {
      setLoading(false);
    }
  }, [tokenId]);

  useEffect(() => {
    fetchPrice();
    
    if (refreshInterval > 0 && tokenId) {
      const interval = setInterval(fetchPrice, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchPrice, refreshInterval, tokenId]);

  return { data, loading, error, refetch: fetchPrice };
}

export function useNews() {
  const [data, setData] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get<NewsItem[]>('/news');
      setData(response.data);
    } catch (err) {
      const axiosError = err as AxiosError<{ message: string }>;
      setError({
        message: axiosError.response?.data?.message || 'Failed to fetch news',
        status: axiosError.response?.status,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  return { data, loading, error, refetch: fetchNews };
}
