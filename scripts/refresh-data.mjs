import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildAvailabilityDataset,
  extractTargetProductCodes,
  fetchCategoryDetail,
  fetchNutritionCategoryIds,
  fetchStoreInfo,
  hasTargetItemFromStoreInfo
} from './lib/mcdonalds-client.mjs';
import { buildSearchIndex } from './lib/search-index.mjs';
import { buildSweepPoints, dedupeStores, parseLocatorFeature } from './lib/store-discovery.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const publicDataDir = path.join(repoRoot, 'public', 'data');
const fallbackPath = path.join(repoRoot, 'scripts', 'data', 'us-store-fallback.v1.json');
const locatorBase = process.env.MCD_LOCATOR_BASE ?? 'https://www.mcdonalds.com/googleappsv2/geolocation';

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.json();
}

async function discoverStoresFromPublicLocator() {
  const sweepPoints = buildSweepPoints({
    step: Number(process.env.LOCATOR_SWEEP_STEP ?? '2')
  });
  const radius = process.env.LOCATOR_RADIUS_KM ?? '160';
  const maxResults = process.env.LOCATOR_MAX_RESULTS ?? '250';
  const discoveredStores = [];

  for (const point of sweepPoints) {
    const url = new URL(locatorBase);
    url.searchParams.set('latitude', String(point.lat));
    url.searchParams.set('longitude', String(point.lng));
    url.searchParams.set('radius', radius);
    url.searchParams.set('maxResults', maxResults);
    url.searchParams.set('country', 'us');
    url.searchParams.set('language', 'en-us');

    try {
      const payload = await fetchJson(url);
      const features = payload?.features ?? [];
      features
        .map(parseLocatorFeature)
        .filter(Boolean)
        .forEach((store) => discoveredStores.push(store));
    } catch (error) {
      console.warn(`Locator sweep failed for ${point.lat}, ${point.lng}:`, error.message);
    }
  }

  return dedupeStores(discoveredStores);
}

async function readFallbackStores() {
  const raw = await readFile(fallbackPath, 'utf8');
  return JSON.parse(raw);
}

async function resolveTargetProductCodes() {
  const categoryIds = await fetchNutritionCategoryIds();
  const detailPayloads = [];

  for (const categoryId of categoryIds) {
    try {
      detailPayloads.push(await fetchCategoryDetail(categoryId));
    } catch (error) {
      console.warn(`Failed to fetch category detail for ${categoryId}:`, error.message);
    }
  }

  return extractTargetProductCodes(detailPayloads);
}

async function enrichStoreAvailability(stores, targetProductCodes) {
  const apiKey = process.env.MCD_API_KEY;
  const lastCheckedAt = new Date().toISOString();

  if (!apiKey) {
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
      const storeInfo = await fetchStoreInfo(store.storeId, apiKey);
      results.push({
        ...store,
        hasItem: hasTargetItemFromStoreInfo(storeInfo, targetProductCodes),
        lastCheckedAt,
        sourceMethod: 'store-info+nutrition'
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
  const hasLiveApiKey = Boolean(process.env.MCD_API_KEY);

  let discoveredStores = [];
  if (!hasLiveApiKey) {
    console.warn('MCD_API_KEY is not configured; using the committed sample fallback stores.');
    discoveredStores = await readFallbackStores();
  } else {
    try {
      discoveredStores = await discoverStoresFromPublicLocator();
    } catch (error) {
      console.warn('Public locator discovery failed:', error.message);
    }

    if (discoveredStores.length === 0) {
      console.warn('Using fallback store seed because the public locator sweep returned no stores.');
      discoveredStores = await readFallbackStores();
    }
  }

  let targetProductCodes = [];
  if (hasLiveApiKey) {
    try {
      targetProductCodes = await resolveTargetProductCodes();
    } catch (error) {
      console.warn('Could not resolve target item codes from nutrition endpoints:', error.message);
    }
  }

  if (targetProductCodes.length === 0) {
    targetProductCodes = (process.env.MCD_TARGET_PRODUCT_CODES ?? '12345')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  }

  const storesWithAvailability = await enrichStoreAvailability(discoveredStores, targetProductCodes);
  const availabilityDataset = buildAvailabilityDataset(
    storesWithAvailability,
    targetProductCodes,
    generatedAt,
    hasLiveApiKey
      ? 'Generated from a public locator sweep plus reverse-engineered store outage data.'
      : 'Generated from the committed sample fallback because MCD_API_KEY was not configured.'
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
