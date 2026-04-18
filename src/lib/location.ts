import type { Coordinate, HotSpicyAvailabilityStore } from '../types/contracts';

const EARTH_RADIUS_MILES = 3958.8;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function haversineMiles(a: Coordinate, b: Coordinate) {
  const latDelta = toRadians(b.lat - a.lat);
  const lngDelta = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const inner =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(lngDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_MILES * Math.atan2(Math.sqrt(inner), Math.sqrt(1 - inner));
}

export function formatMiles(distance: number | null) {
  if (distance === null || Number.isNaN(distance)) {
    return 'Distance unavailable';
  }

  if (distance < 10) {
    return `${distance.toFixed(1)} mi`;
  }

  return `${Math.round(distance)} mi`;
}

export function buildGoogleMapsUrl(store: HotSpicyAvailabilityStore) {
  const query = encodeURIComponent(`${store.address}, ${store.city}, ${store.state} ${store.postalCode}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export function buildAppleMapsUrl(store: HotSpicyAvailabilityStore) {
  const query = encodeURIComponent(`${store.address}, ${store.city}, ${store.state} ${store.postalCode}`);
  return `https://maps.apple.com/?q=${query}`;
}

