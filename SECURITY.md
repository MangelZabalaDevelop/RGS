# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| main    | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in RGS, please report it responsibly:

1. **DO NOT** open a public GitHub issue
2. Email the maintainer at the contact listed on the project README
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## Security Measures

This project implements the following security measures:

- Authentication via Flask-Login with bcrypt password hashing
- Input validation and sanitization on all endpoints
- XSS protection via safe DOM manipulation (no innerHTML)
- Path traversal protection in file operations
- Prompt injection protection for AI interactions
- Rate limiting on all endpoints
- Security headers (CSP, X-Frame-Options, X-Content-Type-Options)
- Subresource Integrity (SRI) for all CDN resources
- Cryptographically secure session management
- Centralized error handling (no information leakage)
- Environment-based configuration (no hardcoded secrets)

## Development Security

- Never commit `.env` files, databases, or generated reports
- Use `.env.example` as a template for required environment variables
- Run `bandit -r app.py` before committing changes
- Run `pip-audit` regularly to check for vulnerable dependencies
- Enable Dependabot for automatic dependency updates
