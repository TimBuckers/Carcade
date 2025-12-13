import { type CardContent, type ShopLocation } from '../types';
import { getCurrentLocation, calculateDistance, type Location } from './geolocation';
import { ANIMATION } from '../constants';
import { logger } from './logger';

// Types for nearby shops
interface ShopWithDistance {
  card: CardContent;
  location: ShopLocation;
  distance: number;
}

/**
 * Find all shops with their distances from the user's location
 * @param userLocation - User's current location
 * @param cards - Array of cards with shop locations
 * @returns Array of shops with calculated distances, sorted by distance
 */
const findNearbyShopsFromCards = (userLocation: Location, cards: CardContent[]): ShopWithDistance[] => {
  const shopsWithDistances: ShopWithDistance[] = [];
  
  // Go through each card and calculate distances to all its shop locations
  for (const card of cards) {
    if (!card.shop_locations) continue;
    for (const shopLocation of card.shop_locations) {
      logger.debug('Processing shop location:', shopLocation);
      const distance = calculateDistance(
        userLocation.lat,
        userLocation.lng,
        shopLocation.lat,
        shopLocation.lng
      );
      
      shopsWithDistances.push({
        card,
        location: shopLocation,
        distance
      });
    }
  }
  
  // Sort by distance (closest first)
  return shopsWithDistances.sort((a, b) => a.distance - b.distance);
};



/**
 * Selects a random card from the provided cards array and triggers a click event
 * on the corresponding DOM element to open the card modal.
 * 
 * @param cards - Array of cards to select from
 * @returns The randomly selected card, or null if no cards available
 */
export const selectRandomCard = (cards: CardContent[]): CardContent | null => {
  // Return null if no cards available
  if (cards.length === 0) {
    return null;
  }

  // Select random card
  const randomIndex = Math.floor(Math.random() * cards.length);
  const randomCard = cards[randomIndex];
  
  // Trigger card selection in CardList component
  // Find the card element by its data-card-id attribute and simulate a click
  const cardElement = document.querySelector(`[data-card-id="${randomCard.id}"]`) as HTMLElement;
  if (cardElement) {
    cardElement.click();
  }

  return randomCard;
};

/**
 * Selects the card for the closest shop based on user's location and hardcoded shop locations
 * @param cards - Array of cards to search through
 * @returns Promise<CardContent | null> - The card for the closest shop, or null if none found
 */
export const selectClosestShop = async (cards: CardContent[]): Promise<CardContent | null> => {
    // Return null if no cards available
    if (cards.length === 0) {
        return null;
    }

    try {
        // Get user's current location
        const userLocation = await getCurrentLocation();
        
        // Find all shops with their distances from the user's location
        const shopsWithDistances = findNearbyShopsFromCards(userLocation, cards);
        
        if (shopsWithDistances.length === 0) {
            logger.warn('No shop locations found in cards, falling back to random selection');
            return selectRandomCard(cards);
        }
        
        // Get the closest shop
        const closestShop = shopsWithDistances[0];
        
        logger.debug(`Found closest shop: ${closestShop.card.store_name} (${closestShop.distance.toFixed(2)}km away)`);
        
        // Trigger card selection in CardList component
        const cardElement = document.querySelector(`[data-card-id="${closestShop.card.id}"]`) as HTMLElement;
        if (cardElement) {
            cardElement.click();
        }
        
        return closestShop.card;
        
    } catch (error) {
        logger.error('Error finding closest shop:', error);
        
        // Fall back to random selection on any error
        logger.warn('Falling back to random selection due to error');
        return selectRandomCard(cards);
    }
};

/**
 * Magic click functionality that combines the logo animation timing
 * with closest shop selection based on location.
 * 
 * @param cards - Array of cards to select from
 * @param setIsSpinning - Function to set spinning state
 * @param setLogoHidden - Function to set logo visibility
 * @param animationDuration - Duration of the animation in milliseconds (default: 900ms)
 */
export const performMagicClick = async (
  cards: CardContent[],
  setIsSpinning: (spinning: boolean) => void,
  setLogoHidden: (hidden: boolean) => void,
  animationDuration: number = ANIMATION.MAGIC_CLICK_DURATION
): Promise<CardContent | null> => {
  // Don't proceed if no cards or already spinning
  if (cards.length === 0) {
    return null;
  }

  // Start spinning animation
  setIsSpinning(true);
  
  // Select closest shop card immediately (don't wait for animation)
  const selectedCard = await selectClosestShop(cards);
  
  // After animation duration, hide logo
  return new Promise((resolve) => {
    setTimeout(() => {
      setLogoHidden(true);
      setIsSpinning(false);
      
      // Resolve with the already selected card
      resolve(selectedCard);
    }, animationDuration);
  });
};
