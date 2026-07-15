// Deep imports on purpose — see propagate.js: the package root drags in
// a WASM build that breaks Vite's worker bundling
import { json2satrec } from 'satellite.js/dist/io.js';
import { propagate } from 'satellite.js/dist/propagation.js';

// SGP4 for the whole catalog, off the main thread. Every tick it posts
// ECI positions + velocities (km, km/s) as transferable Float32Arrays;
// the main thread extrapolates between ticks using the velocities.

let satrecs = [];
let simStartMs = 0;
let epochRealMs = 0;
let timeWarp = 1;
let timer = 0;

self.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === 'init') {
    satrecs = msg.omms.map((omm) => {
      try {
        return json2satrec(omm);
      } catch {
        return null; // bad record — slot stays, marked NaN each tick
      }
    });
    ({ simStartMs, epochRealMs, timeWarp } = msg);
    clearInterval(timer);
    timer = setInterval(tick, msg.tickMs);
    tick();
  } else if (msg.type === 'sync') {
    // Future time-warp slider: re-anchor the sim clock
    ({ simStartMs, epochRealMs, timeWarp } = msg);
  }
};

function tick() {
  const simMs = simStartMs + (Date.now() - epochRealMs) * timeWarp;
  const date = new Date(simMs);
  const n = satrecs.length;
  const pos = new Float32Array(n * 3);
  const vel = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    let ok = false;
    const satrec = satrecs[i];
    if (satrec) {
      try {
        const pv = propagate(satrec, date);
        if (pv && Number.isFinite(pv.position.x)) {
          pos[i * 3] = pv.position.x;
          pos[i * 3 + 1] = pv.position.y;
          pos[i * 3 + 2] = pv.position.z;
          vel[i * 3] = pv.velocity.x;
          vel[i * 3 + 1] = pv.velocity.y;
          vel[i * 3 + 2] = pv.velocity.z;
          ok = true;
        }
      } catch {
        /* decayed mid-session */
      }
    }
    if (!ok) pos[i * 3] = NaN; // sentinel: hide this object
  }
  postMessage({ simMs, pos, vel }, [pos.buffer, vel.buffer]);
}
