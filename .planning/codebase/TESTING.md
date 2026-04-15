# Testing Patterns

**Analysis Date:** 2026-04-15

## Test Framework

**Runner:**
- Native Node.js test runner (no external Jest/Vitest dependency)
- Version matches Node.js runtime version
- Config: Built-in, no dedicated config file
- Uses `node --test` command with `--experimental-strip-types` for TypeScript support

**Assertion Library:**
- Native Node.js `assert/strict` module
- No external assertion libraries (Chai, etc.)

**Run Commands:**
```bash
pnpm test               # Run desktop unit tests
pnpm --filter @iclaw/control-plane test  # Run control-plane unit tests
pnpm test:e2e:{category} # Run specific E2E test category
pnpm check              # Run type checking + tests
```

## Test File Organization

**Location:**
- Unit tests: Co-located with implementation files in the same directory
  - Example: `src/app/lib/chat-conversation-ordering.ts` → `src/app/lib/chat-conversation-ordering.test.ts`
- E2E tests: Centralized in root `tests/` directory, organized by feature category
  - Example: `tests/chat/send-smoke.test.mjs`, `tests/payment/recharge-package-flow.test.mjs`

**Naming:**
- Unit tests: `{module}.test.{ts|tsx}`
- E2E tests: `{test-name}.test.mjs`
- Test file names match their corresponding implementation files when applicable

**Structure:**
```
/Users/shanpeifeng/work/hexun/iClaw/
├── apps/desktop/src/               # Unit tests co-located with source
│   └── app/lib/
│       ├── chat-conversation-ordering.ts
│       └── chat-conversation-ordering.test.ts
├── services/control-plane/src/     # Unit tests co-located with source
│   ├── config.ts
│   └── config.test.ts
└── tests/                          # Centralized E2E tests
    ├── chat/
    ├── payment/
    ├── auth/
    ├── install/
    └── shared/                     # Shared test utilities
```

## Test Structure

**Suite Organization:**
```typescript
import test from 'node:test';
import assert from 'node:assert/strict';

import { functionUnderTest } from './module.ts';

test('test description explaining expected behavior', () => {
  // Test setup
  const input = { /* test data */ };

  // Execution
  const result = functionUnderTest(input);

  // Assertion
  assert.equal(result.expectedProperty, 'expected value');
});
```

**Patterns:**
- Test functions use descriptive strings explaining what is being tested
- Arrange-Act-Assert (AAA) pattern followed consistently
- Setup data defined at the top of test files as constants
- No describe blocks/tests nesting - flat test structure preferred

## Mocking

**Framework:** Native Node.js mocking capabilities
**Patterns:**
```typescript
import { mock } from 'node:test';

test('test with mocked dependency', () => {
  const mockedFunction = mock.fn(() => 'mocked value');
  // Use mocked function in test
});
```

**What to Mock:**
- External API calls and third-party services
- Database operations in unit tests
- File system operations

**What NOT to Mock:**
- Core business logic
- Utilities and helper functions
- Types and constants

## Fixtures and Factories

**Test Data:**
- Static test data defined as constants within test files
- Shared test helpers in `tests/shared/` directory
- CDP (Chrome DevTools Protocol) helpers for UI testing

**Location:**
- Shared test utilities: `tests/shared/`
  - `cdp-helpers.mjs`: UI interaction utilities
  - `iclaw-app-helpers.mjs`: Application-specific test helpers
- Component-specific test data co-located with test files

## Coverage

**Requirements:** No enforced coverage threshold
**View Coverage:**
```bash
# No built-in coverage command configured
# Node.js test runner coverage can be enabled via --experimental-test-coverage flag
```

## Test Types

**Unit Tests:**
- Scope: Individual functions, utilities, and isolated modules
- Location: Co-located with source code
- Execution: Fast, no external dependencies required
- Example: Testing conversation ordering logic, date utilities, configuration parsing

**Integration Tests:**
- Scope: API endpoints, service interactions, database operations
- Location: Within service directories alongside unit tests
- Execution: Requires running database and service dependencies

**E2E Tests:**
- Framework: Custom CDP (Chrome DevTools Protocol) based test framework
- Scope: Full application flows, UI interactions, end-to-end user journeys
- Location: Centralized `tests/` directory
- Categories:
  - `chat`: Messaging and conversation flows
  - `payment`: Payment processing and subscription flows
  - `auth`: Authentication and authorization flows
  - `install`: Installation and first-run experiences
- Execution: Requires running application instance and browser automation
- Features: Screenshot capture, UI interaction simulation, state verification

## Common Patterns

**Async Testing:**
```typescript
test('async test example', async () => {
  const result = await asyncFunctionUnderTest();
  assert.equal(result, expectedValue);
});
```

**Error Testing:**
```typescript
test('should throw error for invalid input', async () => {
  await assert.rejects(async () => {
    await asyncFunctionUnderTest(invalidInput);
  }, /Expected error message/);
});
```

**Wait For Pattern (E2E):**
```typescript
const result = await waitFor(
  'condition description',
  async () => {
    const state = await readState();
    return state.conditionMet ? state : null;
  },
  10_000, // timeout in ms
  1_000   // interval in ms
);
```

---

*Testing analysis: 2026-04-15*
