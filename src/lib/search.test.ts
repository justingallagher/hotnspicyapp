import { describe, expect, it } from 'vitest';
import { lookupSearchTarget } from './search';

const index = {
  version: '1' as const,
  generatedAt: '2026-04-18T00:00:00.000Z',
  coverage: {
    country: 'US',
    description: 'test'
  },
  postalCodes: [
    {
      postalCode: '60607',
      city: 'Chicago',
      state: 'IL',
      lat: 41.878,
      lng: -87.63,
      storeCount: 4
    }
  ],
  cities: [
    {
      slug: 'chicago-il',
      city: 'Chicago',
      state: 'IL',
      lat: 41.878,
      lng: -87.63,
      storeCount: 4
    },
    {
      slug: 'springfield-il',
      city: 'Springfield',
      state: 'IL',
      lat: 39.7817,
      lng: -89.6501,
      storeCount: 2
    }
  ]
};

describe('lookupSearchTarget', () => {
  it('matches ZIP codes', () => {
    expect(lookupSearchTarget('60607', index)).toMatchObject({
      kind: 'postalCode',
      label: '60607 - Chicago, IL'
    });
  });

  it('matches city and state queries', () => {
    expect(lookupSearchTarget('Chicago, IL', index)).toMatchObject({
      kind: 'city',
      label: 'Chicago, IL'
    });
  });

  it('returns null for ambiguous or missing queries', () => {
    expect(lookupSearchTarget('Unknown, ZZ', index)).toBeNull();
  });
});
