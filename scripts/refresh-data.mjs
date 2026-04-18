import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildAvailabilityDataset,
  decodeClientIdFromBasicToken,
  fetchBearerToken,
  fetchUsRestaurantDetails,
  fetchUsStoresNearLocation,
  hasTargetItemFromRestaurantDetails,
  normalizeUsStoreSearchResponse,
  parseTargetProductCodes
} from './lib/mcdonalds-client.mjs';
import { buildSearchIndex } from './lib/search-index.mjs';
import { buildSweepPoints, dedupeStores } from './lib/store-discovery.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const publicDataDir = path.join(repoRoot, 'public', 'data');
const fallbackPath = path.join(repoRoot, 'scripts', 'data', 'us-store-fallback.v1.json');
const DEFAULT_MARKET_ID = 'US';

async function discoverStoresFromAuthenticatedSearch({ bearerToken, clientId }) {
  const sweepPoints = buildSweepPoints({
    step: Number(process.env.LOCATOR_SWEEP_STEP ?? '2')
  });
  const discoveredStores = [];

  for (const point of sweepPoints) {
    try {
      const payload = await fetchUsStoresNearLocation({
        latitude: point.lat,
        longitude: point.lng,
        bearerToken,
        clientId
      });

      normalizeUsStoreSearchResponse(payload, DEFAULT_MARKET_ID).forEach((store) => discoveredStores.push(store));
    } catch (error) {
      console.warn(`Authenticated store sweep failed for ${point.lat}, ${point.lng}:`, error.message);
    }
  }

  return dedupeStores(discoveredStores);
}

async function readFallbackStores() {
  const raw = await readFile(fallbackPath, 'utf8');
  return JSON.parse(raw);
}

async function enrichStoreAvailability(stores, targetProductCodes, bearerToken, clientId) {
  const lastCheckedAt = new Date().toISOString();

  if (!(bearerToken && clientId)) {
    return stores.map((store) => ({
      ...store,
      hasItem: true,
      lastCheckedAt,
      sourceMethod: 'sample-fallback'
    }));
  }

  const results = [];
  for (const store of stores) {
    try {
      const restaurantDetails = await fetchUsRestaurantDetails(
        store.nationalStoreNumber ?? store.storeId,
        bearerToken,
        clientId,
        DEFAULT_MARKET_ID
      );

      results.push({
        ...store,
        hasItem: hasTargetItemFromRestaurantDetails(restaurantDetails, targetProductCodes),
        lastCheckedAt,
        sourceMethod: 'mcbroken-us-menu+outages'
      });
    } catch (error) {
      console.warn(`Failed to refresh store ${store.storeId}:`, error.message);
      results.push({
        ...store,
        hasItem: false,
        lastCheckedAt,
        sourceMethod: 'store-info-error'
      });
    }
  }

  return results;
}

async function writeDataset(fileName, payload) {
  await mkdir(publicDataDir, { recursive: true });
  await writeFile(path.join(publicDataDir, fileName), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function main() {
  const generatedAt = new Date().toISOString();
  const basicTokenUs = process.env.BASIC_TOKEN_US;
  const hasLiveToken = Boolean(basicTokenUs);
  let bearerToken = '';
  let clientId = '';

  let discoveredStores = [];
  if (!hasLiveToken) {
    console.warn('BASIC_TOKEN_US is not configured; using the committed sample fallback stores.');
    discoveredStores = await readFallbackStores();
  } else {
    try {
      clientId = decodeClientIdFromBasicToken(basicTokenUs);
      bearerToken = await fetchBearerToken(basicTokenUs);
      discoveredStores = await discoverStoresFromAuthenticatedSearch({
        bearerToken,
        clientId
      });
    } catch (error) {
      console.warn('Authenticated US store discovery failed:', error.message);
    }

    if (discoveredStores.length === 0) {
      console.warn('Using fallback store seed because the authenticated US store sweep returned no stores.');
      discoveredStores = await readFallbackStores();
    }
  }

  const targetProductCodes = parseTargetProductCodes();

  const storesWithAvailability = await enrichStoreAvailability(
    discoveredStores,
    targetProductCodes,
    bearerToken,
    clientId
  );
  const availabilityDataset = buildAvailabilityDataset(
    storesWithAvailability,
    targetProductCodes,
    generatedAt,
    hasLiveToken
      ? "Generated from McDonald's US authenticated store search and outage data."
      : 'Generated from the committed sample fallback because BASIC_TOKEN_US was not configured.'
  );
  const searchIndex = buildSearchIndex(discoveredStores, generatedAt);

  await Promise.all([
    writeDataset('hot-n-spicy-mcchicken.v1.json', availabilityDataset),
    writeDataset('us-search-index.v1.json', searchIndex)
  ]);

  console.log(`Wrote ${availabilityDataset.storeCount} matching stores and ${searchIndex.postalCodes.length} postal centroids.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
