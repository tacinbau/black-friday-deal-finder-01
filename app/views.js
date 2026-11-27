// HTML for DealHound's pages, built from the deal data. Every value is
// escaped before it goes into the page, and every number is computed from
// the data, never typed twice.

const escape = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const usd = (n) => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;
const percentOff = (d) => Math.round((1 - d.price / d.was) * 100);
const saved = (d) => d.was - d.price;
const day = (iso) => new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC';

export const VERDICTS = {
  'new-low': { label: 'NEW LOW', hint: 'Lowest price a source has seen for this item.' },
  strong: { label: 'STRONG DEAL', hint: '40% or more off the usual price.' },
  good: { label: 'GOOD DEAL', hint: '25\u201339% off the usual price.' },
  routine: { label: 'ROUTINE SALE', hint: 'Under 25% off: a real cut, but not a special one.' },
};

export function verdictBadge(d) {
  const v = VERDICTS[d.verdict] || VERDICTS.routine;
  return `<span class="badge badge-${d.verdict}" title="${escape(v.hint)}">${v.label}</span>`;
}

export function cardHtml(d) {
  return `<article class="card">
  <div class="card-top"><span class="store">${escape(d.store)}</span><span class="cat">${escape(d.category)}</span></div>
  <h2><a href="#/deal/${encodeURIComponent(d.id)}">${escape(d.title)}</a></h2>
  <p class="price-row"><span class="price">${usd(d.price)}</span> <s class="was">${usd(d.was)}</s> <span class="off">${percentOff(d)}% off</span></p>
  <p class="saved">You save ${usd(saved(d))}</p>
  <p class="verdict">${verdictBadge(d)}</p>
  <p class="evidence">${escape(d.evidence)}</p>
  <p class="checked">Checked ${day(d.checked)}</p>
  <p class="actions"><a class="btn" href="${escape(d.url)}" target="_blank" rel="noopener">View at ${escape(d.store)} &rarr;</a> <a class="details" href="#/deal/${encodeURIComponent(d.id)}">Why this verdict?</a></p>
</article>`;
}

export function statsLine(deals) {
  const total = deals.reduce((a, d) => a + saved(d), 0);
  const avg = Math.round(deals.reduce((a, d) => a + percentOff(d), 0) / deals.length);
  const strong = deals.filter((d) => d.verdict === 'new-low' || d.verdict === 'strong').length;
  return `<p class="stats"><strong>${deals.length} deals</strong> &middot; <strong>${strong} new lows or strong deals</strong> &middot; <strong>${avg}% off</strong> on average &middot; <strong>${usd(total)}</strong> total savings if you bought one of each</p>`;
}

export function filterBar(deals, state) {
  const cats = [...new Set(deals.map((d) => d.category))].sort();
  const stores = [...new Set(deals.map((d) => d.store))].sort();
  const opt = (v, label, cur) => `<option value="${escape(v)}"${v === cur ? ' selected' : ''}>${escape(label)}</option>`;
  return `<form class="filters" id="filters">
  <label>Search <input type="search" id="q" value="${escape(state.q)}" placeholder="AirPods, TV, LEGO&hellip;" autocomplete="off"></label>
  <label>Category <select id="cat"><option value="">All categories</option>${cats.map((c) => opt(c, c, state.cat)).join('')}</select></label>
  <label>Store <select id="store"><option value="">All stores</option>${stores.map((s) => opt(s, s, state.store)).join('')}</select></label>
  <label>Discount <select id="minoff">
    ${opt('', 'Any discount', state.minoff)}
    ${opt('25', '25% off or more', state.minoff)}
    ${opt('40', '40% off or more', state.minoff)}
    ${opt('50', '50% off or more', state.minoff)}
  </select></label>
  <label>Sort <select id="sort">
    ${opt('off', 'Biggest % off', state.sort)}
    ${opt('saved', 'Most dollars saved', state.sort)}
    ${opt('price', 'Lowest price', state.sort)}
    ${opt('az', 'A to Z', state.sort)}
  </select></label>
</form>
<p class="count" id="count"></p>`;
}

export function applyFilters(deals, state) {
  const q = state.q.trim().toLowerCase();
  let shown = deals.filter((d) => {
    if (q && !`${d.title} ${d.store} ${d.category}`.toLowerCase().includes(q)) return false;
    if (state.cat && d.category !== state.cat) return false;
    if (state.store && d.store !== state.store) return false;
    if (state.minoff && percentOff(d) < Number(state.minoff)) return false;
    return true;
  });
  const by = {
    off: (a, b) => percentOff(b) - percentOff(a),
    saved: (a, b) => saved(b) - saved(a),
    price: (a, b) => a.price - b.price,
    az: (a, b) => a.title.localeCompare(b.title),
  };
  shown = [...shown].sort(by[state.sort] || by.off);
  return shown;
}

export function listPage(deals, comparisons, state) {
  const shown = applyFilters(deals, state);
  const cards = shown.length === 0
    ? '<li class="empty">No deal matches those filters. <button type="button" id="clear">Clear the filters</button></li>'
    : shown.map((d) => `<li>${cardHtml(d)}</li>`).join('');
  const compare = comparisons.map((c) => {
    const best = Math.min(...c.prices.map((p) => p.price));
    const rows = c.prices.map((p) => `<tr${p.price === best ? ' class="winner"' : ''}><td>${escape(p.store)}</td><td>${usd(p.price)}</td><td>${escape(p.note)}</td><td>${p.price === best ? 'Cheapest' : '+' + usd(p.price - best) + ' more'}</td></tr>`).join('');
    return `<section class="compare"><h3><a href="#/deal/${encodeURIComponent(c.dealId)}">${escape(c.title)}</a></h3><table><thead><tr><th>Store</th><th>Price</th><th>Read in</th><th></th></tr></thead><tbody>${rows}</tbody></table></section>`;
  }).join('');
  return `<h1>Black Friday 2026, checked today</h1>
<p class="lede">Every deal below was read from a deals source that names the store and the price, on Friday 27 November 2026. Each one carries an honest verdict: a new low, a strong price, or a routine sale &mdash; with the evidence, so you can tell the difference.</p>
${statsLine(deals)}
${filterBar(deals, state)}
<ul class="grid" id="grid">${cards}</ul>
<h2>Same product, different stores</h2>
<p class="lede">A price at one store is not the price. These are the same items at two stores, both read today &mdash; the cheaper one wins.</p>
${compare}
<h2>How we check a deal</h2>
<ul class="rules">
<li><strong>NEW LOW</strong> &mdash; a source says it is the lowest or best price ever seen for the item.</li>
<li><strong>STRONG DEAL</strong> &mdash; 40% or more off the usual price the source showed.</li>
<li><strong>GOOD DEAL</strong> &mdash; 25&ndash;39% off the usual price.</li>
<li><strong>ROUTINE SALE</strong> &mdash; under 25% off. A real cut, but not a special one &mdash; and we say so instead of dressing it up.</li>
</ul>
<p class="note">Prices move all day on Black Friday. Every price here was read on 27 November 2026 (06:45 UTC) from the source named on the deal; always check the price at the store's checkout before you buy. Links go to the store's own search for that exact product.</p>`;
}

export function dealPage(d, comparisons) {
  const v = VERDICTS[d.verdict] || VERDICTS.routine;
  const pair = comparisons.find((c) => c.dealId === d.id);
  const compare = pair
    ? `<h2>Same product at another store</h2><table><thead><tr><th>Store</th><th>Price</th><th>Read in</th></tr></thead><tbody>${pair.prices.map((p) => `<tr${p.price === d.price ? ' class="winner"' : ''}><td>${escape(p.store)}</td><td>${usd(p.price)}</td><td>${escape(p.note)}</td></tr>`).join('')}</tbody></table>`
    : '';
  return `<p><a href="#/">&larr; All deals</a></p>
<h1>${escape(d.title)}</h1>
<p class="verdict">${verdictBadge(d)} <span class="verdict-hint">${escape(v.hint)}</span></p>
<dl class="facts">
  <dt>Store</dt><dd>${escape(d.store)}</dd>
  <dt>Category</dt><dd>${escape(d.category)}</dd>
  <dt>Sale price</dt><dd><strong>${usd(d.price)}</strong></dd>
  <dt>Usual price</dt><dd>${usd(d.was)}</dd>
  <dt>Discount</dt><dd>${percentOff(d)}% off &mdash; you save ${usd(saved(d))}</dd>
  <dt>Checked</dt><dd>${day(d.checked)}</dd>
  <dt>Read in</dt><dd>${escape(d.source)}</dd>
</dl>
<h2>Why this verdict?</h2>
<p>${escape(d.evidence)}</p>
${compare}
<p class="actions"><a class="btn" href="${escape(d.url)}" target="_blank" rel="noopener">View at ${escape(d.store)} &rarr;</a></p>
<p class="note">Prices move all day on Black Friday &mdash; check the price at the store's checkout before you buy.</p>`;
}

export function missingPage() {
  return `<h1>Not found</h1>
<p>There is no deal at this address. <a href="#/">See all deals</a>.</p>`;
}
