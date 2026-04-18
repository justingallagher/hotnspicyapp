import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import type { Coordinate, HotSpicyAvailabilityStore } from '../types/contracts';

interface MapViewProps {
  center: Coordinate;
  stores: HotSpicyAvailabilityStore[];
  selectedStoreId: string | null;
  onSelectStore: (storeId: string) => void;
}

function createStoreIcon(selected: boolean) {
  return L.divIcon({
    className: 'store-marker-wrapper',
    html: `<span class="store-marker ${selected ? 'selected' : ''}"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9]
  });
}

export default function MapView({
  center,
  stores,
  selectedStoreId,
  onSelectStore
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = L.map(containerRef.current, {
      zoomControl: false
    }).setView([center.lat, center.lng], 10);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const clusterGroup = L.markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true
    });

    clusterGroup.addTo(map);
    mapRef.current = map;
    clusterRef.current = clusterGroup;

    return () => {
      clusterGroup.clearLayers();
      map.remove();
      mapRef.current = null;
      clusterRef.current = null;
    };
  }, [center.lat, center.lng]);

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    mapRef.current.setView([center.lat, center.lng], mapRef.current.getZoom(), {
      animate: true
    });
  }, [center.lat, center.lng]);

  useEffect(() => {
    const clusterGroup = clusterRef.current;
    const map = mapRef.current;

    if (!clusterGroup || !map) {
      return;
    }

    clusterGroup.clearLayers();

    stores.forEach((store) => {
      const marker = L.marker([store.lat, store.lng], {
        icon: createStoreIcon(store.storeId === selectedStoreId)
      });

      marker.bindPopup(
        `<strong>${store.name}</strong><br />${store.address}<br />${store.city}, ${store.state} ${store.postalCode}`
      );

      marker.on('click', () => {
        onSelectStore(store.storeId);
      });

      clusterGroup.addLayer(marker);
    });

    if (stores.length === 0) {
      map.setView([center.lat, center.lng], 10);
    }
  }, [center.lat, center.lng, onSelectStore, selectedStoreId, stores]);

  return (
    <section className="panel map-panel">
      <div className="eyebrow">Map</div>
      <div className="map-frame" ref={containerRef} />
    </section>
  );
}
