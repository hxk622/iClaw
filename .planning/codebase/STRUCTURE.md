# Codebase Structure

**Analysis Date:** 2026-04-15

## Directory Layout

```
/Users/shanpeifeng/work/hexun/iClaw/
├── apps/                  # User-facing applications
├── services/              # Backend services
├── packages/              # Shared libraries and SDKs
├── admin-web/             # Admin management web interface
├── config/                # Configuration files for different environments
├── plugins/               # MCP plugin repository
├── scripts/               # Build, deployment, and utility scripts
├── tests/                 # Test suites and test utilities
├── docs/                  # Project documentation
├── logs/                  # Application log files
├── .venv/                 # Python virtual environment for data sync
├── OpenBB/                # OpenBB financial data platform integration
├── .artifacts/            # Build artifacts and release packages
├── .planning/             # Planning and analysis documents (current)
└── CLAUDE.md              # Project-specific instructions for Claude
```

## Directory Purposes

**apps/:**
- Purpose: User-facing client applications
- Contains: Desktop application built with Tauri and React
- Key files: `apps/desktop/src/main.ts`, `apps/desktop/src/renderer/`

**services/control-plane/:**
- Purpose: Backend API server for user management, billing, OEM configuration, and market data
- Contains: REST API endpoints, business logic, database access, scheduled tasks
- Key files: `src/server.ts`, `src/service.ts`, `src/sync-tasks/`, `src/oem-service.ts`, `src/portal-service.ts`

**services/openclaw/:**
- Purpose: Local AI agent runtime service
- Contains: Agent execution engine, MCP plugin management, Skill runtime, browser automation
- Key files: `src/main.rs`, `src/plugin/`, `src/skill/`

**packages/sdk/:**
- Purpose: TypeScript SDK for client applications to interact with backend services
- Contains: API client implementations, type definitions, request/response utilities
- Key files: `src/index.ts`, `src/client/`

**packages/shared/:**
- Purpose: Shared code and type definitions used across all components
- Contains: Common types, constants, utility functions, validation schemas
- Key files: `src/types/`, `src/utils/`

**config/:**
- Purpose: Environment configuration files for different deployment environments
- Contains: Development, testing, production configuration files, environment variable templates
- Key files: `config/.env.dev`, `config/.env.test`, `config/.env.prod`

**scripts/:**
- Purpose: DevOps and utility scripts
- Contains: Build scripts, deployment scripts, environment switching tools, OEM branding scripts
- Key files: `scripts/apply-brand.mjs`, `scripts/build-desktop.ts`

**tests/:**
- Purpose: Test suites for all components
- Contains: Unit tests, integration tests, end-to-end tests, test utilities
- Key files: `tests/unit/`, `tests/integration/`, `tests/e2e/`

## Key File Locations

**Entry Points:**
- `services/control-plane/src/server.ts`: Control-plane API server entry point
- `apps/desktop/src/main.ts`: Desktop application main process entry point
- `services/openclaw/src/main.rs`: OpenClaw runtime entry point
- `admin-web/src/main.tsx`: Admin web interface entry point

**Configuration:**
- `.env`, `.env.dev`, `.env.test`, `.env.prod`: Environment variable files (root directory)
- `services/control-plane/src/config.ts`: Control-plane configuration loader
- `services/control-plane/ecosystem.config.js`: PM2 deployment configuration

**Core Logic:**
- `services/control-plane/src/service.ts`: Core control-plane business logic
- `services/control-plane/src/oem-service.ts`: OEM brand management logic
- `services/control-plane/src/portal-service.ts`: Portal and application configuration logic
- `services/control-plane/src/sync-tasks/`: Market data synchronization logic

**Database:**
- `services/control-plane/src/pg-store.ts`: PostgreSQL data access implementation
- `services/control-plane/src/sync-tasks/sql/create_tables.sql`: Database schema definition
- `services/control-plane/src/migrations/`: Database migration files

**Testing:**
- `jest.config.js`: Jest test configuration
- `vitest.config.ts`: Vitest test configuration
- `tests/`: Test files organized by component and test type

## Naming Conventions

**Files:**
- Kebab-case for TypeScript/JavaScript files: `sync-stock-basics.ts`, `oem-service.ts`
- PascalCase for React components: `UserProfile.tsx`, `Dashboard.tsx`
- Snake_case for Python scripts: `fetch_stock_basics.py`
- Lowercase with dots for configuration files: `ecosystem.config.js`, `jest.config.js`

**Directories:**
- Kebab-case for all directory names: `sync-tasks/`, `market-data/`
- Plural form for collection directories: `tasks/`, `utils/`, `types/`

## Where to Add New Code

**New Feature:**
- Primary code: Add to appropriate service directory under `services/control-plane/src/`
- Tests: Add corresponding test files in `tests/` directory with matching structure
- API endpoints: Define in `services/control-plane/src/server.ts` with appropriate handlers

**New Component/Module:**
- Implementation: Add to `packages/` directory if shared across multiple components, otherwise add to specific service/app directory
- Exports: Update `index.ts` files to export public interfaces

**Utilities:**
- Shared helpers: Add to `packages/shared/src/utils/`
- Service-specific utilities: Add to appropriate `utils/` directory within the service

**New Sync Task:**
- Task implementation: Add to `services/control-plane/src/sync-tasks/tasks/`
- Python data fetching script: Add to `services/control-plane/src/sync-tasks/python-scripts/`
- Schedule: Register task in `services/control-plane/src/sync-tasks/index.ts`

## Special Directories

**services/control-plane/src/sync-tasks/:**
- Purpose: Market data synchronization system
- Generated: No, manually maintained
- Committed: Yes

**.artifacts/:**
- Purpose: Build outputs and release packages
- Generated: Yes, created during build process
- Committed: No, excluded from version control

**logs/:**
- Purpose: Application log files
- Generated: Yes, created during runtime
- Committed: No, excluded from version control

**node_modules/:**
- Purpose: Node.js dependencies
- Generated: Yes, installed via package manager
- Committed: No, excluded from version control

**.venv/:**
- Purpose: Python virtual environment for data synchronization
- Generated: Yes, created during environment setup
- Committed: No, excluded from version control

---

*Structure analysis: 2026-04-15*