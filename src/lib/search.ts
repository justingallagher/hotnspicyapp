import type { SearchIndexV1, SearchLookupResult } from '../types/contracts';

function normalizeToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9,\s]/g, '')
    .replace(/\s+/g, ' ');
}

function slugifyCityState(city: string, state: string) {
  return `${normalizeToken(city).replace(/\s+/g, '-')}-${normalizeToken(state).replace(/\s+/g, '-')}`;
}

export function lookupSearchTarget(query: string, index: SearchIndexV1): SearchLookupResult | null {
  const normalized = normalizeToken(query);
  const zipMatch = normalized.match(/\b\d{5}\b/);

  if (zipMatch) {
    const postalCode = index.postalCodes.find((entry) => entry.postalCode === zipMatch[0]);

    if (!postalCode) {
      return null;
    }

    return {
      kind: 'postalCode',
      label: `${postalCode.postalCode} - ${postalCode.city}, ${postalCode.state}`,
      lat: postalCode.lat,
      lng: postalCode.lng
    };
  }

  if (normalized.includes(',')) {
    const [cityPart, statePart] = normalized.split(',').map((part) => part.trim());
    const slug = slugifyCityState(cityPart, statePart);
    const city = index.cities.find((entry) => entry.slug === slug);

    if (!city) {
      return null;
    }

    return {
      kind: 'city',
      label: `${city.city}, ${city.state}`,
      lat: city.lat,
      lng: city.lng
    };
  }

  const matches = index.cities.filter((entry) => normalizeToken(entry.city) === normalized);

  if (matches.length !== 1) {
    return null;
  }

  const [city] = matches;
  return {
    kind: 'city',
    label: `${city.city}, ${city.state}`,
    lat: city.lat,
    lng: city.lng
  };
}
