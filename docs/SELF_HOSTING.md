# Self-Hosting Guide

This guide covers deploying PolyScope on your own infrastructure.

## Deployment Options

1. **Docker Compose** (Recommended for single server)
2. **Vercel** (Serverless, easiest maintenance)
3. **Manual Deployment** (Maximum control)

## Option 1: Docker Compose Deployment

### Requirements

- Linux server (Ubuntu 20.04+ recommended)
- Docker Engine 20.10+
- Docker Compose 2.0+
- 2GB RAM minimum, 4GB recommended
- Domain name (for SSL)

### Step 1: Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose
sudo apt install docker-compose-plugin
```

### Step 2: Clone and Configure

```bash
# Clone repository
git clone https://github.com/yourusername/polyscope.git
cd polyscope

# Create environment file
cp .env.example .env

# Generate secure API keys
# Use openssl or uuidgen
openssl rand -hex 32

# Edit .env
nano .env
```

Required production settings:
```bash
NODE_ENV=production
PORT=3000
API_KEYS=your-secure-api-key-32-chars-long
ADMIN_API_KEY=your-admin-key-32-chars-long
CORS_ORIGIN=https://yourdomain.com
BANKR_API_KEY=your-bankr-api-key
```

### Step 3: Start Services

```bash
# Start with Redis for production
docker-compose --profile with-redis up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### Step 4: Configure Nginx (SSL)

Install and configure Nginx as a reverse proxy:

```bash
sudo apt install nginx certbot python3-certbot-nginx
```

Create Nginx config:

```bash
sudo nano /etc/nginx/sites-available/polyscope
```

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # API
    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Rate limiting
        limit_req zone=api_limit burst=20 nodelay;
    }

    # Static UI files
    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site and obtain SSL:

```bash
sudo ln -s /etc/nginx/sites-available/polyscope /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Obtain SSL certificate
sudo certbot --nginx -d yourdomain.com
```

### Step 5: Verify Deployment

```bash
# Test health endpoint
curl https://yourdomain.com/api/v1/health

# Test with API key
curl -H "X-API-Key: your-api-key" \
  https://yourdomain.com/api/v1/markets
```

## Option 2: Vercel Deployment

### Prerequisites

- Vercel account
- Vercel CLI installed
- API keys ready

### Step 1: Install Vercel CLI

```bash
npm i -g vercel
```

### Step 2: Configure Project

```bash
# Login to Vercel
vercel login

# Link project (in repo root)
vercel link
```

### Step 3: Set Environment Variables

```bash
# Set secrets in Vercel
vercel env add API_KEYS
vercel env add ADMIN_API_KEY
vercel env add BANKR_API_KEY
vercel env add CORS_ORIGIN
```

Or use the Vercel dashboard:
1. Go to Project Settings → Environment Variables
2. Add each variable

### Step 4: Deploy

```bash
# Deploy to production
vercel --prod

# Or use the deploy script
./scripts/deploy-vercel.sh
```

### Vercel Configuration

The `vercel.json` file handles routing:

```json
{
  "routes": [
    { "src": "/api/(.*)", "dest": "/packages/api/server.js" },
    { "src": "/(.*)", "dest": "/packages/ui/dist/$1" }
  ]
}
```

## Option 3: Manual Deployment

### API Server

```bash
# On your server
git clone https://github.com/yourusername/polyscope.git
cd polyscope

# Install dependencies
npm ci --production

# Build core package
npm run build -w packages/core

# Build UI
npm run build -w packages/ui

# Set environment variables
export NODE_ENV=production
export PORT=3000
export API_KEYS=your-api-keys

# Start API
npm start
```

### Process Management (PM2)

```bash
# Install PM2
npm i -g pm2

# Create ecosystem file
nano ecosystem.config.js
```

```javascript
module.exports = {
  apps: [{
    name: 'polyscope-api',
    script: './packages/api/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
```

```bash
# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Static UI Hosting

Build the UI and serve with Nginx:

```bash
# Build UI
npm run build -w packages/ui

# Copy to web root
sudo cp -r packages/ui/dist/* /var/www/polyscope/

# Configure Nginx to serve static files
```

## Monitoring and Maintenance

### Health Monitoring

Set up UptimeRobot or similar to monitor:
- `https://yourdomain.com/api/v1/health`
- Response time < 2s
- HTTP 200 status

### Log Management

```bash
# View Docker logs
docker-compose logs -f --tail=100 api

# Rotate logs
sudo logrotate -f /etc/logrotate.d/docker-container
```

### Updates

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose --profile with-redis up -d --build

# Or for manual deployment
npm ci
npm run build
pm2 restart polyscope-api
```

### Backup

Important files to backup:
- `.env` file
- `data/` directory (if used)
- Redis data (if using Redis)

```bash
# Backup script
#!/bin/bash
BACKUP_DIR="/backups/polyscope/$(date +%Y%m%d)"
mkdir -p $BACKUP_DIR

cp /path/to/polyscope/.env $BACKUP_DIR/
cp -r /path/to/polyscope/data $BACKUP_DIR/
docker exec polyscope-redis redis-cli BGSAVE
```

## Security Checklist

- [ ] Changed default API keys
- [ ] Set strong, unique admin key
- [ ] Configured CORS for specific domain
- [ ] Enabled HTTPS with valid SSL certificate
- [ ] Set up rate limiting
- [ ] Disabled server tokens (Nginx)
- [ ] Configured firewall (allow only 80, 443)
- [ ] Set up log monitoring
- [ ] Enabled automatic security updates
- [ ] Regular dependency audits: `npm audit`

## Troubleshooting

### High Memory Usage

```bash
# Check memory usage
docker stats

# Restart services
docker-compose restart api
```

### API Not Responding

```bash
# Check container status
docker-compose ps

# Check logs
docker-compose logs api

# Restart
docker-compose restart api
```

### SSL Certificate Issues

```bash
# Renew certificate
sudo certbot renew

# Force renewal
sudo certbot renew --force-renewal
```

## Scaling

### Horizontal Scaling

For high traffic, deploy multiple API instances:

```yaml
# docker-compose.yml
services:
  api:
    deploy:
      replicas: 3
    # ...
  
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    # Load balance to api:3000
```

### Database Scaling (Future)

When adding PostgreSQL:
- Use connection pooling (PgBouncer)
- Set up read replicas
- Regular backups with WAL archiving

## Support

For deployment issues:
- Check logs: `docker-compose logs -f`
- Review [docs/ARCHITECTURE.md](ARCHITECTURE.md)
- Open an issue on GitHub

## Advanced Configuration

### Custom Domain with Cloudflare

1. Point DNS to your server
2. Enable Cloudflare proxy (orange cloud)
3. Set SSL mode to "Full (Strict)"
4. Add Page Rules for caching

### CDN Integration

For static assets:
1. Use Cloudflare or AWS CloudFront
2. Configure cache rules for `dist/` assets
3. Set long cache headers for versioned files

### Monitoring Stack

Optional: Add Prometheus + Grafana:

```yaml
services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
  
  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
```