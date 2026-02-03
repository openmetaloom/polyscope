/**
 * Stress Tests for PolyScope API
 *
 * Tests:
 * - 10,000 requests across all endpoints
 * - 100 concurrent connections
 * - Measures: latency (p50, p95, p99), throughput, error rate
 * - Target: <1% error rate, p95 < 500ms
 */

const http = require('http');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const os = require('os');

// Configuration
const API_BASE = process.env.API_BASE || 'http://localhost:3000/api/v1';
const API_KEY = process.env.API_KEY;
const TOTAL_REQUESTS = parseInt(process.env.TOTAL_REQUESTS) || 10000;
const CONCURRENCY = parseInt(process.env.CONCURRENCY) || 100;
const TEST_WALLET = process.env.TEST_WALLET_ADDRESS;
const REPORT_INTERVAL = 1000; // ms

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

// Endpoints to test with weights (probability of selection)
const ENDPOINTS = [
  { path: '/health', weight: 10, method: 'GET', auth: false },
  { path: '/markets?limit=20', weight: 25, method: 'GET', auth: true },
  { path: '/markets/search?q=AI', weight: 10, method: 'GET', auth: true },
  { path: `/portfolio/${TEST_WALLET}`, weight: 15, method: 'GET', auth: true },
  { path: `/positions/${TEST_WALLET}`, weight: 15, method: 'GET', auth: true },
  { path: '/news?limit=5', weight: 15, method: 'GET', auth: true },
  { path: '/news/signals', weight: 10, method: 'GET', auth: true }
];

// Results storage
const results = {
  total: 0,
  successful: 0,
  failed: 0,
  latencies: [],
  statusCodes: {},
  errors: [],
  startTime: null,
  endTime: null,
  requestsPerSecond: []
};

/**
 * Calculate weighted random endpoint
 */
function getRandomEndpoint() {
  const totalWeight = ENDPOINTS.reduce((sum, e) => sum + e.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const endpoint of ENDPOINTS) {
    random -= endpoint.weight;
    if (random <= 0) {
      return endpoint;
    }
  }
  return ENDPOINTS[0];
}

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
      ...(options.headers || {})
    };

    if (options.apiKey !== false && options.auth !== false) {
      headers['X-API-Key'] = options.apiKey || API_KEY;
    }

    const startTime = Date.now();
    
    const req = http.request(
      url,
      {
        method: options.method || 'GET',
        headers,
        timeout: options.timeout || 30000
      },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const latency = Date.now() - startTime;
          resolve({
            status: res.statusCode,
            latency,
            success: res.statusCode >= 200 && res.statusCode < 400
          });
        });
      }
    );

    req.on('error', (err) => {
      reject({ error: err.message, latency: Date.now() - startTime });
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject({ error: 'timeout', latency: Date.now() - startTime });
    });

    req.end();
  });
}

/**
 * Worker function for parallel requests
 */
async function workerRequests(count) {
  const workerResults = {
    total: 0,
    successful: 0,
    failed: 0,
    latencies: [],
    statusCodes: {},
    errors: []
  };

  for (let i = 0; i < count; i++) {
    const endpoint = getRandomEndpoint();
    
    try {
      const res = await request(endpoint.path, {
        method: endpoint.method,
        auth: endpoint.auth
      });
      
      workerResults.total++;
      workerResults.latencies.push(res.latency);
      workerResults.statusCodes[res.status] = (workerResults.statusCodes[res.status] || 0) + 1;
      
      if (res.success) {
        workerResults.successful++;
      } else {
        workerResults.failed++;
      }
    } catch (err) {
      workerResults.total++;
      workerResults.failed++;
      workerResults.latencies.push(err.latency || 0);
      workerResults.errors.push(err.error || 'unknown');
    }
  }

  return workerResults;
}

/**
 * Calculate percentiles
 */
function calculatePercentiles(sortedArray, ...percentiles) {
  const results = {};
  for (const p of percentiles) {
    const index = Math.ceil((p / 100) * sortedArray.length) - 1;
    results[`p${p}`] = sortedArray[Math.max(0, index)];
  }
  return results;
}

/**
 * Format bytes
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Print progress
 */
function printProgress() {
  const elapsed = (Date.now() - results.startTime) / 1000;
  const rps = results.total / elapsed;
  const errorRate = results.total > 0 ? (results.failed / results.total) * 100 : 0;
  
  process.stdout.write(`\r📊 Progress: ${results.total}/${TOTAL_REQUESTS} | ` +
    `RPS: ${rps.toFixed(1)} | ` +
    `Errors: ${errorRate.toFixed(2)}% | ` +
    `Active: ${CONCURRENCY}  `);
}

/**
 * Run stress test with concurrency control
 */
async function runStressTest() {
  console.log('\n' + '='.repeat(70));
  console.log('🔥 Polymarket Trading API - Stress Test');
  console.log('='.repeat(70));
  console.log(`Target Requests: ${TOTAL_REQUESTS.toLocaleString()}`);
  console.log(`Concurrency: ${CONCURRENCY}`);
  console.log(`API Base: ${API_BASE}`);
  console.log('');
  console.log('Endpoints:');
  ENDPOINTS.forEach(e => {
    console.log(`  ${e.method} ${e.path} (weight: ${e.weight})`);
  });
  console.log('='.repeat(70));
  console.log('');

  results.startTime = Date.now();

  // Create batches for concurrency
  const requestsPerWorker = Math.ceil(TOTAL_REQUESTS / CONCURRENCY);
  const workers = [];
  
  // Progress reporter
  const progressInterval = setInterval(printProgress, REPORT_INTERVAL);

  // Launch workers
  const batchSize = Math.min(CONCURRENCY, os.cpus().length * 2);
  const batches = Math.ceil(CONCURRENCY / batchSize);

  for (let b = 0; b < batches; b++) {
    const batchWorkers = [];
    const workersInBatch = Math.min(batchSize, CONCURRENCY - (b * batchSize));
    
    for (let w = 0; w < workersInBatch; w++) {
      const requestsForThisWorker = Math.min(
        requestsPerWorker,
        TOTAL_REQUESTS - results.total
      );
      
      if (requestsForThisWorker <= 0) break;
      
      batchWorkers.push(workerRequests(requestsForThisWorker));
    }

    // Wait for batch to complete
    const batchResults = await Promise.all(batchWorkers);
    
    // Aggregate results
    for (const wr of batchResults) {
      results.total += wr.total;
      results.successful += wr.successful;
      results.failed += wr.failed;
      results.latencies.push(...wr.latencies);
      
      for (const [code, count] of Object.entries(wr.statusCodes)) {
        results.statusCodes[code] = (results.statusCodes[code] || 0) + count;
      }
      
      results.errors.push(...wr.errors);
    }
  }

  clearInterval(progressInterval);
  results.endTime = Date.now();

  // Calculate statistics
  const sortedLatencies = results.latencies.sort((a, b) => a - b);
  const percentiles = calculatePercentiles(sortedLatencies, 50, 95, 99);
  const duration = (results.endTime - results.startTime) / 1000;
  const avgRps = results.total / duration;
  const errorRate = (results.failed / results.total) * 100;

  // Print results
  console.log('\n\n' + '='.repeat(70));
  console.log('📈 Stress Test Results');
  console.log('='.repeat(70));
  console.log('');
  console.log('Request Statistics:');
  console.log(`  Total Requests:    ${results.total.toLocaleString()}`);
  console.log(`  Successful:        ${results.successful.toLocaleString()} (${((results.successful/results.total)*100).toFixed(1)}%)`);
  console.log(`  Failed:            ${results.failed.toLocaleString()} (${errorRate.toFixed(2)}%)`);
  console.log(`  Duration:          ${duration.toFixed(2)}s`);
  console.log(`  Avg RPS:           ${avgRps.toFixed(2)}`);
  console.log('');
  console.log('Latency Statistics:');
  console.log(`  Min:               ${sortedLatencies[0]}ms`);
  console.log(`  Max:               ${sortedLatencies[sortedLatencies.length - 1]}ms`);
  console.log(`  Mean:              ${(results.latencies.reduce((a, b) => a + b, 0) / results.latencies.length).toFixed(2)}ms`);
  console.log(`  P50:               ${percentiles.p50}ms`);
  console.log(`  P95:               ${percentiles.p95}ms`);
  console.log(`  P99:               ${percentiles.p99}ms`);
  console.log('');
  console.log('Status Code Distribution:');
  for (const [code, count] of Object.entries(results.statusCodes).sort()) {
    const pct = ((count / results.total) * 100).toFixed(1);
    console.log(`  ${code}: ${count.toLocaleString()} (${pct}%)`);
  }
  console.log('');
  
  if (results.errors.length > 0) {
    console.log('Error Distribution:');
    const errorCounts = {};
    results.errors.forEach(e => {
      errorCounts[e] = (errorCounts[e] || 0) + 1;
    });
    for (const [error, count] of Object.entries(errorCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)) {
      console.log(`  ${error}: ${count}`);
    }
    console.log('');
  }

  console.log('System Resources:');
  const memUsage = process.memoryUsage();
  console.log(`  Memory Used:       ${formatBytes(memUsage.heapUsed)}`);
  console.log(`  Memory Total:      ${formatBytes(memUsage.heapTotal)}`);
  console.log(`  RSS:               ${formatBytes(memUsage.rss)}`);
  console.log('');
  console.log('='.repeat(70));

  // Target evaluation
  console.log('🎯 Target Evaluation:');
  console.log('');
  
  const targets = [
    { name: 'Total Requests', actual: results.total, target: TOTAL_REQUESTS, unit: '', passed: results.total >= TOTAL_REQUESTS * 0.95 },
    { name: 'Error Rate', actual: errorRate, target: 1, unit: '%', passed: errorRate < 1, lowerIsBetter: true },
    { name: 'P95 Latency', actual: percentiles.p95, target: 500, unit: 'ms', passed: percentiles.p95 < 500, lowerIsBetter: true }
  ];

  targets.forEach(t => {
    const status = t.passed ? '✅' : '❌';
    const comparison = t.lowerIsBetter 
      ? (t.actual <= t.target ? '≤' : '>')
      : (t.actual >= t.target ? '≥' : '<');
    console.log(`  ${status} ${t.name}: ${t.actual}${t.unit} ${comparison} ${t.target}${t.unit}`);
  });

  const allPassed = targets.every(t => t.passed);
  console.log('');
  console.log(allPassed ? '✅ ALL TARGETS MET' : '❌ SOME TARGETS MISSED');
  console.log('='.repeat(70));

  return {
    passed: allPassed,
    totalRequests: results.total,
    errorRate,
    p95Latency: percentiles.p95,
    avgRps
  };
}

/**
 * Run sustained load test (longer duration)
 */
async function runSustainedTest() {
  console.log('\n📊 Running 60-second sustained load test...');
  
  const duration = 60000; // 60 seconds
  const startTime = Date.now();
  const sustainedResults = {
    requests: 0,
    errors: 0,
    latencies: []
  };

  const concurrency = 50;
  const workers = [];

  // Launch continuous workers
  for (let i = 0; i < concurrency; i++) {
    workers.push((async () => {
      while (Date.now() - startTime < duration) {
        const endpoint = getRandomEndpoint();
        try {
          const start = Date.now();
          await request(endpoint.path, { auth: endpoint.auth });
          sustainedResults.latencies.push(Date.now() - start);
          sustainedResults.requests++;
        } catch (err) {
          sustainedResults.errors++;
        }
      }
    })());
  }

  // Progress indicator
  const interval = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    const rps = sustainedResults.requests / elapsed;
    process.stdout.write(`\r  Elapsed: ${elapsed.toFixed(0)}s | Requests: ${sustainedResults.requests} | RPS: ${rps.toFixed(1)}  `);
  }, 1000);

  await Promise.all(workers);
  clearInterval(interval);

  const sorted = sustainedResults.latencies.sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const errorRate = (sustainedResults.errors / sustainedResults.requests) * 100;

  console.log('\n');
  console.log('Sustained Load Results:');
  console.log(`  Total Requests: ${sustainedResults.requests}`);
  console.log(`  Error Rate: ${errorRate.toFixed(2)}%`);
  console.log(`  P95 Latency: ${p95}ms`);
  console.log(`  Avg RPS: ${(sustainedResults.requests / 60).toFixed(1)}`);
  
  return {
    errorRate,
    p95Latency: p95
  };
}

// Main execution
async function main() {
  try {
    // Run main stress test
    const results = await runStressTest();
    
    // Run sustained test if main test passes
    if (results.passed) {
      const sustained = await runSustainedTest();
      
      // Final evaluation
      const finalPass = sustained.errorRate < 1 && sustained.p95Latency < 500;
      console.log('\n' + '='.repeat(70));
      console.log(finalPass ? '✅ STRESS TEST PASSED' : '❌ STRESS TEST FAILED');
      console.log('='.repeat(70));
      process.exit(finalPass ? 0 : 1);
    } else {
      console.log('\n❌ Stress test failed initial targets');
      process.exit(1);
    }
  } catch (err) {
    console.error('\n💥 Stress test crashed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

// Check if server is running before starting
async function checkServer() {
  try {
    await request('/health', { apiKey: false, timeout: 5000 });
    return true;
  } catch (err) {
    return false;
  }
}

// Start
(async () => {
  console.log('Checking server availability...');
  const isRunning = await checkServer();
  
  if (!isRunning) {
    console.error('❌ Server is not running. Please start the server first:');
    console.error('   node server.js');
    process.exit(1);
  }
  
  console.log('✅ Server is running\n');
  await main();
})();