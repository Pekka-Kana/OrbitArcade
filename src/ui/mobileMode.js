import './mobileMode.css';

// Full mobile mode: on narrow screens the FIND / FILTERS / HUD panels are
// pulled out of their fixed desktop positions and shown as bottom sheets,
// driven by a fixed arcade toolbar. Only one sheet is open at a time.
// Growing the viewport back restores the exact desktop DOM.
const SHEETS = [
  { key: 'find', label: 'FIND', glyph: '⌕' },
  { key: 'filters', label: 'FILTERS', glyph: '▤' },
  { key: 'target', label: 'TARGET', glyph: '◎' },
];

export function createMobileMode({ controlsRoot, finder, filters, hudPanel }) {
  const bar = document.createElement('div');
  bar.id = 'mobile-bar';

  const backdrop = document.createElement('div');
  backdrop.id = 'mobile-backdrop';
  backdrop.addEventListener('pointerdown', () => openSheet(null));

  const sheets = {}; // key -> { el, body, btn }
  let active = null;
  let mobile = false;
  let hasTarget = false;

  for (const { key, label, glyph } of SHEETS) {
    const sheet = document.createElement('div');
    sheet.className = 'sheet';
    sheet.dataset.sheet = key;

    const header = document.createElement('div');
    header.className = 'sheet-header';
    const heading = document.createElement('span');
    heading.textContent = label;
    const close = document.createElement('button');
    close.className = 'sheet-close';
    close.textContent = '▾';
    close.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      openSheet(null);
    });
    header.append(heading, close);

    const body = document.createElement('div');
    body.className = 'sheet-body';
    sheet.append(header, body);
    document.body.appendChild(sheet);

    const btn = document.createElement('button');
    btn.className = 'mobile-btn';
    btn.dataset.sheet = key;
    btn.innerHTML = `<span class="glyph">${glyph}</span><span class="lbl">${label}</span>`;
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (key === 'target' && !hasTarget) return;
      openSheet(active === key ? null : key);
    });
    bar.appendChild(btn);

    sheets[key] = { el: sheet, body, btn };
  }

  document.body.append(backdrop, bar);

  function openSheet(key) {
    active = key;
    backdrop.classList.toggle('open', key !== null);
    for (const k of Object.keys(sheets)) {
      const on = k === key;
      sheets[k].el.classList.toggle('open', on);
      sheets[k].btn.classList.toggle('active', on);
    }
  }

  // Re-parent the panels into (mobile) or out of (desktop) the sheets.
  function apply(isMobile) {
    if (isMobile === mobile) return;
    mobile = isMobile;
    if (isMobile) {
      sheets.find.body.appendChild(finder);
      sheets.filters.body.appendChild(filters);
      sheets.target.body.appendChild(hudPanel);
    } else {
      openSheet(null);
      controlsRoot.append(finder, filters); // restore desktop order
      document.body.appendChild(hudPanel);
    }
  }

  // A selection exists: light up TARGET so it can be re-opened; if it just
  // went away, close the sheet so it doesn't hover empty over the globe.
  function setHasTarget(on) {
    hasTarget = on;
    sheets.target.btn.classList.toggle('enabled', on);
    if (!on && active === 'target') openSheet(null);
  }

  // User tapped an object: surface its HUD immediately.
  function openTarget() {
    if (!mobile) return;
    hasTarget = true;
    sheets.target.btn.classList.add('enabled');
    openSheet('target');
  }

  return { apply, setHasTarget, openTarget };
}
