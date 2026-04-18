# Hot 'n Spicy McChicken Finder

A static React + Vite web app that visualizes McDonald's locations in the United States that appear to carry the Hot 'n Spicy McChicken. The browser only reads static JSON files from the deployed site. A scheduled GitHub Actions workflow can refresh those JSON files daily using the US authenticated McDonald's store-search and store-detail endpoints.

## Architecture

- `src/`: mobile-first React UI with Leaflet map, geolocation-first centering, ZIP/city fallback search, and a distance-sorted result list.
- `public/data/`: deployed JSON cache consumed by the frontend.
- `scripts/refresh-data.mjs`: generates the static datasets.
- `.github/workflows/deploy-pages.yml`: builds the app from the committed repo state and deploys it to GitHub Pages.
- `.github/workflows/refresh-live-data.yml`: refreshes `public/data/` on a schedule or manual trigger, commits any changed cache files, and lets the normal deploy workflow publish them.

## Data Contracts

### `hot-n-spicy-mcchicken.v1.json`

```json
{
  "version": "1",
  "generatedAt": "2026-04-18T00:00:00.000Z",
  "item": {
    "name": "Hot 'n Spicy McChicken",
    "normalizedName": "hot n spicy mcchicken",
    "targetProductCodes": ["12345"]
  },
  "coverage": {
    "country": "US",
    "description": "Human-readable metadata about the data source"
  },
  "storeCount": 4,
  "stores": []
}
```

### `us-search-index.v1.json`

```json
{
  "version": "1",
  "generatedAt": "2026-04-18T00:00:00.000Z",
  "coverage": {
    "country": "US",
    "description": "Static ZIP and city centroids derived from discovered stores"
  },
  "postalCodes": [],
  "cities": []
}
```

## Local Development

1. Install Node dependencies:

```bash
npm install
```

2. Start the app:

```bash
npm run dev
```

3. Run tests:

```bash
npm run test
npm run test:crawler
```

## Refresh Workflow Secrets

To generate live data in GitHub Actions, add:

- `BASIC_TOKEN_US`: base64-encoded McDonald's US app basic token used to mint a short-lived bearer token.

Required configuration:

- `HOT_SPICY_PRODUCT_CODES`: comma-separated Hot 'n Spicy McChicken outage product code list for the US market.
  Example: `12345,67890`

If `BASIC_TOKEN_US` is not configured, the deploy workflow still builds and deploys the committed datasets from `public/data/`, while the refresh workflow becomes a no-op.

## Refresh Strategy

The refresh script:

1. Mints a short-lived bearer token from `BASIC_TOKEN_US`.
2. Sweeps the authenticated US restaurant-location endpoint over a configurable U.S. grid.
3. Deduplicates stores into a single catalog.
4. Reads store outage data from the authenticated US restaurant detail endpoint.
5. Marks Hot 'n Spicy availability by checking whether the configured product codes are absent from `catalog.outageProductCodes`.
5. Writes:
   - `public/data/hot-n-spicy-mcchicken.v1.json`
   - `public/data/us-search-index.v1.json`

## Caveats

- The live dataset is best effort and depends on private McDonald's endpoints that may change.
- The US authenticated endpoints may require a US IP. If GitHub-hosted runners stop working, move the refresh workflow to your Ubuntu server or another US-based environment.
- The authenticated store sweep is intentionally conservative; if coverage drifts, the script can fall back to a maintained JSON seed file in `scripts/data/us-store-fallback.v1.json`.
- The committed data files are small starter samples so the UI works immediately before live automation is configured.
