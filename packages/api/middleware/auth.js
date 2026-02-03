/**
 * Authentication Middleware
 * 
 * Features:
 * - API key validation from X-API-Key header
 * - Secure key storage (hashed comparison)
 * - Support for multiple key formats
 * - Rate limit integration
 * - Detailed error messages
 */

const crypto = require('crypto');

// API Key storage - MUST be configured via environment variables
// SECURITY: No default keys - application will fail-safe if not configured
const apiKeysEnv = process.env.API_KEYS || '';
const VALID_API_KEYS = new Set(
  apiKeysEnv.split(',').map(k => k.trim()).filter(k => k.length > 0)
);

// Validate that API keys are configured
if (VALID_API_KEYS.size === 0) {
  console.warn('[SECURITY WARNING] No API keys configured. Set API_KEYS environment variable.');
  console.warn('Example: API_KEYS=your-key-1,your-key-2');
}

// Hashed key cache for constant-time comparison
const hashedKeysCache = new Map();

/**
 * Hash API key for secure comparison
 */
const hashKey = (key) => {
  return crypto.createHash('sha256').update(key).digest('hex');
};

/**
 * Initialize hashed key cache
 */
const initKeyCache = () => {
  hashedKeysCache.clear();
  VALID_API_KEYS.forEach(key => {
    hashedKeysCache.set(hashKey(key), {
      key: key.substring(0, 8) + '...',
      createdAt: new Date().toISOString()
    });
  });
};

initKeyCache();

/**
 * Constant-time comparison to prevent timing attacks
 */
const secureCompare = (a, b) => {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
};

/**
 * Validate API key format
 */
const isValidKeyFormat = (key) => {
  // API keys should be 16-128 characters, alphanumeric with dashes/underscores
  const keyRegex = /^[a-zA-Z0-9_-]{16,128}$/;
  return keyRegex.test(key);
};

/**
 * Authentication middleware
 */
const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  // Check if API key is present
  if (!apiKey) {
    const error = new Error('API key is required');
    error.statusCode = 401;
    error.code = 'UNAUTHORIZED';
    error.details = {
      header: 'X-API-Key',
      documentation: 'https://docs.polymarket-api.com/auth'
    };
    return next(error);
  }

  // Validate key format
  if (!isValidKeyFormat(apiKey)) {
    const error = new Error('Invalid API key format');
    error.statusCode = 401;
    error.code = 'UNAUTHORIZED';
    error.details = {
      message: 'API key must be 16-128 characters, alphanumeric with dashes/underscores'
    };
    return next(error);
  }

  // Hash the provided key for comparison
  const providedKeyHash = hashKey(apiKey);
  
  // Check against valid keys (constant-time comparison)
  let isValid = false;
  for (const [hash, metadata] of hashedKeysCache) {
    if (secureCompare(providedKeyHash, hash)) {
      isValid = true;
      req.apiKey = metadata;
      break;
    }
  }

  if (!isValid) {
    const error = new Error('Invalid API key');
    error.statusCode = 401;
    error.code = 'UNAUTHORIZED';
    error.details = {
      message: 'The provided API key is not valid',
      support: 'Contact support if you believe this is an error'
    };
    return next(error);
  }

  // Add auth info to request
  req.isAuthenticated = true;
  
  next();
};

/**
 * Optional authentication middleware
 * - Authenticates if key provided, but doesn't require it
 */
const optionalAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    req.isAuthenticated = false;
    return next();
  }

  // Try to authenticate
  const providedKeyHash = hashKey(apiKey);
  
  for (const [hash, metadata] of hashedKeysCache) {
    if (secureCompare(providedKeyHash, hash)) {
      req.isAuthenticated = true;
      req.apiKey = metadata;
      break;
    }
  }

  next();
};

/**
 * Admin authentication middleware
 * - Requires special admin API key
 */
const authenticateAdmin = (req, res, next) => {
  const adminKey = process.env.ADMIN_API_KEY;
  
  if (!adminKey) {
    const error = new Error('Admin operations not configured');
    error.statusCode = 503;
    error.code = 'SERVICE_UNAVAILABLE';
    return next(error);
  }

  const providedKey = req.headers['x-admin-key'];
  
  if (!providedKey || !secureCompare(hashKey(providedKey), hashKey(adminKey))) {
    const error = new Error('Admin access required');
    error.statusCode = 403;
    error.code = 'FORBIDDEN';
    return next(error);
  }

  req.isAdmin = true;
  next();
};

/**
 * Refresh API keys (can be called when keys are rotated)
 */
const refreshApiKeys = () => {
  VALID_API_KEYS.clear();
  const newKeys = (process.env.API_KEYS || '').split(',');
  newKeys.forEach(key => VALID_API_KEYS.add(key.trim()));
  initKeyCache();
  console.log(`Refreshed API keys: ${VALID_API_KEYS.size} valid keys`);
};

module.exports = {
  authenticateApiKey,
  optionalAuth,
  authenticateAdmin,
  refreshApiKeys,
  getValidKeyCount: () => VALID_API_KEYS.size
};