/* City Life - signature landmarks on the storybook map, from research/landmark_models.json
   (OSM footprints + heritage listings). A landmark takes over the OSM footprint under
   its centre and gets its researched wall/roof colours, then extras: towers, spires,
   clock faces, green walls, rooftop pool + court, painted signs.
   Heights use the same compression as ordinary buildings: g(H) = 3 + 2.4 (H/3.1)^0.6. */
(function (CL) {
  const K = CL.chibi, L3 = CL.landmarks3d = {};
  const g = H => { H = Math.max(H, 4); return H <= 22 ? H * 1.02 : 22.4 + (H - 22) * .5; };   // real metres, tall towers compressed

  // per-landmark extras (offsets in metres from the landmark centre: +x east, +z south), from the research notes
  const EXTRA = {
    "usyd-quadrangle": [{ t: "tower", dx: 44, dz: 0, w: 9, H: 36, cap: "pinnacles", clock: true }],
    "usyd-great-hall": [{ t: "turrets", H: 22 }, { t: "window", side: "east", w: 7, h: 12 }],
    "fisher-library": [{ t: "block", dx: 0, dz: 15, w: 40, d: 30, H: 38, colour: "#6e4b33", slots: true }],
    "anderson-stuart-building": [{ t: "tower", dx: 0, dz: -30, w: 8, H: 26, cap: "pinnacles" }],
    "st-stephens-newtown": [{ t: "tower", dx: -14, dz: 0, w: 6, H: 20, cap: "spire", spireH: 43 }],
    "glebe-town-hall": [{ t: "tower", dx: 0, dz: 0, w: 4, H: 22, cap: "dome", clock: true }],
    "newtown-station": [{ t: "tower", dx: 0, dz: 0, w: 1.6, H: 12, cap: "dome" }, { t: "sign", text: "NEWTOWN", bg: "#1b4f8a", fg: "#ffffff" }],
    "enmore-theatre": [{ t: "fin", w: 5, H: 24, colour: "#e3874f", stripes: "#f2d2a0" }, { t: "sign", text: "ENMORE", bg: "#b8323c", fg: "#fff6d5", blade: true }, { t: "sign", text: "LIVE TONIGHT", bg: "#fff6d5", fg: "#b8323c", low: true }],
    "hotel-marlborough": [{ t: "sign", text: "THE HOTEL MARLBOROUGH", bg: "#1f3a30", fg: "#f4f1ea", low: true }, { t: "sign", text: "MARLBOROUGH", bg: "#1f4fa0", fg: "#ffffff", blade: true }, { t: "fin", w: 3, H: 22, colour: "#f4f1ea", flag: true }],
    "manning-house": [{ t: "sign", text: "MANNING BAR", bg: "#5c3c92", fg: "#fff" }],
    "rhodes-house": [{ t: "roofpool", w: 15, d: 5, dx: 25 }, { t: "roofcourt", w: 30, d: 15, dx: -5 }, { t: "sign", text: "RHODES HOUSE", bg: "#9a4e36", fg: "#fff6e6", low: true }],
    "one-central-park": [{ t: "block", lat: -33.88455, lon: 151.20110, w: 52, d: 32, H: 117, colour: "#8fb3c4", green: true }, { t: "block", lat: -33.88452, lon: 151.20040, w: 50, d: 37, H: 64, colour: "#8fb3c4", green: true }],
    "charles-perkins-centre": [{ t: "sign", text: "CHARLES PERKINS CENTRE", bg: "#d6be8f", fg: "#3b3b3b", low: true }],
    "chau-chak-wing-museum": [{ t: "sign", text: "CHAU CHAK WING MUSEUM", bg: "#cdb48a", fg: "#3b2f22", low: true }],
    "victoria-park-pool": [{ t: "pool", dx: 0, dz: 45, w: 50, d: 20 }],
  };

  // which footprint polygon each landmark owns (by the OSM solid under its centre)
  L3.claim = function (landmarks) {
    const own = new Map();
    for (const l of landmarks || []) {
      const c = CL.geo.toXZ(l.lat, l.lon);
      let id = CL.world.hit(c.x, c.z);
      if (id < 0) {   // centre on a courtyard or lawn: take the nearby footprint closest in size to the researched one
        let best = -1, ba = 0;
        CL.world.solids.forEach((so, i) => {
          if (so.kind !== "building" || so.x1 < c.x - 90 || so.x0 > c.x + 90 || so.z1 < c.z - 90 || so.z0 > c.z + 90) return;
          const mx = (so.x0 + so.x1) / 2, mz = (so.z0 + so.z1) / 2; if (Math.hypot(mx - c.x, mz - c.z) > 80) return;
          let a = 0; for (let k = 0; k < so.p.length - 1; k++) a += so.p[k][0] * so.p[k + 1][1] - so.p[k + 1][0] * so.p[k][1]; a = Math.abs(a) / 2;
          const want = l.footprint ? l.footprint.length * l.footprint.width * .8 : 2000, score = Math.abs(Math.log(a / want)) + Math.hypot(mx - c.x, mz - c.z) / 60;
          if (a < want * 3 && a > want / 4 && (best < 0 || score < ba)) { ba = score; best = i; }
        });
        id = best;
      }
      if (id >= 0) own.set(CL.world.solids[id].p, l);
      l._gothic = GOTHIC.has(l.id);
      l._c = c;
    }
    return own;
  };
  const GOTHIC = new Set(["usyd-quadrangle", "usyd-great-hall", "anderson-stuart-building", "st-stephens-newtown"]);
  // pointed-arch window: sandstone surround, dark leaded glass, a mullion and a quatrefoil
  const archTex = (() => {
    const c = document.createElement("canvas"); c.width = 64; c.height = 128; const x = c.getContext("2d");
    x.fillStyle = "#b8955e"; x.beginPath(); x.moveTo(6, 128); x.lineTo(6, 52); x.quadraticCurveTo(8, 10, 32, 2); x.quadraticCurveTo(56, 10, 58, 52); x.lineTo(58, 128); x.closePath(); x.fill();
    x.fillStyle = "#2f4150"; x.beginPath(); x.moveTo(13, 124); x.lineTo(13, 54); x.quadraticCurveTo(15, 20, 32, 11); x.quadraticCurveTo(49, 20, 51, 54); x.lineTo(51, 124); x.closePath(); x.fill();
    x.fillStyle = "#6f8fa8"; x.fillRect(15, 58, 7, 60);
    x.fillStyle = "#b8955e"; x.fillRect(30, 30, 4, 94); x.beginPath(); x.arc(32, 36, 7, 0, 7); x.fill(); x.fillStyle = "#2f4150"; x.beginPath(); x.arc(32, 36, 3.5, 0, 7); x.fill();
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
  })();
  L3.gothic = function (scene, l, pts, h) {
    const wall = l.walls.colour, slate = "#4a4f57", trim = "#b8955e", rh = 4.2, inset = 6;
    const d = new THREE.Object3D(), wins = [], merlons = [], butts = [];
    const rp = [], add = (a, b, c) => rp.push(...a, ...b, ...c);
    for (let i = 0; i < pts.length; i++) {
      const [x1, z1] = pts[i], [x2, z2] = pts[(i + 1) % pts.length], L = Math.hypot(x2 - x1, z2 - z1); if (L < 1.5) continue;
      const tx = (x2 - x1) / L, tz = (z2 - z1) / L, ox = tz, oz = -tx;   // outward normal (CCW footprint)
      // steep slate slope rising inward to a ridge
      const ix1 = x1 - ox * inset + tx * Math.min(inset, L / 2), iz1 = z1 - oz * inset + tz * Math.min(inset, L / 2), ix2 = x2 - ox * inset - tx * Math.min(inset, L / 2), iz2 = z2 - oz * inset - tz * Math.min(inset, L / 2);
      add([x1 + ox * .3, h, z1 + oz * .3], [x2 + ox * .3, h, z2 + oz * .3], [ix2, h + rh, iz2]); add([x1 + ox * .3, h, z1 + oz * .3], [ix2, h + rh, iz2], [ix1, h + rh, iz1]);
      const ry = Math.atan2(ox, oz);
      // windows in two rows, buttresses between bays, battlements along the parapet
      for (let s = 2.2; s < L - 1.2; s += 3.6) {
        const x = x1 + tx * s, z = z1 + tz * s;
        for (const y of [h * .28, h * .66]) wins.push([x + ox * .06, y, z + oz * .06, ry]);
        if (s + 1.8 < L - 1 && Math.round(s / 3.6) % 2 === 0) butts.push([x + tx * 1.8 + ox * .35, z + tz * 1.8 + oz * .35, ry]);
      }
      for (let s = .5; s < L - .3; s += 1.4) merlons.push([x1 + tx * s + ox * .15, z1 + tz * s + oz * .15, ry]);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(rp, 3)); g.computeVertexNormals();
    const roof = new THREE.Mesh(g, K.bend(new THREE.MeshToonMaterial({ color: slate, gradientMap: K.ramp, side: THREE.DoubleSide }))); roof.castShadow = roof.receiveShadow = true; scene.add(roof);
    const inst = (geo, mat, list, place) => { if (!list.length) return; const m = new THREE.InstancedMesh(geo, mat, list.length); list.forEach((v, i) => { place(v); d.updateMatrix(); m.setMatrixAt(i, d.matrix); }); m.castShadow = true; m.frustumCulled = false; scene.add(m); };
    inst(new THREE.PlaneGeometry(1.6, 3.2), K.bend(new THREE.MeshBasicMaterial({ map: archTex, transparent: true, alphaTest: .5, side: THREE.DoubleSide })), wins, ([x, y, z, ry]) => { d.position.set(x, y, z); d.rotation.set(0, ry, 0); d.scale.set(1, 1, 1); });
    const bg = new THREE.BoxGeometry(.7, 1, .8); bg.translate(0, .5, 0);
    inst(bg, K.toon(trim), butts, ([x, z, ry]) => { d.position.set(x, 0, z); d.rotation.set(0, ry, 0); d.scale.set(.8, h * .5, .9); });
    const mg = new THREE.BoxGeometry(.7, .8, .5); mg.translate(0, .4, 0);
    inst(mg, K.toon(trim), merlons, ([x, z, ry]) => { d.position.set(x, h, z); d.rotation.set(0, ry, 0); d.scale.set(1, 1, 1); });
    // pinnacles at the corners
    for (const [x, z] of pts) { box(scene, .9, 1.4, .9, trim, x, h, z); cone(scene, .5, 2.6, trim, x, h + 1.4, z); }
  };
  L3.heightFor = l => g(Math.min(l.height, 30));   // the main body; towers go taller below

  const box = (scene, w, h, d, colour, x, y, z, ry) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), K.toon(colour)); m.position.set(x, y + h / 2, z); m.rotation.y = ry || 0;
    m.castShadow = m.receiveShadow = true; scene.add(m); return m;
  };
  const cone = (scene, r, h, colour, x, y, z, seg) => { const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg || 4), K.toon(colour)); m.position.set(x, y + h / 2, z); m.rotation.y = Math.PI / 4; m.castShadow = true; scene.add(m); return m; };
  function signTex(text, bg, fg) {
    const c = document.createElement("canvas"), n = text.length; c.width = Math.max(256, n * 44); c.height = 96; const x = c.getContext("2d");
    x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height); x.strokeStyle = fg; x.lineWidth = 6; x.strokeRect(6, 6, c.width - 12, c.height - 12);
    x.fillStyle = fg; x.font = "900 58px 'Trebuchet MS', system-ui, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(text, c.width / 2, c.height / 2 + 3);
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return { t, aspect: c.width / c.height };
  }
  // the footprint edge closest to a street, with its outward normal
  function streetEdge(pts) {
    let best = null;
    for (let i = 0; i < pts.length; i++) {
      const [x1, z1] = pts[i], [x2, z2] = pts[(i + 1) % pts.length], L = Math.hypot(x2 - x1, z2 - z1); if (L < 4) continue;
      const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2, n = CL.world.nearestNode(mx, mz); if (n < 0) continue;
      const d = Math.hypot(CL.world.nodes.xs[n] - mx, CL.world.nodes.zs[n] - mz) - L * 0.05;
      if (!best || d < best.d) best = { d, mx, mz, L, nx: (z2 - z1) / L, nz: -(x2 - x1) / L };
    }
    return best;
  }

  // a shopfront sign over the street-facing wall (every building that holds a place)
  const signCache = new Map();
  L3.shopSign = function (scene, pts, text, bg, fg, h, at) {
    const s = pts ? streetEdge(pts) : at; if (!s || !text) return null;
    const key = text + bg + fg; if (!signCache.has(key)) signCache.set(key, signTex(text.length > 22 ? text.slice(0, 21) + '…' : text, bg, fg));
    const { t, aspect } = signCache.get(key), sw = Math.min(9, 2.1 * aspect), shh = sw / aspect;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(sw, shh), K.bend(new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide })));
    if (pts) {   // blade sign hanging off the wall over the footpath, readable from both directions
      const y = Math.min(h - shh / 2 - .2, 4.2);
      board.position.set(s.mx + s.nx * (sw / 2 + .35), y, s.mz + s.nz * (sw / 2 + .35)); board.rotation.y = Math.atan2(s.nx, s.nz) + Math.PI / 2;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(.12, .12, sw + .5), K.toon('#3d3a36')); arm.position.set(s.mx + s.nx * (sw / 2 + .3), y + shh / 2 + .1, s.mz + s.nz * (sw / 2 + .3)); arm.rotation.y = Math.atan2(s.nx, s.nz); scene.add(arm);
    } else {     // freestanding sandwich board on two posts
      board.position.set(s.x, 2.3, s.z); board.rotation.y = s.ry || 0;
      for (const o of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(.15, 2.3, .15), K.toon('#8b5e3c')); post.position.set(s.x + Math.cos(s.ry || 0) * o * sw * .42, 1.15, s.z - Math.sin(s.ry || 0) * o * sw * .42); scene.add(post); }
    }
    scene.add(board); return s;
  };
  L3.decorate = function (scene, l, pts, h) {
    if (l._gothic) L3.gothic(scene, l, pts, h);
    const c = l._c, extras = EXTRA[l.id] || [], roofCol = (l.roof && l.roof.colour) || "#4a4f57";
    for (const e of extras) {
      if (e.t === "tower") {
        const x = c.x + (e.dx || 0), z = c.z + (e.dz || 0), th = g(e.H) + 2.5;
        box(scene, e.w, th, e.w, l.walls.colour, x, 0, z);
        box(scene, e.w + .6, .5, e.w + .6, "#b8955e", x, th - .5, z);
        if (e.cap === "spire") cone(scene, e.w * .62, g(e.spireH) + 5 - th, roofCol, x, th, z);
        else if (e.cap === "dome") { const s = new THREE.Mesh(new THREE.SphereGeometry(e.w * .55, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), K.toon("#6f8f7a")); s.position.set(x, th, z); scene.add(s); }
        else if (e.cap === "pinnacles") { for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cone(scene, .5, 2.4, l.walls.colour, x + sx * e.w * .42, th, z + sz * e.w * .42); cone(scene, e.w * .45, 3, roofCol, x, th, z); }
        if (e.clock) for (const [ox, oz, ry] of [[0, e.w / 2 + .06, 0], [0, -e.w / 2 - .06, Math.PI], [e.w / 2 + .06, 0, Math.PI / 2], [-e.w / 2 - .06, 0, -Math.PI / 2]]) {
          const f = new THREE.Mesh(new THREE.CircleGeometry(e.w * .28, 24), K.bend(new THREE.MeshBasicMaterial({ color: "#fdf6e3" }))); f.position.set(x + ox, th - e.w * .55, z + oz); f.rotation.y = ry; scene.add(f);
          const hnd = new THREE.Mesh(new THREE.PlaneGeometry(.18, e.w * .22), K.bend(new THREE.MeshBasicMaterial({ color: "#2b2320" }))); hnd.position.set(x + ox * 1.01, th - e.w * .5, z + oz * 1.01); hnd.rotation.y = ry; scene.add(hnd);
        }
      } else if (e.t === "fin") {   // a tall parapet fin rising off the street corner (from the photos)
        const s = streetEdge(pts); if (!s) continue;
        const fh = g(e.H) + 3, x = s.mx - s.nx * e.w * .4, z = s.mz - s.nz * e.w * .4, ry = Math.atan2(s.nx, s.nz);
        box(scene, e.w, fh, e.w * .8, e.colour, x, 0, z, ry);
        if (e.stripes) for (const o of [-.3, 0, .3]) box(scene, .3, fh * .55, e.w * .82, e.stripes, x + Math.cos(ry) * o * e.w, fh * .4, z - Math.sin(ry) * o * e.w, ry);
        if (e.flag) { box(scene, .15, 5, .15, "#8a8a8a", x, fh, z); box(scene, 1.6, 1, .05, "#1d3f8a", x + .8, fh + 3.6, z); }
      } else if (e.t === "block") {
        const p = e.lat ? CL.geo.toXZ(e.lat, e.lon) : { x: c.x + (e.dx || 0), z: c.z + (e.dz || 0) }, bh = g(e.H);
        const fid = e.facade || (l.id === "fisher-library" ? "fisher-stack" : CL.facades.has(l.id) ? l.id : null);
        if (fid) { const bm = new THREE.Mesh(CL.facades.box(fid, e.w * .9, bh, e.d * .9), CL.facades.material(fid)); bm.position.set(p.x, bh / 2, p.z); bm.castShadow = bm.receiveShadow = true; scene.add(bm); }
        else box(scene, e.w * .9, bh, e.d * .9, e.colour, p.x, 0, p.z);
        box(scene, e.w * .9 + .6, .6, e.d * .9 + .6, "#e9e2d2", p.x, bh, p.z);
        if (e.slots && !fid) for (let i = -3; i <= 3; i++) box(scene, .7, bh * .7, .2, "#3b2a1e", p.x + i * e.w * .12, bh * .15, p.z + e.d * .45 + .1);
        if (e.green && !fid) for (let i = -3; i <= 3; i++) for (const s of [1, -1]) { box(scene, 2.2, bh * .8, .5, "#5f8f3e", p.x + i * e.w * .13, bh * .1, p.z + s * (e.d * .45 + .2)); }
        if (e.green && e.H > 100) box(scene, 16, .8, 10, "#d7dde0", p.x - e.w * .35, bh * .82, p.z);   // the heliostat cantilever
      } else if (e.t === "turrets") {
        let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const [x, z] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
        for (const [x, z] of [[x0 + 1.5, z0 + 1.5], [x1 - 1.5, z0 + 1.5], [x0 + 1.5, z1 - 1.5], [x1 - 1.5, z1 - 1.5]]) { box(scene, 2.2, g(e.H), 2.2, l.walls.colour, x, 0, z); cone(scene, 1.4, 2.6, roofCol, x, g(e.H), z); }
      } else if (e.t === "window") {
        let xe = -Infinity, zc = 0, n = 0; for (const [x, z] of pts) { if (x > xe) xe = x; zc += z; n++; }
        const w = new THREE.Mesh(new THREE.PlaneGeometry(e.w * .6, g(e.h) * .8), K.bend(new THREE.MeshBasicMaterial({ color: "#7fb3d6" }))); w.position.set(xe + .1, g(e.h) * .5, zc / n); w.rotation.y = Math.PI / 2; scene.add(w);
      } else if (e.t === "roofpool" || e.t === "roofcourt" || e.t === "pool") {
        const y = e.t === "pool" ? .15 : h + .15, col = e.t === "roofcourt" ? "#4f9e62" : "#5fc8e6";
        const m = new THREE.Mesh(new THREE.PlaneGeometry(e.w * .9, e.d * .9).rotateX(-Math.PI / 2), K.bend(new THREE.MeshToonMaterial({ color: col, gradientMap: K.ramp })));
        m.position.set(c.x + (e.dx || 0), y, c.z + (e.dz || 0)); m.rotation.y = -(l.footprint.bearing - 90) * Math.PI / 180; m.receiveShadow = true; scene.add(m);
        if (e.t === "roofcourt") { const ln = new THREE.Mesh(new THREE.PlaneGeometry(.3, e.d * .9).rotateX(-Math.PI / 2), K.bend(new THREE.MeshBasicMaterial({ color: "#ffffff" }))); ln.position.copy(m.position); ln.position.y += .02; ln.rotation.y = m.rotation.y; scene.add(ln); }
      } else if (e.t === "sign") {
        const s = streetEdge(pts); if (!s) continue;
        const { t, aspect } = signTex(e.text, e.bg, e.fg), sh = e.blade ? 5.5 : 1.8, sw = e.blade ? 1.8 : Math.min(s.L * .8, sh * aspect);
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(e.blade ? sh * aspect * .35 : sw, e.blade ? sh * .9 : sw / aspect), K.bend(new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide })));
        const y = e.low ? 3.4 : h - (e.blade ? 0 : 1.6);
        plane.position.set(s.mx + s.nx * (e.blade ? 1.2 : .15), y + (e.blade ? 1.5 : 0), s.mz + s.nz * (e.blade ? 1.2 : .15));
        plane.rotation.y = Math.atan2(s.nx, s.nz) + (e.blade ? Math.PI / 2 : 0);
        scene.add(plane);
      }
    }
  };
})(window.CL = window.CL || {});
