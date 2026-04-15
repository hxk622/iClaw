# External Integrations

**Analysis Date:** 2026-04-15

## APIs & External Services

**Market Data:**
- AKShare - A股 market data provider
  - SDK/Client: Python akshare package
  - Auth: No auth required for public data
- efinance - Market data provider (fallback)
  - SDK/Client: Python efinance package
  - Auth: No auth required for public data
- Tushare - Market data provider (secondary fallback)
  - SDK/Client: Python tushare package
  - Auth: API key required

**Cloud Services:**
- AWS S3 / S3-compatible storage - Object storage for artifacts, assets, and releases
  - SDK/Client: `@aws-sdk/client-s3`
  - Auth: `S3_ACCESS_KEY`, `S3_SECRET_KEY` env vars

**Authentication:**
- Google OAuth - User authentication
  - Auth: Client ID configured in environment
  - Redirect URI: `VITE_GOOGLE_OAUTH_REDIRECT_URI`
- WeChat OAuth - User authentication
  - Auth: Client ID configured in environment
  - Redirect URI: `VITE_WECHAT_OAUTH_REDIRECT_URI`

## Data Storage

**Databases:**
- PostgreSQL
  - Connection: `DATABASE_URL` env var
  - Client: `pg` Node.js library
  - Schemas: `app` schema for business data
- Redis
  - Connection: `CONTROL_PLANE_REDIS_URL` env var
  - Client: `redis` Node.js library
  - Purpose: Caching, session storage, rate limiting

**File Storage:**
- S3-compatible object storage
  - Endpoint: `S3_ENDPOINT` env var
  - Bucket: `S3_BUCKET` env var
  - Region: `S3_REGION` env var
- Local filesystem - For logs and temporary files

**Caching:**
- Redis - Primary distributed cache

## Authentication & Identity

**Auth Provider:**
- Custom implementation with OAuth providers
  - Implementation: Control-plane handles OAuth callbacks and session management
  - Session storage: PostgreSQL + Redis

## Monitoring & Observability

**Error Tracking:**
- None detected

**Logs:**
- File-based logging to `logs/openclaw/` directory
- Latest logs available at `logs/openclaw/latest.log`

## CI/CD & Deployment

**Hosting:**
- Control-plane: Linux servers
- Desktop application: Distributed as native binaries for macOS/Windows
- Frontend: Static hosting

**CI Pipeline:**
- None detected (custom build and publish scripts)

## Environment Configuration

**Required env vars:**
- `DATABASE_URL` - PostgreSQL connection string
- `CONTROL_PLANE_REDIS_URL` - Redis connection string
- `S3_ACCESS_KEY` - S3 storage access key
- `S3_SECRET_KEY` - S3 storage secret key
- `S3_ENDPOINT` - S3 storage endpoint
- `S3_BUCKET` - S3 storage bucket name
- OAuth provider credentials (Google, WeChat)

**Secrets location:**
- Environment-specific `.env.*` files in root directory
- Sensitive signing configuration in `.env.signing.*` files

## Webhooks & Callbacks

**Incoming:**
- OAuth callback endpoints for Google and WeChat authentication
- `/api/oauth/callback/google`
- `/api/oauth/callback/wechat`

**Outgoing:**
- None detected

---

*Integration audit: 2026-04-15*