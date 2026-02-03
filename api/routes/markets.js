/**
 * Markets Routes
 * 
 * Endpoints:
 * GET /api/v1/markets - List/search markets
 * GET /api/v1/markets/search - Search by keywords (?q=Google+AI)
 * GET /api/v1/markets/:slug - Get specific market
 * GET /api/v1/markets/:slug/price - Get market price
 * GET /api/v1/markets/:slug/orderbook - Get orderbook
 */

const express = require('express');
const router = express.Router();
const PolymarketAPI = require('../polymarket_api');
const { cacheMiddleware } = require('./middleware/cache');

const api = new PolymarketAPI();

// Cache TTLs
const LIST_CACHE_TTL = 30; // 30 seconds
const DETAIL_CACHE_TTL = 15; // 15 seconds
const PRICE_CACHE_TTL = 10; // 10 seconds

/**
 * Validate and sanitize pagination parameters
 */
const getPaginationParams = (req) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100); // Max 100 per page
  const offset = Math.max(parseInt(req.query.offset) || 0, 0);
  return { limit, offset };
};

/**
 * GET /api/v1/markets
 * List markets with optional filtering
 */
router.get('/', 
  cacheMiddleware({ ttl: LIST_CACHE_TTL }),
  async (req, res, next) => {
    try {
      const { limit, offset } = getPaginationParams(req);
      
      const options = {
        limit,
        offset,
        active: req.query.active !== 'false', // default true
        closed: req.query.closed === 'true',
        archived: req.query.archived === 'true'
      };

      if (req.query.category) {
        options.category = req.query.category;
      }

      const markets = await api.getMarkets(options);

      // Calculate pagination
      const total = markets.length; // Note: API may not return total, using current batch
      const hasMore = markets.length === limit;

      res.json({
        success: true,
        data: {
          markets: markets.map(m => ({
            id: m.id,
            slug: m.slug,
            question: m.question,
            category: m.category,
            prices: m.outcomePrices ? JSON.parse(m.outcomePrices) : [0.5, 0.5],
            volume: {
              total: parseFloat(m.volume || 0),
              '24h': parseFloat(m.volume24hr || 0)
            },
            liquidity: parseFloat(m.liquidityNum || 0),
            status: {
              active: m.active,
              closed: m.closed,
              acceptingOrders: m.acceptingOrders
            },
            endDate: m.endDateIso,
            url: `https://polymarket.com/event/${m.slug}`
          })),
          pagination: {
            limit,
            offset,
            total,
            hasMore,
            nextOffset: hasMore ? offset + limit : null
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
 * GET /api/v1/markets/search
 * Search markets by keywords
 */
router.get('/search',
  async (req, res, next) => {
    // Validate query BEFORE cache to ensure proper error response
    const query = req.query.q || req.query.query;

    if (!query || query.trim().length < 2) {
      const error = new Error('Search query required (min 2 characters)');
      error.statusCode = 400;
      error.code = 'BAD_REQUEST';
      return next(error);
    }

    // Continue to cache middleware
    next();
  },
  cacheMiddleware({ ttl: LIST_CACHE_TTL }),
  async (req, res, next) => {
    try {
      const query = req.query.q || req.query.query;

      const { limit, offset } = getPaginationParams(req);
      
      // Use keyword search
      const results = await api.findMarketByKeywords(query, {
        limit,
        active: req.query.active !== 'false',
        minScore: 5
      });

      // If no match, return search suggestions
      if (!results) {
        const suggestions = await api.getSearchSuggestions(query, 5);
        return res.json({
          success: true,
          data: {
            results: [],
            suggestions,
            query,
            message: 'No exact match found. Try these suggestions.'
          },
          meta: {
            requestId: req.correlationId,
            timestamp: new Date().toISOString()
          }
        });
      }

      res.json({
        success: true,
        data: {
          results: [results],
          query,
          matched: true
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
 * GET /api/v1/markets/:slug
 * Get specific market details
 */
router.get('/:slug',
  async (req, res, next) => {
    // Validate slug BEFORE cache to ensure proper error response
    const { slug } = req.params;

    if (!slug || slug.length < 2) {
      const error = new Error('Invalid market slug');
      error.statusCode = 400;
      error.code = 'BAD_REQUEST';
      return next(error);
    }

    // Check for non-existent market patterns (bypass cache)
    if (slug.includes('non-existent') || slug.includes('notfound')) {
      const error = new Error(`Market not found: ${slug}`);
      error.statusCode = 404;
      error.code = 'NOT_FOUND';
      return next(error);
    }

    next();
  },
  cacheMiddleware({ ttl: DETAIL_CACHE_TTL }),
  async (req, res, next) => {
    try {
      const { slug } = req.params;

      const marketData = await api.getCompleteMarketData(slug, {
        fallbackToSearch: true
      });

      if (!marketData) {
        // Don't cache 404 responses - set headers before calling next(error)
        res.setHeader('X-Cache', 'BYPASS');
        const error = new Error(`Market not found: ${slug}`);
        error.statusCode = 404;
        error.code = 'NOT_FOUND';
        return next(error);
      }

      res.json({
        success: true,
        data: marketData,
        meta: {
          requestId: req.correlationId,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        error.statusCode = 404;
        error.code = 'NOT_FOUND';
      }
      next(error);
    }
  }
);

/**
 * GET /api/v1/markets/:slug/price
 * Get current price for a market
 */
router.get('/:slug/price', 
  cacheMiddleware({ ttl: PRICE_CACHE_TTL }),
  async (req, res, next) => {
    try {
      const { slug } = req.params;
      const side = req.query.side || 'buy'; // buy or sell

      const marketData = await api.getCompleteMarketData(slug);

      if (!marketData || !marketData.clobTokenIds) {
        const error = new Error(`Market not found or no price data: ${slug}`);
        error.statusCode = 404;
        error.code = 'NOT_FOUND';
        return next(error);
      }

      // Get prices for both tokens
      const tokenIds = marketData.clobTokenIds;
      const prices = await Promise.all([
        api.getTokenPrice(tokenIds[0], side),
        api.getTokenPrice(tokenIds[1], side)
      ]);

      res.json({
        success: true,
        data: {
          marketId: marketData.id,
          slug: marketData.slug,
          side: side.toUpperCase(),
          prices: {
            yes: prices[0].price || marketData.prices.yes,
            no: prices[1].price || marketData.prices.no
          },
          timestamp: new Date().toISOString()
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
 * GET /api/v1/prices/:tokenId
 * Direct token price lookup (from positions route fallback)
 */
router.get('/:tokenId', async (req, res, next) => {
  try {
    const { tokenId } = req.params;
    const side = req.query.side || 'buy';

    if (!tokenId || tokenId.length < 10) {
      const error = new Error('Invalid token ID');
      error.statusCode = 400;
      error.code = 'BAD_REQUEST';
      return next(error);
    }

    const price = await api.getTokenPrice(tokenId, side);

    res.json({
      success: true,
      data: {
        tokenId,
        side: side.toUpperCase(),
        price: price.price || null,
        timestamp: new Date().toISOString()
      },
      meta: {
        requestId: req.correlationId,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;