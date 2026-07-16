import './controls.css';
import { getFamilyColor } from '../scene/satModels.js';

const FAMILY_LABELS = {
  starlink: 'STARLINK',
  oneweb: 'ONEWEB',
  geo: 'GEO COMSATS',
  payload: 'PAYLOADS',
  iridium: 'IRIDIUM',
  earthobs: 'EARTH OBS',
  beidou: 'BEIDOU',
  galileo: 'GALILEO',
  gps: 'GPS',
  weather: 'WEATHER',
  cosmos: 'COSMOS',
  spacemobile: 'SPACEMOBILE',
  hubble: 'HUBBLE',
  station: 'STATIONS',
  rocketBody: 'ROCKET BODIES',
};

const MAX_RESULTS = 8;

// Left-side arcade panel: FIND search box + per-family filter toggles.
// search(query) -> [{ id, name }]; onPick(id); onToggleFamily(family, on)
export function createControlPanel({ families, onToggleFamily, search, onPick }) {
  const root = document.createElement('div');
  root.id = 'controls';

  // ---- FIND ----
  const finder = document.createElement('div');
  finder.id = 'finder';
  const finderTitle = document.createElement('div');
  finderTitle.className = 'controls-title';
  finderTitle.textContent = 'FIND';
  const input = document.createElement('input');
  input.id = 'finder-input';
  input.placeholder = 'HUBBLE';
  input.spellcheck = false;
  input.autocomplete = 'off';
  input.maxLength = 30;
  const results = document.createElement('ul');
  results.id = 'finder-results';
  finder.append(finderTitle, input, results);

  function currentMatches() {
    const q = input.value.trim();
    return q.length >= 2 ? search(q).slice(0, MAX_RESULTS) : [];
  }

  function renderResults() {
    results.textContent = '';
    for (const match of currentMatches()) {
      const li = document.createElement('li');
      li.textContent = match.name;
      // pointerdown, not click: fires before the input loses focus
      li.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        choose(match);
      });
      results.appendChild(li);
    }
  }

  function choose(match) {
    onPick(match.id);
    input.value = match.name;
    results.textContent = '';
  }

  input.addEventListener('input', renderResults);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const matches = currentMatches();
      if (matches.length) choose(matches[0]);
    } else if (e.key === 'Escape') {
      input.value = '';
      results.textContent = '';
      input.blur();
    }
  });

  // ---- FILTERS ----
  const filters = document.createElement('div');
  filters.id = 'filters';
  const filtersTitle = document.createElement('div');
  filtersTitle.className = 'controls-title';
  filtersTitle.textContent = 'FILTERS';
  filters.appendChild(filtersTitle);

  for (const { family, count } of families) {
    const row = document.createElement('label');
    row.className = 'filter-row';
    const color = getFamilyColor(family);
    row.style.setProperty('--c', `#${color.toString(16).padStart(6, '0')}`);

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    checkbox.addEventListener('change', () => onToggleFamily(family, checkbox.checked));

    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    const name = document.createElement('span');
    name.textContent = FAMILY_LABELS[family] ?? family.toUpperCase();
    const countEl = document.createElement('span');
    countEl.className = 'count';
    countEl.textContent = count;

    row.append(checkbox, swatch, name, countEl);
    filters.appendChild(row);
  }

  root.append(finder, filters);
  document.body.appendChild(root);
}
