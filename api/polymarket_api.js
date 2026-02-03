/**
 * Hardened Polymarket API Integration
 * 
 * Production-ready API client with:
 * - Retry logic with exponential backoff
 * - Circuit breaker pattern
 * - Connection pooling
 * - Rate limiting
 * - Comprehensive error handling
 * - Audit logging
 */

const https = require('https');
const EventEmitter = require('events');

// API Base URLs
const GAMMA_API_BASE = 'gamma-api.polymarket.com';
const CLOB_API_BASE = 'clob.polymarket.com';
const DATA_API_BASE = 'data-api.polymarket.com';
const WS_BASE = 'wss://ws-subscriptions-clob.polymarket.com/ws/';

// Default configuration
const DEFAULT_CONFIG = {
  cacheTTL: 30000,           // 30 seconds default cache
  maxRetries: 3,             // Max retry attempts
  baseDelay: 1000,           // Base retry delay (ms)
  maxDelay: 30000,           // Max retry delay (ms)
  timeout: 10000,            // Request timeout (ms)
  rateLimitRPS: 10,          // Requests per second
  circuitBreakerThreshold: 5, // Failures before opening circuit
  circuitBreakerTimeout: 60000, // Time before attempting reset (ms)
  keepAlive: true,           // Connection pooling
  keepAliveMsecs: 1000,
  maxSockets: 10,
  auditLog: true             // Enable audit logging
};

/**
 * Circuit Breaker State Machine
 */
class CircuitBreaker extends EventEmitter {
  constructor(threshold = 5, timeout = 60000) {
    super();
    this.threshold = threshold;
    this.timeout = timeout;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failures = 0;
    this.lastFailure = null;
    this.nextAttempt = Date.now();
  }

  canExecute() {
    if (this.state === 'CLOSED') return true;
    if (this.state === 'OPEN') {
      if (Date.now() >= this.nextAttempt) {
        this.state = 'HALF_OPEN';
        this.emit('halfOpen');
        return true;
      }
      return false;
    }
    return true; // HALF_OPEN
  }

  recordSuccess() {
    this.failures = 0;
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.emit('close');
    }
  }

  recordFailure() {
    this.failures++;
    this.lastFailure = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
      this.emit('open', { failures: this.failures, nextAttempt: this.nextAttempt });
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailure: this.lastFailure,
      nextAttempt: this.nextAttempt
    };
  }
}

/**
 * Token Bucket Rate Limiter
 */
class RateLimiter {
  constructor(requestsPerSecond = 10) {
    this.capacity = requestsPerSecond;
    this.tokens = requestsPerSecond;
    this.lastRefill = Date.now();
    this.refillRate = requestsPerSecond / 1000; // tokens per ms
  }

  async acquire() {
    this.refill();
    
    if (this.tokens >= 1) {
      this.tokens--;
      return true;
    }
    
    // Calculate wait time
    const waitTime = Math.ceil((1 - this.tokens) / this.refillRate);
    await this.sleep(waitTime);
    return this.acquire();
  }

  refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = elapsed * this.refillRate;
    
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Audit Logger
 */
class AuditLogger {
  constructor(enabled = true) {
    this.enabled = enabled;
    this.logs = [];
    this.maxLogs = 10000;
  }

  log(event, data = {}) {
    if (!this.enabled) return;
    
    const entry = {
      timestamp: new Date().toISOString(),
      event,
      ...data
    };
    
    this.logs.push(entry);
    
    // Prevent unbounded growth
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs / 2);
    }
    
    // Also console log for visibility
    console.log(`[AUDIT] ${event}:`, JSON.stringify(data));
  }

  getLogs(filter = {}) {
    let logs = this.logs;
    
    if (filter.event) {
      logs = logs.filter(l => l.event === filter.event);
    }
    if (filter.since) {
      logs = logs.filter(l => new Date(l.timestamp) >= filter.since);
    }
    
    return logs;
  }

  clear() {
    this.logs = [];
  }
}

/**
 * Hardened Polymarket API Client
 */
class PolymarketAPI extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.config = { ...DEFAULT_CONFIG, ...options };
    
    // Circuit breakers per endpoint (initialize with defaults if needed)
    this.circuitBreakers = {
      gamma: new CircuitBreaker(this.config.circuitBreakerThreshold || 5, this.config.circuitBreakerTimeout || 60000),
      clob: new CircuitBreaker(this.config.circuitBreakerThreshold || 5, this.config.circuitBreakerTimeout || 60000),
      data: new CircuitBreaker(this.config.circuitBreakerThreshold || 5, this.config.circuitBreakerTimeout || 60000),
      unknown: new CircuitBreaker(this.config.circuitBreakerThreshold || 5, this.config.circuitBreakerTimeout || 60000)
    };
    
    // Rate limiter
    this.rateLimiter = new RateLimiter(this.config.rateLimitRPS);
    
    // Connection pooling
    this.agent = new https.Agent({
      keepAlive: this.config.keepAlive,
      keepAliveMsecs: this.config.keepAliveMsecs,
      maxSockets: this.config.maxSockets
    });
    
    // Cache with stampede protection
    this.cache = new Map();
    this.pendingRequests = new Map(); // For stampede protection
    
    // WebSocket
    this.wsConnection = null;
    this.wsReconnectAttempts = 0;
    this.wsMaxReconnectAttempts = 10;
    this.wsCallbacks = new Map();
    
    // Audit logger
    this.audit = new AuditLogger(this.config.auditLog);
    
    // Setup circuit breaker event handlers
    this.setupCircuitBreakerHandlers();
  }

  setupCircuitBreakerHandlers() {
    Object.entries(this.circuitBreakers).forEach(([name, cb]) => {
      cb.on('open', (data) => {
        console.error(`🚨 Circuit breaker OPEN for ${name}:`, data);
        this.emit('circuitOpen', { endpoint: name, ...data });
      });
      cb.on('halfOpen', () => {
        console.log(`⚠️ Circuit breaker HALF_OPEN for ${name}`);
        this.emit('circuitHalfOpen', { endpoint: name });
      });
      cb.on('close', () => {
        console.log(`✅ Circuit breaker CLOSED for ${name}`);
        this.emit('circuitClose', { endpoint: name });
      });
    });
  }

  /**
   * Exponential backoff delay calculation
   */
  calculateDelay(attempt) {
    const jitter = Math.random() * 1000;
    const delay = Math.min(
      this.config.baseDelay * Math.pow(2, attempt) + jitter,
      this.config.maxDelay
    );
    return delay;
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Make HTTP request with retry logic, circuit breaker, and rate limiting
   */
  async request(base, path, params = {}, method = 'GET', options = {}) {
    const endpoint = this.getEndpointName(base);
    const circuitBreaker = this.circuitBreakers[endpoint];
    
    // Check circuit breaker
    if (!circuitBreaker.canExecute()) {
      const state = circuitBreaker.getState();
      const error = new Error(`Circuit breaker OPEN for ${endpoint}. Try again after ${new Date(state.nextAttempt).toISOString()}`);
      error.circuitOpen = true;
      error.endpoint = endpoint;
      throw error;
    }
    
    // Acquire rate limit token
    await this.rateLimiter.acquire();
    
    const maxRetries = options.maxRetries ?? this.config.maxRetries;
    const timeout = options.timeout ?? this.config.timeout;
    
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.executeRequest(base, path, params, method, timeout);
        
        // Record success
        circuitBreaker.recordSuccess();
        
        // Audit log
        this.audit.log('API_REQUEST_SUCCESS', {
          endpoint,
          path,
          attempt: attempt + 1,
          method
        });
        
        return result;
      } catch (error) {
        lastError = error;
        
        // Don't retry on certain errors
        if (error.statusCode === 400 || error.statusCode === 401 || error.statusCode === 403) {
          throw error;
        }
        
        // Record failure
        circuitBreaker.recordFailure();
        
        // Audit log
        this.audit.log('API_REQUEST_RETRY', {
          endpoint,
          path,
          attempt: attempt + 1,
          error: error.message,
          willRetry: attempt < maxRetries
        });
        
        if (attempt < maxRetries) {
          const delay = this.calculateDelay(attempt);
          console.log(`Retry ${attempt + 1}/${maxRetries} for ${path} after ${delay}ms`);
          await this.sleep(delay);
        }
      }
    }
    
    // All retries exhausted
    this.audit.log('API_REQUEST_FAILED', {
      endpoint,
      path,
      attempts: maxRetries + 1,
      error: lastError.message
    });
    
    throw lastError;
  }

  /**
   * Execute single HTTP request
   */
  executeRequest(base, path, params, method, timeout) {
    return new Promise((resolve, reject) => {
      const queryString = new URLSearchParams(params).toString();
      const fullPath = queryString ? `${path}?${queryString}` : path;
      
      const requestOptions = {
        hostname: base,
        path: fullPath,
        method: method,
        agent: this.agent,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'polymarket-trader/2.0',
          'Connection': 'keep-alive'
        }
      };

      const req = https.request(requestOptions, (res) => {
        let data = '';
        
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          // Check HTTP status
          if (res.statusCode >= 400) {
            const error = new Error(`HTTP ${res.statusCode}: ${data}`);
            error.statusCode = res.statusCode;
            reject(error);
            return;
          }
          
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (e) {
            resolve(data);
          }
        });
      });

      req.on('error', (err) => {
        err.endpoint = base;
        reject(err);
      });
      
      req.setTimeout(timeout, () => {
        req.destroy();
        const error = new Error(`Request timeout after ${timeout}ms`);
        error.timeout = true;
        reject(error);
      });
      
      req.end();
    });
  }

  /**
   * Get endpoint name from base URL
   */
  getEndpointName(base) {
    if (base.includes('gamma')) return 'gamma';
    if (base.includes('clob')) return 'clob';
    if (base.includes('data')) return 'data';
    return 'unknown';
  }

  /**
   * Get cached data or fetch fresh with stampede protection
   */
  async getCached(key, fetchFn, ttl = this.config.cacheTTL) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.data;
    }
    
    // Stampede protection: if request is pending, wait for it
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key);
    }
    
    // Create promise for this request
    const fetchPromise = fetchFn().then(data => {
      this.cache.set(key, { data, timestamp: Date.now() });
      this.pendingRequests.delete(key);
      return data;
    }).catch(err => {
      this.pendingRequests.delete(key);
      throw err;
    });
    
    this.pendingRequests.set(key, fetchPromise);
    return fetchPromise;
  }

  /**
   * Batch multiple requests efficiently
   */
  async batchRequests(requests) {
    const results = [];
    const batchSize = 5; // Process in batches to avoid overwhelming API
    
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(req => this.request(req.base, req.path, req.params, req.method))
      );
      results.push(...batchResults);
    }
    
    return results;
  }

  // ==================== GAMMA API METHODS ====================

  async getMarkets(options = {}) {
    const params = {
      limit: options.limit || 100,
      offset: options.offset || 0
    };

    if (options.active !== undefined) params.active = options.active;
    if (options.closed !== undefined) params.closed = options.closed;
    if (options.archived !== undefined) params.archived = options.archived;
    if (options.category) params.category = options.category;
    if (options.search) params.search = options.search;

    const cacheKey = `markets:${JSON.stringify(params)}`;
    return this.getCached(cacheKey, () => this.request(GAMMA_API_BASE, '/markets', params));
  }

  async getEvents(options = {}) {
    const params = {
      limit: options.limit || 100,
      offset: options.offset || 0
    };

    if (options.active !== undefined) params.active = options.active;
    if (options.closed !== undefined) params.closed = options.closed;
    if (options.category) params.category = options.category;

    const cacheKey = `events:${JSON.stringify(params)}`;
    return this.getCached(cacheKey, () => this.request(GAMMA_API_BASE, '/events', params));
  }

  async getMarketById(marketId) {
    const cacheKey = `market:${marketId}`;
    return this.getCached(cacheKey, () => this.request(GAMMA_API_BASE, `/markets/${marketId}`), 15000);
  }

  async getMarketBySlug(slug) {
    const markets = await this.getMarkets({ limit: 1000 });
    return markets.find(m => m.slug === slug);
  }

  async getEventById(eventId) {
    const cacheKey = `event:${eventId}`;
    return this.getCached(cacheKey, () => this.request(GAMMA_API_BASE, `/events/${eventId}`));
  }

  // ==================== CLOB API METHODS ====================

  async clobRequest(path, params = {}) {
    try {
      const result = await this.request(CLOB_API_BASE, path, params);
      return result;
    } catch (error) {
      return { error: error.message || 'Request failed' };
    }
  }

  async getTokenPrice(tokenId, side = 'buy') {
    const cacheKey = `price:${tokenId}:${side}`;
    return this.getCached(cacheKey, () => this.clobRequest('/price', { 
      token_id: tokenId,
      side: side.toUpperCase()
    }), 10000);
  }

  async getOrderBook(tokenId) {
    const cacheKey = `book:${tokenId}`;
    return this.getCached(cacheKey, () => this.clobRequest('/book', { token_id: tokenId }), 5000);
  }

  async getMidpoint(tokenId) {
    const cacheKey = `midpoint:${tokenId}`;
    return this.getCached(cacheKey, () => this.clobRequest('/midpoint', { token_id: tokenId }), 10000);
  }

  async getClobMarkets(options = {}) {
    const params = { limit: options.limit || 100 };
    if (options.active !== undefined) params.active = options.active;
    
    const cacheKey = `clob-markets:${JSON.stringify(params)}`;
    return this.getCached(cacheKey, () => this.clobRequest('/markets', params));
  }

  // ==================== ENHANCED MARKET DATA ====================

  async findMarketByKeywords(searchQuery, options = {}) {
    const markets = await this.getMarkets({ 
      limit: options.limit || 1000, 
      active: options.active !== false,
      closed: options.closed || false
    });
    
    const searchTerms = searchQuery.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    let bestMatch = null;
    let bestScore = 0;

    for (const market of markets) {
      if (market.archived && !options.includeArchived) continue;
      
      const text = `${market.question || ''} ${market.description || ''}`.toLowerCase();
      let score = 0;

      for (const term of searchTerms) {
        if (market.question?.toLowerCase().includes(term)) {
          score += 10;
        } else if (market.description?.toLowerCase().includes(term)) {
          score += 5;
        } else if (text.includes(term)) {
          score += 2;
        }
      }

      if (market.acceptingOrders) score += 15;
      if (!market.closed) score += 10;

      const liquidity = parseFloat(market.liquidityNum || 0);
      if (liquidity > 10000) score += 5;
      if (liquidity > 50000) score += 10;
      if (liquidity > 100000) score += 15;

      const volume24h = parseFloat(market.volume24hr || 0);
      if (volume24h > 1000) score += 3;
      if (volume24h > 10000) score += 5;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = market;
      }
    }

    if (bestMatch && bestScore >= (options.minScore || 10)) {
      return bestMatch;
    }
    
    return null;
  }

  async getCompleteMarketData(marketIdOrSlug, options = {}) {
    let market = null;
    let searchMethod = 'direct';
    
    if (typeof marketIdOrSlug === 'number' || /^\d+$/.test(marketIdOrSlug)) {
      market = await this.getMarketById(marketIdOrSlug);
    } else if (marketIdOrSlug.includes('-') || marketIdOrSlug.length < 100) {
      market = await this.getMarketBySlug(marketIdOrSlug);
    }

    if (!market && options.fallbackToSearch !== false) {
      market = await this.findMarketByKeywords(marketIdOrSlug, {
        limit: options.searchLimit || 1000,
        minScore: options.minScore || 5,
        active: options.active
      });
      searchMethod = 'keyword';
    }

    if (!market) {
      const error = new Error(`Market not found: ${marketIdOrSlug}`);
      error.searchQuery = marketIdOrSlug;
      error.suggestions = await this.getSearchSuggestions(marketIdOrSlug);
      throw error;
    }

    let yesPrice = 0.5;
    let noPrice = 0.5;
    
    try {
      const prices = JSON.parse(market.outcomePrices || '[0.5, 0.5]');
      yesPrice = parseFloat(prices[0]);
      noPrice = parseFloat(prices[1]);
    } catch (e) {}

    let orderBookData = null;
    if (market.clobTokenIds) {
      try {
        const tokenIds = JSON.parse(market.clobTokenIds);
        if (tokenIds.length >= 2) {
          const [yesBook, noBook] = await Promise.all([
            this.getOrderBook(tokenIds[0]).catch(() => null),
            this.getOrderBook(tokenIds[1]).catch(() => null)
          ]);
          orderBookData = { yes: yesBook, no: noBook };
        }
      } catch (e) {}
    }

    return {
      id: market.id,
      question: market.question,
      slug: market.slug,
      conditionId: market.conditionId,
      prices: {
        yes: yesPrice,
        no: noPrice,
        yesPercent: (yesPrice * 100).toFixed(2) + '%',
        noPercent: (noPrice * 100).toFixed(2) + '%',
        impliedProbability: yesPrice
      },
      orderBook: orderBookData ? {
        yes: {
          bestBid: orderBookData.yes?.bids?.[0]?.price || null,
          bestAsk: orderBookData.yes?.asks?.[0]?.price || null
        },
        no: {
          bestBid: orderBookData.no?.bids?.[0]?.price || null,
          bestAsk: orderBookData.no?.asks?.[0]?.price || null
        }
      } : null,
      volume: {
        total: parseFloat(market.volume || 0),
        '24h': parseFloat(market.volume24hr || 0),
        '1w': parseFloat(market.volume1wk || 0),
        '1m': parseFloat(market.volume1mo || 0)
      },
      liquidity: {
        total: parseFloat(market.liquidityNum || 0),
        clob: parseFloat(market.liquidityClob || 0)
      },
      status: {
        active: market.active,
        closed: market.closed,
        archived: market.archived,
        acceptingOrders: market.acceptingOrders
      },
      resolution: {
        endDate: market.endDate,
        endDateIso: market.endDateIso,
        description: market.description,
        resolutionSource: market.resolutionSource,
        umaResolutionStatus: market.umaResolutionStatus,
        umaEndDate: market.umaEndDate
      },
      category: market.category,
      createdAt: market.createdAt,
      updatedAt: market.updatedAt,
      outcomes: JSON.parse(market.outcomes || '["Yes", "No"]'),
      clobTokenIds: market.clobTokenIds ? JSON.parse(market.clobTokenIds) : null,
      searchMethod
    };
  }

  async searchMarkets(keyword, options = {}) {
    const markets = await this.getMarkets({
      limit: options.limit || 100,
      active: options.active !== false
    });

    const searchTerm = keyword.toLowerCase();
    return markets.filter(m => 
      m.question?.toLowerCase().includes(searchTerm) ||
      m.description?.toLowerCase().includes(searchTerm) ||
      m.category?.toLowerCase().includes(searchTerm)
    );
  }

  async getMarketsByCategory(category, options = {}) {
    return this.getMarkets({
      category,
      limit: options.limit || 50,
      active: options.active !== false
    });
  }

  // ==================== DATA API METHODS ====================

  async getUserPositions(address, options = {}) {
    const params = {
      user: address,
      limit: options.limit || 100
    };
    
    return this.request(DATA_API_BASE, '/positions', params);
  }

  async getUserActivity(address, options = {}) {
    const params = {
      address,
      limit: options.limit || 100
    };
    
    return this.request(DATA_API_BASE, '/activity', params);
  }

  // ==================== WEBSOCKET METHODS ====================

  connectWebSocket(callbacks = {}) {
    const WebSocket = require('ws');
    
    this.wsCallbacks = callbacks;
    
    const connect = () => {
      this.wsConnection = new WebSocket(WS_BASE);
      
      this.wsConnection.on('open', () => {
        console.log('WebSocket connected');
        this.wsReconnectAttempts = 0;
        if (callbacks.onOpen) callbacks.onOpen();
      });
      
      this.wsConnection.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          this.handleWsMessage(message, callbacks);
        } catch (e) {
          if (callbacks.onError) callbacks.onError(e);
        }
      });
      
      this.wsConnection.on('close', () => {
        console.log('WebSocket disconnected');
        if (callbacks.onClose) callbacks.onClose();
        this.attemptReconnect(callbacks);
      });
      
      this.wsConnection.on('error', (err) => {
        console.error('WebSocket error:', err);
        if (callbacks.onError) callbacks.onError(err);
      });
    };
    
    connect();
    return this.wsConnection;
  }

  attemptReconnect(callbacks) {
    if (this.wsReconnectAttempts >= this.wsMaxReconnectAttempts) {
      console.error('Max WebSocket reconnect attempts reached');
      this.emit('wsMaxReconnectReached');
      return;
    }
    
    this.wsReconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.wsReconnectAttempts), 30000);
    
    console.log(`Attempting WebSocket reconnect ${this.wsReconnectAttempts}/${this.wsMaxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      this.connectWebSocket(callbacks);
    }, delay);
  }

  handleWsMessage(message, callbacks) {
    switch (message.type) {
      case 'price':
        if (callbacks.onPrice) callbacks.onPrice(message);
        break;
      case 'orderbook':
        if (callbacks.onOrderBook) callbacks.onOrderBook(message);
        break;
      case 'trade':
        if (callbacks.onTrade) callbacks.onTrade(message);
        break;
      default:
        if (callbacks.onMessage) callbacks.onMessage(message);
    }
  }

  subscribeToMarket(tokenId) {
    if (this.wsConnection && this.wsConnection.readyState === 1) {
      this.wsConnection.send(JSON.stringify({
        action: 'subscribe',
        channel: 'market',
        token_id: tokenId
      }));
    }
  }

  disconnectWebSocket() {
    this.wsMaxReconnectAttempts = 0; // Prevent reconnect
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }
  }

  // ==================== UTILITY METHODS ====================

  async getSearchSuggestions(query, maxSuggestions = 5) {
    const markets = await this.getMarkets({ limit: 500, active: true });
    const searchTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    
    const scored = markets.map(market => {
      const text = `${market.question || ''} ${market.description || ''}`.toLowerCase();
      let score = 0;
      
      for (const term of searchTerms) {
        if (market.question?.toLowerCase().includes(term)) score += 3;
        else if (text.includes(term)) score += 1;
      }
      
      return { market, score };
    });
    
    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSuggestions)
      .map(s => ({
        id: s.market.id,
        question: s.market.question,
        slug: s.market.slug,
        score: s.score,
        url: `https://polymarket.com/event/${s.market.slug}`
      }));
  }

  clearCache() {
    this.cache.clear();
    this.pendingRequests.clear();
  }

  getCircuitBreakerStatus() {
    return Object.entries(this.circuitBreakers).reduce((acc, [name, cb]) => {
      acc[name] = cb.getState();
      return acc;
    }, {});
  }

  getAuditLogs(filter = {}) {
    return this.audit.getLogs(filter);
  }

  static getDaysToResolution(endDate) {
    const end = new Date(endDate);
    const now = new Date();
    const diffMs = end - now;
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  static calculatePnL(entryPrice, currentPrice, position, amount) {
    const isYes = position.toLowerCase() === 'yes';
    
    if (isYes) {
      const shares = amount / entryPrice;
      const currentValue = shares * currentPrice;
      const pnl = currentValue - amount;
      const pnlPercent = (pnl / amount) * 100;
      
      return {
        pnl,
        pnlPercent: pnlPercent.toFixed(2),
        currentValue,
        entryValue: amount
      };
    } else {
      const entryNoPrice = 1 - entryPrice;
      const currentNoPrice = 1 - currentPrice;
      
      const shares = amount / entryNoPrice;
      const currentValue = shares * currentNoPrice;
      const pnl = currentValue - amount;
      const pnlPercent = (pnl / amount) * 100;
      
      return {
        pnl,
        pnlPercent: pnlPercent.toFixed(2),
        currentValue,
        entryValue: amount
      };
    }
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.disconnectWebSocket();
    this.agent.destroy();
    this.clearCache();
    this.audit.clear();
  }
}

module.exports = PolymarketAPI;
