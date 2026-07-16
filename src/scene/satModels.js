import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Wireframe model per satellite family. All models are built with +Z as
// the direction of flight and are hugely exaggerated in size (the real
// objects are meters long; 0.1 scene units = 100 km) — arcade style.

function edges(geometry) {
  const e = new THREE.EdgesGeometry(geometry);
  geometry.dispose();
  return e;
}

function lines(points) {
  return new THREE.BufferGeometry().setFromPoints(points);
}

// Spent upper stage: tube + nozzle, flying nose-first
function buildRocketBody() {
  const body = edges(new THREE.CylinderGeometry(0.028, 0.028, 0.16, 8));
  const nozzle = edges(new THREE.CylinderGeometry(0.01, 0.024, 0.045, 8));
  nozzle.translate(0, -0.1, 0);
  const g = mergeGeometries([body, nozzle], false);
  g.rotateX(Math.PI / 2);
  return g;
}

// Classic comsat: box bus + two solar panels
function buildPayload() {
  const bus = edges(new THREE.BoxGeometry(0.05, 0.05, 0.08));
  const panelL = edges(new THREE.PlaneGeometry(0.06, 0.045));
  panelL.rotateX(-Math.PI / 2);
  panelL.translate(-0.062, 0, 0);
  const panelR = panelL.clone();
  panelR.translate(0.124, 0, 0);
  return mergeGeometries([bus, panelL, panelR], false);
}

// Soviet-era look: faceted ball trailing whip antennas
function buildCosmos() {
  const ball = edges(new THREE.IcosahedronGeometry(0.04, 0));
  const whiskers = lines([
    new THREE.Vector3(0.025, 0, -0.025), new THREE.Vector3(0.06, 0, -0.095),
    new THREE.Vector3(-0.025, 0, -0.025), new THREE.Vector3(-0.06, 0, -0.095),
    new THREE.Vector3(0, 0.025, -0.025), new THREE.Vector3(0, 0.06, -0.095),
    new THREE.Vector3(0, -0.025, -0.025), new THREE.Vector3(0, -0.06, -0.095),
  ]);
  return mergeGeometries([ball, whiskers], false);
}

// AST SpaceMobile BlueBird: one huge flat phased-array sheet with a grid
function buildSpaceMobile() {
  const half = 0.065;
  const third = half * (2 / 3);
  const outline = edges(new THREE.PlaneGeometry(half * 2, half * 2));
  const grid = lines([
    new THREE.Vector3(-third, -half, 0), new THREE.Vector3(-third, half, 0),
    new THREE.Vector3(third, -half, 0), new THREE.Vector3(third, half, 0),
    new THREE.Vector3(-half, -third, 0), new THREE.Vector3(half, -third, 0),
    new THREE.Vector3(-half, third, 0), new THREE.Vector3(half, third, 0),
  ]);
  const g = mergeGeometries([outline, grid], false);
  g.rotateX(-Math.PI / 2); // face the Earth
  return g;
}

// Telescope tube with side-mounted panels
function buildHubble() {
  const tube = edges(new THREE.CylinderGeometry(0.03, 0.03, 0.13, 8));
  const panelL = edges(new THREE.PlaneGeometry(0.045, 0.075));
  panelL.translate(-0.065, 0, 0);
  const panelR = panelL.clone();
  panelR.translate(0.13, 0, 0);
  const g = mergeGeometries([tube, panelL, panelR], false);
  g.rotateX(Math.PI / 2);
  return g;
}

// Starlink v2-mini: flat chassis with one big solar wing trailing behind
function buildStarlink() {
  const bus = edges(new THREE.BoxGeometry(0.05, 0.008, 0.035));
  const wing = edges(new THREE.PlaneGeometry(0.045, 0.11));
  wing.rotateX(-Math.PI / 2); // flat, same plane as the bus
  wing.translate(0, 0, -0.085);
  return mergeGeometries([bus, wing], false);
}

// Tiangong: T-shaped module cross, big wing pair — a mini anti-ISS
function buildStation() {
  const core = edges(new THREE.CylinderGeometry(0.018, 0.018, 0.16, 6));
  const cross = edges(new THREE.CylinderGeometry(0.018, 0.018, 0.1, 6));
  cross.rotateZ(Math.PI / 2);
  cross.translate(0, 0.035, 0);
  const panelL = edges(new THREE.PlaneGeometry(0.1, 0.035));
  panelL.translate(-0.1, 0.035, 0);
  const panelR = panelL.clone();
  panelR.translate(0.2, 0, 0);
  const g = mergeGeometries([core, cross, panelL, panelR], false);
  g.rotateX(Math.PI / 2);
  return g;
}

// OneWeb: small bus with one deployed solar panel
function buildOneWeb() {
  const bus = edges(new THREE.BoxGeometry(0.03, 0.03, 0.04));
  const panel = edges(new THREE.PlaneGeometry(0.03, 0.09));
  panel.rotateX(-Math.PI / 2);
  panel.translate(0, 0, -0.07);
  return mergeGeometries([bus, panel], false);
}

// GNSS navsat (GPS / Galileo / BeiDou): boxy bus with two long panels
function buildNavsat() {
  const bus = edges(new THREE.BoxGeometry(0.04, 0.04, 0.05));
  const panelL = edges(new THREE.PlaneGeometry(0.11, 0.04));
  panelL.rotateX(-Math.PI / 2);
  panelL.translate(-0.08, 0, 0);
  const panelR = panelL.clone();
  panelR.translate(0.16, 0, 0);
  return mergeGeometries([bus, panelL, panelR], false);
}

// Iridium: triangular bus trailing a single panel
function buildIridium() {
  const bus = edges(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 3));
  bus.rotateX(Math.PI / 2);
  const panel = edges(new THREE.PlaneGeometry(0.03, 0.07));
  panel.rotateX(-Math.PI / 2);
  panel.translate(0, 0.03, -0.06);
  return mergeGeometries([bus, panel], false);
}

// GEO comsat: large box bus with a wide solar wingspan
function buildGeo() {
  const bus = edges(new THREE.BoxGeometry(0.06, 0.06, 0.06));
  const panelL = edges(new THREE.PlaneGeometry(0.13, 0.055));
  panelL.rotateX(-Math.PI / 2);
  panelL.translate(-0.11, 0, 0);
  const panelR = panelL.clone();
  panelR.translate(0.22, 0, 0);
  return mergeGeometries([bus, panelL, panelR], false);
}

const FAMILIES = {
  rocketBody: { color: 0xff7700, build: buildRocketBody },
  payload: { color: 0xffff00, build: buildPayload },
  cosmos: { color: 0xff5555, build: buildCosmos },
  spacemobile: { color: 0xffffff, build: buildSpaceMobile },
  starlink: { color: 0x99aaff, build: buildStarlink },
  hubble: { color: 0x00ffff, build: buildHubble },
  station: { color: 0xff00ff, build: buildStation },
  oneweb: { color: 0x2277ff, build: buildOneWeb },
  gps: { color: 0x00ff88, build: buildNavsat },
  galileo: { color: 0xaaff33, build: buildNavsat },
  beidou: { color: 0xff9922, build: buildNavsat },
  iridium: { color: 0xff44aa, build: buildIridium },
  weather: { color: 0x33ccff, build: buildPayload },
  earthobs: { color: 0x00ccaa, build: buildPayload },
  geo: { color: 0x9955ff, build: buildGeo },
};

export function classify(omm) {
  const n = omm.OBJECT_NAME || '';
  if (/R\/B|CENTAUR|AGENA|SL-\d|DELTA 1/.test(n)) return 'rocketBody';
  if (/^COSMOS/.test(n)) return 'cosmos';
  if (/^SPACEMOBILE/.test(n)) return 'spacemobile';
  if (/^STARLINK/.test(n)) return 'starlink';
  if (/^ONEWEB/.test(n)) return 'oneweb';
  if (/^IRIDIUM/.test(n)) return 'iridium';
  if (/NAVSTAR|GPS BII/.test(n)) return 'gps';
  if (/GSAT|GALILEO/.test(n)) return 'galileo';
  if (/BEIDOU/.test(n)) return 'beidou';
  if (/NOAA|METEOR|METOP|GOES|DMSP|FENGYUN|FY-/.test(n)) return 'weather';
  if (/TERRA|AQUA|LANDSAT|SENTINEL|ALOS|ENVISAT|SPOT|WORLDVIEW|YAOGAN|GAOFEN|RESURS|OKEAN|ERS-/.test(n))
    return 'earthobs';
  if (/HST/.test(n)) return 'hubble';
  if (/CSS|TIANHE|SZ-\d/.test(n)) return 'station';
  // Geostationary belt has no consistent naming — identify it by orbit
  if (omm.MEAN_MOTION > 0.9 && omm.MEAN_MOTION < 1.1 && omm.INCLINATION < 15) return 'geo';
  return 'payload';
}

// Geometry is built once per family and shared by every instance
const geometryCache = new Map();

export function getFamilyGeometry(family) {
  const def = FAMILIES[family] ?? FAMILIES.payload;
  let geometry = geometryCache.get(def);
  if (!geometry) {
    geometry = def.build();
    geometryCache.set(def, geometry);
  }
  return geometry;
}

export function getFamilyColor(family) {
  return (FAMILIES[family] ?? FAMILIES.payload).color;
}
