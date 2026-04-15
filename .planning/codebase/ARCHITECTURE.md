# Architecture

**Analysis Date:** 2026-04-15

## Pattern Overview

**Overall:** Monolithic with microservice separation, three-tier client-server architecture

**Key Characteristics:**
- Monorepo structure with clear separation between frontend, backend services, and shared packages
- Desktop-first architecture using Tauri for cross-platform native deployment
- Loose coupling between services through well-defined SDK interfaces
- Built-in support for multi-tenant OEM branding and configuration

## Layers

**Presentation Layer:**
- Purpose: User interface and client-side application logic
- Location: `apps/desktop/`
- Contains: React UI components, state management, user interaction handlers, desktop integration
- Depends on: `packages/sdk`, `packages/shared`, Tauri runtime
- Used by: End users directly

**Runtime Layer:**
- Purpose: AI agent execution, MCP plugin management, Skill runtime, browser automation
- Location: `services/openclaw/`
- Contains: Sidecar runtime, plugin execution engine, WebSocket server, browser control service
- Depends on: Control plane API, external AI providers, MCP plugins
- Used by: Presentation layer through SDK

**Control Plane Layer:**
- Purpose: User management, authentication, billing, OEM configuration, version control, API gateway
- Location: `services/control-plane/`
- Contains: REST API server, database models, task scheduler, sync services, admin tools
- Depends on: PostgreSQL, Redis, S3-compatible storage, external payment providers
- Used by: Presentation layer, Runtime layer

**Shared Layer:**
- Purpose: Common type definitions, constants, utility functions used across all layers
- Location: `packages/shared/`
- Contains: TypeScript interfaces, enums, validation schemas, shared utilities
- Depends on: No internal dependencies
- Used by: Presentation layer, Runtime layer, Control Plane layer

**SDK Layer:**
- Purpose: Unified API client for communication between frontend and backend services
- Location: `packages/sdk/`
- Contains: API client implementations, type-safe request/response handlers, connection management
- Depends on: `packages/shared`
- Used by: Presentation layer

## Data Flow

**User Interaction Flow:**

1. User interacts with desktop UI (React + Tauri)
2. UI makes requests through `@iclaw/sdk` client
3. SDK routes requests to appropriate backend:
   - Local operations → OpenClaw sidecar (port 2126)
   - Cloud operations → Control plane (port 2130)
4. Backend services process requests and return responses
5. UI updates state and renders results to user

**Market Data Sync Flow:**

1. Control plane starts scheduled cron job at configured time
2. Job triggers data fetcher that uses multi-source scheduler (AKShare → efinance → Tushare)
3. Python script fetches data from financial data providers
4. Data validation and transformation occurs
5. Transactional write to PostgreSQL database using temporary table pattern
6. Task execution log written to `app.sync_task_logs` table
7. Success/failure status propagated to monitoring systems

**State Management:**
- Client-side: React context + local state management
- Runtime: In-memory state with persistence to local filesystem
- Control plane: PostgreSQL for persistent state, Redis for caching

## Key Abstractions

**Skill Execution Engine:**
- Purpose: Execute AI agent skills and automation workflows
- Examples: `services/openclaw/src/skills/`, `services/control-plane/src/skill-storage.ts`
- Pattern: Plugin-based architecture with sandboxed execution environment

**OEM Configuration System:**
- Purpose: Support multi-tenant branding and feature customization
- Examples: `scripts/apply-brand.mjs`, `services/control-plane/src/brand-profile.ts`
- Pattern: Layered configuration with runtime overrides and cloud sync

**Task Scheduler:**
- Purpose: Execute recurring background tasks and data sync jobs
- Examples: `services/control-plane/src/sync-tasks/index.ts`
- Pattern: Cron-based scheduling with failure recovery and audit logging

## Entry Points

**Desktop Application:**
- Location: `apps/desktop/src/main.tsx`
- Triggers: User launching desktop application
- Responsibilities: UI rendering, user session management, sidecar process orchestration

**Control Plane Server:**
- Location: `services/control-plane/src/server.ts`
- Triggers: Service startup, system boot
- Responsibilities: API request handling, database connection management, scheduled task execution, bootstrap initialization

**OpenClaw Sidecar:**
- Location: `services/openclaw/src/main.ts`
- Triggers: Desktop app startup, manual launch
- Responsibilities: AI agent execution, MCP plugin management, WebSocket communication, browser automation

## Error Handling

**Strategy:** Layered error handling with context propagation and user-friendly messaging

**Patterns:**
- Structured error objects with error codes and localized messages
- Automatic retries for transient failures in SDK layer
- Detailed error logging with context for debugging
- User-facing error messages that hide implementation details

## Cross-Cutting Concerns

**Logging:** Structured logging with JSON output, persisted to log files with rotation
**Validation:** Schema-based validation at API boundaries using TypeScript type checking
**Authentication:** JWT-based authentication with refresh tokens, OAuth support for third-party integrations

---

*Architecture analysis: 2026-04-15*
