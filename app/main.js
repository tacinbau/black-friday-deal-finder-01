// DealHound: a Black Friday deal finder. The deals live in data.js, so the
// site needs no network to show them; each deal links out to its store.
//
//   #/            the board: search, filters, sort, cross-store comparison
//   #/deal/<id>   one deal, with its verdict evidence
//
// window.__shotReady is false while a page renders and true once it is on
// screen, so a screenshot script knows when to capture.

import { deals, comparisons } from './data.js';
import { applyFilters, cardHtml, dealPage, listPage, missingPage } from './views.js';

const app = document.getElementById('app');

function readState() {
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  return {
    q: params.get('q') || '',
    cat: params.get('cat') || '',
    store: params.get('store') || '',
    minoff: params.get('minoff') || '',
    sort: params.get('sort') || 'off',
  };
}

function writeState(state) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(state)) if (v) params.set(k, v);
  const query = params.toString();
  const next = '#/' + (query ? '?' + query : '');
  history.replaceState(null, '', next);
}

function render() {
  window.__shotReady = false;
  const match = location.hash.match(/^#\/deal\/([^/?]+)/);
  if (match) {
    const found = deals.find((d) => d.id === decodeURIComponent(match[1]));
    document.title = `${found ? found.title : 'Not found'} | DealHound`;
    app.innerHTML = found ? dealPage(found, comparisons) : missingPage();
  } else {
    const state = readState();
    document.title = 'DealHound — Black Friday 2026, checked today';
    app.innerHTML = listPage(deals, comparisons, state);
    const shown = applyFilters(deals, state);
    const count = document.getElementById('count');
    if (count) count.textContent = `Showing ${shown.length} of ${deals.length} deals.`;
    const form = document.getElementById('filters');
    if (form) {
      form.addEventListener('input', () => {
        const next = {
          q: document.getElementById('q').value,
          cat: document.getElementById('cat').value,
          store: document.getElementById('store').value,
          minoff: document.getElementById('minoff').value,
          sort: document.getElementById('sort').value,
        };
        writeState(next);
        const grid = document.getElementById('grid');
        const list = applyFilters(deals, next);
        grid.innerHTML = list.length === 0
          ? '<li class="empty">No deal matches those filters. <button type="button" id="clear">Clear the filters</button></li>'
          : list.map((d) => `<li>${cardHtml(d)}</li>`).join('');
        const c = document.getElementById('count');
        if (c) c.textContent = `Showing ${list.length} of ${deals.length} deals.`;
        const clear = document.getElementById('clear');
        if (clear) clear.addEventListener('click', () => render());
      });
      form.addEventListener('submit', (e) => e.preventDefault());
    }
    const clear0 = document.getElementById('clear');
    if (clear0) clear0.addEventListener('click', () => render());
  }
  window.scrollTo(0, 0);
  window.__shotReady = true;
}

window.addEventListener('hashchange', render);
render();
