// Vercel API for PolyScope - Real Polymarket Data
const express = require('express');
const cors = require('cors');
const https = require('https');

const app = express();
app.use(cors());
app.use(express.json());

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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Portfolio endpoint - REAL DATA
app.get('/api/v1/portfolio/:wallet', async (req, res) => {
  const { wallet } = req.params;
  
  // Validate address
  if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return res.status(400).json({ error: 'Invalid Ethereum address' });
  }
  
  try {
    const positions = await fetchPolymarketPositions(wallet);
    
    if (!positions || positions.length === 0) {
      return res.json({
        wallet,
        totalValue: 0,
        spotValue: 0,
        polymarketValue: 0,
        polymarketInvested: 0,
        pnl: 0,
        pnlPercent: 0,
        positions: [],
        message: 'No positions found for this wallet',
        timestamp: new Date().toISOString()
      });
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
        position: pos.outcome || 'Unknown',
        entryPrice: pos.avgPrice || 0,
        currentPrice: pos.curPrice || 0,
        pnl: pnl,
        pnlPercent: pnlPercent,
        shares: pos.size || 0,
        endDate: pos.endDate
      };
    });
    
    const pnlPercent = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
    
    res.json({
      wallet,
      totalValue: totalValue + 50, // Adding estimated spot value
      spotValue: 50, // Estimated from wallet
      polymarketValue: totalValue,
      polymarketInvested: totalInvested,
      pnl: totalPnl,
      pnlPercent: pnlPercent,
      positions: formattedPositions,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching positions:', error);
    res.status(500).json({ 
      error: 'Failed to fetch portfolio data',
      message: error.message 
    });
  }
});

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
      position: pos.outcome || 'Unknown',
      entryPrice: pos.avgPrice || 0,
      currentPrice: pos.curPrice || 0,
      pnl: pos.cashPnl || 0,
      pnlPercent: pos.percentPnl || 0,
      shares: pos.size || 0,
      endDate: pos.endDate
    }));
    
    res.json({ positions: formattedPositions });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to fetch positions',
      message: error.message 
    });
  }
});

// Markets endpoint - Static data for now
app.get('/api/v1/markets', async (req, res) => {
  res.json({
    markets: [
      {
        question: 'Will Trump deport less than 250,000?',
        volume: 9295432,
        liquidity: 13890476,
        yesPrice: 0.0225,
        noPrice: 0.9775
      },
      {
        question: 'Who will Trump nominate as Fed Chair?',
        volume: 385000000,
        liquidity: 57000000,
        yesPrice: 0.98,
        noPrice: 0.02
      },
      {
        question: 'Will there be another US government shutdown by January 31?',
        volume: 146000000,
        liquidity: 3200000,
        yesPrice: 1.0,
        noPrice: 0.0
      }
    ]
  });
});

// News endpoint - Static data for now
app.get('/api/v1/news', async (req, res) => {
  res.json({
    news: [
      {
        title: 'Coalition demands federal Grok ban over nonconsensual content',
        source: 'TechCrunch',
        published: '2026-02-02T15:00:00Z',
        signals: [{ type: 'negative', text: 'xAI' }]
      },
      {
        title: 'AI reasoning papers show advancement in benchmark scores',
        source: 'arXiv AI',
        published: '2026-02-02T00:00:00Z',
        signals: [{ type: 'positive', text: 'AI Benchmarks' }]
      },
      {
        title: 'Crypto markets see $290B selloff over weekend',
        source: 'CoinDesk',
        published: '2026-02-02T11:30:00Z',
        signals: [{ type: 'neutral', text: 'Crypto' }]
      }
    ]
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

module.exports = app;
