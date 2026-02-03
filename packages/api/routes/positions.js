/**
 * Positions Routes
 * 
 * Endpoints:
 * GET /api/v1/positions/:wallet - Get Polymarket positions for wallet
 * POST /api/v1/positions/:id/alert - Configure alerts for position
 */

const express = require('express');
const router = express.Router({ mergeParams: true });
const PolymarketAPI = require('../../polymarket_api_hardened');
const LivePositionTracker = require('../../live_position_tracker');
const { cacheMiddleware, invalidateCache } = require('../middleware/cache');

const api = new PolymarketAPI();
const tracker = new LivePositionTracker();

// Cache TTL
const POSITIONS_CACHE_TTL = 30; // 30 seconds

// Alert configurations storage (in-memory for now, use Redis in production)
const alertConfigs = new Map();

/**
 * Validate Ethereum address
 */
const isValidAddress = (address) => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

/**
 * GET /api/v1/positions/:wallet
 * Get Polymarket positions for a wallet
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
  cacheMiddleware({ ttl: POSITIONS_CACHE_TTL }),
  async (req, res, next) => {
    try {
      const { wallet } = req.params;

      // Fetch positions from Polymarket API
      const positionsData = await api.getUserPositions(wallet, { limit: 50 });
      const positions = Array.isArray(positionsData) ? positionsData : 
                       (positionsData.positions || []);

      // Enforce max 50 positions
      const limitedPositions = positions.slice(0, 50);

      // Enrich with current market data where possible
      const enrichedPositions = await Promise.all(
        limitedPositions.map(async (pos) => {
          try {
            // Try to get current market data
            if (pos.marketId || pos.market) {
              const marketData = await api.getCompleteMarketData(
                pos.marketId || pos.market
              ).catch(() => null);

              if (marketData) {
                return {
                  ...pos,
                  market: {
                    id: marketData.id,
                    slug: marketData.slug,
                    question: marketData.question,
                    currentPrices: marketData.prices,
                    endDate: marketData.resolution?.endDate,
                    status: marketData.status
                  },
                  alertConfig: alertConfigs.get(`${wallet}:${pos.id || pos.marketId}`) || null
                };
              }
            }
            return pos;
          } catch (e) {
            return pos;
          }
        })
      );

      // Calculate summary
      const summary = {
        totalPositions: positions.length,
        returnedPositions: enrichedPositions.length,
        activePositions: enrichedPositions.filter(p => p.size > 0).length,
        totalValue: enrichedPositions.reduce((sum, p) => sum + (parseFloat(p.value) || 0), 0),
        totalUnrealizedPnl: enrichedPositions.reduce((sum, p) => sum + (parseFloat(p.unrealizedPnl) || 0), 0),
        truncated: positions.length > 50
      };

      // Also add truncated at data level for API consistency
      const truncated = positions.length > 50;

      res.json({
        success: true,
        data: {
          wallet,
          summary,
          positions: enrichedPositions,
          truncated: summary.truncated
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
 * POST /api/v1/positions/:id/alert
 * Configure alerts for a position
 */
router.post('/:id/alert',
  invalidateCache('positions'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { wallet } = req.body;

      // Validate inputs
      if (!id) {
        const error = new Error('Position ID is required');
        error.statusCode = 400;
        error.code = 'BAD_REQUEST';
        return next(error);
      }

      if (!wallet || !isValidAddress(wallet)) {
        const error = new Error('Valid wallet address is required in body');
        error.statusCode = 400;
        error.code = 'BAD_REQUEST';
        return next(error);
      }

      // Parse alert configuration
      const alertConfig = {
        positionId: id,
        wallet,
        enabled: req.body.enabled !== false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        
        // Price alerts
        priceAlerts: {
          targetPrice: req.body.targetPrice ? parseFloat(req.body.targetPrice) : null,
          priceChangePct: req.body.priceChangePct ? parseFloat(req.body.priceChangePct) : null,
          direction: req.body.direction || 'both' // 'up', 'down', 'both'
        },
        
        // PnL alerts
        pnlAlerts: {
          takeProfit: req.body.takeProfit ? parseFloat(req.body.takeProfit) : null, // percentage
          stopLoss: req.body.stopLoss ? parseFloat(req.body.stopLoss) : null, // percentage (negative)
          trailingStop: req.body.trailingStop ? parseFloat(req.body.trailingStop) : null
        },
        
        // Time-based alerts
        timeAlerts: {
          beforeResolution: req.body.beforeResolution ? parseInt(req.body.beforeResolution) : null, // days
          reminderFrequency: req.body.reminderFrequency || 'daily' // 'daily', 'weekly', 'once'
        },
        
        // Delivery methods
        delivery: {
          webhook: req.body.webhookUrl || null,
          email: req.body.email || null,
          telegram: req.body.telegramHandle || null
        },
        
        // Cooldown to prevent spam
        cooldownMinutes: req.body.cooldownMinutes || 15
      };

      // Validate alert config
      if (!alertConfig.priceAlerts.targetPrice && 
          !alertConfig.priceAlerts.priceChangePct &&
          !alertConfig.pnlAlerts.takeProfit &&
          !alertConfig.pnlAlerts.stopLoss &&
          !alertConfig.timeAlerts.beforeResolution) {
        const error = new Error('At least one alert condition is required');
        error.statusCode = 400;
        error.code = 'BAD_REQUEST';
        error.details = {
          availableConditions: [
            'targetPrice',
            'priceChangePct',
            'takeProfit',
            'stopLoss',
            'beforeResolution'
          ]
        };
        return next(error);
      }

      // Store alert config
      const configKey = `${wallet}:${id}`;
      alertConfigs.set(configKey, alertConfig);

      res.json({
        success: true,
        data: {
          message: 'Alert configuration saved',
          config: alertConfig,
          configKey
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
 * GET /api/v1/positions/:id/alert
 * Get alert configuration for a position
 */
router.get('/:id/alert',
  cacheMiddleware({ ttl: 60 }),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const wallet = req.query.wallet;

      if (!wallet || !isValidAddress(wallet)) {
        const error = new Error('Valid wallet address is required in query parameter');
        error.statusCode = 400;
        error.code = 'BAD_REQUEST';
        return next(error);
      }

      const configKey = `${wallet}:${id}`;
      const config = alertConfigs.get(configKey);

      if (!config) {
        const error = new Error('No alert configuration found for this position');
        error.statusCode = 404;
        error.code = 'NOT_FOUND';
        return next(error);
      }

      res.json({
        success: true,
        data: config,
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
 * DELETE /api/v1/positions/:id/alert
 * Delete alert configuration for a position
 */
router.delete('/:id/alert',
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const wallet = req.query.wallet || req.body?.wallet;

      if (!wallet || !isValidAddress(wallet)) {
        const error = new Error('Valid wallet address is required');
        error.statusCode = 400;
        error.code = 'BAD_REQUEST';
        return next(error);
      }

      const configKey = `${wallet}:${id}`;
      const existed = alertConfigs.has(configKey);
      
      if (existed) {
        alertConfigs.delete(configKey);
      }

      res.json({
        success: true,
        data: {
          deleted: existed,
          message: existed ? 'Alert configuration deleted' : 'No configuration found'
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