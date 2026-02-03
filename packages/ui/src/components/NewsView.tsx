import { useState, useMemo } from 'react';
import { Newspaper, ExternalLink, AlertTriangle, TrendingUp, TrendingDown, Minus, Filter } from 'lucide-react';
import { useNews, usePositions } from '@/hooks/useApi';
import type { NewsItem, Position } from '@/types';

interface NewsViewProps {
  address?: string;
}

// Extract keywords from position titles for news filtering
function extractKeywordsFromPositions(positions: Position[]): string[] {
  const keywords = new Set<string>();
  
  const keywordMap: Record<string, string[]> = {
    'trump': ['trump', 'president', 'election', 'politics', 'white house'],
    'biden': ['biden', 'president', 'election', 'politics', 'democrat'],
    'crypto': ['crypto', 'bitcoin', 'ethereum', 'blockchain', 'defi', 'cryptocurrency'],
    'bitcoin': ['bitcoin', 'btc', 'crypto', 'cryptocurrency'],
    'ethereum': ['ethereum', 'eth', 'crypto', 'blockchain'],
    'ai': ['ai', 'artificial intelligence', 'gpt', 'chatgpt', 'claude', 'anthropic', 'openai', 'llm'],
    'google': ['google', 'alphabet', 'ai', 'search', 'tech'],
    'apple': ['apple', 'iphone', 'ios', 'tech', 'stock'],
    'tesla': ['tesla', 'elon', 'musk', 'ev', 'electric'],
    'fed': ['fed', 'federal reserve', 'interest rate', 'powell', 'economy'],
    'war': ['war', 'ukraine', 'russia', 'israel', 'gaza', 'conflict'],
    'olympics': ['olympics', 'sports', 'games'],
    'oscars': ['oscars', 'movies', 'film', 'academy', 'awards'],
    'weather': ['weather', 'storm', 'hurricane', 'temperature', 'climate']
  };
  
  positions.forEach(pos => {
    const lowerTitle = pos.marketTitle.toLowerCase();
    
    // Check for category keywords
    if (pos.category) {
      keywords.add(pos.category.toLowerCase());
    }
    
    // Check for keywords from position titles
    Object.entries(keywordMap).forEach(([category, terms]) => {
      if (terms.some(term => lowerTitle.includes(term))) {
        keywords.add(category);
      }
    });
  });
  
  return Array.from(keywords);
}

function NewsCard({ item, isRelevant }: { item: NewsItem; isRelevant?: boolean }) {
  const sentimentIcon = {
    bullish: <TrendingUp className="w-4 h-4 text-success" />,
    bearish: <TrendingDown className="w-4 h-4 text-danger" />,
    neutral: <Minus className="w-4 h-4 text-muted" />,
  };

  return (
    <div className={`
      card card-hover p-5 relative overflow-hidden
      ${item.isSignal ? 'border-primary/30' : ''}
      ${isRelevant ? 'border-l-4 border-l-primary bg-primary/5' : ''}
    `}>
      {/* Signal/Relevance indicator */}
      {item.isSignal && (
        <div className="absolute top-0 right-0">
          <div className="bg-primary text-black text-xs font-bold px-3 py-1 rounded-bl-lg">
            SIGNAL
          </div>
        </div>
      )}
      
      {isRelevant && !item.isSignal && (
        <div className="absolute top-0 right-0">
          <div className="bg-primary/20 text-primary text-xs font-bold px-3 py-1 rounded-bl-lg">
            RELEVANT
          </div>
        </div>
      )}

      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={`
          flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center
          ${item.isSignal ? 'bg-primary/10' : isRelevant ? 'bg-primary/10' : 'bg-surface-hover'}
        `}>
          {item.isSignal || isRelevant ? (
            <AlertTriangle className={`w-5 h-5 ${item.isSignal ? 'text-primary' : 'text-primary'}`} />
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
          <div className="flex items-center gap-3 text-xs flex-wrap">
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

export default function NewsView({ address }: NewsViewProps) {
  const { data, loading, error } = useNews();
  const { data: positions } = usePositions(address || '');
  const [filter, setFilter] = useState<'all' | 'signals' | 'relevant'>('all');

  // Extract keywords from positions for relevance filtering
  const positionKeywords = useMemo(() => {
    if (!positions || positions.length === 0) return [];
    return extractKeywordsFromPositions(positions);
  }, [positions]);

  // Filter and sort news
  const filteredNews = useMemo(() => {
    let filtered = data;

    if (filter === 'signals') {
      filtered = data.filter(item => item.isSignal);
    } else if (filter === 'relevant' && positionKeywords.length > 0) {
      // Filter to show relevant news based on position keywords
      filtered = data.filter(item => {
        const searchText = `${item.title} ${item.content || ''} ${item.category || ''}`.toLowerCase();
        return positionKeywords.some(keyword => searchText.includes(keyword.toLowerCase()));
      });
    }

    // Sort by: signals first, then relevant, then date
    return [...filtered].sort((a, b) => {
      if (a.isSignal && !b.isSignal) return -1;
      if (!a.isSignal && b.isSignal) return 1;
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });
  }, [data, filter, positionKeywords]);

  // Check if a news item is relevant to positions
  const isItemRelevant = (item: NewsItem): boolean => {
    if (positionKeywords.length === 0) return false;
    const searchText = `${item.title} ${item.content || ''} ${item.category || ''}`.toLowerCase();
    return positionKeywords.some(keyword => searchText.includes(keyword.toLowerCase()));
  };

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
        <div>
          <h2 className="text-xl font-semibold text-text-primary">Latest News</h2>
          {positionKeywords.length > 0 && (
            <p className="text-sm text-text-secondary mt-1">
              Filtering by: {positionKeywords.join(', ')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
            onClick={() => setFilter('relevant')}
            disabled={positionKeywords.length === 0}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${filter === 'relevant'
                ? 'bg-primary text-black' 
                : 'bg-surface border border-surface-border text-text-secondary hover:text-text-primary'}
              ${positionKeywords.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <Filter className="w-3 h-3 inline mr-1" />
            Relevant
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
      {filteredNews.length > 0 ? (
        <div className="space-y-3">
          {filteredNews.map((item) => (
            <NewsCard 
              key={item.id} 
              item={item} 
              isRelevant={filter === 'all' && !item.isSignal ? isItemRelevant(item) : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-hover flex items-center justify-center">
            <Newspaper className="w-8 h-8 text-muted" />
          </div>
          <h3 className="text-lg font-semibold text-text-primary mb-2">No news available</h3>
          <p className="text-text-secondary">
            {filter === 'signals' ? 'No trading signals at the moment' : 
             filter === 'relevant' ? 'No relevant news found for your positions' :
             'Check back later for updates'}
          </p>
        </div>
      )}
    </div>
  );
}
