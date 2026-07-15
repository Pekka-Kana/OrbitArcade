import * as THREE from 'three';
import { createBordersGeometry } from './borders.js';

// 1 scene unit = 1000 km (see plan §4) → Earth radius ≈ 6.371 units
export const EARTH_RADIUS = 6.371;

const EARTH_COLOR = 0x00ff66;

// Lines on the far side of the globe render at this fraction of their
// front-side opacity, so the near hemisphere reads clearly
const BACKSIDE_OPACITY_SCALE = 0.18;

// Draw the same line geometry twice: full opacity where it survives the
// normal depth test (near hemisphere), dimmed where it lies behind the
// depth-only occluder sphere (far hemisphere).
function addDualPassLines(group, geometry, color, opacity) {
  const front = new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({ color, transparent: true, opacity })
  );
  const back = new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: opacity * BACKSIDE_OPACITY_SCALE,
      depthFunc: THREE.GreaterDepth,
      depthWrite: false,
    })
  );
  group.add(front, back);
}

export function createEarth() {
  const group = new THREE.Group();

  // Invisible sphere that only writes to the depth buffer; everything
  // behind it fails the normal depth test and falls into the dim pass.
  // Must sit below ~0.990R: the icosahedron's ~16° edge chords sag that
  // deep at their midpoints, and they have to stay in front of it.
  const occluder = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_RADIUS * 0.985, 48, 32),
    new THREE.MeshBasicMaterial({ colorWrite: false })
  );
  occluder.renderOrder = -1;
  group.add(occluder);

  addDualPassLines(
    group,
    new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(EARTH_RADIUS, 3)),
    EARTH_COLOR,
    0.35
  );
  addDualPassLines(group, createBordersGeometry(EARTH_RADIUS * 1.004), 0xffffff, 0.85);

  return group;
}
