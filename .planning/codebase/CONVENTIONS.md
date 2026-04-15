# Coding Conventions

**Analysis Date:** 2026-04-15

## Naming Patterns

**Files:**
- kebab-case for TypeScript/JavaScript files: `sync-stock-basics.ts`, `python-runner.ts`
- PascalCase for React components: `Button.test.tsx`, `StockAutocomplete.test.tsx`
- Test files use `.test.ts`/`.test.tsx` suffix, placed in `__tests__` directories adjacent to implementation code
- Python files use snake_case: `fetch-stock-basics.py`, `ci_gate.sh`

**Functions:**
- camelCase for function names: `syncStockBasics()`, `runPythonScript()`
- PascalCase for React component functions
- Verb-noun pattern for action functions: `logTaskStart()`, `createPgPool()`

**Variables:**
- camelCase for variable names: `poolInstance`, `syncCount`, `dataSource`
- UPPER_SNAKE_CASE for constants and environment variables
- Descriptive names, no abbreviations unless widely understood

**Types:**
- PascalCase for interface and type names: `StockBasic`, `SyncTaskLog`
- Interface names are nouns describing the data structure
- Type parameters use single uppercase letters like `T` for generics

## Code Style

**Formatting:**
- Not explicitly configured in root, individual projects may have their own formatting rules
- Consistent indentation of 2 spaces observed in TypeScript files
- Line endings: LF (Unix style)

**Linting:**
- ESLint used for frontend projects with TypeScript and React support
  - Config example: `daily_stock_analysis/apps/dsa-web/eslint.config.js`
  - Extends: `@eslint/js/recommended`, `typescript-eslint/recommended`, `react-hooks/recommended`
- Python backend uses flake8 for linting (per CI configuration)

## Import Organization

**Order:**
1. Node.js built-in modules (path, url, etc.)
2. Third-party dependencies
3. Internal modules (relative imports)
4. Type imports

**Path Aliases:**
- Not detected in core TypeScript configuration
- Individual projects may configure aliases in their tsconfig.json

## Error Handling

**Patterns:**
- Try/catch blocks for async operations with explicit error handling
- Error messages are descriptive and include context
- Transaction rollback on database operation failures
- Tasks log errors and update task status before rethrowing
- Graceful handling of null/undefined values with default fallbacks

## Logging

**Framework:** Custom logger + console

**Patterns:**
- Use `logInfo()` and `logError()` functions from shared logger module
- Logs include context about operations (e.g., number of records fetched, task IDs)
- Errors are logged with full stack traces
- Task execution logs are persisted to database in `app.sync_task_logs`

## Comments

**When to Comment:**
- Public functions and interfaces are documented with JSDoc/TSDoc
- Complex business logic and non-obvious implementation details are commented
- TODO comments are used for future work, but kept minimal
- Comments are in Chinese for business logic, English for technical implementation

**JSDoc/TSDoc:**
- Used for public API documentation
- Includes parameter descriptions and return value information
- Example: `/** 同步股票基础信息 */` above function declaration

## Function Design

**Size:** Functions are generally focused on single responsibility
- Most functions are between 20-100 lines
- Complex logic is broken into helper functions

**Parameters:**
- Prefer explicit parameter lists over options objects for simple functions
- Options objects used for functions with many optional parameters
- Type definitions for all parameters in TypeScript

**Return Values:**
- Explicit return types for TypeScript functions
- Async functions return Promises with typed results
- Avoid returning null/undefined where possible, use fallbacks

## Module Design

**Exports:**
- Named exports preferred for multiple exports
- Default exports used primarily for React components
- Barrel files (index.ts) used to export public APIs from directories

**Barrel Files:**
- Used at module boundaries to simplify imports
- Example: `services/control-plane/src/sync-tasks/index.ts` exports all sync task functions

---

*Convention analysis: 2026-04-15*
