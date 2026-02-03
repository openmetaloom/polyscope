// Simple Vercel API for testing
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working!', env: process.env.NODE_ENV || 'unknown' });
});

// Portfolio endpoint (mock for now)
app.get('/api/v1/portfolio/:wallet', async (req, res) => {
  const { wallet } = req.params;
  
  try {
    // For now, return mock data
    res.json({
      wallet,
      totalValue: 78.42,
      spotValue: 61.80,
      polymarketValue: 16.62,
      polymarketInvested: 19.00,
      pnl: -2.38,
      pnlPercent: -12.5,
      positions: [
        {
          title: 'Will Google have the best AI model at the end of February 2026?',
          position: 'No',
          entryPrice: 0.08,
          currentPrice: 0.075,
          pnl: -0.31,
          pnlPercent: -6.3
        },
        {
          title: 'Will Anthropic have the best AI model for coding on March 31?',
          position: 'Yes',
          entryPrice: 0.35,
          currentPrice: 0.315,
          pnl: -0.80,
          pnlPercent: -10.0
        },
        {
          title: 'Record crypto liquidation in 2026?',
          position: 'Yes',
          entryPrice: 0.30,
          currentPrice: 0.235,
          pnl: -1.30,
          pnlPercent: -21.7
        }
      ],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

module.exports = app;
