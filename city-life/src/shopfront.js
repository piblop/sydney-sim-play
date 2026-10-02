/* City Life - Victorian shopfronts for the main strips (King St, Enmore Rd,
   Glebe Point Rd, Missenden Rd, Harris St, Abercrombie St). Walls facing those
   streets are cut into ~5 m bays; each bay gets one of 12 painted shopfronts
   from an atlas (display window, recessed door, tiled stallboard, name board,
   sash windows with hoods above, a parapet) plus a cantilevered awning with a
   coloured fascia. Everything goes into two meshes built once. */
(function (CL) {
  const SF = CL.shopfront = {};
  const N = 12, CW = 128, CH = 256;
  const WORDS = ["CAFE", "THAI", "BOOKS", "VINTAGE", "RECORDS", "BAR", "DELI", "FLORIST", "PHO", "GELATO", "RAMEN", "TATTOO", "OP SHOP", "BAKERY", "PIZZA", "WINE", "YOGA", "GIFTS", "SUSHI", "BURGERS", "COMICS", "PLANTS", "DUMPLINGS", "BARBER"];
  const PAINT = [["#f3e3c6", "#8e3b2f"], ["#dfe5cf", "#2f4f3f"], ["#cfdbe3", "#2d3e5c"], ["#efd6c4", "#6b2a2e"], ["#f1e3a8", "#3b2f22"], ["#e6cfd9", "#5a2d4a"], ["#b0623f", "#f3e3c6"], ["#d9c3a0", "#2f4f3f"], ["#c8d8c0", "#6b2a2e"], ["#f6d6cb", "#264653"], ["#e8d9b5", "#b5402f"], ["#a5533a", "#fbf8ef"]];
  const AWN = ["#e76f51", "#2a9d8f", "#264653", "#e9c46a", "#b5446e", "#3a6ea5", "#7d4e2d", "#f4a261", "#5a8f3e", "#8338ec", "#d62828", "#1d3557"];
  let atlas = null;
  function makeAtlas() {
    const c = document.createElement("canvas"); c.width = CW * N; c.height = CH; const x = c.getContext("2d");
    for (let i = 0; i < N; i++) {
      const o = i * CW, [wall, trim] = PAINT[i], word = WORDS[(i * 7) % WORDS.length], word2 = WORDS[(i * 5 + 3) % WORDS.length];
      const R = (col, a, b, w, h) => { x.fillStyle = col; x.fillRect(o + a, b, w, h); };
      R(wall, 0, 0, CW, CH);
      // parapet with a little pediment and cornice
      R(trim, 0, 0, CW, 6); R(wall, 0, 6, CW, 26); R(trim, 0, 30, CW, 4); x.fillStyle = trim; x.beginPath(); x.moveTo(o + 44, 6); x.lineTo(o + 64, -8); x.lineTo(o + 84, 6); x.fill();
      // first floor: two tall sash windows with hoods (or one wide bay window on odd cells)
      if (i % 3 === 2) { R(trim, 14, 48, 100, 70); R("#6f93ad", 20, 54, 88, 58); R(trim, 62, 54, 4, 58); R(trim, 20, 82, 88, 3); }
      else for (const a of [18, 72]) { R(trim, a - 4, 42, 46, 6); R("#fbf8ef", a, 50, 38, 66); R("#6f93ad", a + 4, 54, 30, 58); R("#fbf8ef", a + 4, 81, 30, 3); if (i % 2) { R("#5a8f3e", a - 2, 116, 42, 6); for (let k = 0; k < 5; k++) R(["#ff8fab", "#ffd166", "#f4f1de"][k % 3], a + k * 8, 112, 4, 4); } }
      // name board over the shop
      R(trim, 4, 132, CW - 8, 26); x.fillStyle = wall === "#a5533a" || wall === "#b0623f" ? "#fbf8ef" : wall; x.font = "900 17px 'Trebuchet MS', sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(i % 4 === 3 ? word + " & " + word2 : word, o + CW / 2, 146);
      // shopfront: display window, recessed door, tiled stallboard
      R("#3b3027", 4, 160, CW - 8, 96);
      R("#8fc3de", 10, 164, 72, 64); R("#c7e3f1", 10, 164, 20, 64); R("#3b3027", 44, 164, 3, 64);
      // goods in the window
      for (let k = 0; k < 4; k++) R(["#e76f51", "#e9c46a", "#2a9d8f", "#f4f1de", "#b5446e"][(i + k) % 5], 16 + k * 16, 208 - (k % 2) * 8, 10, 14 + (k % 2) * 8);
      R(i % 2 ? "#2d3e5c" : "#6b2a2e", 88, 164, 32, 92); R("#c7e3f1", 94, 170, 20, 34); R("#e9c46a", 112, 214, 3, 6);
      const tile = i % 3 === 0 ? "#2f6f4f" : i % 3 === 1 ? "#1d3557" : "#8e3b2f"; R(tile, 10, 230, 72, 26); x.fillStyle = "rgba(255,255,255,.18)"; for (let k = 10; k < 82; k += 8) x.fillRect(o + k, 230, 1, 26);
      // A-frame sign on the footpath
      if (i % 4 === 1) { R("#1b1b1b", 58, 236, 18, 20); R("#fbf8ef", 60, 240, 14, 3); R("#fbf8ef", 60, 246, 10, 2); }
    }
    const t = new THREE.CanvasTexture(c); t.anisotropy = 8; return t;
  }
  let fp, fn, fuv, ap, acol, fN = 0;
  SF.begin = function () { fp = []; fn = []; fuv = []; ap = []; acol = []; fN = 0; };
  const col = new THREE.Color();
  // a wall edge (x1,z1)->(x2,z2) with outward normal (nx,nz), height h: cut into bays
  SF.add = function (x1, z1, x2, z2, nx, nz, h, seed) {
    const L = Math.hypot(x2 - x1, z2 - z1); if (L < 3.5) return false;
    const n = Math.max(1, Math.round(L / 5.2)), bw = L / n, tx = (x2 - x1) / L, tz = (z2 - z1) / L;
    const H = Math.min(h, 10.5), off = .06;   // shopfront art covers two storeys; anything taller keeps the plain wall above
    for (let b = 0; b < n; b++) {
      const k = Math.floor(CL.hash01("sf" + seed, b) * N), u0 = k / N + .002, u1 = (k + 1) / N - .002;
      const ax = x1 + tx * bw * b + nx * off, az = z1 + tz * bw * b + nz * off, bx = ax + tx * bw, bz = az + tz * bw;
      const q = [[ax, 0, az, u0, 0], [bx, 0, bz, u1, 0], [bx, H, bz, u1, 1], [ax, 0, az, u0, 0], [bx, H, bz, u1, 1], [ax, H, az, u0, 1]];
      for (const [x, y, z, u, v] of q) { fp.push(x, y, z); fn.push(nx, 0, nz); fuv.push(u, v); }
      // cantilevered awning: sloped top, coloured fascia at the kerb edge
      col.set(AWN[(k + Math.floor(CL.hash01("aw" + seed, b) * 3)) % AWN.length]);
      const y0 = H * .385, y1 = y0 + .35, d = 2.4, cx = nx * d, cz = nz * d;
      const quad = (p, c) => { for (const i of [0, 1, 2, 0, 2, 3]) { ap.push(...p[i]); acol.push(c.r, c.g, c.b); } };
      quad([[ax, y1 + .25, az], [bx, y1 + .25, bz], [bx + cx, y1, bz + cz], [ax + cx, y1, az + cz]], col.clone().offsetHSL(0, 0, .08));
      quad([[ax + cx, y1, az + cz], [bx + cx, y1, bz + cz], [bx + cx, y0, bz + cz], [ax + cx, y0, az + cz]], col);
      quad([[ax, y0, az], [ax + cx, y0, az + cz], [bx + cx, y0, bz + cz], [bx, y0, bz]], new THREE.Color("#3b3530"));
      fN++;
    }
    return true;
  };
  SF.finish = function (scene) {
    if (!fN) return 0;
    if (!atlas) atlas = makeAtlas();
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(fp, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(fn, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(fuv, 2));
    const m = new THREE.Mesh(g, CL.chibi.bend(new THREE.MeshToonMaterial({ map: atlas, gradientMap: CL.chibi.ramp, side: THREE.DoubleSide }))); m.receiveShadow = true; m.frustumCulled = false; scene.add(m);
    const g2 = new THREE.BufferGeometry(); g2.setAttribute("position", new THREE.Float32BufferAttribute(ap, 3)); g2.setAttribute("color", new THREE.Float32BufferAttribute(acol, 3)); g2.computeVertexNormals();
    const m2 = new THREE.Mesh(g2, CL.chibi.bend(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: CL.chibi.ramp, side: THREE.DoubleSide }))); m2.castShadow = m2.receiveShadow = true; m2.frustumCulled = false; scene.add(m2);
    const n = fN; SF.count = n; fp = fn = fuv = ap = acol = null; return n;
  };

  // which street edges are "shopping strip": sample the named main roads into a 6 m grid
  const STRIPS = /King Street|Enmore Road|Glebe Point Road|Missenden Road|Harris Street|Abercrombie Street|Broadway|Parramatta Road|City Road/;
  let grid = null;
  SF.index = function (map, inBox) {
    grid = new Set();
    for (const r of map.roads) {
      if (r.u || !STRIPS.test(r.n || "") || !r.p.some(inBox)) continue;
      for (let i = 1; i < r.p.length; i++) { const [x1, z1] = r.p[i - 1], [x2, z2] = r.p[i], L = Math.hypot(x2 - x1, z2 - z1); for (let s = 0; s <= L; s += 3) { const x = x1 + (x2 - x1) * s / L, z = z1 + (z2 - z1) * s / L; grid.add(Math.floor(x / 6) * 100003 + Math.floor(z / 6)); } }
    }
    return grid.size;
  };
  // is the point (a wall midpoint pushed out toward the street) on a strip?
  SF.onStrip = function (x, z, nx, nz) {
    if (!grid) return false;
    for (const d of [5, 9, 13]) { const px = x + nx * d, pz = z + nz * d; if (grid.has(Math.floor(px / 6) * 100003 + Math.floor(pz / 6))) return true; }
    return false;
  };
  SF.STRIPS = STRIPS;
})(window.CL = window.CL || {});
