# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.0.x   | :white_check_mark: |
| < 2.0   | :x:                |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability in PolyScope, please report it responsibly.

### How to Report

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report via:
- Email: security@polyscope.example.com (replace with actual contact)
- Or open a private security advisory on GitHub

### What to Include

When reporting a vulnerability, please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)
- Your contact information for follow-up

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 1 week
- **Fix Timeline**: Depends on severity
  - Critical: 7 days
  - High: 14 days
  - Medium: 30 days
  - Low: Next release

### Disclosure Policy

- We will acknowledge receipt of your report
- We will investigate and respond with our assessment
- We will work on a fix and coordinate disclosure
- We will credit you in the release notes (unless you prefer anonymity)
- We ask that you give us reasonable time to fix before public disclosure

## Security Best Practices

### For Users

1. **API Keys**
   - Never commit API keys to version control
   - Use strong, unique API keys
   - Rotate keys regularly
   - Use environment variables for secrets

2. **Authentication**
   - Always use HTTPS in production
   - Implement rate limiting
   - Monitor for suspicious activity

3. **Deployment**
   - Keep dependencies updated
   - Use Docker for consistent environments
   - Enable security headers (Helmet.js)

### For Developers

1. **Code Review**
   - Never hardcode credentials
   - Validate all inputs
   - Use parameterized queries
   - Check for XSS vulnerabilities

2. **Dependencies**
   - Run `npm audit` regularly
   - Keep dependencies updated
   - Use `package-lock.json`

3. **Secrets Management**
   - Use `.env` files (not committed)
   - Rotate secrets regularly
   - Use different keys for dev/staging/prod

## Known Security Considerations

### Current Limitations

1. **API Key Storage**: API keys are stored as environment variables. For high-security deployments, consider using a secrets manager like HashiCorp Vault or AWS Secrets Manager.

2. **Rate Limiting**: Default rate limiting uses in-memory storage. For distributed deployments, configure Redis.

3. **CORS**: Default CORS allows all origins (`*`). Configure `CORS_ORIGIN` for production.

### Security Headers

The API uses Helmet.js with the following defaults:
- Content Security Policy (production only)
- X-DNS-Prefetch-Control
- X-Frame-Options
- Strict-Transport-Security
- X-Download-Options
- X-Content-Type-Options
- X-Permitted-Cross-Domain-Policies
- Referrer-Policy

## Security Checklist for Production

- [ ] Change default API keys
- [ ] Configure CORS for specific origins only
- [ ] Enable HTTPS
- [ ] Set up Redis for distributed rate limiting
- [ ] Configure security headers
- [ ] Enable request logging
- [ ] Set up monitoring and alerting
- [ ] Regular dependency audits
- [ ] Secret rotation schedule

## Vulnerability History

### 2026-02-03
- **Issue**: Hardcoded default API keys in auth middleware
- **Severity**: High
- **Fixed in**: 2.0.0
- **Details**: Removed all default API keys; application now fails safely if no keys configured

### 2026-02-03
- **Issue**: Hardcoded wallet addresses in test files
- **Severity**: Medium
- **Fixed in**: 2.0.0
- **Details**: Moved wallet addresses to environment variables

## Contact

For security-related questions or to report issues:
- Security Team: security@polyscope.example.com
- GPG Key: [Available upon request]