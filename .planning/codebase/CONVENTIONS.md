# Coding Conventions

**Analysis Date:** 2026-04-15

## Naming Patterns

**Files:**
- React components use PascalCase: `SecurityCenterView.tsx`, `SelectionCard.tsx`, `PageLayout.tsx`
- Utility, service, and non-component files use kebab-case: `chat-conversation-ordering.ts`, `data-source-scheduler.ts`, `task-logger.ts`
- Test files follow the same naming pattern as implementation files with `.test.` suffix: `chat-conversation-ordering.test.ts`, `send-smoke.test.mjs`

**Functions:**
- Functions use camelCase: `applyConversationMetadataSyncUpdate`, `startSyncTasks`, `downloadAvatar`
- React component functions use PascalCase matching the filename

**Variables:**
- Variables use camelCase: `activeSessionKey`, `nowIso`, `activityChanged`
- Constants use UPPER_SNAKE_CASE: `BASE_RECORD`, `SCREENSHOT_PATH`

**Types:**
- Type and interface names use PascalCase
- Type imports are explicitly marked with `type` keyword: `import type { CreateDesktopActionApprovalGrantInput } from './types.ts'`

## Code Style

**Formatting:**
- No dedicated Prettier/BIome config detected
- Consistent 2-space indentation observed across codebase
- Double quotes for strings
- Trailing commas in object/array literals

**Linting:**
- No ESLint config detected in root
- TypeScript strict mode enabled: `strict: true` in tsconfig.json
- Type checking performed via `tsc --noEmit` command

## Import Organization

**Order:**
1. Node.js built-in modules first: `import assert from 'node:assert/strict'`, `import { fileURLToPath } from 'node:url'`
2. External dependencies next: `import react from 'react'`, `import { pg } from 'pg'`
3. Internal workspace packages: `import { @iclaw/sdk } from '@iclaw/sdk'`
4. Local relative imports last

**Path Aliases:**
- Frontend (desktop): `@/*` maps to `src/*`
- Frontend: `@openclaw-ui/*` maps to shared UI components
- Workspace packages use `workspace:*` protocol in package.json

## Error Handling

**Patterns:**
- Explicit error handling with try/catch blocks in async functions
- Node.js `assert/strict` module used for validation in tests
- Error objects are properly propagated with meaningful messages

## Logging

**Framework:** Node.js console logging
**Patterns:**
- Backend logs saved to `logs/openclaw/` directory
- Latest log available at `logs/openclaw/latest.log`
- Structured logging with JSON output for machine parsing

## Comments

**When to Comment:**
- Complex business logic is documented with inline comments
- Public API functions have JSDoc/TSDoc comments
- Test cases have descriptive names explaining expected behavior

**JSDoc/TSDoc:**
- Used for public API documentation
- Type information primarily conveyed via TypeScript type annotations

## Function Design

**Size:** Functions are kept small and focused on single responsibility
**Parameters:** Prefer object parameter destructuring for functions with multiple parameters
**Return Values:** Explicit return types for public functions, implicit for internal helpers

## Module Design

**Exports:** Named exports preferred over default exports for better tree-shaking and refactoring support
**Barrel Files:** Minimal usage, modules export directly from their implementation files

## Environment Variable Management

**Pattern:**
- Environment files stored in root as `.env.{environment}` (dev/test/prod)
- Sensitive signing information stored in separate `.env.signing.{environment}` files
- Environment switching via `pnpm env:{dev|test|prod|switch}` commands
- Environment variables loaded via `scripts/run-with-env.mjs` wrapper for all commands

## Commit Message Conventions

**Format:**
- Conventional Commits format: `<type>: <description>`
- Common types: `fix:`, `feat:`, `release:`, `chore:`, `docs:`
- Imperative mood: "Fix orphan chat thinking indicators" not "Fixed" or "Fixes"
- Lowercase type prefix, capitalized description

## Versioning

**Format:** `MAJOR.MINOR.PATCH+YYYYMMDDHHMM`
- `+` suffix indicates build number, not used for version comparison
- Example: `1.0.6+202604141320`

---

*Convention analysis: 2026-04-15*
