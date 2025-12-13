/**
 * Tests for geolocation utility
 */

import { describe, it, expect } from 'vitest';
import {
  calculateDistance,
  areLocationsDuplicate,
  isValidLocation,
  type Location,
} from '../utils/geolocation';

describe('geolocation', () => {
  describe('calculateDistance', () => {
    it('should calculate distance between two points', () => {
      // Distance from New York to Los Angeles (approx 3944 km)
      const nyLat = 40.7128;
      const nyLng = -74.006;
      const laLat = 34.0522;
      const laLng = -118.2437;
      
      const distance = calculateDistance(nyLat, nyLng, laLat, laLng);
      expect(distance).toBeGreaterThan(3900);
      expect(distance).toBeLessThan(4000);
    });

    it('should return 0 for same location', () => {
      const distance = calculateDistance(40.7128, -74.006, 40.7128, -74.006);
      expect(distance).toBe(0);
    });

    it('should calculate small distances accurately', () => {
      // Two points about 1 km apart
      const distance = calculateDistance(52.5200, 13.4050, 52.5300, 13.4050);
      expect(distance).toBeGreaterThan(1);
      expect(distance).toBeLessThan(2);
    });
  });

  describe('areLocationsDuplicate', () => {
    it('should return true for locations within default threshold', () => {
      const loc1: Location = { lat: 52.5200, lng: 13.4050 };
      const loc2: Location = { lat: 52.5205, lng: 13.4055 }; // ~50 meters away
      
      expect(areLocationsDuplicate(loc1, loc2)).toBe(true);
    });

    it('should return false for locations outside threshold', () => {
      const loc1: Location = { lat: 52.5200, lng: 13.4050 };
      const loc2: Location = { lat: 52.6200, lng: 13.4050 }; // ~11 km away
      
      expect(areLocationsDuplicate(loc1, loc2)).toBe(false);
    });

    it('should respect custom threshold', () => {
      const loc1: Location = { lat: 52.5200, lng: 13.4050 };
      const loc2: Location = { lat: 52.5205, lng: 13.4055 };
      
      expect(areLocationsDuplicate(loc1, loc2, 10)).toBe(false); // 10m threshold
      expect(areLocationsDuplicate(loc1, loc2, 1000)).toBe(true); // 1km threshold
    });

    it('should return true for identical locations', () => {
      const loc1: Location = { lat: 52.5200, lng: 13.4050 };
      const loc2: Location = { lat: 52.5200, lng: 13.4050 };
      
      expect(areLocationsDuplicate(loc1, loc2)).toBe(true);
    });
  });

  describe('isValidLocation', () => {
    it('should return false for 0,0 location', () => {
      const location: Location = { lat: 0, lng: 0 };
      expect(isValidLocation(location)).toBe(false);
    });

    it('should return true for valid locations', () => {
      const location1: Location = { lat: 52.5200, lng: 13.4050 };
      expect(isValidLocation(location1)).toBe(true);

      const location2: Location = { lat: -33.8688, lng: 151.2093 };
      expect(isValidLocation(location2)).toBe(true);
    });

    it('should return true for location with only one zero coordinate', () => {
      const location1: Location = { lat: 0, lng: 13.4050 };
      expect(isValidLocation(location1)).toBe(true);

      const location2: Location = { lat: 52.5200, lng: 0 };
      expect(isValidLocation(location2)).toBe(true);
    });
  });
});
