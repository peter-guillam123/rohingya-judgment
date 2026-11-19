// The fixed drawing behind the text: a map of where it happened, the people shown as
// dots, and the villages shown as blocks. Scroll position picks the scene.
//
// Every figure used here is the court's. Paragraph numbers are given beside each one.

import * as THREE from 'three';

const LON0 = 92.5, LAT0 = 20.9, KX = Math.cos((LAT0 * Math.PI) / 180);
const X = (lon) => (lon - LON0) * KX;
const Y = (lat) => lat - LAT0;
const FOV = 30;
const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const COL = {
  bg: 0x0b0d10, land: 0x161b21, landHi: 0x262e38, border: 0x3a424d, borderHi: 0x8a8f96,
  gold: 0xe3cf9d, ember: 0xdc6c41, cool: 0x8fb2c4, dot: 0xe9dcb4,
};

// Rohingya population before the 2017 operations, by township (para 69), and the share
// of each township's residents who were Rohingya (para 69).
const TOWNSHIP_POP = { Maungdaw: 492000, Buthidaung: 286000, Rathedaung: 37000 };
const TOWNSHIP_SHARE = { Maungdaw: 0.93, Buthidaung: 0.8, Rathedaung: 0.22 };
const PER_DOT = 10;            // one dot stands for ten people (our scale, not the court's)
const FLED = 700000;           // "over 700,000" fled to Bangladesh (para 262)
const KILLED = 10000;          // "at least 10,000" killed (para 253)

// Villages (para 272): 993 in the three townships; 178 totally and 214 partly destroyed.
// 78 later showed bulldozing (para 277). At least seven replaced by police bases (para 551).
const V_ALL = 993, V_TOTAL = 178, V_PARTIAL = 214, V_BULLDOZED = 78, V_BASES = 7;

// Each view: centre, and the width and height in degrees that must fit on screen.
const VIEWS = {
  hero: { lon: 95.6, lat: 19.6, w: 13, h: 20, tilt: 24 },
  region: { lon: 97.5, lat: 20.2, w: 26, h: 27, tilt: 16 },
  rakhine: { lon: 93.6, lat: 19.5, w: 4.2, h: 6.2, tilt: 24 },
  north: { lon: 92.52, lat: 20.82, w: 0.95, h: 1.32, tilt: 28 },
  people: { lon: 92.42, lat: 20.86, w: 1.15, h: 1.4, tilt: 28 },
};

const PLACE_NAMES = {
  'min-gyi': 'Min Gyi', 'chut-pyin': 'Chut Pyin', 'maung-nu': 'Maung Nu', 'gu-dar-pyin': 'Gu Dar Pyin',
  'inn-din': 'Inn Din', 'koe-tan-kauk': 'Koe Tan Kauk', 'chein-khar-li': 'Chein Khar Li',
  'kyauk-pan-du': 'Kyauk Pan Du', 'ah-lel-than-kyaw': 'Ah Lel Than Kyaw', 'myin-hlut': 'Myin Hlut',
  'kha-maung-seik': 'Kha Maung Seik',
};
// Places where the court records an ARSA attack on 25 August 2017 (paras 177, 240, 242, 245).
const ARSA_SITES = ['kha-maung-seik', 'kyauk-pan-du', 'ah-lel-than-kyaw', 'myin-hlut'];
// The step on which each army operation first appears, following paras 181, 232, 235 and 241.
// Kyauk Pan Du's operation is dated only as following the 25 August attack and lasting at
// least two days (para 241), so it is shown from the 1 September step.
const ARMY_DAY = {
  'ah-lel-than-kyaw': 1, 'myin-hlut': 1, 'chein-khar-li': 1,
  'chut-pyin': 2, 'maung-nu': 2,
  'gu-dar-pyin': 3, 'koe-tan-kauk': 3,
  'min-gyi': 4,
  'inn-din': 5, 'kyauk-pan-du': 5,
};

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function inRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function bboxOf(ring) {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const [x, y] of ring) { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; }
  return [a, b, c, d];
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function initStage(map, geo) {
  const canvas = document.getElementById('stage');
  const labelBox = document.getElementById('labels');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, stencil: true, powerPreference: 'low-power' });
  } catch (e) {
    document.documentElement.classList.add('no-gl');
    return;
  }
  renderer.setClearColor(COL.bg, 1);
  const dpr = () => Math.min(window.devicePixelRatio || 1, 2);

  /* ------------------------------------------------------------ the map */

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 500);
  camera.up.set(0, 1, 0);

  const flat = (o) => Object.assign({ depthTest: false, depthWrite: false }, o);
  const shapesOf = (polys) => polys.map((poly) => {
    const s = new THREE.Shape();
    poly[0].forEach(([lon, lat], i) => (i ? s.lineTo(X(lon), Y(lat)) : s.moveTo(X(lon), Y(lat))));
    return s;
  });
  const outlineOf = (polys, minPts = 0) => {
    const pos = [];
    for (const poly of polys) {
      const r = poly[0];
      if (r.length < minPts) continue;
      for (let i = 0; i < r.length; i++) {
        const a = r[i], b = r[(i + 1) % r.length];
        pos.push(X(a[0]), Y(a[1]), 0, X(b[0]), Y(b[1]), 0);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    return g;
  };

  const landMat = new THREE.MeshBasicMaterial(flat({ color: COL.land }));
  const myanmarMat = new THREE.MeshBasicMaterial(flat({
    color: COL.landHi, stencilWrite: true, stencilRef: 1, stencilFunc: THREE.AlwaysStencilFunc,
    stencilZPass: THREE.ReplaceStencilOp,
  }));
  const borderMat = new THREE.LineBasicMaterial(flat({ color: COL.border }));
  const myanmarLineMat = new THREE.LineBasicMaterial(flat({ color: COL.borderHi }));

  let myanmar, bangladesh;
  for (const c of map.countries) {
    const isM = c.name === 'Myanmar';
    if (isM) myanmar = c;
    if (c.name === 'Bangladesh') bangladesh = c;
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shapesOf(c.polys)), isM ? myanmarMat : landMat);
    mesh.renderOrder = isM ? 2 : 1;
    scene.add(mesh);
    const line = new THREE.LineSegments(outlineOf(c.polys, isM ? 0 : 8), isM ? myanmarLineMat : borderMat);
    line.renderOrder = isM ? 6 : 5;
    scene.add(line);
  }

  const rakhineMat = new THREE.MeshBasicMaterial(flat({ color: COL.gold, transparent: true, opacity: 0 }));
  const rakhine = new THREE.Mesh(new THREE.ShapeGeometry(shapesOf(map.rakhine)), rakhineMat);
  rakhine.renderOrder = 3;
  scene.add(rakhine);
  const rakhineLineMat = new THREE.LineBasicMaterial(flat({ color: COL.gold, transparent: true, opacity: 0 }));
  const rakhineLine = new THREE.LineSegments(outlineOf(map.rakhine, 20), rakhineLineMat);
  rakhineLine.renderOrder = 7;
  scene.add(rakhineLine);

  // The three townships. Their traced outlines overshoot the coast and the border on
  // purpose; the stencil keeps the tint to Myanmar's land.
  const townshipMats = {};
  for (const [name, ring] of Object.entries(geo.townships)) {
    const m = new THREE.MeshBasicMaterial(flat({
      color: COL.gold, transparent: true, opacity: 0, stencilWrite: true, stencilRef: 1,
      stencilFunc: THREE.EqualStencilFunc,
    }));
    townshipMats[name] = m;
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shapesOf([[ring]])), m);
    mesh.renderOrder = 4;
    scene.add(mesh);
  }
  const tLineMat = new THREE.LineBasicMaterial(flat({ color: COL.gold, transparent: true, opacity: 0 }));
  for (const ring of Object.values(geo.lines)) {
    const g = new THREE.BufferGeometry().setFromPoints(ring.map(([lon, lat]) => new THREE.Vector3(X(lon), Y(lat), 0)));
    const l = new THREE.Line(g, tLineMat);
    l.renderOrder = 8;
    scene.add(l);
  }

  /* ------------------------------------------------------------ the people, as dots */

  const dotMat = new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false,
    uniforms: {
      uFlee: { value: 0 }, uKill: { value: 0 }, uSize: { value: 2 }, uOpacity: { value: 0 },
      uBase: { value: new THREE.Color(COL.dot) }, uEmber: { value: new THREE.Color(COL.ember) },
    },
    vertexShader: `
      attribute vec2 aEnd; attribute float aType; attribute float aRand;
      uniform float uFlee, uKill, uSize;
      varying float vK; varying float vType; varying float vT;
      void main() {
        vec3 p = position; float t = 0.0;
        if (aType > 0.5 && aType < 1.5) {
          t = clamp(uFlee * 1.7 - aRand * 0.7, 0.0, 1.0);
          t = t * t * (3.0 - 2.0 * t);
          p.xy = mix(position.xy, aEnd, t);
        }
        vK = aType > 1.5 ? clamp(uKill * 1.6 - aRand * 0.6, 0.0, 1.0) : 0.0;
        vType = aType; vT = t;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uSize * (1.0 + 0.2 * vK);
      }`,
    fragmentShader: `
      uniform vec3 uBase, uEmber; uniform float uOpacity, uFlee;
      varying float vK; varying float vType; varying float vT;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        if (dot(c, c) > 0.25) discard;
        vec3 col = mix(uBase, uEmber, vK);
        float a = uOpacity * mix(0.8, 1.0, vK);
        gl_FragColor = vec4(col, a);
      }`,
  });
  let dots = null;

  function buildDots() {
    const rnd = rng(20261119);
    // Only the edges of a coastline that a ray from the sampling box can cross are kept,
    // which makes each test a few hundred steps and not several thousand.
    const edgesNear = (rings, box) => {
      const out = [];
      for (const ring of rings) {
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const a = ring[i], c = ring[j];
          if (Math.max(a[1], c[1]) < box[1] || Math.min(a[1], c[1]) > box[3] || Math.max(a[0], c[0]) < box[0]) continue;
          out.push(a[0], a[1], c[0], c[1]);
        }
      }
      return out;
    };
    const crosses = (e, lon, lat) => {
      let inside = false;
      for (let i = 0; i < e.length; i += 4) {
        if (e[i + 1] > lat !== e[i + 3] > lat && lon < ((e[i + 2] - e[i]) * (lat - e[i + 1])) / (e[i + 3] - e[i + 1]) + e[i]) inside = !inside;
      }
      return inside;
    };
    const rEdges = edgesNear(map.rakhine.map((p) => p[0]), [92.1, 20.1, 93.0, 21.5]);
    const onRakhine = (lon, lat) => crosses(rEdges, lon, lat);
    const start = [];
    for (const [name, pop] of Object.entries(TOWNSHIP_POP)) {
      const ring = geo.townships[name], b = bboxOf(ring);
      const lo0 = Math.max(b[0], 92.1), lo1 = Math.min(b[2], 93.0), la0 = Math.max(b[1], 20.1), la1 = Math.min(b[3], 21.5);
      let need = Math.round(pop / PER_DOT), guard = 0;
      while (need > 0 && guard++ < 4e6) {
        const lon = lo0 + rnd() * (lo1 - lo0), lat = la0 + rnd() * (la1 - la0);
        if (inRing(lon, lat, ring) && onRakhine(lon, lat)) { start.push([lon, lat]); need--; }
      }
    }
    // Somewhere to go: land in Bangladesh just across the border. The judgment places the
    // refugee camps at Cox's Bazar in Bangladesh (para 105) but gives no position, so the
    // dots are spread over the nearest part of Bangladesh and stand for the country only.
    const box = [91.9, 20.75, 92.4, 21.85];
    const bEdges = edgesNear(bangladesh.polys.map((p) => p[0]), box);
    const inB = (lon, lat) => crosses(bEdges, lon, lat);
    const pool = [];
    let guard = 0;
    while (pool.length < 5000 && guard++ < 2e5) {
      const lon = box[0] + rnd() * (box[2] - box[0]), lat = box[1] + rnd() * (box[3] - box[1]);
      // thin out with distance from the border, so the crowd has no hard edge
      const far = Math.hypot((lon - 92.2) * KX, lat - 21.12) / 0.3;
      if (rnd() < Math.exp(-far * far) && inB(lon, lat)) pool.push([lon, lat]);
    }
    const n = start.length;
    // shuffle, then: the first KILLED/PER_DOT are those killed, the next FLED/PER_DOT fled
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [start[i], start[j]] = [start[j], start[i]]; }
    const nKilled = KILLED / PER_DOT, nFled = FLED / PER_DOT;
    const pos = new Float32Array(n * 3), end = new Float32Array(n * 2), type = new Float32Array(n), rand = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      // put the killed last so they are drawn on top
      const i = n - 1 - k;
      const [lon, lat] = start[k];
      pos[i * 3] = X(lon); pos[i * 3 + 1] = Y(lat); pos[i * 3 + 2] = 0;
      let t = 0, e = [lon, lat];
      if (k < nKilled) t = 2;
      else if (k < nKilled + nFled && pool.length) {
        t = 1;
        const q = pool[Math.floor(rnd() * pool.length)];
        e = [q[0] + (rnd() - 0.5) * 0.006, q[1] + (rnd() - 0.5) * 0.006];
      }
      type[i] = t; end[i * 2] = X(e[0]); end[i * 2 + 1] = Y(e[1]);
      // those nearer the border leave first
      rand[i] = t === 1 ? Math.min(1, Math.max(0, (lon - 92.15) / 0.75 + (rnd() - 0.5) * 0.25)) : rnd();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aEnd', new THREE.BufferAttribute(end, 2));
    g.setAttribute('aType', new THREE.BufferAttribute(type, 1));
    g.setAttribute('aRand', new THREE.BufferAttribute(rand, 1));
    dots = new THREE.Points(g, dotMat);
    dots.frustumCulled = false;
    dots.renderOrder = 9;
    dots.visible = false;
    scene.add(dots);
  }

  /* ------------------------------------------------------------ the villages, as blocks */

  const vScene = new THREE.Scene();
  const vCamera = new THREE.PerspectiveCamera(32, 1, 0.1, 400);
  vScene.add(new THREE.HemisphereLight(0xffffff, 0x20242a, 1.5));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.2);
  sun.position.set(-6, -8, 14);
  vScene.add(sun);
  const blockGeo = new THREE.BoxGeometry(0.74, 0.74, 1);
  blockGeo.translate(0, 0, 0.5);
  const blocks = new THREE.InstancedMesh(blockGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), V_ALL);
  vScene.add(blocks);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial({ color: COL.bg }));
  ground.position.z = -0.01;
  vScene.add(ground);

  const V_COL = {
    standing: new THREE.Color(0x9a958a), partial: new THREE.Color(0xa9502c), total: new THREE.Color(0x3b2f2a),
    cleared: new THREE.Color(0x565048), base: new THREE.Color(0x7d9aad),
  };
  const vState = [];
  {
    const rnd = rng(993);
    const order = Array.from({ length: V_ALL }, (_, i) => i);
    for (let i = V_ALL - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    for (let i = 0; i < V_ALL; i++) vState.push({ kind: 'standing', bulldozed: false, base: false, h: 1, col: V_COL.standing.clone(), delay: rnd() });
    order.slice(0, V_TOTAL).forEach((i) => (vState[i].kind = 'total'));
    order.slice(V_TOTAL, V_TOTAL + V_PARTIAL).forEach((i) => (vState[i].kind = 'partial'));
    const hit = order.slice(0, V_TOTAL + V_PARTIAL);
    for (let i = hit.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [hit[i], hit[j]] = [hit[j], hit[i]]; }
    hit.slice(0, V_BULLDOZED).forEach((i) => (vState[i].bulldozed = true));
    hit.slice(0, V_BASES).forEach((i) => (vState[i].base = true));
  }
  let vCols = 0, vRows = 0;
  const vDummy = new THREE.Object3D();
  function layoutVillages(aspect) {
    const cols = aspect > 1.15 ? (W >= 1100 ? 43 : 36) : aspect > 0.8 ? 30 : 24;
    if (cols === vCols) return;
    vCols = cols; vRows = Math.ceil(V_ALL / cols);
    vState.forEach((s, i) => { s.x = (i % cols) - (cols - 1) / 2; s.y = (vRows - 1) / 2 - Math.floor(i / cols); });
  }
  function villageTarget(s, phase) {
    if (phase >= 3 && s.base) return [1.9, V_COL.base];
    if (phase >= 2 && s.bulldozed) return [0.03, V_COL.cleared];
    if (phase >= 1 && s.kind === 'total') return [0.1, V_COL.total];
    if (phase >= 1 && s.kind === 'partial') return [0.5, V_COL.partial];
    return [1, V_COL.standing];
  }
  let vPhase = 0, vClock = 0, vFrom = 0;
  function drawVillages(dt, now) {
    vClock = Math.min(1, vClock + dt / (reduce() ? 0.001 : 2.2));
    const still = reduce();
    for (let i = 0; i < V_ALL; i++) {
      const s = vState[i];
      const [th, tc] = villageTarget(s, vPhase);
      const local = Math.min(1, Math.max(0, vClock * 1.8 - s.delay * 0.8));
      const k = still ? 1 : Math.min(1, dt * 6) * (local > 0 ? 1 : 0);
      s.h += (th - s.h) * k; s.col.lerp(tc, k);
      vDummy.position.set(s.x, s.y, 0);
      vDummy.scale.set(1, 1, Math.max(0.02, s.h));
      vDummy.updateMatrix();
      blocks.setMatrixAt(i, vDummy.matrix);
      blocks.setColorAt(i, s.col);
    }
    blocks.instanceMatrix.needsUpdate = true;
    if (blocks.instanceColor) blocks.instanceColor.needsUpdate = true;
    const aspect = vCamera.aspect;
    const wide = aspect > 1.15;
    // keep the grid clear of the text: in the right-hand half on wide screens, the top half on narrow ones
    const span = wide ? Math.max((vCols * 1.2) / (0.55 * aspect), vRows * 1.05)
      : Math.max((vRows * 0.8) / 0.5, (vCols * 1.15) / aspect);
    const dist = span / (2 * Math.tan((vCamera.fov * Math.PI) / 360));
    const sway = still ? 0 : Math.sin(now / 9000) * 0.05;
    const tilt = 0.72;
    const cx = wide ? -0.2 * span * aspect : 0, cy = wide ? 0 : -0.22 * span;
    vCamera.position.set(cx + Math.sin(sway) * dist * 0.4, cy - Math.sin(tilt) * dist, Math.cos(tilt) * dist);
    vCamera.up.set(0, 0, 1);
    vCamera.lookAt(cx, cy, 0);
  }

  /* ------------------------------------------------------------ labels */

  const labels = [];
  function addLabel(kind, text, lon, lat, group, id) {
    const el = document.createElement('div');
    el.className = `maplabel maplabel--${kind}`;
    const s = document.createElement('span');
    s.textContent = text;
    el.appendChild(s);
    labelBox.appendChild(el);
    const l = { el, v: new THREE.Vector3(X(lon), Y(lat), 0), group, id, on: false };
    labels.push(l);
    return l;
  }
  // Label positions are placements on the drawing, nothing more.
  addLabel('country', 'China', 101.3, 25.6, 'world');
  addLabel('country', 'India', 93.4, 26.3, 'world');
  addLabel('country', 'Bangladesh', 90.2, 24.0, 'world');
  addLabel('country', 'Laos', 102.6, 19.7, 'world');
  addLabel('country', 'Thailand', 101.0, 15.8, 'world');
  addLabel('country maplabel--myanmar', 'Myanmar', 96.4, 21.6, 'world');
  addLabel('sea', 'Bay of Bengal', 89.6, 16.2, 'world');
  addLabel('sea', 'Andaman Sea', 96.0, 12.3, 'world');
  addLabel('pin', 'Northern Rakhine State', 92.5, 20.85, 'hero');
  addLabel('region', 'Rakhine State', 93.75, 19.55, 'rakhine');
  addLabel('sea', 'Bay of Bengal', 91.6, 18.6, 'rakhine');
  addLabel('country', 'Bangladesh', 91.7, 22.4, 'rakhine');
  addLabel('country maplabel--myanmar', 'Myanmar', 95.3, 20.6, 'rakhine');
  addLabel('country', 'Bangladesh', 92.12, 21.32, 'north');
  addLabel('sea', 'Bay of Bengal', 92.12, 20.5, 'north');
  for (const [name, [lon, lat]] of Object.entries(geo.towns)) addLabel('town', name, lon, lat, 'towns');
  const LEFT = ['ah-lel-than-kyaw', 'myin-hlut', 'kyauk-pan-du', 'inn-din', 'koe-tan-kauk', 'kha-maung-seik'];
  for (const [id, [lon, lat]] of Object.entries(geo.places)) {
    const l = addLabel('place', PLACE_NAMES[id], lon, lat, 'places', id);
    if (LEFT.includes(id)) l.el.classList.add('maplabel--left');
  }
  addLabel('country', 'Bangladesh', 92.02, 21.5, 'people');
  addLabel('sea', 'Bay of Bengal', 92.1, 20.45, 'people');

  const legend = document.createElement('ul');
  legend.id = 'legend';
  legend.setAttribute('aria-hidden', 'true');
  document.body.appendChild(legend);
  const LEGENDS = {
    august: [['ring', '', 'ARSA attack, 25 August'], ['dot', '#dc6c41', 'Operation by Myanmar’s forces']],
    people: [['dot', '#e9dcb4', 'One dot is ten people'], ['dot', '#dc6c41', 'Killed']],
    villages: [['', '#9a958a', 'Standing'], ['', '#a9502c', 'Partly destroyed'], ['', '#3b2f2a', 'Totally destroyed']],
    villages2: [['', '#9a958a', 'Standing'], ['', '#a9502c', 'Partly destroyed'], ['', '#3b2f2a', 'Totally destroyed'], ['', '#565048', 'Bulldozed']],
    villages3: [['', '#9a958a', 'Standing'], ['', '#a9502c', 'Partly destroyed'], ['', '#3b2f2a', 'Totally destroyed'], ['', '#565048', 'Bulldozed'], ['', '#7d9aad', 'Police base']],
  };
  let legendKey = '';
  function setLegend(key) {
    if (key === legendKey) return;
    legendKey = key;
    if (!key) return;
    legend.innerHTML = '';
    for (const [shape, colour, text] of LEGENDS[key]) {
      const li = document.createElement('li'), i = document.createElement('i');
      if (shape) i.className = shape;
      if (colour) { i.style.background = colour; if (colour === '#3b2f2a') i.style.outline = '1px solid #6a5a52'; }
      li.append(i, document.createTextNode(text));
      legend.appendChild(li);
    }
  }

  /* ------------------------------------------------------------ state driven by scroll */

  const P = { // every animated number, each easing towards its target
    lon: VIEWS.hero.lon, lat: VIEWS.hero.lat, w: VIEWS.hero.w, h: VIEWS.hero.h, tilt: VIEWS.hero.tilt,
    rakhine: 0, tM: 0, tB: 0, tR: 0, tLine: 0, dots: 0, flee: 0, kill: 0,
  };
  const T = Object.assign({}, P);
  let mode = 'map';
  let fade = 1, fadeTo = 1, pendingMode = null;
  let labelGroups = new Set(['world', 'hero']);
  let day = -1, focus = null;

  function apply(step) {
    const d = step.dataset;
    const wantMode = d.scene === 'villages' ? 'villages' : 'map';
    if (wantMode !== mode && !pendingMode) { pendingMode = wantMode; fadeTo = 0; }
    else if (pendingMode && wantMode === mode) { pendingMode = null; fadeTo = 1; }
    else if (pendingMode) pendingMode = wantMode;

    if (d.scene === 'villages') {
      const p = +d.phase;
      if (p !== vPhase) { vPhase = p; vClock = 0; }
      setLegend(p >= 3 ? 'villages3' : p === 2 ? 'villages2' : 'villages');
      labelGroups = new Set();
      return;
    }
    const people = d.scene === 'people';
    const v = VIEWS[people ? 'people' : d.view];
    Object.assign(T, { lon: v.lon, lat: v.lat, w: v.w, h: v.h, tilt: v.tilt });
    T.rakhine = d.view === 'rakhine' ? 0.34 : d.view === 'hero' ? 0.12 : 0;
    const base = people ? 0.1 : d.townships ? 0.26 : d.view === 'north' ? 0.13 : 0;
    T.tM = d.pop ? TOWNSHIP_SHARE.Maungdaw * 0.62 : base;
    T.tB = d.pop ? TOWNSHIP_SHARE.Buthidaung * 0.62 : base;
    T.tR = d.pop ? TOWNSHIP_SHARE.Rathedaung * 0.62 : base;
    T.tLine = d.view === 'north' || people ? 0.55 : 0;
    const ph = people ? +d.phase : -1;
    T.dots = people ? 1 : 0;
    T.flee = ph >= 1 ? 1 : 0;
    T.kill = ph >= 2 ? 1 : 0;
    day = d.day !== undefined ? +d.day : -1;
    focus = d.focus || null;
    labelGroups = new Set(
      d.view === 'hero' ? ['world', 'hero'] : d.view === 'region' ? ['world'] : d.view === 'rakhine' ? ['rakhine']
        : people ? ['people'] : day >= 0 ? ['north', 'places'] : ['north', 'towns']);
    setLegend(people ? 'people' : day >= 0 ? 'august' : '');
    const narrow = window.innerWidth < 700;
    for (const l of labels) {
      if (l.group !== 'places') continue;
      const arsa = ARSA_SITES.includes(l.id);
      const army = day >= 1 && ARMY_DAY[l.id] !== undefined && ARMY_DAY[l.id] <= day;
      const newToday = army && ARMY_DAY[l.id] === day && !d.pattern;
      const focused = focus === l.id || (focus === 'arsa' && arsa);
      l.show = day >= 0 && (arsa || army);
      l.el.classList.toggle('is-arsa', arsa);
      l.el.classList.toggle('is-army', army);
      l.el.classList.toggle('is-active', newToday || focus === l.id);
      l.el.classList.toggle('is-named', focused || newToday || (!narrow && (army || day === 0)) || !!d.pattern && !narrow);
    }
    dirty = true;
  }

  /* ------------------------------------------------------------ frame loop */

  let W = 0, H = 0, dirty = true, running = false, last = 0;
  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    renderer.setPixelRatio(dpr());
    renderer.setSize(W, H, false);
    camera.aspect = vCamera.aspect = W / H;
    camera.updateProjectionMatrix(); vCamera.updateProjectionMatrix();
    layoutVillages(W / H);
    dotMat.uniforms.uSize.value = Math.min(2.4, Math.max(1.3, H / 560)) * dpr();
    dirty = true;
  }

  function placeCamera() {
    const aspect = W / H, wide = aspect > 1.15;
    // leave room for the text: beside the map on wide screens, below it on narrow ones
    const span = Math.max(P.h * (wide ? 1.12 : 1.75), (P.w / aspect) * (wide ? 1.9 : 1.15));
    const dist = span / (2 * Math.tan((FOV * Math.PI) / 360));
    const tilt = (P.tilt * Math.PI) / 180;
    const tx = X(P.lon) - (wide ? span * aspect * 0.19 : 0);
    const ty = Y(P.lat) - (wide ? 0 : span * 0.17);
    camera.position.set(tx, ty - Math.sin(tilt) * dist, Math.cos(tilt) * dist);
    camera.lookAt(tx, ty, 0);
    camera.updateMatrixWorld();
  }

  const tmp = new THREE.Vector3();
  function placeLabels() {
    for (const l of labels) {
      const on = mode === 'map' && labelGroups.has(l.group) && (l.group !== 'places' || l.show);
      if (on !== l.on) { l.on = on; l.el.classList.toggle('is-on', on); }
      if (!on) continue;
      tmp.copy(l.v).project(camera);
      l.el.style.transform = `translate(${((tmp.x * 0.5 + 0.5) * W).toFixed(1)}px,${((-tmp.y * 0.5 + 0.5) * H).toFixed(1)}px)`;
    }
  }

  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min(0.25, (now - last) / 1000 || 0.016);
    last = now;
    const still = reduce();
    let moving = false;
    for (const k in P) {
      const rate = k === 'flee' ? 0.5 : k === 'kill' ? 0.9 : k === 'dots' ? 3 : 2.6;
      const d = T[k] - P[k];
      if (Math.abs(d) > 1e-4) {
        if (k === 'flee' || k === 'kill') P[k] = still ? T[k] : P[k] + Math.sign(d) * Math.min(Math.abs(d), dt * rate);
        else P[k] = still ? T[k] : P[k] + d * Math.min(1, dt * rate);
        moving = true;
      } else P[k] = T[k];
    }
    if (fade !== fadeTo) {
      fade += Math.sign(fadeTo - fade) * Math.min(Math.abs(fadeTo - fade), still ? 1 : dt * 4);
      canvas.style.opacity = fade < 1 ? String(fade) : '';
      if (fade === 0 && pendingMode) { mode = pendingMode; pendingMode = null; fadeTo = 1; dirty = true; }
    }
    if (mode === 'villages') {
      drawVillages(dt, now);
      placeLabels();
      renderer.render(vScene, vCamera);
      return;
    }
    if (!moving && !dirty && fade === fadeTo) return;
    dirty = false;
    rakhineMat.opacity = P.rakhine; rakhineLineMat.opacity = Math.min(1, P.rakhine * 2.2);
    townshipMats.Maungdaw.opacity = P.tM; townshipMats.Buthidaung.opacity = P.tB; townshipMats.Rathedaung.opacity = P.tR;
    tLineMat.opacity = P.tLine;
    if (P.dots > 0.01 && !dots) buildDots();
    if (dots) {
      dots.visible = P.dots > 0.01;
      dotMat.uniforms.uOpacity.value = P.dots;
      dotMat.uniforms.uFlee.value = ease(P.flee);
      dotMat.uniforms.uKill.value = P.kill;
    }
    placeCamera();
    placeLabels();
    renderer.render(scene, camera);
  }

  function setRunning(on) {
    canvas.classList.toggle('is-on', on);
    labelBox.classList.toggle('is-on', on);
    if (on && !running) { running = true; last = performance.now(); dirty = true; requestAnimationFrame(frame); }
    else if (!on) running = false;
  }

  const steps = [...document.querySelectorAll('.step[data-scene]')];
  const stages = [...document.querySelectorAll('.stage')];
  let active = null;
  function onScroll() {
    const vh = window.innerHeight;
    // draw only while one of the scrolling scenes is on, or nearly on, the screen
    setRunning(!document.hidden && stages.some((s) => { const r = s.getBoundingClientRect(); return r.bottom > -vh * 0.1 && r.top < vh * 1.1; }));
    const line = vh * 0.72;
    let best = steps[0];
    for (const s of steps) { if (s.getBoundingClientRect().top < line) best = s; else break; }
    if (best !== active) { active = best; apply(best); }
    // the key shows only while its scene fills the middle of the screen
    const r = active.closest('.stage').getBoundingClientRect();
    legend.classList.toggle('is-on', !!legendKey && r.top < window.innerHeight * 0.6 && r.bottom > window.innerHeight * 0.45);
  }
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; onScroll(); });
  }, { passive: true });
  window.addEventListener('resize', () => { resize(); onScroll(); if (active) apply(active); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) running = false; else onScroll(); });

  resize();
  onScroll();
  // start where the first step says, without a swoop on load
  Object.assign(P, T);
  // build the dots when the browser is idle, so the first frames are not held up
  (window.requestIdleCallback || ((f) => setTimeout(f, 1200)))(() => { if (!dots) buildDots(); });
}
