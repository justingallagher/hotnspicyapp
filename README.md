# Hot 'n Spicy McChicken Finder

A static React + Vite web app that visualizes McDonald's locations in the United States that appear to carry the Hot 'n Spicy McChicken. The browser only reads static JSON files from the deployed site. A scheduled GitHub Actions workflow can refresh those JSON files daily using McDonald's public locator plus reverse-engineered app endpoints.

## Architecture

- `src/`: mobile-first React UI with Leaflet map, geolocation-first centering, ZIP/city fallback search, and a distance-sorted result list.
- `public/data/`: deployed JSON cache consumed by the frontend.
- `scripts/refresh-data.mjs`: generates the static datasets.
- `.github/workflows/refresh-and-deploy.yml`: installs dependencies, optionally refreshes live data, builds the site, and deploys to GitHub Pages.

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

- `MCD_API_KEY`: reverse-engineered McDonald's app key sent as the `mcd_apikey` header.

Optional overrides:

- `MCD_MARKET_ID` default `US`
- `MCD_LANGUAGE_NAME` default `en-US`
- `MCD_PLATFORM` default `iphone`
- `MCD_APPLICATION` default `MOT`

If `MCD_API_KEY` is not configured, the workflow still builds and deploys the committed sample datasets from `public/data/`.

## Refresh Strategy

The refresh script:

1. Sweeps the public McDonald's locator endpoint over a configurable U.S. grid.
2. Deduplicates stores into a single catalog.
3. Resolves Hot 'n Spicy McChicken product codes from nutrition/category endpoints.
4. Reads store outage data from the reverse-engineered app API.
5. Writes:
   - `public/data/hot-n-spicy-mcchicken.v1.json`
   - `public/data/us-search-index.v1.json`

## Caveats

- The live dataset is best effort and depends on private McDonald's endpoints that may change.
- The public locator sweep is intentionally conservative; if coverage drifts, the script can fall back to a maintained JSON seed file in `scripts/data/us-store-fallback.v1.json`.
- The committed data files are small starter samples so the UI works immediately before live automation is configured.
