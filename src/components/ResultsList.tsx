import type { Coordinate, HotSpicyAvailabilityStore } from '../types/contracts';
import { buildAppleMapsUrl, buildGoogleMapsUrl, formatMiles, haversineMiles } from '../lib/location';

interface ResultsListProps {
  stores: HotSpicyAvailabilityStore[];
  origin: Coordinate | null;
  selectedStoreId: string | null;
  onSelectStore: (storeId: string) => void;
}

export default function ResultsList({
  stores,
  origin,
  selectedStoreId,
  onSelectStore
}: ResultsListProps) {
  const sortedStores = [...stores].sort((left, right) => {
    if (!origin) {
      return left.state.localeCompare(right.state) || left.city.localeCompare(right.city);
    }

    const leftDistance = haversineMiles(origin, { lat: left.lat, lng: left.lng });
    const rightDistance = haversineMiles(origin, { lat: right.lat, lng: right.lng });
    return leftDistance - rightDistance;
  });

  return (
    <section className="panel results-panel">
      <div className="panel-header">
        <div>
          <div className="eyebrow">Matching Locations</div>
          <h2>{stores.length} locations in stock</h2>
        </div>
      </div>

      {sortedStores.length === 0 ? (
        <div className="empty-state">
          No matching locations are present in the current cache for this view.
        </div>
      ) : (
        <div className="results-list">
          {sortedStores.map((store) => {
            const distance = origin
              ? haversineMiles(origin, { lat: store.lat, lng: store.lng })
              : null;

            return (
              <article
                key={store.storeId}
                className={`result-card ${selectedStoreId === store.storeId ? 'selected' : ''}`}
              >
                <button className="result-select" type="button" onClick={() => onSelectStore(store.storeId)}>
                  <div className="result-topline">
                    <strong>{store.city}, {store.state}</strong>
                    <span>{formatMiles(distance)}</span>
                  </div>
                  <div className="result-name">{store.name}</div>
                  <div className="result-address">{store.address}</div>
                  <div className="result-address">
                    {store.city}, {store.state} {store.postalCode}
                  </div>
                  <div className="result-meta">
                    Last checked {new Date(store.lastCheckedAt).toLocaleString()}
                  </div>
                </button>

                <div className="result-links">
                  <a href={buildGoogleMapsUrl(store)} target="_blank" rel="noreferrer">
                    Google Maps
                  </a>
                  <a href={buildAppleMapsUrl(store)} target="_blank" rel="noreferrer">
                    Apple Maps
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
