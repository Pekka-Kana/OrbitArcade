# ORBITAL ARCADE — Implementation Plan

A retro 80's-arcade-style visualization of Earth with real satellites and near-Earth asteroids orbiting it. Wireframe vector aesthetic (Asteroids / Missile Command), click any object to see live orbital data.

---

## 1. Concept Summary

- Low-poly wireframe Earth centered on screen, slowly rotating
- Satellites rendered as small glowing blips/triangles, positioned from **real, live orbital data**
- Near-Earth asteroids shown from NASA close-approach data
- Click an object → arcade-style HUD panel types out its stats (name, altitude, velocity, inclination, period, etc.)
- CRT post-processing: scanlines, phosphor glow, slight barrel distortion, vignette

---

## 2. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Rendering | **Three.js** | Standard WebGL library, easy wireframes, raycasting, post-processing |
| Orbit math | **satellite.js** | SGP4 propagator; converts TLE data → position/velocity at any timestamp |
| Satellite data | **CelesTrak GP API** | Free, no API key, TLE/JSON for thousands of objects |
| Asteroid data | **NASA NeoWs API** | Free (DEMO_KEY works for testing; free api.nasa.gov key for real use) |
| Build tooling | **Vite** | Fast dev server, trivial setup |
| Post-processing | Three.js `EffectComposer` + custom CRT shader | Scanlines, bloom, distortion |
| Font | "Press Start 2P" or "VT323" (Google Fonts) | Authentic arcade text |

No backend required — this can be a fully static site (GitHub Pages / Netlify / Vercel).

---

## 3. Data Sources

### 3.1 Satellites — CelesTrak
- Endpoint examples:
  - Active satellites: `https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=json`
  - Just bright/famous ones: `GROUP=visual` (~150 objects — great default set)
  - ISS only: `CATNR=25544`
  - Starlink: `GROUP=starlink` (thousands — performance test case)
- Format: request `FORMAT=json` (easier than raw TLE parsing) — fields include `OBJECT_NAME`, `NORAD_CAT_ID`, `MEAN_MOTION`, `INCLINATION`, `EPOCH`, etc.
- satellite.js accepts either raw TLE lines (`twoline2satrec`) or the JSON/OMM fields (`json2satrec` in newer versions).
- **Etiquette:** CelesTrak asks that you not hammer the API. Fetch once on load, cache in `localStorage` with a timestamp, and refresh at most every 2 hours. TLEs stay accurate for days.
- **CORS:** CelesTrak sends CORS headers, so direct browser fetch works. If it ever breaks, fall back to a tiny serverless proxy function.

### 3.2 Asteroids — NASA NeoWs
- Feed endpoint: `https://api.nasa.gov/neo/rest/v1/feed?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&api_key=KEY`
- Gives per-asteroid: name, estimated diameter, miss distance (km), relative velocity (km/s), close-approach time, `is_potentially_hazardous_asteroid` flag.
- Asteroids are *not* orbiting Earth, so don't propagate them like satellites. Two honest display options:
  - **Option A (recommended):** show them as blips on an outer "radar ring" at the edge of the scene, distance-scaled logarithmically, drifting past. Label ring "NEO TRACKING".
  - **Option B:** animate a flyby along a straight-line trajectory using miss distance + velocity.

### 3.3 Extra metadata (optional)
- CelesTrak SATCAT (`https://celestrak.org/satcat/`) for country/owner, launch date, object type (payload vs debris vs rocket body). Could color-code: green = payload, yellow = rocket body, red = debris. Very Asteroids-like.

---

## 4. Architecture

```
/src
  main.js            // bootstrap, render loop
  scene/
    earth.js         // wireframe icosahedron + graticule
    satellites.js    // Points/InstancedMesh, per-frame propagation
    asteroids.js     // NEO ring / flybys
    starfield.js     // background points
  data/
    celestrak.js     // fetch + cache + parse TLE/OMM
    neows.js         // fetch + cache NASA NEO feed
  orbits/
    propagate.js     // satellite.js wrapper: (satrec, date) -> {posKm, velKmS}
    coords.js        // ECI km -> scene units, alt/speed helpers
  ui/
    hud.js           // click handling (raycaster), info panel, typewriter effect
    panel.css        // arcade styling
  fx/
    crt.js           // EffectComposer passes: bloom + CRT shader
index.html
```

### Coordinate handling
- satellite.js returns **ECI coordinates in km**. Define a scale, e.g. `1 scene unit = 1000 km` → Earth radius ≈ 6.371 units.
- Earth rotation: either rotate the Earth mesh by GMST (from `satellite.gstime(date)`) and keep satellites in ECI, or convert satellite positions to ECEF and keep Earth fixed. **Rotating the Earth mesh is simpler** — satellites stay in ECI, Earth spins beneath them, which is also physically what happens.
- Time: run a simulation clock. Default = real time; add a time-warp control (1×, 60×, 600×) — watching orbits at 60× is *mesmerizing* and very arcade-attract-mode.

---

## 5. Implementation Phases

### Phase 1 — Static scene (1 evening)
1. Vite project, Three.js installed.
2. Black background, `PerspectiveCamera`, `OrbitControls` (rotate/zoom).
3. Earth: `IcosahedronGeometry(6.371, 2)` with `wireframe: true`, color `#00ff66` (or cyan `#00ffff`). Optionally add a lat/long graticule using `LineSegments` for a Missile Command globe look.
4. Starfield: ~1500 random `THREE.Points`, faint white, tiny size.
5. Deliverable: rotating wireframe Earth in space.

### Phase 2 — Fake orbits (1 evening)
1. Create 30–50 dummy satellites with random circular orbits (random inclination, altitude 400–2000 km, phase).
2. Animate them in the render loop with basic circular-orbit math.
3. Render as `THREE.Points` with additive blending + small glow sprite texture, or tiny triangles (`ConeGeometry` via `InstancedMesh`) for the classic Asteroids-ship silhouette.
4. Deliverable: Earth with orbiting blips. This is the prototype checkpoint.

### Phase 3 — Real data (1–2 evenings)
1. `data/celestrak.js`: fetch `GROUP=visual&FORMAT=json`, cache in localStorage (2h TTL).
2. For each object, build a `satrec` with satellite.js.
3. Each frame (or every 250 ms — plenty smooth and cheaper): `propagate(satrec, simTime)` → ECI km → scene units → update instance matrix / point position.
4. Handle propagation errors (some satrecs fail/decayed) — skip and log.
5. Performance: for ≤500 objects, per-frame propagation in JS is fine. For Starlink-scale (5000+), propagate in a **Web Worker** and/or throttle to 1 Hz with interpolation.
6. Deliverable: the ISS is actually where the ISS actually is. Verify against a tracker like n2yo or ISS spotters.

### Phase 4 — Click + HUD (1–2 evenings)
1. `THREE.Raycaster` on pointer-down. For `Points`, set `raycaster.params.Points.threshold` generously (fat fingers, tiny blips). With `InstancedMesh`, use `instanceId`.
2. On hit: highlight the object (brighter, pulsing, or draw its full orbit path as a line — compute by propagating one full period).
3. Info panel (plain HTML/CSS overlay, not WebGL text):
   ```
   ┌─────────────────────────────┐
   │ OBJECT: ISS (ZARYA)         │
   │ NORAD ID: 25544             │
   │ ALT: 417.3 KM               │
   │ VEL: 7.66 KM/S              │
   │ INC: 51.64°                 │
   │ PERIOD: 92.8 MIN            │
   └─────────────────────────────┘
   ```
   - Altitude = |posECI| − 6371 km. Velocity = |velECI|. Inclination/period straight from the TLE fields (period = 1440 / MEAN_MOTION minutes).
   - Typewriter effect: reveal ~2 chars per frame, optional 8-bit blip sound per char (WebAudio square wave oscillator — no audio files needed).
4. Deliverable: click any blip, get live stats in an arcade HUD.

### Phase 5 — CRT & polish (1–2 evenings)
1. `EffectComposer`: `RenderPass` → `UnrealBloomPass` (subtle, threshold ~0.4) → custom `ShaderPass` for CRT.
2. CRT fragment shader ingredients: horizontal scanlines (`sin(uv.y * resolution.y * π)` darkening), slight barrel distortion of UVs, RGB channel offset (chromatic aberration ~1px), vignette, faint noise/flicker.
3. UI chrome: score-style header (`OBJECTS TRACKED: 0147`), blinking `TRACKING...` text, "INSERT COIN" easter egg.
4. Attract mode: if idle 30 s, auto-rotate camera and cycle random object highlights with their stats.
5. Deliverable: it looks like a cabinet from 1982.

### Phase 6 — Asteroids + stretch goals
1. NeoWs feed for today ± 3 days → outer radar ring blips, red if `is_potentially_hazardous`.
2. Search box ("FIND: HUBBLE").
3. Group toggles: STATIONS / STARLINK / DEBRIS / GPS.
4. Time-warp slider.
5. Ground track for the selected object: satellite path projected onto the
   surface for the next 2–3 revolutions, drawn as a child of the rotating
   Earth group so it stays pinned to the continents (sample SGP4 states →
   `eciToGeodetic(pos, gmst(t))` → lat/lon → same surface mapping as
   borders.js, slightly above the border lines). Shows the classic
   westward-marching sinusoid — complements the inertial-frame orbit line.
6. Stretch: game mode — debris objects as shootable targets at their real positions.

---

## 6. Key Code Sketches

**Propagation (per object, per tick):**
```js
import * as satellite from 'satellite.js';

const satrec = satellite.twoline2satrec(tleLine1, tleLine2);

function getState(satrec, date) {
  const pv = satellite.propagate(satrec, date);
  if (!pv.position) return null;            // decayed / bad TLE
  const p = pv.position, v = pv.velocity;   // km, km/s (ECI)
  const altKm = Math.hypot(p.x, p.y, p.z) - 6371;
  const speedKmS = Math.hypot(v.x, v.y, v.z);
  return { p, altKm, speedKmS };
}
```

**Earth spin (keep satellites in ECI):**
```js
earthMesh.rotation.y = satellite.gstime(simDate); // radians
```

**Scanline core of the CRT shader:**
```glsl
float scan = 0.85 + 0.15 * sin(vUv.y * uResolution.y * 3.14159);
color.rgb *= scan;
```

---

## 7. Gotchas & Notes

- **DEMO_KEY limits** on NASA API are tight (30 req/hour) — get a free key early; it takes one form.
- **Decayed satellites** appear in some CelesTrak groups; `propagate()` returns false/NaN — filter them out.
- **Don't fetch on every page load during dev** — you'll annoy CelesTrak and get throttled. Cache aggressively; commit a sample JSON snapshot to the repo as an offline fallback.
- **satellite.js API versions differ** (v5 vs v6 changed some function signatures like `json2satrec`) — pin your version and check its README.
- **Raycasting Points is finicky** — if picking feels bad, switch to `InstancedMesh` of tiny octahedrons; picking becomes exact and they look better up close.
- **Timezone/epoch bugs** are the classic failure mode: always propagate with `new Date()` (UTC internally) and never hand-roll time math.
- Mobile: cap device pixel ratio at 2 and reduce satellite count for performance.

---

## 8. Milestone Checklist

- [x] Wireframe Earth + starfield renders
- [x] Dummy satellites orbiting
- [x] CelesTrak fetch + cache working
- [x] Real ISS position verified against an external tracker
- [x] Click → HUD with name/alt/vel/inc/period
- [x] Orbit path drawn for selected object
- [x] CRT shader + bloom
- [x] Typewriter + sound effects
- [x] NEO radar ring
- [x] Ground track drawn for selected object (rotating frame)
- [ ] Deployed as static site
