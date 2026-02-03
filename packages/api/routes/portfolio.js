/**
 * Portfolio Routes
 * 
 * Endpoints:
 * GET /api/v1/portfolio/:wallet - Full portfolio (spot + polymarket)
 */

const express = require('express');
const router = express.Router({ mergeParams: true });
const PolymarketAPI = require('../../polymarket_api_hardened');
const LivePositionTracker = require('../../live_position_tracker');
const { cacheMiddleware } = require('../middleware/cache');

const api = new PolymarketAPI();
const tracker = new LivePositionTracker();

// Cache TTL
const PORTFOLIO_CACHE_TTL = 30; // 30 seconds

/**
 * Validate Ethereum address
 */
const isValidAddress = (address) => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

/**
 * GET /api/v1/portfolio/:wallet
 * Get full portfolio for a wallet
 */
router.get('/:wallet',
  async (req, res, next) => {
    // Validate wallet BEFORE cache to ensure proper error response
    const { wallet } = req.params;

    if (!isValidAddress(wallet)) {
      const error = new Error('Invalid wallet address format');
      error.statusCode = 400;
      error.code = 'BAD_REQUEST';
      error.details = {
        message: 'Wallet must be a valid Ethereum address (0x followed by 40 hex characters)',
        provided: wallet
      };
      return next(error);
    }
    next();
  },
  cacheMiddleware({ ttl: PORTFOLIO_CACHE_TTL }),
  async (req, res, next) => {
    try {
      const { wallet } = req.params;

      // Fetch data in parallel
      const [positions, activity] = await Promise.allSettled([
        api.getUserPositions(wallet, { limit: 50 }),
        api.getUserActivity(wallet, { limit: 20 })
      ]);

      // Process positions
      let portfolioPositions = [];
      if (positions.status === 'fulfilled' && positions.value) {
        const userPositions = Array.isArray(positions.value) ? positions.value : 
                            (positions.value.positions || []);
        
        portfolioPositions = userPositions.map(pos => ({
          marketId: pos.marketId || pos.market,
          marketSlug: pos.slug || pos.marketSlug,
          assetId: pos.assetId,
          outcome: pos.outcome || 'Unknown',
          position: pos.position || 'Long',
          size: parseFloat(pos.size || 0),
          avgPrice: parseFloat(pos.avgPrice || 0),
          currentPrice: parseFloat(pos.currentPrice || pos.avgPrice || 0),
          totalCost: parseFloat(pos.totalCost || 0),
          realizedPnl: parseFloat(pos.realizedPnl || 0),
          unrealizedPnl: parseFloat(pos.unrealizedPnl || 0),
          value: parseFloat(pos.value || pos.totalCost || 0)
        }));
      }

      // Calculate portfolio summary
      const totalValue = portfolioPositions.reduce((sum, p) => sum + (p.value || 0), 0);
      const totalCost = portfolioPositions.reduce((sum, p) => sum + (p.totalCost || 0), 0);
      const totalUnrealizedPnl = portfolioPositions.reduce((sum, p) => sum + (p.unrealizedPnl || 0), 0);
      const totalRealizedPnl = portfolioPositions.reduce((sum, p) => sum + (p.realizedPnl || 0), 0);

      // Process activity
      let recentActivity = [];
      if (activity.status === 'fulfilled' && activity.value) {
        const acts = Array.isArray(activity.value) ? activity.value : 
                     (activity.value.activity || []);
        recentActivity = acts.slice(0, 10).map(act => ({
          type: act.type || 'Unknown',
          marketId: act.marketId,
          timestamp: act.timestamp || act.createdAt,
          amount: parseFloat(act.amount || 0),
          price: parseFloat(act.price || 0),
          side: act.side,
          transactionHash: act.transactionHash
        }));
      }

      // Group by market
      const marketGroups = portfolioPositions.reduce((acc, pos) => {
        const marketId = pos.marketId || 'unknown';
        if (!acc[marketId]) {
          acc[marketId] = {
            marketId,
            positions: [],
            totalValue: 0
          };
        }
        acc[marketId].positions.push(pos);
        acc[marketId].totalValue += pos.value || 0;
        return acc;
      }, {});

      res.json({
        success: true,
        data: {
          wallet,
          summary: {
            totalPositions: portfolioPositions.length,
            totalMarkets: Object.keys(marketGroups).length,
            totalValue: totalValue.toFixed(4),
            totalCost: totalCost.toFixed(4),
            totalUnrealizedPnl: totalUnrealizedPnl.toFixed(4),
            totalRealizedPnl: totalRealizedPnl.toFixed(4),
            unrealizedPnlPct: totalCost > 0 ? ((totalUnrealizedPnl / totalCost) * 100).toFixed(2) : '0.00'
          },
          positions: portfolioPositions,
          marketSummary: Object.values(marketGroups).map(m => ({
            marketId: m.marketId,
            positionCount: m.positions.length,
            totalValue: m.totalValue.toFixed(4),
            outcomes: m.positions.map(p => p.outcome)
          })),
          recentActivity,
          dataSources: {
            positions: positions.status === 'fulfilled' ? 'success' : 'error',
            activity: activity.status === 'fulfilled' ? 'success' : 'error'
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

module.exports = router;