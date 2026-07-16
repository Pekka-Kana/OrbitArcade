import * as THREE from 'three';
import { classify, getFamilyGeometry, getFamilyColor } from './satModels.js';

// Scalable satellite renderer: one instanced-line draw call per family,
// positions from a Web Worker running SGP4 (4 Hz), extrapolated between
// worker ticks using the velocities. Handles 10k+ objects.

const TICK_MS = 250;
const EARTH_OCCLUSION_RADIUS = 6.3; // slightly under Earth radius: limb-safe

const instancedVertexShader = /* glsl */ `
  attribute vec3 aOffset;
  attribute vec4 aQuat;

  vec3 quatRotate(vec4 q, vec3 v) {
    return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
  }

  void main() {
    vec3 p = quatRotate(aQuat, position) + aOffset;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const instancedFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  void main() {
    gl_FragColor = vec4(uColor, uOpacity);
  }
`;

// sats: [{ omm }] — satrecs live in the worker; the main thread only
// builds one lazily when an object is selected (HUD/orbit path)
export function createSatellites(sats, { simStartMs, timeWarp }) {
  const group = new THREE.Group();
  const n = sats.length;

  // Partition into families, each rendered as one instanced draw
  const familyOf = new Array(n);
  const slotOf = new Uint32Array(n);
  const members = new Map(); // family -> sat indices
  sats.forEach((sat, i) => {
    const family = classify(sat.omm);
    familyOf[i] = family;
    let list = members.get(family);
    if (!list) members.set(family, (list = []));
    slotOf[i] = list.length;
    list.push(i);
  });

  const attrsOf = new Map(); // family -> { aOffset, aQuat }
  const familyObjects = new Map(); // family -> LineSegments
  const hiddenFamilies = new Set();
  for (const [family, list] of members) {
    const base = getFamilyGeometry(family);
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setAttribute('position', base.getAttribute('position'));
    geometry.instanceCount = list.length;
    // aOffset starts at the origin — inside the Earth, i.e. hidden —
    // until the first worker batch arrives
    const aOffset = new THREE.InstancedBufferAttribute(
      new Float32Array(list.length * 3),
      3
    ).setUsage(THREE.DynamicDrawUsage);
    const aQuat = new THREE.InstancedBufferAttribute(
      new Float32Array(list.length * 4),
      4
    ).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aOffset', aOffset);
    geometry.setAttribute('aQuat', aQuat);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(getFamilyColor(family)) },
        uOpacity: { value: 0.95 },
      },
      vertexShader: instancedVertexShader,
      fragmentShader: instancedFragmentShader,
      transparent: true,
    });

    const obj = new THREE.LineSegments(geometry, material);
    obj.frustumCulled = false; // instances span the whole sky
    group.add(obj);
    attrsOf.set(family, { aOffset, aQuat });
    familyObjects.set(family, obj);
  }

  // ---- Worker propagation ----
  const worker = new Worker(
    new URL('../orbits/propagator.worker.js', import.meta.url),
    { type: 'module' }
  );
  worker.postMessage({
    type: 'init',
    omms: sats.map((s) => s.omm),
    simStartMs,
    epochRealMs: Date.now(),
    timeWarp,
    tickMs: TICK_MS,
  });
  let batch = null; // { simMs, pos, vel } in ECI km / km/s
  worker.onmessage = (e) => {
    batch = e.data;
  };

  // Latest scene-space positions, for picking (NaN x = hidden)
  const scenePos = new Float32Array(n * 3).fill(NaN);

  // Selection overlay: a white non-instanced copy of the family model
  const overlayMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
  let selectedIndex = -1;
  let overlay = null;

  function setSelected(index) {
    if (overlay) {
      group.remove(overlay);
      overlay = null;
    }
    selectedIndex = index;
    if (index >= 0) {
      overlay = new THREE.LineSegments(
        getFamilyGeometry(familyOf[index]),
        overlayMaterial
      );
      overlay.frustumCulled = false;
      group.add(overlay);
    }
  }

  const _x = new THREE.Vector3();
  const _y = new THREE.Vector3();
  const _z = new THREE.Vector3();
  const _m = new THREE.Matrix4();
  const _q = new THREE.Quaternion();

  function update(simDate) {
    if (!batch) return;
    const dt = (simDate.getTime() - batch.simMs) / 1000;
    const { pos, vel } = batch;

    for (let i = 0; i < n; i++) {
      const j = i * 3;
      const attrs = attrsOf.get(familyOf[i]);
      const slot = slotOf[i];
      if (Number.isNaN(pos[j])) {
        // Decayed/bad — park at the origin (occluded by the globe)
        attrs.aOffset.array[slot * 3] = 0;
        attrs.aOffset.array[slot * 3 + 1] = 0;
        attrs.aOffset.array[slot * 3 + 2] = 0;
        scenePos[j] = NaN;
        continue;
      }
      // Extrapolate in ECI km, then map to scene: (x, y, z) -> (x, z, -y) / 1000
      const ex = pos[j] + vel[j] * dt;
      const ey = pos[j + 1] + vel[j + 1] * dt;
      const ez = pos[j + 2] + vel[j + 2] * dt;
      const sx = ex / 1000;
      const sy = ez / 1000;
      const sz = -ey / 1000;
      scenePos[j] = sx;
      scenePos[j + 1] = sy;
      scenePos[j + 2] = sz;

      // Orientation: +Z along velocity, +Y away from Earth (same
      // convention the per-object models used)
      _z.set(vel[j] / 1000, vel[j + 2] / 1000, -vel[j + 1] / 1000).normalize();
      _y.set(sx, sy, sz).normalize();
      _x.crossVectors(_y, _z).normalize();
      _y.crossVectors(_z, _x);
      _m.makeBasis(_x, _y, _z);
      _q.setFromRotationMatrix(_m);

      attrs.aOffset.array[slot * 3] = sx;
      attrs.aOffset.array[slot * 3 + 1] = sy;
      attrs.aOffset.array[slot * 3 + 2] = sz;
      attrs.aQuat.array[slot * 4] = _q.x;
      attrs.aQuat.array[slot * 4 + 1] = _q.y;
      attrs.aQuat.array[slot * 4 + 2] = _q.z;
      attrs.aQuat.array[slot * 4 + 3] = _q.w;

      if (i === selectedIndex && overlay) {
        overlay.position.set(sx, sy, sz);
        overlay.quaternion.copy(_q);
      }
    }

    for (const { aOffset, aQuat } of attrsOf.values()) {
      aOffset.needsUpdate = true;
      aQuat.needsUpdate = true;
    }
  }

  // ---- Screen-space picking (raycasting doesn't see custom instancing) ----

  function isOccludedByEarth(cam, px, py, pz) {
    const dx = px - cam.x;
    const dy = py - cam.y;
    const dz = pz - cam.z;
    const len = Math.hypot(dx, dy, dz);
    const tc = -(cam.x * dx + cam.y * dy + cam.z * dz) / len;
    if (tc <= 0 || tc >= len) return false;
    const d2 = cam.x * cam.x + cam.y * cam.y + cam.z * cam.z - tc * tc;
    return d2 < EARTH_OCCLUSION_RADIUS * EARTH_OCCLUSION_RADIUS;
  }

  const _vp = new THREE.Matrix4();
  const _p = new THREE.Vector3();
  const _fwd = new THREE.Vector3();

  // Nearest visible object within thresholdPx of the pointer, or -1
  function pick(ndcX, ndcY, camera, thresholdPx) {
    _vp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    camera.getWorldDirection(_fwd);
    const cam = camera.position;
    const halfW = window.innerWidth / 2;
    const halfH = window.innerHeight / 2;
    let best = -1;
    let bestD2 = thresholdPx * thresholdPx;
    for (let i = 0; i < n; i++) {
      if (hiddenFamilies.has(familyOf[i])) continue;
      const j = i * 3;
      const sx = scenePos[j];
      if (Number.isNaN(sx)) continue;
      const sy = scenePos[j + 1];
      const sz = scenePos[j + 2];
      // Behind-camera check before the perspective divide flips signs
      const rx = sx - cam.x;
      const ry = sy - cam.y;
      const rz = sz - cam.z;
      if (rx * _fwd.x + ry * _fwd.y + rz * _fwd.z <= 0) continue;
      _p.set(sx, sy, sz).applyMatrix4(_vp);
      const dx = (_p.x - ndcX) * halfW;
      const dy = (_p.y - ndcY) * halfH;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2 && !isOccludedByEarth(cam, sx, sy, sz)) {
        bestD2 = d2;
        best = i;
      }
    }
    return best;
  }

  // ---- Family filtering ----

  function setFamilyVisible(family, visible) {
    const obj = familyObjects.get(family);
    if (!obj) return;
    obj.visible = visible;
    if (visible) hiddenFamilies.delete(family);
    else hiddenFamilies.add(family);
  }

  // For the filter panel: one row per family, biggest first
  function familyInfo() {
    return [...members.entries()]
      .map(([family, list]) => ({ family, count: list.length }))
      .sort((a, b) => b.count - a.count);
  }

  // Count of currently-shown objects (excludes filtered-out families)
  function visibleCount() {
    let total = 0;
    for (const [family, list] of members) {
      if (!hiddenFamilies.has(family)) total += list.length;
    }
    return total;
  }

  const getFamily = (i) => familyOf[i];
  const isIndexVisible = (i) => !hiddenFamilies.has(familyOf[i]);

  return {
    group,
    update,
    pick,
    setSelected,
    sats,
    setFamilyVisible,
    familyInfo,
    visibleCount,
    getFamily,
    isIndexVisible,
  };
}
