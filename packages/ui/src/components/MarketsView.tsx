import { useState, useCallback } from 'react';
import { Search, Filter, X, TrendingUp, Droplets, Clock } from 'lucide-react';
import { useMarkets } from '@/hooks/useApi';
import MarketCard from './MarketCard';
import type { Market } from '@/types';

interface MarketsViewProps {
  onMarketSelect?: (market: Market) => void;
}

const categories = ['All', 'Politics', 'Crypto', 'Sports', 'Science', 'Business', 'Entertainment'];

export default function MarketsView({ onMarketSelect }: MarketsViewProps) {
  const { data, loading, error, searchMarkets } = useMarkets();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    searchMarkets(query);
  }, [searchMarkets]);

  const clearSearch = () => {
    setSearchQuery('');
    searchMarkets('');
  };

  const handleMarketClick = (market: Market) => {
    setSelectedMarket(market);
    onMarketSelect?.(market);
  };

  const filteredMarkets = selectedCategory === 'All' 
    ? data 
    : data.filter(m => m.category?.toLowerCase() === selectedCategory.toLowerCase());

  // Sort: open markets first, then by volume
  const sortedMarkets = [...filteredMarkets].sort((a, b) => {
    if (a.status === 'open' && b.status !== 'open') return -1;
    if (a.status !== 'open' && b.status === 'open') return 1;
    return b.volume - a.volume;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Search and Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearch}
            placeholder="Search markets..."
            className="w-full pl-10 pr-10 py-2.5 bg-surface border border-surface-border rounded-lg
                       text-text-primary placeholder:text-muted
                       focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary
                       transition-all duration-200"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-surface-hover rounded"
            >
              <X className="w-4 h-4 text-muted" />
            </button>
          )}
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
          <Filter className="w-4 h-4 text-muted flex-shrink-0" />
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`
                px-3 py-1.5 rounded-full text-sm whitespace-nowrap
                transition-all duration-200
                ${selectedCategory === category 
                  ? 'bg-primary text-black font-medium' 
                  : 'bg-surface border border-surface-border text-text-secondary hover:text-text-primary hover:border-muted'}
              `}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex flex-wrap items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <span className="text-text-secondary">{sortedMarkets.filter(m => m.status === 'open').length} Open</span>
        </div>
        <div className="flex items-center gap-2">
          <Droplets className="w-4 h-4 text-secondary" />
          <span className="text-text-secondary">
            ${(sortedMarkets.reduce((acc, m) => acc + m.volume, 0) / 1e6).toFixed(1)}M Volume
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted" />
          <span className="text-text-secondary">{sortedMarkets.length} Markets</span>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-48 bg-surface rounded-xl" />
          ))}
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="card p-8 text-center">
          <p className="text-danger mb-4">{error.message}</p>
          <button onClick={() => searchMarkets('')} className="btn-primary">
            Retry
          </button>
        </div>
      )}

      {/* Markets Grid */}
      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedMarkets.map((market) => (
            <MarketCard 
              key={market.id} 
              market={market} 
              onClick={() => handleMarketClick(market)}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && sortedMarkets.length === 0 && (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-hover flex items-center justify-center">
            <Search className="w-8 h-8 text-muted" />
          </div>
          <h3 className="text-lg font-semibold text-text-primary mb-2">No markets found</h3>
          <p className="text-text-secondary">
            {searchQuery 
              ? `No results for "${searchQuery}"` 
              : 'No markets available in this category'}
          </p>
        </div>
      )}

      {/* Market Detail Modal would go here - simplified for now */}
      {selectedMarket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-surface border border-surface-border rounded-xl max-w-2xl w-full max-h-[80vh] overflow-auto p-6 animate-slide-up">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-xl font-semibold text-text-primary pr-4">{selectedMarket.title}</h2>
              <button
                onClick={() => setSelectedMarket(null)}
                className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-text-secondary" />
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-surface-hover rounded-lg">
                <p className="text-sm text-text-secondary mb-1">YES Price</p>
                <p className="text-2xl font-bold text-success">${selectedMarket.yesPrice.toFixed(3)}</p>
              </div>
              <div className="p-4 bg-surface-hover rounded-lg">
                <p className="text-sm text-text-secondary mb-1">NO Price</p>
                <p className="text-2xl font-bold text-danger">${selectedMarket.noPrice.toFixed(3)}</p>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-text-secondary">Volume</span>
                <span className="font-medium text-text-primary">${selectedMarket.volume.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Liquidity</span>
                <span className="font-medium text-text-primary">${selectedMarket.liquidity.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">End Date</span>
                <span className="font-medium text-text-primary">
                  {new Date(selectedMarket.endDate).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Status</span>
                <span className={`badge ${selectedMarket.status === 'open' ? 'badge-success' : 'badge-warning'}`}>
                  {selectedMarket.status}
                </span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-surface-border">
              <button
                onClick={() => setSelectedMarket(null)}
                className="w-full btn-primary py-3"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
