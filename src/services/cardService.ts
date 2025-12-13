/**
 * Card service layer
 * Separates business logic from UI components
 */

import { collection, getDocs, addDoc, doc, updateDoc, type DocumentData, type QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { type CardContent, type BarcodeType } from '../types';
import { getCardCollectionPath, getSharingWithMePath } from '../utils/firebasePaths';
import { logger } from '../utils/logger';

/**
 * Fetch a user's own cards
 * @param userId - The user's Firebase UID
 * @returns Array of cards owned by the user
 */
export const fetchUserCards = async (userId: string): Promise<CardContent[]> => {
  try {
    const collectionPath = getCardCollectionPath(userId);
    const snapshot = await getDocs(collection(db, collectionPath));
    
    return snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
      id: doc.id,
      store_name: doc.data().store_name,
      code: doc.data().code,
      barcode_type: doc.data().barcode_type,
      shop_locations: doc.data().shop_locations || null,
    }));
  } catch (error) {
    logger.error('Error fetching user cards:', error);
    throw error;
  }
};

/**
 * Fetch cards shared with the user
 * @param userId - The user's Firebase UID
 * @returns Array of cards shared with the user
 */
export const fetchSharedCards = async (userId: string): Promise<CardContent[]> => {
  try {
    const sharingWithMeCollection = getSharingWithMePath(userId);
    const sharingSnapshot = await getDocs(collection(db, sharingWithMeCollection));
    
    const sharedCards: CardContent[] = [];
    
    for (const sharingDoc of sharingSnapshot.docs) {
      const sharingData = sharingDoc.data();
      const otherUserId = sharingData.userId;
      
      logger.debug('Fetching shared cards from user:', otherUserId);
      
      const sharedCardsCollection = getCardCollectionPath(otherUserId);
      const sharedCardsSnapshot = await getDocs(collection(db, sharedCardsCollection));
      
      const cards = sharedCardsSnapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
        id: `${otherUserId}_${doc.id}`,
        store_name: doc.data().store_name,
        code: doc.data().code,
        barcode_type: doc.data().barcode_type,
        shop_locations: doc.data().shop_locations || null,
        ownerId: otherUserId,
        ownerEmail: sharingData.email || 'Shared Card',
      }));
      
      sharedCards.push(...cards);
    }
    
    return sharedCards;
  } catch (error) {
    logger.error('Error fetching shared cards:', error);
    throw error;
  }
};

/**
 * Fetch all cards (own + shared)
 * @param userId - The user's Firebase UID
 * @returns Array of all accessible cards
 */
export const fetchAllCards = async (userId: string): Promise<CardContent[]> => {
  try {
    const [ownCards, sharedCards] = await Promise.all([
      fetchUserCards(userId),
      fetchSharedCards(userId).catch(error => {
        logger.warn('Failed to fetch shared cards, continuing with own cards only:', error);
        return [];
      }),
    ]);
    
    const allCards = [...ownCards, ...sharedCards];
    logger.debug('Loaded cards:', allCards);
    
    return allCards;
  } catch (error) {
    logger.error('Error fetching all cards:', error);
    throw error;
  }
};

/**
 * Add a new card
 * @param userId - The user's Firebase UID
 * @param cardData - Card data to add
 * @returns The ID of the newly created card
 */
export const addCard = async (
  userId: string,
  cardData: {
    store_name: string;
    code: string;
    barcode_type: BarcodeType;
    shop_locations?: { lat: number; lng: number }[] | null;
  }
): Promise<string> => {
  try {
    const collectionPath = getCardCollectionPath(userId);
    const docRef = await addDoc(collection(db, collectionPath), {
      store_name: cardData.store_name,
      code: cardData.code,
      barcode_type: cardData.barcode_type,
      shop_locations: cardData.shop_locations || null,
    });
    
    logger.debug('Card added successfully:', docRef.id);
    return docRef.id;
  } catch (error) {
    logger.error('Error adding card:', error);
    throw error;
  }
};

/**
 * Update card locations
 * @param userId - The user's Firebase UID
 * @param cardId - The card's ID
 * @param locations - New locations array
 */
export const updateCardLocations = async (
  userId: string,
  cardId: string,
  locations: { lat: number; lng: number }[]
): Promise<void> => {
  try {
    const collectionPath = getCardCollectionPath(userId);
    const cardRef = doc(db, collectionPath, cardId);
    await updateDoc(cardRef, {
      shop_locations: locations,
    });
    
    logger.debug('Card locations updated:', cardId);
  } catch (error) {
    logger.error('Error updating card locations:', error);
    throw error;
  }
};
