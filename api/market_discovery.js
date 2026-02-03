/**
 * Market Discovery Module
 * 
 * Find and rank Polymarket markets based on:
 * - Keywords (AI, crypto, tech, etc.)
 * - Liquidity and volume
 * - Time to resolution
 * - Market categories
 */

const PolymarketAPI = require('./polymarket_api');

class MarketDiscovery {
  constructor(options = {}) {
    this.api = new PolymarketAPI(options);
    this.discoveredMarkets = new Map();
    this.watchList = new Set();
  }

  /**
   * Search for markets by keywords
   * Returns ranked results by relevance, liquidity, and resolution time
   */
  async searchByKeywords(keywords, options = {}) {
    const results = [];
    const searchTerms = Array.isArray(keywords) ? keywords : [keywords];
    
    // Fetch active markets
    let markets = [];
    try {
      markets = await this.api.getMarkets({
        limit: options.limit || 500,
        active: true,
        closed: false
      });
    } catch (error) {
      console.error('Error fetching markets:', error.message);
      return []; // Return empty array on error
    }

    // Ensure markets is an array
    if (!Array.isArray(markets)) {
      return []; // Return empty array if markets is not an array
    }

    for (const market of markets) {
      const matchScore = this.calculateMatchScore(market, searchTerms);
      
      if (matchScore > 0) {
        const enriched = await this.enrichMarketData(market);
        results.push({
          ...enriched,
          matchScore,
          relevance: this.calculateRelevance(enriched)
        });
      }
    }

    // Sort by composite score and return
    const sorted = results
      .sort((a, b) => b.relevance.compositeScore - a.relevance.compositeScore)
      .slice(0, options.maxResults || 20);
    
    // Always return an array (empty if no matches)
    return sorted || [];
  }

  /**
   * Calculate keyword match score
   */
  calculateMatchScore(market, searchTerms) {
    const text = `${market.question} ${market.description || ''} ${market.category || ''}`.toLowerCase();
    let score = 0;

    for (const term of searchTerms) {
      const termLower = term.toLowerCase();
      
      // Exact match in question (highest weight)
      if (market.question?.toLowerCase().includes(termLower)) {
        score += 10;
      }
      
      // Match in description
      if (market.description?.toLowerCase().includes(termLower)) {
        score += 5;
      }
      
      // Match in category
      if (market.category?.toLowerCase().includes(termLower)) {
        score += 3;
      }
      
      // Partial word match
      const words = text.split(/\s+/);
      for (const word of words) {
        if (word.includes(termLower) || termLower.includes(word)) {
          score += 1;
        }
      }
    }

    return score;
  }

  /**
   * Enrich market data with additional metrics
   */
  async enrichMarketData(market) {
    const daysToResolution = PolymarketAPI.getDaysToResolution(market.endDate);
    
    // Parse prices
    let yesPrice = 0.5;
    let noPrice = 0.5;
    try {
      const prices = JSON.parse(market.outcomePrices || '[0.5, 0.5]');
      yesPrice = parseFloat(prices[0]);
      noPrice = parseFloat(prices[1]);
    } catch (e) {}

    return {
      id: market.id,
      question: market.question,
      slug: market.slug,
      category: market.category,
      
      // Prices
      yesPrice,
      noPrice,
      yesProbability: (yesPrice * 100).toFixed(1) + '%',
      noProbability: (noPrice * 100).toFixed(1) + '%',
      
      // Volume and liquidity
      volume24h: parseFloat(market.volume24hr || 0),
      totalVolume: parseFloat(market.volume || 0),
      liquidity: parseFloat(market.liquidityNum || 0),
      
      // Resolution
      endDate: market.endDate,
      daysToResolution,
      resolutionDescription: market.description?.substring(0, 200) + '...',
      
      // Status
      acceptingOrders: market.acceptingOrders,
      spread: parseFloat(market.spread || 0),
      
      // Links
      url: `https://polymarket.com/event/${market.slug}`,
      
      // Last update
      lastUpdated: market.updatedAt
    };
  }

  /**
   * Calculate market relevance score
   */
  calculateRelevance(market) {
    // Liquidity score (0-100)
    const liquidityScore = Math.min(100, (market.liquidity / 50000) * 100);
    
    // Volume score (0-100)
    const volumeScore = Math.min(100, (market.volume24h / 10000) * 100);
    
    // Time score (markets resolving in 7-90 days get higher scores)
    let timeScore = 0;
    if (market.daysToResolution > 0) {
      if (market.daysToResolution <= 7) {
        timeScore = 30; // Too soon
      } else if (market.daysToResolution <= 90) {
        timeScore = 100; // Sweet spot
      } else if (market.daysToResolution <= 365) {
        timeScore = 70; // Reasonable
      } else {
        timeScore = 40; // Too far
      }
    }
    
    // Spread score (lower spread = better)
    const spreadScore = Math.max(0, 100 - (market.spread * 100));
    
    // Composite score (weighted)
    const compositeScore = 
      (liquidityScore * 0.35) +
      (volumeScore * 0.25) +
      (timeScore * 0.25) +
      (spreadScore * 0.15);

    return {
      compositeScore: Math.round(compositeScore),
      liquidityScore: Math.round(liquidityScore),
      volumeScore: Math.round(volumeScore),
      timeScore: Math.round(timeScore),
      spreadScore: Math.round(spreadScore)
    };
  }

  /**
   * Find AI/tech related markets
   */
  async findAITechMarkets(options = {}) {
    const keywords = [
      'AI', 'artificial intelligence', 'chatbot', 'GPT', 'Claude', 'Gemini',
      'Google', 'OpenAI', 'Anthropic', 'xAI', 'Grok', 'LLM',
      'model', 'benchmark', 'coding', 'programming',
      'tech', 'technology', 'software', 'app'
    ];
    
    return this.searchByKeywords(keywords, {
      limit: options.limit || 500,
      maxResults: options.maxResults || 15
    });
  }

  /**
   * Find crypto markets
   */
  async findCryptoMarkets(options = {}) {
    const keywords = [
      'crypto', 'bitcoin', 'ethereum', 'BTC', 'ETH',
      'blockchain', 'DeFi', 'NFT', 'altcoin',
      'liquidation', 'ETF', 'SEC', 'regulation',
      'MicroStrategy', 'Coinbase', 'Binance'
    ];
    
    return this.searchByKeywords(keywords, {
      limit: options.limit || 500,
      maxResults: options.maxResults || 15
    });
  }

  /**
   * Find political markets
   */
  async findPoliticalMarkets(options = {}) {
    const keywords = [
      'election', 'Trump', 'Biden', 'political',
      'vote', 'president', 'congress', 'senate'
    ];
    
    return this.searchByKeywords(keywords, {
      limit: options.limit || 500,
      maxResults: options.maxResults || 15
    });
  }

  /**
   * Find high-liquidity markets (good for trading)
   */
  async findHighLiquidityMarkets(minLiquidity = 50000, options = {}) {
    const markets = await this.api.getMarkets({
      limit: options.limit || 200,
      active: true,
      closed: false
    });

    const filtered = markets
      .filter(m => parseFloat(m.liquidityNum || 0) >= minLiquidity)
      .map(m => ({
        id: m.id,
        question: m.question,
        slug: m.slug,
        liquidity: parseFloat(m.liquidityNum || 0),
        volume24h: parseFloat(m.volume24hr || 0),
        yesPrice: parseFloat(JSON.parse(m.outcomePrices || '[0.5, 0.5]')[0]),
        daysToResolution: PolymarketAPI.getDaysToResolution(m.endDate),
        url: `https://polymarket.com/event/${m.slug}`
      }));

    return filtered
      .sort((a, b) => b.liquidity - a.liquidity)
      .slice(0, options.maxResults || 20);
  }

  /**
   * Find markets by resolution timeframe
   */
  async findMarketsByTimeframe(daysMin, daysMax, options = {}) {
    const markets = await this.api.getMarkets({
      limit: options.limit || 500,
      active: true,
      closed: false
    });

    const filtered = [];
    
    for (const market of markets) {
      const daysToResolution = PolymarketAPI.getDaysToResolution(market.endDate);
      
      if (daysToResolution >= daysMin && daysToResolution <= daysMax) {
        const enriched = await this.enrichMarketData(market);
        filtered.push(enriched);
      }
    }

    return filtered
      .sort((a, b) => b.liquidity - a.liquidity)
      .slice(0, options.maxResults || 20);
  }

  /**
   * Get "hot" markets (high recent volume)
   */
  async getHotMarkets(options = {}) {
    const markets = await this.api.getMarkets({
      limit: options.limit || 200,
      active: true,
      closed: false
    });

    const scored = markets.map(m => {
      const volume24h = parseFloat(m.volume24hr || 0);
      const liquidity = parseFloat(m.liquidityNum || 0);
      
      // Hot score based on volume relative to liquidity
      const hotScore = liquidity > 0 ? (volume24h / liquidity) * 100 : 0;
      
      return {
        id: m.id,
        question: m.question,
        slug: m.slug,
        volume24h,
        liquidity,
        hotScore: Math.round(hotScore * 100) / 100,
        yesPrice: parseFloat(JSON.parse(m.outcomePrices || '[0.5, 0.5]')[0]),
        url: `https://polymarket.com/event/${m.slug}`
      };
    });

    return scored
      .filter(m => m.hotScore > 0)
      .sort((a, b) => b.hotScore - a.hotScore)
      .slice(0, options.maxResults || 15);
  }

  /**
   * Find arbitrage opportunities (markets where YES+NO < 1)
   */
  async findArbitrageOpportunities(threshold = 0.02, options = {}) {
    const markets = await this.api.getMarkets({
      limit: options.limit || 500,
      active: true,
      closed: false
    });

    const opportunities = [];

    for (const market of markets) {
      try {
        const prices = JSON.parse(market.outcomePrices || '[0.5, 0.5]');
        const yesPrice = parseFloat(prices[0]);
        const noPrice = parseFloat(prices[1]);
        const sum = yesPrice + noPrice;
        
        // Arbitrage exists when sum < 1 - fees (~0.98)
        if (sum < (1 - threshold)) {
          const profit = (1 - sum) * 100;
          opportunities.push({
            id: market.id,
            question: market.question,
            slug: market.slug,
            yesPrice,
            noPrice,
            sum,
            potentialProfit: profit.toFixed(2) + '%',
            liquidity: parseFloat(market.liquidityNum || 0),
            url: `https://polymarket.com/event/${market.slug}`
          });
        }
      } catch (e) {
        continue;
      }
    }

    return opportunities
      .sort((a, b) => parseFloat(b.potentialProfit) - parseFloat(a.potentialProfit))
      .slice(0, options.maxResults || 10);
  }

  /**
   * Watch a market for changes
   */
  watchMarket(marketId) {
    this.watchList.add(marketId);
  }

  /**
   * Unwatch a market
   */
  unwatchMarket(marketId) {
    this.watchList.delete(marketId);
  }

  /**
   * Get all watched markets with current data
   */
  async getWatchedMarkets() {
    const results = [];
    
    for (const marketId of this.watchList) {
      try {
        const data = await this.api.getCompleteMarketData(marketId);
        results.push(data);
      } catch (e) {
        console.error(`Failed to get data for market ${marketId}:`, e.message);
      }
    }
    
    return results;
  }

  /**
   * Generate market discovery report
   */
  async generateDiscoveryReport(options = {}) {
    const report = {
      timestamp: new Date().toISOString(),
      sections: {}
    };

    // AI/Tech markets
    if (options.includeAI !== false) {
      report.sections.aiTech = await this.findAITechMarkets({ maxResults: 10 });
    }

    // Crypto markets
    if (options.includeCrypto !== false) {
      report.sections.crypto = await this.findCryptoMarkets({ maxResults: 10 });
    }

    // High liquidity markets
    if (options.includeHighLiquidity !== false) {
      report.sections.highLiquidity = await this.findHighLiquidityMarkets(50000, { maxResults: 10 });
    }

    // Hot markets
    if (options.includeHot !== false) {
      report.sections.hotMarkets = await this.getHotMarkets({ maxResults: 10 });
    }

    // Arbitrage opportunities
    if (options.includeArbitrage !== false) {
      report.sections.arbitrage = await this.findArbitrageOpportunities(0.02, { maxResults: 5 });
    }

    return report;
  }
}

module.exports = MarketDiscovery;
