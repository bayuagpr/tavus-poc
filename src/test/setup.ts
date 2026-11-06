import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Vitest runs without injected globals, so Testing Library's automatic
// cleanup is not registered. Clean the DOM between hook/component tests.
afterEach(() => {
  cleanup();
});
