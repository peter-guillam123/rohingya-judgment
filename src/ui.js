// The parts of the page you can press: the timeline switch, the nine places, the vote.
// All of the words and numbers live in index.html. This file only shows and hides them.

export function initNav() {
  const links = [...document.querySelectorAll('.topbar__links a[href^="#"]')];
  const byId = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
  const sections = [...document.querySelectorAll('main section[id], main header[id]')];
  // a section without its own link lights the nearest link before it
  const owner = new Map();
  let current = null;
  for (const s of sections) {
    if (byId.has(s.id)) current = byId.get(s.id);
    owner.set(s, current);
  }
  const set = (a) => links.forEach((l) => (l === a ? l.setAttribute('aria-current', 'true') : l.removeAttribute('aria-current')));
  let waiting = false;
  const update = () => {
    waiting = false;
    const mid = window.innerHeight * 0.5;
    let here = sections[0];
    for (const s of sections) { if (s.getBoundingClientRect().top < mid) here = s; else break; }
    set(owner.get(here));
  };
  window.addEventListener('scroll', () => { if (!waiting) { waiting = true; requestAnimationFrame(update); } }, { passive: true });
  update();
}

export function initTimeline() {
  const list = document.getElementById('timeline');
  const btn = document.getElementById('timeline-toggle');
  if (!list || !btn) return;
  const all = list.children.length, key = list.querySelectorAll('[data-key]').length;
  const render = (open) => {
    list.classList.toggle('is-short', !open);
    btn.setAttribute('aria-expanded', String(open));
    btn.textContent = open ? `Show the ${key} main dates only` : `Show all ${all} dates`;
  };
  btn.addEventListener('click', () => render(btn.getAttribute('aria-expanded') !== 'true'));
  render(false);
}

/* ---------------------------------------------------------------- the nine places */

function locator(map, geo) {
  const NS = 'http://www.w3.org/2000/svg';
  const L0 = 92.1, L1 = 92.92, B0 = 20.33, B1 = 21.42, S = 300, K = Math.cos((20.9 * Math.PI) / 180);
  const W = (L1 - L0) * S * K, H = (B1 - B0) * S;
  const x = (lon) => ((lon - L0) * S * K).toFixed(1), y = (lat) => ((B1 - lat) * S).toFixed(1);
  const el = (name, attrs, parent) => {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  const svg = el('svg', { viewBox: `0 0 ${W.toFixed(0)} ${H.toFixed(0)}`, role: 'presentation', focusable: 'false' });
  const near = (ring) => ring.some(([lon, lat]) => lon > L0 - 0.3 && lon < L1 + 0.3 && lat > B0 - 0.3 && lat < B1 + 0.3);
  const path = (ring) => 'M' + ring.map(([lon, lat]) => `${x(lon)},${y(lat)}`).join('L') + 'Z';
  for (const c of map.countries) {
    if (c.name !== 'Myanmar' && c.name !== 'Bangladesh') continue;
    const d = c.polys.map((p) => p[0]).filter(near).map(path).join('');
    el('path', { d, fill: c.name === 'Myanmar' ? '#232a33' : '#171b21', stroke: '#4a525d', 'stroke-width': 0.8 }, svg);
  }
  for (const ring of Object.values(geo.lines)) {
    el('polyline', { points: ring.map(([lon, lat]) => `${x(lon)},${y(lat)}`).join(' '), fill: 'none', stroke: '#e3cf9d', 'stroke-width': 0.8, 'stroke-opacity': 0.55 }, svg);
  }
  const text = (t, lon, lat, attrs) => { const n = el('text', Object.assign({ x: x(lon), y: y(lat), 'font-family': 'system-ui, sans-serif', 'font-size': 9, fill: '#979185' }, attrs), svg); n.textContent = t; return n; };
  text('BANGLADESH', 92.13, 21.33, { 'letter-spacing': 1.5, 'font-size': 7.5 });
  text('Bay of Bengal', 92.13, 20.52, { 'font-style': 'italic', fill: '#8fb2c4' });
  for (const [name, [lon, lat]] of Object.entries(geo.towns)) {
    el('rect', { x: x(lon) - 2, y: y(lat) - 2, width: 4, height: 4, fill: '#0b0d10', stroke: '#c3bdb1', 'stroke-width': 0.8 }, svg);
    text(name, lon + 0.02, lat - 0.008, { fill: '#c3bdb1', 'font-size': 8.5 });
  }
  const dots = {};
  for (const [id, [lon, lat]] of Object.entries(geo.places)) {
    if (id === 'kha-maung-seik') continue;
    dots[id] = el('circle', { cx: x(lon), cy: y(lat), r: 2.6, fill: '#dc6c41', 'fill-opacity': 0.45 }, svg);
  }
  const ring = el('circle', { r: 9, fill: 'none', stroke: '#dc6c41', 'stroke-width': 1.2, visibility: 'hidden' }, svg);
  const select = (ids) => {
    for (const id in dots) { const on = ids.includes(id); dots[id].setAttribute('fill-opacity', on ? 1 : 0.4); dots[id].setAttribute('r', on ? 4 : 2.6); }
    const [lon, lat] = geo.places[ids[0]];
    ring.setAttribute('cx', x(lon)); ring.setAttribute('cy', y(lat)); ring.setAttribute('visibility', 'visible');
  };
  return { svg, select };
}

export function initExplorer(map, geo) {
  const root = document.getElementById('explorer');
  if (!root) return;
  const nav = document.getElementById('explorer-nav');
  const mapBox = document.getElementById('explorer-map');
  const places = [...root.querySelectorAll('.place')];
  let loc = null;
  if (map && geo) {
    try {
      loc = locator(map, geo);
      mapBox.appendChild(loc.svg);
      const note = document.createElement('p');
      note.textContent = 'Positions are approximate, read from the court’s sketch-map No. 1.';
      mapBox.appendChild(note);
    } catch (e) { loc = null; }
  }
  nav.setAttribute('role', 'group');
  nav.setAttribute('aria-label', 'Choose a place');
  const buttons = places.map((p) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip';
    b.textContent = p.querySelector('h3').firstChild.textContent.trim().replace(/ and .*/, '');
    b.setAttribute('aria-controls', p.id);
    b.addEventListener('click', () => show(p, true));
    nav.appendChild(b);
    return b;
  });
  function show(place, moveFocus) {
    places.forEach((p, i) => { p.hidden = p !== place; buttons[i].setAttribute('aria-pressed', String(p === place)); });
    if (loc) loc.select(place.dataset.place === 'koe-tan-kauk' ? ['koe-tan-kauk', 'chein-khar-li'] : [place.dataset.place]);
    if (moveFocus) { const h = place.querySelector('h3'); h.tabIndex = -1; h.focus({ preventScroll: true }); }
  }
  root.classList.add('is-live');
  const fromHash = places.find((p) => '#' + p.id === location.hash);
  show(fromHash || places[0], false);
}

/* ---------------------------------------------------------------- the vote */

const WORDS = ['none', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen'];

export function initVotes() {
  const table = document.getElementById('votetable');
  const root = document.getElementById('votes');
  if (!table || !root) return;
  const heads = [...table.querySelectorAll('thead th')].slice(2);
  const judges = heads.map((th) => ({ name: th.textContent.trim(), role: th.dataset.role || '' }));
  const rows = [...table.querySelectorAll('tbody tr')].map((tr) => ({
    n: tr.querySelector('.qn').textContent.replace('.', '').trim(),
    label: tr.querySelector('th').textContent.replace(/^\s*\d+\.\s*/, '').trim(),
    tally: tr.querySelector('.tally').textContent.trim(),
    votes: [...tr.querySelectorAll('td[data-v]')].map((td) => td.dataset.v),
  }));
  const q = document.getElementById('votes-q');
  const bench = document.getElementById('bench');
  const count = document.getElementById('votes-count');
  const seats = judges.map((j) => {
    const li = document.createElement('li');
    li.textContent = j.name;
    if (j.role) { const s = document.createElement('small'); s.textContent = j.role; li.appendChild(s); }
    bench.appendChild(li);
    return li;
  });
  const show = (i) => {
    const r = rows[i];
    const f = r.votes.filter((v) => v === 'F').length, a = r.votes.length - f;
    seats.forEach((li, k) => {
      li.dataset.v = r.votes[k];
      li.setAttribute('aria-label', `${judges[k].name}${judges[k].role ? ', ' + judges[k].role.toLowerCase() : ''}: ${r.votes[k] === 'F' ? 'in favour' : 'against'}`);
    });
    const against = judges.filter((_, k) => r.votes[k] === 'A').map((j) => j.name);
    count.innerHTML = '';
    const big = document.createElement('strong');
    big.textContent = a ? `${f}–${a}` : 'Unanimous';
    count.append(big, document.createTextNode(
      a ? ` ${r.label}. ${WORDS[f][0].toUpperCase() + WORDS[f].slice(1)} in favour, ${WORDS[a]} against. Against: ${against.join(', ')}.`
        : ` ${r.label}. All ${WORDS[f]} judges agreed.`));
  };
  rows.forEach((r, i) => {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'radio'; input.name = 'vote-q'; input.value = String(i); input.checked = i === 0;
    input.addEventListener('change', () => show(i));
    const n = document.createElement('span'); n.className = 'n'; n.textContent = r.n;
    const t = document.createElement('span'); t.textContent = r.label;
    const tally = document.createElement('span'); tally.className = 't'; tally.textContent = r.tally;
    label.append(input, n, t, tally);
    q.appendChild(label);
  });
  root.classList.add('is-live');
  document.getElementById('votes-table-wrap').removeAttribute('open');
  show(0);
}
