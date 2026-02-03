import { Droplets, BarChart3, Clock, ExternalLink } from 'lucide-react';
import type { Market } from '@/types';

interface MarketCardProps {
  market: Market;
  onClick?: () => void;
}

export default function MarketCard({ market, onClick }: MarketCardProps) {
  const isOpen = market.status === 'open';
  const yesPercent = Math.round(market.yesPrice * 100);
  const noPercent = Math.round(market.noPrice * 100);
  
  const daysToResolution = Math.ceil(
    (new Date(market.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  // Get Polymarket URL
  const marketUrl = market.slug 
    ? `https://polymarket.com/event/${market.slug}`
    : `https://polymarket.com/event/${market.id}`;

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger onClick if clicking the external link
    if ((e.target as HTMLElement).closest('.external-link')) {
      return;
    }
    onClick?.();
  };

  return (
    <div
      onClick={handleCardClick}
      className={`
        card card-hover cursor-pointer group relative
        ${!isOpen ? 'opacity-75' : ''}
      `}
    >
      {/* External Link Button */}
      <a
        href={marketUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="external-link absolute top-3 right-3 p-2 opacity-0 group-hover:opacity-100 
                   hover:bg-surface-hover rounded-lg transition-all duration-200 z-10"
        title="View on Polymarket"
      >
        <ExternalLink className="w-4 h-4 text-muted hover:text-primary" />
      </a>

      {/* Header */}
      <div className="flex items-start gap-3 mb-4 pr-8">
        {market.imageUrl ? (
          <img
            src={market.imageUrl}
            alt={market.title}
            className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-surface-hover flex items-center justify-center flex-shrink-0">
            <BarChart3 className="w-6 h-6 text-muted" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-text-primary text-sm line-clamp-2 group-hover:text-primary transition-colors">
            {market.title}
          </h3>
          {market.category && (
            <span className="inline-block mt-1 text-xs text-text-tertiary bg-surface-hover px-2 py-0.5 rounded">
              {market.category}
            </span>
          )}
        </div>
      </div>

      {/* Price Bars */}
      <div className="space-y-3 mb-4">
        {/* YES bar */}
        <div className="relative">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-success font-medium">Yes {yesPercent}¢</span>
          </div>
          <div className="h-2 bg-surface-hover rounded-full overflow-hidden">
            <div
              className="h-full bg-success rounded-full transition-all duration-500"
              style={{ width: `${yesPercent}%` }}
            />
          </div>
        </div>

        {/* NO bar */}
        <div className="relative">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-danger font-medium">No {noPercent}¢</span>
          </div>
          <div className="h-2 bg-surface-hover rounded-full overflow-hidden">
            <div
              className="h-full bg-danger rounded-full transition-all duration-500"
              style={{ width: `${noPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-surface-border text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-text-secondary">
            <Droplets className="w-3.5 h-3.5" />
            <span>${(market.volume / 1e6).toFixed(1)}M</span>
          </div>
          <div className="flex items-center gap-1 text-text-secondary">
            <BarChart3 className="w-3.5 h-3.5" />
            <span>${(market.liquidity / 1e3).toFixed(1)}k</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {isOpen ? (
            <>
              <Clock className="w-3.5 h-3.5 text-muted" />
              <span className={`
                ${daysToResolution < 7 ? 'text-warning' : 'text-text-tertiary'}
              `}>
                {daysToResolution > 0 ? `${daysToResolution}d` : 'Ending'}
              </span>
            </>
          ) : (
            <span className={`badge ${market.status === 'resolved' ? 'badge-success' : 'badge-warning'}`}>
              {market.status}
            </span>
          )}
        </div>
      </div>

      {/* Resolution indicator */}
      {market.resolution && (
        <div className={`
          mt-3 py-1.5 px-3 rounded-lg text-center text-sm font-medium
          ${market.resolution === 'YES' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}
        `}>
          Resolved: {market.resolution}
        </div>
      )}
    </div>
  );
}
