import { Geocoder } from './types';

const UNKNOWN = 'unknown';
const ZERO = { latitude: 0, longitude: 0 };

/**
 * Mapbox forward geocoding (v6). Unknown or unresolvable locations map to 0,0 —
 * the dashboard already filters "unknown" out of the map layers.
 */
export function createMapboxGeocoder(accessToken: string): Geocoder {
  async function geocodeOne(location: string): Promise<{ latitude: number; longitude: number }> {
    try {
      const url = new URL('https://api.mapbox.com/search/geocode/v6/forward');
      url.searchParams.set('q', location);
      url.searchParams.set('access_token', accessToken);
      url.searchParams.set('limit', '1');

      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) return ZERO;
      const data = (await res.json()) as {
        features?: Array<{ geometry?: { coordinates?: [number, number] } }>;
      };
      const coords = data.features?.[0]?.geometry?.coordinates;
      if (!coords) return ZERO;
      return { latitude: coords[1], longitude: coords[0] };
    } catch {
      return ZERO;
    }
  }

  return async (locations) => {
    const results = new Map<string, { latitude: number; longitude: number }>();
    const unique = [...new Set(locations)];
    for (const location of unique) {
      if (location.toLowerCase() === UNKNOWN) {
        results.set(location, ZERO);
        continue;
      }
      results.set(location, await geocodeOne(location));
    }
    return results;
  };
}
