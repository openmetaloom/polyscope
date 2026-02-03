// Vercel API entry point
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

// Import routes
const portfolioRouter = require('./routes/portfolio');
const positionsRouter = require('./routes/positions');
const marketsRouter = require('./routes/markets');
const newsRouter = require('./routes/news');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Mount routes under /api/v1
app.use('/api/v1/portfolio', portfolioRouter);
app.use('/api/v1/positions', positionsRouter);
app.use('/api/v1/markets', marketsRouter);
app.use('/api/v1/news', newsRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

module.exports = app;
