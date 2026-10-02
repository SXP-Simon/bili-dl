import { describe, it, expect } from 'vitest';
import { getErrorMessage, isAbortError } from '../../src/utils/error';

describe('error utilities', () => {
  describe('getErrorMessage', () => {
    it('should extract message from standard Error', () => {
      const err = new Error('Network failed');
      expect(getErrorMessage(err)).toBe('Network failed');
    });

    it('should return string as-is when error is a string', () => {
      expect(getErrorMessage('Custom error string')).toBe('Custom error string');
    });

    it('should extract message property from plain object', () => {
      expect(getErrorMessage({ message: 'Object error message' })).toBe('Object error message');
    });

    it('should convert primitives to string representation', () => {
      expect(getErrorMessage(404)).toBe('404');
      expect(getErrorMessage(null)).toBe('null');
      expect(getErrorMessage(undefined)).toBe('undefined');
    });
  });

  describe('isAbortError', () => {
    it('should identify DOMException with AbortError name', () => {
      const domErr = new DOMException('Aborted', 'AbortError');
      expect(isAbortError(domErr)).toBe(true);
    });

    it('should identify standard Error with AbortError name', () => {
      const err = new Error('Aborted');
      err.name = 'AbortError';
      expect(isAbortError(err)).toBe(true);
    });

    it('should identify object with name === "AbortError"', () => {
      expect(isAbortError({ name: 'AbortError' })).toBe(true);
    });

    it('should return false for regular errors', () => {
      expect(isAbortError(new Error('Normal error'))).toBe(false);
      expect(isAbortError('not an error')).toBe(false);
      expect(isAbortError(null)).toBe(false);
    });
  });
});
