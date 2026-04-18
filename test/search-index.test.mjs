import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchIndex } from '../scripts/lib/search-index.mjs';

test('buildSearchIndex groups by ZIP and city/state', () => {
  const stores = [
    {
      storeId: '1',
      city: 'Chicago',
      state: 'IL',
      postalCode: '60607',
      lat: 41.88,
      lng: -87.63
    },
    {
      storeId: '2',
      city: 'Chicago',
      state: 'IL',
      postalCode: '60607',
      lat: 41.89,
      lng: -87.64
    },
    {
      storeId: '3',
      city: 'New York',
      state: 'NY',
      postalCode: '10001',
      lat: 40.75,
      lng: -73.99
    }
  ];

  const index = buildSearchIndex(stores, '2026-04-18T00:00:00.000Z');
  assert.equal(index.postalCodes.length, 2);
  assert.equal(index.cities.length, 2);
  assert.equal(index.postalCodes[1].postalCode, '60607');
  assert.equal(index.cities[0].slug, 'chicago-il');
});

