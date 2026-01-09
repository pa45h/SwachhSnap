// services/locationHelper.ts
// Handles geolocation, distance calculation, and priority detection
// Used when a user submits a complaint

/**
 * Get the user's current GPS position
 * Wrapped in a Promise for async/await usage
 */
export const getCurrentPosition = (): Promise<GeolocationPosition> => {
  return new Promise((resolve, reject) => {
    // Safety check for SSR / unsupported browsers
    if (typeof window === "undefined" || !navigator.geolocation) {
      reject("Geolocation is not supported in this environment");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      resolve,
      reject,
      {
        enableHighAccuracy: true,
        timeout: 10000,   // 10 seconds
        maximumAge: 0     // Do not use cached position
      }
    );
  });
};

/**
 * Calculate distance between two latitude/longitude points (in meters)
 * Uses the Haversine formula
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371e3; // Earth radius in meters

  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

/**
 * Sensitive zones (schools, hospitals, etc.)
 * In real production, this should come from Firestore or an API
 */
const SENSITIVE_ZONES = [
  {
    name: "City Hospital",
    lat: 12.9716,
    lng: 77.5946,
  },
  {
    name: "Global School",
    lat: 12.9352,
    lng: 77.6245,
  },
];

/**
 * Check if a complaint location should be marked as HIGH priority
 * Returns true if within 200 meters of a sensitive zone
 */
export const checkPriority = (
  lat: number,
  lng: number
): boolean => {
  return SENSITIVE_ZONES.some((zone) => {
    const distance = calculateDistance(
      lat,
      lng,
      zone.lat,
      zone.lng
    );
    return distance < 200;
  });
};
