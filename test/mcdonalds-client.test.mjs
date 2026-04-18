import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAvailabilityDataset,
  extractTargetProductCodes,
  hasTargetItemFromStoreInfo
} from '../scripts/lib/mcdonalds-client.mjs';

test('extractTargetProductCodes finds hot n spicy items across category payloads', () => {
  const payloads = [
    {
      category: {
        items: {
          item: [
            {
              item_name: "Hot 'n Spicy McChicken",
              external_id: '4711'
            },
            {
              item_name: 'Big Mac',
              external_id: '10'
            }
          ]
        }
      }
    }
  ];

  assert.deepEqual(extractTargetProductCodes(payloads), ['4711']);
});

test('hasTargetItemFromStoreInfo returns true when one target code is not in outages', () => {
  const payload = {
    Data: {
      OutageProductCodes: ['10', '12']
    }
  };

  assert.equal(hasTargetItemFromStoreInfo(payload, ['4711']), true);
  assert.equal(hasTargetItemFromStoreInfo(payload, ['10']), false);
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

