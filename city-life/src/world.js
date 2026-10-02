/* City Life - world: the POI registry (fallback landmarks + researched venues +
   Places results) and the pedestrian road graph with A*. No DOM, no three.js. */
(function (CL) {
  const { geo } = CL;
  const W = CL.world = { pois: [], byId: new Map(), nodes: null };

  /* ------------------------------ POIs ------------------------------ */
  const SKIP_IDS = new Set();
  function categoryFor(p) {
    const n = (p.name || "").toLowerCase();
    if (p.id === "camperdown-usyd-quadrangle") return "campus";
    if (/fish market/.test(n)) return "fishmarket";
    switch (p.category) {
      case "cafe": case "pub": case "bar": case "restaurant": case "park": case "gallery": case "museum": case "market": return p.category;
      case "shop": return /book|read than/.test(n) ? "bookshop" : /vintage|records|artisans/.test(n) ? "vintageshop" : "shop";
      case "venue": return /dendy|cinema/.test(n) ? "cinema" : /enmore theatre/.test(n) ? "livemusic" : /seymour/.test(n) ? "theatre" : "landmark";
      case "landmark": return "landmark";
      default: return null;
    }
  }
  function zoneFor(lat, lng) {
    let best = null, bd = Infinity;
    for (const [k, z] of Object.entries(CL.ZONES)) {
      const d = Math.hypot((lat - z.lat) * 110574, (lng - z.lng) * 92410);
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }
  W.zoneFor = zoneFor;

  function makePoi(src, extra) {
    const cat = CL.CATEGORIES[src.category] ? src.category : "landmark";
    const p = Object.assign({
      id: src.id, name: src.name, category: cat, lat: src.lat, lng: src.lon ?? src.lng,
      suburb: src.suburb || "", address: src.address || "", placeId: src.placeId || null,
      priceLevel: src.priceLevel ?? CL.CATEGORIES[cat].price, interior: src.interior || null,
      workplace: src.workplace || null, fictional: !!src.fictional, closedForGood: false,
      hoursText: src.hours === undefined ? CL.CATEGORIES[cat].hours : src.hours,
      hoursSource: src.hoursSource || (src.hours ? "research" : "typical for category"),
      description: src.description || "", localTip: src.localTip || "", source: "fallback",
    }, extra || {});
    p.week = W.weekFor(p.hoursText, cat);
    const xz = geo.toXZ(p.lat, p.lng); p.x = xz.x; p.z = xz.z;
    p.zone = zoneFor(p.lat, p.lng);
    return p;
  }
  // hours text -> week; text that doesn't parse ("public wall", "dawn to dusk") falls back to the category default
  W.weekFor = function (text, cat) {
    const wk = text ? CL.hours.parse(text) : null;
    if (wk && wk.some(d => d.length)) return wk;
    const def = CL.CATEGORIES[cat] && CL.CATEGORIES[cat].hours;
    return def ? CL.hours.parse(def) : null;
  };
  function add(p) { if (W.byId.has(p.id)) return W.byId.get(p.id); W.pois.push(p); W.byId.set(p.id, p); return p; }

  // landmarks (fallback JSON) first, then the parent build's researched venues inside the play area
  W.loadFallback = function (landmarks, researched) {
    for (const l of landmarks) add(makePoi(l));
    const extras = (researched || []).filter(r => geo.inPlay(r.lat, r.lon) && !SKIP_IDS.has(r.id) && r.category !== "transport");
    // geocode failures show up as 3+ venues sharing one coordinate: drop those, nudge pairs apart
    const count = new Map();
    for (const r of extras) { const k = r.lat + "," + r.lon; count.set(k, (count.get(k) || 0) + 1); }
    for (const r of researched || []) {
      const p = W.byId.get(r.id);
      if (p) { p.description = r.description || ""; p.localTip = r.localTip || ""; p.closedForGood = r.status === "temporarily_closed"; }
    }
    for (const r of extras) {
      if (W.byId.has(r.id)) continue;
      const cat = categoryFor(r); if (!cat) continue;
      const k = r.lat + "," + r.lon, n = count.get(k);
      if (n >= 3) continue;
      const src = { ...r, category: cat };
      if (n === 2) { src.lat += (CL.hash01(r.id, 1) - 0.5) * 0.00018; src.lon += (CL.hash01(r.id, 2) - 0.5) * 0.00022; }
      if (/unverified/.test(r.hours || "") || !r.hours) src.hours = undefined; else src.hours = undefined; // free-text hours -> category default
      const p = add(makePoi(src, { description: r.description || "", localTip: r.localTip || "", researchedHours: r.hours || "" }));
      p.closedForGood = r.status === "temporarily_closed";
      p.hoursSource = r.hours ? `typical for category (research says: ${r.hours})` : "typical for category";
    }
  };

  // researched additions (data/research.js): new places, fixes to existing ones, weekly events, crowd curves
  W.loadResearch = function (R) {
    let added = 0, updated = 0, events = 0;
    for (const set of (R && R.sets) || []) {
      for (const r of set.pois) {
        if (W.byId.has(r.id) || !geo.inPlay(r.lat, r.lon)) continue;
        const cat = CL.CATEGORIES[r.category] ? r.category : "landmark";
        const p = add(makePoi({ ...r, category: cat, hours: r.hours || undefined }, { description: r.description || "", localTip: r.localTip || "", rating: r.rating || null, onEasternAve: !!r.onEasternAve }));
        p.hoursSource = r.hours ? (r.hoursSource || "research") : "typical for category";
        p.verifiedOn = set.verifiedOn; added++;
        if (/carillon/.test(r.id)) p.things = ["carillon", "lookaround"];
      }
      for (const u of set.updates) {
        const p = W.byId.get(u.id); if (!p) continue;
        if (u.remove) { W.pois.splice(W.pois.indexOf(p), 1); W.byId.delete(p.id); updated++; continue; }
        if (u.name) p.name = u.name;
        if (u.category && CL.CATEGORIES[u.category]) { p.category = u.category; p.week = CL.hours.parse(p.hoursText || CL.CATEGORIES[u.category].hours); }
        if (u.description) p.description = u.description;
        if (u.localTip) p.localTip = u.localTip;
        if (u.hours) { p.hoursText = u.hours; p.week = W.weekFor(u.hours, p.category); p.hoursSource = "research " + (set.verifiedOn || ""); }
        updated++;
      }
      for (const e of set.events) {
        if (CL.EVENTS.some(x => x.id === e.id)) continue;
        CL.EVENTS.push({ id: e.id, tag: e.tag || e.id, poi: e.poi, days: e.days, start: e.start, end: e.end, title: e.title, emoji: e.emoji || "✨" }); events++;
      }
      if (set.crowd && set.crowd.hourly && set.crowd.hourly.length === 24) { const z = CL.LIVELY.find(z => z.id === "eastern-ave"); if (z) z.wd = set.crowd.hourly; }
    }
    return { added, updated, events };
  };

  // Nearby Search results (id, displayName, location, primaryType) -> merge or add
  W.addPlaces = function (places) {
    let added = 0, matched = 0;
    for (const pl of places) {
      const cat = CL.PLACES_TYPES[pl.primaryType]; if (!cat) continue;
      const lat = pl.location.latitude, lng = pl.location.longitude;
      if (!geo.inPlay(lat, lng)) continue;
      const name = pl.displayName?.text || "Unnamed place";
      if (W.pois.some(p => p.placeId === pl.id)) continue;
      const xz = geo.toXZ(lat, lng), key = norm(name);
      const twin = W.pois.find(p => !p.placeId && Math.hypot(p.x - xz.x, p.z - xz.z) < 60 && (norm(p.name).includes(key.slice(0, 6)) || key.includes(norm(p.name).slice(0, 6))));
      if (twin) { twin.placeId = pl.id; matched++; continue; }
      add(makePoi({ id: pl.id, name, category: cat, lat, lon: lng, placeId: pl.id, hours: undefined }, { source: "places" }));
      added++;
    }
    return { added, matched };
  };
  const norm = s => (s || "").toLowerCase().replace(/^the\s+/, "").replace(/[^a-z0-9]/g, "");

  // Apply Place Details to a POI (hours, price) - card data stays in the places cache
  W.applyDetails = function (p, d) {
    const wk = CL.hours.fromPlaces(d.currentOpeningHours || d.regularOpeningHours);
    if (wk) { p.week = wk; p.hoursSource = "Google Places (current opening hours)"; }
    if (d.priceLevel && d.priceLevel in CL.PLACES_PRICE) p.priceLevel = CL.PLACES_PRICE[d.priceLevel];
    if (d.businessStatus === "CLOSED_PERMANENTLY" || d.businessStatus === "CLOSED_TEMPORARILY") p.closedForGood = true;
  };

  // spatial buckets for discovery checks
  // brand research: sign text, colours, website, what it's known for; closures and renames
  W.applyBrands = function (brands) {
    let n = 0;
    for (const [id, b] of Object.entries(brands || {})) {
      const p = W.byId.get(id); if (!p) continue;
      p.brand = b; b.verified = !!(b.sources && b.sources.length); n++;
      if (b.status === "closed") p.closedForGood = true;
      const rn = /^renamed:\s*(.+)$/.exec(b.status || ""); if (rn) p.name = rn[1].trim();
      if (b.priceLevel != null && b.priceLevel >= 0) p.priceLevel = b.priceLevel;
      if (b.rating) p.rating = b.rating;
    }
    return n;
  };
  // every public place without a hand-made interior gets its venue type's generic one
  W.assignInteriors = function () {
    for (const p of W.pois) if (!p.interior && CL.INTERIOR_DEFS["gen-" + p.category]) p.interior = "gen-" + p.category;
  };
  W.indexPois = function () {
    W.grid = new Map();
    for (const p of W.pois) {
      const k = `${Math.floor(p.x / 100)},${Math.floor(p.z / 100)}`;
      if (!W.grid.has(k)) W.grid.set(k, []);
      W.grid.get(k).push(p);
    }
  };
  W.poisNear = function (x, z, r) {
    const out = [], gx = Math.floor(x / 100), gz = Math.floor(z / 100), n = Math.ceil(r / 100);
    for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
      const b = W.grid.get(`${gx + i},${gz + j}`); if (!b) continue;
      for (const p of b) if (Math.hypot(p.x - x, p.z - z) <= r) out.push(p);
    }
    return out;
  };

  /* ------------------------------ road graph ------------------------------ */
  // Walkable ways from data/map.js inside the play area. OSM ways share nodes at
  // junctions; the simplified polylines keep most of them, and vertices within
  // 2.5 m are welded so near-misses still connect. Largest component wins.
  const WALK = new Set(["motorway", "motorway_link"]);
  W.buildGraph = function (map) {
    const b = geo.BBOX, pad = 0.004;
    const minX = (b.w - pad - geo.LON0) * 92410.51, maxX = (b.e + pad - geo.LON0) * 92410.51;
    const minZ = (geo.LAT0 - (b.n + pad)) * 110574, maxZ = (geo.LAT0 - (b.s - pad)) * 110574;
    const inBox = ([x, z]) => x > minX && x < maxX && z > minZ && z < maxZ;
    const xs = [], zs = [], adj = [], cell = new Map(), WELD = 2.5;
    const nodeAt = (x, z) => {
      const cx = Math.floor(x / WELD), cz = Math.floor(z / WELD);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        const l = cell.get((cx + i) * 100003 + (cz + j)); if (!l) continue;
        for (const id of l) if (Math.abs(xs[id] - x) < WELD && Math.abs(zs[id] - z) < WELD) return id;
      }
      const id = xs.length; xs.push(x); zs.push(z); adj.push([]);
      const k = cx * 100003 + cz; if (!cell.has(k)) cell.set(k, []); cell.get(k).push(id);
      return id;
    };
    const link = (a, c) => { if (a === c || adj[a].includes(c)) return; adj[a].push(c); adj[c].push(a); };
    for (const r of map.roads) {
      if (r.u || WALK.has(r.c)) continue;
      const pts = r.p; if (!pts.some(inBox)) continue;
      let prev = -1;
      for (let i = 0; i < pts.length; i++) {
        const [x, z] = pts[i];
        // split long segments so POIs can attach mid-block
        if (prev >= 0) {
          const px = xs[prev], pz = zs[prev], L = Math.hypot(x - px, z - pz), n = Math.floor(L / 40);
          for (let k = 1; k <= n; k++) { const t = k / (n + 1), m = nodeAt(px + (x - px) * t, pz + (z - pz) * t); link(prev, m); prev = m; }
        }
        const id = nodeAt(x, z);
        if (prev >= 0) link(prev, id);
        prev = id;
      }
    }
    // keep the largest connected component
    const comp = new Int32Array(xs.length).fill(-1); let best = -1, bestN = 0;
    for (let s = 0, c = 0; s < xs.length; s++) {
      if (comp[s] >= 0) continue;
      const q = [s]; comp[s] = c;
      for (let i = 0; i < q.length; i++) for (const n of adj[q[i]]) if (comp[n] < 0) { comp[n] = c; q.push(n); }
      if (q.length > bestN) { bestN = q.length; best = c; }
      c++;
    }
    W.nodes = { xs, zs, adj, ok: Array.from(comp, c => c === best), count: xs.length, main: bestN };
    W.nodeGrid = new Map();
    for (let i = 0; i < xs.length; i++) {
      if (!W.nodes.ok[i]) continue;
      const k = `${Math.floor(xs[i] / 50)},${Math.floor(zs[i] / 50)}`;
      if (!W.nodeGrid.has(k)) W.nodeGrid.set(k, []);
      W.nodeGrid.get(k).push(i);
    }
    for (const p of W.pois) p.node = W.nearestNode(p.x, p.z);
    return W.nodes;
  };
  W.nearestNode = function (x, z) {
    const gx = Math.floor(x / 50), gz = Math.floor(z / 50);
    for (let r = 0; r < 12; r++) {
      let best = -1, bd = Infinity;
      for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
        const l = W.nodeGrid.get(`${gx + i},${gz + j}`); if (!l) continue;
        for (const id of l) { const d = Math.hypot(W.nodes.xs[id] - x, W.nodes.zs[id] - z); if (d < bd) { bd = d; best = id; } }
      }
      if (best >= 0) return best;
    }
    return -1;
  };

  // A* with a binary heap; small LRU path cache keyed by node pair
  const cache = new Map();
  W.path = function (a, b) {
    if (a < 0 || b < 0) return null;
    if (a === b) return [a];
    const key = a * 1e6 + b;
    if (cache.has(key)) return cache.get(key).slice();
    const { xs, zs, adj } = W.nodes, n = xs.length;
    const g = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), closed = new Uint8Array(n);
    const heap = [], h = i => Math.hypot(xs[i] - xs[b], zs[i] - zs[b]);
    const push = (i, f) => { heap.push([f, i]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top; };
    g[a] = 0; push(a, h(a));
    while (heap.length) {
      const [, i] = pop();
      if (closed[i]) continue; closed[i] = 1;
      if (i === b) break;
      for (const j of adj[i]) {
        if (closed[j]) continue;
        const ng = g[i] + Math.hypot(xs[j] - xs[i], zs[j] - zs[i]);
        if (ng < g[j]) { g[j] = ng; prev[j] = i; push(j, ng + h(j)); }
      }
    }
    if (prev[b] < 0) return null;
    const out = []; for (let c = b; c >= 0; c = prev[c]) out.push(c);
    out.reverse();
    if (cache.size > 400) cache.delete(cache.keys().next().value);
    cache.set(key, out);
    return out.slice();
  };
  // street route from a point to a point: [ {x,z}, ... ]
  W.route = function (from, to) {
    const a = W.nearestNode(from.x, from.z), b = W.nearestNode(to.x, to.z);
    const ids = W.path(a, b);
    const pts = [];
    if (ids) for (const i of ids) pts.push({ x: W.nodes.xs[i], z: W.nodes.zs[i] });
    pts.push({ x: to.x, z: to.z });
    return pts;
  };
  W.routeLength = pts => { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z); return L; };

  /* ------------------------------ collision ------------------------------ */
  // OSM building footprints + water inside the play area, bucketed on a 25 m grid.
  // W.hit(x, z) -> index of the solid polygon covering the point, or -1.
  W.buildBlockers = function (map) {
    const b = geo.BBOX, pad = 0.003;
    const minX = (b.w - pad - geo.LON0) * 92410.51, maxX = (b.e + pad - geo.LON0) * 92410.51;
    const minZ = (geo.LAT0 - (b.n + pad)) * 110574, maxZ = (geo.LAT0 - (b.s - pad)) * 110574;
    W.solids = []; W.solidGrid = new Map();
    const addPoly = (p, kind) => {
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const [x, z] of p) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
      if (x1 < minX || x0 > maxX || z1 < minZ || z0 > maxZ) return;
      const id = W.solids.length; W.solids.push({ p, kind, x0, x1, z0, z1 });
      for (let i = Math.floor(x0 / 25); i <= Math.floor(x1 / 25); i++) for (let j = Math.floor(z0 / 25); j <= Math.floor(z1 / 25); j++) {
        const k = i * 100003 + j; if (!W.solidGrid.has(k)) W.solidGrid.set(k, []); W.solidGrid.get(k).push(id);
      }
    };
    for (const bd of map.buildings) addPoly(bd.p, "building");
    for (const w of map.water) if (w.n !== "harbour") addPoly(w.p, "water");
    for (const p of W.pois) p.bld = W.hit(p.x, p.z);
    return W.solids.length;
  };
  const inPoly = (p, x, z) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, zi] = p[i], [xj, zj] = p[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
  // harbour water (painted mask from the 3D map): counts as a solid you can't walk into
  W.setWaterMask = function (mask, w, h, x0, z0, px) { W.water = { mask, w, h, x0, z0, px }; W.waterId = W.solids.length; W.solids.push({ p: [], kind: "harbour", x0: 0, x1: 0, z0: 0, z1: 0 }); };
  W.inWater = (x, z) => { const m = W.water; if (!m) return false; const i = Math.floor((x - m.x0) / m.px), j = Math.floor((z - m.z0) / m.px); return i >= 0 && j >= 0 && i < m.w && j < m.h && m.mask[j * m.w + i] === 1; };
  W.hit = function (x, z) {
    if (W.water && W.inWater(x, z)) return W.waterId;
    const l = W.solidGrid && W.solidGrid.get(Math.floor(x / 25) * 100003 + Math.floor(z / 25)); if (!l) return -1;
    for (const id of l) { const s = W.solids[id]; if (x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1 && inPoly(s.p, x, z)) return id; }
    return -1;
  };
  // POIs whose footprint is this solid (for "you're at the door of ...")
  W.poisInSolid = id => id < 0 ? [] : W.pois.filter(p => p.bld === id);
})(window.CL = window.CL || {});
