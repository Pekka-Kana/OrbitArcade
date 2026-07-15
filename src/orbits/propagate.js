import { json2satrec, propagate, gstime, eciToGeodetic } from 'satellite.js';

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
