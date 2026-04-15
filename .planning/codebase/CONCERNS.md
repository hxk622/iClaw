# Codebase Concerns

**Analysis Date:** 2026-04-15

## Tech Debt

### Monolithic Service Architecture
- **Issue:** Control-plane service is a single monolith with multiple large files handling unrelated concerns (auth, billing, OEM, sync tasks, etc.)
- **Files:**
  - `services/control-plane/src/pg-store.ts` (6,827 lines)
  - `services/control-plane/src/service.ts` (5,887 lines)
  - `services/control-plane/src/portal-store.ts` (5,399 lines)
  - `services/control-plane/src/server.ts` (2,318 lines)
- **Impact:**
  - High cognitive load for developers
  - Increased risk of regressions when modifying unrelated features
  - Slow build and test times
  - Difficult to scale individual components independently
- **Fix approach:**
  1. Extract domain-specific modules into separate directories (e.g., `auth/`, `billing/`, `oem/`, `market-data/`)
  2. Create separate store/service layers for each domain
  3. Define clear interface boundaries between modules

### Hardcoded Python Path
- **Issue:** Python interpreter path is hardcoded to a local user directory in production code
- **Files:** `services/control-plane/src/sync-tasks/utils/python-runner.ts:8`
- **Impact:**
  - Code will fail in any environment where the user is not `shanpeifeng`
  - Not portable across different deployment environments
  - Dependencies on specific local Python environments
- **Fix approach:**
  1. Make Python path configurable via environment variable
  2. Add fallback logic to find Python in standard locations
  3. Bundle required Python dependencies with the service or use a containerized environment

### Bulk Insert Performance Issues
- **Issue:** Stock data sync performs individual INSERT queries in a loop for thousands of records
- **Files:** `services/control-plane/src/sync-tasks/tasks/sync-stock-basics.ts:92-109`
- **Impact:**
  - Slow sync performance (5000+ individual queries per sync)
  - Increased database load during sync operations
  - Risk of timeouts during peak periods
- **Fix approach:**
  1. Implement bulk insert using `pg` library's `copyFrom` or multi-value INSERT
  2. Batch records in chunks of 100-500 per query
  3. Add performance monitoring for sync operations

### Missing Sync Task Implementation
- **Issue:** `syncFinanceData` task is documented but not implemented
- **Files:** `CLAUDE.md` (Market Data Sync Feature section)
- **Impact:**
  - Feature parity gap for financial data analysis
  - User confusion when expecting quarterly financial data
- **Fix approach:**
  1. Implement the quarterly finance data sync task
  2. Add appropriate data validation and error handling
  3. Update documentation once implemented

## Security Considerations

### Python Script Execution Risk
- **Issue:** Service executes external Python scripts with large buffer and timeout
- **Files:** `services/control-plane/src/sync-tasks/utils/python-runner.ts`
- **Risk:**
  - Potential for code injection if script paths or arguments are user-controlled
  - Large buffer (10MB) could be exploited for memory exhaustion
  - Long timeouts could be abused for denial of service
- **Current mitigation:** Script paths are hardcoded, no user input is passed to arguments
- **Recommendations:**
  1. Add strict validation for all script arguments
  2. Use process isolation for Python execution
  3. Implement resource limits for Python subprocesses

### Environment File Exposure
- **Issue:** Multiple environment files exist in the root directory with potential secrets
- **Files:** `.env`, `.env.dev`, `.env.prod`, `.env.test`
- **Risk:**
  - Accidental commit of secrets to version control
  - Environment misconfiguration across different deployment stages
- **Current mitigation:** Files are likely excluded from git (assumed based on standard practices)
- **Recommendations:**
  1. Use a proper secrets management system for production
  2. Add strict .gitignore rules for all env files
  3. Implement environment validation on service startup

## Performance Bottlenecks

### Large Table Truncation
- **Issue:** Stock sync uses TRUNCATE TABLE before inserting new data
- **Files:** `services/control-plane/src/sync-tasks/tasks/sync-stock-basics.ts:121`
- **Problem:**
  - Table is unavailable during the truncate and insert operation
  - Read queries will fail or return empty results during sync
  - Long sync times cause extended service unavailability
- **Improvement path:**
  1. Implement a blue-green table swapping pattern
  2. Use two tables and swap via view or rename operation
  3. Add read replicas for user-facing queries

### Monolithic Database Schema
- **Issue:** All control-plane data is stored in a single PostgreSQL database
- **Files:** All `pg-store.ts`, `portal-store.ts`, `*-store.ts` files
- **Problem:**
  - Single point of failure for all services
  - Performance contention between different workloads (e.g., sync tasks vs. user auth)
  - Difficult to scale individual components
- **Improvement path:**
  1. Extract market data sync into a separate service with its own database
  2. Implement read replicas for read-heavy workloads
  3. Add caching layer for frequently accessed data

## Fragile Areas

### Market Data Sync Workflow
- **Files:**
  - `services/control-plane/src/sync-tasks/tasks/*.ts`
  - `services/control-plane/src/sync-tasks/utils/*.ts`
  - `services/control-plane/src/sync-tasks/python-scripts/*.py`
- **Why fragile:**
  - Dependencies on external financial data APIs (AKShare, efinance, Tushare) that may change without notice
  - Complex Python/TypeScript interop
  - Strict data validation rules that may fail if data formats change
- **Safe modification:**
  1. Always test sync with dry-run mode first
  2. Add comprehensive integration tests for each data source
  3. Monitor sync task logs closely after changes
- **Test coverage:** No tests exist for sync task functionality

## Test Coverage Gaps

### Market Data Sync Features
- **What's not tested:** All market data sync functionality, including task scheduling, data pulling, validation, and database operations
- **Files:** Entire `services/control-plane/src/sync-tasks/` directory
- **Risk:**
  - Regressions in sync functionality may go unnoticed
  - Data corruption could occur if validation logic breaks
  - Financial data inaccuracies could impact user decisions
- **Priority:** High

### Core Business Logic
- **What's not tested:** OEM configuration, billing, payment processing, and user management functionality
- **Files:**
  - `services/control-plane/src/oem-service.ts`
  - `services/control-plane/src/epay-service.ts`
  - `services/control-plane/src/portal-service.ts`
- **Risk:**
  - Payment processing errors could lead to financial loss
  - OEM misconfiguration could break client applications
  - Authentication bugs could lead to unauthorized access
- **Priority:** High

## Dependencies at Risk

### Python Data Source Dependencies
- **Package:** akshare, efinance, tushare
- **Risk:** Third-party financial data APIs may change their interface, become paid, or shut down entirely
- **Impact:** Market data sync functionality will break completely
- **Migration plan:**
  1. Add more data sources with fallback logic
  2. Implement circuit breakers for data source failures
  3. Consider commercial data providers for production reliability

### Outdated Node.js Features
- **Issue:** Code uses experimental Node.js features (--experimental-strip-types) for running TypeScript directly
- **Files:** `services/control-plane/package.json` scripts
- **Risk:** Experimental features may change or be removed in future Node.js versions
- **Impact:** Build and deployment pipeline may break when upgrading Node.js
- **Migration plan:**
  1. Use proper TypeScript compilation to JavaScript before running
  2. Remove dependency on experimental runtime features
  3. Add Node.js version constraint in package.json

---

*Concerns audit: 2026-04-15*
