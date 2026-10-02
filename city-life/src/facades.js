/* City Life - painted facades for the signature landmarks, drawn from their
   Wikimedia Commons photos (data/photos): each is one canvas tile that repeats
   along the wall every `bay` metres and `rows` times up it.
   Hand-painted in the toon style; nothing is copied from the photos. */
(function (CL) {
  const F = CL.facades = {}, cache = new Map();
  function canvas(w, h, draw) { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; }
  const rect = (x, c, a, b, w, h) => { x.fillStyle = c; x.fillRect(a, b, w, h); };
  const ashlar = (x, w, h, base, joint) => {   // coursed sandstone blocks
    rect(x, base, 0, 0, w, h);
    for (let r = 0, y = 0; y < h; r++, y += 16) {
      x.fillStyle = joint; x.fillRect(0, y, w, 1.5);
      for (let k = (r % 2) * 18; k < w; k += 36) x.fillRect(k, y, 1.5, 16);
      for (let k = 0; k < w; k += 36) { x.fillStyle = `rgba(255,255,255,${((r * 7 + k) % 5) * .018})`; x.fillRect(k + (r % 2) * 18, y + 1.5, 34, 14); }
    }
  };
  const brick = (x, w, h, a, b) => { rect(x, a, 0, 0, w, h); x.fillStyle = b; for (let y = 0; y < h; y += 6) { x.fillRect(0, y, w, 1); for (let k = (y / 6 % 2) * 8; k < w; k += 16) x.fillRect(k, y, 1, 6); } };
  const lancet = (x, cx, top, w, h, glass, stone) => {
    x.fillStyle = stone; x.beginPath(); x.moveTo(cx - w / 2 - 4, top + h); x.lineTo(cx - w / 2 - 4, top + w * .5); x.quadraticCurveTo(cx - w / 2 - 2, top - 4, cx, top - 8); x.quadraticCurveTo(cx + w / 2 + 2, top - 4, cx + w / 2 + 4, top + w * .5); x.lineTo(cx + w / 2 + 4, top + h); x.fill();
    x.fillStyle = glass; x.beginPath(); x.moveTo(cx - w / 2, top + h); x.lineTo(cx - w / 2, top + w * .5); x.quadraticCurveTo(cx - w / 2, top, cx, top - 3); x.quadraticCurveTo(cx + w / 2, top, cx + w / 2, top + w * .5); x.lineTo(cx + w / 2, top + h); x.fill();
    x.fillStyle = stone; x.fillRect(cx - 1.5, top, 3, h); x.fillRect(cx - w / 2, top + h * .45, w, 3);
  };

  const DEF = {
    // Hotel Marlborough: cream tiled ground floor on a green-tiled plinth, dark green awning band,
    // brown face brick above with a white render string course and wide steel-framed windows
    "hotel-marlborough": { bay: 6, rows: 1, tex: () => canvas(128, 256, (x, w, h) => {
      brick(x, w, h, "#7a3b2a", "#5e2c20");
      rect(x, "#f3efe6", 0, 150, w, 106); x.fillStyle = "#e3ddd0"; for (let k = 0; k < w; k += 16) x.fillRect(k, 150, 1, 106); for (let y = 150; y < h; y += 16) x.fillRect(0, y, w, 1);
      rect(x, "#27463a", 0, 232, w, 24); rect(x, "#1f3a30", 0, 138, w, 14);
      rect(x, "#2e4150", 14, 172, 100, 50); rect(x, "#6b8797", 18, 176, 44, 42);
      rect(x, "#f4f1ea", 0, 118, w, 8); rect(x, "#f4f1ea", 10, 40, 108, 66); rect(x, "#3f5463", 14, 44, 100, 58);
      x.fillStyle = "#f4f1ea"; for (const k of [38, 64, 90]) x.fillRect(k, 44, 3, 58); x.fillRect(14, 70, 100, 3);
      rect(x, "#f4f1ea", 0, 0, w, 8);
    }) },
    // Enmore Theatre: 1937 Art Deco, terracotta render with cream horizontal speed lines
    "enmore-theatre": { bay: 8, rows: 1, tex: () => canvas(128, 256, (x, w, h) => {
      rect(x, "#e3874f", 0, 0, w, h); x.fillStyle = "#f2d2a0"; for (const y of [30, 40, 50, 60]) x.fillRect(0, y, w, 4);
      rect(x, "#b84a3a", 0, 96, w, 6); rect(x, "#c9683f", 0, 180, w, 76);
      rect(x, "#3b2f2a", 0, 172, w, 10); rect(x, "#b5402f", 20, 196, 88, 60); x.fillStyle = "#e9c9a0"; for (let k = 26; k < 108; k += 14) x.fillRect(k, 200, 8, 52);
    }) },
    // Glebe Town Hall: Victorian Italianate, peach render, arched windows on both floors, balustrade parapet
    "glebe-town-hall": { bay: 4.5, rows: 1, tex: () => canvas(128, 256, (x, w, h) => {
      rect(x, "#f0c9a4", 0, 0, w, h); rect(x, "#e7b88f", 0, 0, w, 36);
      x.fillStyle = "#f7dcbf"; for (let k = 6; k < w; k += 20) { x.beginPath(); x.ellipse(k + 6, 20, 5, 9, 0, 0, 7); x.fill(); }
      rect(x, "#fbe3c8", 0, 36, w, 6); rect(x, "#fbe3c8", 0, 136, w, 8);
      for (const [top, hh] of [[62, 64], [164, 70]]) { x.fillStyle = "#fbe3c8"; x.beginPath(); x.moveTo(36, top + hh); x.lineTo(36, top + 14); x.arc(64, top + 14, 28, Math.PI, 0); x.lineTo(92, top + hh); x.fill(); x.fillStyle = "#3f5561"; x.beginPath(); x.moveTo(42, top + hh); x.lineTo(42, top + 16); x.arc(64, top + 16, 22, Math.PI, 0); x.lineTo(86, top + hh); x.fill(); x.fillStyle = "#fbe3c8"; x.fillRect(62, top + 4, 4, hh - 4); }
      rect(x, "#f7d6b6", 0, 0, 8, h); rect(x, "#f7d6b6", w - 8, 0, 8, h);
    }) },
    // Fisher Library podium: off-white concrete floor slabs over ribbon windows between square columns
    "fisher-library": { bay: 7, rows: 3, tex: () => canvas(128, 128, (x, w, h) => {
      rect(x, "#d9d4c8", 0, 0, w, h); rect(x, "#e9e5dc", 0, 0, w, 18); rect(x, "#2f3d47", 0, 18, w, 76); rect(x, "#5d7482", 0, 22, w, 20);
      x.fillStyle = "#c9c3b5"; for (let k = 0; k < w; k += 32) x.fillRect(k, 18, 5, 76); rect(x, "#ece8e0", 0, 94, w, 34);
    }) },
    // Fisher Stack: dark copper-clad tower with tight vertical fins
    "fisher-stack": { bay: 4, rows: 1, tex: () => canvas(64, 256, (x, w, h) => { rect(x, "#4d3a2c", 0, 0, w, h); x.fillStyle = "#7a5b44"; for (let k = 0; k < w; k += 8) x.fillRect(k, 0, 3, h); rect(x, "#6b6f6a", 0, 0, w, 10); }) },
    // Chau Chak Wing Museum: board-marked concrete panels with a long ribbon window
    "chau-chak-wing-museum": { bay: 6, rows: 1, tex: () => canvas(128, 256, (x, w, h) => {
      rect(x, "#c9c7c0", 0, 0, w, h); x.fillStyle = "#b9b7b0"; for (let y = 0; y < h; y += 42) x.fillRect(0, y, w, 2); x.fillRect(0, 0, 2, h);
      x.fillStyle = "#aeaca5"; for (let y = 10; y < h; y += 14) for (let k = 8; k < w; k += 20) x.fillRect(k, y, 2, 2);
      rect(x, "#2d3b44", 0, 150, w, 22); rect(x, "#5d7a88", 0, 152, w * .6, 6); rect(x, "#3a3a38", 0, 220, w, 36);
    }) },
    // Sandstone Gothic Revival (Quad, Great Hall, Anderson Stuart): coursed golden ashlar
    "usyd-quadrangle": { bay: 3.6, rows: 2, tex: () => canvas(64, 128, (x, w, h) => ashlar(x, w, h, "#d6a86a", "#b98a50")) },
    "usyd-great-hall": { bay: 3.6, rows: 2, tex: () => canvas(64, 128, (x, w, h) => ashlar(x, w, h, "#d8ab6c", "#b98a50")) },
    "anderson-stuart-building": { bay: 3.6, rows: 2, tex: () => canvas(64, 128, (x, w, h) => ashlar(x, w, h, "#d99c5c", "#b37a43")) },
    // St Stephen's: Pyrmont sandstone with lancet windows between buttresses, red doors
    "st-stephens-newtown": { bay: 4, rows: 1, tex: () => canvas(64, 256, (x, w, h) => { ashlar(x, w, h, "#d8b88a", "#b89868"); lancet(x, 32, 70, 22, 110, "#3a4550", "#c9a878"); rect(x, "#7a2e2a", 22, 220, 20, 36); }) },
    // Manning House: face brick with sandstone dressings and a round-arched entry
    "manning-house": { bay: 5, rows: 1, tex: () => canvas(128, 256, (x, w, h) => {
      brick(x, w, h, "#9a4a36", "#7a3829"); rect(x, "#d6b98c", 0, 0, w, 16); rect(x, "#d6b98c", 0, 120, w, 8);
      for (const top of [40, 150]) { rect(x, "#d6b98c", 30, top - 4, 68, 66); rect(x, "#3c4a54", 36, top, 56, 58); x.fillStyle = "#d6b98c"; x.fillRect(62, top, 4, 58); }
    }) },
    // Newtown station booking office: cream render, dark green joinery, verandah posts
    "newtown-station": { bay: 3, rows: 1, tex: () => canvas(64, 256, (x, w, h) => {
      rect(x, "#efe0b4", 0, 0, w, h); rect(x, "#3f5a3a", 0, 0, w, 14); rect(x, "#3f5a3a", 8, 120, 48, 90); rect(x, "#2e3a3e", 14, 126, 36, 80); rect(x, "#e8d7a8", 0, 212, w, 44); rect(x, "#3f5a3a", 0, 60, 6, 196);
    }) },
    // One Central Park: dark glass with planter ledges and hanging green every floor
    "one-central-park": { bay: 4, rows: 12, tex: () => canvas(64, 64, (x, w, h) => {
      rect(x, "#2d3f4c", 0, 0, w, h); rect(x, "#5b7f96", 4, 6, 26, 36); rect(x, "#46657a", 34, 6, 26, 36);
      rect(x, "#8a8f93", 0, 46, w, 6); x.fillStyle = "#5f8f3e"; for (let k = 0; k < w; k += 7) x.fillRect(k, 42 + (k % 3), 6, 8); x.fillStyle = "#79a857"; for (let k = 3; k < w; k += 11) x.fillRect(k, 52, 3, 12);
    }) },
    // Seymour Centre: dark glass curtain wall on a thin aluminium grid
    "seymour-centre": { bay: 3, rows: 3, tex: () => canvas(64, 64, (x, w, h) => { rect(x, "#1f2e3d", 0, 0, w, h); rect(x, "#4f6f8c", 4, 4, 22, 28); rect(x, "#cfd6dc", 0, 0, w, 2); rect(x, "#cfd6dc", 0, 0, 2, h); }) },
    // Rhodes House: 1920s warehouse face brick with big steel-framed windows
    "rhodes-house": { bay: 4, rows: 5, tex: () => canvas(64, 64, (x, w, h) => { brick(x, w, h, "#9a4e36", "#7a3a28"); rect(x, "#2b2b2b", 8, 10, 48, 40); rect(x, "#667f8e", 11, 13, 42, 34); x.fillStyle = "#2b2b2b"; x.fillRect(31, 13, 2, 34); x.fillRect(11, 29, 42, 2); rect(x, "#c9b79a", 6, 50, 52, 4); }) },
  };
  DEF["fisher-library-stack"] = DEF["fisher-stack"];
  F.has = id => !!DEF[id];
  F.get = function (id) {
    if (!DEF[id]) return null;
    if (!cache.has(id)) { const d = DEF[id]; cache.set(id, { tex: d.tex(), bay: d.bay, rows: d.rows }); }
    return cache.get(id);
  };
  // toon material for a facade (vertex colour white so the paint shows as drawn)
  F.material = id => { const f = F.get(id); return f && CL.chibi.bend(new THREE.MeshToonMaterial({ map: f.tex, gradientMap: CL.chibi.ramp, side: THREE.DoubleSide })); };
  // box with its side UVs scaled to the facade's bay/rows (top face gets a plain patch)
  F.box = function (id, w, h, d) {
    const f = F.get(id), g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, n = g.attributes.normal;
    for (let i = 0; i < uv.count; i++) {
      if (Math.abs(n.getY(i)) > .5) { uv.setXY(i, .02, .98); continue; }
      const len = Math.abs(n.getX(i)) > .5 ? d : w; uv.setXY(i, uv.getX(i) * len / f.bay, uv.getY(i) * f.rows);
    }
    return g;
  };
})(window.CL = window.CL || {});
