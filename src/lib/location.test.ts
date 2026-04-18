import { describe, expect, it } from 'vitest';
import { buildAppleMapsUrl, buildGoogleMapsUrl, formatMiles, haversineMiles } from './location';

describe('location helpers', () => {
  it('computes haversine distance in miles', () => {
    const distance = haversineMiles(
      { lat: 41.8781, lng: -87.6298 },
      { lat: 40.7128, lng: -74.006 }
    );

    expect(distance).toBeGreaterThan(700);
    expect(distance).toBeLessThan(730);
  });

  it('formats miles for nearby and far locations', () => {
    expect(formatMiles(4.26)).toBe('4.3 mi');
    expect(formatMiles(28.9)).toBe('29 mi');
    expect(formatMiles(null)).toBe('Distance unavailable');
  });

  it('builds map links from store addresses', () => {
    const store = {
      storeId: '123',
      name: "McDonald's",
      address: '110 N Carpenter St',
      city: 'Chicago',
      state: 'IL',
      postalCode: '60607',
      lat: 41.8846,
      lng: -87.6536,
      hasItem: true,
      lastCheckedAt: '2026-04-18T00:00:00.000Z',
      sourceMethod: 'sample'
    };

    expect(buildGoogleMapsUrl(store)).toContain('google.com/maps');
    expect(buildAppleMapsUrl(store)).toContain('maps.apple.com');
  });
});
