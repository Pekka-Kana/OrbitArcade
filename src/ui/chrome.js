import './chrome.css';

// Score-style arcade chrome: top bar + INSERT COIN easter egg
export function createChrome() {
  const topbar = document.createElement('div');
  topbar.id = 'topbar';

  const title = document.createElement('span');
  title.textContent = 'ORBITAL ARCADE';
  const status = document.createElement('span');
  status.id = 'status';
  status.textContent = '● TRACKING';
  const tracked = document.createElement('span');
  tracked.textContent = 'OBJECTS TRACKED: ----';

  topbar.append(title, status, tracked);
  document.body.appendChild(topbar);

/*const coin = document.createElement('div');
  coin.id = 'insert-coin';
  coin.textContent = 'INSERT COIN';
  document.body.appendChild(coin);

  let credits = 0;
  let audioCtx = null;
  coin.addEventListener('click', () => {
    credits += 1;
    coin.textContent = `CREDIT ${credits}`;
    try {
      // Classic two-tone coin chime
      audioCtx ??= new AudioContext();
      const t = audioCtx.currentTime;
      for (const [freq, at] of [[988, 0], [1319, 0.09]]) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.03, t + at);
        gain.gain.exponentialRampToValueAtTime(0.001, t + at + 0.15);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(t + at);
        osc.stop(t + at + 0.16);
      }
    } catch {
      /* audio blocked — silent coin */
//   }
//  });

  function setTrackedCount(n) {
    tracked.textContent = `OBJECTS TRACKED: ${String(n).padStart(4, '0')}`;
  }

  return { setTrackedCount };
}
