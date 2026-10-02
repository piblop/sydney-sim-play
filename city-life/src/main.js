/* City Life - boot + main loop.
   URL params (handy for testing/screenshots): ?fresh=1 ignore the save · ?at=Tue-19:30 jump the clock
   ?discover=all · ?poi=<id> open a place card · ?hover=<id> · ?inside=<id>[&room=roof] · ?street=1 start outside
   ?goto=<id> teleport to a place's door · ?walk=<id> start click-walking there · ?speed=0 · ?zoom=<metres per px>
   ?center=<id> · ?offline=1 force the offline map */
(async function (CL) {
  const $ = id => document.getElementById(id);
  const Q = new URLSearchParams(location.search);
  const cfg = Object.assign({ GOOGLE_MAPS_KEY: "", MAP_ID: "", USE_PLACES: true }, window.CL_CONFIG || {});
  const loading = $("loading");

  // world + player
  CL.world.loadFallback(window.CL_LANDMARKS.landmarks, (window.SYD_POIS || {}).pois || []);
  CL.world.loadResearch(window.CL_RESEARCH);
  CL.world.assignInteriors();
  CL.world.applyBrands((window.CL_RESEARCH || {}).brands);
  CL.world.indexPois();
  CL.world.buildGraph(window.SYD_MAP);
  CL.world.buildBlockers(window.SYD_MAP);
  let saved = null;
  let saveUnreadable = false;
  if (!Q.get("fresh")) try { saved = JSON.parse(localStorage.getItem(CL.CONFIG.saveKey) || "null"); } catch (e) { saveUnreadable = true; }
  CL.sim.init(saved);
  const S = CL.sim.state();

  // test/screenshot helpers
  if (Q.get("at")) {
    const [d, hm] = Q.get("at").split("-"), [h, mi] = (hm || "12:00").split(":").map(Number);
    const target = CL.time.DAY_NAMES.indexOf(d);
    let m = Math.floor(S.minutes / 1440) * 1440 + h * 60 + (mi || 0);
    while (CL.time.dow(m) !== target || m < S.minutes) m += 1440;
    CL.sim.tick(Math.min(m - S.minutes, 7 * 1440));
  }
  if (Q.get("discover") === "all") CL.world.pois.forEach(p => S.discovered.add(p.id));

  // map backend: Google when a key is configured and loads, otherwise the offline OSM map
  let MV = null;
  if (cfg.GOOGLE_MAPS_KEY && !Q.get("offline")) {
    loading.textContent = "Loading Google Maps…";
    const g = await CL.mapview.loadGoogle(cfg.GOOGLE_MAPS_KEY);
    if (g && g.maps && g.maps.WebGLOverlayView) { MV = CL.mapview.google($("map"), cfg); document.body.classList.add("gm"); }
  }
  if (!MV && !Q.get("flat")) { MV = CL.mapview.ac($("map")); document.body.classList.add("ac"); CL.fx.showCrowd = false; CL.fx.ringScale = 5; CL.fx.minimal = true; }
  if (!MV) MV = CL.mapview.offline($("map"));
  CL.MV = MV;
  CL.fx.init(MV.overlay);
  CL.ui.init(MV);
  CL.interiorView.init($("interior"));
  if (MV.setCine) CL.cinema.init(MV);
  // Establish viewport dimensions before applying zoom and place-card camera offsets.
  const resize = () => { MV.resize(); CL.interiorView.resize(); document.documentElement.style.setProperty("--topH", Math.round($("top").getBoundingClientRect().bottom) + "px"); };
  addEventListener("resize", resize); resize();
  CL.ui.speedIdx = Q.get("speed") != null ? +Q.get("speed") : 1;
  document.querySelectorAll("#speeds button").forEach(b => b.onclick = () => { CL.ui.speedIdx = +b.dataset.s; });
  if (Q.get("zoom")) MV.zoomTo(+Q.get("zoom")); else if (MV.mode !== "ac") MV.zoomTo(0.55);
  const me = CL.sim.player();
  if (Q.get("street") || Q.get("goto") || Q.get("walk")) CL.sim.leave();
  if (Q.get("goto") && CL.world.byId.has(Q.get("goto"))) { const p = CL.world.byId.get(Q.get("goto")), n = CL.world.nearestNode(p.x, p.z); me.x = CL.world.nodes.xs[n]; me.z = CL.world.nodes.zs[n]; CL.sim.walkTo({ poi: p.id }); }
  MV.panTo(me.x, me.z);
  const focus = Q.get("center") || Q.get("poi") || Q.get("hover");
  if (focus && CL.world.byId.has(focus)) { const p = CL.world.byId.get(focus); MV.panTo(p.x + (Q.get("poi") ? 110 * MV.mpp() : 0), p.z); CL.ui.follow = false; }

  // Places: one Nearby Search per zone at startup (Google mode only), then details on click
  if (MV.mode === "google" && cfg.USE_PLACES !== false) {
    CL.places.init(cfg.GOOGLE_MAPS_KEY);
    CL.places.nearbyAllZones().then(list => {
      const r = CL.world.addPlaces(list);
      CL.world.indexPois();
      CL.world.assignInteriors();
      for (const p of CL.world.pois) { if (p.node == null) p.node = CL.world.nearestNode(p.x, p.z); if (p.bld == null) p.bld = CL.world.hit(p.x, p.z); CL.ui.addPoiMarker(p); CL.fx.addPoi(p); }
      CL.bus.emit("toast", `Places: +${r.added} venues, ${r.matched} matched to landmarks`);
    });
  }

  // resize

  // save: midnight + tab hide
  const save = () => { try { localStorage.setItem(CL.CONFIG.saveKey, JSON.stringify(CL.sim.serialize())); } catch (e) { /* private mode */ } };
  document.addEventListener("visibilitychange", () => { if (document.hidden) save(); });
  if ($("rotL")) { $("rotL").onclick = () => MV.rotateStep && MV.rotateStep(1); $("rotR").onclick = () => MV.rotateStep && MV.rotateStep(-1); $("rotBox").hidden = !MV.rotateStep; }
  $("btnSave").onclick = () => { save(); CL.ui.toast("💾 Saved"); };
  $("btnNew").onclick = () => { try { localStorage.removeItem(CL.CONFIG.saveKey); } catch (e) { /* ignore */ } location.reload(); };

  // keys: held movement keys are polled each frame; the rest are one-shots
  const held = new Set();
  const touchHeld = new Map();
  let touchRun = false;
  const interact = () => {
    const folk = CL.sim.nearestFolk(14);
    if (folk && !me.at) { CL.sim.talkTo(folk); return; }
    if (me.at) CL.sim.leave();
    else if (me.near) { const p = CL.world.byId.get(me.near); if (p.interior) CL.sim.enter(p.id); else CL.ui.openPoi(p.id); }
    else CL.ui.toast("Walk closer to a person or place to interact.");
  };
  const clearTouch = () => {
    touchHeld.clear();
    document.querySelectorAll("[data-move]").forEach(b => b.classList.remove("held"));
  };
  document.querySelectorAll("[data-move]").forEach(button => {
    button.addEventListener("pointerdown", e => {
      if (e.button !== 0) return;
      e.preventDefault(); button.setPointerCapture(e.pointerId);
      touchHeld.set(e.pointerId, button.dataset.move); button.classList.add("held"); CL.ui.follow = true;
    });
    const release = e => { touchHeld.delete(e.pointerId); if (![...touchHeld.values()].includes(button.dataset.move)) button.classList.remove("held"); };
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) button.addEventListener(type, release);
    button.addEventListener("contextmenu", e => e.preventDefault());
  });
  $("touchRun").onclick = () => { touchRun = !touchRun; $("touchRun").setAttribute("aria-pressed", String(touchRun)); $("touchRun").textContent = touchRun ? "Running" : "Run"; };
  $("touchAct").onclick = interact;
  document.addEventListener("visibilitychange", () => { if (document.hidden) { held.clear(); clearTouch(); } });
  addEventListener("resize", clearTouch);
  const inputBlocked = () => CL.cinema.on || ["ovGo", "ovJournal", "poicard"].some(id => $(id).classList.contains("show"));
  const updateTouchVisibility = () => { const blocked = !!inputBlocked(); $("touchControls").hidden = blocked; if (blocked) clearTouch(); };
  const menuObserver = new MutationObserver(updateTouchVisibility);
  for (const id of ["ovGo", "ovJournal", "poicard"]) menuObserver.observe($(id), { attributes:true, attributeFilter:["class"] });
  const MOVE = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
  addEventListener("keydown", e => {
    if (e.target.tagName === "INPUT") { if (e.code === "Escape") $("ovGo").classList.remove("show"); return; }
    if (MOVE[e.code]) { held.add(e.code); e.preventDefault(); CL.ui.follow = true; return; }
    if (e.key === "Shift") held.add("Shift");
    if (e.code === "Space") { e.preventDefault(); CL.ui.speedIdx = CL.ui.speedIdx ? 0 : 1; }
    if (["Digit1", "Digit2", "Digit3"].includes(e.code)) CL.ui.speedIdx = +e.key;
    if (e.code === "KeyE" && !e.repeat) interact();
    if (e.code === "KeyF") CL.ui.follow = !CL.ui.follow;
    if (e.code === "KeyJ") CL.ui.showJournal();
    if (e.code === "KeyG") { e.preventDefault(); CL.ui.showGoTo(); }
    if (e.code === "KeyQ") { if (CL.interiorView.open) CL.interiorView.rotate(1); else if (MV.rotateStep) MV.rotateStep(1); }
    if (e.code === "KeyR") { if (CL.interiorView.open) CL.interiorView.rotate(-1); else if (MV.rotateStep) MV.rotateStep(-1); }
    if (e.code === "Escape" && CL.cinema.on) { CL.cinema.stop(); return; }
    if (e.code === "Escape") { if (CL.interiorView.open) CL.sim.leave(); else CL.ui.closePoi(); $("ovJournal").classList.remove("show"); $("ovGo").classList.remove("show"); }
  });
  addEventListener("keyup", e => { held.delete(e.code); if (e.key === "Shift") held.delete("Shift"); });
  addEventListener("blur", () => { held.clear(); clearTouch(); });

  loading.style.display = "none";
  if (saveUnreadable || CL.sim.saveRecovered) CL.ui.toast("Your save could not be loaded. Starting a fresh game.");
  let last = performance.now(), lastDay = CL.time.dayNo(S.minutes), lastFollow = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    // player: keys (screen-relative, rotated indoors to match the camera), then click-walk
    const blocked = inputBlocked();
    updateTouchVisibility();
    $("touchAct").textContent = me.at ? "Go outside" : CL.sim.nearestFolk(14) ? "Talk" : me.near ? "Interact" : "Explore";
    let dx = 0, dz = 0; for (const k of new Set([...held, ...touchHeld.values()])) if (MOVE[k] && !blocked) { dx += MOVE[k][0]; dz += MOVE[k][1]; }
    const run = held.has("Shift") || (touchRun && touchHeld.size > 0);
    if (dx || dz) {
      if (me.at) [dx, dz] = CL.interiorView.keyDir(dx, dz);
      else if (MV.yaw) { const y = MV.yaw(), s = Math.sin(y), c = Math.cos(y); [dx, dz] = [c * dx + s * dz, -s * dx + c * dz]; }
      CL.sim.move(dx, dz, dt, run);
    }
    CL.sim.stepPlayer(dt, run);
    CL.sim.stepLife(dt);
    if (!me.at && CL.ui.follow && (MV.mode !== "google" || now - lastFollow > 200)) { MV.followTo(me.x, me.z); lastFollow = now; }
    // clock + townsfolk
    const speed = CL.CONFIG.speeds[CL.ui.speedIdx] || 0;
    if (speed) CL.sim.tick(dt * speed);
    if (CL.time.dayNo(S.minutes) !== lastDay) { lastDay = CL.time.dayNo(S.minutes); save(); }
    // day / night tint over the map
    const h = CL.time.hour(S.minutes), day = CL.clamp((h - 5.5) / 1.5, 0, 1) * CL.clamp((20.5 - h) / 1.5, 0, 1);
    $("tint").style.opacity = ((1 - day) * (MV.mode === "ac" ? 0.18 : 0.42)).toFixed(3);
    MV.frame();
    CL.fx.update(MV.mpp(), CL.ui.hoverId, CL.ui.poiId);
    CL.ui.frame();
    CL.interiorView.frame(now / 1000);
    CL.cinema.frame(now);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  if (me.at) CL.interiorView.show(CL.world.byId.get(me.at));

  // deep links for screenshots
  setTimeout(() => {
    if (Q.get("walk") && CL.world.byId.has(Q.get("walk"))) CL.sim.walkTo({ poi: Q.get("walk") });
    if (Q.get("poi")) CL.ui.openPoi(Q.get("poi"));
    if (Q.get("hover")) { const m = CL.ui.markers.get(Q.get("hover")); if (m) { CL.ui.hoverId = Q.get("hover"); m.el.dispatchEvent(new MouseEvent("mouseenter")); } }
    if (Q.get("inside")) CL.sim.enter(Q.get("inside"), Q.get("room") || undefined);
    if (Q.get("journal")) CL.ui.showJournal();
    if (Q.get("gomenu")) CL.ui.showGoTo();
    if (Q.get("cine")) CL.cinema.play(Q.get("cine"));
    if (Q.get("do")) { const [pid, aid] = Q.get("do").split(":"); CL.sim.doActivity(pid, aid); }
  }, 350);
})(window.CL = window.CL || {});
