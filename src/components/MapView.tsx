import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Coordinate, HotSpicyAvailabilityStore } from '../types/contracts';

interface MapViewProps {
  center: Coordinate;
  stores: HotSpicyAvailabilityStore[];
  selectedStoreId: string | null;
  onSelectStore: (storeId: string) => void;
}

const DEFAULT_MARKER_STYLE: L.CircleMarkerOptions = {
  radius: 7,
  fillColor: '#d83a1f',
  fillOpacity: 0.9,
  color: '#ffffff',
  opacity: 1,
  weight: 2
};

const SELECTED_MARKER_STYLE: L.CircleMarkerOptions = {
  radius: 9,
  fillColor: '#8c160b',
  fillOpacity: 1,
  color: '#fff2a8',
  opacity: 1,
  weight: 3
};

function escapeHtml(value: string) {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  };

  return value.replace(/[&<>'"]/g, (character) => entities[character]);
}

function popupContent(store: HotSpicyAvailabilityStore) {
  return `<strong>${escapeHtml(store.name)}</strong><br />${escapeHtml(store.address)}<br />${escapeHtml(store.city)}, ${escapeHtml(store.state)} ${escapeHtml(store.postalCode)}`;
}

export default function MapView({
  center,
  stores,
  selectedStoreId,
  onSelectStore
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const markersByStoreIdRef = useRef(new Map<string, L.CircleMarker>());
  const selectedStoreIdRef = useRef<string | null>(null);
  const initialCenterRef = useRef(center);
  const latestCenterRef = useRef(center);
  const onSelectStoreRef = useRef(onSelectStore);

  latestCenterRef.current = center;
  onSelectStoreRef.current = onSelectStore;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const initialCenter = initialCenterRef.current;
    const map = L.map(containerRef.current, {
      zoomControl: false
    }).setView([initialCenter.lat, initialCenter.lng], 10);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const markerLayer = L.layerGroup().addTo(map);

    mapRef.current = map;
    markerLayerRef.current = markerLayer;

    return () => {
      markerLayer.clearLayers();
      markersByStoreIdRef.current.clear();
      map.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    mapRef.current?.setView([center.lat, center.lng], mapRef.current.getZoom(), {
      animate: true
    });
  }, [center.lat, center.lng]);

  useEffect(() => {
    const markerLayer = markerLayerRef.current;
    const map = mapRef.current;

    if (!markerLayer || !map) {
      return;
    }

    markerLayer.clearLayers();
    markersByStoreIdRef.current.clear();

    // Canvas keeps thousands of points out of the DOM while preserving a marker
    // and click target for every store.
    const renderer = L.canvas({ padding: 0.5 });

    stores.forEach((store) => {
      const marker = L.circleMarker([store.lat, store.lng], {
        ...(store.storeId === selectedStoreId
          ? SELECTED_MARKER_STYLE
          : DEFAULT_MARKER_STYLE),
        renderer
      });

      marker.bindPopup(popupContent(store));
      marker.on('click', () => onSelectStoreRef.current(store.storeId));
      marker.addTo(markerLayer);
      markersByStoreIdRef.current.set(store.storeId, marker);
    });

    selectedStoreIdRef.current = selectedStoreId;

    if (stores.length === 0) {
      const latestCenter = latestCenterRef.current;
      map.setView([latestCenter.lat, latestCenter.lng], 10);
    }
  }, [stores]);

  useEffect(() => {
    const markers = markersByStoreIdRef.current;
    const previousMarker = selectedStoreIdRef.current
      ? markers.get(selectedStoreIdRef.current)
      : undefined;
    const selectedMarker = selectedStoreId ? markers.get(selectedStoreId) : undefined;

    previousMarker?.setStyle(DEFAULT_MARKER_STYLE);
    selectedMarker?.setStyle(SELECTED_MARKER_STYLE);
    selectedMarker?.bringToFront();
    selectedStoreIdRef.current = selectedStoreId;
  }, [selectedStoreId]);

  return (
    <section className="panel map-panel">
      <div className="eyebrow">Map</div>
      <div className="map-frame" ref={containerRef} />
    </section>
  );
}
