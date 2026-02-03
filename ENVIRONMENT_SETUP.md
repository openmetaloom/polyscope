# Environment Setup Guide for Vercel

This guide walks you through setting up environment variables for Vercel deployment.

## Prerequisites

- Vercel account
- Project linked to Vercel (`vercel link`)
- Vercel CLI installed (`npm i -g vercel`)

## Required Environment Variables

### 1. API_KEYS

Comma-separated list of valid API keys for authentication.

**Generate secure keys:**
```bash
# Option 1: OpenSSL
openssl rand -hex 32

# Option 2: UUID
echo "$(uuidgen | tr '[:upper:]' '[:lower:]')-$(uuidgen | tr '[:upper:]' '[:lower:]')"
```

**Set in Vercel:**
```bash
vercel env add API_KEYS
# Enter your comma-separated keys when prompted
# Example: prod-key-abc123...,prod-key-def456...
```

**Requirements:**
- Minimum 16 characters per key
- Alphanumeric with dashes and underscores only
- No spaces between keys (just commas)

### 2. ADMIN_API_KEY

Special key for administrative operations.

**Set in Vercel:**
```bash
vercel env add ADMIN_API_KEY
# Enter a unique, secure key
```

**Requirements:**
- Must be different from regular API keys
- Minimum 32 characters recommended
- Keep this extra secure!

### 3. CORS_ORIGIN

Allowed origin for CORS. Set to your production domain.

**Set in Vercel:**
```bash
vercel env add CORS_ORIGIN
# Enter: https://yourdomain.com
```

**Important:**
- In production, NEVER use `*`
- Include protocol (https://)
- Don't include trailing slash

## Optional Environment Variables

### BANKR_API_KEY

For Bankr wallet integration features.

**Get your key:**
1. Visit https://bankr.bot
2. Connect your wallet
3. Generate API key

**Set in Vercel:**
```bash
vercel env add BANKR_API_KEY
```

### NODE_ENV

Already set to `production` in `vercel.json`. No need to set manually.

## Setting Variables via Dashboard

Alternative to CLI:

1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to "Settings" → "Environment Variables"
4. Add each variable:
   - Name: `API_KEYS`
   - Value: your-comma-separated-keys
   - Environment: Production

5. Repeat for all variables

## Verification

After setting variables:

```bash
# Pull latest environment
vercel env pull

# Deploy
vercel --prod

# Test deployment
curl -H "X-API-Key: YOUR_KEY" \
  https://yourdomain.com/api/v1/health
```

## Security Best Practices

1. **Never commit .env files**
   ```bash
   echo ".env" >> .gitignore
   ```

2. **Use different keys for different environments**
   - Development keys (local)
   - Staging keys (preview deployments)
   - Production keys (production only)

3. **Rotate keys regularly**
   - Set a calendar reminder
   - Update in Vercel dashboard
   - Notify users if needed

4. **Monitor usage**
   - Check Vercel function logs
   - Watch for unusual traffic patterns
   - Set up alerts if possible

## Troubleshooting

### "No API keys configured" error

Environment variables not loaded. Check:
1. Variable names are correct (case-sensitive)
2. Set for correct environment (Production)
3. Redeploy after setting variables

### CORS errors in browser

Check `CORS_ORIGIN`:
1. Must match your actual domain exactly
2. Include protocol (https://)
3. No trailing slash

### API key rejected

1. Verify key format (16-128 chars, alphanumeric + -_)
2. Check for extra spaces
3. Ensure key is in the comma-separated list

## Quick Reference

```bash
# Add all required variables
vercel env add API_KEYS
vercel env add ADMIN_API_KEY
vercel env add CORS_ORIGIN

# Add optional variables
vercel env add BANKR_API_KEY

# Verify current variables
vercel env ls

# Remove a variable
vercel env rm API_KEYS

# Deploy with new variables
vercel --prod
```