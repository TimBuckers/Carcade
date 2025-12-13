# Testing Guide

## Overview

This project uses [Vitest](https://vitest.dev/) for unit testing. Tests are focused on utility functions to ensure core business logic works correctly.

## Running Tests

```bash
# Run tests in watch mode (auto-reruns on file changes)
npm test

# Run tests once (CI mode)
npm run test:run

# Run tests with UI
npm run test:ui
```

## Test Structure

Tests are co-located with their source files using the `.test.ts` naming convention:

- `src/utils/firebasePaths.test.ts` - Tests for Firebase path generation
- `src/utils/errorHandler.test.ts` - Tests for error handling utilities
- `src/utils/geolocation.test.ts` - Tests for geolocation calculations

## Test Coverage

Current test coverage focuses on:

1. **Firebase Paths** - All path generation functions
2. **Error Handling** - Error message extraction and formatting
3. **Geolocation** - Distance calculations, duplicate detection, and validation

## Writing New Tests

1. Create a `.test.ts` file next to the file you're testing
2. Import `describe`, `it`, and `expect` from `vitest`
3. Follow the existing test patterns

Example:
```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from './myModule';

describe('myModule', () => {
  it('should do something', () => {
    expect(myFunction()).toBe('expected result');
  });
});
```

## Configuration

- **vitest.config.ts** - Main Vitest configuration
- **src/test/setup.ts** - Test setup and global mocks
