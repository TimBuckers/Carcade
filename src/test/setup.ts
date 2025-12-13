/**
 * Test setup file
 * Runs before each test file
 */

// Mock environment variables
import.meta.env.VITE_FIRESTORE_COLLECTION = 'cards';
import.meta.env.DEV = false;
