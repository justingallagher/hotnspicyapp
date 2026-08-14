import { memo, useMemo } from 'react';
import type { Coordinate, HotSpicyAvailabilityStore } from '../types/contracts';
import { buildAppleMapsUrl, buildGoogleMapsUrl, formatMiles, haversineMiles } from '../lib/location';

interface ResultsListProps {
  stores: HotSpicyAvailabilityStore[];
  origin: Coordinate | null;
  selectedStoreId: string | null;
  onSelectStore: (storeId: string) => void;
}

interface ResultCardProps {
  distance: number | null;
  isSelected: boolean;
  onSelectStore: (storeId: string) => void;
  store: HotSpicyAvailabilityStore;
}

const ResultCard = memo(function ResultCard({
  distance,
  isSelected,
  onSelectStore,
  store
}: ResultCardProps) {
  return (
    <article className={`result-card ${isSelected ? 'selected' : ''}`}>
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
});

export default function ResultsList({
  stores,
  origin,
  selectedStoreId,
  onSelectStore
}: ResultsListProps) {
  const sortedStores = useMemo(() => {
    const storesWithDistance = stores.map((store) => ({
      store,
      distance: origin
        ? haversineMiles(origin, { lat: store.lat, lng: store.lng })
        : null
    }));

    return storesWithDistance.sort((left, right) => {
      if (left.distance === null || right.distance === null) {
        return left.store.state.localeCompare(right.store.state)
          || left.store.city.localeCompare(right.store.city);
      }

      return left.distance - right.distance;
    });
  }, [origin, stores]);

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
          {sortedStores.map(({ store, distance }) => (
            <ResultCard
              key={store.storeId}
              distance={distance}
              isSelected={selectedStoreId === store.storeId}
              onSelectStore={onSelectStore}
              store={store}
            />
          ))}
        </div>
      )}
    </section>
  );
}
