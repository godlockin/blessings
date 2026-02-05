import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

const mockMatchMedia = (matches: boolean) => ({
  matches,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(() => mockMatchMedia(false)),
});

Object.defineProperty(window, 'localStorage', {
  writable: true,
  value: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
});

Object.defineProperty(window, 'crypto', {
  writable: true,
  value: {
    randomUUID: vi.fn(() => 'test-uuid'),
  },
});
