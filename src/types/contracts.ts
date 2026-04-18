export interface HotSpicyAvailabilityStore {
  storeId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  lat: number;
  lng: number;
  hasItem: boolean;
  lastCheckedAt: string;
  sourceMethod: string;
}

export interface HotSpicyAvailabilityDatasetV1 {
  version: '1';
  generatedAt: string;
  item: {
    name: string;
    normalizedName: string;
    targetProductCodes: string[];
  };
  coverage: {
    country: string;
    description: string;
  };
  storeCount: number;
  stores: HotSpicyAvailabilityStore[];
}

export interface SearchIndexPostalCode {
  postalCode: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  storeCount: number;
}

export interface SearchIndexCity {
  slug: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  storeCount: number;
}

export interface SearchIndexV1 {
  version: '1';
  generatedAt: string;
  coverage: {
    country: string;
    description: string;
  };
  postalCodes: SearchIndexPostalCode[];
  cities: SearchIndexCity[];
}

export interface SearchLookupResult {
  kind: 'postalCode' | 'city';
  label: string;
  lat: number;
  lng: number;
}

export interface Coordinate {
  lat: number;
  lng: number;
}

