# Codebase Structure

**Analysis Date:** 2026-04-15

## Directory Layout

```
iClaw/
├── apps/                  # User-facing applications
├── services/              # Backend services and runtime
├── packages/              # Shared packages and libraries
├── scripts/               # Build, deployment, and utility scripts
├── config/                # Environment and packaging configuration
├── home-web/              # Marketing and public-facing website
├── admin-web/             # Admin dashboard web application
├── daily_stock_analysis/  # Stock analysis sub-project
└── OpenBB/                # OpenBB financial data platform submodule
```

## Directory Purposes

**apps/:**
- Purpose: End-user applications
- Contains: Desktop client, mobile apps (future)
- Key files: `apps/desktop/` - Tauri-based desktop application

**services/:**
- Purpose: Backend services and runtime environments
- Contains: Control plane API, OpenClaw sidecar runtime
- Key files:
  - `services/control-plane/` - Cloud backend API service
  - `services/openclaw/` - Local AI runtime sidecar

**packages/:**
- Purpose: Shared libraries used across the monorepo
- Contains: API SDK, shared type definitions, common utilities
- Key files:
  - `packages/sdk/` - Unified API client SDK
  - `packages/shared/` - Shared types and utilities

**scripts/:**
- Purpose: DevOps, build, deployment, and maintenance scripts
- Contains: Environment management, build pipelines, release automation, database migrations
- Key files: `scripts/env.sh`, `scripts/dev-all.sh`, `scripts/build-desktop-package.mjs`

**config/:**
- Purpose: Environment configuration and packaging profiles
- Contains: Environment-specific settings, OEM branding configurations, packaging templates
- Key files: `config/packaging/` - Environment-specific packaging configurations

## Key File Locations

**Entry Points:**
- `apps/desktop/src/main.tsx`: Desktop application entry point
- `services/control-plane/src/server.ts`: Control plane API server entry point
- `services/openclaw/src/main.ts`: OpenClaw sidecar runtime entry point

**Configuration:**
- `.env.*`: Environment variable files (dev/test/prod)
- `.env.signing.*`: Signing keys and sensitive configuration
- `services/control-plane/src/config.ts`: Control plane configuration loader
- `apps/desktop/src/app/lib/brand.ts`: Branding and OEM configuration

**Core Logic:**
- `services/control-plane/src/sync-tasks/`: A股市场数据同步任务实现
- `services/openclaw/src/skills/`: AI Skill runtime and execution
- `packages/sdk/src/`: API client implementation
- `apps/desktop/src/app/components/`: React UI components

**Testing:**
- `tests/`: End-to-end and integration tests
- `**/*.test.ts`: Unit tests colocated with source files
- `apps/desktop/src-tauri/tests/`: Tauri-specific integration tests

## Naming Conventions

**Files:**
- kebab-case for all TypeScript/JavaScript files: `sync-stock-basics.ts`, `data-source-scheduler.ts`
- PascalCase for React components: `StoreShelf.tsx`, `Memory.tsx`
- Test files use `.test.ts` suffix colocated with source files

**Directories:**
- kebab-case for all directories: `sync-tasks`, `control-plane`, `market-data`
- Singular directory names for logical groups: `skill`, `task`, `service`

## Where to Add New Code

**New Feature:**
- Primary code: Feature-specific directory under relevant service/app
- Tests: Colocated with source files as `*.test.ts`
- Shared types: Add to `packages/shared/src/`
- API clients: Add to `packages/sdk/src/`

**New Component/Module:**
- UI components: `apps/desktop/src/app/components/[component-name]/`
- Backend service: `services/[service-name]/src/[module-name]/`
- Shared utilities: `packages/shared/src/utils/`

**Utilities:**
- Shared helpers: `packages/shared/src/utils/`
- Service-specific utilities: `[service-path]/src/utils/`
- Script utilities: `scripts/lib/`

## Special Directories

**logs/:**
- Purpose: Application and service log files
- Generated: Yes
- Committed: No

**dist/ / build/:**
- Purpose: Build output directories
- Generated: Yes
- Committed: No

**node_modules/:**
- Purpose: NPM dependencies
- Generated: Yes
- Committed: No

**services/control-plane/src/sync-tasks/python-scripts/:**
- Purpose: Python scripts for financial data fetching
- Generated: No
- Committed: Yes
- Special note: Requires Python environment with AKShare, efinance, psycopg2-binary packages

---

*Structure analysis: 2026-04-15*
