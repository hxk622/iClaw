# Testing Patterns

**Analysis Date:** 2026-04-15

## Test Framework

**Runner:**
- Vitest 1.x (frontend)
  - Config: `daily_stock_analysis/apps/dsa-web/vitest.config.ts`
  - Environment: jsdom for React component testing
- pytest (Python backend)
  - Config: CI runs `pytest -m "not network"` for offline tests

**Assertion Library:**
- Vitest built-in assertions (expect API)
- pytest assertions for Python tests

**Run Commands:**
```bash
# Frontend (daily_stock_analysis/apps/dsa-web/)
npm test                  # Run all tests
npm run test:watch        # Watch mode
npm run test:coverage     # Coverage

# Python Backend
python -m pytest -m "not network"  # Run offline tests
python -m pytest -m network        # Run network-dependent tests
```

## Test File Organization

**Location:**
- Co-located with implementation code in `__tests__` directories
- E2E tests are in separate `e2e/` directory at project root

**Naming:**
- Test files match implementation file names with `.test.` suffix
  - Unit test: `cn.ts` → `__tests__/cn.test.ts`
  - Component test: `Button.tsx` → `__tests__/Button.test.tsx`
  - E2E test: `smoke.spec.ts`

**Structure:**
```
src/
├── utils/
│   ├── cn.ts
│   └── __tests__/
│       └── cn.test.ts
├── components/
│   ├── common/
│   │   ├── Button.tsx
│   │   └── __tests__/
│   │       └── Button.test.tsx
└── contexts/
    ├── AuthContext.tsx
    └── __tests__/
        └── AuthContext.test.tsx
e2e/
├── smoke.spec.ts
└── report-markdown.spec.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect } from 'vitest';
import { cn } from '../cn';

describe('cn utility', () => {
  it('should merge basic tailwind classes', () => {
    expect(cn('p-2 text-sm', 'p-4')).toBe('text-sm p-4');
  });

  it('should handle conditional classes', () => {
    const isTrue = true;
    const isFalse = false;
    expect(cn('base-class', isTrue && 'active-class', isFalse && 'hidden-class')).toBe('base-class active-class');
  });
});
```

**Patterns:**
- `describe()` blocks group related tests by feature/module
- `it()` blocks describe individual test cases with clear, descriptive names
- Arrange-Act-Assert pattern used for all tests
- No global setup/teardown unless explicitly needed

## Mocking

**Framework:** Vitest built-in mocking capabilities

**Patterns:**
```typescript
// Example mocking pattern (inferred from conventions)
vi.mock('../api/stockService', () => ({
  fetchStocks: vi.fn().mockResolvedValue([{ code: '600519', name: '贵州茅台' }])
}));
```

**What to Mock:**
- External API calls and network requests
- Database operations in unit tests
- Third-party dependencies that are not core to the test
- Complex dependencies that are slow or flaky

**What NOT to Mock:**
- Core business logic being tested
- Simple utility functions
- React component props and basic rendering

## Fixtures and Factories

**Test Data:**
```typescript
// Example test data pattern
const mockStocks = [
  { stock_code: '600519', stock_name: '贵州茅台', exchange: 'SH' },
  { stock_code: '000001', stock_name: '平安银行', exchange: 'SZ' }
];
```

**Location:**
- Test data defined inline in test files
- Shared test utilities may be placed in test helpers directory

## Coverage

**Requirements:** Not explicitly enforced, but CI runs tests on PRs

**View Coverage:**
```bash
# Frontend
npm run test:coverage

# Python
python -m pytest --cov=src
```

## Test Types

**Unit Tests:**
- Scope: Individual functions, utilities, and isolated components
- Approach: Test behavior in isolation, mock external dependencies
- Coverage: High for core utilities and business logic

**Integration Tests:**
- Scope: Integration between modules, API endpoints, database operations
- Approach: Test interactions between components, use test databases
- Coverage: Moderate, focused on critical workflows

**E2E Tests:**
- Framework: Playwright
- Scope: Full application workflows, user journeys
- Approach: Test complete user flows from UI to backend
- Coverage: Lower, focused on critical paths and smoke tests

## Common Patterns

**Async Testing:**
```typescript
it('should fetch stock data successfully', async () => {
  const result = await fetchStockData('600519');
  expect(result).toBeDefined();
  expect(result.stock_code).toBe('600519');
});
```

**Error Testing:**
```typescript
it('should throw error when fetching invalid stock code', async () => {
  await expect(fetchStockData('INVALID')).rejects.toThrow('Invalid stock code');
});
```

---

*Testing analysis: 2026-04-15*
