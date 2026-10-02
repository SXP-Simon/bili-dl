import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Polyfill missing JSDOM methods
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}
