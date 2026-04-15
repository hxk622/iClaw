# Technology Stack

**Analysis Date:** 2026-04-15

## Languages

**Primary:**
- TypeScript 5.9.2 - Used across frontend, backend, and shared packages
- Rust - Used for Tauri desktop application and OpenClaw runtime sidecar

**Secondary:**
- Python 3.14.3 - Used for market data synchronization scripts
- JavaScript - Used for build scripts and configuration

## Runtime

**Environment:**
- Node.js 22.22.0 - Primary runtime for backend services and build tools
- Rust stable - Runtime for Tauri and OpenClaw sidecar

**Package Manager:**
- pnpm 10.11.0
- Lockfile: present (`pnpm-lock.yaml`)
- Cargo - Rust package manager

## Frameworks

**Core:**
- Tauri - Desktop application framework
- React - Frontend UI framework
- Node.js - Backend API runtime
- Vite - Frontend build tool

**Testing:**
- Node.js built-in test runner - For backend service tests
- Custom test harness - For E2E testing

**Build/Dev:**
- Vite - Frontend build and dev server
- Tauri CLI - Desktop application building
- Cargo - Rust build system

## Key Dependencies

**Critical:**
- `pg` 8.16.3 - PostgreSQL database client
- `redis` 5.8.2 - Redis cache client
- `node-cron` 4.2.1 - Scheduled task execution
- `@aws-sdk/client-s3` 3.1005.0 - AWS S3 storage client
- `@iclaw/shared` - Internal shared type definitions and utilities

**Infrastructure:**
- PostgreSQL - Primary relational database
- Redis - Caching layer
- AWS S3 - Object storage for artifacts and assets

## Configuration

**Environment:**
- Environment variables via `.env.*` files in root directory
- Environment switching scripts: `pnpm env:dev`, `pnpm env:test`, `pnpm env:prod`
- Key configs required: Database URLs, Redis URLs, S3 credentials, OAuth credentials

**Build:**
- `tsconfig.json` per project/module - TypeScript configuration
- `vite.config.ts` per frontend project - Vite build configuration
- `Cargo.toml` per Rust project - Rust build configuration

## Platform Requirements

**Development:**
- macOS (primary development platform)
- Node.js 22+
- pnpm 10+
- Python 3.14+ (for market data sync)
- Rust toolchain (for Tauri/OpenClaw development)
- PostgreSQL 14+
- Redis 7+

**Production:**
- Linux servers for control-plane deployment
- macOS/Windows for desktop application distribution
- PostgreSQL database
- Redis cache
- S3-compatible object storage

---

*Stack analysis: 2026-04-15*