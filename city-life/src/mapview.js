/* City Life - map backends with one interface.
   offline: the parent build's OSM data drawn with three.js + HTML markers (no key needed)
   google : Google Maps vector map + AdvancedMarkerElement + WebGLOverlayView (three.js)
   Both expose: overlay (THREE.Group in local metres: x east, y up, z south),
   addMarker(lat, lng, el, z) -> {set(lat,lng), remove()}, mpp(), center(), panTo(x,z),
   onClick(fn(x,z)), resize(). */
(function (CL) {
  const { geo } = CL;
  const MV = CL.mapview = {};

  /* ============================ OFFLINE ============================ */
  MV.offline = function (host) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#e8e2cf");
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 2000);
    camera.up.set(0, 0, -1);
    const overlay = new THREE.Group(); overlay.renderOrder = 10;
    const layer = document.createElement("div"); layer.className = "mk-layer"; host.appendChild(layer);
    const home = geo.toXZ(-33.88595, 151.17925);
    const view = { cx: home.x, cz: home.z, mpp: 1.1, w: 1, h: 1 };
    buildMapLayers(scene, window.SYD_MAP);
    scene.add(overlay);

    const markers = new Set();
    const api = {
      mode: "offline", overlay, renderer, host,
      mpp: () => view.mpp,
      center: () => ({ x: view.cx, z: view.cz }),
      panTo(x, z) { view.cx = x; view.cz = z; },
      followTo(x, z) { view.cx += (x - view.cx) * 0.2; view.cz += (z - view.cz) * 0.2; },
      zoomTo(mpp) { view.mpp = CL.clamp(mpp, 0.12, 9); },
      project: (x, z) => ({ x: (x - view.cx) / view.mpp + view.w / 2, y: (z - view.cz) / view.mpp + view.h / 2 }),
      unproject: (sx, sy) => ({ x: (sx - view.w / 2) * view.mpp + view.cx, z: (sy - view.h / 2) * view.mpp + view.cz }),
      addMarker(lat, lng, el, z) {
        const m = { el, p: geo.toXZ(lat, lng), set(la, ln) { m.p = geo.toXZ(la, ln); }, setXZ(x, zz) { m.p = { x, z: zz }; }, remove() { el.remove(); markers.delete(m); } };
        el.style.zIndex = z || 1; layer.appendChild(el); markers.add(m); return m;
      },
      clickFns: [], onClick(fn) { api.clickFns.push(fn); },
      resize() {
        view.w = host.clientWidth; view.h = host.clientHeight;
        renderer.setSize(view.w, view.h);
      },
      frame() {
        const hw = view.w / 2 * view.mpp, hh = view.h / 2 * view.mpp;
        Object.assign(camera, { left: -hw, right: hw, top: hh, bottom: -hh });
        camera.position.set(view.cx, 1000, view.cz); camera.lookAt(view.cx, 0, view.cz); camera.updateProjectionMatrix();
        for (const m of markers) {
          const s = api.project(m.p.x, m.p.z);
          const off = s.x < -80 || s.y < -80 || s.x > view.w + 80 || s.y > view.h + 80;
          m.el.style.display = off ? "none" : "";
          if (!off) m.el.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px)`;
        }
        renderer.render(scene, camera);
      },
    };
    // pan / zoom / tap
    const el = renderer.domElement, ptrs = new Map(); let pinch = null;
    el.style.touchAction = "none";
    el.addEventListener("pointerdown", e => { el.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false }); if (ptrs.size === 2) pinch = { d: pd(), m: view.mpp }; });
    el.addEventListener("pointermove", e => {
      const p = ptrs.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (Math.hypot(p.x - p.sx, p.y - p.sy) > 6) p.moved = true;
      if (ptrs.size === 2 && pinch) { api.zoomTo(pinch.m * pinch.d / pd()); return; }
      if (p.moved) { view.cx -= dx * view.mpp; view.cz -= dy * view.mpp; if (api.onDrag) api.onDrag(); }
    });
    el.addEventListener("pointerup", e => {
      const p = ptrs.get(e.pointerId); ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null;
      if (p && !p.moved) { const r = el.getBoundingClientRect(), w = api.unproject(e.clientX - r.left, e.clientY - r.top); api.clickFns.forEach(f => f(w.x, w.z, e)); }
    });
    el.addEventListener("wheel", e => {
      e.preventDefault();
      const r = el.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top, before = api.unproject(sx, sy);
      api.zoomTo(view.mpp * (e.deltaY > 0 ? 1.15 : 1 / 1.15));
      const after = api.unproject(sx, sy); view.cx += before.x - after.x; view.cz += before.z - after.z;
    }, { passive: false });
    const pd = () => { const [a, b] = [...ptrs.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
    return api;
  };

  // --- OSM layers -> merged meshes (one draw call per layer) ---
  function buildMapLayers(scene, map) {
    const b = geo.BBOX, pad = 0.006;
    const minX = (b.w - pad - geo.LON0) * 92410.51, maxX = (b.e + pad - geo.LON0) * 92410.51;
    const minZ = (geo.LAT0 - (b.n + pad)) * 110574, maxZ = (geo.LAT0 - (b.s - pad)) * 110574;
    const hit = pts => pts.some(([x, z]) => x > minX && x < maxX && z > minZ && z < maxZ);
    const col = new THREE.Color();
    function polyLayer(list, y, colorFn) {
      const pos = [], cols = [];
      for (const it of list) {
        const pts = it.p; if (pts.length < 4 || !hit(pts)) continue;
        const contour = pts.slice(0, -1).map(([x, z]) => new THREE.Vector2(x, z));
        let tris; try { tris = THREE.ShapeUtils.triangulateShape(contour, []); } catch (e) { continue; }
        colorFn(it, col);
        for (const t of tris) for (const i of t) { pos.push(contour[i].x, y, contour[i].y); cols.push(col.r, col.g, col.b); }
      }
      return mesh(pos, cols);
    }
    function mesh(pos, cols) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
      scene.add(m); return m;
    }
    function lineLayer(list, y, widthFn, colorFn, filter) {
      const pos = [], cols = [];
      for (const r of list) {
        if (filter && !filter(r)) continue;
        const pts = r.p; if (!hit(pts)) continue;
        const w = widthFn(r) / 2; colorFn(r, col);
        for (let i = 1; i < pts.length; i++) {
          let [x1, z1] = pts[i - 1], [x2, z2] = pts[i];
          const dx = x2 - x1, dz = z2 - z1, L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L, nx = -uz * w, nz = ux * w;
          x1 -= ux * w * 0.9; z1 -= uz * w * 0.9; x2 += ux * w * 0.9; z2 += uz * w * 0.9;   // overlap = soft joints
          pos.push(x1 + nx, y, z1 + nz, x2 + nx, y, z2 + nz, x2 - nx, y, z2 - nz, x1 + nx, y, z1 + nz, x2 - nx, y, z2 - nz, x1 - nx, y, z1 - nz);
          for (let k = 0; k < 6; k++) cols.push(col.r, col.g, col.b);
        }
      }
      return mesh(pos, cols);
    }
    const shade = (hex, id, amt) => col.set(hex).offsetHSL(0, 0, (CL.hash01(String(id), 3) - 0.5) * amt);
    polyLayer(map.water, 0.5, (w, c) => c.set("#9fd0e6"));
    polyLayer(map.parks, 1, (p, c) => shade("#b7d98c", p.n || p.p[0][0], 0.06));
    polyLayer(map.campDetail || [], 1.5, (d, c) => c.set({ pitch: "#9ccc72", playground: "#e7d49a", lawn: "#a9d27d", track: "#d49a74", dog_park: "#c3dd96", platform: "#c9c3b5" }[d.k] || "#c7d6a0"));
    const ROADW = { major: 15, secondary: 12, tertiary: 10, street: 7.5, lane: 4.5, plaza: 5, path: 2.4, motorway: 16 };
    const walk = r => !r.u;
    lineLayer(map.roads, 2, r => (ROADW[r.c] || 6) + 2.2, (r, c) => c.set(r.c === "path" ? "#d9cfb4" : "#cbbd9d"), r => walk(r) && r.c !== "path");
    lineLayer(map.roads, 2.5, r => ROADW[r.c] || 6, (r, c) => c.set(r.c === "major" || r.c === "secondary" ? "#fff3cf" : r.c === "path" ? "#efe6cc" : r.c === "plaza" ? "#eee6d6" : "#fbf8ef"), walk);
    lineLayer(map.rail, 3, () => 2.2, (r, c) => c.set("#8d8a86"));
    const BCOL = { house: "#e2b894", terrace: "#dca982", semidetached_house: "#e2b894", detached: "#e7c09c", apartments: "#cdbfae", residential: "#d9bda0",
      commercial: "#c7c3cf", retail: "#d3c1c9", office: "#bfc6d0", university: "#dcc796", school: "#e0cc9e", church: "#d8c9a8", hospital: "#d9c9c9",
      industrial: "#c4bcb0", warehouse: "#c4bcb0", hotel: "#d6bfb2", train_station: "#c9c3b5" };
    polyLayer(map.buildings, 4, (bd, c) => shade(BCOL[bd.t] || "#d4c6b4", bd.p[0][0] * 7 + bd.p[0][1], 0.1));
    // tree canopies
    const trees = (map.trees || []).filter(([x, z]) => x > minX && x < maxX && z > minZ && z < maxZ);
    const tg = new THREE.CircleGeometry(4.2, 10); tg.rotateX(-Math.PI / 2);
    const tm = new THREE.InstancedMesh(tg, new THREE.MeshBasicMaterial({ color: "#7fb069" }), trees.length);
    const d = new THREE.Object3D();
    trees.forEach(([x, z], i) => { d.position.set(x, 5, z); const s = 0.7 + CL.hash01("t", i) * 0.7; d.scale.set(s, 1, s); d.updateMatrix(); tm.setMatrixAt(i, d.matrix); });
    scene.add(tm);
  }

  /* ============================ GOOGLE ============================ */
  // Loads the Maps JS API (weekly) with the marker library. Resolves null on any failure so the game falls back offline.
  MV.loadGoogle = function (key) {
    return new Promise(res => {
      if (!key) return res(null);
      const cb = "__clGmapsReady" + Date.now();
      window[cb] = () => res(window.google);
      window.gm_authFailure = () => { console.warn("Google Maps auth failed - offline map"); res(null); };
      const s = document.createElement("script");
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&libraries=marker&callback=${cb}`;
      s.async = true; s.onerror = () => res(null);
      document.head.appendChild(s);
      setTimeout(() => res(window.google?.maps ? window.google : null), 12000);
    });
  };
  MV.google = function (host, cfg) {
    const g = window.google.maps;
    const home = { lat: -33.88595, lng: 151.17925 };
    const map = new g.Map(host, { center: home, zoom: 16.5, mapId: cfg.MAP_ID || "DEMO_MAP_ID", tilt: 0, heading: 0,
      disableDefaultUI: true, zoomControl: true, clickableIcons: false, gestureHandling: "greedy" });
    const overlay = new THREE.Group();
    overlay.rotation.x = Math.PI / 2;       // local (x east, y up, z south) -> Google local (x east, y north, z up)
    const scene = new THREE.Scene(); scene.add(overlay);
    scene.add(new THREE.AmbientLight(0xffffff, 1));
    const camera = new THREE.PerspectiveCamera();
    const wov = new g.WebGLOverlayView();
    let renderer = null;
    wov.onContextRestored = ({ gl }) => {
      renderer = new THREE.WebGLRenderer({ canvas: gl.canvas, context: gl, ...gl.getContextAttributes() });
      renderer.autoClear = false;
    };
    wov.onDraw = ({ transformer }) => {
      const m = transformer.fromLatLngAltitude({ lat: geo.LAT0, lng: geo.LON0, altitude: 0 });
      camera.projectionMatrix = new THREE.Matrix4().fromArray(m);
      wov.requestRedraw();
      renderer.render(scene, camera);
      renderer.resetState();
    };
    wov.setMap(map);
    const api = {
      mode: "google", overlay, map,
      mpp: () => 156543.03392 * Math.cos(geo.LAT0 * Math.PI / 180) / Math.pow(2, map.getZoom() || 16),
      center: () => { const c = map.getCenter(); return geo.toXZ(c.lat(), c.lng()); },
      panTo(x, z) { map.panTo(geo.toLL(x, z)); },
      followTo(x, z) { map.setCenter(geo.toLL(x, z)); },
      zoomTo(mpp) { map.setZoom(Math.log2(156543.03392 * Math.cos(geo.LAT0 * Math.PI / 180) / mpp)); },
      addMarker(lat, lng, el, z) {
        const mk = new g.marker.AdvancedMarkerElement({ map, position: { lat, lng }, content: el, zIndex: z || 1 });
        return { el, marker: mk, set(la, ln) { mk.position = { lat: la, lng: ln }; }, setXZ(x, zz) { mk.position = geo.toLL(x, zz); }, remove() { mk.map = null; } };
      },
      clickFns: [], onClick(fn) { api.clickFns.push(fn); },
      resize() {}, frame() {},
    };
    map.addListener("dragstart", () => { if (api.onDrag) api.onDrag(); });
    map.addListener("click", e => { const p = geo.toXZ(e.latLng.lat(), e.latLng.lng()); api.clickFns.forEach(f => f(p.x, p.z, e.domEvent)); });
    return api;
  };
})(window.CL = window.CL || {});
