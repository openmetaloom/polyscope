/**
 * News Routes
 * 
 * Endpoints:
 * GET /api/v1/news - Latest news with trading signals
 */

const express = require('express');
const router = express.Router();
const { cacheMiddleware } = require('../middleware/cache');

// Cache TTL
const NEWS_CACHE_TTL = 300; // 5 minutes

// Mock news data - In production, this would come from a news API or database
const MOCK_NEWS = [
  {
    id: '1',
    title: 'Fed Signals Potential Rate Cuts in Coming Months',
    source: 'Financial Times',
    url: 'https://ft.com/fed-rate-cuts',
    publishedAt: new Date(Date.now() - 3600000).toISOString(),
    category: 'macro',
    summary: 'Federal Reserve officials indicated they are considering rate cuts as inflation shows signs of cooling.',
    signals: {
      impact: 'high',
      relevantMarkets: ['fed-rate-cut-march-2026', 'sp500-march-close'],
      sentiment: 'bullish',
      confidence: 0.75
    }
  },
  {
    id: '2',
    title: 'OpenAI Announces GPT-5 Release Timeline',
    source: 'TechCrunch',
    url: 'https://techcrunch.com/openai-gpt5',
    publishedAt: new Date(Date.now() - 7200000).toISOString(),
    category: 'tech',
    summary: 'OpenAI reveals plans to release GPT-5 in Q2 2026, exceeding previous expectations.',
    signals: {
      impact: 'medium',
      relevantMarkets: ['ai-capabilities-2026', 'openai-agi-timeline'],
      sentiment: 'bullish',
      confidence: 0.82
    }
  },
  {
    id: '3',
    title: 'SEC Approves New Crypto ETF Applications',
    source: 'CoinDesk',
    url: 'https://coindesk.com/sec-approvals',
    publishedAt: new Date(Date.now() - 10800000).toISOString(),
    category: 'crypto',
    summary: 'SEC approves three new cryptocurrency ETF applications, signaling regulatory shift.',
    signals: {
      impact: 'high',
      relevantMarkets: ['btc-etf-flows', 'eth-price-end-q1'],
      sentiment: 'very_bullish',
      confidence: 0.91
    }
  },
  {
    id: '4',
    title: 'Election Polling Shows Tight Race in Swing States',
    source: 'Politico',
    url: 'https://politico.com/swing-states-poll',
    publishedAt: new Date(Date.now() - 14400000).toISOString(),
    category: 'politics',
    summary: 'Latest polling data shows narrowing margins in key swing states for upcoming elections.',
    signals: {
      impact: 'medium',
      relevantMarkets: ['presidential-election-2026', 'senate-control-2026'],
      sentiment: 'neutral',
      confidence: 0.65
    }
  },
  {
    id: '5',
    title: 'Major Sporting Event Sees Record Viewership',
    source: 'ESPN',
    url: 'https://espn.com/viewership-record',
    publishedAt: new Date(Date.now() - 18000000).toISOString(),
    category: 'sports',
    summary: 'Championship game draws largest audience in history for the sport.',
    signals: {
      impact: 'low',
      relevantMarkets: ['nba-finals-viewership', 'sports-betting-volume'],
      sentiment: 'neutral',
      confidence: 0.70
    }
  }
];

/**
 * GET /api/v1/news
 * Get latest news with trading signals
 */
router.get('/',
  cacheMiddleware({ ttl: NEWS_CACHE_TTL }),
  async (req, res, next) => {
    try {
      const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50);
      const category = req.query.category;
      const minConfidence = parseFloat(req.query.minConfidence) || 0;
      const minImpact = req.query.minImpact || 'low';

      // Filter news
      let filteredNews = [...MOCK_NEWS];

      // Filter by category
      if (category) {
        filteredNews = filteredNews.filter(n => 
          n.category.toLowerCase() === category.toLowerCase()
        );
      }

      // Filter by confidence
      if (minConfidence > 0) {
        filteredNews = filteredNews.filter(n => 
          n.signals.confidence >= minConfidence
        );
      }

      // Filter by impact
      const impactLevels = { low: 1, medium: 2, high: 3 };
      const minImpactLevel = impactLevels[minImpact.toLowerCase()] || 1;
      filteredNews = filteredNews.filter(n => 
        impactLevels[n.signals.impact] >= minImpactLevel
      );

      // Sort by published date (newest first)
      filteredNews.sort((a, b) => 
        new Date(b.publishedAt) - new Date(a.publishedAt)
      );

      // Limit results
      const results = filteredNews.slice(0, limit);

      // Calculate signal summary
      const signalSummary = {
        totalArticles: MOCK_NEWS.length,
        returnedArticles: results.length,
        bullishCount: results.filter(n => n.signals.sentiment.includes('bullish')).length,
        bearishCount: results.filter(n => n.signals.sentiment.includes('bearish')).length,
        neutralCount: results.filter(n => n.signals.sentiment === 'neutral').length,
        avgConfidence: results.length > 0 
          ? (results.reduce((sum, n) => sum + n.signals.confidence, 0) / results.length).toFixed(2)
          : 0,
        relevantMarkets: [...new Set(results.flatMap(n => n.signals.relevantMarkets))],
        categories: [...new Set(results.map(n => n.category))]
      };

      // Generate trading insights
      const insights = generateTradingInsights(results);

      res.json({
        success: true,
        data: {
          summary: signalSummary,
          articles: results.map(n => ({
            id: n.id,
            title: n.title,
            source: n.source,
            url: n.url,
            publishedAt: n.publishedAt,
            category: n.category,
            summary: n.summary,
            signals: n.signals
          })),
          insights,
          filters: {
            category,
            minConfidence,
            minImpact
          }
        },
        meta: {
          requestId: req.correlationId,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/news/signals
 * Get aggregated trading signals
 */
router.get('/signals',
  cacheMiddleware({ ttl: NEWS_CACHE_TTL }),
  async (req, res, next) => {
    try {
      const market = req.query.market;
      const timeframe = req.query.timeframe || '24h';

      // Aggregate signals
      const allSignals = MOCK_NEWS.flatMap(n => n.signals);
      
      // If market filter provided, filter signals
      const relevantSignals = market 
        ? allSignals.filter(s => s.relevantMarkets.includes(market))
        : allSignals;

      // Calculate aggregate sentiment
      const sentimentCounts = relevantSignals.reduce((acc, s) => {
        acc[s.sentiment] = (acc[s.sentiment] || 0) + 1;
        return acc;
      }, {});

      const totalSignals = relevantSignals.length;
      const avgConfidence = totalSignals > 0
        ? (relevantSignals.reduce((sum, s) => sum + s.confidence, 0) / totalSignals)
        : 0;

      // Determine overall sentiment
      let overallSentiment = 'neutral';
      if (sentimentCounts.very_bullish > sentimentCounts.very_bearish) {
        overallSentiment = 'very_bullish';
      } else if (sentimentCounts.bullish > sentimentCounts.bearish) {
        overallSentiment = 'bullish';
      } else if (sentimentCounts.bearish > sentimentCounts.bullish) {
        overallSentiment = 'bearish';
      }

      res.json({
        success: true,
        data: {
          aggregate: {
            sentiment: overallSentiment,
            confidence: avgConfidence.toFixed(2),
            signalCount: totalSignals,
            bullishSignals: (sentimentCounts.bullish || 0) + (sentimentCounts.very_bullish || 0),
            bearishSignals: (sentimentCounts.bearish || 0) + (sentimentCounts.very_bearish || 0),
            neutralSignals: sentimentCounts.neutral || 0
          },
          topMarkets: getTopMarkets(allSignals, 5),
          timeframe,
          lastUpdated: new Date().toISOString()
        },
        meta: {
          requestId: req.correlationId,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Generate trading insights from news
 */
function generateTradingInsights(news) {
  const insights = [];
  
  // High confidence bullish signals
  const bullishSignals = news.filter(n => 
    n.signals.sentiment.includes('bullish') && n.signals.confidence > 0.8
  );
  
  if (bullishSignals.length > 0) {
    insights.push({
      type: 'opportunity',
      priority: 'high',
      message: `${bullishSignals.length} high-confidence bullish signals detected`,
      markets: [...new Set(bullishSignals.flatMap(n => n.signals.relevantMarkets))],
      confidence: 0.85
    });
  }

  // Time-sensitive alerts
  const timeSensitive = news.filter(n => 
    n.signals.relevantMarkets.some(m => m.includes('resolution'))
  );
  
  if (timeSensitive.length > 0) {
    insights.push({
      type: 'alert',
      priority: 'medium',
      message: `${timeSensitive.length} articles related to near-resolution markets`,
      recommendation: 'Review positions in affected markets',
      markets: [...new Set(timeSensitive.flatMap(n => n.signals.relevantMarkets))]
    });
  }

  // Correlation detection
  const categories = [...new Set(news.map(n => n.category))];
  if (categories.length > 1) {
    insights.push({
      type: 'correlation',
      priority: 'low',
      message: `Multiple market categories showing activity`,
      categories,
      recommendation: 'Consider portfolio diversification'
    });
  }

  return insights;
}

/**
 * Get top markets by signal count
 */
function getTopMarkets(signals, limit) {
  const marketCounts = signals.flatMap(s => s.relevantMarkets)
    .reduce((acc, market) => {
      acc[market] = (acc[market] || 0) + 1;
      return acc;
    }, {});

  return Object.entries(marketCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([market, count]) => ({ market, signalCount: count }));
}

module.exports = router;