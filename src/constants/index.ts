/**
 * Application-wide constants
 * Centralizes magic values for better maintainability
 */

/**
 * Animation timing constants (in milliseconds)
 */
export const ANIMATION = {
  /** Duration of the magic click spin animation */
  MAGIC_CLICK_DURATION: 900,
  /** Duration of card flip animations */
  CARD_FLIP_DURATION: 300,
} as const;

/**
 * Geolocation-related constants
 */
export const GEOLOCATION = {
  /** Timeout for geolocation requests (ms) */
  TIMEOUT: 10000,
  /** Maximum age of cached position (ms) - 5 minutes */
  MAX_AGE: 300000,
  /** Threshold for duplicate location detection (meters) */
  DUPLICATE_THRESHOLD_METERS: 100,
  /** Earth's radius in kilometers (for distance calculations) */
  EARTH_RADIUS_KM: 6371,
} as const;

/**
 * UI dimension constants (in pixels)
 */
export const UI = {
  /** Maximum width for the logo image */
  LOGO_MAX_WIDTH: 300,
  /** Size for QR code generation */
  QR_CODE_SIZE: 200,
  /** Height for barcode images */
  BARCODE_HEIGHT: 100,
  /** Width for barcode generation */
  BARCODE_WIDTH: 2,
  /** Video width for barcode scanner */
  VIDEO_WIDTH: 400,
  /** Video height for barcode scanner */
  VIDEO_HEIGHT: 300,
} as const;

/**
 * Validation constants
 */
export const VALIDATION = {
  /** Regular expression for email validation */
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  /** Regular expression for username validation */
  USERNAME_REGEX: /^[a-zA-Z0-9_-]{3,30}$/,
  /** Minimum username length */
  USERNAME_MIN_LENGTH: 3,
  /** Maximum username length */
  USERNAME_MAX_LENGTH: 30,
} as const;

/**
 * Barcode scanner configuration
 */
export const BARCODE_SCANNER = {
  /** Patch size for barcode detection */
  PATCH_SIZE: 'medium' as const,
  /** Number of worker threads for scanning */
  NUM_WORKERS: 2,
  /** Whether to use half sample */
  HALF_SAMPLE: true,
  /** Camera facing mode */
  FACING_MODE: 'environment' as const,
} as const;
