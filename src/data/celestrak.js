import fallback from './sat-fallback.json';

// Brightest objects first (visual), then interesting payload groups, then
// the big constellations up to TARGET_COUNT (starlink last so it fills
// whatever room remains). GROUP=active would be simpler but CelesTrak
// 403s that bulk endpoint. Spent stages and debris are filtered out.
// sat-fallback.json is a small snapshot of the first five groups.
const GROUPS = [
  'visual',
  'stations',
  'science',
  'resource',
  'weather',
  'gps-ops',
  'glo-ops',
  'galileo',
  'beidou',
  'iridium-NEXT',
  'geo',
  'oneweb',
  'starlink',
];
const TARGET_COUNT = 10000;
const BORING = /R\/B|CENTAUR|AGENA|SL-\d|DELTA 1|\bDEB\b/;

// CelesTrak 403s bulk gp.php transfers (GROUP=active / GROUP=starlink),
// but serves Starlink via the supplemental endpoint — SpaceX's own
// operator ephemeris, fresher than standard TLEs anyway.
const gpUrl = (group) =>
  group === 'starlink'
    ? 'https://celestrak.org/NORAD/elements/supplemental/sup-gp.php?FILE=starlink&FORMAT=json'
    : `https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=json`;

// Key versioned so a cap/filter change invalidates older cached sets
const CACHE_KEY = 'orbital-arcade/gp-curated-v5';
const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // CelesTrak etiquette: 2h between fetches

function curate(groupLists) {
  const seen = new Set();
  const out = [];
  for (const list of groupLists) {
    for (const omm of list) {
      if (out.length >= TARGET_COUNT) return out;
      if (BORING.test(omm.OBJECT_NAME)) continue;
      if (seen.has(omm.NORAD_CAT_ID)) continue;
      seen.add(omm.NORAD_CAT_ID);
      out.push(omm);
    }
  }
  return out;
}

export async function fetchSatelliteData() {
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
    const results = await Promise.allSettled(
      GROUPS.map(async (group) => {
        const res = await fetch(gpUrl(group));
        if (!res.ok) throw new Error(`CelesTrak ${group} responded ${res.status}`);
        return res.json();
      })
    );
    const lists = results
      .filter((r) => r.status === 'fulfilled')
      .map((r) => r.value);
    if (!lists.length) throw new Error('all CelesTrak groups failed');
    const data = curate(lists);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), data }));
    } catch {
      /* quota exceeded — fine, we just refetch next load */
    }
    return data;
  } catch (err) {
    // Stale cache beats the bundled snapshot; the snapshot beats nothing
    console.warn('[celestrak] fetch failed, using offline data:', err);
    return cached ? cached.data : fallback;
  }
}
