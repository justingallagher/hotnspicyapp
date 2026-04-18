import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAvailabilityDataset,
  decodeClientIdFromBasicToken,
  getAvailableMenuProductCodes,
  getOutageProductCodes,
  hasTargetItemFromMenuProducts,
  hasTargetItemFromOutages,
  hasTargetItemFromRestaurantDetails,
  normalizeUsStoreSearchResponse
} from '../scripts/lib/mcdonalds-client.mjs';

test('decodeClientIdFromBasicToken extracts the client id from the basic token', () => {
  const token = Buffer.from('my-client-id:super-secret').toString('base64');
  assert.equal(decodeClientIdFromBasicToken(token), 'my-client-id');
});

test('hasTargetItemFromOutages returns true when one target code is not in outages', () => {
  const outageCodes = ['10', '12'];

  assert.equal(hasTargetItemFromOutages(outageCodes, ['4711']), true);
  assert.equal(hasTargetItemFromOutages(outageCodes, ['10']), false);
});

test('getAvailableMenuProductCodes flattens menu products across menu types', () => {
  const payload = {
    response: {
      restaurant: {
        availableMenuProducts: {
          1: [10, 12, 15],
          2: [15, 20]
        }
      }
    }
  };

  assert.deepEqual(getAvailableMenuProductCodes(payload), ['10', '12', '15', '20']);
});

test('hasTargetItemFromMenuProducts requires the target code to be on the menu', () => {
  const availableMenuCodes = ['10', '12', '15'];

  assert.equal(hasTargetItemFromMenuProducts(availableMenuCodes, ['15']), true);
  assert.equal(hasTargetItemFromMenuProducts(availableMenuCodes, ['99']), false);
});

test('normalizeUsStoreSearchResponse maps authenticated store search payloads', () => {
  const payload = {
    response: {
      restaurants: [
        {
          nationalStoreNumber: 12345,
          name: "McDonald's #12345",
          address: {
            addressLine1: '1 Main St',
            cityTown: 'Chicago',
            countrySubdivision: 'IL',
            postalZip: '60607'
          },
          location: {
            latitude: 41.88,
            longitude: -87.63
          }
        }
      ]
    }
  };

  assert.deepEqual(normalizeUsStoreSearchResponse(payload), [
    {
      storeId: 'US-12345',
      nationalStoreNumber: '12345',
      name: "McDonald's #12345",
      address: '1 Main St',
      city: 'Chicago',
      state: 'IL',
      postalCode: '60607',
      lat: 41.88,
      lng: -87.63
    }
  ]);
});

test('getOutageProductCodes reads outage codes from US restaurant detail payloads', () => {
  const payload = {
    response: {
      restaurant: {
        catalog: {
          outageProductCodes: ['101', '202']
        }
      }
    }
  };

  assert.deepEqual(getOutageProductCodes(payload), ['101', '202']);
});

test('hasTargetItemFromRestaurantDetails requires menu presence and no outage', () => {
  const availableAndHealthyPayload = {
    response: {
      restaurant: {
        availableMenuProducts: {
          1: [4711, 123]
        },
        catalog: {
          outageProductCodes: ['123']
        }
      }
    }
  };

  const missingFromMenuPayload = {
    response: {
      restaurant: {
        availableMenuProducts: {
          1: [123]
        },
        catalog: {
          outageProductCodes: []
        }
      }
    }
  };

  const outagedPayload = {
    response: {
      restaurant: {
        availableMenuProducts: {
          1: [4711]
        },
        catalog: {
          outageProductCodes: ['4711']
        }
      }
    }
  };

  assert.equal(hasTargetItemFromRestaurantDetails(availableAndHealthyPayload, ['4711']), true);
  assert.equal(hasTargetItemFromRestaurantDetails(missingFromMenuPayload, ['4711']), false);
  assert.equal(hasTargetItemFromRestaurantDetails(outagedPayload, ['4711']), false);
});

test('buildAvailabilityDataset serializes only matching stores', () => {
  const stores = [
    {
      storeId: '1',
      name: 'Store One',
      address: '1 Main',
      city: 'Chicago',
      state: 'IL',
      postalCode: '60607',
      lat: 41.88,
      lng: -87.63,
      hasItem: true,
      lastCheckedAt: '2026-04-18T00:00:00.000Z',
      sourceMethod: 'test'
    },
    {
      storeId: '2',
      name: 'Store Two',
      address: '2 Main',
      city: 'Chicago',
      state: 'IL',
      postalCode: '60607',
      lat: 41.89,
      lng: -87.64,
      hasItem: false,
      lastCheckedAt: '2026-04-18T00:00:00.000Z',
      sourceMethod: 'test'
    }
  ];

  const dataset = buildAvailabilityDataset(stores, ['4711'], '2026-04-18T00:00:00.000Z', 'test dataset');
  assert.equal(dataset.storeCount, 1);
  assert.equal(dataset.stores[0].storeId, '1');
});
