import { isTargetItemName, normalizeItemName } from './normalize.mjs';

const DEFAULT_HEADERS = {
  accept: 'application/json',
  'content-type': 'application/json',
  'user-agent': 'hot-n-spicy-finder/1.0'
};

export function decodeClientIdFromBasicToken(basicToken) {
  if (!basicToken) {
    throw new Error('BASIC_TOKEN_US is required for live menu availability refreshes.');
  }

  const decoded = Buffer.from(basicToken, 'base64').toString('utf8');
  const [clientId] = decoded.split(':');

  if (!clientId) {
    throw new Error('Unable to derive client ID from BASIC_TOKEN_US.');
  }

  return clientId;
}

export async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }

  return response.json();
}

export async function fetchBearerToken(basicToken) {
  const payload = await fetchJson('https://us-prod.api.mcd.com/v1/security/auth/token', {
    method: 'POST',
    headers: {
      ...DEFAULT_HEADERS,
      authorization: `Basic ${basicToken}`,
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8'
    }
  });

  const token = payload?.response?.token;

  if (!token) {
    throw new Error('Bearer token missing from US auth response.');
  }

  return token;
}

function buildUsApiHeaders({ bearerToken, clientId, marketId = 'US' }) {
  return {
    ...DEFAULT_HEADERS,
    authorization: `Bearer ${bearerToken}`,
    'mcd-clientid': clientId,
    'mcd-marketid': marketId,
    'mcd-sourceapp': 'GMA',
    'mcd-uuid': '"',
    'accept-language': 'en-US'
  };
}

export async function fetchUsStoresNearLocation({ latitude, longitude, bearerToken, clientId }) {
  const url = new URL('https://us-prod.api.mcd.com/exp/v1/restaurant/location');
  url.searchParams.set('distance', process.env.LOCATOR_DISTANCE_METERS ?? '100000');
  url.searchParams.set('filter', 'summary');
  url.searchParams.set('pageSize', process.env.LOCATOR_PAGE_SIZE ?? '250');
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));

  return fetchJson(url, {
    headers: buildUsApiHeaders({ bearerToken, clientId })
  });
}

export function normalizeUsStoreSearchResponse(payload, country = 'US') {
  const restaurants = payload?.response?.restaurants ?? [];

  return restaurants
    .map((restaurant) => {
      const storeNumber = restaurant?.nationalStoreNumber;

      if (!storeNumber) {
        return null;
      }

      return {
        storeId: `${country}-${storeNumber}`,
        nationalStoreNumber: String(storeNumber),
        name: restaurant.name ?? `McDonald's #${storeNumber}`,
        address: restaurant.address?.addressLine1 ?? '',
        city: restaurant.address?.cityTown ?? '',
        state:
          restaurant.address?.subDivision ??
          restaurant.address?.countrySubdivision ??
          restaurant.address?.stateProvince ??
          '',
        postalCode: restaurant.address?.postalZip ?? '',
        lat: Number(restaurant.location?.latitude),
        lng: Number(restaurant.location?.longitude)
      };
    })
    .filter(Boolean);
}

export async function fetchUsRestaurantDetails(storeNumber, bearerToken, clientId, marketId = 'US') {
  const url = new URL(`https://us-prod.api.mcd.com/exp/v1/restaurant/${storeNumber}`);
  url.searchParams.set('filter', 'full');
  url.searchParams.set('storeUniqueIdType', 'NatlStrNumber');

  return fetchJson(url, {
    headers: buildUsApiHeaders({ bearerToken, clientId, marketId })
  });
}

export function getOutageProductCodes(restaurantDetailsPayload) {
  return (restaurantDetailsPayload?.response?.restaurant?.catalog?.outageProductCodes ?? []).map((value) =>
    String(value)
  );
}

export function getAvailableMenuProductCodes(restaurantDetailsPayload) {
  const availableMenuProducts = restaurantDetailsPayload?.response?.restaurant?.availableMenuProducts ?? {};

  return [...new Set(
    Object.values(availableMenuProducts)
      .flatMap((menuTypeProducts) => Array.isArray(menuTypeProducts) ? menuTypeProducts : [])
      .map((value) => String(value))
  )];
}

export function hasTargetItemFromOutages(outageProductCodes, targetProductCodes) {
  if (targetProductCodes.length === 0) {
    return false;
  }

  return targetProductCodes.some((code) => !outageProductCodes.includes(String(code)));
}

export function hasTargetItemFromMenuProducts(availableMenuProductCodes, targetProductCodes) {
  if (targetProductCodes.length === 0) {
    return false;
  }

  return targetProductCodes.some((code) => availableMenuProductCodes.includes(String(code)));
}

export function hasTargetItemFromRestaurantDetails(restaurantDetailsPayload, targetProductCodes) {
  const availableMenuProductCodes = getAvailableMenuProductCodes(restaurantDetailsPayload);

  if (!hasTargetItemFromMenuProducts(availableMenuProductCodes, targetProductCodes)) {
    return false;
  }

  const outageProductCodes = getOutageProductCodes(restaurantDetailsPayload);
  return hasTargetItemFromOutages(outageProductCodes, targetProductCodes);
}

export function parseTargetProductCodes() {
  return (process.env.HOT_SPICY_PRODUCT_CODES ?? process.env.MCD_TARGET_PRODUCT_CODES ?? '12345')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
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
