# PolyScope API

Production-ready REST API for PolyScope analytics platform.

## Features

- **Portfolio Tracking**: Multi-chain portfolio analytics
- **Position Management**: Real-time position monitoring
- **Market Discovery**: Advanced search and filtering
- **News Aggregation**: Multi-source news feed
- **Rate Limiting**: Configurable IP and API key limits
- **Authentication**: Secure API key authentication

## Quick Start

```bash
# Install dependencies
npm install

# Set environment variables
cp .env.example .env
# Edit .env with your API keys

# Start development server
npm run dev

# Run tests
npm test
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `GET /markets` | List markets |
| `GET /markets/:id` | Market details |
| `GET /portfolio/:address` | Portfolio data |
| `GET /positions/:address` | Position list |
| `GET /news` | News feed |

See [docs/API.md](../../docs/API.md) for complete documentation.

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `API_KEYS` | Yes | Comma-separated API keys |
| `PORT` | No | Server port (default: 3000) |
| `CORS_ORIGIN` | No | CORS origin (default: *) |
| `REDIS_URL` | No | Redis URL for rate limiting |

## Architecture

```
Request → Rate Limit → Auth → Cache → Controller → Service → Response
```

## License

MIT