import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSweepPoints, dedupeStores, parseLocatorFeature } from '../scripts/lib/store-discovery.mjs';

test('buildSweepPoints covers the requested bounding box', () => {
  const points = buildSweepPoints({
    latMin: 0,
    latMax: 2,
    lngMin: 0,
    lngMax: 2,
    step: 1
  });

  assert.equal(points.length, 9);
});

test('parseLocatorFeature maps locator properties to the normalized store shape', () => {
  const feature = {
    geometry: {
      coordinates: [-87.6536, 41.8846]
    },
    properties: {
      storeNumber: '1001',
      name: "McDonald's #1001",
      addressLine1: '110 N Carpenter St',
      city: 'Chicago',
      state: 'IL',
      postalCode: '60607'
    }
  };

  assert.deepEqual(parseLocatorFeature(feature), {
    storeId: '1001',
    name: "McDonald's #1001",
    address: '110 N Carpenter St',
    city: 'Chicago',
    state: 'IL',
    postalCode: '60607',
    lat: 41.8846,
    lng: -87.6536
  });
});

test('dedupeStores keeps the last instance of a store id', () => {
  const stores = dedupeStores([
    { storeId: '1', city: 'Chicago' },
    { storeId: '1', city: 'New York' }
  ]);

  assert.equal(stores.length, 1);
  assert.equal(stores[0].city, 'New York');
});
