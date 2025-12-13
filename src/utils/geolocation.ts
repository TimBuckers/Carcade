/**
 * Geolocation utilities
 * Centralized geolocation functionality for consistent behavior
 */

import { GEOLOCATION } from '../constants';

export interface Location {
  lat: number;
  lng: number;
}

/**
 * Get the user's current location using the Geolocation API
 * @returns Promise<Location> - The user's current location
 * @throws Error if geolocation is not supported or permission denied
 */
export const getCurrentLocation = (): Promise<Location> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        reject(new Error(`Geolocation error: ${error.message}`));
      },
      {
        enableHighAccuracy: true,
        timeout: GEOLOCATION.TIMEOUT,
        maximumAge: GEOLOCATION.MAX_AGE,
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
export const calculateDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = GEOLOCATION.EARTH_RADIUS_KM;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Check if two locations are duplicates (within threshold distance)
 * @param loc1 - First location
 * @param loc2 - Second location
 * @param thresholdMeters - Distance threshold in meters (defaults to GEOLOCATION.DUPLICATE_THRESHOLD_METERS)
 * @returns true if locations are within threshold distance
 */
export const areLocationsDuplicate = (
  loc1: Location,
  loc2: Location,
  thresholdMeters: number = GEOLOCATION.DUPLICATE_THRESHOLD_METERS
): boolean => {
  const distanceKm = calculateDistance(loc1.lat, loc1.lng, loc2.lat, loc2.lng);
  const distanceMeters = distanceKm * 1000;
  return distanceMeters < thresholdMeters;
};

/**
 * Check if a location is valid (not 0,0)
 * @param location - Location to check
 * @returns true if location is valid
 */
export const isValidLocation = (location: Location): boolean => {
  return location.lat !== 0 || location.lng !== 0;
};
