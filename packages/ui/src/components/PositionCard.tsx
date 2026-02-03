import { useMemo } from 'react';
import { 
  TrendingUp, TrendingDown, Clock, Target, 
  AlertTriangle, XCircle, ExternalLink
} from 'lucide-react';
import { useMarketPrices } from '@/hooks/useApi';
import type { Position } from '@/types';

interface PositionCardProps {
  position: Position;
}

const statusConfig = {
  hold: { icon: Clock, color: 'text-text-secondary', bg: 'bg-surface-hover', label: 'Hold' },
  take_profit: { icon: Target, color: 'text-success', bg: 'bg-success/10', label: 'Take Profit' },
  stop_loss: { icon: AlertTriangle, color: 'text-danger', bg: 'bg-danger/10', label: 'Stop Loss' },
  close: { icon: XCircle, color: 'text-muted', bg: 'bg-muted/10', label: 'Closed' },
};

export default function PositionCard({ position }: PositionCardProps) {
  const { data: currentPriceData } = useMarketPrices(position.tokenId, 30000);
  
  const currentPrice = currentPriceData?.price || position.currentPrice;
  const isYes = position.outcome === 'YES';
  const isProfit = position.pnl >= 0;
  
  const daysToResolution = Math.ceil(
    (new Date(position.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  const status = statusConfig[position.status];
  const StatusIcon = status.icon;

  // Get Polymarket URL
  const marketUrl = useMemo(() => {
    if (position.marketSlug) {
      return `https://polymarket.com/event/${position.marketSlug}`;
    }
    // Fallback: try to construct from marketId
    if (position.marketId) {
      return `https://polymarket.com/event/${position.marketId}`;
    }
    return null;
  }, [position.marketSlug, position.marketId]);

  // Calculate current value based on live price
  const liveValue = useMemo(() => {
    if (!currentPriceData?.price) return position.value;
    return position.shares * currentPriceData.price;
  }, [currentPriceData, position.shares, position.value]);

  const livePnl = useMemo(() => {
    const cost = position.shares * position.entryPrice;
    return liveValue - cost;
  }, [liveValue, position.shares, position.entryPrice]);

  const livePnlPercent = useMemo(() => {
    const cost = position.shares * position.entryPrice;
    return cost > 0 ? (livePnl / cost) * 100 : 0;
  }, [livePnl, position.shares, position.entryPrice]);

  return (
    <div className="card card-hover p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3">
          {position.imageUrl ? (
            <img
              src={position.imageUrl}
              alt={position.marketTitle}
              className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
            />
          ) : (
            <div className={`
              w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0
              ${isYes ? 'bg-success/10' : 'bg-danger/10'}
            `}>
              {isYes ? (
                <TrendingUp className="w-6 h-6 text-success" />
              ) : (
                <TrendingDown className="w-6 h-6 text-danger" />
              )}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="font-medium text-text-primary text-sm line-clamp-2">
              {marketUrl ? (
                <a
                  href={marketUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors inline-flex items-center gap-1 group"
                >
                  {position.marketTitle}
                  <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              ) : (
                position.marketTitle
              )}
            </h3>
            {position.category && (
              <span className="text-xs text-text-tertiary">{position.category}</span>
            )}
          </div>
        </div>
        
        {/* Status Badge */}
        <div className={`
          flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
          ${status.bg} ${status.color}
        `}>
          <StatusIcon className="w-3.5 h-3.5" />
          {status.label}
        </div>
      </div>

      {/* Position Details */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="p-3 bg-surface-hover rounded-lg">
          <p className="text-xs text-text-secondary mb-1">Position</p>
          <p className={`font-semibold ${isYes ? 'text-success' : 'text-danger'}`}>
            {position.outcome}
          </p>
          <p className="text-xs text-text-tertiary mt-0.5">
            {position.shares.toFixed(4)} shares
          </p>
        </div>
        
        <div className="p-3 bg-surface-hover rounded-lg">
          <p className="text-xs text-text-secondary mb-1">Current Value</p>
          <p className="font-semibold text-text-primary">
            ${liveValue.toFixed(2)}
          </p>
          <div className={`flex items-center gap-1 text-xs mt-0.5 ${livePnl >= 0 ? 'text-success' : 'text-danger'}`}>
            {livePnl >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span>{livePnl >= 0 ? '+' : ''}{livePnlPercent.toFixed(2)}%</span>
          </div>
        </div>
      </div>

      {/* Price Info */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-secondary">Entry Price</span>
          <span className="font-medium text-text-primary">${position.entryPrice.toFixed(3)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-secondary">Current Price</span>
          <span className="font-medium text-text-primary">${currentPrice.toFixed(3)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-secondary">P&L</span>
          <span className={`font-medium ${isProfit ? 'text-success' : 'text-danger'}`}>
            {isProfit ? '+' : ''}${position.pnl.toFixed(2)} ({isProfit ? '+' : ''}{position.pnlPercent.toFixed(2)}%)
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-surface-border">
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <Clock className="w-3.5 h-3.5" />
          {daysToResolution > 0 ? (
            <span>{daysToResolution} days to resolution</span>
          ) : (
            <span className="text-warning">Resolving soon</span>
          )}
        </div>
        
        {currentPriceData?.price && (
          <div className="flex items-center gap-1 text-xs text-primary">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Live
          </div>
        )}
      </div>
    </div>
  );
}
