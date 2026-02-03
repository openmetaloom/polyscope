# System Architecture

## Overview

PolyScope is a modern analytics platform for Polymarket prediction markets, built with a modular monorepo architecture.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PolyScope                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         Frontend Layer                                  │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │ │
│  │  │                      React UI (Vite)                              │  │ │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │  │ │
│  │  │  │ Portfolio│ │ Positions│ │  Markets │ │   News   │            │  │ │
│  │  │  │   View   │ │   View   │ │   View   │ │   View   │            │  │ │
│  │  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘            │  │ │
│  │  │                                                                  │  │ │
│  │  │  Components: AddressInput, Charts, MarketCards, Alerts         │  │ │
│  │  └──────────────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                       │                                     │
│                                       │ HTTP / REST                         │
│                                       ▼                                     │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                          API Layer                                      │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │ │
│  │  │                   Express.js Server                               │  │ │
│  │  │                                                                  │  │ │
│  │  │  Middleware:                                                     │  │ │
│  │  │  ├─ Authentication (API Key)                                     │  │ │
│  │  │  ├─ Rate Limiting (Token Bucket)                                 │  │ │
│  │  │  ├─ CORS                                                         │  │ │
│  │  │  ├─ Helmet (Security Headers)                                    │  │ │
│  │  │  └─ Error Handling                                               │  │ │
│  │  │                                                                  │  │ │
│  │  │  Routes:                                                         │  │ │
│  │  │  ├─ /api/v1/markets      → MarketsController                     │  │ │
│  │  │  ├─ /api/v1/portfolio    → PortfolioController                   │  │ │
│  │  │  ├─ /api/v1/positions   → PositionsController                    │  │ │
│  │  │  ├─ /api/v1/news        → NewsController                        │  │ │
│  │  │  └─ /api/v1/health      → HealthController                      │  │ │
│  │  └──────────────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                       │                                     │
│                                       │ HTTP / WebSocket                    │
│                                       ▼                                     │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                      External Services                                  │ │
│  │  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐                │ │
│  │  │   Polymarket  │ │    Gamma      │ │    CLOB       │                │ │
│  │  │     API       │ │     API       │ │     API       │                │ │
│  │  └───────────────┘ └───────────────┘ └───────────────┘                │ │
│  │  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐                │ │
│  │  │    Bankr      │ │   Alchemy     │ │   Redis       │                │ │
│  │  │     API       │ │     RPC       │ │  (Optional)   │                │ │
│  │  └───────────────┘ └───────────────┘ └───────────────┘                │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Frontend (packages/ui)

**Technology Stack:**
- React 18 with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- Recharts for data visualization
- Ethers.js for Ethereum interactions
- Axios for HTTP requests

**Key Features:**
- Responsive design (mobile-first)
- Real-time data updates
- ENS name resolution
- Portfolio visualization
- Market search and filtering

**Component Structure:**
```
src/
├── components/
│   ├── AddressInput.tsx     # Address/ENS input with validation
│   ├── PortfolioView.tsx    # Portfolio overview and charts
│   ├── PositionsView.tsx    # Position list and details
│   ├── MarketsView.tsx      # Market discovery and search
│   ├── NewsView.tsx         # News feed aggregation
│   └── common/              # Shared UI components
├── hooks/
│   ├── useApi.ts           # API client hook
│   ├── useEns.ts           # ENS resolution hook
│   └── usePortfolio.ts     # Portfolio data hook
├── services/
│   └── api.ts              # API service layer
└── types/
    └── index.ts            # TypeScript definitions
```

### 2. API (packages/api)

**Technology Stack:**
- Express.js
- Node.js >= 18
- Helmet for security headers
- Morgan for logging
- Compression for response optimization

**Architecture Pattern:**
- Controller-Service pattern
- Middleware-based request processing
- Circuit breaker for external API resilience
- Cache layer for performance

**Directory Structure:**
```
src/
├── middleware/
│   ├── auth.js           # API key authentication
│   ├── rateLimit.js      # Rate limiting (IP + API key)
│   ├── cache.js          # Response caching
│   └── errorHandler.js   # Global error handling
├── routes/
│   ├── markets.js        # Market endpoints
│   ├── portfolio.js      # Portfolio endpoints
│   ├── positions.js      # Position endpoints
│   └── news.js           # News endpoints
├── controllers/
│   ├── marketsController.js
│   ├── portfolioController.js
│   ├── positionsController.js
│   └── newsController.js
├── services/
│   ├── polymarketService.js  # Polymarket API client
│   ├── bankrService.js       # Bankr integration
│   └── cacheService.js       # Cache management
└── utils/
    ├── logger.js
    └── validators.js
```

### 3. Core (packages/core)

**Purpose:**
- Shared TypeScript types
- Common utility functions
- Constants and configuration

**Structure:**
```
src/
├── types/
│   ├── market.ts       # Market-related types
│   ├── portfolio.ts    # Portfolio types
│   ├── position.ts     # Position types
│   └── api.ts          # API response types
├── utils/
│   ├── formatters.ts   # Data formatting utilities
│   └── validators.ts   # Input validation
└── constants/
    └── index.ts        # Application constants
```

## Data Flow

### Portfolio Request Flow

```
1. User enters address in UI
   ↓
2. UI validates address format
   ↓
3. GET /api/v1/portfolio/:address
   ↓
4. Auth middleware validates API key
   ↓
5. Rate limiter checks quotas
   ↓
6. Cache middleware checks for cached response
   ↓
7. PortfolioController.processRequest()
   ↓
8. PolymarketService.fetchPortfolio()
   ├─→ Gamma API (market data)
   ├─→ CLOB API (order book data)
   └─→ Alchemy RPC (token balances)
   ↓
9. Response aggregated and cached
   ↓
10. UI renders portfolio view
```

### Position Update Flow

```
1. Scheduled job triggers update
   ↓
2. PositionService.fetchUpdates()
   ↓
3. Compare current vs previous prices
   ↓
4. Check alert conditions
   ↓
5. If alert triggered:
   ├─ Log to alert_history.json
   ├─ Send webhook notification
   └─ Deduplicate if recent similar alert
   ↓
6. Update positions.json
   ↓
7. UI polls for updates (or WebSocket push)
```

## Security Architecture

### Authentication
- API key based authentication
- Keys stored as SHA-256 hashes
- Constant-time comparison to prevent timing attacks
- Key format validation (16-128 chars, alphanumeric + dashes/underscores)

### Authorization
- Separate API keys for different clients
- Optional admin key for sensitive operations
- Rate limits per API key

### Transport Security
- HTTPS required in production
- CORS configured per-environment
- Security headers via Helmet.js:
  - Content Security Policy
  - X-Frame-Options
  - X-Content-Type-Options
  - Strict-Transport-Security

### Input Validation
- Address format validation (EIP-55 checksum)
- ENS name validation
- Query parameter sanitization
- Request body size limits (10kb)

## Caching Strategy

### Cache Layers

1. **In-Memory Cache (Node-Cache)**
   - Hot data (portfolio summaries)
   - TTL: 30 seconds
   - Circuit breaker state

2. **Redis Cache (Optional)**
   - Distributed caching for multi-instance deployments
   - Rate limit counters
   - Session data

3. **Client-Side Cache**
   - React Query / SWR patterns
   - Stale-while-revalidate strategy

### Cache Keys

```javascript
// Portfolio cache key
`portfolio:${address}:${chainId}`

// Market cache key
`market:${marketId}`

// News cache key
`news:${category}:${limit}:${offset}`
```

## Rate Limiting

### Two-Tier System

1. **IP-Based Limiting**
   - Default: 100 requests/minute per IP
   - Prevents DDoS and scraping
   - In-memory or Redis storage

2. **API Key-Based Limiting**
   - Default: 1000 requests/minute per key
   - Fair usage across clients
   - Higher limits for premium tiers

### Rate Limit Headers

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1643723400
```

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests, please try again later",
    "details": {
      "limit": 1000,
      "window": "1 minute",
      "retryAfter": 30
    },
    "correlationId": "abc123-def456"
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| UNAUTHORIZED | 401 | Invalid or missing API key |
| FORBIDDEN | 403 | Valid key but insufficient permissions |
| RATE_LIMIT_EXCEEDED | 429 | Too many requests |
| NOT_FOUND | 404 | Resource not found |
| VALIDATION_ERROR | 400 | Invalid request parameters |
| EXTERNAL_API_ERROR | 502 | Upstream API failure |
| INTERNAL_ERROR | 500 | Server error |

## Deployment Architecture

### Docker Deployment

```
┌─────────────────────────────────────────┐
│           Docker Compose                │
│  ┌─────────────────────────────────┐    │
│  │         Nginx (UI)              │    │
│  │     Port 80/443 (SSL)           │    │
│  └─────────────┬───────────────────┘    │
│                │                         │
│        ┌───────┴───────┐                 │
│        ▼               ▼                 │
│  ┌──────────┐    ┌──────────┐           │
│  │   API    │    │   API    │           │
│  │  Node    │    │  Node    │ (HA)      │
│  │  :3000   │    │  :3000   │           │
│  └──────────┘    └──────────┘           │
│        │               │                 │
│        └───────┬───────┘                 │
│                ▼                         │
│  ┌─────────────────────────────────┐    │
│  │          Redis (Optional)       │    │
│  │      Rate Limit / Cache         │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

### Vercel Deployment

```
┌─────────────────────────────────────────┐
│           Vercel Edge                  │
│  ┌─────────────────────────────────┐    │
│  │         Static UI               │    │
│  │      (CDN Distribution)         │    │
│  └─────────────┬───────────────────┘    │
│                │                         │
│                ▼                         │
│  ┌─────────────────────────────────┐    │
│  │      Serverless Functions       │    │
│  │         API Routes              │    │
│  └─────────────────────────────────┘    │
│                │                         │
│                ▼                         │
│  ┌─────────────────────────────────┐    │
│  │      External APIs              │    │
│  │   Polymarket, Bankr, Alchemy    │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

## Monitoring

### Health Checks

- `/api/v1/health` - Overall system health
- `/api/v1/health/ready` - Ready for traffic
- `/api/v1/health/live` - Application is alive

### Metrics

- Request latency (p50, p95, p99)
- Error rate by endpoint
- Cache hit/miss ratios
- Rate limit hits
- External API response times

### Logging

- Structured JSON logging in production
- Correlation IDs for request tracing
- Sensitive data redaction
- Log rotation and archival

## Scalability Considerations

### Horizontal Scaling
- Stateless API design
- Redis for shared state (rate limits, sessions)
- Load balancer health checks

### Database (Future)
- PostgreSQL for persistent data
- Read replicas for analytics queries
- Connection pooling

### CDN
- Static assets served from CDN
- API responses cacheable where appropriate
- Geographic distribution