import * as THREE from 'three';

export const KM_PER_UNIT = 1000; // 1 scene unit = 1000 km
export const EARTH_RADIUS_KM = 6371;

// Earth-fixed lat/lon -> scene position (for children of the rotating
// Earth group): x = cos(lat)cos(lon), y = sin(lat), z = -cos(lat)sin(lon)
export function latLonToVec3(latDeg, lonDeg, radius, target = new THREE.Vector3()) {
  const lat = THREE.MathUtils.degToRad(latDeg);
  const lon = THREE.MathUtils.degToRad(lonDeg);
  return target.set(
    radius * Math.cos(lat) * Math.cos(lon),
    radius * Math.sin(lat),
    -radius * Math.cos(lat) * Math.sin(lon)
  );
}

// ECI is Z-up (Z = north pole, X = vernal equinox); the scene is Y-up.
// (x, y, z)_eci -> (x, z, -y)_scene is a -90° rotation about X, so the
// frame stays right-handed and rotations keep their sign. The country
// borders in borders.js use the same mapping for ECEF, so spinning the
// Earth group by GMST lines everything up.
export function eciToScene(posKm, target) {
  return target.set(
    posKm.x / KM_PER_UNIT,
    posKm.z / KM_PER_UNIT,
    -posKm.y / KM_PER_UNIT
  );
}
