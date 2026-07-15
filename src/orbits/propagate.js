// Deep imports on purpose: the package root re-exports an optional WASM
// build whose emscripten loader (top-level await, node: imports) breaks
// Vite's worker bundling — and we don't use it
import { json2satrec } from 'satellite.js/dist/io.js';
import { propagate, gstime } from 'satellite.js/dist/propagation.js';
import { eciToGeodetic } from 'satellite.js/dist/transforms.js';

export { gstime, eciToGeodetic };

// OMM JSON (CelesTrak FORMAT=json) -> satrec, or null if the record is bad
export function buildSatrec(omm) {
  try {
    return json2satrec(omm);
  } catch (err) {
    console.warn('[propagate] skipping bad OMM record:', omm.OBJECT_NAME, err);
    return null;
  }
}

// -> { position, velocity } in ECI km / km/s, or null (decayed, bad TLE)
export function getState(satrec, date) {
  try {
    const pv = propagate(satrec, date);
    if (!pv || !Number.isFinite(pv.position?.x)) return null;
    return pv;
  } catch {
    return null;
  }
}
