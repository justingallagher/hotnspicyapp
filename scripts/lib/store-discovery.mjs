export function buildSweepPoints({
  latMin = 24.5,
  latMax = 49.5,
  lngMin = -124.9,
  lngMax = -66.9,
  step = 2
} = {}) {
  const points = [];

  for (let lat = latMin; lat <= latMax; lat += step) {
    for (let lng = lngMin; lng <= lngMax; lng += step) {
      points.push({
        lat: Number(lat.toFixed(4)),
        lng: Number(lng.toFixed(4))
      });
    }
  }

  return points;
}

export function parseLocatorFeature(feature) {
  const properties = feature?.properties ?? {};
  const coordinates = feature?.geometry?.coordinates ?? [null, null];
  const address = properties.addressLine1 ?? properties.address ?? '';
  const city = properties.city ?? properties.subLocality ?? '';
  const state = properties.state ?? properties.territory ?? '';
  const postalCode = properties.postalCode ?? properties.zip ?? '';
  const storeId =
    properties.storeNumber ??
    properties.storeId ??
    properties.id ??
    properties.identifier ??
    `${address}-${postalCode}`;

  if (!storeId || coordinates[0] === null || coordinates[1] === null) {
    return null;
  }

  return {
    storeId: String(storeId),
    name: properties.name ?? `McDonald's #${storeId}`,
    address,
    city,
    state,
    postalCode,
    lat: Number(coordinates[1]),
    lng: Number(coordinates[0])
  };
}

export function dedupeStores(stores) {
  const map = new Map();

  stores.forEach((store) => {
    if (store?.storeId) {
      map.set(store.storeId, store);
    }
  });

  return [...map.values()];
}

