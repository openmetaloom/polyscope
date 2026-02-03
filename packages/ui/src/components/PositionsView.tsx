import { useState } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { usePositions } from '@/hooks/useApi';
import PositionCard from './PositionCard';

interface PositionsViewProps {
  address: string;
}

export default function PositionsView({ address }: PositionsViewProps) {
  const { data, loading, error, refetch } = usePositions(address, 30000); // 30s refresh
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const handleRefresh = async () => {
    await refetch();
    setLastUpdated(new Date());
  };

  if (loading && data.length === 0) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="flex items-center justify-between mb-6">
          <div className="h-6 w-32 bg-surface rounded" />
          <div className="h-8 w-24 bg-surface rounded" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-48 bg-surface rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-danger/10 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-danger" />
        </div>
        <h3 className="text-lg font-semibold text-text-primary mb-2">Failed to load positions</h3>
        <p className="text-text-secondary mb-4">{error.message}</p>
        <button onClick={handleRefresh} className="btn-primary">
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </button>
      </div>
    );
  }

  const activePositions = data.filter(p => p.status !== 'close');
  const closedPositions = data.filter(p => p.status === 'close');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">Active Positions</h2>
          <p className="text-sm text-text-secondary mt-1">
            {activePositions.length} position{activePositions.length !== 1 ? 's' : ''} • 
            Auto-refresh every 30s
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-tertiary">
            Updated {lastUpdated.toLocaleTimeString()}
          </span>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Active Positions */}
      {activePositions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activePositions.map((position) => (
            <PositionCard key={position.id} position={position} />
          ))}
        </div>
      ) : (
        <div className="card p-8 text-center">
          <p className="text-text-secondary">No active positions found</p>
        </div>
      )}

      {/* Closed Positions */}
      {closedPositions.length > 0 && (
        <div className="pt-6 border-t border-surface-border">
          <h3 className="text-lg font-semibold text-text-secondary mb-4">Closed Positions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-60">
            {closedPositions.map((position) => (
              <PositionCard key={position.id} position={position} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
