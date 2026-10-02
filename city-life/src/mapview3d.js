/* City Life - the storybook 3D map (Animal Crossing-ish): a low perspective
   camera that follows you, the world curving away like a rolling log, toon
   shading, extruded pastel buildings with hipped roofs and windows, round
   trees, sandy streets, and chibi townsfolk with walk cycles.
   Same interface as the offline/google map views (see mapview.js). */
(function (CL) {
  const { geo } = CL, K = CL.chibi, MVS = CL.mapview;
  const FOV = 36;

  MVS.ac = function (host) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const SKY = new THREE.Color("#a8e0f5"), NIGHT = new THREE.Color("#2a3563");
    scene.background = SKY.clone();
    const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 4000);
    const overlay = new THREE.Group(); overlay.position.y = -6.2; overlay.renderOrder = 10;
    const layer = document.createElement("div"); layer.className = "mk-layer"; host.appendChild(layer);
    const home = geo.toXZ(-33.88664, 151.17889);
    const view = { cx: home.x, cz: home.z, dist: 80, pitch: 0.78, yaw: 0, yawGoal: 0, w: 1, h: 1 };

    // light: soft sky fill + a warm sun from the north (Sydney), shadows falling toward the camera
    const hemi = new THREE.HemisphereLight("#ffffff", "#b8d8a0", 0.62);
    const sun = new THREE.DirectionalLight("#fff6e2", 0.5);
    sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0006;
    Object.assign(sun.shadow.camera, { left: -110, right: 110, top: 110, bottom: -110, near: 10, far: 400 });
    scene.add(hemi, sun, sun.target);
    const world = buildWorld(scene, window.SYD_MAP);
    scene.add(overlay);
    const people = makePeople(scene);

    const markers = new Set(); let tanHv = Math.tan(FOV * Math.PI / 360);
    const bendK = () => 0;   // horizon roll off: flat reads cleaner at this camera angle
    const api = {
      mode: "ac", overlay, renderer, host,
      mpp: () => 2 * view.dist * tanHv / Math.max(1, view.h),
      center: () => ({ x: view.cx, z: view.cz }),
      panTo(x, z) { view.cx = x; view.cz = z; },
      followTo(x, z) { view.cx += (x - view.cx) * 0.15; view.cz += (z - view.cz) * 0.15; },
      zoomTo(mpp) { if (view.h <= 1) { view.pendingMpp = mpp; return; } view.dist = CL.clamp(mpp * view.h / (2 * tanHv), 30, 900); },
      yaw: () => view.yaw,
      camera,
      setCine(fn) { if (fn) { api._saved = { dist: view.dist, pitch: view.pitch, yaw: view.yaw }; api._cine = fn; api._cineT0 = performance.now() / 1000; } else if (api._cine) { api._cine = null; Object.assign(view, { dist: api._saved.dist, pitch: api._saved.pitch }); view.yawGoal = view.yaw = api._saved.yaw; } },
      rotateBy(a) { view.yawGoal += a; view.yaw += a; },
      rotateStep(dir) { view.yawGoal += dir * Math.PI / 4; },
      zoomBy(f) { view.dist = CL.clamp(view.dist * f, 30, 900); },
      project(x, z, y) {
        const v = new THREE.Vector3(x, (y || 0) - K.drop(x, z), z).project(camera);
        return { x: (v.x * .5 + .5) * view.w, y: (-v.y * .5 + .5) * view.h, back: v.z > 1 };
      },
      unproject(sx, sy) {
        const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(sx / view.w * 2 - 1, -(sy / view.h) * 2 + 1), camera);
        let y = 0, hit = new THREE.Vector3();
        for (let i = 0; i < 4; i++) { const pl = new THREE.Plane(new THREE.Vector3(0, 1, 0), y); if (!ray.ray.intersectPlane(pl, hit)) break; y = K.drop(hit.x, hit.z); }
        return { x: hit.x, z: hit.z };
      },
      addMarker(lat, lng, el, z) {
        const m = { el, p: geo.toXZ(lat, lng), set(la, ln) { m.p = geo.toXZ(la, ln); }, setXZ(x, zz) { m.p = { x, z: zz }; }, remove() { el.remove(); markers.delete(m); } };
        m.h = el.classList.contains("agent") ? 4.6 : 14;
        el.style.zIndex = z || 1; layer.appendChild(el); markers.add(m); return m;
      },
      clickFns: [], onClick(fn) { api.clickFns.push(fn); },
      resize() {
        view.w = host.clientWidth; view.h = host.clientHeight;
        renderer.setSize(view.w, view.h); camera.aspect = view.w / Math.max(1, view.h);
        camera.fov = camera.aspect < 1 ? Math.min(62, FOV / Math.pow(camera.aspect, .75)) : FOV; tanHv = Math.tan(camera.fov * Math.PI / 360); camera.updateProjectionMatrix();   // portrait phones: widen so streets fit
        if (view.pendingMpp) { const m = view.pendingMpp; view.pendingMpp = 0; api.zoomTo(m); }
      },
      frame() {
        const now = performance.now() / 1000, dt = Math.min(0.1, now - (api._t || now)); api._t = now;
        K.bendU.uFocus.value.set(view.cx, view.cz); K.bendU.uBend.value = bendK();
        if (api._cine) {   // showcase camera (cinema.js) drives the view
          const c = api._cine(); view.cx = c.x; view.cz = c.z; view.dist = c.dist; view.pitch = c.pitch; view.yaw = view.yawGoal = c.yaw;
        }
        let dy = view.yawGoal - view.yaw; view.yaw += dy * Math.min(1, dt * 8);
        const sy = Math.sin(view.yaw), cy = Math.cos(view.yaw), hd = view.dist * Math.cos(view.pitch);
        camera.position.set(view.cx + sy * hd, view.dist * Math.sin(view.pitch), view.cz + cy * hd);
        camera.lookAt(view.cx - sy * view.dist * 0.12, 2, view.cz - cy * view.dist * 0.12);
        // shadows: cover everything on screen at this zoom, and snap the shadow box to its texel grid
        // so it doesn't slide or shimmer while you pan
        const ext = CL.clamp(Math.round(view.dist * 1.7 / 20) * 20, 120, 520);
        if (ext !== sun.userData.ext) {
          sun.userData.ext = ext;
          Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 1, far: ext * 2 + 300 });
          sun.shadow.camera.updateProjectionMatrix();
        }
        const tex = 2 * ext / sun.shadow.mapSize.x, fcx = view.cx - Math.sin(view.yaw) * view.dist * .35, fcz = view.cz - Math.cos(view.yaw) * view.dist * .35;
        const sx = Math.round(fcx / tex) * tex, sz = Math.round(fcz / tex) * tex;
        sun.position.set(sx - 45 * 2, 110 * 2, sz - 70 * 2); sun.target.position.set(sx, 0, sz);
        // day / night
        const S = CL.sim.state(), h = CL.time.hour(S.minutes), day = CL.clamp((h - 5.5) / 1.5, 0, 1) * CL.clamp((20.5 - h) / 1.5, 0, 1);
        const dusk = CL.clamp(1 - Math.abs(h - 18.6) / 1.4, 0, 1) + CL.clamp(1 - Math.abs(h - 6.3) / 1.2, 0, 1);
        scene.background.copy(NIGHT).lerp(SKY, day); scene.background.lerp(new THREE.Color("#f7b27a"), dusk * .35);
        sun.intensity = .1 + .42 * day; sun.color.set(dusk > .2 ? "#ffc58a" : "#fff4dc"); hemi.intensity = .3 + .34 * day;
        world.lamps.material.opacity = (1 - day) * .9;
        world.water.material.color.setHSL(.54, .6, .72 + Math.sin(now * 1.3) * .015);
        // bend whatever the fx layer adds
        overlay.traverse(o => { if (o.material && !o.material.userData.bent) K.bend(o.material); });
        people.update(dt, now);
        const R = view.dist * 3.4;
        for (const m of markers) {
          const far = Math.hypot(m.p.x - view.cx, m.p.z - view.cz) > R;
          const s = far ? null : api.project(m.p.x, m.p.z, m.h);
          const off = !s || s.back || s.x < -80 || s.y < -80 || s.x > view.w + 80 || s.y > view.h + 80;
          m.el.style.display = off ? "none" : "";
          if (!off) m.el.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px)`;
        }
        renderer.render(scene, camera);
      },
    };
    // drag to pan, wheel / pinch to zoom, tap to walk
    const el = renderer.domElement, ptrs = new Map(); let pinch = null;
    el.style.touchAction = "none";
    el.addEventListener("pointerdown", e => { el.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false, rot: e.button === 2 || e.shiftKey }); if (ptrs.size === 2) pinch = { d: pd(), dist: view.dist }; });
    el.addEventListener("pointermove", e => {
      const p = ptrs.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (Math.hypot(p.x - p.sx, p.y - p.sy) > 6) p.moved = true;
      if (ptrs.size === 2 && pinch) { view.dist = CL.clamp(pinch.dist * pinch.d / pd(), 30, 900); return; }
      if (p.moved && p.rot) { api.rotateBy(-dx * 0.008); return; }
      if (p.moved) { const k = api.mpp(), sy = Math.sin(view.yaw), cy = Math.cos(view.yaw), f = dy * k / Math.sin(view.pitch); view.cx -= dx * k * cy + f * sy; view.cz -= -dx * k * sy + f * cy; if (api.onDrag) api.onDrag(); }
    });
    el.addEventListener("pointerup", e => {
      const p = ptrs.get(e.pointerId); ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null;
      if (p && !p.moved) { const r = el.getBoundingClientRect(), w = api.unproject(e.clientX - r.left, e.clientY - r.top); api.clickFns.forEach(f => f(w.x, w.z, e)); }
    });
    el.addEventListener("contextmenu", e => e.preventDefault());
    el.addEventListener("wheel", e => { e.preventDefault(); api.zoomBy(e.deltaY > 0 ? 1.12 : 1 / 1.12); }, { passive: false });
    const pd = () => { const [a, b] = [...ptrs.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
    return api;
  };

  /* ================= world ================= */
  function buildWorld(scene, map) {
    const b = geo.BBOX, pad = 0.006;
    const minX = (b.w - pad - geo.LON0) * 92410.51, maxX = (b.e + pad - geo.LON0) * 92410.51;
    const minZ = (geo.LAT0 - (b.n + pad)) * 110574, maxZ = (geo.LAT0 - (b.s - pad)) * 110574;
    const inBox = ([x, z]) => x > minX && x < maxX && z > minZ && z < maxZ, hit = pts => pts.some(inBox);
    const col = new THREE.Color(), hash = CL.hash01;
    const flatMat = (extra) => K.bend(new THREE.MeshToonMaterial(Object.assign({ vertexColors: true, gradientMap: K.ramp, depthWrite: false, side: THREE.DoubleSide }, extra || {})));
    const out = {};

    // grass: a painted texture with little tufts and clover
    const gc = document.createElement("canvas"); gc.width = gc.height = 256; const g2 = gc.getContext("2d");
    g2.fillStyle = "#8bd05c"; g2.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 260; i++) { const x = hash("gx", i) * 256, y = hash("gy", i) * 256; g2.fillStyle = hash("gc", i) < .5 ? "#80c655" : "#98d86a"; g2.beginPath(); g2.ellipse(x, y, 3 + hash("gs", i) * 5, 2 + hash("gt", i) * 3, hash("ga", i) * 3, 0, 7); g2.fill(); }
    for (let i = 0; i < 60; i++) { const x = hash("tx", i) * 256, y = hash("ty", i) * 256; g2.strokeStyle = "#78b35a"; g2.lineWidth = 2; g2.beginPath(); g2.moveTo(x - 3, y + 3); g2.lineTo(x, y - 3); g2.lineTo(x + 3, y + 3); g2.stroke(); }
    for (let i = 0; i < 5; i++) { const x = hash("fx", i) * 256, y = hash("fy", i) * 256; g2.fillStyle = ["#fff", "#ffe066", "#ff9fb3"][i % 3]; g2.beginPath(); g2.arc(x, y, 2.2, 0, 7); g2.fill(); }
    const gtex = new THREE.CanvasTexture(gc); gtex.wrapS = gtex.wrapT = THREE.RepeatWrapping; gtex.repeat.set(9000 / 47, 9000 / 47); gtex.rotation = 0.37; gtex.anisotropy = 4;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000, 220, 220).rotateX(-Math.PI / 2), K.bend(new THREE.MeshToonMaterial({ map: gtex, gradientMap: K.ramp, depthWrite: false })));
    ground.position.set((minX + maxX) / 2, -0.3, (minZ + maxZ) / 2); ground.receiveShadow = true; ground.renderOrder = -10; scene.add(ground);

    function mesh(pos, cols, mat, order) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3)); g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat); m.renderOrder = order; m.receiveShadow = true; m.frustumCulled = false; scene.add(m); return m;
    }
    function polyLayer(list, y, colorFn, order) {
      const pos = [], cols = [];
      for (const it of list) {
        const pts = it.p; if (pts.length < 4 || !hit(pts)) continue;
        const contour = pts.slice(0, -1).map(([x, z]) => new THREE.Vector2(x, z));
        let tris; try { tris = THREE.ShapeUtils.triangulateShape(contour, []); } catch (e) { continue; }
        colorFn(it, col);
        for (const t of tris) for (const i of [t[0], t[2], t[1]]) { pos.push(contour[i].x, y, contour[i].y); cols.push(col.r, col.g, col.b); }
      }
      return mesh(pos, cols, flatMat(), order);
    }
    function lineLayer(list, y, widthFn, colorFn, filter, order) {
      const pos = [], cols = [];
      for (const r of list) {
        if (filter && !filter(r)) continue;
        const pts = r.p; if (!hit(pts)) continue;
        const w = widthFn(r) / 2; colorFn(r, col);
        for (let i = 1; i < pts.length; i++) {
          let [x1, z1] = pts[i - 1], [x2, z2] = pts[i];
          const dx = x2 - x1, dz = z2 - z1, L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L, nx = -uz * w, nz = ux * w;
          x1 -= ux * w * 0.9; z1 -= uz * w * 0.9; x2 += ux * w * 0.9; z2 += uz * w * 0.9;
          const n = 1;
          for (let k = 0; k < n; k++) {
            const a = k / n, c = (k + 1) / n, ax = x1 + (x2 - x1) * a, az = z1 + (z2 - z1) * a, cx = x1 + (x2 - x1) * c, cz = z1 + (z2 - z1) * c;
            pos.push(ax + nx, y, az + nz, ax - nx, y, az - nz, cx + nx, y, cz + nz, ax - nx, y, az - nz, cx - nx, y, cz - nz, cx + nx, y, cz + nz);
            for (let q = 0; q < 6; q++) cols.push(col.r, col.g, col.b);
          }
        }
      }
      return mesh(pos, cols, flatMat(), order);
    }
    const shade = (hex, id, amt) => col.set(hex).offsetHSL(0, 0, (hash(String(id), 3) - 0.5) * amt);
    { const PX = 4, cw = Math.ceil((maxX - minX) / PX), chh = Math.ceil((maxZ - minZ) / PX), hc = document.createElement("canvas"); hc.width = cw; hc.height = chh;
      const x2 = hc.getContext("2d"), seen = new Set(); x2.fillStyle = "#7fcbe3";
      for (const w of map.water) { if (w.n !== "harbour") continue; const key = w.p.length + ":" + w.p[0]; if (seen.has(key)) continue; seen.add(key);
        x2.beginPath(); w.p.forEach(([x, z], i) => { const px = (x - minX) / PX, pz = (z - minZ) / PX; i ? x2.lineTo(px, pz) : x2.moveTo(px, pz); }); x2.closePath(); x2.fill(); }
      const tex = new THREE.CanvasTexture(hc); tex.magFilter = THREE.LinearFilter;
      const hm = new THREE.Mesh(new THREE.PlaneGeometry(maxX - minX, maxZ - minZ).rotateX(-Math.PI / 2), K.bend(new THREE.MeshToonMaterial({ map: tex, gradientMap: K.ramp, transparent: true, alphaTest: .5, depthWrite: false })));
      hm.position.set((minX + maxX) / 2, 0, (minZ + maxZ) / 2); hm.renderOrder = -9; scene.add(hm); out.harbour = hm;
      const img = x2.getImageData(0, 0, cw, chh).data, mask = new Uint8Array(cw * chh); for (let i = 0; i < mask.length; i++) mask[i] = img[i * 4 + 3] > 128 ? 1 : 0;
      CL.world.setWaterMask(mask, cw, chh, minX, minZ, PX); }
    out.water = polyLayer(map.water.filter(w => w.n !== "harbour"), 0, (w, c) => c.set("#ffffff"), -8);
    out.water.material.vertexColors = false; out.water.material.color = new THREE.Color("#8fd3e8");
    polyLayer(map.parks, 0, (p, c) => shade("#95d766", p.n || p.p[0][0], 0.04), -7);
    const PATCH = { pitch: "#8fcf62", playground: "#efd9a0", lawn: "#9fd873", track: "#e3a882" };
    polyLayer((map.campDetail || []).filter(d => PATCH[d.k]), 0, (d, c) => c.set(PATCH[d.k]), -6);
    const ROADW = { major: 15, secondary: 12, tertiary: 10, street: 7.5, lane: 4.5, plaza: 5, path: 2.6, motorway: 16 };
    const walk = r => !r.u;
    const len = r => { let L = 0; for (let i = 1; i < r.p.length; i++) L += Math.hypot(r.p[i][0] - r.p[i - 1][0], r.p[i][1] - r.p[i - 1][1]); return L; };
    // roads: one warm sand band per street (footpaths folded in), no kerbs or centre lines;
    // footpaths: only real walking paths (>25 m), drawn as soft dirt trails; plazas as pale paving
    const ROADC = { major: "#bdb6aa", secondary: "#c3bcb0", tertiary: "#cbc4b7", street: "#d3ccbf", lane: "#ddd5c4", motorway: "#b3ada2" };
    const isRoad = r => walk(r) && ROADC[r.c];
    lineLayer(map.roads, 0, r => (ROADW[r.c] || 6) + 5.4, (r, c) => c.set(r.c === "lane" ? "#e6dcc6" : "#efe5cf"), isRoad, -5.2);   // footpath paving
    lineLayer(map.roads, 0, r => (ROADW[r.c] || 6) + .8, (r, c) => c.set("#b3a58a"), r => isRoad(r) && r.c !== "lane", -4.6);           // kerb
    lineLayer(map.roads, 0, r => ROADW[r.c] || 6, (r, c) => c.set(ROADC[r.c]), isRoad, -4.4);                                              // carriageway
    // dashed centre lines on the bigger roads
    { const pos = [], cols = [], cc = new THREE.Color("#f7f1dc");
      for (const r of map.roads) { if (!walk(r) || !/major|secondary|tertiary/.test(r.c) || !hit(r.p)) continue;
        for (let i = 1; i < r.p.length; i++) { const [x1, z1] = r.p[i - 1], [x2, z2] = r.p[i], L = Math.hypot(x2 - x1, z2 - z1), ux = (x2 - x1) / L, uz = (z2 - z1) / L, nx = -uz * .18, nz = ux * .18;
          for (let s = 1; s + 3 < L; s += 7) { const ax = x1 + ux * s, az = z1 + uz * s, bx = ax + ux * 3, bz = az + uz * 3;
            pos.push(ax + nx, 0, az + nz, ax - nx, 0, az - nz, bx + nx, 0, bz + nz, ax - nx, 0, az - nz, bx - nx, 0, bz - nz, bx + nx, 0, bz + nz); for (let q = 0; q < 6; q++) cols.push(cc.r, cc.g, cc.b); } } }
      mesh(pos, cols, flatMat(), -4.2); }
    lineLayer(map.roads, 0, r => r.c === "plaza" ? 4.5 : 2.4, (r, c) => c.set(r.c === "plaza" ? "#ece3cc" : "#dcc48f"), r => walk(r) && (r.c === "path" || r.c === "plaza") && len(r) > 25, -4);
    lineLayer(map.rail, 0, () => 3.4, (r, c) => c.set("#a58e76"), null, -3);

    /* ---------- buildings: pastel walls with windows, hipped roofs on small ones ---------- */
    const wc = document.createElement("canvas"); wc.width = 64; wc.height = 64; const w2 = wc.getContext("2d");
    w2.fillStyle = "#fff"; w2.fillRect(0, 0, 64, 64);
    w2.fillStyle = "#e9e1d3"; w2.fillRect(0, 58, 64, 6);                          // floor band
    w2.fillStyle = "#fffdf6"; w2.fillRect(18, 14, 28, 34);                        // frame
    w2.fillStyle = "#7fc0e3"; w2.fillRect(21, 17, 22, 28);                        // glass
    w2.fillStyle = "#bfe4f5"; w2.fillRect(21, 17, 7, 28);                         // glint
    w2.fillStyle = "#fffdf6"; w2.fillRect(31, 17, 2, 28);                         // mullion
    w2.fillStyle = "#e9b98a"; w2.fillRect(16, 47, 32, 3);                         // sill
    const wtex = new THREE.CanvasTexture(wc); wtex.wrapS = wtex.wrapT = THREE.RepeatWrapping; wtex.anisotropy = 4;
    const WALLS = ["#f3e3c6", "#efd3b6", "#ecdcc4", "#eecdbf", "#dce6cc", "#d2dfe9", "#f2dea8", "#e6d6e4"];
    const ROOFS = { terracotta: ["#d06a4f", "#c9644a", "#d9805a"], cool: ["#5f93c9", "#4aa39c", "#6a7bb0"], warm: ["#d98f55", "#c26a5a", "#8fa65a"], flat: ["#d8cdb6", "#c3d3bb", "#d9c6bb", "#c3cfd8", "#d6d0a8"] };
    const lmOwn = CL.landmarks3d.claim((window.CL_RESEARCH || {}).landmarks);
    const poiBld = new Map();   // footprint -> category of the place inside it
    const poiOf = new Map();
    for (const p of CL.world.pois) if (p.bld >= 0 && CL.world.solids[p.bld]) { poiBld.set(CL.world.solids[p.bld].p, p.category); if (!poiOf.has(CL.world.solids[p.bld].p) && p.category !== "home") poiOf.set(CL.world.solids[p.bld].p, p); }
    const AWN = { cafe: "#e76f51", pub: "#7d4e2d", bar: "#7b4b94", restaurant: "#d62828", bookshop: "#2a7f62", shop: "#2f7ec0", vintageshop: "#c77d2e",
      library: "#3a6ea5", gallery: "#b5446e", museum: "#8d6a3f", cinema: "#b8323c", theatre: "#9e2a2b", livemusic: "#5c3c92", gym: "#2f9e8f",
      supermarket: "#3f9d4a", laundromat: "#4f8fcf", market: "#e09f3e", campus: "#6d597a", landmark: "#6d597a", home: "#ff8a3d" };
    // Douglas-Peucker on a closed ring (keeps the shape, drops OSM jaggies)
    function simplify(pts, tol) {
      if (pts.length <= 5) return pts;
      const dp = (a, b, out) => {
        let md = 0, mi = -1; const [x1, z1] = pts[a], [x2, z2] = pts[b % pts.length], L = Math.hypot(x2 - x1, z2 - z1) || 1;
        for (let i = a + 1; i < b; i++) { const [x, z] = pts[i]; const d = Math.abs((x2 - x1) * (z1 - z) - (x1 - x) * (z2 - z1)) / L; if (d > md) { md = d; mi = i; } }
        if (md > tol) { dp(a, mi, out); dp(mi, b, out); } else out.push(pts[a]);
      };
      const half = Math.floor(pts.length / 2), out = []; dp(0, half, out); dp(half, pts.length, out);
      return out.length >= 3 ? out : pts;
    }
    // storeys: OSM building:height / building:levels when mapped, otherwise inferred from the type and footprint
    // (Inner West: terraces and houses 2, King St shopfronts 2, walk-ups 3-4, towers and campus blocks by size)
    function inferStoreys(bd, area) {
      if (bd.ht) return bd.ht / 3.1;
      if (bd.l) return bd.l;
      const t = bd.t || "";
      if (/terrace|semidetached|townhouse/.test(t)) return 2;
      if (/^(house|detached|villa|residential)$/.test(t)) return area > 300 ? 2.5 : 2;
      if (/bungalow|cottage|granny/.test(t)) return 1;
      if (/apartments|flats|units|dormitory/.test(t)) return area < 400 ? 3 : area < 1200 ? 4 : area < 3000 ? 6 : 8;
      if (/retail|commercial|mixed|pub/.test(t)) return area < 400 ? 2 : area < 1500 ? 3 : 4;
      if (/office|government|civic/.test(t)) return area < 800 ? 3 : area < 2500 ? 5 : 8;
      if (/university|college|school/.test(t)) return area < 800 ? 2.5 : area < 2500 ? 4 : 5;
      if (/church|chapel|cathedral|synagogue|temple|mosque/.test(t)) return 2.8;
      if (/hospital/.test(t)) return area < 1500 ? 4 : 7;
      if (/hotel/.test(t)) return area < 600 ? 3 : 6;
      if (/industrial|warehouse|factory|storage|service/.test(t)) return 1.6;
      if (/train_station|transportation|grandstand|pavilion|stadium|sports/.test(t)) return 1.8;
      return area < 90 ? 1 : area < 280 ? 2 : area < 900 ? 3 : area < 2500 ? 4 : 5;
    }
    const wp = [], wn = [], wcol = [], wuv = [], rp = [], rcol = [], hospitals = [], facadeWalls = new Map();
    CL.shopfront.begin(); out.stripCells = CL.shopfront.index(map, inBox);
    let nb = 0;
    for (const bd of map.buildings) {
      let pts = bd.p; if (pts.length < 4 || !pts.every(inBox)) continue;
      pts = pts.slice(0, -1);
      let area = 0; for (let i = 0; i < pts.length; i++) { const [x1, z1] = pts[i], [x2, z2] = pts[(i + 1) % pts.length]; area += x1 * z2 - x2 * z1; }
      if (area < 0) pts = pts.slice().reverse(); area = Math.abs(area) / 2;
      if (area < 25 || /^(garage|garages|shed|carport|roof|parking|transformer_tower|toilets|kiosk|tent|container)$/.test(bd.t || "")) continue;
      const id = pts[0][0] * 7 + pts[0][1];
      const lm = lmOwn.get(bd.p), poiCat = poiBld.get(bd.p) || (lm && "landmark"), plain = !poiCat;
      if (plain && area < 18) continue;
      if (!poiCat) pts = simplify(pts, 2.2);
      const storeys = inferStoreys(bd, area);
      const h = lm ? CL.landmarks3d.heightFor(lm) : 1.4 + 3.3 * Math.min(storeys, 6) + 1.6 * Math.max(0, Math.min(storeys, 14) - 6) + hash(String(id), 5) * 0.5;
      // hospitals (RPA): Victorian brick pavilions up to 3 storeys, cream and glass for the newer blocks
      const hosp = bd.t === "hospital", heritage = hosp && storeys <= 3 && area < 1800;
      col.set(lm ? lm.walls.colour : hosp ? (heritage ? ["#a5533a", "#b0623f", "#9a4a36"][Math.floor(hash(String(id), 1) * 3)] : ["#f1ede4", "#e8e4da", "#dde6ec"][Math.floor(hash(String(id), 1) * 3)]) : WALLS[Math.floor(hash(String(id), 1) * WALLS.length)]); const wr = col.r, wg = col.g, wb = col.b;
      if (hosp) hospitals.push({ pts, h, storeys, heritage, area });
      if (lm) CL.landmarks3d.decorate(scene, lm, pts, h);
      const shopP = !lm && poiOf.get(bd.p);
      const bc = shopP && shopP.brand && shopP.brand.brandColours;
      if (shopP) CL.landmarks3d.shopSign(scene, pts, (shopP.brand && shopP.brand.signText) || shopP.name, (bc && bc.primary) || AWN[shopP.category] || "#e76f51", (bc && bc.secondary && bc.secondary.toLowerCase() !== (bc.primary || "").toLowerCase()) ? bc.secondary : "#fffaf0", h);
      let cx = 0, cz = 0; for (const [x, z] of pts) { cx += x; cz += z; } cx /= pts.length; cz /= pts.length;
      // walls
      let per = 0;
      for (let i = 0; i < pts.length; i++) {
        const [x1, z1] = pts[i], [x2, z2] = pts[(i + 1) % pts.length], L = Math.hypot(x2 - x1, z2 - z1); if (L < 0.01) continue;
        const nx = (z2 - z1) / L, nz = -(x2 - x1) / L;   // outward for CCW in x-z (z south)
        const u1 = per / 4.6, u2 = (per + L) / 4.6, v = Math.max(1, Math.min(4, Math.round(storeys))); per += L;
        const quad = [[x1, 0, z1, u1, 0], [x2, 0, z2, u2, 0], [x2, h, z2, u2, v], [x1, 0, z1, u1, 0], [x2, h, z2, u2, v], [x1, h, z1, u1, v]];
        if (!lm && !hosp && area < 2500 && L > 3.5 && CL.shopfront.onStrip((x1 + x2) / 2, (z1 + z2) / 2, nx, nz)) CL.shopfront.add(x1, z1, x2, z2, nx, nz, h, id + i);
        const fac = lm && CL.facades.get(lm.id);
        if (fac) { const L2 = facadeWalls.get(lm.id) || { p: [], n: [], uv: [] }; facadeWalls.set(lm.id, L2);
          for (const [x, y, z, u] of quad) { L2.p.push(x, y, z); L2.n.push(nx, 0, nz); L2.uv.push(u * 4.6 / fac.bay, y / h * fac.rows); } continue; }
        for (const [x, y, z, u, vv] of quad) { wp.push(x, y, z); wn.push(nx, 0, nz); wcol.push(wr, wg, wb); if (plain) wuv.push(0.1, 0.92); else wuv.push(u, vv); }
        if (poiCat && L > 2.5) {   // shopfront awning in the place's colour
          const ac = col.set((shopP && bc && bc.primary) || AWN[poiCat] || "#e76f51"), o = 0.45, ay0 = 2.3, ay1 = 3.0;
          const aw = [[x1 + nx * o, ay0, z1 + nz * o], [x2 + nx * o, ay0, z2 + nz * o], [x2, ay1, z2], [x1 + nx * o, ay0, z1 + nz * o], [x2, ay1, z2], [x1, ay1, z1]];
          for (const [x, y, z] of aw) { wp.push(x, y, z); wn.push(nx * .6, .8, nz * .6); wcol.push(ac.r, ac.g, ac.b); wuv.push(0.1, 0.92); }
          col.setRGB(wr, wg, wb);
        }
      }
      // roof
      const kind = /terrace|house|detached|semidetached|bungalow|cottage/.test(bd.t || "") ? "terracotta" : /apartments|flats|residential|dormitory|hotel/.test(bd.t || "") ? "cool" : /university|college|church|school|pub|museum|civic/.test(bd.t || "") ? "warm" : area > 700 ? "flat" : "warm";
      const pal = ROOFS[area >= 480 ? "flat" : kind]; col.set(lm ? lm.roof.colour : hosp ? (heritage ? "#5a5f66" : "#dcdad3") : pal[Math.floor(hash(String(id), 2) * pal.length)]);
      const lmFlat = lm && /flat/.test(lm.roof.shape);
      if (lm && lm._gothic) { /* slate slopes come from landmarks3d.gothic; keep a flat cap under them */ const contour = pts.map(([x, z]) => new THREE.Vector2(x, z)); let tris = []; try { tris = THREE.ShapeUtils.triangulateShape(contour, []); } catch (e) { } for (const t of tris) for (const i of [t[0], t[2], t[1]]) { rp.push(contour[i].x, h, contour[i].y); rcol.push(.29, .31, .34); } }
      else if (!lmFlat && !(hosp && !heritage) && (lm ? pts.length <= 40 : area < (heritage ? 2500 : 900) && pts.length <= (heritage ? 30 : 16))) {
        // principal axis of the footprint
        let sxx = 0, szz = 0, sxz = 0; for (const [x, z] of pts) { sxx += (x - cx) ** 2; szz += (z - cz) ** 2; sxz += (x - cx) * (z - cz); }
        const th = 0.5 * Math.atan2(2 * sxz, sxx - szz), ax = Math.cos(th), az = Math.sin(th);
        let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
        for (const [x, z] of pts) { const u = (x - cx) * ax + (z - cz) * az, v = -(x - cx) * az + (z - cz) * ax; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
        const hw = (v1 - v0) / 2, vc = (v0 + v1) / 2, rh = CL.clamp(hw * 0.7, 1.2, 3.4), eave = 0.5;
        let r0 = u0 + hw * 0.85, r1 = u1 - hw * 0.85; if (r0 > r1) r0 = r1 = (u0 + u1) / 2;
        const ridge = u => { const uu = CL.clamp(u, r0, r1); return [cx + ax * uu - az * vc, cz + az * uu + ax * vc]; };
        const ring = pts.map(([x, z]) => { const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz) || 1; return [x + dx / d * eave, z + dz / d * eave]; });
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i], bb = ring[(i + 1) % ring.length], pa = pts[i], pb = pts[(i + 1) % pts.length];
          const ra = ridge((pa[0] - cx) * ax + (pa[1] - cz) * az), rb = ridge((pb[0] - cx) * ax + (pb[1] - cz) * az);
          const ex = bb[0] - a[0], ez = bb[1] - a[1], lit = 0.84 + 0.22 * CL.clamp((ex * 0.6 - ez * 0.8) / (Math.hypot(ex, ez) || 1) * .5 + .5, 0, 1);
          rp.push(a[0], h, a[1], bb[0], h, bb[1], rb[0], h + rh, rb[1], a[0], h, a[1], rb[0], h + rh, rb[1], ra[0], h + rh, ra[1]);
          for (let q = 0; q < 6; q++) rcol.push(col.r * lit, col.g * lit, col.b * lit);
        }
      } else {
        const contour = pts.map(([x, z]) => new THREE.Vector2(x, z));
        let tris; try { tris = THREE.ShapeUtils.triangulateShape(contour, []); } catch (e) { tris = []; }
        for (const t of tris) for (const i of [t[0], t[2], t[1]]) { rp.push(contour[i].x, h, contour[i].y); rcol.push(col.r, col.g, col.b); }
        // parapet lip
        for (let i = 0; i < pts.length; i++) {
          const [x1, z1] = pts[i], [x2, z2] = pts[(i + 1) % pts.length];
          rp.push(x1, h, z1, x2, h, z2, x2, h + .7, z2, x1, h, z1, x2, h + .7, z2, x1, h + .7, z1);
          for (let q = 0; q < 6; q++) rcol.push(wr * .92, wg * .92, wb * .92);
        }
      }
      nb++;
    }
    // places not inside a mapped building get a sandwich board at their spot
    const PUBLIC = /cafe|restaurant|pub|bar|shop|bookshop|vintageshop|gym|supermarket|laundromat|gallery|museum|cinema|theatre|livemusic|market|library/;
    for (const p of CL.world.pois) {
      if (p.bld >= 0 || !PUBLIC.test(p.category)) continue;
      const n = CL.world.nearestNode(p.x, p.z), ry = n >= 0 ? Math.atan2(CL.world.nodes.xs[n] - p.x, CL.world.nodes.zs[n] - p.z) + Math.PI / 2 : 0;
      const bc = p.brand && p.brand.brandColours;
      CL.landmarks3d.shopSign(scene, null, (p.brand && p.brand.signText) || p.name, (bc && bc.primary) || AWN[p.category] || '#e76f51', (bc && bc.secondary && bc.secondary.toLowerCase() !== (bc.primary || '').toLowerCase()) ? bc.secondary : '#fffaf0', 0, { x: p.x, z: p.z, ry });
    }
    // RPA extras: helipad on the tallest block, EMERGENCY sign, rooftop plant on the modern blocks
    if (hospitals.length) {
      const hc = document.createElement("canvas"); hc.width = hc.height = 128; const h2 = hc.getContext("2d");
      h2.fillStyle = "#5b6470"; h2.beginPath(); h2.arc(64, 64, 62, 0, 7); h2.fill(); h2.strokeStyle = "#f6d24a"; h2.lineWidth = 6; h2.beginPath(); h2.arc(64, 64, 50, 0, 7); h2.stroke();
      h2.fillStyle = "#ffffff"; h2.font = "900 70px Trebuchet MS, sans-serif"; h2.textAlign = "center"; h2.textBaseline = "middle"; h2.fillText("H", 64, 68);
      const rpa = CL.geo.toXZ(-33.88938, 151.18199), near = hospitals.filter(b => b.pts.some(([x, z]) => Math.hypot(x - rpa.x, z - rpa.z) < 260));
      const top = near.slice().sort((a, b) => b.storeys - a.storeys || b.area - a.area)[0];
      for (const b of hospitals) {
        let cx = 0, cz = 0; for (const [x, z] of b.pts) { cx += x; cz += z; } cx /= b.pts.length; cz /= b.pts.length;
        if (b === top) {
          const pad = new THREE.Mesh(new THREE.CircleGeometry(7, 32).rotateX(-Math.PI / 2), K.bend(new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(hc) })));
          pad.position.set(cx, b.h + .12, cz); scene.add(pad);
          CL.landmarks3d.shopSign(scene, b.pts, "EMERGENCY", "#c1121f", "#ffffff", b.h);
        } else if (!b.heritage && b.area > 300) {
          for (const [ox, oz] of [[-4, -3], [4, 2]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(4, 1.8, 3), CL.chibi.toon("#b9bcbf")); m.position.set(cx + ox, b.h + .9, cz + oz); m.castShadow = true; scene.add(m); }
        }
      }
      // blue-cross sign on the main entrance block
      if (top) CL.landmarks3d.shopSign(scene, near.find(b => b !== top && !b.heritage)?.pts || top.pts, "RPA · MAIN ENTRANCE", "#1d4f91", "#ffffff", top.h);
    }
    // landmark walls with their photo-based facades: one mesh per landmark
    for (const [id, L2] of facadeWalls) {
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(L2.p, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(L2.n, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(L2.uv, 2));
      const fm = new THREE.Mesh(g, CL.facades.material(id)); fm.castShadow = fm.receiveShadow = true; fm.frustumCulled = false; scene.add(fm);
    }
    const wg = new THREE.BufferGeometry();
    wg.setAttribute("position", new THREE.Float32BufferAttribute(wp, 3)); wg.setAttribute("normal", new THREE.Float32BufferAttribute(wn, 3));
    wg.setAttribute("color", new THREE.Float32BufferAttribute(wcol, 3)); wg.setAttribute("uv", new THREE.Float32BufferAttribute(wuv, 2));
    const walls = new THREE.Mesh(wg, K.bend(new THREE.MeshToonMaterial({ vertexColors: true, map: wtex, gradientMap: K.ramp, side: THREE.DoubleSide })));
    walls.castShadow = walls.receiveShadow = true; walls.frustumCulled = false; scene.add(walls);
    const rg = new THREE.BufferGeometry(); rg.setAttribute("position", new THREE.Float32BufferAttribute(rp, 3)); rg.setAttribute("color", new THREE.Float32BufferAttribute(rcol, 3)); rg.computeVertexNormals();
    const roofs = new THREE.Mesh(rg, K.bend(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: K.ramp, side: THREE.DoubleSide })));
    roofs.castShadow = roofs.receiveShadow = true; roofs.frustumCulled = false; scene.add(roofs);
    out.buildings = nb;

    /* ---------- trees: OSM trees + a scatter through the parks ---------- */
    const trees = (map.trees || []).filter(inBox).map(([x, z]) => [x, z]);
    for (const t of CL.infill.build(scene, map, inBox, [minX, maxX, minZ, maxZ])) trees.push(t);
    out.shopfronts = CL.shopfront.finish(scene);
    const inPoly = (p, x, z) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, zi] = p[i], [xj, zj] = p[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
    for (const pk of map.parks) {
      if (!hit(pk.p)) continue;
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const [x, z] of pk.p) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
      for (let x = Math.ceil(x0 / 11) * 11; x < x1; x += 11) for (let z = Math.ceil(z0 / 11) * 11; z < z1; z += 11) {
        if (hash("pk", x * 13 + z) > (.28 + .3 * Math.sin(x * .013) * Math.cos(z * .011))) continue;   // clumps and clearings
        const jx = x + (hash("jx", x + z) - .5) * 10, jz = z + (hash("jz", x - z) - .5) * 10;
        if (inPoly(pk.p, jx, jz) && CL.world.hit(jx, jz) < 0) trees.push([jx, jz]);
      }
      if (trees.length > 30000) break;
    }
    // OSM trees and park scatter get a park species; infill street trees already carry theirs
    // Camperdown Cemetery (St Stephen's): Canary Island palms, old figs and eucalypts among the headstones (from the photo)
    { const cem = CL.geo.toXZ(-33.8966, 151.1778), stones = [];
      for (let x = -80; x <= 80; x += 7) for (let z = -65; z <= 65; z += 7) {
        const px = cem.x + x + (hash("cx", x * 7 + z) - .5) * 4, pz = cem.z + z + (hash("cz", x + z * 7) - .5) * 4;
        if ((x / 80) ** 2 + (z / 65) ** 2 > 1 || CL.world.hit(px, pz) >= 0) continue;
        const r = hash("ct", x * 31 + z);
        if (r < .16) trees.push([px, pz, r < .07 ? "palm" : r < .11 ? "fig" : "euc"]);
        else if (r < .75) stones.push([px, pz, hash("cs", x - z)]);
      }
      const sg = new THREE.BoxGeometry(.7, 1, .25); sg.translate(0, .5, 0);
      const sm = new THREE.InstancedMesh(sg, K.bend(new THREE.MeshToonMaterial({ color: "#ffffff", gradientMap: K.ramp })), stones.length), dd = new THREE.Object3D();
      stones.forEach(([x, z, k], i) => { dd.position.set(x, 0, z); dd.rotation.set((k - .5) * .2, k * .4, 0); dd.scale.set(1 + k, .8 + k * 1.2, 1); dd.updateMatrix(); sm.setMatrixAt(i, dd.matrix); sm.setColorAt(i, col.set(["#cfc8b8", "#b9b2a2", "#d8cdb2", "#9fa3a6"][Math.floor(k * 4)])); });
      sm.castShadow = true; sm.frustumCulled = false; scene.add(sm); }
    trees.forEach((t, i) => { if (!t[2]) t[2] = CL.foliage.pick(false, i); });
    out.trees = CL.foliage.build(scene, trees); CL.foliage.counts = out.trees; CL.foliage.total = trees.length;
    const d = new THREE.Object3D();

    // street lamps along the main roads: warm glows that fade in at night
    out.props = CL.props.build(scene, map, inBox);
    const lampPts = CL.props.lampPts;
    const glowG = new THREE.CircleGeometry(4, 16).rotateX(-Math.PI / 2);
    const lamps = new THREE.InstancedMesh(glowG, K.bend(new THREE.MeshBasicMaterial({ color: "#ffd98a", transparent: true, opacity: 0, depthWrite: false })), lampPts.length);
    lampPts.forEach(([x, z], i) => { d.position.set(x, 0.2, z); d.rotation.set(0, 0, 0); d.scale.set(1, 1, 1); d.updateMatrix(); lamps.setMatrixAt(i, d.matrix); });
    lamps.renderOrder = -2; lamps.frustumCulled = false; scene.add(lamps); out.lamps = lamps;
    return out;
  }

  /* ================= people: you, the townsfolk, and the crowd ================= */
  function makePeople(scene) {
    const SC = 2.4, me = K.make({ shirt: "#ff8a3d", pants: "#3d5a80", hair: "#3b2a1a", skin: "#f1c9a0" }); me.scale.setScalar(SC); scene.add(me);
    // Keep the player's location readable even behind tall street-front buildings.
    const labelCanvas = document.createElement("canvas"); labelCanvas.width = 128; labelCanvas.height = 64;
    const labelCtx = labelCanvas.getContext("2d");
    labelCtx.fillStyle = "#fff8e6"; labelCtx.fillRect(4, 4, 120, 48);
    labelCtx.fillStyle = "#ad4c00"; labelCtx.fillRect(8, 8, 112, 40);
    labelCtx.beginPath(); labelCtx.moveTo(54, 52); labelCtx.lineTo(74, 52); labelCtx.lineTo(64, 64); labelCtx.fill();
    labelCtx.fillStyle = "white"; labelCtx.font = "bold 28px system-ui"; labelCtx.textAlign = "center"; labelCtx.fillText("You", 64, 38);
    const playerLabel = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(labelCanvas), depthTest: false, depthWrite: false, sizeAttenuation: false }));
    playerLabel.scale.set(.055, .0275, 1); playerLabel.renderOrder = 1000; scene.add(playerLabel);
    const folk = new Map();
    for (const n of CL.sim.state().npcs) { const g = K.make({ shirt: n.shirt, skin: n.skin, hair: n.hair, bun: /Grace|Lena|June|Priya|Sofia|Yuki|Aroha/.test(n.name) }); g.scale.setScalar(SC * .95); scene.add(g); folk.set(n.id, { g, px: n.px, pz: n.pz }); }
    // crowd: instanced chibi parts (body, head, hair, two legs, eyes), recoloured per walker
    const N = 600, mk = (geo, color) => { const m = new THREE.InstancedMesh(geo, K.bend(new THREE.MeshToonMaterial({ color: color || "#ffffff", gradientMap: K.ramp })), N); m.castShadow = true; m.frustumCulled = false; m.setColorAt(0, new THREE.Color(color || "#ffffff")); m.count = 0; scene.add(m); return m; };
    const bodyG = new THREE.SphereGeometry(.22, 10, 8), headG = new THREE.SphereGeometry(.34, 12, 10), hairG = new THREE.SphereGeometry(.36, 12, 6, 0, Math.PI * 2, 0, Math.PI * .55);
    const legG = new THREE.CylinderGeometry(.065, .06, .32, 6); legG.translate(0, -.16, 0);
    const eyeG = new THREE.BufferGeometry(); { const e = new THREE.SphereGeometry(.045, 6, 4), p = e.attributes.position.array, idx = e.index.array, pos = [], ind = []; for (const s of [-1, 1]) { const base = pos.length / 3; for (let i = 0; i < p.length; i += 3) pos.push(p[i] * .8 + s * .12, p[i + 1] * 1.25 - .02, p[i + 2] * .5 + .315); for (const k of idx) ind.push(k + base); } eyeG.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); eyeG.setIndex(ind); eyeG.computeVertexNormals(); }
    const body = mk(bodyG), head = mk(headG, "#f1c9a0"), hair = mk(hairG), legL = mk(legG), legR = mk(legG), eyes = mk(eyeG, "#2b2320");
    const SKIN = ["#f1c9a0", "#e0ac69", "#c68642", "#8d5524", "#ffdbac", "#a0673c"], HAIR = ["#2b1b10", "#111", "#8b5a2b", "#d4a017", "#6b4226", "#c0392b", "#555"], PANTS = ["#3d4a6b", "#2b2d42", "#6b705c", "#264653", "#7b5e57"];
    const d = new THREE.Object3D(), c = new THREE.Color();
    const place = (m, i, x, y, z, ry, rx, sx, sy, sz) => { d.position.set(x, y, z); d.rotation.set(rx || 0, ry, 0); d.scale.set(sx, sy, sz); d.updateMatrix(); m.setMatrixAt(i, d.matrix); };
    function update(dt, t) {
      const S = CL.sim.state(), p = CL.sim.player();
      // you
      me.visible = !p.at;
      playerLabel.visible = !p.at;
      playerLabel.position.set(p.x, 5, p.z);
      if (!p.at) {
        const moved = Math.hypot(p.x - (me.userData.lx ?? p.x), p.z - (me.userData.lz ?? p.z)) / Math.max(dt, 1e-3);
        me.userData.lx = p.x; me.userData.lz = p.z;
        me.position.set(p.x, 0, p.z);
        let dh = p.heading - me.rotation.y; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); me.rotation.y += dh * Math.min(1, dt * 12);
        K.animate(me, dt, moved > 12 ? 2 : moved > .5 ? 1 : 0, t);
      }
      // townsfolk
      for (const n of S.npcs) {
        const f = folk.get(n.id); if (!f) continue;
        f.g.visible = !n.at; if (n.at) continue;
        const dx = n.px - f.px, dz = n.pz - f.pz, sp = Math.hypot(dx, dz) / Math.max(dt, 1e-3);
        if (sp > .05) f.g.rotation.y = Math.atan2(dx, dz);
        f.px = n.px; f.pz = n.pz; f.g.position.set(n.px, 0, n.pz);
        K.animate(f.g, dt, sp > .3 ? 1 : 0, t);
      }
      // crowd
      const ws = CL.sim.walkers, n = Math.min(ws.length, N);
      for (let i = 0; i < n; i++) {
        const w = ws[i];
        if (w._c == null) { w._c = i * 7919; w._ph = Math.random() * 6; }
        const dx = w.x - (w._lx ?? w.x), dz = w.zz - (w._lz ?? w.zz), moving = Math.hypot(dx, dz) > 0.001;
        if (moving) w._h = Math.atan2(dx, dz);
        w._lx = w.x; w._lz = w.zz; if (moving) w._ph += dt * 9;
        const ry = w._h || 0, sc = 2.2, bob = moving ? Math.abs(Math.cos(w._ph)) * .07 * sc : 0, sw = moving ? Math.sin(w._ph) * .7 : 0;
        const fx = Math.sin(ry), fz = Math.cos(ry), rx = Math.cos(ry), rz = -Math.sin(ry);
        place(body, i, w.x, (.55 * sc) + bob, w.zz, ry, 0, sc, sc * 1.15, sc * .9);
        place(head, i, w.x, 1.08 * sc + bob, w.zz, ry, 0, sc, sc * .95, sc);
        place(hair, i, w.x - fx * .06, 1.11 * sc + bob, w.zz - fz * .06, ry, 0, sc, sc, sc);
        place(eyes, i, w.x, 1.08 * sc + bob, w.zz, ry, 0, sc, sc, sc);
        place(legL, i, w.x - rx * .1 * sc, .36 * sc + bob, w.zz - rz * .1 * sc, ry, sw, sc, sc, sc);
        place(legR, i, w.x + rx * .1 * sc, .36 * sc + bob, w.zz + rz * .1 * sc, ry, -sw, sc, sc, sc);
        body.setColorAt(i, c.set(w.color)); head.setColorAt(i, c.set(SKIN[w._c % SKIN.length])); hair.setColorAt(i, c.set(HAIR[(w._c >> 3) % HAIR.length]));
        const pc = c.set(PANTS[(w._c >> 5) % PANTS.length]); legL.setColorAt(i, pc); legR.setColorAt(i, pc);
      }
      for (const m of [body, head, hair, legL, legR, eyes]) { m.count = n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    }
    return { update };
  }
})(window.CL = window.CL || {});
