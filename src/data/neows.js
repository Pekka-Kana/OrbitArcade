import fallback from './neo-fallback.json';

// NASA NeoWs close-approach feed, today ±3 days (7 days = the API max).
// DEMO_KEY allows 30 req/hour per IP — plenty behind the 6h cache. Swap
// in a free api.nasa.gov key here if it ever runs dry.
const API_KEY = 'DEMO_KEY';
const CACHE_KEY = 'orbital-arcade/neows-v1';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const fmt = (d) => d.toISOString().slice(0, 10);

function flatten(feed) {
  const out = [];
  for (const day of Object.values(feed.near_earth_objects || {})) {
    for (const neo of day) {
      const ca = neo.close_approach_data?.[0];
      if (!ca) continue;
      out.push({
        id: neo.id,
        name: neo.name.replace(/[()]/g, ''),
        hazardous: neo.is_potentially_hazardous_asteroid,
        diameterM:
          (neo.estimated_diameter.meters.estimated_diameter_min +
            neo.estimated_diameter.meters.estimated_diameter_max) / 2,
        missKm: parseFloat(ca.miss_distance.kilometers),
        velKmS: parseFloat(ca.relative_velocity.kilometers_per_second),
        approachMs: ca.epoch_date_close_approach,
      });
    }
  }
  out.sort((a, b) => a.approachMs - b.approachMs);
  return out;
}

export async function fetchNeoData() {
  let cached = null;
  try {
    cached = JSON.parse(localStorage.getItem(CACHE_KEY));
  } catch {
    /* corrupt cache — treat as absent */
  }
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const now = Date.now();
    const start = fmt(new Date(now - 3 * 864e5));
    const end = fmt(new Date(now + 3 * 864e5));
    const res = await fetch(
      `https://api.nasa.gov/neo/rest/v1/feed?start_date=${start}&end_date=${end}&api_key=${API_KEY}`
    );
    if (!res.ok) throw new Error(`NeoWs responded ${res.status}`);
    const data = flatten(await res.json());
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), data }));
    } catch {
      /* quota exceeded — fine */
    }
    return data;
  } catch (err) {
    console.warn('[neows] fetch failed, using offline data:', err);
    return cached ? cached.data : fallback;
  }
}
