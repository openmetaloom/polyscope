/**
 * Caching Middleware
 * 
 * Features:
 * - Redis or in-memory caching
 * - Configurable TTL per route
 * - Cache stampede protection
 * - Cache key generation based on query params
 * - Cache invalidation support
 * - Cache-Control headers
 */

const NodeCache = require('node-cache');

// Configuration
const DEFAULT_TTL = parseInt(process.env.CACHE_TTL) || 60; // seconds
const CHECK_PERIOD = 120; // seconds
const MAX_KEYS = 10000;

// Use Redis if available, otherwise in-memory
let cacheStore = 'memory';
let cache;
let redisClient;

// Initialize cache
const initCache = () => {
  if (process.env.REDIS_URL) {
    try {
      const Redis = require('ioredis');
      redisClient = new Redis(process.env.REDIS_URL, {
        retryStrategy: (times) => Math.min(times * 50, 2000),
        maxRetriesPerRequest: 3,
      });

      redisClient.on('error', (err) => {
        console.warn('Redis cache error, falling back to memory:', err.message);
        cacheStore = 'memory';
        cache = new NodeCache({ stdTTL: DEFAULT_TTL, checkperiod: CHECK_PERIOD, maxKeys: MAX_KEYS });
      });

      redisClient.on('connect', () => {
        console.log('Redis connected for caching');
        cacheStore = 'redis';
      });

      return;
    } catch (err) {
      console.warn('Redis not available for caching, using in-memory');
    }
  }

  // Fallback to in-memory
  console.log('Using in-memory caching');
  cache = new NodeCache({ 
    stdTTL: DEFAULT_TTL, 
    checkperiod: CHECK_PERIOD, 
    maxKeys: MAX_KEYS,
    useClones: false // Better performance, but be careful with mutations
  });
  
  cache.on('expired', (key, value) => {
    // Optional: Log or handle expired keys
  });
  
  cache.on('flush', () => {
    console.log('Cache flushed');
  });
};

initCache();

// Pending request tracking for stampede protection
const pendingRequests = new Map();

/**
 * Generate cache key from request
 */
const generateCacheKey = (req) => {
  const { path, query } = req;
  const queryString = Object.keys(query).sort().map(k => `${k}=${query[k]}`).join('&');
  return `cache:${path}:${queryString}`;
};

/**
 * Get cache value
 */
const getCache = async (key) => {
  if (cacheStore === 'redis' && redisClient) {
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  }
  return cache.get(key);
};

/**
 * Set cache value
 */
const setCache = async (key, value, ttl = DEFAULT_TTL) => {
  if (cacheStore === 'redis' && redisClient) {
    await redisClient.setex(key, ttl, JSON.stringify(value));
  } else {
    cache.set(key, value, ttl);
  }
};

/**
 * Delete cache value
 */
const deleteCache = async (key) => {
  if (cacheStore === 'redis' && redisClient) {
    await redisClient.del(key);
  } else {
    cache.del(key);
  }
};

/**
 * Clear cache
 */
const clearCache = async () => {
  if (cacheStore === 'redis' && redisClient) {
    await redisClient.flushdb();
  } else {
    cache.flushAll();
  }
};

/**
 * Get cache stats
 */
const getCacheStats = () => {
  if (cacheStore === 'redis' && redisClient) {
    return { store: 'redis', connected: redisClient.status === 'ready' };
  }
  return { 
    store: 'memory', 
    keys: cache.keys().length,
    stats: cache.getStats()
  };
};

/**
 * Cache middleware factory
 * @param {Object} options - Cache options
 * @param {number} options.ttl - Time to live in seconds
 * @param {boolean} options.stampedeProtection - Enable stampede protection
 * @param {function} options.keyGenerator - Custom cache key generator
 * @param {function} options.condition - Condition function to determine if request should be cached
 */
const cacheMiddleware = (options = {}) => {
  const ttl = options.ttl || DEFAULT_TTL;
  const stampedeProtection = options.stampedeProtection !== false;
  const keyGenerator = options.keyGenerator || generateCacheKey;
  const condition = options.condition || (() => true);

  return async (req, res, next) => {
    // Skip cache for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Check condition
    if (!condition(req)) {
      return next();
    }

    const cacheKey = keyGenerator(req);
    req.cacheKey = cacheKey;

    try {
      // Check for pending request (stampede protection)
      if (stampedeProtection && pendingRequests.has(cacheKey)) {
        console.log(`Cache stampede protection: waiting for ${cacheKey}`);
        const result = await pendingRequests.get(cacheKey);
        res.setHeader('X-Cache', 'HIT-STAMPEDE');
        return res.json({
          success: true,
          data: result,
          meta: {
            cached: true,
            requestId: req.correlationId,
            timestamp: new Date().toISOString()
          }
        });
      }

      // Check cache
      const cached = await getCache(cacheKey);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('Cache-Control', `public, max-age=${ttl}`);
        return res.json({
          success: true,
          data: cached,
          meta: {
            cached: true,
            requestId: req.correlationId,
            timestamp: new Date().toISOString()
          }
        });
      }

      // Store original res.json
      const originalJson = res.json.bind(res);

      // Override res.json to cache successful responses
      res.json = (body) => {
        if (body.success && body.data) {
          // Set cache headers
          res.setHeader('X-Cache', 'MISS');
          res.setHeader('Cache-Control', `public, max-age=${ttl}`);
          
          // Cache the data
          const cachePromise = setCache(cacheKey, body.data, ttl);
          
          if (stampedeProtection) {
            // Remove from pending requests
            pendingRequests.delete(cacheKey);
          }
          
          // Don't await cache write to keep response fast
          cachePromise.catch(err => {
            console.error('Cache write error:', err.message);
          });
        }

        return originalJson(body);
      };

      // Set up stampede protection
      if (stampedeProtection) {
        const requestPromise = new Promise((resolve) => {
          const checkInterval = setInterval(() => {
            getCache(cacheKey).then(cached => {
              if (cached) {
                clearInterval(checkInterval);
                resolve(cached);
              }
            });
          }, 50);

          // Timeout after 10 seconds
          setTimeout(() => {
            clearInterval(checkInterval);
            resolve(null);
          }, 10000);
        });

        pendingRequests.set(cacheKey, requestPromise);
      }

      next();
    } catch (err) {
      console.error('Cache middleware error:', err.message);
      // Continue without caching
      next();
    }
  };
};

/**
 * Cache invalidation middleware
 * Use this after POST/PUT/DELETE operations
 * @param {string|array} patterns - Cache key patterns to invalidate
 */
const invalidateCache = (patterns) => {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);

    res.json = (body) => {
      // Only invalidate on successful operations
      if (body.success) {
        const patternsToInvalidate = Array.isArray(patterns) ? patterns : [patterns];
        
        patternsToInvalidate.forEach(pattern => {
          // In a real implementation, use pattern matching
          // For now, clear specific keys or all cache
          if (pattern === '*') {
            clearCache().catch(err => console.error('Cache clear error:', err));
          } else if (cacheStore === 'memory') {
            const keys = cache.keys().filter(k => k.includes(pattern));
            cache.del(keys);
          }
        });
      }

      return originalJson(body);
    };

    next();
  };
};

module.exports = {
  cacheMiddleware,
  invalidateCache,
  getCache,
  setCache,
  deleteCache,
  clearCache,
  getCacheStats,
  generateCacheKey
};