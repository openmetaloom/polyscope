# PolyScope

> Modern analytics platform for Polymarket prediction markets

[![CI](https://github.com/yourusername/polyscope/actions/workflows/ci.yml/badge.svg)](https://github.com/yourusername/polyscope/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)

## Overview

PolyScope is a comprehensive analytics and monitoring platform for Polymarket prediction markets. It provides real-time portfolio tracking, position monitoring, market discovery, and news aggregation for prediction market participants.

## Features

### 📊 Portfolio Analytics
- Real-time portfolio valuation with PnL tracking
- Multi-asset support (USDC, ETH, market positions)
- Cross-chain balance monitoring (Ethereum, Base, Polygon)
- Historical performance analytics

### 📈 Position Tracking
- Live position monitoring with price updates
- Automated alerts for significant price movements
- Exit signal detection and recommendations
- Risk exposure analysis

### 🔍 Market Discovery
- Advanced market search and filtering
- Trending markets identification
- Liquidity and volume analytics
- Category-based market exploration

### 📰 News & Intelligence
- Multi-source news aggregation (50+ sources)
- Real-time RSS feed monitoring
- Sentiment analysis integration
- Source reliability scoring

### 🔔 Alerting & Monitoring
- Configurable price movement alerts
- Webhook support for external integrations
- Alert deduplication to prevent spam
- Persistent alert history

### 🔐 Secure API
- API key authentication with rate limiting
- CORS-enabled for browser clients
- Circuit breaker pattern for reliability
- Comprehensive request logging

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         PolyScope                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   React UI   │  │   REST API   │  │   Shared Core        │  │
│  │  (Vite)      │  │  (Express)   │  │   (Types)            │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────────────┘  │
│         │                 │                                      │
│         └─────────────────┘                                      │
│                   │                                              │
│         ┌─────────▼──────────┐                                   │
│         │  Polymarket APIs   │                                   │
│         │  Gamma / CLOB      │                                   │
│         └────────────────────┘                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/polyscope.git
cd polyscope

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your API keys

# Start development servers
npm run dev
```

The UI will be available at `http://localhost:5173` and the API at `http://localhost:3000`.

### Docker Deployment

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Documentation

- [Architecture Overview](docs/ARCHITECTURE.md) - System design and component interactions
- [API Documentation](docs/API.md) - REST API reference and examples
- [Development Setup](docs/DEVELOPMENT.md) - Detailed development environment setup
- [Self-Hosting Guide](docs/SELF_HOSTING.md) - Production deployment instructions

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `API_KEYS` | Yes | Comma-separated list of valid API keys |
| `BANKR_API_KEY` | No | Bankr API key for wallet integration |
| `PORT` | No | API server port (default: 3000) |
| `NODE_ENV` | No | Environment mode (development/production) |
| `CORS_ORIGIN` | No | CORS origin whitelist |
| `REDIS_URL` | No | Redis URL for distributed rate limiting |

See `.env.example` for the complete list.

## API Usage

### Authentication

Include your API key in the `X-API-Key` header:

```bash
curl -H "X-API-Key: your-api-key" \
  https://api.polyscope.example.com/api/v1/markets
```

### Example: Get Portfolio

```bash
curl -H "X-API-Key: your-api-key" \
  "https://api.polyscope.example.com/api/v1/portfolio/0x1234..."
```

### Example: Get Positions

```bash
curl -H "X-API-Key: your-api-key" \
  "https://api.polyscope.example.com/api/v1/positions/0x1234..."
```

## Project Structure

```
polyscope/
├── packages/
│   ├── core/          # Shared types and utilities
│   ├── api/           # Express REST API
│   └── ui/            # React frontend
├── docs/              # Documentation
├── scripts/           # Deployment and utility scripts
├── docker-compose.yml # Docker orchestration
└── vercel.json        # Vercel deployment config
```

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Security

For security issues, please see [SECURITY.md](SECURITY.md).

## License

MIT License - see [LICENSE](LICENSE) for details.

## Disclaimer

PolyScope is an analytics tool for informational purposes only. It does not provide financial advice. Always do your own research before making investment decisions. Prediction markets involve risk of loss.

## Acknowledgments

- [Polymarket](https://polymarket.com) - Prediction market platform
- [Gamma API](https://docs.polymarket.com/) - Market data API
- [CLOB API](https://docs.polymarket.com/) - Order book API