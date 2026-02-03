/**
 * Hardened Live Position Tracker
 * 
 * Production-ready position tracking with:
 * - Memory leak prevention
 * - Alert deduplication
 * - Webhook support
 * - Concurrent update safety
 * - Persistent alert history
 */

const PolymarketAPI = require('./polymarket_api_hardened');
const MarketDiscovery = require('./market_discovery');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const EventEmitter = require('events');

// Default configuration
const DEFAULT_CONFIG = {
  positionsPath: './positions.json',
  alertHistoryPath: './alert_history.json',
  alertThreshold: 5,           // 5% move alert
  checkInterval: 60000,        // 1 minute default
  maxPriceHistory: 1000,       // Max entries per market
  maxAlertsInMemory: 1000,     // Max alerts to keep in memory
  webhookTimeout: 5000,        // Webhook timeout (ms)
  enableWebhooks: false,
  webhookUrls: [],
  concurrentUpdates: 3,        // Max concurrent position updates
  alertDeduplicationWindow: 3600000, // 1 hour dedup window
  memoryCheckInterval: 300000  // Check memory every 5 minutes
};

/**
 * Alert Manager with deduplication and history
 */
class AlertManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...options };
    this.alertHistory = new Map(); // For deduplication
    this.persistedAlerts = [];
    this.historyPath = this.config.alertHistoryPath;
    this.deduplicationWindow = this.config.alertDeduplicationWindow;
  }

  /**
   * Generate unique fingerprint for alert
   */
  generateFingerprint(position, alert) {
    const data = `${position.market_id || position.market}:${alert.type}:${alert.severity}`;
    return crypto.createHash('md5').update(data).digest('hex');
  }

  /**
   * Check if alert should be sent (deduplication)
   */
  shouldSendAlert(position, alert) {
    const fingerprint = this.generateFingerprint(position, alert);
    const lastSent = this.alertHistory.get(fingerprint);
    const now = Date.now();

    // If never sent or outside deduplication window
    if (!lastSent || (now - lastSent) > this.deduplicationWindow) {
      this.alertHistory.set(fingerprint, now);
      return { shouldSend: true, fingerprint };
    }

    return { shouldSend: false, fingerprint, lastSent };
  }

  /**
   * Record alert to history
   */
  async recordAlert(position, alert, fingerprint) {
    const record = {
      id: crypto.randomUUID(),
      fingerprint,
      timestamp: new Date().toISOString(),
      market: position.market,
      market_id: position.market_id,
      position_id: position.id,
      alert_type: alert.type,
      severity: alert.severity,
      message: alert.message,
      metadata: {
        current_price: position.current_price,
        unrealized_pnl_pct: position.unrealized_pnl_pct,
        days_to_resolution: position.days_to_resolution
      }
    };

    this.persistedAlerts.push(record);
    
    // Trim if needed
    if (this.persistedAlerts.length > this.config.maxAlertsInMemory) {
      this.persistedAlerts = this.persistedAlerts.slice(-this.config.maxAlertsInMemory / 2);
    }

    // Persist to disk
    await this.persistHistory();

    this.emit('alertRecorded', record);
    return record;
  }

  /**
   * Persist alert history to disk
   */
  async persistHistory() {
    try {
      const data = {
        alerts: this.persistedAlerts,
        last_updated: new Date().toISOString()
      };
      await fs.writeFile(this.historyPath, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error('Failed to persist alert history:', err.message);
    }
  }

  /**
   * Load alert history from disk
   */
  async loadHistory() {
    try {
      const data = await fs.readFile(this.historyPath, 'utf8');
      const parsed = JSON.parse(data);
      this.persistedAlerts = parsed.alerts || [];
      
      // Rebuild in-memory dedup map
      this.persistedAlerts.forEach(alert => {
        if (alert.fingerprint) {
          const timestamp = new Date(alert.timestamp).getTime();
          this.alertHistory.set(alert.fingerprint, timestamp);
        }
      });
    } catch (e) {
      // File doesn't exist or is corrupted
      this.persistedAlerts = [];
    }
  }

  /**
   * Get alert history with filtering
   */
  getHistory(filter = {}) {
    let alerts = [...this.persistedAlerts];

    if (filter.market) {
      alerts = alerts.filter(a => a.market === filter.market);
    }
    if (filter.type) {
      alerts = alerts.filter(a => a.alert_type === filter.type);
    }
    if (filter.since) {
      alerts = alerts.filter(a => new Date(a.timestamp) >= filter.since);
    }
    if (filter.limit) {
      alerts = alerts.slice(-filter.limit);
    }

    return alerts;
  }

  /**
   * Cleanup old deduplication entries
   */
  cleanup() {
    const now = Date.now();
    const window = this.deduplicationWindow * 2; // Keep some buffer

    for (const [fingerprint, timestamp] of this.alertHistory.entries()) {
      if (now - timestamp > window) {
        this.alertHistory.delete(fingerprint);
      }
    }
  }
}

/**
 * Webhook Dispatcher
 */
class WebhookDispatcher {
  constructor(options = {}) {
    this.urls = options.webhookUrls || [];
    this.timeout = options.webhookTimeout || 5000;
    this.enabled = options.enableWebhooks || false;
  }

  async dispatch(alert, position) {
    if (!this.enabled || this.urls.length === 0) return;

    const payload = {
      timestamp: new Date().toISOString(),
      alert: {
        type: alert.type,
        severity: alert.severity,
        message: alert.message
      },
      position: {
        id: position.id,
        market: position.market,
        market_id: position.market_id,
        position: position.position,
        amount: position.amount,
        current_price: position.current_price,
        unrealized_pnl: position.unrealized_pnl,
        unrealized_pnl_pct: position.unrealized_pnl_pct
      }
    };

    const promises = this.urls.map(url => this.sendWebhook(url, payload));
    const results = await Promise.allSettled(promises);

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Webhook failed for ${this.urls[index]}:`, result.reason.message);
      }
    });
  }

  async sendWebhook(url, payload) {
    const https = require('https');
    const http = require('http');
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    return new Promise((resolve, reject) => {
      const data = JSON.stringify(payload);
      
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length,
          'X-Source': 'polymarket-trader'
        }
      };

      const req = client.request(options, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ status: res.statusCode });
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });

      req.on('error', reject);
      req.setTimeout(this.timeout, () => {
        req.destroy();
        reject(new Error('Webhook timeout'));
      });

      req.write(data);
      req.end();
    });
  }
}

/**
 * Memory Monitor
 */
class MemoryMonitor {
  constructor(checkInterval = 300000) {
    this.checkInterval = checkInterval;
    this.intervalId = null;
    this.thresholds = {
      warning: 500 * 1024 * 1024,  // 500MB
      critical: 1 * 1024 * 1024 * 1024  // 1GB
    };
  }

  start(callback) {
    this.intervalId = setInterval(() => {
      const usage = process.memoryUsage();
      const heapUsed = usage.heapUsed;

      if (heapUsed > this.thresholds.critical) {
        console.error(`🚨 CRITICAL: Memory usage ${(heapUsed / 1024 / 1024).toFixed(2)}MB`);
        if (callback) callback('critical', usage);
      } else if (heapUsed > this.thresholds.warning) {
        console.warn(`⚠️ WARNING: Memory usage ${(heapUsed / 1024 / 1024).toFixed(2)}MB`);
        if (callback) callback('warning', usage);
      }
    }, this.checkInterval);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

/**
 * Hardened Live Position Tracker
 */
class LivePositionTracker extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.config = { ...DEFAULT_CONFIG, ...options };
    this.api = new PolymarketAPI(options);
    this.discovery = new MarketDiscovery(options);
    
    // Alert management
    this.alertManager = new AlertManager(this.config);
    this.webhookDispatcher = new WebhookDispatcher(this.config);
    
    // State
    this.intervalId = null;
    this.priceHistory = new Map();
    this.updateLocks = new Map(); // For concurrent update safety
    this.callbacks = {};
    
    // Memory monitor
    this.memoryMonitor = new MemoryMonitor(this.config.memoryCheckInterval);
    
    // Setup cleanup
    this.setupCleanup();
  }

  setupCleanup() {
    // Cleanup on process exit
    process.on('SIGINT', () => this.destroy());
    process.on('SIGTERM', () => this.destroy());
    
    // Periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.cleanupMemory();
      this.alertManager.cleanup();
    }, 60000); // Every minute
  }

  /**
   * Load positions from file
   */
  async loadPositions() {
    try {
      const data = await fs.readFile(this.config.positionsPath, 'utf8');
      const parsed = JSON.parse(data);
      return parsed.positions || [];
    } catch (e) {
      return [];
    }
  }

  /**
   * Save positions to file with safety checks
   */
  async savePositions(positions) {
    // Validate positions
    if (!Array.isArray(positions)) {
      throw new Error('Positions must be an array');
    }

    const data = {
      positions,
      portfolio_summary: this.calculatePortfolioSummary(positions),
      last_updated: new Date().toISOString(),
      version: '2.0'
    };

    // Write to temp file first (atomic write with unique name)
    const tempPath = this.config.positionsPath + '.tmp.' + Date.now() + '.' + Math.random().toString(36).substr(2, 9);
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2));
    await fs.rename(tempPath, this.config.positionsPath);
  }

  /**
   * Calculate portfolio summary
   */
  calculatePortfolioSummary(positions) {
    const activePositions = positions.filter(p => p.status === 'active');
    const totalInvested = activePositions.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalCurrentValue = activePositions.reduce((sum, p) => sum + (p.current_value || p.amount || 0), 0);
    const totalPnL = totalCurrentValue - totalInvested;
    const totalPnLPct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

    return {
      total_invested: totalInvested,
      total_current_value: totalCurrentValue,
      total_pnl: totalPnL,
      total_pnl_pct: totalPnLPct.toFixed(2),
      position_count: positions.length,
      active_positions: activePositions.length,
      closed_positions: positions.filter(p => p.status === 'closed').length,
      calculated_at: new Date().toISOString()
    };
  }

  /**
   * Update a single position with lock protection
   */
  async updatePosition(position) {
    const lockKey = position.id || position.market;
    
    // Acquire lock
    if (this.updateLocks.has(lockKey)) {
      console.log(`Position ${lockKey} is being updated by another process, waiting...`);
      await this.updateLocks.get(lockKey);
    }

    const updatePromise = this.performUpdate(position);
    this.updateLocks.set(lockKey, updatePromise);

    try {
      const result = await updatePromise;
      return result;
    } finally {
      this.updateLocks.delete(lockKey);
    }
  }

  /**
   * Perform actual position update
   */
  async performUpdate(position) {
    try {
      let marketData;
      let searchMethod = 'direct';
      
      if (position.market_id) {
        try {
          marketData = await this.api.getCompleteMarketData(position.market_id);
        } catch (e) {
          marketData = await this.api.getCompleteMarketData(position.market, { fallbackToSearch: true });
          searchMethod = 'keyword';
        }
      } else if (position.slug) {
        try {
          marketData = await this.api.getCompleteMarketData(position.slug);
        } catch (e) {
          marketData = await this.api.getCompleteMarketData(position.market, { fallbackToSearch: true });
          searchMethod = 'keyword';
        }
      } else {
        marketData = await this.api.getCompleteMarketData(position.market, { 
          fallbackToSearch: true,
          minScore: 3
        });
        searchMethod = 'keyword';
      }
      
      if (!marketData) {
        throw new Error(`Market not found: ${position.market}`);
      }

      const isYes = position.position.toLowerCase() === 'yes';
      const currentPrice = isYes ? marketData.prices.yes : marketData.prices.no;
      const currentOdds = (currentPrice * 100).toFixed(2) + '%';

      const entryOddsValue = parseFloat(position.entry_odds) / 100;
      const entryPrice = position.entry_price || entryOddsValue;
      
      const pnlData = PolymarketAPI.calculatePnL(
        entryPrice,
        currentPrice,
        position.position,
        position.amount
      );

      this.trackPriceHistory(position.market, currentPrice);
      const alerts = await this.processAlerts(position, currentPrice, pnlData);

      const daysToResolution = PolymarketAPI.getDaysToResolution(marketData.resolution.endDate);

      return {
        ...position,
        market_id: marketData.id,
        slug: marketData.slug,
        current_odds: currentOdds,
        current_price: currentPrice,
        current_value: pnlData.currentValue,
        unrealized_pnl: pnlData.pnl,
        unrealized_pnl_pct: parseFloat(pnlData.pnlPercent),
        days_to_resolution: daysToResolution,
        volume_24h: marketData.volume['24h'],
        liquidity: marketData.liquidity.total,
        best_bid: marketData.orderBook?.[isYes ? 'yes' : 'no']?.bestBid || null,
        best_ask: marketData.orderBook?.[isYes ? 'yes' : 'no']?.bestAsk || null,
        spread: marketData.orderBook ? 
          (marketData.orderBook[isYes ? 'yes' : 'no']?.bestAsk - 
           marketData.orderBook[isYes ? 'yes' : 'no']?.bestBid) : null,
        last_updated: new Date().toISOString(),
        market_url: `https://polymarket.com/event/${marketData.slug}`,
        search_method: searchMethod,
        alerts
      };
    } catch (error) {
      console.error(`Error updating position "${position.market}":`, error.message);
      
      return {
        ...position,
        update_error: error.message,
        last_updated: new Date().toISOString()
      };
    }
  }

  /**
   * Track price history with memory limits
   */
  trackPriceHistory(marketKey, currentPrice) {
    if (!this.priceHistory.has(marketKey)) {
      this.priceHistory.set(marketKey, []);
    }
    
    const history = this.priceHistory.get(marketKey);
    
    // Add new entry
    history.push({
      price: currentPrice,
      timestamp: Date.now()
    });
    
    // Enforce max size
    if (history.length > this.config.maxPriceHistory) {
      history.splice(0, history.length - this.config.maxPriceHistory);
    }
    
    // Also remove entries older than 1 hour
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    while (history.length > 0 && history[0].timestamp < oneHourAgo) {
      history.shift();
    }
  }

  /**
   * Process alerts with deduplication
   */
  async processAlerts(position, currentPrice, pnlData) {
    const rawAlerts = this.checkAlertConditions(position, currentPrice, pnlData);
    const processedAlerts = [];

    for (const alert of rawAlerts) {
      const { shouldSend, fingerprint } = this.alertManager.shouldSendAlert(position, alert);

      if (shouldSend) {
        // Record alert
        await this.alertManager.recordAlert(position, alert, fingerprint);

        // Dispatch webhook
        await this.webhookDispatcher.dispatch(alert, position);

        // Trigger callback
        if (this.callbacks.onAlert) {
          this.callbacks.onAlert(position, alert);
        }

        this.emit('alert', position, alert);
        processedAlerts.push(alert);
      }
    }

    return processedAlerts;
  }

  /**
   * Check alert conditions
   */
  checkAlertConditions(position, currentPrice, pnlData) {
    const alerts = [];
    const marketKey = position.market;
    const history = this.priceHistory.get(marketKey) || [];
    
    // Significant price move in 1 hour
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const oldPriceEntry = history.find(h => h.timestamp >= oneHourAgo);
    
    if (oldPriceEntry) {
      const priceChange = Math.abs(currentPrice - oldPriceEntry.price) / oldPriceEntry.price * 100;
      if (priceChange >= this.config.alertThreshold) {
        alerts.push({
          type: 'PRICE_MOVE',
          severity: priceChange >= 10 ? 'HIGH' : 'MEDIUM',
          message: `Price moved ${priceChange.toFixed(2)}% in the last hour`,
          oldPrice: oldPriceEntry.price,
          newPrice: currentPrice
        });
      }
    }

    // Take profit signal (+50%)
    if (pnlData.pnlPercent >= 50) {
      alerts.push({
        type: 'TAKE_PROFIT',
        severity: 'HIGH',
        message: `Position up ${pnlData.pnlPercent}%. Consider taking profits.`,
        pnlPercent: pnlData.pnlPercent
      });
    }

    // Stop loss signal (-30%)
    if (pnlData.pnlPercent <= -30) {
      alerts.push({
        type: 'STOP_LOSS',
        severity: 'HIGH',
        message: `Position down ${Math.abs(pnlData.pnlPercent)}%. Consider cutting losses.`,
        pnlPercent: pnlData.pnlPercent
      });
    }

    // Time decay warning (< 7 days)
    if (position.days_to_resolution <= 7 && position.days_to_resolution > 0) {
      alerts.push({
        type: 'TIME_DECAY',
        severity: 'MEDIUM',
        message: `Market resolves in ${position.days_to_resolution} days. Reassess position.`,
        daysLeft: position.days_to_resolution
      });
    }

    // Liquidity warning
    if (position.liquidity < 5000) {
      alerts.push({
        type: 'LOW_LIQUIDITY',
        severity: 'LOW',
        message: 'Low liquidity may affect exit price.',
        liquidity: position.liquidity
      });
    }

    return alerts;
  }

  /**
   * Update all positions with concurrency control
   */
  async updateAllPositions() {
    const positions = await this.loadPositions();
    const updatedPositions = [];
    
    console.log(`Updating ${positions.length} positions...`);
    
    // Process in batches to control concurrency
    const activePositions = positions.filter(p => p.status === 'active');
    const batchSize = this.config.concurrentUpdates;
    
    for (let i = 0; i < activePositions.length; i += batchSize) {
      const batch = activePositions.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(p => this.updatePosition(p))
      );
      updatedPositions.push(...batchResults);
    }

    // Add non-active positions back
    updatedPositions.push(...positions.filter(p => p.status !== 'active'));

    await this.savePositions(updatedPositions);
    
    if (this.callbacks.onUpdate) {
      this.callbacks.onUpdate(updatedPositions);
    }
    
    this.emit('update', updatedPositions);
    return updatedPositions;
  }

  /**
   * Get position summary with recommendations
   */
  async getPositionSummary() {
    const positions = await this.loadPositions();
    const activePositions = positions.filter(p => p.status === 'active');
    
    const summary = {
      totalPositions: positions.length,
      activePositions: activePositions.length,
      totalInvested: activePositions.reduce((sum, p) => sum + (p.amount || 0), 0),
      totalCurrentValue: activePositions.reduce((sum, p) => sum + (p.current_value || p.amount || 0), 0),
      totalPnL: 0,
      totalPnLPct: 0,
      winners: activePositions.filter(p => (p.unrealized_pnl_pct || 0) > 0),
      losers: activePositions.filter(p => (p.unrealized_pnl_pct || 0) < 0),
      positionsWithAlerts: activePositions.filter(p => p.alerts && p.alerts.length > 0),
      recommendations: []
    };
    
    summary.totalPnL = summary.totalCurrentValue - summary.totalInvested;
    summary.totalPnLPct = summary.totalInvested > 0 ? 
      (summary.totalPnL / summary.totalInvested) * 100 : 0;

    // Generate recommendations
    const takeProfitCandidates = activePositions.filter(p => (p.unrealized_pnl_pct || 0) >= 50);
    const stopLossCandidates = activePositions.filter(p => (p.unrealized_pnl_pct || 0) <= -30);
    const timeDecayCandidates = activePositions.filter(p => (p.days_to_resolution || 999) <= 7);
    
    if (takeProfitCandidates.length > 0) {
      summary.recommendations.push({
        type: 'TAKE_PROFIT',
        count: takeProfitCandidates.length,
        message: `${takeProfitCandidates.length} position(s) showing >50% gains.`,
        positions: takeProfitCandidates.map(p => p.market)
      });
    }
    
    if (stopLossCandidates.length > 0) {
      summary.recommendations.push({
        type: 'STOP_LOSS',
        count: stopLossCandidates.length,
        message: `${stopLossCandidates.length} position(s) showing >30% losses.`,
        positions: stopLossCandidates.map(p => p.market)
      });
    }
    
    if (timeDecayCandidates.length > 0) {
      summary.recommendations.push({
        type: 'TIME_DECAY',
        count: timeDecayCandidates.length,
        message: `${timeDecayCandidates.length} position(s) resolve within 7 days.`,
        positions: timeDecayCandidates.map(p => p.market)
      });
    }

    return summary;
  }

  /**
   * Add a new position
   */
  async addPosition(positionData) {
    const positions = await this.loadPositions();
    
    const newPosition = {
      id: `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      market: positionData.market,
      position: positionData.position.toUpperCase(),
      amount: positionData.amount,
      entry_odds: positionData.entry_odds,
      entry_price: positionData.entry_price || parseFloat(positionData.entry_odds) / 100,
      thesis: positionData.thesis || '',
      thesis_still_valid: true,
      date_opened: new Date().toISOString().split('T')[0],
      status: 'active',
      last_updated: new Date().toISOString()
    };
    
    positions.push(newPosition);
    await this.savePositions(positions);
    
    this.emit('positionAdded', newPosition);
    return newPosition;
  }

  /**
   * Close a position
   */
  async closePosition(market, exitData) {
    const positions = await this.loadPositions();
    
    const positionIndex = positions.findIndex(p => 
      p.market === market && p.status === 'active'
    );
    
    if (positionIndex === -1) {
      throw new Error(`Active position not found for market: ${market}`);
    }
    
    const position = positions[positionIndex];
    const exitPrice = exitData.exit_price || exitData.exit_odds / 100;
    const pnl = (exitPrice - position.entry_price) * position.amount * 
      (position.position === 'YES' ? 1 : -1);
    
    positions[positionIndex] = {
      ...position,
      status: 'closed',
      exit_price: exitPrice,
      exit_odds: exitData.exit_odds,
      realized_pnl: pnl,
      realized_pnl_pct: (pnl / position.amount) * 100,
      exit_date: new Date().toISOString().split('T')[0],
      exit_reason: exitData.reason || '',
      last_updated: new Date().toISOString()
    };
    
    await this.savePositions(positions);
    
    this.emit('positionClosed', positions[positionIndex]);
    return positions[positionIndex];
  }

  /**
   * Start auto-update loop
   */
  async startAutoUpdate() {
    // Load alert history
    await this.alertManager.loadHistory();
    
    // Start memory monitor
    this.memoryMonitor.start((level, usage) => {
      this.emit('memoryWarning', { level, usage });
    });
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    
    console.log(`Starting auto-update every ${this.config.checkInterval / 1000} seconds`);
    
    // Run immediately
    await this.updateAllPositions();
    
    // Then set interval
    this.intervalId = setInterval(() => {
      this.updateAllPositions().catch(err => {
        console.error('Auto-update failed:', err.message);
      });
    }, this.config.checkInterval);
  }

  /**
   * Stop auto-update loop
   */
  stopAutoUpdate() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.memoryMonitor.stop();
    console.log('Auto-update stopped');
  }

  /**
   * Set callback for events
   */
  on(event, callback) {
    this.callbacks[event] = callback;
  }

  /**
   * Cleanup memory
   */
  cleanupMemory() {
    // Clear old price history entries beyond max
    for (const [marketKey, history] of this.priceHistory.entries()) {
      if (history.length > this.config.maxPriceHistory) {
        history.splice(0, history.length - this.config.maxPriceHistory);
      }
    }
  }

  /**
   * Generate detailed position report
   */
  async generateReport() {
    const positions = await this.loadPositions();
    const activePositions = positions.filter(p => p.status === 'active');
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: await this.getPositionSummary(),
      positions: activePositions.map(p => ({
        market: p.market,
        position: p.position,
        amount: p.amount,
        entry: p.entry_odds,
        current: p.current_odds,
        pnl: p.unrealized_pnl?.toFixed(2) || '0.00',
        pnlPct: p.unrealized_pnl_pct?.toFixed(2) + '%' || '0.00%',
        daysLeft: p.days_to_resolution,
        url: p.market_url,
        alerts: p.alerts || []
      })),
      closedPositions: positions.filter(p => p.status === 'closed').map(p => ({
        market: p.market,
        position: p.position,
        realizedPnl: p.realized_pnl?.toFixed(2),
        realizedPnlPct: p.realized_pnl_pct?.toFixed(2) + '%',
        exitReason: p.exit_reason
      })),
      alertHistory: this.alertManager.getHistory({ limit: 50 }),
      systemStatus: {
        circuitBreakers: this.api.getCircuitBreakerStatus(),
        memoryUsage: process.memoryUsage()
      }
    };

    return report;
  }

  /**
   * Get alert history
   */
  getAlertHistory(filter = {}) {
    return this.alertManager.getHistory(filter);
  }

  /**
   * Cleanup and destroy
   */
  destroy() {
    this.stopAutoUpdate();
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.api.destroy();
    
    // Save alert history
    this.alertManager.persistHistory();
  }
}

module.exports = LivePositionTracker;
