/* City Life - DOM UI for the explorer: place markers, hover tooltip, place card,
   "you are here" panel, feed, journal. Clickable HTML is only rebuilt when its
   signature changes, so clicks never land on a node that was just replaced. */
(function (CL) {
  const { sim, world: W, time, hours } = CL;
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const UI = CL.ui = { poiId: null, hoverId: null, follow: true, markers: new Map(), agentMarkers: new Map() };
  let MV;
  const S = () => sim.state();

  UI.init = function (mapview) {
    MV = mapview;
    for (const p of W.pois) UI.addPoiMarker(p);
    for (const n of S().npcs) addAgentMarker(n);
    UI.me = addPlayerMarker();
    MV.onClick((x, z) => { if (sim.player().at) return; sim.walkTo({ x, z }); UI.follow = true; sfx("click"); });
    MV.onDrag = () => { UI.follow = false; };
    CL.bus.on("toast", toast);
    UI.feedDirty = true;
    CL.bus.on("feed", () => { UI.feedDirty = true; });
    CL.bus.on("discover", p => { const m = UI.markers.get(p.id); if (m) paintPoiMarker(p, m.el); UI.poiDirty = true; sfx("found"); });
    CL.bus.on("near", () => { UI.hereDirty = true; });
    CL.bus.on("enter", () => { UI.hereDirty = true; });
    CL.bus.on("leave", () => { UI.hereDirty = true; UI.follow = true; });
    $("btnJournal").onclick = () => UI.showJournal();
    $("btnGo").onclick = () => UI.showGoTo();
    CL.bus.on("talk", t => { moment("💬", t.npc.name + " · " + t.npc.role, t.text); sfx("found"); });
    CL.bus.on("did", d => { moment(d.act.e, d.poi.name, d.say); UI.poiDirty = true; sfx("found"); });
    CL.bus.on("firstvisit", q => { if (!CL.interiorView.open && !UI.noAutoCine) setTimeout(() => CL.cinema.play(q.id), 300); });
    CL.bus.on("travel", () => { UI.follow = true; UI.hereDirty = true; });
    $("ovGo").addEventListener("click", onGoClick);
    $("ovGo").addEventListener("input", e => { if (e.target.id === "goSearch") renderGoList(e.target.value); });
    $("moment").addEventListener("click", () => { $("moment").hidden = true; });
    $("btnCenter").onclick = () => { UI.follow = true; };
    $("poicard").addEventListener("click", onCardClick);
    $("here").addEventListener("click", onCardClick);
    $("feed").addEventListener("click", e => { const t = e.target.closest("[data-poi]"); if (t) UI.openPoi(t.dataset.poi, true); });
    $("ovJournal").addEventListener("click", e => { if (e.target.id === "ovJournal" || e.target.closest(".close")) $("ovJournal").classList.remove("show"); const t = e.target.closest("[data-poi]"); if (t) { $("ovJournal").classList.remove("show"); UI.openPoi(t.dataset.poi, true); } });
    document.addEventListener("pointerdown", () => audioInit(), { once: true });
  };

  /* ------------------------------ markers ------------------------------ */
  UI.addPoiMarker = function (p) {
    if (UI.markers.has(p.id)) return;
    const el = document.createElement("div");
    el.className = "poi"; el.dataset.id = p.id;
    el.innerHTML = `<div class="pin"><span class="ic"></span><span class="star">★</span><span class="ev"></span><span class="here"></span></div>`;
    paintPoiMarker(p, el);
    el.addEventListener("mouseenter", () => { UI.hoverId = p.id; showTip(p, el); });
    el.addEventListener("mouseleave", () => { if (UI.hoverId === p.id) UI.hoverId = null; hideTip(); });
    const click = e => { e.stopPropagation(); if (Date.now() - (el._t || 0) < 300) return; el._t = Date.now(); UI.openPoi(p.id, false); };
    el.addEventListener("click", click);
    const m = MV.addMarker(p.lat, p.lng, el, 5);
    if (m.marker) m.marker.addEventListener?.("gmp-click", click);
    UI.markers.set(p.id, m);
  };
  function paintPoiMarker(p, el) {
    const known = S().discovered.has(p.id), c = CL.CATEGORIES[p.category];
    el.classList.toggle("fog", !known);
    el.classList.add("cat-" + p.category);
    el.querySelector(".ic").textContent = known ? c.icon : "?";
  }
  function refreshPoiMarkers() {
    const st = S(), me = sim.player();
    for (const [id, m] of UI.markers) {
      const p = W.byId.get(id), el = m.el, known = st.discovered.has(id);
      const open = sim.isOpen(p), ev = sim.liveEvent(id) || sim.upcomingEvent(id);
      el.classList.toggle("closed", known && !open);
      el.classList.toggle("hover", UI.hoverId === id);
      el.classList.toggle("sel", UI.poiId === id);
      el.classList.toggle("event", !!ev);
      el.classList.toggle("visited", !!st.visits[id]);
      const evEl = el.querySelector(".ev"), evTxt = ev ? ev.emoji : "";
      if (evEl.textContent !== evTxt) evEl.textContent = evTxt;
      el.classList.toggle("fav", st.favs.has(id));
      const near = known && Math.hypot(p.x - me.x, p.z - me.z) < 140;
      if (near !== el._named) { el._named = near; let t = el.querySelector(".tag"); if (!t) { t = document.createElement("div"); t.className = "tag"; t.textContent = p.name; el.appendChild(t); } t.style.display = near ? "" : "none"; }
      const n = known ? sim.npcsAt(id).length : 0, hereEl = el.querySelector(".here"), hTxt = n ? "👤" + (n > 1 ? n : "") : "";
      if (hereEl.textContent !== hTxt) hereEl.textContent = hTxt;
    }
  }
  function addAgentMarker(a) {
    const el = document.createElement("div");
    el.className = "agent npc";
    el.innerHTML = `<div class="tok" style="background:${a.shirt}">${a.name[0]}</div><div class="nm">${esc(a.name)}</div>`;
    el.addEventListener("click", e => { e.stopPropagation(); const me = sim.player(); if (Math.hypot(a.px - me.x, a.pz - me.z) < 20) sim.talkTo(a); else { sim.walkTo({ x: a.px, z: a.pz }); toast("Walking over to " + a.name + " - press E to chat"); } });
    UI.agentMarkers.set(a.id, MV.addMarker(-33.88, 151.18, el, 6));
  }
  const npcLine = n => { const g = n.goal && W.byId.get(n.goal); return `${n.name} · ${n.role}${g ? ` · heading to ${g.name}` : " · heading home"}`; };
  function addPlayerMarker() {
    const el = document.createElement("div");
    el.className = "agent me";
    el.innerHTML = `<div class="arrow"></div><div class="tok">You</div>`;
    return MV.addMarker(-33.88, 151.18, el, 9);
  }
  let agentTick = 0;
  function refreshAgents() {
    const now = performance.now();
    const p = sim.player();
    UI.me.el.style.visibility = p.at ? "hidden" : "";
    if (!p.at) { UI.me.setXZ(p.x, p.z); UI.me.el.querySelector(".arrow").style.transform = `translate(-50%,-50%) rotate(${Math.PI - p.heading}rad)`; UI.me.el.classList.toggle("walking", !!p.moving); }
    if (MV.mode === "google" && now - agentTick < 120) return;   // AdvancedMarker moves are DOM work: 8 Hz is plenty
    agentTick = now;
    for (const n of S().npcs) {
      const m = UI.agentMarkers.get(n.id); if (!m) continue;
      const vis = !n.at;
      m.el.style.visibility = vis ? "" : "hidden";
      if (vis) m.setXZ(n.px, n.pz);
    }
  }

  /* ------------------------------ tooltip ------------------------------ */
  function showTip(p, el) {
    const t = $("tip"), known = S().discovered.has(p.id);
    let html;
    if (!known) html = `<b>Unexplored place</b><div class="muted">Walk within ${CL.CONFIG.discoverRadius} m to reveal it</div>`;
    else {
      const open = sim.isOpen(p), busy = sim.busy(p), ev = sim.liveEvent(p.id) || sim.upcomingEvent(p.id);
      html = `<b>${esc(p.name)}</b><div class="muted">${CL.CATEGORIES[p.category].icon} ${CL.CATEGORIES[p.category].label} · ${esc(p.suburb)}</div><div>${statusHtml(p)}</div>` +
        (open && p.category !== "home" ? `<div class="busy"><span>Busyness</span><div class="bar"><i style="width:${Math.round(busy * 100)}%;background:${busyCol(busy)}"></i></div><span>${busyWord(busy)}</span></div>` : "") +
        (ev ? `<div class="evline">${ev.emoji} ${esc(ev.title)}</div>` : "") + distLine(p);
    }
    t.innerHTML = html; t.style.display = "block";
    const r = el.getBoundingClientRect();
    t.style.left = Math.min(innerWidth - 250, r.left + r.width / 2 + 14) + "px"; t.style.top = Math.max(8, r.top - 12) + "px";
  }
  const hideTip = () => { $("tip").style.display = "none"; };
  const closesTxt = p => { const c = hours.closesIn(p.week, S().minutes); return c === Infinity || c > 180 ? "" : ` · closes ${time.fmt(S().minutes + c)}`; };
  const statusHtml = p => p.category === "home" ? `<span class="good">Home</span>` : p.closedForGood ? `<span class="bad">Temporarily closed</span>` : sim.isOpen(p) ? `<span class="good">Open</span>${closesTxt(p)}` : `<span class="bad">${esc(hours.closedReason(p.week, S().minutes))}</span>`;
  const busyWord = b => b > 0.95 ? "Full" : b > 0.75 ? "Packed" : b > 0.5 ? "Busy" : b > 0.2 ? "Steady" : b > 0.02 ? "Quiet" : "Empty";
  const busyCol = b => b > 0.85 ? "#e8590c" : b > 0.5 ? "#f2a33a" : "#4caf50";
  const distTo = p => { const me = sim.player(); return me.at === p.id ? 0 : Math.hypot(p.x - me.x, p.z - me.z); };
  const fmtDist = d => d < 1000 ? `${Math.round(d / 10) * 10} m` : `${(d / 1000).toFixed(1)} km`;
  const distLine = p => { const d = distTo(p); return d > CL.CONFIG.arriveRadius ? `<div class="muted small">🚶 ${fmtDist(d)} · ~${Math.max(1, Math.round(d / 80))} min walk</div>` : ""; };

  /* ------------------------------ place card ------------------------------ */
  UI.openPoi = function (pid, pan) {
    const p = W.byId.get(pid); if (!p) return;
    UI.poiId = pid; UI.poiDirty = true; hideTip();
    if (pan) { MV.panTo(p.x, p.z); UI.follow = false; }
    $("poicard").classList.add("show");
    renderPoiCard(true);
    if (p.placeId && CL.places.enabled && S().discovered.has(pid)) CL.places.details(p.placeId).then(d => { if (d) { W.applyDetails(p, d); if (UI.poiId === pid) renderPoiCard(true); } });
  };
  UI.closePoi = () => { UI.poiId = null; $("poicard").classList.remove("show"); };
  const stars = n => "★".repeat(Math.round(n)) + "☆".repeat(5 - Math.round(n));
  const dollars = n => n ? "$".repeat(n) : "Free";

  function renderPoiCard(force) {
    const p = W.byId.get(UI.poiId); if (!p) return;
    const st = S(), known = st.discovered.has(p.id), c = CL.CATEGORIES[p.category], me = sim.player();
    const d = p.placeId && CL.places.cache.get(p.placeId);
    const sig = [p.id, known, Math.floor(st.minutes / 5), Object.keys(st.done).length, sim.npcsAt(p.id).length, !!d, st.favs.has(p.id), st.visits[p.id], me.near, me.at, Math.round(distTo(p) / 50)].join("|");
    if (!force && sig === UI.cardSig) return;
    UI.cardSig = sig;
    const el = $("poicard");
    if (!known) {
      el.innerHTML = `<div class="ch"><div class="cic fogic">?</div><div class="cht"><h2>Unexplored place</h2><div class="muted">${CL.ZONES[p.zone].label}</div></div><button class="x" data-a="close">✕</button></div>
        <div class="fogbox">Something's here. Get within <b>${CL.CONFIG.discoverRadius} m</b> to find out what.${distLine(p)}<br><span class="muted small">Details only load once you've found a place.</span></div>
        <div class="btns"><button class="primary" data-a="walk">🚶 Walk there</button></div>`;
      return;
    }
    const open = sim.isOpen(p), busy = sim.busy(p);
    const ev = sim.liveEvent(p.id), up = !ev && sim.upcomingEvent(p.id);
    const photo = d && CL.places.photo(d), name = d?.displayName?.text || p.name;
    let real;
    if (d) {
      real = `<div class="real">
        ${d.rating ? `<div><span class="rstars">${stars(d.rating)}</span> <b>${d.rating.toFixed(1)}</b> <span class="muted">(${(d.userRatingCount || 0).toLocaleString()})</span> · ${d.priceLevel ? dollars(CL.PLACES_PRICE[d.priceLevel]) : ""}</div>` : ""}
        <div class="muted">${esc(d.primaryType || "").replace(/_/g, " ")}</div>
        <div>${esc(d.formattedAddress || p.address)}</div>
        ${d.currentOpeningHours?.weekdayDescriptions ? `<details><summary>${d.currentOpeningHours.openNow ? `<span class="good">Open now</span>` : `<span class="bad">Closed now</span>`} · opening hours</summary><div class="hrs">${d.currentOpeningHours.weekdayDescriptions.map(esc).join("<br>")}</div></details>` : ""}
        <div class="attr">Place data © Google</div></div>`;
    } else {
      real = `<div class="real">
        <div>📍 ${esc(p.address)}${p.suburb ? ", " + esc(p.suburb) : ""}</div>
        ${p.category !== "home" ? `<div class="hrsline">🕒 ${esc(hours.summary(p.week))}</div><div class="muted small">Hours: ${esc(p.hoursSource)}</div>` : ""}
        ${p.description ? `<p>${esc(p.description)}</p>` : ""}
        ${p.localTip ? `<p class="tipline">💡 ${esc(p.localTip)}</p>` : ""}
        ${p.fictional ? `<div class="muted small">Game venue (not a real business)</div>` : ""}
        <div class="attr">${p.placeId && CL.places.enabled ? "Loading Google place details…" : p.category === "home" ? "Layout from the rental listing's floor plan (Morton, via Domain, Oct 2024)" : "Offline data · venue research © Sydney Sim (OSM ODbL + public listings, Sep 2026)"}</div></div>`;
    }
    const cp = !photo && (window.CL_PHOTOS || {})[p.id];
    const commonsHtml = cp ? `<figure class="photo"><img src="${esc(cp.file)}" alt="${esc(name)}" loading="lazy"><figcaption>Photo: ${esc(cp.author || "Unknown")} · <a href="${esc(cp.licenseUrl || cp.source)}" target="_blank" rel="noopener">${esc(cp.license)}</a> · <a href="${esc(cp.source)}" target="_blank" rel="noopener">Wikimedia Commons</a></figcaption></figure>` : "";
    const photoHtml = cp ? commonsHtml : photo ? `<figure class="photo"><img src="${esc(photo.src)}" alt="${esc(name)}"><figcaption>Photo: ${photo.authors.map(a => a.uri ? `<a href="${esc(a.uri)}" target="_blank" rel="noopener">${esc(a.displayName)}</a>` : esc(a.displayName)).join(", ") || "Google"}</figcaption></figure>`
      : `<div class="photo ph cat-${p.category}" ${p.brand && p.brand.brandColours ? `style="background:linear-gradient(135deg,${esc(p.brand.brandColours.primary)},${esc(p.brand.brandColours.secondary || p.brand.brandColours.primary)})"` : ""}><span>${c.icon}</span><em>${p.category === "home" ? "Rhodes House · 1920s warehouse conversion" : "No photo offline"}</em></div>`;
    const b = p.brand;
    const brandHtml = b ? `<div class="brand">${b.shopfront ? `<div class="bf">🏪 ${esc(b.shopfront)}</div>` : ""}${b.knownFor && b.knownFor.length ? `<div class="kf">${b.knownFor.map(k => `<span>${esc(k)}</span>`).join("")}</div>` : ""}<div class="bm">${p.rating ? `<span class="rstars">★</span> ${esc(p.rating)} · ` : ""}${b.chain ? esc(b.chain) + " · " : ""}${b.verified ? "" : "<span title='Not yet checked against a source'>unverified · </span>"}${b.website ? `<a href="${esc(b.website)}" target="_blank" rel="noopener">Website ↗</a>` : ""}</div></div>` : "";
    const capturedSite = (window.CL_SITES || {})[p.id];
    const failedCapture = capturedSite && /access denied|just a moment|captcha|not found|\b403\b|\b404\b/i.test(capturedSite.title || "");
    const site = failedCapture ? null : capturedSite;
    const siteHtml = site ? `<a class="site" href="${esc(site.url)}" target="_blank" rel="noopener"><img src="${esc(site.file)}" alt="${esc(site.host)} website" loading="lazy"><div class="sm"><b>${esc(site.title || site.host)}</b>${site.desc ? `<span>${esc(site.desc)}</span>` : ""}<em>From ${esc(site.host)} · captured ${esc(site.capturedOn)} · open site ↗</em></div></a>` : "";
    const things = sim.thingsAt(p);
    const doneN = id => st.done[p.id + "|" + id] || 0;
    const thingsHtml = things.length ? `<h3>Things to do</h3><div class="acts">${things.map(t => `<button class="act ${t.ok ? "" : "dis"} ${t.live ? "live" : ""}" data-a="do" data-id="${t.id}"><span class="ae">${t.emoji}</span><span class="al">${esc(t.label)}${t.live ? " · on now" : ""}<small>${t.ok ? `about ${t.min} min` : esc(t.why)}</small></span><span class="ad">${doneN(t.id) ? "✓" + (doneN(t.id) > 1 ? doneN(t.id) : "") : ""}</span></button>`).join("")}</div>` : "";
    const folk = sim.npcsAt(p.id);
    const whoHtml = p.category === "home" ? "" : `<h3>Who's here</h3><div class="whos">${folk.length ? folk.map(n => `<div class="who"><span class="dot" style="background:${n.shirt}">${n.name[0]}</span><b>${esc(n.name)}</b><span class="muted">${esc(n.role)}</span></div>`).join("") : ""}
      <div class="muted small">${open ? `${folk.length ? "plus " : ""}~${sim.crowd(p)} ${folk.length ? "others" : "people you don't know"}` : "Nobody - it's closed."}</div></div>`;
    const v = st.visits[p.id] || 0;
    const visitHtml = p.category === "home" ? "" : `<div class="mem"><span>${v ? `You've been here <b>${v}</b> time${v === 1 ? "" : "s"}` : "You haven't been here yet"}</span>${st.lastVisit[p.id] ? `<span class="muted">last ${time.DAY_NAMES[time.dow(st.lastVisit[p.id])]} ${time.fmt(st.lastVisit[p.id])}</span>` : ""}</div>`;
    el.innerHTML = `
      <div class="ch"><div class="cic cat-${p.category}">${c.icon}</div><div class="cht"><h2>${esc(name)}</h2><div class="muted">${c.label} · ${esc(p.suburb || CL.ZONES[p.zone].label)}${p.category !== "home" ? " · " + dollars(p.priceLevel) : ""}</div></div><button class="x" data-a="close">✕</button></div>
      ${photoHtml}
      <div class="statusrow"><div>${statusHtml(p)}</div>${p.category !== "home" && open ? `<div class="busy"><span>Busy</span><div class="bar"><i style="width:${Math.round(busy * 100)}%;background:${busyCol(busy)}"></i></div><span>${busyWord(busy)}</span></div>` : ""}</div>
      ${ev ? `<div class="evbox live">${ev.emoji} <b>On now:</b> ${esc(ev.title)} <span class="muted">until ${time.fmt(ev.end)}</span></div>` : up ? `<div class="evbox">${up.emoji} <b>${time.DAY_NAMES[time.dow(up.start)]} ${time.fmt(up.start)}:</b> ${esc(up.title)}</div>` : ""}
      ${real}
      ${brandHtml}
      ${siteHtml}${failedCapture ? `<a href="${esc(capturedSite.url)}" target="_blank" rel="noopener">Visit ${esc(capturedSite.host)} website</a>` : ""}
      ${visitHtml}
      ${thingsHtml}
      ${whoHtml}
      <div class="btns">${actionButtons(p)}${CL.MV && CL.MV.setCine ? `<button data-a="cine">▶ Showcase</button>` : ""}<button data-a="fav" class="${st.favs.has(p.id) ? "on" : ""}">${st.favs.has(p.id) ? "★ Favourite" : "☆ Favourite"}</button></div>`;
  }
  // walk / go inside, depending on where the player is
  function actionButtons(p) {
    const me = sim.player(), here = me.near === p.id || me.at === p.id;
    if (me.at === p.id) return `<button class="primary" data-a="leave">🚪 Head outside</button>`;
    if (here && p.interior) return sim.canEnter(p) ? `<button class="primary" data-a="enter">🚪 Go inside</button>` : `<button disabled>🔒 Closed</button>`;
    if (here) return `<span class="good small">📍 You're here</span>`;
    return `<button class="primary" data-a="walk">🚶 Walk there</button>${p.interior ? `<span class="muted small">(you can go inside)</span>` : ""}`;
  }
  function onCardClick(e) {
    const b = e.target.closest("[data-a]"); if (!b) return;
    const pid = b.dataset.id || UI.poiId, p = W.byId.get(pid);
    switch (b.dataset.a) {
      case "close": return UI.closePoi();
      case "walk": sim.walkTo({ poi: p.id }); UI.follow = true; sfx("click"); break;
      case "enter": sim.enter(p.id); break;
      case "leave": sim.leave(); CL.interiorView.close(); break;
      case "card": return UI.openPoi(pid);
      case "do": { const t = sim.thingsAt(p).find(x => x.id === b.dataset.id); if (t && !t.ok) { toast(t.why); return; } sim.doActivity(p.id, b.dataset.id); break; }
      case "cine": UI.closePoi(); CL.cinema.play(p.id); return;
      case "fav": sim.toggleFav(p.id); toast(S().favs.has(p.id) ? `★ Saved ${p.name}` : "Removed from favourites"); break;
    }
    UI.poiDirty = true; UI.hereDirty = true;
  }

  /* ------------------------------ you-are-here / top / feed / journal ------------------------------ */
  function renderHere() {
    const me = sim.player(), st = S();
    const q = me.near && W.byId.get(me.near);
    const zone = CL.ZONES[W.zoneFor(...Object.values(CL.geo.toLL(me.x, me.z)))];
    const sig = [me.near, me.at, me.room, q && sim.isOpen(q), q && st.visits[q.id], Math.floor(st.minutes / 10)].join("|");
    if (sig === $("here").dataset.sig) return; $("here").dataset.sig = sig;
    let html;
    if (me.at) {
      const lay = sim.layout();
      html = `<div class="hh">📍 <b>Inside ${esc(lay.def.name)}</b></div><div class="muted small">Click the floor to walk, click things to look at them. The door takes you out.</div>`;
    } else if (q) {
      html = `<div class="hh">${CL.CATEGORIES[q.category].icon} <b>${esc(q.name)}</b> <span class="muted">${esc(q.suburb || "")}</span></div><div class="small">${statusHtml(q)}</div>
        <div class="btns">${actionButtons(q).replace(/data-a="(enter|leave)"/, `data-a="$1" data-id="${q.id}"`)}<button data-a="card" data-id="${q.id}">ℹ️ Details</button></div>`;
    } else html = `<div class="hh">🧭 <b>Out exploring</b> <span class="muted">${esc(zone ? zone.label : "Inner West")}</span></div><div class="muted small">Find places by walking near them.</div>`;
    $("here").innerHTML = html + `<div class="keys"><b>WASD</b>/<b>arrows</b> walk · <b>Shift</b> jog · click map to walk there · <b>E</b> go in/out or chat · <b>Q</b>/<b>R</b> or right-drag rotate · <b>G</b> go to · <b>F</b> follow · <b>J</b> journal</div>`;
  }
  function renderTop() {
    const st = S(), m = st.minutes, z = sim.discoveredByZone();
    const found = Object.values(z).reduce((a, v) => a + v.found, 0), total = Object.values(z).reduce((a, v) => a + v.total, 0), visited = Object.values(z).reduce((a, v) => a + v.visited, 0);
    $("clk").innerHTML = `🕒 <b>${time.fmt(m)}</b> ${time.DAY_LONG[time.dow(m)]}`;
    $("disc").innerHTML = `🗺️ <b>${found}</b>/${total} found · <b>${visited}</b> visited`;
    document.querySelectorAll("#speeds button").forEach(b => b.classList.toggle("on", +b.dataset.s === UI.speedIdx));
    $("btnCenter").classList.toggle("on", UI.follow);
    const pc = CL.places.calls;
    $("mode").textContent = MV.mode === "google" ? `Google map · Places: ${pc.nearby} nearby, ${pc.details} details, ${pc.photos} photos` : "Offline map · no Places calls";
  }
  function renderFeed() {
    const f = S().feed.slice(-8).reverse();
    $("feedlist").innerHTML = f.map(x => `<div class="fi k-${x.kind}" ${x.poi ? `data-poi="${esc(x.poi)}"` : ""}><span class="ft">${time.DAY_NAMES[time.dow(x.t)]} ${time.fmt(x.t)}</span> ${esc(x.text)}</div>`).join("") || `<div class="fi muted">Nothing yet - head out the door.</div>`;
  }
  UI.showJournal = function () {
    const st = S(), z = sim.discoveredByZone();
    const visited = W.pois.filter(p => st.visits[p.id]).sort((a, b) => (st.lastVisit[b.id] || 0) - (st.lastVisit[a.id] || 0));
    const favs = W.pois.filter(p => st.favs.has(p.id));
    const row = p => `<li data-poi="${p.id}">${CL.CATEGORIES[p.category].icon} <b>${esc(p.name)}</b> <span class="muted">${esc(p.suburb || "")}${st.visits[p.id] ? ` · ${st.visits[p.id]}×` : ""}</span></li>`;
    $("journalSheet").innerHTML = `<div class="qh"><h2>📓 Journal</h2><button class="close">✕</button></div>
      <h3>Neighbourhoods</h3><table>${Object.entries(z).map(([k, v]) => `<tr><td>${esc(CL.ZONES[k].label)}</td><td><b>${v.found}</b>/${v.total} found · ${v.visited} visited</td><td><div class="bar"><i style="width:${v.found / v.total * 100}%;background:#6cc070"></i></div></td></tr>`).join("")}</table>
      ${favs.length ? `<h3>★ Favourites</h3><ul class="plist">${favs.map(row).join("")}</ul>` : ""}
      ${Object.keys(st.done).length ? `<h3>Things you've done</h3><ul class="plist">${Object.entries(st.done).map(([k, n]) => { const [pid, aid] = k.split("|"), p = W.byId.get(pid), a = CL.ACTIVITIES[aid]; return p && a ? `<li data-poi="${pid}">${a.e} ${esc(a.l)} <span class="muted">at ${esc(p.name)}${n > 1 ? " · " + n + "×" : ""}</span></li>` : ""; }).join("")}</ul>` : ""}
      <h3>Places you've been (${visited.length})</h3><ul class="plist">${visited.map(row).join("") || `<li class="muted">None yet.</li>`}</ul>`;
    $("ovJournal").classList.add("show");
  };

  /* ------------------------------ moments + go to ------------------------------ */
  let momentT;
  function moment(emoji, where, text) {
    const el = $("moment"); clearTimeout(momentT);
    el.innerHTML = `<div class="me-e">${emoji}</div><div><b>${esc(where)}</b><p>${esc(text)}</p><span class="muted small">${time.DAY_NAMES[time.dow(S().minutes)]} ${time.fmt(S().minutes)} · tap to close</span></div>`;
    el.hidden = false; momentT = setTimeout(() => { el.hidden = true; }, 9000);
  }
  UI.moment = moment;
  const areaXZ = a => a.poi && W.byId.has(a.poi) ? W.byId.get(a.poi) : CL.geo.toXZ(a.lat, a.lng);
  UI.showGoTo = function () {
    const me = sim.player();
    $("goSheet").innerHTML = `<div class="qh"><h2>🧭 Go to…</h2><button class="close">✕</button></div>
      <div class="muted small">Walk there, or hop on a bus to skip ahead (the clock moves by the length of the trip).</div>
      <div class="areas">${CL.AREAS.map(a => { const xz = areaXZ(a), d = Math.hypot(xz.x - me.x, xz.z - me.z);
        return `<div class="area"><span class="ar-e">${a.e}</span><div class="ar-t"><b>${esc(a.label)}</b><span class="muted small">${esc(a.sub)} · ${fmtDist(d)}</span></div><div class="ar-b"><button data-go="walk" data-area="${a.id}">🚶 Walk</button><button data-go="bus" data-area="${a.id}" class="primary">🚌 Go now</button></div></div>`; }).join("")}</div>
      <h3>Places you've found</h3><input id="goSearch" type="search" placeholder="Search cafes, pubs, the Quad…" autocomplete="off"><ul class="plist" id="goList"></ul>`;
    renderGoList("");
    $("ovGo").classList.add("show");
  };
  function renderGoList(q) {
    const st = S(), me = sim.player(), ql = q.trim().toLowerCase();
    const list = W.pois.filter(p => st.discovered.has(p.id) && (!ql || (p.name + " " + p.suburb + " " + CL.CATEGORIES[p.category].label).toLowerCase().includes(ql)))
      .map(p => ({ p, d: Math.hypot(p.x - me.x, p.z - me.z) })).sort((a, b) => a.d - b.d).slice(0, 40);
    $("goList").innerHTML = list.map(({ p, d }) => `<li><span>${CL.CATEGORIES[p.category].icon} <b>${esc(p.name)}</b> <span class="muted">${esc(p.suburb || "")} · ${fmtDist(d)}</span></span><span class="gobtns"><button data-go="walk" data-poi="${p.id}" title="Walk">🚶</button><button data-go="bus" data-poi="${p.id}" title="Go now">🚌</button><button data-go="card" data-poi="${p.id}" title="Details">ℹ️</button></span></li>`).join("") || `<li class="muted">${ql ? "Nothing by that name yet. Keep exploring." : "Nothing found yet."}</li>`;
  }
  function onGoClick(e) {
    if (e.target.id === "ovGo" || e.target.closest(".close")) { $("ovGo").classList.remove("show"); return; }
    const b = e.target.closest("[data-go]"); if (!b) return;
    const a = b.dataset.area && CL.AREAS.find(x => x.id === b.dataset.area), p = b.dataset.poi && W.byId.get(b.dataset.poi);
    const target = p || (a && a.poi && W.byId.get(a.poi)), xz = p || areaXZ(a);
    $("ovGo").classList.remove("show");
    if (b.dataset.go === "card") return UI.openPoi(p.id, true);
    if (b.dataset.go === "walk") { if (target) sim.walkTo({ poi: target.id }); else sim.walkTo(xz); UI.follow = true; }
    else { sim.travelTo(xz.x, xz.z, "Bus to " + (p ? p.name : a.label), target && target.id); if (target) UI.openPoi(target.id); }
    sfx("click");
  }

  UI.frame = function () {
    refreshAgents();
    UI.uiT = (UI.uiT || 0) + 1;
    if (UI.uiT % 6 === 0) { refreshPoiMarkers(); renderTop(); if (UI.poiId) renderPoiCard(UI.poiDirty); UI.poiDirty = false; }
    if (UI.hereDirty || UI.uiT % 20 === 0) { renderHere(); UI.hereDirty = false; }
    if (UI.feedDirty) { renderFeed(); UI.feedDirty = false; }
  };

  /* ------------------------------ toast / sound ------------------------------ */
  let toastT;
  function toast(msg) { const el = $("toast"); el.textContent = msg; el.style.opacity = 1; clearTimeout(toastT); toastT = setTimeout(() => el.style.opacity = 0, 2600); }
  UI.toast = toast;
  let actx = null;
  function audioInit() { if (!actx) try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* no audio */ } }
  function tone(f, d, type = "sine", v = .06, delay = 0) { if (!actx) return; const t = actx.currentTime + delay, o = actx.createOscillator(), g = actx.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g).connect(actx.destination); o.start(t); o.stop(t + d); }
  function sfx(k) { if (k === "click") tone(560, .05); if (k === "found") { tone(660, .08, "triangle", .05); tone(990, .12, "triangle", .05, .08); } if (k === "door") tone(330, .12, "triangle"); }
  UI.sfx = sfx;
})(window.CL = window.CL || {});
