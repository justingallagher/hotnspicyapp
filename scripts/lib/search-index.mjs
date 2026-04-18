function roundCoordinate(value) {
  return Number(value.toFixed(6));
}

function slugifyCityState(city, state) {
  return `${city}-${state}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');
}

function averageCoordinate(stores, key) {
  const sum = stores.reduce((total, store) => total + Number(store[key]), 0);
  return roundCoordinate(sum / stores.length);
}

export function buildSearchIndex(stores, generatedAt) {
  const postalGroups = new Map();
  const cityGroups = new Map();

  stores.forEach((store) => {
    const postalKey = store.postalCode;
    if (postalKey) {
      const nextPostal = postalGroups.get(postalKey) ?? [];
      nextPostal.push(store);
      postalGroups.set(postalKey, nextPostal);
    }

    if (store.city && store.state) {
      const cityKey = `${store.city}|${store.state}`;
      const nextCity = cityGroups.get(cityKey) ?? [];
      nextCity.push(store);
      cityGroups.set(cityKey, nextCity);
    }
  });

  const postalCodes = [...postalGroups.entries()]
    .map(([postalCode, groupedStores]) => ({
      postalCode,
      city: groupedStores[0].city,
      state: groupedStores[0].state,
      lat: averageCoordinate(groupedStores, 'lat'),
      lng: averageCoordinate(groupedStores, 'lng'),
      storeCount: groupedStores.length
    }))
    .sort((left, right) => left.postalCode.localeCompare(right.postalCode));

  const cities = [...cityGroups.entries()]
    .map(([key, groupedStores]) => {
      const [city, state] = key.split('|');
      return {
        slug: slugifyCityState(city, state),
        city,
        state,
        lat: averageCoordinate(groupedStores, 'lat'),
        lng: averageCoordinate(groupedStores, 'lng'),
        storeCount: groupedStores.length
      };
    })
    .sort((left, right) => left.slug.localeCompare(right.slug));

  return {
    version: '1',
    generatedAt,
    coverage: {
      country: 'US',
      description: "Static ZIP and city centroids derived from the discovered McDonald's store set."
    },
    postalCodes,
    cities
  };
}
