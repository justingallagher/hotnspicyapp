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
  normalizeUsRestaurantDetailsStoreFields,
  normalizeUsStoreSearchResponse,
  parseTargetProductCodes
} from './lib/mcdonalds-client.mjs';
import {
  AuthenticationRecoveryError,
  createBearerTokenManager,
  isAuthenticationRecoveryError,
  requestWithBearerToken,
  shouldAbortAfterAuthFailure
} from './lib/auth-session.mjs';
import { buildSearchIndex } from './lib/search-index.mjs';
import { buildSweepPoints, dedupeStores } from './lib/store-discovery.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const publicDataDir = path.join(repoRoot, 'public', 'data');
const fallbackPath = path.join(repoRoot, 'scripts', 'data', 'us-store-fallback.v1.json');
const DEFAULT_MARKET_ID = 'US';
const TOKEN_MAX_AGE_MS = Number(process.env.MCD_TOKEN_MAX_AGE_MS ?? 10 * 60 * 1000);
const MAX_CONSECUTIVE_AUTH_FAILURES = Number(process.env.MAX_CONSECUTIVE_AUTH_FAILURES ?? 3);
const MIN_REMAINING_ITEMS_TO_ABORT = Number(process.env.MIN_REMAINING_ITEMS_TO_ABORT ?? 3);

function mustAbortAfterAuthFailure(consecutiveFailures, remainingItems) {
  return shouldAbortAfterAuthFailure({
    consecutiveFailures,
    remainingItems,
    maxConsecutiveFailures: MAX_CONSECUTIVE_AUTH_FAILURES,
    minRemainingItems: MIN_REMAINING_ITEMS_TO_ABORT
  });
}

async function discoverStoresFromAuthenticatedSearch({ tokenManager, clientId }) {
  const sweepPoints = buildSweepPoints({
    step: Number(process.env.LOCATOR_SWEEP_STEP ?? '1')
  });
  const discoveredStores = [];
  let consecutiveAuthFailures = 0;

  for (const [pointIndex, point] of sweepPoints.entries()) {
    try {
      const payload = await requestWithBearerToken(tokenManager, (bearerToken) => (
        fetchUsStoresNearLocation({
          latitude: point.lat,
          longitude: point.lng,
          bearerToken,
          clientId
        })
      ));

      normalizeUsStoreSearchResponse(payload, DEFAULT_MARKET_ID).forEach((store) => discoveredStores.push(store));
      consecutiveAuthFailures = 0;
    } catch (error) {
      if (isAuthenticationRecoveryError(error)) {
        consecutiveAuthFailures += 1;
        const remainingPoints = sweepPoints.length - pointIndex - 1;

        if (mustAbortAfterAuthFailure(consecutiveAuthFailures, remainingPoints)) {
          throw new AuthenticationRecoveryError(
            `Authentication recovery failed for ${consecutiveAuthFailures} consecutive search points with ${remainingPoints} remaining.`,
            { cause: error }
          );
        }
      }

      console.warn(`Authenticated store sweep failed for ${point.lat}, ${point.lng}:`, error.message);
    }
  }

  return dedupeStores(discoveredStores);
}

async function readFallbackStores() {
  const raw = await readFile(fallbackPath, 'utf8');
  return JSON.parse(raw);
}

async function enrichStoreAvailability(stores, targetProductCodes, tokenManager, clientId) {
  const lastCheckedAt = new Date().toISOString();

  if (!(tokenManager && clientId)) {
    return stores.map((store) => ({
      ...store,
      hasItem: true,
      lastCheckedAt,
      sourceMethod: 'sample-fallback'
    }));
  }

  const results = [];
  let consecutiveAuthFailures = 0;

  for (const [storeIndex, store] of stores.entries()) {
    try {
      const restaurantDetails = await requestWithBearerToken(tokenManager, (bearerToken) => (
        fetchUsRestaurantDetails(
          store.nationalStoreNumber ?? store.storeId,
          bearerToken,
          clientId,
          DEFAULT_MARKET_ID
        )
      ));
      const detailStoreFields = normalizeUsRestaurantDetailsStoreFields(restaurantDetails);

      results.push({
        ...store,
        ...Object.fromEntries(Object.entries(detailStoreFields).filter(([, value]) => value !== undefined && value !== '')),
        hasItem: hasTargetItemFromRestaurantDetails(restaurantDetails, targetProductCodes),
        lastCheckedAt,
        sourceMethod: 'mcbroken-us-menu+outages'
      });
      consecutiveAuthFailures = 0;
    } catch (error) {
      if (isAuthenticationRecoveryError(error)) {
        consecutiveAuthFailures += 1;
        const remainingStores = stores.length - storeIndex - 1;

        if (mustAbortAfterAuthFailure(consecutiveAuthFailures, remainingStores)) {
          throw new AuthenticationRecoveryError(
            `Authentication recovery failed for ${consecutiveAuthFailures} consecutive stores with ${remainingStores} remaining.`,
            { cause: error }
          );
        }
      }

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
  let tokenManager = null;
  let clientId = '';

  let discoveredStores = [];
  if (!hasLiveToken) {
    console.warn('BASIC_TOKEN_US is not configured; using the committed sample fallback stores.');
    discoveredStores = await readFallbackStores();
  } else {
    try {
      clientId = decodeClientIdFromBasicToken(basicTokenUs);
      let tokenRefreshCount = 0;
      tokenManager = createBearerTokenManager(
        async () => {
          const nextToken = await fetchBearerToken(basicTokenUs);
          tokenRefreshCount += 1;
          console.log(`Minted bearer token #${tokenRefreshCount}.`);
          return nextToken;
        },
        { maxAgeMs: TOKEN_MAX_AGE_MS }
      );
      discoveredStores = await discoverStoresFromAuthenticatedSearch({
        tokenManager,
        clientId
      });
    } catch (error) {
      if (isAuthenticationRecoveryError(error)) {
        throw error;
      }

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
    tokenManager,
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
  const searchIndex = buildSearchIndex(storesWithAvailability, generatedAt);

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
