/* City Life - three.js visual state in the map overlay: ground rings under every
   POI (discovered / open / closed / event / hover / selected), busyness discs,
   event pulses, the player's ring and planned route. Works in either
   backend: coordinates are local metres (x east, y up, z south). */
(function (CL) {
  const FX = CL.fx = { rings: new Map(), pulses: [] };
  const COL = { fog: "#8f8a80", open: "#3f9d4a", closed: "#a39b8c", event: "#d6336c", hover: "#ffb000", sel: "#ff7a00" };
  let root, ringGeo, discGeo, moodRing, routeLine, crowd, t0 = 0;
  const cm = new THREE.Object3D(), cc = new THREE.Color();

  FX.init = function (overlay) {
    root = new THREE.Group(); overlay.add(root);
    ringGeo = new THREE.RingGeometry(0.8, 1, 48); ringGeo.rotateX(-Math.PI / 2);
    discGeo = new THREE.CircleGeometry(0.8, 40); discGeo.rotateX(-Math.PI / 2);
    for (const p of CL.world.pois) FX.addPoi(p);
    moodRing = new THREE.Mesh(new THREE.RingGeometry(0.62, 1, 40).rotateX(-Math.PI / 2), mat("#7ee081", 0.9));
    root.add(moodRing);
    routeLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: "#ff7a00", dashSize: 6, gapSize: 4, transparent: true, opacity: 0.9, depthTest: false }));
    routeLine.renderOrder = 20; root.add(routeLine);
    // street life: one instanced draw for every ambient walker
    crowd = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 10).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthTest: false }), 600);
    crowd.renderOrder = 14; crowd.frustumCulled = false; crowd.setColorAt(0, new THREE.Color("#ffffff")); crowd.count = 0; root.add(crowd);
    CL.bus.on("pulse", e => FX.pulse(e.poi, true));
  };
  const mat = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthTest: false, side: THREE.DoubleSide });
  FX.addPoi = function (p) {
    if (FX.rings.has(p.id)) return;
    const ring = new THREE.Mesh(ringGeo, mat(COL.fog, 0.5)), disc = new THREE.Mesh(discGeo, mat(COL.open, 0.15));
    ring.position.set(p.x, 7, p.z); disc.position.set(p.x, 6.5, p.z);
    ring.renderOrder = 12; disc.renderOrder = 11;
    root.add(ring, disc);
    FX.rings.set(p.id, { ring, disc, p });
  };
  FX.pulse = function (pid, big) {
    const p = CL.world.byId.get(pid); if (!p) return;
    const m = new THREE.Mesh(ringGeo, mat(COL.event, 0.9)); m.position.set(p.x, 8, p.z); m.renderOrder = 13; root.add(m);
    FX.pulses.push({ m, born: performance.now(), life: big ? 2600 : 1600, big });
  };

  FX.update = function (mpp, hoverId, selPoiId) {
    const S = CL.sim.state(), now = performance.now(), base = FX.ringScale ? FX.ringScale : Math.max(9, 15 * mpp);
    for (const { ring, disc, p } of FX.rings.values()) {
      const known = S.discovered.has(p.id), open = CL.sim.isOpen(p), ev = CL.sim.liveEvent(p.id);
      let c = !known ? COL.fog : ev ? COL.event : open ? COL.open : COL.closed, s = base, o = known ? 0.85 : 0.45;
      if (p.id === hoverId) { c = COL.hover; s *= 1.45; o = 1; }
      if (p.id === selPoiId) { c = COL.sel; s *= 1.3 + Math.sin(now / 220) * 0.08; o = 1; }
      ring.material.color.set(c); ring.material.opacity = o; ring.scale.setScalar(s);
      ring.visible = !FX.minimal || p.id === hoverId || p.id === selPoiId || !!ev;
      const busy = known && open ? CL.sim.busy(p) : 0;
      disc.visible = busy > 0.02 && !FX.minimal; disc.scale.setScalar(s * 0.95);
      disc.material.color.set(busy > 0.85 ? "#e8590c" : busy > 0.5 ? "#f2a33a" : COL.open); disc.material.opacity = 0.1 + busy * 0.3;
    }
    // event pulses: a slow heartbeat while an event is upcoming or live
    if (now - t0 > 1800) { t0 = now; for (const e of S.events) if (S.minutes < e.end) FX.pulse(e.poi, false); }
    FX.pulses = FX.pulses.filter(pu => {
      const k = (now - pu.born) / pu.life;
      if (k >= 1) { root.remove(pu.m); pu.m.material.dispose(); return false; }
      pu.m.scale.setScalar(base * (1 + k * (pu.big ? 5 : 2.4))); pu.m.material.opacity = (1 - k) * 0.85;
      return true;
    });
    // street life
    const ws = CL.sim.walkers, r = Math.max(1.3, 5.5 * mpp);
    crowd.count = FX.showCrowd === false ? 0 : Math.min(ws.length, 600);
    for (let i = 0; i < crowd.count; i++) {
      const w = ws[i]; cm.position.set(w.x, 7.2, w.zz); cm.scale.setScalar(r); cm.updateMatrix(); crowd.setMatrixAt(i, cm.matrix);
      crowd.setColorAt(i, cc.set(w.color));
    }
    crowd.instanceMatrix.needsUpdate = true; if (crowd.instanceColor) crowd.instanceColor.needsUpdate = true;
    // the player: a soft ring underfoot + the dashed route when click-walking
    const me = CL.sim.player();
    moodRing.visible = !me.at;
    if (!me.at) { moodRing.position.set(me.x, 7.5, me.z); moodRing.scale.setScalar(Math.max(1.5, 2.6 * mpp) * (1 + Math.sin(now / 250) * 0.06)); moodRing.material.color.set("#ff9a3c"); }
    const pts = [];
    if (me.route && me.route.length) { pts.push(new THREE.Vector3(me.x, 8, me.z)); for (const q of me.route) pts.push(new THREE.Vector3(q.x, 8, q.z)); }
    routeLine.visible = pts.length > 1;
    if (pts.length > 1) {
      routeLine.geometry.dispose(); routeLine.geometry = new THREE.BufferGeometry().setFromPoints(pts); routeLine.computeLineDistances();
      routeLine.material.dashSize = 5 * mpp; routeLine.material.gapSize = 4 * mpp;
    }
  };
})(window.CL = window.CL || {});
