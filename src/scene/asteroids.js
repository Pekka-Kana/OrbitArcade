import * as THREE from 'three';

// NEO radar ring (plan §3.2 option A): asteroids are NOT orbiting Earth,
// so no propagation — they're blips drifting along an outer radar ring,
// radius log-scaled by close-approach miss distance.

const RING_MIN = 48;
const RING_MAX = 62;
const RING_COLOR = 0x00ff66;
const NEO_COLOR = 0xaaffcc;
const HAZARD_COLOR = 0xff4444;

// Deterministic 0..1 from an id string
function hash01(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

// The classic Asteroids rock: an irregular 9-gon, flat in the ring plane
function buildRockGeometry() {
  const jitter = [1, 0.78, 0.92, 0.7, 1.05, 0.8, 0.95, 0.72, 0.88];
  const points = jitter.map((j, i) => {
    const a = (i / jitter.length) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(a) * 0.6 * j, 0, Math.sin(a) * 0.6 * j);
  });
  return new THREE.BufferGeometry().setFromPoints(points);
}

// Two faint concentric circles + tick marks: the radar dial
function buildRadarDial() {
  const points = [];
  const SEG = 128;
  for (const r of [RING_MIN, RING_MAX]) {
    for (let i = 0; i < SEG; i++) {
      const a0 = (i / SEG) * Math.PI * 2;
      const a1 = ((i + 1) / SEG) * Math.PI * 2;
      points.push(
        new THREE.Vector3(Math.cos(a0) * r, 0, Math.sin(a0) * r),
        new THREE.Vector3(Math.cos(a1) * r, 0, Math.sin(a1) * r)
      );
    }
  }
  for (let deg = 0; deg < 360; deg += 30) {
    const a = THREE.MathUtils.degToRad(deg);
    points.push(
      new THREE.Vector3(Math.cos(a) * RING_MAX, 0, Math.sin(a) * RING_MAX),
      new THREE.Vector3(Math.cos(a) * (RING_MAX + 1.4), 0, Math.sin(a) * (RING_MAX + 1.4))
    );
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({ color: RING_COLOR, transparent: true, opacity: 0.13 })
  );
}

export function createAsteroids(neos) {
  const group = new THREE.Group();
  group.add(buildRadarDial());

  const rockGeometry = buildRockGeometry();
  const normalMaterial = new THREE.LineBasicMaterial({
    color: NEO_COLOR,
    transparent: true,
    opacity: 0.9,
  });
  const hazardMaterial = new THREE.LineBasicMaterial({
    color: HAZARD_COLOR,
    transparent: true,
    opacity: 0.9,
  });

  const entries = neos.map((neo) => {
    const h = hash01(neo.id);
    // Miss distance 1e5..1e8 km -> ring radius, log scale
    const t = THREE.MathUtils.clamp((Math.log10(neo.missKm) - 5) / 3, 0, 1);
    const radius = RING_MIN + t * (RING_MAX - RING_MIN);
    // Bigger rock for bigger asteroid (5 m .. 2 km across)
    const scale = THREE.MathUtils.clamp(0.3 * Math.log10(neo.diameterM + 1), 0.3, 1.1);
    const obj = new THREE.LineLoop(
      rockGeometry,
      neo.hazardous ? hazardMaterial : normalMaterial
    );
    obj.scale.setScalar(scale);
    group.add(obj);
    return {
      neo,
      obj,
      angle0: h * Math.PI * 2,
      drift: (0.004 + neo.velKmS * 0.0003) * (h < 0.5 ? 1 : -1),
      spin: 0.2 + h * 0.4,
      radius,
      scale,
    };
  });

  // Selection overlay: white copy of the rock
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
      overlay = new THREE.LineLoop(rockGeometry, overlayMaterial);
      overlay.scale.setScalar(entries[index].scale * 1.15);
      group.add(overlay);
    }
  }

  function update(elapsedSec) {
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const angle = e.angle0 + e.drift * elapsedSec;
      e.obj.position.set(Math.cos(angle) * e.radius, 0, Math.sin(angle) * e.radius);
      e.obj.rotation.y = elapsedSec * e.spin;
      if (i === selectedIndex && overlay) {
        overlay.position.copy(e.obj.position);
        overlay.rotation.y = e.obj.rotation.y;
      }
    }
    // Hazardous blips pulse together — very radar
    hazardMaterial.opacity = 0.55 + 0.35 * Math.sin(elapsedSec * 5);
  }

  const _p = new THREE.Vector3();
  const _fwd = new THREE.Vector3();

  function pick(ndcX, ndcY, camera, thresholdPx) {
    camera.getWorldDirection(_fwd);
    const halfW = window.innerWidth / 2;
    const halfH = window.innerHeight / 2;
    let best = -1;
    let bestD2 = thresholdPx * thresholdPx;
    for (let i = 0; i < entries.length; i++) {
      const pos = entries[i].obj.position;
      if (_p.copy(pos).sub(camera.position).dot(_fwd) <= 0) continue;
      _p.copy(pos).project(camera);
      const dx = (_p.x - ndcX) * halfW;
      const dy = (_p.y - ndcY) * halfH;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = i;
      }
    }
    return best;
  }

  return { group, update, pick, setSelected, neos };
}
