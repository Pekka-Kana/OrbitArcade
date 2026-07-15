import * as THREE from 'three';
import { latLonToVec3 } from '../orbits/coords.js';
import { getState, gstime, eciToGeodetic } from '../orbits/propagate.js';
import { EARTH_RADIUS } from './earth.js';

const SAMPLES_PER_REV = 90;
const REVOLUTIONS = 2.5;
const TRACK_RADIUS = EARTH_RADIUS * 1.006; // above the borders (1.004)
const TRACK_COLOR = 0x00ffcc;

// Sub-satellite path for the next few revolutions, in the EARTH-FIXED
// frame. Must be added to the rotating Earth group: there it stays pinned
// to the continents and shows the classic westward-marching sinusoid
// (the inertial-frame orbit line shows the same motion from space).
export function buildGroundTrack(satrec, fromDate, periodMin) {
  const points = [];
  const total = Math.round(SAMPLES_PER_REV * REVOLUTIONS);
  for (let i = 0; i <= total; i++) {
    const date = new Date(
      fromDate.getTime() + (i / SAMPLES_PER_REV) * periodMin * 60000
    );
    const pv = getState(satrec, date);
    if (!pv) continue;
    const geo = eciToGeodetic(pv.position, gstime(date));
    points.push(
      latLonToVec3(
        THREE.MathUtils.radToDeg(geo.latitude),
        THREE.MathUtils.radToDeg(geo.longitude),
        TRACK_RADIUS
      )
    );
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: TRACK_COLOR,
    transparent: true,
    opacity: 0.9,
  });
  return new THREE.Line(geometry, material);
}
