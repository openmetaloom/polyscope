import React from 'react';
import { 
  Wallet, TrendingUp, TrendingDown, DollarSign, 
  Layers, ArrowUpRight, ArrowDownRight 
} from 'lucide-react';
import { usePortfolio } from '@/hooks/useApi';
import type { Portfolio as PortfolioType } from '@/types';

interface PortfolioViewProps {
  address: string;
}

function StatCard({ 
  title, 
  value, 
  subvalue, 
  icon: Icon, 
  trend,
  isPositive 
}: { 
  title: string; 
  value: string; 
  subvalue?: string;
  icon: React.ElementType;
  trend?: number;
  isPositive?: boolean;
}) {
  return (
    <div className="card card-hover p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-text-secondary mb-1">{title}</p>
          <p className="text-2xl font-bold text-text-primary">{value}</p>
          {subvalue && (
            <p className="text-sm text-text-tertiary mt-1">{subvalue}</p>
          )}
        </div>
        <div className="p-2 bg-surface-hover rounded-lg">
          <Icon className="w-5 h-5 text-primary" />
        </div>
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 mt-3 text-sm ${isPositive ? 'text-success' : 'text-danger'}`}>
          {isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
          <span>{Math.abs(trend).toFixed(2)}%</span>
          <span className="text-text-tertiary ml-1">24h</span>
        </div>
      )}
    </div>
  );
}

function ChainBreakdown({ chains }: { chains: PortfolioType['chains'] }) {
  return (
    <div className="card p-5">
      <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
        <Layers className="w-5 h-5 text-primary" />
        Chain Breakdown
      </h3>
      <div className="space-y-4">
        {chains.map((chain) => (
          <div key={chain.name}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm text-text-secondary">{chain.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-text-primary">
                  ${chain.value.toLocaleString()}
                </span>
                <span className="text-xs text-text-tertiary">({chain.percentage}%)</span>
              </div>
            </div>
            <div className="h-2 bg-surface-hover rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${chain.percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TokenHoldings({ tokens }: { tokens: PortfolioType['tokens'] }) {
  return (
    <div className="card p-5">
      <h3 className="text-lg font-semibold text-text-primary mb-4">Token Holdings</h3>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs text-text-tertiary border-b border-surface-border">
              <th className="pb-3 font-medium">Token</th>
              <th className="pb-3 font-medium text-right">Balance</th>
              <th className="pb-3 font-medium text-right">Price</th>
              <th className="pb-3 font-medium text-right">Value</th>
              <th className="pb-3 font-medium text-right">Chain</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {tokens.map((token, index) => (
              <tr key={index} className="group hover:bg-surface-hover/50 transition-colors">
                <td className="py-3">
                  <div className="flex items-center gap-3">
                    {token.logoUrl ? (
                      <img src={token.logoUrl} alt={token.symbol} className="w-8 h-8 rounded-full" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-surface-hover flex items-center justify-center text-xs font-bold text-primary">
                        {token.symbol.slice(0, 2)}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-text-primary">{token.symbol}</p>
                      <p className="text-xs text-text-tertiary">{token.name}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3 text-right text-sm text-text-secondary">
                  {token.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                </td>
                <td className="py-3 text-right text-sm text-text-secondary">
                  ${token.price.toFixed(4)}
                </td>
                <td className="py-3 text-right">
                  <span className="font-medium text-text-primary">
                    ${token.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </td>
                <td className="py-3 text-right">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-surface-hover text-text-secondary">
                    {token.chain}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function PortfolioView({ address }: PortfolioViewProps) {
  const { data, loading, error } = usePortfolio(address);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-surface rounded-xl" />
          ))}
        </div>
        <div className="h-64 bg-surface rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-danger/10 flex items-center justify-center">
          <TrendingDown className="w-8 h-8 text-danger" />
        </div>
        <h3 className="text-lg font-semibold text-text-primary mb-2">Failed to load portfolio</h3>
        <p className="text-text-secondary">{error.message}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card p-8 text-center">
        <p className="text-text-secondary">No portfolio data available</p>
      </div>
    );
  }

  const isPositivePnl = data.pnl24h >= 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Portfolio Value"
          value={`$${data.totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
          icon={Wallet}
          trend={data.pnl24hPercent}
          isPositive={isPositivePnl}
        />
        <StatCard
          title="Spot Value"
          value={`$${data.spotValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
          icon={DollarSign}
        />
        <StatCard
          title="Polymarket Value"
          value={`$${data.polymarketValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
          icon={TrendingUp}
        />
        <StatCard
          title="24h P&L"
          value={`${isPositivePnl ? '+' : ''}$${Math.abs(data.pnl24h).toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
          subvalue={`${isPositivePnl ? '+' : ''}${data.pnl24hPercent.toFixed(2)}%`}
          icon={isPositivePnl ? ArrowUpRight : ArrowDownRight}
          trend={data.pnl24hPercent}
          isPositive={isPositivePnl}
        />
      </div>

      {/* Chain Breakdown & Holdings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <ChainBreakdown chains={data.chains} />
        </div>
        <div className="lg:col-span-2">
          <TokenHoldings tokens={data.tokens} />
        </div>
      </div>
    </div>
  );
}
