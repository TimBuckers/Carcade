/**
 * Error handling utilities
 * Provides consistent error handling and user feedback
 */

import { logger } from './logger';

/**
 * Extract error message from unknown error type
 * @param error - Error of unknown type
 * @returns User-friendly error message
 */
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred';
};

/**
 * Log and return error message
 * @param error - Error to handle
 * @param context - Context string for logging
 * @returns User-friendly error message
 */
export const handleError = (error: unknown, context: string): string => {
  const message = getErrorMessage(error);
  logger.error(`${context}:`, error);
  return message;
};

/**
 * Error types for different scenarios
 */
export const ERROR_MESSAGES = {
  // Authentication
  AUTH_FAILED: 'Failed to sign in. Please try again.',
  AUTH_REQUIRED: 'You must be logged in to perform this action.',
  LOGOUT_FAILED: 'Failed to sign out. Please try again.',
  
  // Cards
  CARD_FETCH_FAILED: 'Failed to load cards. Please try again.',
  CARD_ADD_FAILED: 'Failed to add card. Please try again.',
  CARD_UPDATE_FAILED: 'Failed to update card. Please try again.',
  CARD_DELETE_FAILED: 'Failed to delete card. Please try again.',
  
  // Sharing
  SHARE_ADD_FAILED: 'Failed to add user to sharing list.',
  SHARE_REMOVE_FAILED: 'Failed to remove user from sharing list.',
  SHARE_FETCH_FAILED: 'Failed to load sharing list.',
  USER_NOT_FOUND: 'User with this email not found. They need to log in at least once.',
  CANNOT_SHARE_SELF: 'You cannot share with yourself.',
  ALREADY_SHARING: 'This user is already in your sharing list.',
  
  // Profile
  PROFILE_FETCH_FAILED: 'Failed to load profile.',
  PROFILE_UPDATE_FAILED: 'Failed to save profile. Please try again.',
  
  // Location
  LOCATION_PERMISSION_DENIED: 'Location permission denied. Please enable location access.',
  LOCATION_NOT_SUPPORTED: 'Geolocation is not supported by this browser.',
  LOCATION_UPDATE_FAILED: 'Failed to update location.',
  
  // Scanner
  SCANNER_INIT_FAILED: 'Failed to initialize barcode scanner.',
  SCANNER_PERMISSION_DENIED: 'Camera permission denied. Please enable camera access.',
  
  // Validation
  INVALID_EMAIL: 'Please enter a valid email address.',
  INVALID_USERNAME: 'Username must be 3-30 characters and contain only letters, numbers, underscores, or hyphens.',
  REQUIRED_FIELD: 'This field is required.',
} as const;

/**
 * Validation helper for email
 * @param email - Email to validate
 * @returns Error message or null if valid
 */
export const validateEmail = (email: string): string | null => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) ? null : ERROR_MESSAGES.INVALID_EMAIL;
};

/**
 * Validation helper for username
 * @param username - Username to validate
 * @returns Error message or null if valid
 */
export const validateUsername = (username: string): string | null => {
  if (!username.trim()) return null; // Username is optional
  const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/;
  return usernameRegex.test(username.trim()) ? null : ERROR_MESSAGES.INVALID_USERNAME;
};
