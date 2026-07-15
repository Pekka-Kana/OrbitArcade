import * as THREE from 'three';
import { eciToScene } from '../orbits/coords.js';
import { getState } from '../orbits/propagate.js';

export const ISS_NORAD_ID = 25544;

const ISS_COLOR = 0xffff00;

// The real ISS spans ~110 m — invisible at 1 unit = 1000 km. Drawn at
// arcade scale instead: recognizable silhouette over physical truth.
const TRUSS_LENGTH = 0.42;
const PANEL_W = 0.09;
const PANEL_L = 0.16;
const MODULE_LENGTH = 0.26;

function edges(geometry, material) {
  return new THREE.LineSegments(new THREE.EdgesGeometry(geometry), material);
}

function buildModel() {
  const mat = new THREE.LineBasicMaterial({
    color: ISS_COLOR,
    transparent: true,
    opacity: 0.95,
  });
  const model = new THREE.Group();

  // Main truss along X
  const truss = edges(new THREE.BoxGeometry(TRUSS_LENGTH, 0.02, 0.02), mat);
  model.add(truss);

  // Module stack along Z (direction of flight), Zarya-to-Node-2 style
  const modules = edges(new THREE.CylinderGeometry(0.025, 0.025, MODULE_LENGTH, 6), mat);
  modules.rotation.x = Math.PI / 2;
  model.add(modules);

  // Four solar wing pairs: two at each truss end, fore and aft
  for (const sideX of [-1, 1]) {
    for (const sideZ of [-1, 1]) {
      for (const pair of [0, 1]) {
        const panel = edges(new THREE.PlaneGeometry(PANEL_W, PANEL_L), mat);
        panel.rotation.x = -Math.PI / 2; // lie flat in the orbital plane
        panel.position.set(
          sideX * (TRUSS_LENGTH / 2 - pair * (PANEL_W + 0.015) - PANEL_W / 2),
          0,
          sideZ * (PANEL_L / 2 + 0.03)
        );
        model.add(panel);
      }
    }
  }

  return model;
}

export function createIss(sat) {
  const group = new THREE.Group();
  group.userData.sat = sat; // picking: raycast hit -> satellite record
  group.add(buildModel());

  const pos = new THREE.Vector3();
  const vel = new THREE.Vector3();
  const ahead = new THREE.Vector3();

  function update(simDate) {
    const pv = getState(sat.satrec, simDate);
    if (!pv) {
      group.visible = false;
      return;
    }
    group.visible = true;
    eciToScene(pv.position, pos);
    eciToScene(pv.velocity, vel); // same rotation works for vectors
    group.position.copy(pos);
    // Fly modules-first: +Z along velocity, "up" pointing away from Earth
    group.up.copy(pos).normalize();
    ahead.copy(pos).add(vel);
    group.lookAt(ahead);
  }

  update(new Date());
  return { group, update, sat };
}
