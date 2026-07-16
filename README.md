# ORBITAL ARCADE

A retro-arcade WebGL visualizer that plots ~10,000 **real satellites** and NASA
near-Earth asteroids around a wireframe Earth — live orbital data, SGP4-propagated,
wrapped in an '80s CRT aesthetic. Click any object for its live stats.

**▶ Live: https://pekka-kana.github.io/OrbitArcade/**

## What it does

- **Real satellites, real positions.** Orbital elements are fetched live from
  CelesTrak and propagated with SGP4, so the ISS is where the ISS actually is.
  Each object flies nose-first along its true velocity vector.
- **Wireframe Earth** with Natural Earth country borders, rendered so the near
  hemisphere reads clearly while the far side ghosts through.
- **Family models.** Satellites are drawn as tiny wireframe silhouettes colored
  by type — Starlink, generic payloads, COSMOS, rocket-body-derived shapes,
  stations, Hubble — with the ISS as its own detailed model.
- **NEO radar ring.** NASA close-approach asteroids (today ±3 days) drift on an
  outer radar dial, log-scaled by miss distance, hazardous ones pulsing red.
- **Click for stats.** An arcade HUD types out name, altitude, velocity,
  inclination, and period, and draws the object's orbit line plus a
  ground track pinned to the continents.
- **Find & filter.** Search objects by name; toggle whole families on/off.
- **Arcade polish.** Bloom, scanlines, barrel distortion, and vignette via a
  post-processing chain; an attract mode kicks in after 30s idle and tours the sky.
- **Double-click** anywhere to re-center the view on Earth.

## Tech stack

Vanilla JavaScript, [Three.js](https://threejs.org) for rendering,
[satellite.js](https://github.com/shashwatak/satellite-js) for SGP4 propagation,
and [Vite](https://vitejs.dev) for tooling. Fully static — no backend.

## Running locally

```bash
npm install
npm run dev        # dev server at http://localhost:5173/OrbitArcade/
```

Other scripts:

```bash
npm run build      # production build to dist/
npm run preview    # serve the production build
```

The app runs entirely in the browser; all data is fetched client-side and cached
in `localStorage`. Committed fallback snapshots (`src/data/*-fallback.json`) keep
it working offline or when a source is unreachable.

## How it works

Everything hangs on one coordinate convention (`src/orbits/coords.js`): satellites
live in the inertial (ECI) frame at scene root, and the Earth group rotates beneath
them by sidereal time each frame. Anything pinned to geography (borders, ground
tracks) is a child of the Earth group. At 10,000 objects, SGP4 runs in a **Web
Worker** and each satellite family is drawn in a single instanced draw call, with
the main thread extrapolating positions between worker batches.

## Deployment

Every push to `main` runs `.github/workflows/deploy.yml`, which builds the site and
publishes it to GitHub Pages. The `base` path in `vite.config.js` is set for
project-site hosting under `/OrbitArcade/`.

## Data sources & credits

- **[CelesTrak](https://celestrak.org)** — satellite orbital elements (GP/OMM data).
- **[NASA NeoWs](https://api.nasa.gov)** — near-Earth object close-approach feed.
  Ships with `DEMO_KEY`; swap in a free [api.nasa.gov](https://api.nasa.gov) key at
  the top of `src/data/neows.js` to lift the shared rate limit.
- **[Natural Earth](https://www.naturalearthdata.com)** via the
  [world-atlas](https://github.com/topojson/world-atlas) package — country borders.
