import { isTargetItemName, normalizeItemName } from './normalize.mjs';

const DEFAULT_HEADERS = {
  accept: 'application/json',
  'content-type': 'application/json',
  'user-agent': 'hot-n-spicy-finder/1.0'
};

export function buildAuthHeaders(apiKey) {
  if (!apiKey) {
    throw new Error('MCD_API_KEY is required for live menu availability refreshes.');
  }

  return {
    ...DEFAULT_HEADERS,
    mcd_apikey: apiKey
  };
}

export function extractTargetProductCodes(categoryDetailPayloads) {
  const codes = new Set();

  categoryDetailPayloads.forEach((payload) => {
    const items = payload?.category?.items?.item ?? [];

    items.forEach((item) => {
      const name = item?.item_name ?? item?.name ?? '';
      const externalId = item?.external_id ?? item?.externalId ?? item?.productCode;

      if (externalId && isTargetItemName(name)) {
        codes.add(String(externalId));
      }
    });
  });

  return [...codes];
}

export function hasTargetItemFromStoreInfo(storeInfoPayload, targetProductCodes) {
  const outageCodes = (storeInfoPayload?.Data?.OutageProductCodes ?? []).map((value) => String(value));

  if (targetProductCodes.length === 0) {
    return false;
  }

  return targetProductCodes.some((code) => !outageCodes.includes(String(code)));
}

export async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }

  return response.json();
}

export async function fetchNutritionCategoryIds() {
  const url = new URL('https://api.mcd.com/v3/nutrition/category/list');
  url.searchParams.set('country', process.env.MCD_MARKET_ID ?? 'US');
  url.searchParams.set('language', 'en');
  url.searchParams.set('languageName', process.env.MCD_LANGUAGE_NAME ?? 'en-US');
  url.searchParams.set('showLiveData', '1');
  url.searchParams.set('categoryType', '1');

  const payload = await fetchJson(url);
  const categories = payload?.categories?.category ?? [];
  return categories.map((category) => category.category_id).filter(Boolean);
}

export async function fetchCategoryDetail(categoryId) {
  const url = new URL('https://api.mcd.com/v3/nutrition/category/detail');
  url.searchParams.set('country', process.env.MCD_MARKET_ID ?? 'US');
  url.searchParams.set('language', 'en');
  url.searchParams.set('languageName', process.env.MCD_LANGUAGE_NAME ?? 'en-US');
  url.searchParams.set('showLiveData', '1');
  url.searchParams.set('categoryId', String(categoryId));

  return fetchJson(url);
}

export async function fetchStoreInfo(storeNumber, apiKey) {
  const url = new URL('https://api.mcd.com/v3/restaurant/information');
  url.searchParams.set('application', process.env.MCD_APPLICATION ?? 'MOT');
  url.searchParams.set('languageName', process.env.MCD_LANGUAGE_NAME ?? 'en-US');
  url.searchParams.set('marketId', process.env.MCD_MARKET_ID ?? 'US');
  url.searchParams.set('platform', process.env.MCD_PLATFORM ?? 'iphone');
  url.searchParams.set('storeNumber', String(storeNumber));

  return fetchJson(url, {
    headers: buildAuthHeaders(apiKey)
  });
}

export function buildAvailabilityDataset(stores, targetProductCodes, generatedAt, description) {
  const matchingStores = stores.filter((store) => store.hasItem);

  return {
    version: '1',
    generatedAt,
    item: {
      name: "Hot 'n Spicy McChicken",
      normalizedName: normalizeItemName("Hot 'n Spicy McChicken"),
      targetProductCodes
    },
    coverage: {
      country: 'US',
      description
    },
    storeCount: matchingStores.length,
    stores: matchingStores
  };
}

