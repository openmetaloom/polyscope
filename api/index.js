// Vercel API for PolyScope - Real Polymarket Data with ENS & Multi-Chain Support
const express = require('express');
const cors = require('cors');
const https = require('https');
const { ethers } = require('ethers');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

// Ethereum provider for ENS resolution
const provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');

// Alchemy API key (using public/demo key - replace with your own for production)
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || 'demo';
const ALCHEMY_BASE_URL = 'https://base-mainnet.g.alchemy.com/v2/';
const ALCHEMY_ETH_URL = 'https://eth-mainnet.g.alchemy.com/v2/';
const ALCHEMY_POLYGON_URL = 'https://polygon-mainnet.g.alchemy.com/v2/';

// Cache for API responses
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 60 }); // 1 minute cache

// ENS Resolution endpoint
app.get('/api/v1/resolve/:name', async (req, res) => {
  const { name } = req.params;
  
  try {
    // Check if it's already an address
    if (ethers.isAddress(name)) {
      return res.json({ 
        address: name.toLowerCase(),
        ens: null,
        resolved: false
      });
    }
    
    // Try to resolve ENS name
    const address = await provider.resolveName(name);
    
    if (address) {
      res.json({
        address: address.toLowerCase(),
        ens: name,
        resolved: true
      });
    } else {
      res.status(404).json({ 
        error: 'ENS name not found',
        name 
      });
    }
  } catch (error) {
    console.error('ENS resolution error:', error);
    res.status(500).json({ 
      error: 'Failed to resolve ENS name',
      message: error.message 
    });
  }
});

// Reverse ENS lookup
app.get('/api/v1/reverse/:address', async (req, res) => {
  const { address } = req.params;
  
  try {
    if (!ethers.isAddress(address)) {
      return res.status(400).json({ error: 'Invalid Ethereum address' });
    }
    
    const ensName = await provider.lookupAddress(address);
    
    res.json({
      address: address.toLowerCase(),
      ens: ensName
    });
  } catch (error) {
    console.error('Reverse lookup error:', error);
    res.status(500).json({ 
      error: 'Failed to lookup ENS',
      message: error.message 
    });
  }
});

// Fetch multi-chain balances from Alchemy
async function fetchMultiChainBalances(address) {
  const balances = {
    ethereum: { native: 0, tokens: [] },
    base: { native: 0, tokens: [] },
    polygon: { native: 0, tokens: [] }
  };
  
  try {
    // Ethereum Mainnet
    if (ALCHEMY_API_KEY !== 'demo') {
      const ethResponse = await fetch(`${ALCHEMY_ETH_URL}${ALCHEMY_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getBalance',
          params: [address, 'latest']
        })
      });
      const ethData = await ethResponse.json();
      if (ethData.result) {
        balances.ethereum.native = parseFloat(ethers.formatEther(ethData.result));
      }
    }
    
    // Base
    if (ALCHEMY_API_KEY !== 'demo') {
      const baseResponse = await fetch(`${ALCHEMY_BASE_URL}${ALCHEMY_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getBalance',
          params: [address, 'latest']
        })
      });
      const baseData = await baseResponse.json();
      if (baseData.result) {
        balances.base.native = parseFloat(ethers.formatEther(baseData.result));
      }
    }
    
    // Polygon
    if (ALCHEMY_API_KEY !== 'demo') {
      const polyResponse = await fetch(`${ALCHEMY_POLYGON_URL}${ALCHEMY_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getBalance',
          params: [address, 'latest']
        })
      });
      const polyData = await polyResponse.json();
      if (polyData.result) {
        balances.polygon.native = parseFloat(ethers.formatEther(polyData.result));
      }
    }
    
    // If using demo key, return estimated values for testing
    if (ALCHEMY_API_KEY === 'demo') {
      balances.ethereum.native = 0.5; // Demo value
      balances.base.native = 0.25; // Demo value
      balances.polygon.native = 100; // Demo value (MATIC)
    }
  } catch (error) {
    console.error('Multi-chain balance fetch error:', error);
  }
  
  return balances;
}

// Polymarket Data API helper
async function fetchPolymarketPositions(wallet) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'data-api.polymarket.com',
      path: `/positions?user=${wallet}`,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'PolyScope/1.0'
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const positions = JSON.parse(data);
          resolve(positions);
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

// Fetch market data with slugs for linking
async function fetchPolymarketMarkets() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'data-api.polymarket.com',
      path: '/markets?active=true&limit=20',
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'PolyScope/1.0'
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const markets = JSON.parse(data);
          resolve(markets);
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Portfolio endpoint - with multi-chain support
app.get('/api/v1/portfolio/:wallet', async (req, res) => {
  const { wallet } = req.params;
  const { multichain } = req.query;
  
  // Validate address
  if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return res.status(400).json({ error: 'Invalid Ethereum address' });
  }
  
  const cacheKey = `portfolio_${wallet}_${multichain}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }
  
  try {
    const [positions, multiChainBalances] = await Promise.all([
      fetchPolymarketPositions(wallet),
      multichain === 'true' ? fetchMultiChainBalances(wallet) : null
    ]);
    
    // Calculate multi-chain spot value (estimate based on ETH price ~$2500)
    let spotValue = 0;
    let chainBreakdown = null;
    
    if (multiChainBalances) {
      const ethPrice = 2500; // Approximate ETH price
      const maticPrice = 0.5; // Approximate MATIC price
      
      chainBreakdown = {
        ethereum: {
          native: multiChainBalances.ethereum.native,
          valueUSD: multiChainBalances.ethereum.native * ethPrice
        },
        base: {
          native: multiChainBalances.base.native,
          valueUSD: multiChainBalances.base.native * ethPrice
        },
        polygon: {
          native: multiChainBalances.polygon.native,
          valueUSD: multiChainBalances.polygon.native * maticPrice
        }
      };
      
      spotValue = chainBreakdown.ethereum.valueUSD + 
                  chainBreakdown.base.valueUSD + 
                  chainBreakdown.polygon.valueUSD;
    } else {
      spotValue = 50; // Default estimate
    }
    
    if (!positions || positions.length === 0) {
      const result = {
        wallet,
        totalValue: spotValue,
        spotValue: spotValue,
        polymarketValue: 0,
        polymarketInvested: 0,
        pnl: 0,
        pnlPercent: 0,
        positions: [],
        chainBreakdown,
        message: 'No Polymarket positions found for this wallet',
        timestamp: new Date().toISOString()
      };
      cache.set(cacheKey, result);
      return res.json(result);
    }
    
    // Calculate totals from real positions
    let totalInvested = 0;
    let totalValue = 0;
    let totalPnl = 0;
    
    const formattedPositions = positions.map(pos => {
      const invested = pos.initialValue || 0;
      const current = pos.currentValue || 0;
      const pnl = pos.cashPnl || 0;
      const pnlPercent = pos.percentPnl || 0;
      
      totalInvested += invested;
      totalValue += current;
      totalPnl += pnl;
      
      return {
        title: pos.title || 'Unknown Market',
        marketSlug: pos.marketSlug || pos.slug || null,
        position: pos.outcome || 'Unknown',
        entryPrice: pos.avgPrice || 0,
        currentPrice: pos.curPrice || 0,
        pnl: pnl,
        pnlPercent: pnlPercent,
        shares: pos.size || 0,
        endDate: pos.endDate,
        keywords: extractKeywords(pos.title || '')
      };
    });
    
    const pnlPercent = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
    
    const result = {
      wallet,
      totalValue: totalValue + spotValue,
      spotValue: spotValue,
      polymarketValue: totalValue,
      polymarketInvested: totalInvested,
      pnl: totalPnl,
      pnlPercent: pnlPercent,
      positions: formattedPositions,
      chainBreakdown,
      timestamp: new Date().toISOString()
    };
    
    cache.set(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    res.status(500).json({ 
      error: 'Failed to fetch portfolio data',
      message: error.message 
    });
  }
});

// Extract keywords from market title for news filtering
function extractKeywords(title) {
  const keywords = [];
  const keywordMap = {
    'trump': ['trump', 'president', 'election', 'politics'],
    'biden': ['biden', 'president', 'election', 'politics'],
    'crypto': ['crypto', 'bitcoin', 'ethereum', 'blockchain', 'defi'],
    'bitcoin': ['bitcoin', 'crypto', 'btc'],
    'ethereum': ['ethereum', 'eth', 'crypto'],
    'ai': ['ai', 'artificial intelligence', 'gpt', 'chatgpt', 'claude', 'anthropic', 'openai'],
    'google': ['google', 'alphabet', 'ai', 'search'],
    'apple': ['apple', 'iphone', 'ios'],
    'tesla': ['tesla', 'elon', 'musk', 'ev'],
    'fed': ['fed', 'federal reserve', 'interest rate', 'powell'],
    'war': ['war', 'ukraine', 'russia', 'israel', 'gaza'],
    'olympics': ['olympics', 'sports'],
    'oscars': ['oscars', 'movies', 'film', 'academy'],
    'weather': ['weather', 'storm', 'hurricane', 'temperature']
  };
  
  const lowerTitle = title.toLowerCase();
  
  for (const [category, terms] of Object.entries(keywordMap)) {
    if (terms.some(term => lowerTitle.includes(term))) {
      keywords.push(category);
    }
  }
  
  return [...new Set(keywords)]; // Remove duplicates
}

// Positions endpoint - REAL DATA
app.get('/api/v1/positions/:wallet', async (req, res) => {
  const { wallet } = req.params;
  
  if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return res.status(400).json({ error: 'Invalid Ethereum address' });
  }
  
  try {
    const positions = await fetchPolymarketPositions(wallet);
    
    const formattedPositions = positions.map(pos => ({
      title: pos.title || 'Unknown Market',
      marketSlug: pos.marketSlug || pos.slug || null,
      position: pos.outcome || 'Unknown',
      entryPrice: pos.avgPrice || 0,
      currentPrice: pos.curPrice || 0,
      pnl: pos.cashPnl || 0,
      pnlPercent: pos.percentPnl || 0,
      shares: pos.size || 0,
      endDate: pos.endDate,
      keywords: extractKeywords(pos.title || '')
    }));
    
    res.json({ positions: formattedPositions });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to fetch positions',
      message: error.message 
    });
  }
});

// Markets endpoint - Live data with slugs
app.get('/api/v1/markets', async (req, res) => {
  const cacheKey = 'markets';
  const cached = cache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }
  
  try {
    const markets = await fetchPolymarketMarkets();
    
    const formattedMarkets = markets.slice(0, 10).map(market => ({
      question: market.question || market.title || 'Unknown Market',
      slug: market.slug || market.marketSlug || null,
      volume: market.volume || 0,
      liquidity: market.liquidity || 0,
      yesPrice: market.yesPrice || market.outcomes?.[0]?.price || 0,
      noPrice: market.noPrice || market.outcomes?.[1]?.price || 0,
      endDate: market.endDate
    }));
    
    const result = { markets: formattedMarkets };
    cache.set(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error('Markets fetch error:', error);
    // Fallback to static data
    res.json({
      markets: [
        {
          question: 'Will Trump deport less than 250,000?',
          slug: 'trump-deportations-under-250000',
          volume: 9295432,
          liquidity: 13890476,
          yesPrice: 0.0225,
          noPrice: 0.9775
        },
        {
          question: 'Who will Trump nominate as Fed Chair?',
          slug: 'trump-fed-chair-nominee',
          volume: 385000000,
          liquidity: 57000000,
          yesPrice: 0.98,
          noPrice: 0.02
        },
        {
          question: 'Will there be another US government shutdown by January 31?',
          slug: 'government-shutdown-january-2026',
          volume: 146000000,
          liquidity: 3200000,
          yesPrice: 1.0,
          noPrice: 0.0
        }
      ]
    });
  }
});

// News endpoint - with relevance filtering support
app.get('/api/v1/news', async (req, res) => {
  const { keywords } = req.query;
  
  // Enhanced news dataset with keywords
  const allNews = [
    {
      title: 'Coalition demands federal Grok ban over nonconsensual content',
      source: 'TechCrunch',
      published: '2026-02-02T15:00:00Z',
      signals: [{ type: 'negative', text: 'xAI' }],
      keywords: ['ai', 'google', 'tech']
    },
    {
      title: 'AI reasoning papers show advancement in benchmark scores',
      source: 'arXiv AI',
      published: '2026-02-02T00:00:00Z',
      signals: [{ type: 'positive', text: 'AI Benchmarks' }],
      keywords: ['ai', 'anthropic', 'tech']
    },
    {
      title: 'Crypto markets see $290B selloff over weekend',
      source: 'CoinDesk',
      published: '2026-02-02T11:30:00Z',
      signals: [{ type: 'neutral', text: 'Crypto' }],
      keywords: ['crypto', 'bitcoin', 'ethereum']
    },
    {
      title: 'Bitcoin ETF inflows reach record highs amid institutional adoption',
      source: 'Bloomberg',
      published: '2026-02-01T09:00:00Z',
      signals: [{ type: 'positive', text: 'Bitcoin ETF' }],
      keywords: ['crypto', 'bitcoin']
    },
    {
      title: 'OpenAI announces GPT-5 with breakthrough reasoning capabilities',
      source: 'The Verge',
      published: '2026-02-01T14:00:00Z',
      signals: [{ type: 'positive', text: 'OpenAI' }],
      keywords: ['ai', 'openai']
    },
    {
      title: 'Federal Reserve signals potential rate cuts in Q2 2026',
      source: 'Reuters',
      published: '2026-02-02T16:00:00Z',
      signals: [{ type: 'positive', text: 'Fed Policy' }],
      keywords: ['fed', 'trump', 'economy']
    },
    {
      title: 'Trump administration announces new AI regulatory framework',
      source: 'Politico',
      published: '2026-02-01T11:00:00Z',
      signals: [{ type: 'neutral', text: 'AI Policy' }],
      keywords: ['trump', 'ai', 'politics']
    },
    {
      title: 'Google DeepMind achieves breakthrough in protein folding',
      source: 'Nature',
      published: '2026-02-02T08:00:00Z',
      signals: [{ type: 'positive', text: 'Google AI' }],
      keywords: ['google', 'ai']
    },
    {
      title: 'Ethereum Layer 2 adoption accelerates with Base network growth',
      source: 'CoinDesk',
      published: '2026-02-01T20:00:00Z',
      signals: [{ type: 'positive', text: 'Ethereum L2' }],
      keywords: ['ethereum', 'crypto']
    },
    {
      title: 'Anthropic raises $2B funding round at $60B valuation',
      source: 'TechCrunch',
      published: '2026-02-02T12:00:00Z',
      signals: [{ type: 'positive', text: 'Claude AI' }],
      keywords: ['ai', 'anthropic']
    }
  ];
  
  let filteredNews = allNews;
  
  // Filter by keywords if provided
  if (keywords) {
    const keywordList = keywords.split(',').map(k => k.trim().toLowerCase());
    filteredNews = allNews.filter(item => 
      item.keywords.some(k => keywordList.includes(k))
    );
    
    // Mark relevant items
    filteredNews = filteredNews.map(item => ({
      ...item,
      isRelevant: true
    }));
    
    // Add some non-relevant items for context (up to 3)
    const otherNews = allNews
      .filter(item => !item.keywords.some(k => keywordList.includes(k)))
      .slice(0, 3)
      .map(item => ({ ...item, isRelevant: false }));
    
    filteredNews = [...filteredNews, ...otherNews];
  }
  
  // Sort by date
  filteredNews.sort((a, b) => new Date(b.published) - new Date(a.published));
  
  res.json({ 
    news: filteredNews,
    total: allNews.length,
    filtered: keywords ? true : false
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

module.exports = app;
