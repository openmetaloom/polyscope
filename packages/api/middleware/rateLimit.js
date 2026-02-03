/**
 * Rate Limiting Middleware
 * 
 * Features:
 * - IP-based rate limiting: 100 req/min per IP
 * - API key-based rate limiting: 1000 req/min per API key
 * - Redis or in-memory storage
 * - Standard rate limit headers
 * - Configurable via environment variables
 */

const { RateLimiterRedis, RateLimiterMemory } = require('rate-limiter-flexible');

// Configuration
const IP_RATE_LIMIT = parseInt(process.env.IP_RATE_LIMIT) || 100; // requests per minute
const IP_WINDOW_MS = 60 * 1000; // 1 minute
const API_KEY_RATE_LIMIT = parseInt(process.env.API_KEY_RATE_LIMIT) || 1000; // requests per minute
const API_KEY_WINDOW_MS = 60 * 1000; // 1 minute

// Use Redis if available, otherwise in-memory
let rateLimiterStore = 'memory';
let ipRateLimiter;
let apiKeyRateLimiter;

// Initialize rate limiters
const initRateLimiters = () => {
  const opts = {
    storeClient: undefined,
    keyPrefix: 'polymarket_api',
    points: IP_RATE_LIMIT,
    duration: 60, // per minute
    blockDuration: 60, // block for 1 minute after exceeding
  };

  // Try Redis first
  if (process.env.REDIS_URL) {
    try {
      const Redis = require('ioredis');
      const redisClient = new Redis(process.env.REDIS_URL, {
        retryStrategy: (times) => Math.min(times * 50, 2000),
        maxRetriesPerRequest: 3,
      });

      redisClient.on('error', (err) => {
        console.warn('Redis connection error, falling back to memory:', err.message);
        rateLimiterStore = 'memory';
      });

      redisClient.on('connect', () => {
        console.log('Redis connected for rate limiting');
        rateLimiterStore = 'redis';
      });

      opts.storeClient = redisClient;
      ipRateLimiter = new RateLimiterRedis({ ...opts, points: IP_RATE_LIMIT });
      apiKeyRateLimiter = new RateLimiterRedis({ ...opts, points: API_KEY_RATE_LIMIT, keyPrefix: 'polymarket_api_key' });
      return;
    } catch (err) {
      console.warn('Redis not available, using in-memory rate limiting');
    }
  }

  // Fallback to in-memory
  console.log('Using in-memory rate limiting');
  ipRateLimiter = new RateLimiterMemory({
    keyPrefix: 'polymarket_ip',
    points: IP_RATE_LIMIT,
    duration: 60,
    blockDuration: 60,
  });

  apiKeyRateLimiter = new RateLimiterMemory({
    keyPrefix: 'polymarket_apikey',
    points: API_KEY_RATE_LIMIT,
    duration: 60,
    blockDuration: 60,
  });
};

initRateLimiters();

// IP-based rate limiting middleware
const ipRateLimiterMiddleware = async (req, res, next) => {
  try {
    // Get client IP (handle proxies)
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() 
      || req.headers['x-real-ip'] 
      || req.connection.remoteAddress 
      || req.ip;

    const key = `ip:${clientIp}`;
    const rateLimitRes = await ipRateLimiter.consume(key);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', IP_RATE_LIMIT);
    res.setHeader('X-RateLimit-Remaining', rateLimitRes.remainingPoints);
    res.setHeader('X-RateLimit-Reset', new Date(Date.now() + rateLimitRes.msBeforeNext));

    next();
  } catch (rejRes) {
    // Rate limit exceeded
    const retryAfter = Math.round(rejRes.msBeforeNext / 1000) || 60;
    
    res.setHeader('X-RateLimit-Limit', IP_RATE_LIMIT);
    res.setHeader('X-RateLimit-Remaining', 0);
    res.setHeader('X-RateLimit-Reset', new Date(Date.now() + rejRes.msBeforeNext));
    res.setHeader('Retry-After', retryAfter);

    const error = new Error('Too many requests from this IP address');
    error.statusCode = 429;
    error.code = 'RATE_LIMIT_EXCEEDED';
    error.retryAfter = retryAfter;
    error.details = {
      limit: IP_RATE_LIMIT,
      window: '1 minute',
      retryAfter
    };
    next(error);
  }
};

// API key-based rate limiting middleware
const apiKeyRateLimiterMiddleware = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
      // Skip API key rate limiting if no key (will be caught by auth middleware)
      return next();
    }

    const key = `key:${apiKey}`;
    const rateLimitRes = await apiKeyRateLimiter.consume(key);

    // Set rate limit headers (override IP headers)
    res.setHeader('X-RateLimit-Limit', API_KEY_RATE_LIMIT);
    res.setHeader('X-RateLimit-Remaining', rateLimitRes.remainingPoints);
    res.setHeader('X-RateLimit-Reset', new Date(Date.now() + rateLimitRes.msBeforeNext));

    next();
  } catch (rejRes) {
    // Rate limit exceeded for API key
    const retryAfter = Math.round(rejRes.msBeforeNext / 1000) || 60;
    
    res.setHeader('X-RateLimit-Limit', API_KEY_RATE_LIMIT);
    res.setHeader('X-RateLimit-Remaining', 0);
    res.setHeader('X-RateLimit-Reset', new Date(Date.now() + rejRes.msBeforeNext));
    res.setHeader('Retry-After', retryAfter);

    const error = new Error('Too many requests for this API key');
    error.statusCode = 429;
    error.code = 'RATE_LIMIT_EXCEEDED';
    error.retryAfter = retryAfter;
    error.details = {
      limit: API_KEY_RATE_LIMIT,
      window: '1 minute',
      retryAfter
    };
    next(error);
  }
};

// Export both middlewares
module.exports = {
  ipRateLimiter: ipRateLimiterMiddleware,
  apiKeyRateLimiter: apiKeyRateLimiterMiddleware,
  getStoreType: () => rateLimiterStore,
  getLimits: () => ({
    ip: { limit: IP_RATE_LIMIT, window: IP_WINDOW_MS },
    apiKey: { limit: API_KEY_RATE_LIMIT, window: API_KEY_WINDOW_MS }
  })
};