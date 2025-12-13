/**
 * Tests for errorHandler utility
 */

import { describe, it, expect } from 'vitest';
import { getErrorMessage, ERROR_MESSAGES } from '../utils/errorHandler';

describe('errorHandler', () => {
  describe('getErrorMessage', () => {
    it('should extract message from Error object', () => {
      const error = new Error('Test error message');
      expect(getErrorMessage(error)).toBe('Test error message');
    });

    it('should return string error directly', () => {
      const error = 'String error message';
      expect(getErrorMessage(error)).toBe('String error message');
    });

    it('should return default message for unknown error type', () => {
      const error = { code: 123 };
      expect(getErrorMessage(error)).toBe('An unexpected error occurred');
    });

    it('should handle null/undefined errors', () => {
      expect(getErrorMessage(null)).toBe('An unexpected error occurred');
      expect(getErrorMessage(undefined)).toBe('An unexpected error occurred');
    });
  });

  describe('ERROR_MESSAGES', () => {
    it('should have defined error messages', () => {
      expect(ERROR_MESSAGES.AUTH_FAILED).toBeDefined();
      expect(ERROR_MESSAGES.CARD_FETCH_FAILED).toBeDefined();
      expect(typeof ERROR_MESSAGES.AUTH_FAILED).toBe('string');
    });
  });
});
