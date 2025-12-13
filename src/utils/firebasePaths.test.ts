/**
 * Tests for firebasePaths utility
 */

import { describe, it, expect } from 'vitest';
import {
  getCardCollectionPath,
  getProfilePath,
  getSharedWithPath,
  getSharingWithMePath,
  getProfileCollectionName,
} from '../utils/firebasePaths';

describe('firebasePaths', () => {
  const testUserId = 'test-user-123';

  describe('getCardCollectionPath', () => {
    it('should return correct card collection path', () => {
      const path = getCardCollectionPath(testUserId);
      expect(path).toBe('users/test-user-123/cards');
    });
  });

  describe('getProfilePath', () => {
    it('should return correct profile document path', () => {
      const path = getProfilePath(testUserId);
      expect(path).toBe('users/test-user-123/profile/info');
    });
  });

  describe('getSharedWithPath', () => {
    it('should return correct shared_with collection path', () => {
      const path = getSharedWithPath(testUserId);
      expect(path).toBe('users/test-user-123/shared_with');
    });
  });

  describe('getSharingWithMePath', () => {
    it('should return correct sharing_with_me collection path', () => {
      const path = getSharingWithMePath(testUserId);
      expect(path).toBe('users/test-user-123/sharing_with_me');
    });
  });

  describe('getProfileCollectionName', () => {
    it('should return profile collection name', () => {
      const name = getProfileCollectionName();
      expect(name).toBe('profile');
    });
  });
});
