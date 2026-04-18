import type { HotSpicyAvailabilityDatasetV1, SearchIndexV1 } from '../types/contracts';

function dataUrl(fileName: string) {
  return `${import.meta.env.BASE_URL}data/${fileName}`;
}

async function fetchJson<T>(fileName: string) {
  const response = await fetch(dataUrl(fileName));

  if (!response.ok) {
    throw new Error(`Failed to fetch ${fileName}: ${response.status}`);
  }

  return (await response.json()) as T;
}

export function fetchAvailabilityDataset() {
  return fetchJson<HotSpicyAvailabilityDatasetV1>('hot-n-spicy-mcchicken.v1.json');
}

export function fetchSearchIndex() {
  return fetchJson<SearchIndexV1>('us-search-index.v1.json');
}

