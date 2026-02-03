/**
 * PolyScope API Server
 *
 * Production-ready REST API for PolyScope analytics platform.
 *
 * Features:
 * - Express.js with security hardening
 * - CORS enabled for browser clients
 * - Rate limiting (IP-based and API key-based)
 * - Request/response logging with correlation IDs
 * - Circuit breaker integration
 * - Graceful error handling
 * - OpenAPI documentation
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');
const compression = require('compression');

// Load middleware
const { ipRateLimiter, apiKeyRateLimiter } = require('./middleware/rateLimit');
const { authenticateApiKey } = require('./middleware/auth');
const { cacheMiddleware } = require('./middleware/cache');

// Load routes
const marketsRouter = require('./routes/markets');
const portfolioRouter = require('./routes/portfolio');
const positionsRouter = require('./routes/positions');
const newsRouter = require('./routes/news');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Trust proxy for correct IP detection (if behind load balancer)
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
  contentSecurityPolicy: NODE_ENV === 'production',
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-API-Key', 'X-Correlation-ID', 'Authorization'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'X-Cache'],
  credentials: true,
  maxAge: 86400
};
app.use(cors(corsOptions));

// Body parsing
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Compression
app.use(compression());

// Correlation ID middleware
app.use((req, res, next) => {
  req.correlationId = req.headers['x-correlation-id'] || uuidv4();
  res.setHeader('X-Correlation-ID', req.correlationId);
  next();
});

// Custom morgan format with correlation ID
morgan.token('correlation-id', (req) => req.correlationId);
const logFormat = NODE_ENV === 'production' 
  ? ':remote-addr - :correlation-id [:date[iso]] ":method :url HTTP/:http-version" :status :res[content-length] :response-time ms'
  : ':method :url :status :response-time ms - :correlation-id';
app.use(morgan(logFormat));

// Request timeout middleware (5s default, 30s for complex queries)
const timeoutMiddleware = (timeoutMs = 5000) => {
  return (req, res, next) => {
    const isComplexQuery = req.path.includes('portfolio') || req.path.includes('search');
    const timeout = isComplexQuery ? 30000 : timeoutMs;
    
    req.setTimeout(timeout, () => {
      const error = new Error('Request timeout');
      error.statusCode = 408;
      error.code = 'REQUEST_TIMEOUT';
      next(error);
    });
    
    res.setTimeout(timeout, () => {
      const error = new Error('Response timeout');
      error.statusCode = 504;
      error.code = 'GATEWAY_TIMEOUT';
      next(error);
    });
    
    next();
  };
};

app.use(timeoutMiddleware());

// Health check endpoint (no auth required)
app.get('/api/v1/health', (req, res) => {
  const PolymarketAPI = require('../polymarket_api_hardened');
  const api = new PolymarketAPI();
  const circuitStatus = api.getCircuitBreakerStatus();
  
  // Add rate limit headers for consistency
  res.setHeader('X-RateLimit-Limit', '100');
  res.setHeader('X-RateLimit-Remaining', '100');
  res.setHeader('X-RateLimit-Reset', new Date(Date.now() + 60000).toISOString());
  
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: NODE_ENV,
      circuitBreakers: circuitStatus,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    },
    meta: {
      requestId: req.correlationId,
      timestamp: new Date().toISOString()
    }
  });
});

// Apply rate limiting to API routes
app.use('/api/v1/', ipRateLimiter);

// Apply authentication to protected routes
app.use('/api/v1/markets', authenticateApiKey);
app.use('/api/v1/portfolio', authenticateApiKey);
app.use('/api/v1/positions', authenticateApiKey);
app.use('/api/v1/prices', authenticateApiKey);
app.use('/api/v1/news', authenticateApiKey);

// Apply API key rate limiting to authenticated routes
app.use('/api/v1/', apiKeyRateLimiter);

// Mount routes
app.use('/api/v1/markets', marketsRouter);
app.use('/api/v1/portfolio', portfolioRouter);
app.use('/api/v1/positions', positionsRouter);
app.use('/api/v1/prices', (req, res, next) => {
  // Forward to markets router for price endpoints
  req.url = `/${req.params.tokenId}/price`;
  next('route');
});
app.use('/api/v1/news', newsRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
      details: { path: req.path, method: req.method }
    },
    meta: {
      requestId: req.correlationId,
      timestamp: new Date().toISOString()
    }
  });
});

// Global error handler
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;
  const code = err.code || 'INTERNAL_ERROR';
  
  // Log error
  console.error(`[ERROR] ${code}: ${err.message}`, {
    correlationId: req.correlationId,
    path: req.path,
    statusCode,
    stack: NODE_ENV === 'development' ? err.stack : undefined
  });
  
  // Don't leak error details in production
  const response = {
    success: false,
    error: {
      code,
      message: statusCode === 500 && NODE_ENV === 'production' 
        ? 'Internal server error' 
        : err.message,
      ...(err.details && { details: err.details })
    },
    meta: {
      requestId: req.correlationId,
      timestamp: new Date().toISOString()
    }
  };
  
  // Add retry info for rate limiting
  if (code === 'RATE_LIMIT_EXCEEDED' && err.retryAfter) {
    response.error.details = { retryAfter: err.retryAfter };
    res.setHeader('Retry-After', err.retryAfter);
  }
  
  res.status(statusCode).json(response);
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Polymarket API Server running on port ${PORT}`);
  console.log(`📚 Environment: ${NODE_ENV}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/v1/health`);
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  server.close((err) => {
    if (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
    console.log('Server closed successfully');
    process.exit(0);
  });
  
  // Force shutdown after 30s
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

module.exports = { app, server };