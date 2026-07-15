import * as THREE from 'three';
import { eciToScene } from '../orbits/coords.js';
import { getState } from '../orbits/propagate.js';

const SAMPLES = 180;

// One full revolution starting at fromDate, as an ECI-frame line.
// periodMin comes from the OMM data: 1440 / MEAN_MOTION.
export function buildOrbitPath(satrec, fromDate, periodMin, color = 0xffffff) {
  const points = [];
  const v = new THREE.Vector3();
  for (let i = 0; i <= SAMPLES; i++) {
    const date = new Date(fromDate.getTime() + (i / SAMPLES) * periodMin * 60000);
    const pv = getState(satrec, date);
    if (!pv) continue;
    points.push(eciToScene(pv.position, v).clone());
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.45,
  });
  return new THREE.Line(geometry, material);
}
