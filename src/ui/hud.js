import './panel.css';
import { getState } from '../orbits/propagate.js';
import { EARTH_RADIUS_KM } from '../orbits/coords.js';

const TYPE_CHARS_PER_FRAME = 1;
const LIVE_REFRESH_MS = 250;

// Arcade tracking panel: types out the target's stats with an 8-bit blip
// per few characters, then keeps ALT/VEL live.
export function createHud() {
  const el = document.createElement('div');
  el.id = 'hud-panel';
  el.hidden = true;
  const pre = document.createElement('pre');
  el.appendChild(pre);
  document.body.appendChild(el);

  let sat = null;
  let fullText = '';
  let shown = 0;
  let typing = false;
  let lastLiveRefresh = 0;
  let audioCtx = null;

  function blip() {
    try {
      audioCtx ??= new AudioContext();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'square';
      osc.frequency.value = 840;
      gain.gain.value = 0.015;
      osc.connect(gain).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.02);
    } catch {
      /* audio blocked — silent HUD is fine */
    }
  }

  function statsText(simDate) {
    const pv = getState(sat.satrec, simDate);
    const alt = pv
      ? Math.hypot(pv.position.x, pv.position.y, pv.position.z) - EARTH_RADIUS_KM
      : NaN;
    const vel = pv
      ? Math.hypot(pv.velocity.x, pv.velocity.y, pv.velocity.z)
      : NaN;
    const period = 1440 / sat.omm.MEAN_MOTION;
    return [
      `OBJECT: ${sat.omm.OBJECT_NAME}`,
      `NORAD ID: ${sat.omm.NORAD_CAT_ID}`,
      `ALT: ${alt.toFixed(1)} KM`,
      `VEL: ${vel.toFixed(2)} KM/S`,
      `INC: ${sat.omm.INCLINATION.toFixed(2)}°`,
      `PERIOD: ${period.toFixed(1)} MIN`,
    ].join('\n');
  }

  function show(nextSat, simDate) {
    sat = nextSat;
    el.hidden = false;
    fullText = statsText(simDate);
    shown = 0;
    typing = true;
  }

  const thousands = (x) =>
    Math.round(x)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  // NEO close-approach card: static text, no live refresh
  function showNeo(neo) {
    sat = null;
    el.hidden = false;
    fullText = [
      `OBJECT: ${neo.name}`,
      `CLASS: NEO${neo.hazardous ? ' — HAZARD' : ''}`,
      `DIAM: ~${thousands(neo.diameterM)} M`,
      `MISS: ${thousands(neo.missKm)} KM`,
      `REL VEL: ${neo.velKmS.toFixed(2)} KM/S`,
      `APPROACH: ${new Date(neo.approachMs).toISOString().slice(0, 16).replace('T', ' ')} UTC`,
    ].join('\n');
    shown = 0;
    typing = true;
  }

  function hide() {
    sat = null;
    el.hidden = true;
  }

  // Called every frame from the render loop
  function update(simDate) {
    if (el.hidden) return;
    if (typing) {
      shown = Math.min(fullText.length, shown + TYPE_CHARS_PER_FRAME);
      pre.textContent =
        fullText.slice(0, shown) + (shown < fullText.length ? '▎' : '');
      if (shown % 6 < TYPE_CHARS_PER_FRAME) blip();
      if (shown >= fullText.length) typing = false;
      return;
    }
    if (!sat) return; // static card (NEO) — nothing to refresh
    const now = performance.now();
    if (now - lastLiveRefresh >= LIVE_REFRESH_MS) {
      lastLiveRefresh = now;
      pre.textContent = statsText(simDate);
    }
  }

  return { show, showNeo, hide, update, panel: el };
}
