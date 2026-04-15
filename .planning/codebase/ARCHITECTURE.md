# Architecture

**Analysis Date:** 2026-04-15

## Pattern Overview

**Overall:** Layered monolithic architecture with clear separation of concerns, following a service-oriented design pattern.

**Key Characteristics:**
- Monorepo structure with separate concerns for desktop, control-plane, openclaw runtime, and shared packages
- Clear service boundaries with REST API as the primary communication pattern
- Built-in scheduled task system for market data synchronization
- Multi-tenant support with OEM white-label capabilities
- Distributed caching layer for performance optimization
- Comprehensive security and audit logging system
- Built-in payment processing and billing system
- Desktop application auto-update mechanism

## Layers

**Presentation Layer:**
- Purpose: User interface and client-facing functionality
- Location: `apps/desktop/` (Tauri + React desktop application), `admin-web/` (admin management interface)
- Contains: React components, UI assets, client-side business logic
- Depends on: `packages/sdk/` for API communication
- Used by: End users and system administrators

**API Gateway Layer:**
- Purpose: Handle HTTP requests, authentication, rate limiting, and request routing
- Location: `services/control-plane/src/server.ts`
- Contains: REST API endpoints, middleware, request/response handling
- Depends on: Service layer, authentication middleware, caching layer
- Used by: Desktop client, admin web, openclaw runtime

**Service Layer:**
- Purpose: Core business logic implementation
- Location: `services/control-plane/src/` (various service files: `service.ts`, `oem-service.ts`, `portal-service.ts`)
- Contains: Business logic, validation, workflow orchestration
- Depends on: Data access layer, external integrations, utility modules
- Used by: API Gateway layer

**Data Access Layer:**
- Purpose: Database abstraction and data persistence
- Location: `services/control-plane/src/` (`pg-store.ts`, `cached-store.ts`, `oem-store.ts`, `portal-store.ts`)
- Contains: Database models, queries, transaction management, caching integration
- Depends on: PostgreSQL database, Redis cache
- Used by: Service layer

**Runtime Layer:**
- Purpose: AI agent execution, MCP plugin management, Skill runtime
- Location: `services/openclaw/`
- Contains: Agent execution engine, plugin system, browser automation capabilities
- Depends on: Control-plane API for configuration and updates
- Used by: Desktop application

**Shared Layer:**
- Purpose: Common code reused across multiple components
- Location: `packages/shared/`, `packages/sdk/`
- Contains: Type definitions, constants, utility functions, API client SDK
- Depends on: External libraries common to all components
- Used by: All other layers

## Data Flow

**Typical User Request Flow:**
1. Desktop client sends HTTP request to control-plane API
2. API layer authenticates the request using JWT token
3. Request is routed to the appropriate service handler
4. Service layer executes business logic, interacting with data access layer as needed
5. Data access layer retrieves or stores data in PostgreSQL, with Redis caching for frequently accessed data
6. Response is sent back to the client through the API layer

**Market Data Synchronization Flow:**
1. Cron scheduler triggers sync tasks at configured intervals (market hours, after market close)
2. Task runner executes Python scripts to fetch data from external financial APIs (AKShare, efinance, Tushare)
3. Data is validated and transformed
4. Database transaction writes data to appropriate tables using temporary tables to avoid partial updates
5. Task execution logs are recorded for audit purposes

**State Management:**
- Client-side state managed within React application
- Server-side state maintained in PostgreSQL database
- Distributed caching using Redis for performance optimization
- Session management using JWT tokens with refresh mechanism

## Key Abstractions

**Service Abstraction:**
- Purpose: Encapsulate core business functionality
- Examples: `ControlPlaneService`, `OemService`, `PortalService`
- Pattern: Dependency injection with clear interface separation

**Store Abstraction:**
- Purpose: Data access layer interface
- Examples: `ControlPlaneStore`, `PgControlPlaneStore`, `CachedControlPlaneStore`
- Pattern: Repository pattern with decorator pattern for caching

**Sync Task Abstraction:**
- Purpose: Encapsulate market data synchronization logic
- Examples: `syncStockBasics`, `syncStockQuotes`, `syncIndustryConcept`
- Pattern: Modular task design with shared utility modules for data source management and logging

**OEM Brand Abstraction:**
- Purpose: Support multi-tenant white-label functionality
- Examples: `Brand`, `Asset`, `Config` in `OemService`
- Pattern: Isolated brand configuration with inheritance capabilities

## Entry Points

**Control Plane Server:**
- Location: `services/control-plane/src/server.ts`
- Triggers: System startup, process initialization
- Responsibilities: Start HTTP server, initialize database connections, start scheduled tasks, run bootstrap operations

**Desktop Application:**
- Location: `apps/desktop/src/main.ts`
- Triggers: User launches application
- Responsibilities: Initialize Tauri runtime, start UI, connect to local openclaw runtime and remote control-plane

**OpenClaw Runtime:**
- Location: `services/openclaw/src/main.rs`
- Triggers: Desktop application startup
- Responsibilities: Start AI agent runtime, MCP plugin system, WebSocket server for UI communication

## Error Handling

**Strategy:** Multi-layered error handling with consistent error types and logging.

**Patterns:**
- Custom `HttpError` class for API-level errors with appropriate status codes
- Global error handling middleware in API layer
- Try/catch blocks at service layer with detailed error logging
- Scheduled tasks have isolated error handling to prevent cascade failures
- Client-side error boundaries for graceful degradation

## Cross-Cutting Concerns

**Logging:** Structured logging using custom logger utility, logs persisted to files with log rotation.
**Validation:** Request validation at API layer, business rule validation at service layer, database constraint validation.
**Authentication:** JWT-based authentication with OAuth2 support for third-party providers (WeChat, Google).
**Authorization:** Role-based access control with separate admin and user permissions.
**Caching:** Redis-based distributed caching for frequently accessed data with cache invalidation strategies.
**Audit:** Comprehensive audit logging for security events, user actions, and system changes.

---

*Architecture analysis: 2026-04-15*