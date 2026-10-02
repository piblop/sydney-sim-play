/* City Life - streetscape infill for the storybook map. OSM is missing many
   residential buildings in Glebe, Newtown and Camperdown, so street frontages
   with no mapped building (and no park, road, rail or campus) get a row of
   Victorian terraces in the Inner West manner: two storeys, a verandah with a
   white iron-lace balcony, a front fence and a small garden. Streets also get
   street trees (London planes, brush box, the odd jacaranda) on the footpath.
   Infill terraces join the collision map so you can't walk through them. */
(function (CL) {
  const K = CL.chibi, I = CL.infill = {};
  const ROADW = { major: 15, secondary: 12, tertiary: 10, street: 7.5, lane: 4.5, plaza: 5, path: 2.6, motorway: 16 };
  // heritage paint schemes seen along Glebe Point Rd, Wilson St and the Camperdown back streets
  const BODY = ["#a5533a", "#b0623f", "#9a4a36", "#e8d9b5", "#dfe5cf", "#cfdbe3", "#efd6c4", "#f1e3a8", "#d9c3a0", "#c8d8c0", "#e6cfd9", "#b8c9d6"];
  const TRIM = ["#fbf8ef", "#2f4f3f", "#6b2a2e", "#2d3e5c", "#fbf8ef", "#fbf8ef"];
  const ROOF = ["#8e969c", "#7f878d", "#b85c3c", "#a95a3f", "#6f777d"];
  const AWN = ["#e76f51", "#2a9d8f", "#264653", "#e9c46a", "#b5446e", "#3a6ea5", "#7d4e2d", "#f4a261"];
  const DOOR = ["#2f4f3f", "#6b2a2e", "#2d3e5c", "#c9a227", "#3b2f22"];

  I.build = function (scene, map, inBox, bb) {
    const hash = CL.hash01, W = CL.world, C = 2;   // raster cell (m)
    const [minX, maxX, minZ, maxZ] = bb, NX = Math.ceil((maxX - minX) / C), NZ = Math.ceil((maxZ - minZ) / C);
    const R = new Uint8Array(NX * NZ);   // 0 free · 1 carriageway · 2 blocked (park/rail/campus/placed) · 3 footpath
    const cell = (x, z) => { const i = Math.floor((x - minX) / C), j = Math.floor((z - minZ) / C); return i < 0 || j < 0 || i >= NX || j >= NZ ? -1 : j * NX + i; };
    const at = (x, z) => { const k = cell(x, z); return k < 0 ? 2 : R[k]; };
    function stroke(pts, half, v, keep) {
      for (let s = 1; s < pts.length; s++) {
        const [x1, z1] = pts[s - 1], [x2, z2] = pts[s], dx = x2 - x1, dz = z2 - z1, L2 = dx * dx + dz * dz || 1;
        const i0 = Math.floor((Math.min(x1, x2) - half - minX) / C), i1 = Math.ceil((Math.max(x1, x2) + half - minX) / C);
        const j0 = Math.floor((Math.min(z1, z2) - half - minZ) / C), j1 = Math.ceil((Math.max(z1, z2) + half - minZ) / C);
        for (let j = Math.max(0, j0); j <= Math.min(NZ - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(NX - 1, i1); i++) {
          const px = minX + (i + .5) * C, pz = minZ + (j + .5) * C, t = CL.clamp(((px - x1) * dx + (pz - z1) * dz) / L2, 0, 1);
          if (Math.hypot(px - (x1 + dx * t), pz - (z1 + dz * t)) <= half) { const k = j * NX + i; if (!(keep && R[k] === keep)) R[k] = v; }
        }
      }
    }
    function fill(poly, v) {
      let z0 = Infinity, z1 = -Infinity; for (const [, z] of poly) { z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
      for (let j = Math.max(0, Math.floor((z0 - minZ) / C)); j <= Math.min(NZ - 1, Math.ceil((z1 - minZ) / C)); j++) {
        const pz = minZ + (j + .5) * C, xs = [];
        for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) { const [xa, za] = poly[a], [xb, zb] = poly[b]; if ((za > pz) !== (zb > pz)) xs.push(xa + (pz - za) * (xb - xa) / (zb - za)); }
        xs.sort((p, q) => p - q);
        for (let k = 0; k + 1 < xs.length; k += 2) for (let i = Math.max(0, Math.floor((xs[k] - minX) / C)); i <= Math.min(NX - 1, Math.floor((xs[k + 1] - minX) / C)); i++) R[j * NX + i] = v;
      }
    }
    const touches = p => p.some(inBox);
    for (const pk of map.parks) if (touches(pk.p)) fill(pk.p, 2);
    for (const w of map.water) if (w.n !== "harbour" && touches(w.p)) fill(w.p, 2);
    for (const d of map.campDetail || []) if (touches(d.p)) fill(d.p, 2);
    for (const r of map.rail || []) if (touches(r.p)) stroke(r.p, 7, 2);
    for (const r of map.roads) if (!r.u && touches(r.p)) stroke(r.p, (ROADW[r.c] || 6) / 2 + 3, 3, 1);
    for (const r of map.roads) if (!r.u && touches(r.p)) stroke(r.p, (ROADW[r.c] || 6) / 2, 1);
    // keep the university grounds and big institutions clear of terraces
    for (const p of W.pois) if (/campus|library|museum/.test(p.category) && /usyd/.test(p.id)) stroke([[p.x - 1, p.z], [p.x + 1, p.z]], 60, 2);

    // ---------- candidate terraces along residential streets ----------
    let cap = 1 << 22, pos = new Float32Array(cap), col = new Float32Array(cap), n = 0;
    const c = new THREE.Color(), solids = [], cc = new Map();
    const rgb = hex => { let v = cc.get(hex); if (!v) { c.set(hex); v = [c.r, c.g, c.b]; cc.set(hex, v); } return v; };
    const grow = () => { cap *= 2; const p2 = new Float32Array(cap), c2 = new Float32Array(cap); p2.set(pos); c2.set(col); pos = p2; col = c2; };
    let frame = null;
    const VS = 1.35;   // vertical scale: 6.6 m design -> ~9 m real two-storey terrace
    const P = (u, v, w) => [frame.x + u * frame.tx + w * frame.nx, v * VS, frame.z + u * frame.tz + w * frame.nz];
    const tri = (a, b, d, hex) => { if (n + 9 > cap) grow(); const k = rgb(hex); for (const p of [a, b, d]) { pos[n] = p[0]; pos[n + 1] = p[1]; pos[n + 2] = p[2]; col[n] = k[0]; col[n + 1] = k[1]; col[n + 2] = k[2]; n += 3; } };
    const flat = (u0, u1, v0, v1, w, hex) => quad(P(u0, v0, w), P(u1, v0, w), P(u1, v1, w), P(u0, v1, w), hex);   // a flush detail: one quad
    const quad = (a, b, d, e, hex) => { tri(a, b, d, hex); tri(a, d, e, hex); };
    function box(u0, u1, v0, v1, w0, w1, hex) {
      const p = (u, v, w) => P(u, v, w);
      quad(p(u0, v0, w1), p(u1, v0, w1), p(u1, v1, w1), p(u0, v1, w1), hex);   // street face
      quad(p(u1, v0, w0), p(u0, v0, w0), p(u0, v1, w0), p(u1, v1, w0), hex);
      quad(p(u0, v0, w0), p(u0, v0, w1), p(u0, v1, w1), p(u0, v1, w0), hex);
      quad(p(u1, v0, w1), p(u1, v0, w0), p(u1, v1, w0), p(u1, v1, w1), hex);
      quad(p(u0, v1, w1), p(u1, v1, w1), p(u1, v1, w0), p(u0, v1, w0), hex);   // top
    }
    function terrace(seed, width) {
      const hw = width / 2, H = 6.6, d0 = -12.5, d1 = -2.2, body = BODY[Math.floor(hash("tb", seed) * BODY.length)], trim = TRIM[Math.floor(hash("tt", seed) * TRIM.length)];
      const roof = ROOF[Math.floor(hash("tr", seed) * ROOF.length)];
      box(-hw, hw, 0, H, d0, d1, body);
      // gable roof, ridge running front to back
      const rh = 2.1, a = P(-hw - .2, H, d1 + .3), b = P(hw + .2, H, d1 + .3), a2 = P(-hw - .2, H, d0 - .2), b2 = P(hw + .2, H, d0 - .2), r1 = P(0, H + rh, d1 + .3), r2 = P(0, H + rh, d0 - .2);
      quad(a, r1, r2, a2, roof); quad(r1, b, b2, r2, roof); tri(a, b, r1, body); tri(b2, a2, r2, body);
      // parapet with a little pediment on the street face
      box(-hw, hw, H - .2, H + .9, d1 - .3, d1, body); box(-.9, .9, H + .9, H + 1.5, d1 - .3, d1, body);
      // windows + door
      const w0 = d1 + .04, shop = frame.shop;
      if (shop) {   // painted Victorian shopfront + awning (shopfront.js)
        const a = P(-hw, 0, d1), b = P(hw, 0, d1);
        CL.shopfront.add(a[0], a[2], b[0], b[2], frame.nx, frame.nz, (H + .9) * VS, seed);
      } else {
        flat(.3, hw - .5, 1.1, 2.9, w0, "#7fb3d6"); flat(-hw + .5, -.2, 0, 2.5, w0, DOOR[Math.floor(hash("td", seed) * DOOR.length)]);
        flat(-hw + .6, -.3, 3.9, 5.6, w0, "#7fb3d6"); flat(.3, hw - .6, 3.9, 5.6, w0, "#7fb3d6");
      }
      if (frame.shop) { solids.push([P(-hw, 0, d1 - .1), P(hw, 0, d1 - .1), P(hw, 0, d0), P(-hw, 0, d0)].map(p => [p[0], p[2]])); return; }
      // verandah: floor, posts, balcony with iron lace, roof
      box(-hw, hw, 0, .3, d1, -.6, "#c9c1b3");
      for (const u of [-hw + .15, hw - .15]) box(u - .1, u + .1, .3, 6.0, -.8, -.6, trim);
      box(-hw, hw, 3.1, 3.35, d1, -.5, "#d9d2c3");
box(-hw + .1, hw - .1, 3.35, 4.2, -.6, -.5, trim === "#fbf8ef" ? "#fbf8ef" : "#e9e4d8");
      box(-hw - .1, hw + .1, 6.0, 6.2, d1, -.3, roof);
      // front fence
      box(-hw, hw, 0, .9, -.1, .1, trim === "#fbf8ef" ? "#fbf8ef" : "#2b2b2b");
      solids.push([P(-hw, 0, d1 - .1), P(hw, 0, d1 - .1), P(hw, 0, d0), P(-hw, 0, d0)].map(p => [p[0], p[2]]));
    }
    const streetTrees = [], shrubs = [];
    const free = (x, z) => at(x, z) === 0 && W.hit(x, z) < 0;
    let rows = 0, placed = 0;
    // nearest streets to home first, so the heart of the map always gets its terraces
    const home = CL.geo.toXZ(-33.88664, 151.17889), dist2 = r => { const [x, z] = r.p[0]; return (x - home.x) ** 2 + (z - home.z) ** 2; };
    const order = map.roads.filter(r => !r.u && (r.c === "street" || r.c === "tertiary" || r.c === "secondary" || r.c === "major") && r.p.every(inBox)).sort((a, b) => dist2(a) - dist2(b));
    for (const r of order) {
      const shop = r.c === "major" || r.c === "secondary" || /Missenden|King Street|Glebe Point|Enmore|Harris Street|Broadway|Abercrombie/.test(r.n || "");
      const half = (ROADW[r.c] || 7.5) / 2 + 2.6 - (shop ? 2.2 : 0);   // carriageway + footpath (shops sit on the building line)
      for (let s = 1; s < r.p.length; s++) {
        const [x1, z1] = r.p[s - 1], [x2, z2] = r.p[s], L = Math.hypot(x2 - x1, z2 - z1); if (L < 22) continue;
        const tx = (x2 - x1) / L, tz = (z2 - z1) / L;
        for (const side of [1, -1]) {
          const nx = -tz * side, nz = tx * side;   // pointing from the house toward the street
          const width = 5.2 + hash("w", r.p[0][0] + s * side) * .8;
          let run = 0;
          for (let t = 10 + width / 2; t < L - 10; t += width) {
            const fx = x1 + tx * t - nx * half, fz = z1 + tz * t - nz * half;   // frontage point
            frame = { x: fx, z: fz, tx, tz, nx, nz, shop };
            const probes = shop ? [[0, -3], [0, -7], [0, -12.5], [-width / 2 + .3, -3], [width / 2 - .3, -3], [-width / 2 + .3, -12], [width / 2 - .3, -12]] : [[0, -1], [0, -7], [0, -12.5], [-width / 2 + .3, -2.5], [width / 2 - .3, -2.5], [-width / 2 + .3, -12], [width / 2 - .3, -12]];
            if (!probes.every(([u, w]) => { const p = P(u, 0, w); return free(p[0], p[2]); })) { run = 0; continue; }
            if (placed > 30000) break;
            terrace(Math.floor(fx * 7 + fz * 13), width); placed++; run++;
            for (const [u, w] of [[0, -2], [0, -7], [0, -12]]) { const p = P(u, 0, w); const k = cell(p[0], p[2]); if (k >= 0) R[k] = 2; }
            for (const [u, w] of [[-width / 2 + .5, -7], [width / 2 - .5, -7], [-width / 2 + .5, -12], [width / 2 - .5, -12]]) { const p = P(u, 0, w); const k = cell(p[0], p[2]); if (k >= 0) R[k] = 2; }
            if (!shop && hash("sh", fx + fz) < .7) { const p = P((hash("su", fx) - .5) * (width - 1.5), 0, -1.2); shrubs.push([p[0], p[2], hash("sc", fz)]); }
          }
          if (run) rows++;
          // street trees on this side's footpath
          for (let t = 8; t < L - 8; t += 18 + hash("st", x1 + t) * 10) {
            const x = x1 + tx * t - nx * (half - 1.2), z = z1 + tz * t - nz * (half - 1.2);
            if (at(x, z) === 3 && W.hit(x, z) < 0 && hash("sk", x * 3 + z) < .45 && streetTrees.length < 26000) streetTrees.push([x, z, CL.foliage.pick(true, Math.floor(x * 13 + z * 7))]);
          }
        }
      }
    }
    if (n) {
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos.slice(0, n), 3)); g.setAttribute("color", new THREE.BufferAttribute(col.slice(0, n), 3)); g.computeVertexNormals(); pos = col = null;
      const m = new THREE.Mesh(g, K.bend(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: K.ramp, side: THREE.DoubleSide })));
      m.castShadow = m.receiveShadow = true; m.frustumCulled = false; scene.add(m);
    }
    // garden shrubs: rounded bushes, some in flower (hydrangea, bougainvillea, gardenia)
    if (shrubs.length) {
      const sm = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), K.bend(new THREE.MeshToonMaterial({ color: "#ffffff", gradientMap: K.ramp })), shrubs.length), d = new THREE.Object3D();
      const SH = ["#4f9e48", "#5fae4e", "#3f8a43", "#d86fa0", "#9db4e8", "#f4f1de", "#e0527a"];
      shrubs.forEach(([x, z, k], i) => { d.position.set(x, .7, z); d.scale.set(1.1, .8, .9); d.updateMatrix(); sm.setMatrixAt(i, d.matrix); sm.setColorAt(i, c.set(SH[Math.floor(k * SH.length)])); });
      sm.castShadow = true; sm.frustumCulled = false; scene.add(sm);
    }
    // collision for the new terraces
    for (const p of solids) {
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const [x, z] of p) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
      const id = W.solids.length; W.solids.push({ p: [...p, p[0]], kind: "infill", x0, x1, z0, z1 });
      for (let i = Math.floor(x0 / 25); i <= Math.floor(x1 / 25); i++) for (let j = Math.floor(z0 / 25); j <= Math.floor(z1 / 25); j++) { const k = i * 100003 + j; if (!W.solidGrid.has(k)) W.solidGrid.set(k, []); W.solidGrid.get(k).push(id); }
    }
    I.stats = { terraces: placed, rows, streetTrees: streetTrees.length, shrubs: shrubs.length };
    return streetTrees;
  };
})(window.CL = window.CL || {});
