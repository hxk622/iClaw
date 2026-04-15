# Technology Stack

**Analysis Date:** 2026-04-15

## Languages

**Primary:**
- TypeScript 5.9.2 - All application code (frontend, backend, SDKs, shared libraries)
- Python 3.14.3 - Market data synchronization scripts (AKShare/efinance data fetching)

**Secondary:**
- Rust - OpenClaw runtime sidecar (binary artifact)
- JavaScript - Build/Dev scripts and utility tools

## Runtime

**Environment:**
- Node.js 22.22.0

**Package Manager:**
- pnpm 10.11.0
- Lockfile: present (`pnpm-lock.yaml`)

## Frameworks

**Core:**
- React 18.3.1 - Frontend UI framework
- Tauri 2.8.0 - Desktop application framework
- Vite 6.3.5 - Frontend build tool and dev server
- Node.js - Backend runtime (control-plane)
- Lit 3.3.2 - Web component library

**Testing:**
- Node.js Test Runner - Unit and integration testing
- Custom test harness - E2E testing

**Build/Dev:**
- TypeScript - Type checking and compilation
- tsx 4.21.0 - TypeScript execution and REPL
- Tailwind CSS 4.1.12 - Styling framework

## Key Dependencies

**Critical:**
- `@tauri-apps/api` 2.8.0 - Tauri desktop API integration
- `@aws-sdk/client-s3` 3.1005.0 - S3-compatible object storage client
- `pg` 8.16.3 - PostgreSQL database client
- `node-cron` 4.2.1 - Cron job scheduler for background tasks
- `redis` 5.8.2 - Redis client for caching
- `dotenv` 17.4.2 - Environment variable loading
- `lit` 3.3.2 - Web components for UI
- `lucide-react` 0.544.0 - Icon library
- `marked` 17.0.4 - Markdown rendering
- `dompurify` 3.3.2 - HTML sanitization

**Infrastructure:**
- PostgreSQL - Primary relational database
- Redis - Caching and session storage
- S3-compatible storage - Artifact and file storage

## Configuration

**Environment:**
- Environment variables managed via root `.env.*` files (`.env.dev`, `.env.test`, `.env.prod`)
- Environment switching via `pnpm env:*` commands
- Key configs required: Database URL, Redis URL, S3 credentials, OAuth secrets

**Build:**
- `package.json` - Monorepo root configuration
- `vite.config.ts` - Frontend build configuration (per app)
- `tsconfig.json` - TypeScript configuration (per package/service)

## Platform Requirements

**Development:**
- macOS/Linux (primary development platforms)
- Node.js >= 22.x
- pnpm >= 10.x
- Python >= 3.10 (for market data sync)
- PostgreSQL >= 14
- Redis >= 7

**Production:**
- Desktop: macOS (aarch64/x64), Windows (x64), Linux (x64/aarch64)
- Server: Linux (control-plane and openclaw runtime)
- Deployment targets: Desktop apps, Docker containers, cloud VMs

---

*Stack analysis: 2026-04-15*
