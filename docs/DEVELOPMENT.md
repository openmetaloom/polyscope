# Development Setup

## Prerequisites

- **Node.js** >= 18.0.0 (recommend using [nvm](https://github.com/nvm-sh/nvm))
- **npm** >= 9.0.0 (comes with Node.js)
- **Git**
- (Optional) **Docker** and Docker Compose
- (Optional) **Redis** for distributed rate limiting

## Quick Start

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/yourusername/polyscope.git
cd polyscope

# Install dependencies for all workspaces
npm install
```

### 2. Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your configuration
# At minimum, set API_KEYS
nano .env
```

Required variables:
```
API_KEYS=your-dev-api-key-min-16-characters
```

Optional but recommended:
```
BANKR_API_KEY=your-bankr-api-key
VITE_API_URL=http://localhost:3000/api/v1
```

### 3. Start Development

```bash
# Start both API and UI in parallel
npm run dev
```

This will start:
- API server at http://localhost:3000
- UI development server at http://localhost:5173

## Workspace Commands

The monorepo uses npm workspaces. You can run commands in specific packages:

```bash
# Run API only
npm run dev -w packages/api

# Run UI only
npm run dev -w packages/ui

# Build UI
npm run build -w packages/ui

# Test API
npm test -w packages/api
```

## Project Structure

```
polyscope/
├── packages/
│   ├── core/          # Shared TypeScript types and utilities
│   ├── api/           # Express.js REST API
│   └── ui/            # React + Vite frontend
├── docs/              # Documentation
├── scripts/           # Utility scripts
├── .env.example       # Environment template
└── package.json       # Root workspace config
```

## Development Workflow

### 1. Making Changes

1. Create a feature branch:
   ```bash
   git checkout -b feature/my-feature
   ```

2. Make your changes in the appropriate package(s)

3. Test your changes:
   ```bash
   npm test
   npm run lint
   ```

4. Commit with a descriptive message:
   ```bash
   git commit -m "Add feature: description"
   ```

### 2. API Development

The API is located in `packages/api/`.

Key files:
- `server.js` - Express application setup
- `routes/` - Route definitions
- `middleware/` - Auth, rate limiting, caching
- `controllers/` - Request handlers

To add a new endpoint:

1. Create a route in `routes/`:
   ```javascript
   // routes/example.js
   const express = require('express');
   const router = express.Router();
   
   router.get('/', (req, res) => {
     res.json({ message: 'Hello World' });
   });
   
   module.exports = router;
   ```

2. Register in `server.js`:
   ```javascript
   const exampleRouter = require('./routes/example');
   app.use('/api/v1/example', authenticateApiKey, exampleRouter);
   ```

### 3. UI Development

The UI is located in `packages/ui/`.

Key directories:
- `src/components/` - React components
- `src/hooks/` - Custom React hooks
- `src/services/` - API client services
- `src/types/` - TypeScript definitions

To add a new component:

1. Create the component file:
   ```tsx
   // src/components/MyComponent.tsx
   import React from 'react';
   
   export const MyComponent: React.FC = () => {
     return <div>My Component</div>;
   };
   ```

2. Use it in your pages or other components

### 4. Core Package Development

The core package contains shared types and utilities:

```typescript
// packages/core/src/types/market.ts
export interface Market {
  id: string;
  title: string;
  price: number;
  // ...
}
```

After making changes:
```bash
npm run build -w packages/core
```

## Testing

### Unit Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific package
npm test -w packages/api
```

### Integration Tests

```bash
# Run functional tests (requires API running)
cd packages/api
node test_functional.js

# Run stress tests
node test_stress.js
```

### Manual Testing

Use the provided test scripts or curl:

```bash
# Test health endpoint
curl http://localhost:3000/api/v1/health

# Test with API key
curl -H "X-API-Key: your-key" \
  http://localhost:3000/api/v1/markets
```

## Debugging

### API Debugging

1. Enable debug logging:
   ```
   NODE_ENV=development
   DEBUG=polyscope:*
   ```

2. Use VS Code debugger:
   ```json
   // .vscode/launch.json
   {
     "version": "0.2.0",
     "configurations": [
       {
         "type": "node",
         "request": "launch",
         "name": "Debug API",
         "program": "${workspaceFolder}/packages/api/server.js"
       }
     ]
   }
   ```

### UI Debugging

1. Use React DevTools browser extension
2. Enable Redux DevTools (if using state management)
3. Check browser console for errors

### Common Issues

**Port already in use:**
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

**Module not found:**
```bash
# Clean and reinstall
npm run clean
npm install
```

**API connection refused in UI:**
- Check that API is running
- Verify `VITE_API_URL` in `.env`
- Check CORS settings

## Docker Development

### Using Docker Compose

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f api
docker-compose logs -f ui

# Restart a service
docker-compose restart api

# Stop all services
docker-compose down
```

### With Redis (for distributed rate limiting)

```bash
docker-compose --profile with-redis up -d
```

### Rebuilding after changes

```bash
# Rebuild specific service
docker-compose up -d --build api

# Rebuild all
docker-compose up -d --build
```

## Code Quality

### Linting

```bash
# Run linter
npm run lint

# Fix auto-fixable issues
npm run lint -- --fix
```

### Type Checking (UI)

```bash
cd packages/ui
npx tsc --noEmit
```

## Environment Variables Reference

### API Variables

| Variable | Development | Production |
|----------|-------------|------------|
| `NODE_ENV` | `development` | `production` |
| `PORT` | `3000` | `3000` |
| `API_KEYS` | Required | Required |
| `CORS_ORIGIN` | `*` | Your domain |
| `REDIS_URL` | Optional | Recommended |

### UI Variables

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | API base URL |
| `VITE_RPC_URL` | Custom Ethereum RPC |

## Additional Tools

### API Client

Use [Insomnia](https://insomnia.rest/) or [Postman](https://www.postman.com/) with the provided OpenAPI spec:

```
packages/api/swagger.yaml
```

### Database Management

If using Redis:
```bash
# Connect to Redis CLI
docker-compose exec redis redis-cli

# Check keys
KEYS *

# Flush all (development only!)
FLUSHALL
```

### Performance Profiling

```bash
# Profile API
node --prof packages/api/server.js
node --prof-process isolate-0x*.log > profile.txt
```

## Best Practices

1. **Always use environment variables** for configuration
2. **Write tests** for new features
3. **Update documentation** when adding endpoints
4. **Use TypeScript** for type safety in UI
5. **Follow existing code style** (run linter before committing)
6. **Keep commits atomic** and well-described
7. **Test in Docker** before pushing to ensure production compatibility

## Getting Help

- Check [docs/ARCHITECTURE.md](ARCHITECTURE.md) for system design
- Check [docs/API.md](API.md) for API details
- Open an issue on GitHub
- Join our community chat