import { GeoPoint, Geocoder, GeocoderConfigError } from './types';

const UNKNOWN = 'unknown';

/** Place types worth plotting; filters out addresses, POIs and junk strings. */
const PLACE_TYPES = 'country,region,district,place,locality,neighborhood';
/** Mapbox relevance below this is a guess, not a match. */
const MIN_RELEVANCE = 0.6;

/** Resolved coordinates are stable; reuse them across batches. */
const cache = new Map<string, GeoPoint | null>();

type Outcome =
  | { kind: 'ok'; point: GeoPoint }
  | { kind: 'none' } // definitively no such place
  | { kind: 'transient' }; // outage / rate limit — retry later

/**
 * Mapbox forward geocoding (v6). Locations that cannot be resolved are left
 * without coordinates rather than defaulted to 0,0, which the dashboard would
 * otherwise render as a real outbreak point off the coast of Africa.
 */
export function createMapboxGeocoder(accessToken: string): Geocoder {
  async function geocodeOne(location: string): Promise<Outcome> {
    let res: Response;
    try {
      const url = new URL('https://api.mapbox.com/search/geocode/v6/forward');
      url.searchParams.set('q', location);
      url.searchParams.set('access_token', accessToken);
      url.searchParams.set('types', PLACE_TYPES);
      url.searchParams.set('limit', '1');
      res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    } catch {
      return { kind: 'transient' };
    }

    if (res.status === 401 || res.status === 403) {
      throw new GeocoderConfigError(
        `Mapbox rejected the access token (HTTP ${res.status})`
      );
    }
    if (res.status === 429 || res.status >= 500) return { kind: 'transient' };
    if (!res.ok) return { kind: 'none' };

    try {
      const data = (await res.json()) as {
        features?: Array<{
          properties?: { coordinates?: { latitude: number; longitude: number } };
          geometry?: { coordinates?: [number, number] };
          relevance?: number;
        }>;
      };
      const feature = data.features?.[0];
      if (!feature) return { kind: 'none' };
      if (typeof feature.relevance === 'number' && feature.relevance < MIN_RELEVANCE) {
        return { kind: 'none' };
      }
      const coords = feature.geometry?.coordinates;
      const props = feature.properties?.coordinates;
      if (props && Number.isFinite(props.latitude) && Number.isFinite(props.longitude)) {
        return { kind: 'ok', point: { latitude: props.latitude, longitude: props.longitude } };
      }
      if (coords) {
        return { kind: 'ok', point: { latitude: coords[1], longitude: coords[0] } };
      }
      return { kind: 'none' };
    } catch {
      return { kind: 'transient' };
    }
  }

  return async (locations) => {
    const results = new Map<string, GeoPoint | null>();
    for (const location of new Set(locations)) {
      if (!location || location.toLowerCase() === UNKNOWN) {
        results.set(location, null);
        continue;
      }
      const key = location.toLowerCase();
      if (cache.has(key)) {
        results.set(location, cache.get(key)!);
        continue;
      }
      const outcome = await geocodeOne(location);
      // Transient failures stay out of the map entirely: the caller flags the
      // mention for a later retry instead of persisting a wrong coordinate.
      if (outcome.kind === 'transient') continue;
      const value = outcome.kind === 'ok' ? outcome.point : null;
      cache.set(key, value);
      results.set(location, value);
    }
    return results;
  };
}
