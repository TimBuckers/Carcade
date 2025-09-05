import { type CardContent, type ShopLocation } from '../types';

// Types for location and nearby shops
interface Location {
  lat: number;
  lng: number;
}

interface ShopWithDistance {
  card: CardContent;
  location: ShopLocation;
  distance: number;
}

/**
 * Get the user's current location using the Geolocation API
 * @returns Promise<Location> - The user's current location
 */
const getCurrentLocation = (): Promise<Location> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      },
      (error) => {
        reject(new Error(`Geolocation error: ${error.message}`));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes
      }
    );
  });
};

/**
 * Calculate the distance between two points using the Haversine formula
 * @param lat1 - Latitude of first point
 * @param lng1 - Longitude of first point
 * @param lat2 - Latitude of second point
 * @param lng2 - Longitude of second point
 * @returns Distance in kilometers
 */
const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

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
      console.log(shopLocation);
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
            console.warn('No shop locations found in cards, falling back to random selection');
            return selectRandomCard(cards);
        }
        
        // Get the closest shop
        const closestShop = shopsWithDistances[0];
        
        console.log(`Found closest shop: ${closestShop.card.store_name} (${closestShop.distance.toFixed(2)}km away)`);
        
        // Trigger card selection in CardList component
        const cardElement = document.querySelector(`[data-card-id="${closestShop.card.id}"]`) as HTMLElement;
        if (cardElement) {
            cardElement.click();
        }
        
        return closestShop.card;
        
    } catch (error) {
        console.error('Error finding closest shop:', error);
        
        // Fall back to random selection on any error
        console.warn('Falling back to random selection due to error');
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
  animationDuration: number = 900
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
