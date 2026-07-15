import * as THREE from 'three';
import { mesh } from 'topojson-client';
import world from 'world-atlas/countries-110m.json';

// Same lat/lon -> scene mapping we'll use for ECEF in Phase 3:
// scene.x = cos(lat)cos(lon), scene.y = sin(lat), scene.z = -cos(lat)sin(lon)
function latLonToVec3(latDeg, lonDeg, radius) {
  const lat = THREE.MathUtils.degToRad(latDeg);
  const lon = THREE.MathUtils.degToRad(lonDeg);
  return new THREE.Vector3(
    radius * Math.cos(lat) * Math.cos(lon),
    radius * Math.sin(lat),
    -radius * Math.cos(lat) * Math.sin(lon)
  );
}

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
