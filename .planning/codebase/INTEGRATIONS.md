# External Integrations

**Analysis Date:** 2026-04-15

## APIs & External Services

**Cloud Storage:**
- S3-compatible Object Storage - Artifact storage, skill packages, file hosting
  - SDK/Client: `@aws-sdk/client-s3`
  - Auth: `S3_ACCESS_KEY`, `S3_SECRET_KEY` env vars

**Market Data Providers:**
- AKShare - A-share market data provider (primary)
- efinance - A-share market data provider (fallback)
- Tushare - A-share market data provider (secondary fallback)
  - SDK/Client: Python packages
  - Auth: API keys configured via environment

## Data Storage

**Databases:**
- PostgreSQL
  - Connection: `DATABASE_URL` env var
  - Client: `pg` (node-postgres)
  - Schemas: `app` (business data), `public` (system data)
  - Tables: stock_basics, stock_quotes, stock_industry_relation, stock_concept_relation, stock_finance, sync_task_logs, etc.

**File Storage:**
- S3-compatible storage (cloud artifacts)
- Local filesystem (desktop app data, logs)

**Caching:**
- Redis
  - Connection: `CONTROL_PLANE_REDIS_URL` env var
  - Client: `redis` npm package
  - Usage: Session caching, rate limiting, temporary data storage

## Authentication & Identity

**Auth Provider:**
- OAuth 2.0 (Custom implementation)
  - Implementation: Frontend OAuth flow with control-plane session management
  - Auth endpoints: `/api/auth/*`

## Monitoring & Observability

**Error Tracking:**
- None detected
- Custom logging implemented

**Logs:**
- Backend logs saved to `logs/openclaw/` directory
- Latest log available at `logs/openclaw/latest.log`
- Structured logging via console and file output

## CI/CD & Deployment

**Hosting:**
- Desktop apps: Native distribution via Tauri build system
- Control-plane: Cloud server deployment (Docker/VPS)
- Static assets: S3-compatible storage + CDN

**CI Pipeline:**
- Custom build scripts
- Package publishing via `pnpm publish:*` commands

## Environment Configuration

**Required env vars:**
- `DATABASE_URL` - PostgreSQL connection string
- `CONTROL_PLANE_REDIS_URL` - Redis connection string
- `S3_ENDPOINT` - S3 storage endpoint
- `S3_REGION` - S3 storage region
- `S3_ACCESS_KEY` - S3 access key
- `S3_SECRET_KEY` - S3 secret key
- `S3_BUCKET` - S3 bucket name
- OAuth and other service-specific keys

**Secrets location:**
- Environment variables in `.env.*` files (not committed to git)
- Signing secrets in separate `.env.signing.*` files

## Webhooks & Callbacks

**Incoming:**
- OAuth callback endpoint: `/api/auth/callback`
- Desktop update check endpoints

**Outgoing:**
- External market data API calls (AKShare, efinance, Tushare)
- S3 storage API calls
- OAuth provider API calls

---

*Integration audit: 2026-04-15*
