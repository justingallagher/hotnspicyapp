import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ResultsList from './ResultsList';
import type { HotSpicyAvailabilityStore } from '../types/contracts';

function buildStores(count: number): HotSpicyAvailabilityStore[] {
  return Array.from({ length: count }, (_, index) => ({
    storeId: String(index),
    name: `Restaurant ${index}`,
    address: `${index} Main St`,
    city: `City ${String(index).padStart(3, '0')}`,
    state: 'IL',
    postalCode: String(60000 + index),
    lat: 41 + index / 100,
    lng: -87,
    hasItem: true,
    lastCheckedAt: '2026-04-18T00:00:00.000Z',
    sourceMethod: 'sample'
  }));
}

describe('ResultsList', () => {
  it('shows 50 locations initially and loads the next 50 on demand', () => {
    const { container } = render(
      <ResultsList
        stores={buildStores(120)}
        origin={null}
        selectedStoreId={null}
        onSelectStore={vi.fn()}
      />
    );

    expect(container.querySelectorAll('.result-card')).toHaveLength(50);
    expect(screen.getByRole('button', { name: /show 50 more locations/i })).toHaveTextContent(
      '50 of 120 shown'
    );

    fireEvent.click(screen.getByRole('button', { name: /show 50 more locations/i }));

    expect(container.querySelectorAll('.result-card')).toHaveLength(100);
    expect(screen.getByRole('button', { name: /show 50 more locations/i })).toHaveTextContent(
      '100 of 120 shown'
    );
  });

  it('renders all locations without a load control when there are fewer than 50', () => {
    const { container } = render(
      <ResultsList
        stores={buildStores(12)}
        origin={null}
        selectedStoreId={null}
        onSelectStore={vi.fn()}
      />
    );

    expect(container.querySelectorAll('.result-card')).toHaveLength(12);
    expect(container.querySelector('.results-load-more')).not.toBeInTheDocument();
  });
});
