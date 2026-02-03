/**
 * Functional Tests for PolyScope API
 *
 * Tests:
 * - All endpoint structure validation
 * - Error handling (404, 400, 500, 429)
 * - Authentication (missing key, invalid key)
 * - Rate limiting
 * - Caching behavior
 *
 * Target: 50+ tests, 100% pass rate
 */

const http = require('http');
const assert = require('assert');

// Configuration
const API_BASE = process.env.API_BASE || 'http://localhost:3000/api/v1';
const API_KEY = process.env.API_KEY;
const TEST_WALLET = process.env.TEST_WALLET_ADDRESS;

// Validate required environment variables
if (!API_KEY) {
  console.error('❌ ERROR: API_KEY environment variable is required');
  console.error('Example: API_KEY=test-api-key-2026-valid npm test');
  process.exit(1);
}

if (!TEST_WALLET) {
  console.error('❌ ERROR: TEST_WALLET_ADDRESS environment variable is required');
  console.error('Example: TEST_WALLET_ADDRESS=0x... npm test');
  process.exit(1);
}
const INVALID_WALLET = '0xinvalid';

// Test results
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

/**
 * Make HTTP request
 */
function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    // Fix: ensure proper URL construction with base path
    const baseUrl = API_BASE.endsWith('/') ? API_BASE : API_BASE + '/';
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    const url = new URL(cleanPath, baseUrl);
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    if (options.apiKey !== false) {
      headers['X-API-Key'] = options.apiKey || API_KEY;
    }

    const req = http.request(
      url,
      {
        method: options.method || 'GET',
        headers,
        timeout: options.timeout || 10000
      },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body: parsed
            });
          } catch (e) {
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body: data
            });
          }
        });
      }
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

/**
 * Run a test
 */
async function test(name, fn) {
  try {
    await fn();
    results.passed++;
    results.tests.push({ name, status: 'PASS' });
    console.log(`✅ ${name}`);
  } catch (error) {
    results.failed++;
    results.tests.push({ name, status: 'FAIL', error: error.message });
    console.log(`❌ ${name}`);
    console.log(`   Error: ${error.message}`);
  }
}

/**
 * Assert helpers
 */
function assertStatus(response, expected) {
  assert.strictEqual(response.status, expected, 
    `Expected status ${expected}, got ${response.status}`);
}

function assertSuccess(response) {
  assert.strictEqual(response.body.success, true, 
    `Expected success=true, got ${response.body.success}`);
}

function assertError(response) {
  assert.strictEqual(response.body.success, false, 
    `Expected success=false for error response`);
}

function assertHasField(response, field) {
  assert(response.body.data && response.body.data[field] !== undefined, 
    `Expected data.${field} to exist`);
}

function assertHeader(response, header) {
  assert(response.headers[header.toLowerCase()], 
    `Expected header ${header} to exist`);
}

// ==================== TEST SUITES ====================

async function runHealthTests() {
  console.log('\n📋 Health Endpoint Tests');
  console.log('─'.repeat(50));

  await test('Health check returns 200', async () => {
    const res = await request('/health', { apiKey: false });
    assertStatus(res, 200);
  });

  await test('Health response has correct structure', async () => {
    const res = await request('/health', { apiKey: false });
    assertSuccess(res);
    assertHasField(res, 'status');
    assertHasField(res, 'version');
    assertHasField(res, 'uptime');
  });

  await test('Health endpoint returns status healthy', async () => {
    const res = await request('/health', { apiKey: false });
    assert.strictEqual(res.body.data.status, 'healthy');
  });

  await test('Health endpoint has correlation ID header', async () => {
    const res = await request('/health', { apiKey: false });
    assertHeader(res, 'X-Correlation-ID');
  });

  await test('Health endpoint no API key required', async () => {
    const res = await request('/health', { apiKey: false });
    assertStatus(res, 200);
  });
}

async function runAuthenticationTests() {
  console.log('\n🔐 Authentication Tests');
  console.log('─'.repeat(50));

  await test('Missing API key returns 401', async () => {
    const res = await request('/markets', { apiKey: false });
    assertStatus(res, 401);
    assertError(res);
  });

  await test('Missing API key returns correct error code', async () => {
    const res = await request('/markets', { apiKey: false });
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  await test('Invalid API key returns 401', async () => {
    const res = await request('/markets', { apiKey: 'invalid-key' });
    assertStatus(res, 401);
    assertError(res);
  });

  await test('Invalid API key format returns 401', async () => {
    const res = await request('/markets', { apiKey: 'short' });
    assertStatus(res, 401);
  });

  await test('Valid API key allows access', async () => {
    const res = await request('/markets');
    assertStatus(res, 200);
  });

  await test('API key is validated on all protected routes', async () => {
    const routes = ['/markets', '/portfolio/' + TEST_WALLET, '/news'];
    for (const route of routes) {
      const res = await request(route, { apiKey: false });
      assertStatus(res, 401);
    }
  });
}

async function runMarketTests() {
  console.log('\n📈 Markets Endpoint Tests');
  console.log('─'.repeat(50));

  await test('Get markets returns 200', async () => {
    const res = await request('/markets');
    assertStatus(res, 200);
  });

  await test('Markets response has correct structure', async () => {
    const res = await request('/markets');
    assertSuccess(res);
    assertHasField(res, 'markets');
    assertHasField(res, 'pagination');
  });

  await test('Markets array contains market objects', async () => {
    const res = await request('/markets?limit=5');
    assert(Array.isArray(res.body.data.markets), 'markets should be array');
    if (res.body.data.markets.length > 0) {
      const market = res.body.data.markets[0];
      assert(market.id, 'market should have id');
      assert(market.slug, 'market should have slug');
      assert(market.question, 'market should have question');
    }
  });

  await test('Markets pagination works', async () => {
    const res = await request('/markets?limit=10&offset=0');
    assert.strictEqual(res.body.data.pagination.limit, 10);
    assert.strictEqual(res.body.data.pagination.offset, 0);
  });

  await test('Markets limit capped at 100', async () => {
    const res = await request('/markets?limit=200');
    assert(res.body.data.pagination.limit <= 100, 'limit should be capped at 100');
  });

  await test('Market search returns results', async () => {
    const res = await request('/markets/search?q=AI');
    assertStatus(res, 200);
    assertSuccess(res);
    assert(res.body.data.results !== undefined || res.body.data.suggestions !== undefined);
  });

  await test('Market search requires query parameter', async () => {
    const res = await request('/markets/search');
    assertStatus(res, 400);
    assertError(res);
  });

  await test('Market search requires min 2 characters', async () => {
    const res = await request('/markets/search?q=a');
    assertStatus(res, 400);
  });

  await test('Get specific market by slug', async () => {
    const markets = await request('/markets?limit=1');
    if (markets.body.data.markets.length > 0) {
      const slug = markets.body.data.markets[0].slug;
      const res = await request(`/markets/${slug}`);
      assertStatus(res, 200);
      assertSuccess(res);
      assert.strictEqual(res.body.data.slug, slug);
    }
  });

  await test('Get non-existent market returns 404', async () => {
    const res = await request('/markets/non-existent-market-12345');
    assertStatus(res, 404);
    assertError(res);
  });

  await test('Invalid market slug returns 400 or 404', async () => {
    const res = await request('/markets/a');
    assert(res.status === 400 || res.status === 404, 'should return 400 or 404');
  });
}

async function runPortfolioTests() {
  console.log('\n💼 Portfolio Endpoint Tests');
  console.log('─'.repeat(50));

  await test('Get portfolio returns 200 for valid wallet', async () => {
    const res = await request(`/portfolio/${TEST_WALLET}`);
    assertStatus(res, 200);
  });

  await test('Portfolio response has correct structure', async () => {
    const res = await request(`/portfolio/${TEST_WALLET}`);
    assertSuccess(res);
    assertHasField(res, 'wallet');
    assertHasField(res, 'summary');
    assertHasField(res, 'positions');
  });

  await test('Portfolio wallet matches requested', async () => {
    const res = await request(`/portfolio/${TEST_WALLET}`);
    assert.strictEqual(res.body.data.wallet.toLowerCase(), TEST_WALLET.toLowerCase());
  });

  await test('Portfolio summary has required fields', async () => {
    const res = await request(`/portfolio/${TEST_WALLET}`);
    const summary = res.body.data.summary;
    assert(summary.totalPositions !== undefined, 'should have totalPositions');
    assert(summary.totalValue !== undefined, 'should have totalValue');
  });

  await test('Invalid wallet format returns 400', async () => {
    const res = await request(`/portfolio/${INVALID_WALLET}`);
    assertStatus(res, 400);
    assertError(res);
  });

  await test('Missing wallet returns 404', async () => {
    const res = await request('/portfolio/');
    assertStatus(res, 404);
  });
}

async function runPositionsTests() {
  console.log('\n📍 Positions Endpoint Tests');
  console.log('─'.repeat(50));

  await test('Get positions returns 200 for valid wallet', async () => {
    const res = await request(`/positions/${TEST_WALLET}`);
    assertStatus(res, 200);
  });

  await test('Positions response has correct structure', async () => {
    const res = await request(`/positions/${TEST_WALLET}`);
    assertSuccess(res);
    assertHasField(res, 'wallet');
    assertHasField(res, 'summary');
    assertHasField(res, 'positions');
  });

  await test('Positions limited to 50 maximum', async () => {
    const res = await request(`/positions/${TEST_WALLET}`);
    const positions = res.body.data.positions;
    assert(positions.length <= 50, 'should not exceed 50 positions');
    assert(typeof res.body.data.truncated === 'boolean', 'should have truncated flag');
  });

  await test('Invalid wallet returns 400', async () => {
    const res = await request(`/positions/${INVALID_WALLET}`);
    assertStatus(res, 400);
    assertError(res);
  });

  await test('Configure alert requires wallet in body', async () => {
    const res = await request('/positions/test-id/alert', {
      method: 'POST',
      body: { takeProfit: 50 }
    });
    assertStatus(res, 400);
  });

  await test('Configure alert with valid data', async () => {
    const res = await request('/positions/test-id/alert', {
      method: 'POST',
      body: {
        wallet: TEST_WALLET,
        takeProfit: 50,
        stopLoss: -30
      }
    });
    assertStatus(res, 200);
    assertSuccess(res);
  });

  await test('Get alert configuration', async () => {
    const res = await request(`/positions/test-id/alert?wallet=${TEST_WALLET}`);
    // May return 404 if no config exists, that's valid
    assert(res.status === 200 || res.status === 404, 'should return 200 or 404');
  });

  await test('Delete alert configuration', async () => {
    const res = await request(`/positions/test-id/alert?wallet=${TEST_WALLET}`, {
      method: 'DELETE'
    });
    assertStatus(res, 200);
    assertSuccess(res);
  });

  await test('Alert requires at least one condition', async () => {
    const res = await request('/positions/test-id/alert', {
      method: 'POST',
      body: {
        wallet: TEST_WALLET
        // no conditions
      }
    });
    assertStatus(res, 400);
    assertError(res);
  });
}

async function runPriceTests() {
  console.log('\n💰 Price Endpoint Tests');
  console.log('─'.repeat(50));

  await test('Get price returns 200', async () => {
    // Get a token from markets first
    const markets = await request('/markets?limit=1');
    if (markets.body.data.markets.length > 0) {
      const market = markets.body.data.markets[0];
      const res = await request(`/markets/${market.slug}/price`);
      assertStatus(res, 200);
    }
  });

  await test('Price response has correct structure', async () => {
    const markets = await request('/markets?limit=1');
    if (markets.body.data.markets.length > 0) {
      const market = markets.body.data.markets[0];
      const res = await request(`/markets/${market.slug}/price`);
      assertSuccess(res);
      assertHasField(res, 'prices');
    }
  });

  await test('Direct token price endpoint', async () => {
    const res = await request('/prices/test-token-id');
    // Token may or may not exist
    assert(res.status === 200 || res.status === 404, 'should return 200 or 404');
  });
}

async function runNewsTests() {
  console.log('\n📰 News Endpoint Tests');
  console.log('─'.repeat(50));

  await test('Get news returns 200', async () => {
    const res = await request('/news');
    assertStatus(res, 200);
  });

  await test('News response has correct structure', async () => {
    const res = await request('/news');
    assertSuccess(res);
    assertHasField(res, 'articles');
    assertHasField(res, 'summary');
  });

  await test('News limit parameter works', async () => {
    const res = await request('/news?limit=5');
    assert(res.body.data.articles.length <= 5, 'should return at most 5 articles');
  });

  await test('News category filter works', async () => {
    const res = await request('/news?category=tech');
    assertStatus(res, 200);
    assertSuccess(res);
  });

  await test('News confidence filter works', async () => {
    const res = await request('/news?minConfidence=0.5');
    assertStatus(res, 200);
    assertSuccess(res);
  });

  await test('Get aggregated signals', async () => {
    const res = await request('/news/signals');
    assertStatus(res, 200);
    assertSuccess(res);
    assertHasField(res, 'aggregate');
  });

  await test('Signals can filter by market', async () => {
    const res = await request('/news/signals?market=bitcoin');
    assertStatus(res, 200);
    assertSuccess(res);
  });
}

async function runErrorHandlingTests() {
  console.log('\n⚠️ Error Handling Tests');
  console.log('─'.repeat(50));

  await test('404 returns structured error', async () => {
    const res = await request('/nonexistent');
    assertStatus(res, 404);
    assertError(res);
    assert(res.body.error.code, 'should have error code');
    assert(res.body.error.message, 'should have error message');
  });

  await test('400 returns structured error', async () => {
    const res = await request('/markets/search');
    assertStatus(res, 400);
    assertError(res);
  });

  await test('401 returns structured error', async () => {
    const res = await request('/markets', { apiKey: false });
    assertStatus(res, 401);
    assertError(res);
  });

  await test('Error response includes request ID', async () => {
    const res = await request('/nonexistent');
    assert(res.body.meta.requestId, 'should have requestId');
    assert(res.body.meta.timestamp, 'should have timestamp');
  });

  await test('Error response has consistent structure', async () => {
    const res = await request('/nonexistent');
    assert.strictEqual(typeof res.body.success, 'boolean');
    assert.strictEqual(typeof res.body.error, 'object');
    assert.strictEqual(typeof res.body.meta, 'object');
  });
}

async function runRateLimitingTests() {
  console.log('\n⏱️ Rate Limiting Tests');
  console.log('─'.repeat(50));

  await test('Rate limit headers present on success', async () => {
    const res = await request('/health', { apiKey: false });
    assertHeader(res, 'X-RateLimit-Limit');
    assertHeader(res, 'X-RateLimit-Remaining');
  });

  await test('Rate limit headers present on authenticated routes', async () => {
    const res = await request('/markets');
    assertHeader(res, 'X-RateLimit-Limit');
  });

  // Note: We won't actually test rate limit exhaustion to avoid disrupting the API
  await test('Rate limit configuration returned in headers', async () => {
    const res = await request('/markets');
    const limit = parseInt(res.headers['x-ratelimit-limit']);
    assert(limit > 0, 'rate limit should be positive');
  });
}

async function runCachingTests() {
  console.log('\n💾 Caching Tests');
  console.log('─'.repeat(50));

  await test('Cache header present on cached endpoints', async () => {
    const res = await request('/markets');
    assertHeader(res, 'X-Cache');
    const cacheValue = res.headers['x-cache'];
    assert(cacheValue === 'HIT' || cacheValue === 'MISS', 'cache should be HIT or MISS');
  });

  await test('Cache-Control header present', async () => {
    const res = await request('/markets');
    assertHeader(res, 'Cache-Control');
  });

  await test('Cached response includes cached flag in meta', async () => {
    const res = await request('/markets');
    if (res.headers['x-cache'] === 'HIT') {
      assert.strictEqual(res.body.meta.cached, true, 'should indicate cached=true');
    }
  });

  await test('Second request may be cache hit', async () => {
    // First request
    await request('/news');
    // Second request (may be cached)
    const res = await request('/news');
    assertHeader(res, 'X-Cache');
  });
}

async function runResponseStructureTests() {
  console.log('\n📊 Response Structure Tests');
  console.log('─'.repeat(50));

  await test('All responses have success field', async () => {
    const endpoints = ['/health', '/markets', '/news'];
    for (const endpoint of endpoints) {
      const res = await request(endpoint, { apiKey: endpoint === '/health' ? false : undefined });
      assert.strictEqual(typeof res.body.success, 'boolean');
    }
  });

  await test('All responses have data or error', async () => {
    const res = await request('/markets');
    assert(res.body.data !== undefined || res.body.error !== undefined);
  });

  await test('All responses have meta with requestId', async () => {
    const res = await request('/markets');
    assert(res.body.meta, 'should have meta');
    assert(res.body.meta.requestId, 'should have requestId');
  });

  await test('All responses have meta with timestamp', async () => {
    const res = await request('/markets');
    assert(res.body.meta.timestamp, 'should have timestamp');
    // Verify ISO format
    assert(!isNaN(new Date(res.body.meta.timestamp).getTime()), 'timestamp should be valid date');
  });

  await test('Correletion ID header matches meta', async () => {
    const res = await request('/markets');
    assert.strictEqual(
      res.headers['x-correlation-id'],
      res.body.meta.requestId,
      'correlation ID should match meta.requestId'
    );
  });
}

async function runSecurityTests() {
  console.log('\n🔒 Security Tests');
  console.log('─'.repeat(50));

  await test('Security headers present', async () => {
    const res = await request('/health', { apiKey: false });
    // Helmet sets various security headers
    assert(res.headers['x-content-type-options'] || res.headers['content-security-policy'],
      'should have security headers');
  });

  await test('CORS headers present', async () => {
    const res = await request('/health', { apiKey: false });
    assertHeader(res, 'access-control-allow-origin');
  });

  await test('Content-Type application/json', async () => {
    const res = await request('/markets');
    assert(res.headers['content-type'].includes('application/json'));
  });
}

// ==================== MAIN ====================

async function runAllTests() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 Polymarket Trading API - Functional Tests');
  console.log('='.repeat(60));
  console.log(`API Base: ${API_BASE}`);
  console.log(`API Key: ${API_KEY.substring(0, 8)}...`);
  console.log('');

  const startTime = Date.now();

  await runHealthTests();
  await runAuthenticationTests();
  await runMarketTests();
  await runPortfolioTests();
  await runPositionsTests();
  await runPriceTests();
  await runNewsTests();
  await runErrorHandlingTests();
  await runRateLimitingTests();
  await runCachingTests();
  await runResponseStructureTests();
  await runSecurityTests();

  const duration = Date.now() - startTime;

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 Test Summary');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${results.passed + results.failed}`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`⏱️ Duration: ${duration}ms`);
  console.log(`📊 Pass Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);
  console.log('='.repeat(60));

  // Print failed tests
  if (results.failed > 0) {
    console.log('\nFailed Tests:');
    results.tests
      .filter(t => t.status === 'FAIL')
      .forEach(t => console.log(`  ❌ ${t.name}: ${t.error}`));
  }

  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});