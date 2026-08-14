import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MapView from './MapView';
import type { HotSpicyAvailabilityStore } from '../types/contracts';

const leaflet = vi.hoisted(() => {
  const mapInstance = {
    getZoom: vi.fn(() => 10),
    remove: vi.fn(),
    setView: vi.fn()
  };
  mapInstance.setView.mockReturnValue(mapInstance);

  const layerGroup = {
    addTo: vi.fn(),
    clearLayers: vi.fn()
  };
  layerGroup.addTo.mockReturnValue(layerGroup);

  const markers: Array<{
    addTo: ReturnType<typeof vi.fn>;
    bindPopup: ReturnType<typeof vi.fn>;
    bringToFront: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    setStyle: ReturnType<typeof vi.fn>;
  }> = [];

  return {
    circleMarker: vi.fn(() => {
      const marker = {
        addTo: vi.fn(),
        bindPopup: vi.fn(),
        bringToFront: vi.fn(),
        on: vi.fn(),
        setStyle: vi.fn()
      };
      markers.push(marker);
      return marker;
    }),
    control: {
      zoom: vi.fn(() => ({ addTo: vi.fn() }))
    },
    canvas: vi.fn(() => ({})),
    layerGroup: vi.fn(() => layerGroup),
    map: vi.fn(() => mapInstance),
    mapInstance,
    markers,
    tileLayer: vi.fn(() => ({ addTo: vi.fn() }))
  };
});

vi.mock('leaflet', () => ({
  default: leaflet
}));

const stores: HotSpicyAvailabilityStore[] = [
  {
    storeId: '1001',
    name: "McDonald's #1001",
    address: '110 N Carpenter St',
    city: 'Chicago',
    state: 'IL',
    postalCode: '60607',
    lat: 41.8846,
    lng: -87.6536,
    hasItem: true,
    lastCheckedAt: '2026-04-18T00:00:00.000Z',
    sourceMethod: 'sample'
  },
  {
    storeId: '1002',
    name: "McDonald's #1002",
    address: '1 W Washington St',
    city: 'Chicago',
    state: 'IL',
    postalCode: '60602',
    lat: 41.8833,
    lng: -87.6277,
    hasItem: true,
    lastCheckedAt: '2026-04-18T00:00:00.000Z',
    sourceMethod: 'sample'
  }
];

describe('MapView', () => {
  it('keeps the map and marker collection intact while center and selection change', () => {
    const onSelectStore = vi.fn();
    const { rerender } = render(
      <MapView
        center={{ lat: 41.88, lng: -87.63 }}
        stores={stores}
        selectedStoreId="1001"
        onSelectStore={onSelectStore}
      />
    );

    expect(leaflet.map).toHaveBeenCalledTimes(1);
    expect(leaflet.circleMarker).toHaveBeenCalledTimes(2);

    rerender(
      <MapView
        center={{ lat: 41.89, lng: -87.64 }}
        stores={stores}
        selectedStoreId="1002"
        onSelectStore={onSelectStore}
      />
    );

    expect(leaflet.map).toHaveBeenCalledTimes(1);
    expect(leaflet.circleMarker).toHaveBeenCalledTimes(2);
    expect(leaflet.mapInstance.remove).not.toHaveBeenCalled();
    expect(leaflet.markers[0].setStyle).toHaveBeenCalled();
    expect(leaflet.markers[1].setStyle).toHaveBeenCalled();
  });
});
