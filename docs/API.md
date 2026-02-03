# API Documentation

## Base URL

```
Development: http://localhost:3000/api/v1
Production:  https://your-domain.com/api/v1
```

## Authentication

All API requests require an API key passed in the `X-API-Key` header.

```bash
curl -H "X-API-Key: your-api-key" \
  https://api.polyscope.example.com/api/v1/markets
```

### Obtaining an API Key

API keys are configured via the `API_KEYS` environment variable (comma-separated). Contact your administrator for a key.

## Response Format

All responses follow a consistent structure:

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2026-02-03T15:30:00Z",
    "correlationId": "abc123-def456"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": { ... },
    "correlationId": "abc123-def456"
  }
}
```

## Rate Limiting

The API implements rate limiting with the following headers:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1706979000
```

Default limits:
- IP-based: 100 requests/minute
- API key-based: 1000 requests/minute

## Endpoints

### Markets

#### List Markets

```http
GET /markets
```

Query parameters:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | 20 | Number of results (max 100) |
| `offset` | integer | 0 | Pagination offset |
| `category` | string | - | Filter by category |
| `search` | string | - | Search query |
| `sort` | string | volume | Sort by: volume, liquidity, created |
| `order` | string | desc | Order: asc, desc |

Response:
```json
{
  "success": true,
  "data": {
    "markets": [
      {
        "id": "0x1234...",
        "title": "Will Bitcoin exceed $100k by end of 2026?",
        "category": "Crypto",
        "volume": 1500000,
        "liquidity": 500000,
        "price": 0.65,
        "endDate": "2026-12-31T23:59:59Z"
      }
    ],
    "pagination": {
      "total": 150,
      "limit": 20,
      "offset": 0,
      "hasMore": true
    }
  }
}
```

#### Get Market Details

```http
GET /markets/:id
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "0x1234...",
    "title": "Will Bitcoin exceed $100k by end of 2026?",
    "description": "This market resolves to Yes if...",
    "category": "Crypto",
    "volume": 1500000,
    "liquidity": 500000,
    "price": 0.65,
    "prices": {
      "yes": 0.65,
      "no": 0.35
    },
    "endDate": "2026-12-31T23:59:59Z",
    "createdAt": "2026-01-01T00:00:00Z",
    "resolutionSource": "https://...",
    "imageUrl": "https://..."
  }
}
```

### Portfolio

#### Get Portfolio

```http
GET /portfolio/:address
```

Parameters:
| Parameter | Type | Description |
|-----------|------|-------------|
| `address` | string | Ethereum address (0x...) or ENS name |

Response:
```json
{
  "success": true,
  "data": {
    "address": "0x1234...",
    "ensName": "example.eth",
    "chain": "ethereum",
    "balances": {
      "USDC": {
        "balance": "5000.00",
        "balanceUsd": 5000.00,
        "symbol": "USDC",
        "decimals": 6
      },
      "ETH": {
        "balance": "1.5",
        "balanceUsd": 4500.00,
        "symbol": "ETH",
        "decimals": 18
      }
    },
    "positionsValue": 10000.00,
    "totalValue": 19500.00,
    "pnl": {
      "realized": 500.00,
      "unrealized": 1000.00,
      "total": 1500.00
    },
    "updatedAt": "2026-02-03T15:30:00Z"
  }
}
```

#### Get Multi-Chain Portfolio

```http
GET /portfolio/:address/multi-chain
```

Response includes balances across Ethereum, Base, and Polygon.

### Positions

#### Get Positions

```http
GET /positions/:address
```

Query parameters:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | open | Filter: open, closed, all |
| `category` | string | - | Filter by category |

Response:
```json
{
  "success": true,
  "data": {
    "address": "0x1234...",
    "positions": [
      {
        "id": "pos_123",
        "marketId": "0xabc...",
        "marketTitle": "Will Bitcoin exceed $100k?",
        "outcome": "Yes",
        "shares": "100",
        "avgPrice": 0.60,
        "currentPrice": 0.65,
        "value": 65.00,
        "cost": 60.00,
        "pnl": 5.00,
        "pnlPercent": 8.33,
        "status": "open",
        "openedAt": "2026-01-15T10:00:00Z"
      }
    ],
    "summary": {
      "totalPositions": 10,
      "openPositions": 8,
      "closedPositions": 2,
      "totalValue": 1000.00,
      "totalPnL": 150.00
    }
  }
}
```

#### Get Position Details

```http
GET /positions/:address/:positionId
```

### News

#### Get News Feed

```http
GET /news
```

Query parameters:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | 20 | Number of articles |
| `category` | string | all | Filter: crypto, politics, sports, all |
| `source` | string | - | Filter by source |

Response:
```json
{
  "success": true,
  "data": {
    "articles": [
      {
        "id": "news_123",
        "title": "Bitcoin reaches new all-time high",
        "summary": "Bitcoin has surged past $100k...",
        "url": "https://example.com/article",
        "source": "CryptoNews",
        "publishedAt": "2026-02-03T14:00:00Z",
        "category": "crypto",
        "sentiment": {
          "score": 0.8,
          "label": "positive"
        },
        "relatedMarkets": ["0x1234..."]
      }
    ],
    "meta": {
      "total": 150,
      "sources": ["CryptoNews", "PoliticalWire", "ESPN"]
    }
  }
}
```

### Health

#### Health Check

```http
GET /health
```

Response:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "version": "2.0.0",
    "timestamp": "2026-02-03T15:30:00Z",
    "checks": {
      "api": "ok",
      "polymarket": "ok",
      "cache": "ok"
    }
  }
}
```

#### Readiness Check

```http
GET /health/ready
```

Returns 200 when the service is ready to accept traffic.

#### Liveness Check

```http
GET /health/live
```

Returns 200 if the application is alive.

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Invalid or missing API key |
| `FORBIDDEN` | 403 | Valid key but insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request parameters |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `EXTERNAL_API_ERROR` | 502 | Upstream API failure |
| `INTERNAL_ERROR` | 500 | Server error |

## Webhooks (Future)

### Subscribing to Webhooks

```http
POST /webhooks/subscribe
Content-Type: application/json

{
  "url": "https://your-app.com/webhook",
  "events": ["position.alert", "price.movement"],
  "secret": "your-webhook-secret"
}
```

### Webhook Payload

```json
{
  "event": "position.alert",
  "timestamp": "2026-02-03T15:30:00Z",
  "data": {
    "positionId": "pos_123",
    "alert": {
      "type": "price_movement",
      "severity": "high",
      "message": "Position value dropped by 15%"
    }
  }
}
```

## SDK Examples

### JavaScript/TypeScript

```typescript
const API_KEY = 'your-api-key';
const BASE_URL = 'https://api.polyscope.example.com/api/v1';

async function getPortfolio(address: string) {
  const response = await fetch(`${BASE_URL}/portfolio/${address}`, {
    headers: {
      'X-API-Key': API_KEY
    }
  });
  
  const data = await response.json();
  return data.data;
}

async function getMarkets(search?: string) {
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  
  const response = await fetch(`${BASE_URL}/markets?${params}`, {
    headers: {
      'X-API-Key': API_KEY
    }
  });
  
  const data = await response.json();
  return data.data.markets;
}
```

### Python

```python
import requests

API_KEY = 'your-api-key'
BASE_URL = 'https://api.polyscope.example.com/api/v1'

headers = {
    'X-API-Key': API_KEY
}

def get_portfolio(address: str):
    response = requests.get(
        f'{BASE_URL}/portfolio/{address}',
        headers=headers
    )
    response.raise_for_status()
    return response.json()['data']

def get_markets(search: str = None):
    params = {'search': search} if search else {}
    response = requests.get(
        f'{BASE_URL}/markets',
        headers=headers,
        params=params
    )
    response.raise_for_status()
    return response.json()['data']['markets']
```

### cURL

```bash
# Get portfolio
curl -H "X-API-Key: your-api-key" \
  https://api.polyscope.example.com/api/v1/portfolio/0x1234...

# List markets
curl -H "X-API-Key: your-api-key" \
  "https://api.polyscope.example.com/api/v1/markets?limit=10&search=bitcoin"

# Get news
curl -H "X-API-Key: your-api-key" \
  https://api.polyscope.example.com/api/v1/news?category=crypto
```

## OpenAPI Spec

The full OpenAPI 3.0 specification is available at:

```
GET /api-docs.json
```

Or view the interactive documentation at `/api-docs` when running locally.