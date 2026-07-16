import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createEarth } from './scene/earth.js';
import { createStarfield } from './scene/starfield.js';
import { createSatellites } from './scene/satellites.js';
import { createIss, ISS_NORAD_ID } from './scene/iss.js';
import { createAsteroids } from './scene/asteroids.js';
import { buildOrbitPath } from './scene/orbitPath.js';
import { buildGroundTrack } from './scene/groundTrack.js';
import { createHud } from './ui/hud.js';
import { createChrome } from './ui/chrome.js';
import { createControlPanel } from './ui/controls.js';
import { createCrt } from './fx/crt.js';
import { fetchSatelliteData } from './data/celestrak.js';
import { fetchNeoData } from './data/neows.js';
import { buildSatrec, gstime } from './orbits/propagate.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 5, 18);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 8;
controls.maxDistance = 80;

const earth = createEarth();
scene.add(earth);
scene.add(createStarfield());

// Simulation clock: real time by default. TIME_WARP > 1 fast-forwards
// (positions stay real for the displayed sim time; slider comes in Phase 6).
// Declared before the data load so the propagation worker gets the same
// clock anchor the render loop uses.
const TIME_WARP = 1;
const simStartMs = Date.now();

// Satellites live in the inertial (ECI) frame at scene root; the Earth
// group spins beneath them by GMST. Loaded async so the globe renders
// immediately while CelesTrak data arrives.
// NEO radar ring: close-approach asteroids on an outer dial (Phase 6)
let asteroids = null;
fetchNeoData().then((neos) => {
  asteroids = createAsteroids(neos);
  scene.add(asteroids.group);
  console.log(`[orbital-arcade] NEO ring: ${neos.length} close approaches`);
});

let satellites = null;
let iss = null;

// Top-bar counter reflects only currently-shown objects (filters + ISS)
function updateTrackedCount() {
  const satCount = satellites ? satellites.visibleCount() : 0;
  chrome.setTrackedCount(satCount + (iss ? 1 : 0));
}

fetchSatelliteData().then((ommData) => {
  const records = ommData.map((omm) => ({ omm }));
  // The ISS gets its own wireframe model instead of an instanced blip;
  // its satrec lives on the main thread (it's one cheap propagation)
  const issIdx = records.findIndex((s) => s.omm.NORAD_CAT_ID === ISS_NORAD_ID);
  if (issIdx !== -1) {
    const issSat = records.splice(issIdx, 1)[0];
    issSat.satrec = buildSatrec(issSat.omm);
    if (issSat.satrec) {
      iss = createIss(issSat);
      scene.add(iss.group);
    }
  }
  satellites = createSatellites(records, { simStartMs, timeWarp: TIME_WARP });
  scene.add(satellites.group);
  updateTrackedCount();
  console.log(`[orbital-arcade] tracking ${records.length} objects + ISS`);

  createControlPanel({
    families: satellites.familyInfo(),
    onToggleFamily: (family, visible) => {
      satellites.setFamilyVisible(family, visible);
      updateTrackedCount();
      // Selected object vanishing under the filter would strand the HUD
      if (
        !visible &&
        selection?.type === 'sat' &&
        satellites.getFamily(selection.index) === family
      ) {
        deselect();
      }
    },
    search: (query) => {
      const q = query.toUpperCase();
      const matches = [];
      if (iss && iss.sat.omm.OBJECT_NAME.toUpperCase().includes(q)) {
        matches.push({ id: 'iss', name: iss.sat.omm.OBJECT_NAME });
      }
      const list = satellites.sats;
      for (let i = 0; i < list.length && matches.length < 8; i++) {
        const name = list[i].omm.OBJECT_NAME || '';
        if (name.toUpperCase().includes(q)) matches.push({ id: i, name });
      }
      return matches;
    },
    onPick: (id) => (id === 'iss' ? selectIss() : selectSat(id)),
  });
});

// ---- CRT post-processing + arcade chrome (Phase 5) ----

const crt = createCrt(renderer, scene, camera);
const chrome = createChrome();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  crt.setSize(window.innerWidth, window.innerHeight);
});

// ---- Picking + HUD (Phase 4) ----

const hud = createHud();

const HIGHLIGHT_MATERIAL = new THREE.LineBasicMaterial({ color: 0xffffff });
const PICK_RADIUS_PX = 14;

let selection = null;

const _proj = new THREE.Vector3();

function pickAt(clientX, clientY) {
  const ndcX = (clientX / window.innerWidth) * 2 - 1;
  const ndcY = -(clientY / window.innerHeight) * 2 + 1;
  // ISS first — it's the biggest object in the sky
  if (iss && iss.group.visible) {
    const inFront =
      _proj.copy(iss.group.position).applyMatrix4(camera.matrixWorldInverse).z < 0;
    if (inFront) {
      _proj.copy(iss.group.position).project(camera);
      const dx = ((_proj.x - ndcX) * window.innerWidth) / 2;
      const dy = ((_proj.y - ndcY) * window.innerHeight) / 2;
      if (dx * dx + dy * dy < 22 * 22) return { type: 'iss' };
    }
  }
  if (satellites) {
    const index = satellites.pick(ndcX, ndcY, camera, PICK_RADIUS_PX);
    if (index !== -1) return { type: 'sat', index };
  }
  if (asteroids) {
    const index = asteroids.pick(ndcX, ndcY, camera, PICK_RADIUS_PX);
    if (index !== -1) return { type: 'neo', index };
  }
  return null;
}

function selectNeo(index) {
  deselect();
  asteroids.setSelected(index);
  selection = { type: 'neo' };
  hud.showNeo(asteroids.neos[index]);
}

function selectSat(index) {
  deselect();
  const sat = satellites.sats[index];
  // Worker owns the bulk satrecs; build this one on demand for HUD/orbit
  sat.satrec ??= buildSatrec(sat.omm);
  if (!sat.satrec) return;
  satellites.setSelected(index);
  const periodMin = 1440 / sat.omm.MEAN_MOTION;
  const orbitLine = buildOrbitPath(sat.satrec, simDate, periodMin);
  scene.add(orbitLine);
  // Ground track is a child of the rotating Earth: pinned to continents
  const groundTrack = buildGroundTrack(sat.satrec, simDate, periodMin);
  earth.add(groundTrack);
  selection = { type: 'sat', index, orbitLine, groundTrack };
  hud.show(sat, simDate);
}

function selectIss() {
  deselect();
  const sat = iss.sat;
  const restore = [];
  iss.group.traverse((o) => {
    if (o.isLine) {
      restore.push({ o, material: o.material });
      o.material = HIGHLIGHT_MATERIAL;
    }
  });
  const periodMin = 1440 / sat.omm.MEAN_MOTION;
  const orbitLine = buildOrbitPath(sat.satrec, simDate, periodMin);
  scene.add(orbitLine);
  const groundTrack = buildGroundTrack(sat.satrec, simDate, periodMin);
  earth.add(groundTrack);
  selection = { type: 'iss', restore, orbitLine, groundTrack };
  hud.show(sat, simDate);
}

function deselect() {
  if (!selection) return;
  if (selection.type === 'sat') satellites.setSelected(-1);
  else if (selection.type === 'neo') asteroids.setSelected(-1);
  else for (const { o, material } of selection.restore) o.material = material;
  if (selection.orbitLine) {
    scene.remove(selection.orbitLine);
    selection.orbitLine.geometry.dispose();
    selection.orbitLine.material.dispose();
  }
  if (selection.groundTrack) {
    earth.remove(selection.groundTrack);
    selection.groundTrack.geometry.dispose();
    selection.groundTrack.material.dispose();
  }
  selection = null;
  hud.hide();
}

// Distinguish a click from an OrbitControls drag by pointer travel
const downPos = { x: 0, y: 0 };
renderer.domElement.addEventListener('pointerdown', (e) => {
  downPos.x = e.clientX;
  downPos.y = e.clientY;
  recentering = false; // a new drag/pan cancels an in-flight re-center
});
renderer.domElement.addEventListener('pointerup', (e) => {
  if (Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 6) return;
  const hit = pickAt(e.clientX, e.clientY);
  if (hit?.type === 'iss') selectIss();
  else if (hit?.type === 'sat') selectSat(hit.index);
  else if (hit?.type === 'neo') selectNeo(hit.index);
  else deselect();
});

// Double-click smoothly returns the orbit target to Earth's center, undoing
// any pan drift. The dblclick fires after its two pointerups, so the
// pointerdown cancel above doesn't fight it.
const ORIGIN = new THREE.Vector3(0, 0, 0);
const RECENTER_LERP = 0.12;
let recentering = false;
renderer.domElement.addEventListener('dblclick', () => {
  recentering = true;
});

function updateRecenter() {
  if (!recentering) return;
  controls.target.lerp(ORIGIN, RECENTER_LERP);
  if (controls.target.lengthSq() < 1e-6) {
    controls.target.copy(ORIGIN);
    recentering = false;
  }
}

// ---- Attract mode: after 30s idle, auto-rotate and tour random objects ----

const ATTRACT_IDLE_MS = 30000;
const ATTRACT_CYCLE_MS = 8000;
let lastActivity = performance.now();
let lastAttractCycle = 0;
let attract = false;

for (const ev of ['pointerdown', 'wheel', 'keydown']) {
  window.addEventListener(ev, () => {
    lastActivity = performance.now();
    if (attract) {
      attract = false;
      controls.autoRotate = false;
      deselect();
    }
  });
}

function attractCycle() {
  lastAttractCycle = performance.now();
  const poolSize = (satellites ? satellites.sats.length : 0) + (iss ? 1 : 0);
  if (!poolSize) return;
  // Retry a few times so the tour skips filtered-out families
  for (let tries = 0; tries < 25; tries++) {
    const pickIdx = Math.floor(Math.random() * poolSize);
    if (satellites && pickIdx < satellites.sats.length) {
      if (!satellites.isIndexVisible(pickIdx)) continue;
      selectSat(pickIdx);
      return;
    }
    if (iss) {
      selectIss();
      return;
    }
  }
}

function updateAttract() {
  const now = performance.now();
  if (!attract) {
    if (now - lastActivity > ATTRACT_IDLE_MS) {
      attract = true;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.6;
      attractCycle();
    }
    return;
  }
  if (now - lastAttractCycle > ATTRACT_CYCLE_MS) attractCycle();
}

const timer = new THREE.Timer();
let simDate = new Date();

renderer.setAnimationLoop(() => {
  timer.update();
  simDate = new Date(simStartMs + timer.getElapsed() * 1000 * TIME_WARP);
  // Greenwich Mean Sidereal Time: the physically correct spin, and it
  // aligns the ECEF-frame borders with the ECI-frame satellites
  earth.rotation.y = gstime(simDate);
  if (satellites) satellites.update(simDate);
  if (iss) iss.update(simDate);
  if (asteroids) asteroids.update(timer.getElapsed());
  hud.update(simDate);
  updateAttract();
  updateRecenter();
  controls.update();
  crt.render(timer.getElapsed());
});
