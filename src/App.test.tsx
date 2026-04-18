import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('./components/MapView', () => ({
  default: () => <div data-testid="map-view">Map</div>
}));

const availabilityDataset = {
  version: '1',
  generatedAt: '2026-04-18T00:00:00.000Z',
  item: {
    name: "Hot 'n Spicy McChicken",
    normalizedName: 'hot n spicy mcchicken',
    targetProductCodes: ['12345']
  },
  coverage: {
    country: 'US',
    description: 'Sample coverage'
  },
  storeCount: 1,
  stores: [
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
    }
  ]
};

const searchIndex = {
  version: '1',
  generatedAt: '2026-04-18T00:00:00.000Z',
  coverage: {
    country: 'US',
    description: 'Search coverage'
  },
  postalCodes: [
    {
      postalCode: '60607',
      city: 'Chicago',
      state: 'IL',
      lat: 41.878,
      lng: -87.63,
      storeCount: 1
    }
  ],
  cities: [
    {
      slug: 'chicago-il',
      city: 'Chicago',
      state: 'IL',
      lat: 41.878,
      lng: -87.63,
      storeCount: 1
    }
  ]
};

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        const payload = url.includes('hot-n-spicy')
          ? availabilityDataset
          : searchIndex;

        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(payload)
        });
      })
    );

    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (_success: PositionCallback, error: PositionErrorCallback) => {
          error({
            code: 1,
            message: 'denied',
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3
          } as GeolocationPositionError);
        }
      }
    });
  });

  it('renders the loaded dataset and manual search fallback', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Hot 'n Spicy Finder")).toBeInTheDocument();
    });

    expect(screen.getByText(/Location access was denied/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/ZIP code or City, State/i)).toBeInTheDocument();
    expect(screen.getByText(/1 locations in stock/i)).toBeInTheDocument();
    expect(screen.getByTestId('map-view')).toBeInTheDocument();
  });
});
