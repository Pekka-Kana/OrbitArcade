import * as THREE from 'three';
import { mesh } from 'topojson-client';
import world from 'world-atlas/countries-110m.json';
import { latLonToVec3 } from '../orbits/coords.js';

// Long straight borders (e.g. the 49th parallel) are single segments in the
// data; subdivide so their chords don't cut through the sphere.
const MAX_STEP_DEG = 1;

export function createBordersGeometry(radius) {
  // topojson mesh = every boundary exactly once (shared borders not doubled)
  const boundaries = mesh(world, world.objects.countries);

  const points = [];
  for (const line of boundaries.coordinates) {
    for (let i = 0; i < line.length - 1; i++) {
      const [lon0, lat0] = line[i];
      const [lon1, lat1] = line[i + 1];
      // Unwrap segments crossing the antimeridian (±180°) so they
      // interpolate the short way instead of circling the globe
      let dLon = lon1 - lon0;
      if (dLon > 180) dLon -= 360;
      else if (dLon < -180) dLon += 360;
      const dLat = lat1 - lat0;
      const steps = Math.max(
        1,
        Math.ceil(Math.max(Math.abs(dLon), Math.abs(dLat)) / MAX_STEP_DEG)
      );
      let prev = latLonToVec3(lat0, lon0, radius);
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const next = latLonToVec3(lat0 + dLat * t, lon0 + dLon * t, radius);
        points.push(prev, next);
        prev = next;
      }
    }
  }

  return new THREE.BufferGeometry().setFromPoints(points);
}
