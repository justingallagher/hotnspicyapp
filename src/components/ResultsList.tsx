import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

const RESULTS_PAGE_SIZE = 50;

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
  const [visibleCount, setVisibleCount] = useState(RESULTS_PAGE_SIZE);
  const loadMoreRef = useRef<HTMLButtonElement | null>(null);
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

  const loadMore = useCallback(() => {
    setVisibleCount((currentCount) => (
      Math.min(currentCount + RESULTS_PAGE_SIZE, sortedStores.length)
    ));
  }, [sortedStores.length]);

  useEffect(() => {
    setVisibleCount(RESULTS_PAGE_SIZE);
  }, [origin, stores]);

  const hasMore = visibleCount < sortedStores.length;

  useEffect(() => {
    const loadMoreElement = loadMoreRef.current;

    if (!hasMore || !loadMoreElement || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        loadMore();
      }
    }, {
      rootMargin: '300px 0px'
    });

    observer.observe(loadMoreElement);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  const visibleStores = sortedStores.slice(0, visibleCount);

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
          {visibleStores.map(({ store, distance }) => (
            <ResultCard
              key={store.storeId}
              distance={distance}
              isSelected={selectedStoreId === store.storeId}
              onSelectStore={onSelectStore}
              store={store}
            />
          ))}
          {hasMore && (
            <button
              className="ghost-button results-load-more"
              onClick={loadMore}
              ref={loadMoreRef}
              type="button"
            >
              Show 50 more locations ({visibleStores.length} of {sortedStores.length} shown)
            </button>
          )}
        </div>
      )}
    </section>
  );
}
