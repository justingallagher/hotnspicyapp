import { useEffect, useState } from 'react';
import MapView from './components/MapView';
import ResultsList from './components/ResultsList';
import SearchPanel from './components/SearchPanel';
import { fetchAvailabilityDataset, fetchSearchIndex } from './lib/data';
import { lookupSearchTarget } from './lib/search';
import type {
  Coordinate,
  HotSpicyAvailabilityDatasetV1,
  SearchIndexV1
} from './types/contracts';

const DEFAULT_CENTER: Coordinate = {
  lat: 39.8283,
  lng: -98.5795
};

function locationStatusCopy(
  isLoading: boolean,
  locationError: string | null,
  activeCenterLabel: string | null
) {
  if (isLoading) {
    return 'Trying to center the map on your current location.';
  }

  if (activeCenterLabel) {
    return `Centered on ${activeCenterLabel}.`;
  }

  if (locationError) {
    return locationError;
  }

  return 'Allow location access for nearby results, or search by ZIP / City, State.';
}

export default function App() {
  const [dataset, setDataset] = useState<HotSpicyAvailabilityDatasetV1 | null>(null);
  const [searchIndex, setSearchIndex] = useState<SearchIndexV1 | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [activeCenter, setActiveCenter] = useState<Coordinate>(DEFAULT_CENTER);
  const [activeCenterLabel, setActiveCenterLabel] = useState<string | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);

  const locationSupported = typeof navigator !== 'undefined' && 'geolocation' in navigator;

  useEffect(() => {
    Promise.all([fetchAvailabilityDataset(), fetchSearchIndex()])
      .then(([availability, index]) => {
        setDataset(availability);
        setSearchIndex(index);
        setSelectedStoreId(availability.stores[0]?.storeId ?? null);
        setStatus('ready');
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load site data.');
        setStatus('error');
      });
  }, []);

  useEffect(() => {
    if (!locationSupported) {
      setIsLocating(false);
      setLocationError('Location access is not available in this browser. Search by ZIP or City, State.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setActiveCenter({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setActiveCenterLabel('your current location');
        setIsLocating(false);
      },
      () => {
        setLocationError('Location access was denied. Search by ZIP or City, State to re-center the map.');
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 60_000,
        timeout: 8_000
      }
    );
  }, [locationSupported]);

  const stores = dataset?.stores ?? [];
  const distanceOrigin = activeCenterLabel ? activeCenter : null;

  function handleSearchSubmit() {
    if (!searchIndex) {
      return;
    }

    const result = lookupSearchTarget(query, searchIndex);

    if (!result) {
      setLocationError('That ZIP or City, State is not present in the current offline search index.');
      return;
    }

    setActiveCenter({
      lat: result.lat,
      lng: result.lng
    });
    setActiveCenterLabel(result.label);
    setLocationError(null);
  }

  function handleLocate() {
    if (!locationSupported) {
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setActiveCenter({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setActiveCenterLabel('your current location');
        setIsLocating(false);
      },
      () => {
        setLocationError('Unable to get your location right now. Try again or search manually.');
        setIsLocating(false);
      }
    );
  }

  function handleSelectStore(storeId: string) {
    setSelectedStoreId(storeId);

    const store = stores.find((candidate) => candidate.storeId === storeId);
    if (!store) {
      return;
    }

    setActiveCenter({
      lat: store.lat,
      lng: store.lng
    });
    setActiveCenterLabel(`${store.city}, ${store.state}`);
  }

  if (status === 'loading') {
    return (
      <main className="shell">
        <section className="hero panel">
          <div className="eyebrow">Loading</div>
          <h1>Hot &apos;n Spicy Finder</h1>
          <p className="lede">Loading the latest location cache and offline search index.</p>
        </section>
      </main>
    );
  }

  if (status === 'error' || !dataset || !searchIndex) {
    return (
      <main className="shell">
        <section className="hero panel">
          <div className="eyebrow">Data Error</div>
          <h1>Hot &apos;n Spicy Finder</h1>
          <p className="lede">{error ?? 'The app could not load its cached data.'}</p>
        </section>
      </main>
    );
  }

  const statusMessage = locationStatusCopy(isLocating, locationError, activeCenterLabel);
  const generatedDate = new Date(dataset.generatedAt).toLocaleString();

  return (
    <main className="shell">
      <section className="hero panel">
        <div className="eyebrow">Updated Daily</div>
        <h1>Hot &apos;n Spicy Finder</h1>
        <p className="lede">
          {dataset.storeCount} U.S. McDonald&apos;s locations currently appear to have this item in stock.
        </p>

        <div className="hero-meta">
          <span>Last Updated {generatedDate}</span>
          <span>{dataset.coverage.description}</span>
        </div>
      </section>

      <section className="content-grid">
        <div className="sidebar">
          <SearchPanel
            query={query}
            onQueryChange={setQuery}
            onSubmit={handleSearchSubmit}
            onLocate={handleLocate}
            statusMessage={statusMessage}
            locationSupported={locationSupported}
          />
          <ResultsList
            stores={stores}
            origin={distanceOrigin}
            selectedStoreId={selectedStoreId}
            onSelectStore={handleSelectStore}
          />
        </div>

        <div className="map-column">
          <MapView
            center={activeCenter}
            stores={stores}
            selectedStoreId={selectedStoreId}
            onSelectStore={handleSelectStore}
          />
        </div>
      </section>
    </main>
  );
}
