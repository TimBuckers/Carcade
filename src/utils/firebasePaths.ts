/**
 * Firebase path utilities
 * Centralizes Firebase collection path generation
 */

/**
 * Get the path to a user's card collection
 * @param userId - The user's Firebase UID
 * @returns The Firestore collection path
 */
export const getCardCollectionPath = (userId: string): string => {
  return `users/${userId}/${import.meta.env.VITE_FIRESTORE_COLLECTION}`;
};

/**
 * Get the path to a user's profile document
 * @param userId - The user's Firebase UID
 * @returns The Firestore document path
 */
export const getProfilePath = (userId: string): string => {
  return `users/${userId}/profile/info`;
};

/**
 * Get the path to a user's shared_with collection
 * @param userId - The user's Firebase UID
 * @returns The Firestore collection path
 */
export const getSharedWithPath = (userId: string): string => {
  return `users/${userId}/shared_with`;
};

/**
 * Get the path to a user's sharing_with_me collection
 * @param userId - The user's Firebase UID
 * @returns The Firestore collection path
 */
export const getSharingWithMePath = (userId: string): string => {
  return `users/${userId}/sharing_with_me`;
};

/**
 * Get the profile collection path for queries
 * @returns The collection group name
 */
export const getProfileCollectionName = (): string => {
  return 'profile';
};
