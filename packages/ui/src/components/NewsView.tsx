import { useState } from 'react';
import { Newspaper, ExternalLink, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useNews } from '@/hooks/useApi';
import type { NewsItem } from '@/types';

interface NewsViewProps {}

function NewsCard({ item }: { item: NewsItem }) {
  const sentimentIcon = {
    bullish: <TrendingUp className="w-4 h-4 text-success" />,
    bearish: <TrendingDown className="w-4 h-4 text-danger" />,
    neutral: <Minus className="w-4 h-4 text-muted" />,
  };

  return (
    <div className={`
      card card-hover p-5 relative overflow-hidden
      ${item.isSignal ? 'border-primary/30' : ''}
    `}>
      {/* Signal indicator */}
      {item.isSignal && (
        <div className="absolute top-0 right-0">
          <div className="bg-primary text-black text-xs font-bold px-3 py-1 rounded-bl-lg">
            SIGNAL
          </div>
        </div>
      )}

      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={`
          flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center
          ${item.isSignal ? 'bg-primary/10' : 'bg-surface-hover'}
        `}>
          {item.isSignal ? (
            <AlertTriangle className="w-5 h-5 text-primary" />
          ) : (
            <Newspaper className="w-5 h-5 text-text-secondary" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className="font-medium text-text-primary mb-1 line-clamp-2">
            {item.title}
          </h3>

          {/* Content preview */}
          {item.content && (
            <p className="text-sm text-text-secondary line-clamp-2 mb-3">
              {item.content}
            </p>
          )}

          {/* Meta */}
          <div className="flex items-center gap-3 text-xs">
            <span className="text-text-tertiary">{item.source}</span>
            <span className="text-surface-border">•</span>
            <span className="text-text-tertiary">
              {new Date(item.publishedAt).toLocaleDateString()}
            </span>
            
            {item.sentiment && (
              <>
                <span className="text-surface-border">•</span>
                <div className="flex items-center gap-1">
                  {sentimentIcon[item.sentiment]}
                  <span className={`
                    capitalize
                    ${item.sentiment === 'bullish' ? 'text-success' : ''}
                    ${item.sentiment === 'bearish' ? 'text-danger' : ''}
                    ${item.sentiment === 'neutral' ? 'text-muted' : ''}
                  `}>
                    {item.sentiment}
                  </span>
                </div>
              </>
            )}

            {item.category && (
              <>
                <span className="text-surface-border">•</span>
                <span className="badge badge-primary">{item.category}</span>
              </>
            )}
          </div>

          {/* Related markets */}
          {item.relatedMarkets && item.relatedMarkets.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {item.relatedMarkets.map((market, i) => (
                <span 
                  key={i}
                  className="text-xs px-2 py-1 bg-surface-hover rounded text-text-secondary"
                >
                  {market}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* External link */}
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 p-2 hover:bg-surface-hover rounded-lg transition-colors"
          >
            <ExternalLink className="w-4 h-4 text-muted" />
          </a>
        )}
      </div>
    </div>
  );
}

export default function NewsView({}: NewsViewProps) {
  const { data, loading, error } = useNews();
  const [filter, setFilter] = useState<'all' | 'signals'>('all');

  const filteredNews = filter === 'signals' 
    ? data.filter(item => item.isSignal)
    : data;

  // Sort by date, signals first
  const sortedNews = [...filteredNews].sort((a, b) => {
    if (a.isSignal && !b.isSignal) return -1;
    if (!a.isSignal && b.isSignal) return 1;
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-32 bg-surface rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-danger/10 flex items-center justify-center">
          <Newspaper className="w-8 h-8 text-danger" />
        </div>
        <h3 className="text-lg font-semibold text-text-primary mb-2">Failed to load news</h3>
        <p className="text-text-secondary">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-xl font-semibold text-text-primary">Latest News</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${filter === 'all' 
                ? 'bg-primary text-black' 
                : 'bg-surface border border-surface-border text-text-secondary hover:text-text-primary'}
            `}
          >
            All News
          </button>
          <button
            onClick={() => setFilter('signals')}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${filter === 'signals' 
                ? 'bg-primary text-black' 
                : 'bg-surface border border-surface-border text-text-secondary hover:text-text-primary'}
            `}
          >
            Signals
            {data.filter(i => i.isSignal).length > 0 && (
              <span className="ml-2 text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                {data.filter(i => i.isSignal).length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* News List */}
      {sortedNews.length > 0 ? (
        <div className="space-y-3">
          {sortedNews.map((item) => (
            <NewsCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-hover flex items-center justify-center">
            <Newspaper className="w-8 h-8 text-muted" />
          </div>
          <h3 className="text-lg font-semibold text-text-primary mb-2">No news available</h3>
          <p className="text-text-secondary">
            {filter === 'signals' ? 'No trading signals at the moment' : 'Check back later for updates'}
          </p>
        </div>
      )}
    </div>
  );
}
