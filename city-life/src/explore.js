/* City Life - the single-player explorer: clock, venue rules (hours, busyness,
   events), the player (free walking with building collision, click-to-walk
   along streets, entering places, walking around inside), townsfolk on weekly
   schedules, discovery and a visit log. No DOM and no three.js: it talks to the
   UI through CL.bus events, so it runs headless in node.
   Exposed as CL.sim so the map/fx/interior modules share one state object. */
(function (CL) {
  const { time, hours, world: W, interiors: IN, clamp } = CL;
  const bus = CL.bus = { subs: {}, on(t, f) { (this.subs[t] = this.subs[t] || []).push(f); }, emit(t, d) { (this.subs[t] || []).forEach(f => f(d)); } };
  const toast = msg => bus.emit("toast", msg);
  const feed = (text, kind, poi) => { S.feed.push({ t: S.minutes, text, kind: kind || "info", poi: poi || null }); if (S.feed.length > 120) S.feed.shift(); bus.emit("feed", S.feed[S.feed.length - 1]); };
  let S = null;
  const sim = CL.sim = {};
  sim.state = () => S;

  /* ------------------------------ state ------------------------------ */
  const HOME = "home-rhodes-house";
  sim.HOME = HOME;
  sim.layouts = {};
  sim.init = function (saved) {
    for (const key of Object.keys(CL.INTERIOR_DEFS)) if (!sim.layouts[key]) sim.layouts[key] = IN.build(key);
    const home = W.byId.get(HOME);
    S = {
      minutes: CL.CONFIG.startMinutes, discovered: new Set([HOME]), visits: {}, lastVisit: {}, favs: new Set(), done: {}, met: {},
      events: [], announced: {}, feed: [],
      player: { x: home.x, z: home.z, heading: 0, moving: false, route: null, near: null, at: HOME, room: "home", ix: 0, iz: 0, ipath: null, look: null },
      npcs: CL.NPCS.map(n => ({ ...n })),
    };
    const lay = sim.layouts.home; S.player.ix = lay.def.start.x; S.player.iz = lay.def.start.z;
    sim.saveRecovered = !!saved && !validSave(saved);
    if (saved && !sim.saveRecovered) restore(saved);
    lastHourTick = -1;
    for (const n of S.npcs) hydrateNpc(n);
    discoverAround(S.player.x, S.player.z, true);
    return S;
  };
  function hydrateNpc(n) {
    const xz = CL.geo.toXZ(n.home[0], n.home[1]);
    Object.assign(n, { hx: xz.x, hz: xz.z, px: xz.x, pz: xz.z, at: null, steps: null, goal: null, npc: true });
    const g = npcGoal(n);
    if (g && W.byId.has(g)) { const p = W.byId.get(g); n.at = g; n.px = p.x; n.pz = p.z; n.goal = g; seatNpc(n); }
  }
  sim.byId = id => S.npcs.find(n => n.id === id);

  /* ------------------------------ venue rules ------------------------------ */
  const cat = p => CL.CATEGORIES[p.category];
  sim.isOpen = (p, m = S.minutes) => p.category === "home" || (!p.closedForGood && hours.isOpen(p.week, m));
  sim.npcsAt = pid => S.npcs.filter(n => n.at === pid);
  sim.crowd = function (p, m = S.minutes) {
    if (p.category === "home" || !sim.isOpen(p, m)) return 0;
    const c = cat(p), curve = CL.BUSY[c.curve] || CL.BUSY.shop, h = Math.floor(time.hour(m));
    let b = curve[h] * (0.55 + 0.55 * CL.hash01(p.id, Math.floor(m / 60)));
    if (liveEvent(p.id)) b = Math.min(1, b * 1.3 + 0.25);
    return Math.round(c.capacity * b * 0.85);
  };
  sim.occupancy = p => sim.crowd(p) + sim.npcsAt(p.id).length;
  sim.busy = p => p.category === "home" ? 0 : clamp(sim.occupancy(p) / cat(p).capacity, 0, 1);
  function liveEvent(pid, tag) { return S.events.find(e => e.poi === pid && (!tag || e.tag === tag) && S.minutes >= e.start && S.minutes < e.end); }
  sim.liveEvent = liveEvent;
  sim.upcomingEvent = pid => S.events.find(e => e.poi === pid && S.minutes < e.end);
  // things you can do at a place, and whether you can do them right now: [{id, emoji, label, min, ok, why, live}]
  sim.thingsAt = p => (p.things || cat(p).things || []).map(id => { const a = CL.ACTIVITIES[id]; return a && Object.assign({ id, emoji: a.e, label: a.l, min: a.min }, canDo(p, a)); }).filter(Boolean);
  function canDo(p, a) {
    const me = S.player, here = me.near === p.id || me.at === p.id;
    const live = a.ev ? (a.ev === "*" ? S.events.find(e => e.poi === p.id && S.minutes >= e.start && S.minutes < e.end) : liveEvent(p.id, a.ev)) : null;
    if (a.ev && !live) { const up = S.events.find(e => e.poi === p.id && S.minutes < e.end); return { ok: false, live: false, why: up ? `Starts ${time.DAY_NAMES[time.dow(up.start)]} ${time.fmt(up.start)}` : "Only when it's on" }; }
    if (!sim.isOpen(p)) return { ok: false, why: "Closed right now" };
    const h = time.hour(S.minutes), hh = h < 6 ? h + 24 : h;
    if (a.from != null && (hh < a.from || hh >= a.to)) return { ok: false, why: `From ${time.fmt(a.from * 60)}` };
    if (!here) return { ok: false, why: "Walk there first" };
    return { ok: true, live: !!live };
  }
  // do it: time passes, you get the moment, it goes in the journal
  sim.doActivity = function (pid, id) {
    const p = W.byId.get(pid), a = CL.ACTIVITIES[id]; if (!p || !a) return null;
    const c = canDo(p, a); if (!c.ok) { toast(c.why); return null; }
    sim.tick(a.min);
    const k = pid + "|" + id, n = (S.done[k] = (S.done[k] || 0) + 1);
    let say = a.say.replace(/{place}/g, p.name);
    if (n === 1 && p.localTip) say += " " + p.localTip;
    feed(`${a.e} ${a.l} at ${p.name}`, "did", pid);
    logVisit(p);
    bus.emit("did", { poi: p, act: a, say, n });
    return say;
  };
  // quick travel: hop on a bus / grab a scooter; the clock moves by the trip
  sim.travelTo = function (x, z, label, pid) {
    const p = S.player; if (p.at) sim.leave();
    const d = Math.hypot(x - p.x, z - p.z), n = W.nearestNode(x, z);
    if (n < 0) return;
    const mins = Math.max(4, Math.round(d / 220) + 3);
    p.x = W.nodes.xs[n]; p.z = W.nodes.zs[n]; p.route = null; p.moving = false; p.near = null;
    sim.tick(mins);
    feed(`🚌 ${label || "Travelled"} (${mins} min)`, "info");
    afterStep();
    if (pid && W.byId.has(pid)) arrive(W.byId.get(pid), true);   // dropped at its door
    bus.emit("travel", { x: p.x, z: p.z });
  };

  /* ------------------------------ player: street ------------------------------ */
  const P = () => S.player;
  sim.player = () => S.player;
  // free movement (keys / stick). dx,dz in -1..1, dt in real seconds. Slides along walls.
  sim.move = function (dx, dz, dt, run) {
    const p = P(); if (p.at) return moveInside(dx, dz, dt, run);
    const L = Math.hypot(dx, dz); if (!L) { p.moving = !!p.route; return; }
    p.route = null;
    const sp = (run ? CL.CONFIG.runSpeed : CL.CONFIG.walkSpeed) * dt, mx = dx / L * sp, mz = dz / L * sp;
    p.heading = Math.atan2(mx, mz);
    const hx = W.hit(p.x + mx, p.z + mz);
    if (hx < 0) { p.x += mx; p.z += mz; }
    else if (W.hit(p.x + mx, p.z) < 0) p.x += mx;
    else if (W.hit(p.x, p.z + mz) < 0) p.z += mz;
    if (hx >= 0) bump(hx);
    p.moving = true;
    afterStep();
  };
  // bumping into a building with a known place in it counts as arriving at its door
  function bump(solid) { const q = W.poisInSolid(solid)[0]; if (q) arrive(q, true); }
  // click-to-walk: follow the street graph to a point or a place
  sim.walkTo = function (target) {
    const p = P();
    if (p.at) sim.leave();
    const to = target.poi ? W.byId.get(target.poi) : target;
    p.route = W.route({ x: p.x, z: p.z }, to);
    p.routeGoal = target.poi || null;
    p.moving = true;
    bus.emit("route", p.route);
  };
  sim.stop = () => { P().route = null; P().moving = false; };
  function stepRoute(dt, run) {
    const p = P(); if (!p.route) return;
    let move = (run ? CL.CONFIG.runSpeed : CL.CONFIG.walkSpeed) * 1.6 * dt;   // auto-walk is a brisk pace
    while (move > 0 && p.route.length) {
      const q = p.route[0], dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
      if (d > 0.01) p.heading = Math.atan2(dx, dz);
      if (d <= move) { p.x = q.x; p.z = q.z; p.route.shift(); move -= d; } else { p.x += dx / d * move; p.z += dz / d * move; move = 0; }
    }
    afterStep();
    if (!p.route.length) {
      p.route = null; p.moving = false;
      if (p.routeGoal) arrive(W.byId.get(p.routeGoal), true);
      p.routeGoal = null;
    }
  }
  function afterStep() {
    const p = P();
    discoverAround(p.x, p.z);
    const near = W.poisNear(p.x, p.z, CL.CONFIG.arriveRadius).filter(q => S.discovered.has(q.id)).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
    if (near) arrive(near);
    else if (p.near) { const q = W.byId.get(p.near); if (Math.hypot(q.x - p.x, q.z - p.z) > CL.CONFIG.arriveRadius * 2.2) { p.near = null; bus.emit("near", null); } }
  }
  // near = close enough for "go inside" / the here-panel; a visit needs you to actually walk up to it
  function arrive(q, visit) {
    const p = P();
    if (!q) return;
    discover(q);
    if (visit) logVisit(q);
    if (p.near === q.id) return;
    p.near = q.id;
    bus.emit("near", q);
  }
  function logVisit(q) {
    if (q.category !== "home" && (S.lastVisit[q.id] || -1e9) < S.minutes - 90) {
      S.visits[q.id] = (S.visits[q.id] || 0) + 1; S.lastVisit[q.id] = S.minutes;
      const first = S.visits[q.id] === 1;
      if (first) bus.emit("firstvisit", q);
      feed(`${first ? "First visit" : "Back at"}: ${q.name}${first ? "" : ` (visit ${S.visits[q.id]})`}`, first ? "visit" : "info", q.id);
      bus.emit("near", q);
    }
  }

  /* ------------------------------ player: inside ------------------------------ */
  sim.canEnter = q => !!(q && q.interior && (q.category === "home" || sim.isOpen(q)));
  sim.enter = function (pid, room) {
    const q = W.byId.get(pid), p = P();
    if (!q || !q.interior) return false;
    if (!sim.canEnter(q)) { toast(`${q.name} is closed - ${hours.closedReason(q.week, S.minutes)}`); return false; }
    const key = room || q.interior, lay = sim.layouts[key];
    p.at = pid; p.room = key; p.route = null; p.moving = false; p.ipath = null; p.near = pid;
    p.x = q.x; p.z = q.z;
    p.ix = lay.def.start.x; p.iz = lay.def.start.z;
    discover(q); logVisit(q);
    bus.emit("enter", { poi: q, room: key });
    return true;
  };
  sim.leave = function () {
    const p = P(); if (!p.at) return;
    const q = W.byId.get(p.at);
    p.at = null; p.room = null; p.ipath = null;
    // step out onto the nearest street point so you're not stuck in the footprint
    const n = W.nearestNode(q.x, q.z);
    if (n >= 0) { p.x = W.nodes.xs[n]; p.z = W.nodes.zs[n]; }
    p.near = q.id;
    bus.emit("leave", q);
  };
  sim.layout = () => P().room && sim.layouts[P().room];
  sim.walkInside = function (tx, tz) {
    const p = P(), lay = sim.layout(); if (!lay) return false;
    const f = IN.bfs(lay, p.ix, p.iz), path = IN.pathTo(f, tx, tz);
    if (!path) return false;
    p.ipath = path; p.look = null; return true;
  };
  sim.walkToObject = function (o) {
    const p = P(), lay = sim.layout(); if (!lay) return false;
    const f = IN.bfs(lay, p.ix, p.iz), t = IN.approach(lay, f, o);
    if (!t) return false;
    p.ipath = IN.pathTo(f, t.x, t.z) || []; p.look = o; return true;
  };
  function moveInside(dx, dz, dt, run) {
    const p = P(), lay = sim.layout(); if (!lay) return;
    const L = Math.hypot(dx, dz); if (!L) return;
    p.ipath = null; p.look = null;
    const sp = CL.CONFIG.insideSpeed * (run ? 1.7 : 1) * dt, mx = dx / L * sp, mz = dz / L * sp;
    p.iheading = Math.atan2(mx, mz);
    const ok = (x, z) => IN.walkable(lay, Math.round(x), Math.round(z));
    if (ok(p.ix + mx, p.iz + mz)) { p.ix += mx; p.iz += mz; }
    else if (ok(p.ix + mx, p.iz)) p.ix += mx;
    else if (ok(p.ix, p.iz + mz)) p.iz += mz;
    p.imoving = true;
    checkDoor();
  }
  function stepInside(dt) {
    const p = P(); if (!p.ipath) { p.imoving = false; return; }
    let move = CL.CONFIG.insideSpeed * dt;
    while (move > 0 && p.ipath.length) {
      const q = p.ipath[0], dx = q.x - p.ix, dz = q.z - p.iz, d = Math.hypot(dx, dz);
      if (d > 0.01) p.iheading = Math.atan2(dx, dz);
      if (d <= move) { p.ix = q.x; p.iz = q.z; p.ipath.shift(); move -= d; } else { p.ix += dx / d * move; p.iz += dz / d * move; move = 0; }
    }
    p.imoving = true;
    if (!p.ipath.length) {
      p.ipath = null; p.imoving = false;
      if (p.look) { bus.emit("look", p.look); p.look = null; }
      checkDoor();
    }
  }
  function checkDoor() {
    const p = P(), lay = sim.layout();
    if (lay && Math.round(p.ix) === lay.door.x && Math.round(p.iz) === lay.door.z) bus.emit("door", { room: p.room, exits: lay.def.exits });
  }

  /* ------------------------------ townsfolk ------------------------------ */
  const DK = { Su: 0, Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6 };
  function dayMatch(spec, d) {
    return spec.split(",").some(tok => {
      const [a, b] = tok.split("-");
      if (!b) return DK[a] === d;
      for (let x = DK[a], i = 0; i < 7; i++, x = (x + 1) % 7) { if (x === d) return true; if (x === DK[b]) break; }
      return false;
    });
  }
  function npcScheduled(n, m = S.minutes) {
    const d = time.dow(m), h = time.hour(m);
    for (const [days, from, to, poi] of n.sched) {
      if (dayMatch(days, d) && h >= from && h < Math.min(to, 24)) return poi;
      if (to > 24 && dayMatch(days, (d + 6) % 7) && h < to - 24) return poi;
    }
    return null;
  }
  sim.npcScheduled = npcScheduled;
  function npcGoal(n) {
    const g = npcScheduled(n);
    if (g && W.byId.has(g)) { const p = W.byId.get(g); if (sim.isOpen(p) || n.role !== "Regular") return g; }
    return null;
  }
  function seatNpc(n) {
    const p = W.byId.get(n.at), lay = p && p.interior && sim.layouts[p.interior];
    if (!lay) return;
    const staff = /Barista|Bartender|Librarian|attendant/.test(n.role) && lay.objects.find(o => o.staffAt);
    if (staff) { n.ix = staff.staffAt[0]; n.iz = staff.staffAt[1]; return; }
    const seatable = lay.objects.filter(o => o.look && o.type !== "restroom" && o.type !== "counter" && o.type !== "bar");
    const o = seatable[Math.floor(CL.hash01(n.id, S.minutes | 0) * seatable.length)] || lay.objects[0];
    const f = IN.bfs(lay, lay.door.x, lay.door.z), t = IN.approach(lay, f, o);
    if (t) { n.ix = t.x; n.iz = t.z; } else { n.ix = lay.door.x; n.iz = lay.door.z - 1; }
  }
  function stepNpc(n, dt) {
    const goal = npcGoal(n);
    if (goal !== n.goal) {
      n.goal = goal;
      const from = n.at ? W.byId.get(n.at) : { x: n.px, z: n.pz };
      if (n.at) { n.at = null; n.px = from.x; n.pz = from.z; }
      const to = goal ? W.byId.get(goal) : { x: n.hx, z: n.hz };
      n.steps = W.route(from, to);
    }
    if (n.steps) {
      let move = CL.CONFIG.npcSpeed * dt;
      while (move > 0 && n.steps.length) {
        const p = n.steps[0], dx = p.x - n.px, dz = p.z - n.pz, d = Math.hypot(dx, dz);
        if (d <= move) { n.px = p.x; n.pz = p.z; n.steps.shift(); move -= d; } else { n.px += dx / d * move; n.pz += dz / d * move; move = 0; }
      }
      if (!n.steps.length) { n.steps = null; if (n.goal) { n.at = n.goal; seatNpc(n); } }
    }
  }

  /* ------------------------------ street life ------------------------------ */
  // Ambient walkers (not saved, not clickable): each wanders between random street
  // nodes inside its strip. Numbers follow the strip's hourly curve.
  const SHIRTS = { students: ["#3d8bfd", "#e8590c", "#2a9d8f", "#f4a261", "#8338ec", "#e63946", "#ffb703", "#6a994e", "#264653", "#ff7aa2"], town: ["#577590", "#bc4749", "#6d6875", "#2b2d42", "#e9c46a", "#83c5be", "#9d0208", "#b5838d"] };
  const zoneNodes = new Map();
  function nodesIn(z) {
    if (zoneNodes.has(z.id)) return zoneNodes.get(z.id);
    const c = CL.geo.toXZ(z.lat, z.lng), out = [];
    for (let i = 0; i < W.nodes.count; i++) if (W.nodes.ok[i] && Math.hypot(W.nodes.xs[i] - c.x, W.nodes.zs[i] - c.z) < z.r) out.push(i);
    zoneNodes.set(z.id, out); return out;
  }
  sim.walkers = [];
  sim.liveliness = z => { const h = Math.floor(time.hour(S.minutes)), d = time.dow(S.minutes); return (d === 0 || d === 6 ? z.we : z.wd)[h]; };
  function stepCrowd(dt) {
    for (const z of CL.LIVELY) {
      const nodes = nodesIn(z); if (nodes.length < 2) continue;
      const want = Math.round(z.max * sim.liveliness(z)), mine = sim.walkers.filter(w => w.z === z.id);
      for (let k = Math.min(want - mine.length, 12); k > 0; k--) {
        const a = nodes[(Math.random() * nodes.length) | 0], pal = SHIRTS[z.palette];
        sim.walkers.push({ z: z.id, x: W.nodes.xs[a] + (Math.random() - .5) * 4, zz: W.nodes.zs[a] + (Math.random() - .5) * 4, route: [], at: a, speed: 2.2 + Math.random() * 1.4, color: pal[(Math.random() * pal.length) | 0], idle: 0 });
      }
      if (mine.length > want) { const w = mine.find(w => !w.route.length); if (w) w.gone = true; }
    }
    for (const w of sim.walkers) {
      if (w.idle > 0) { w.idle -= dt; continue; }
      if (!w.route.length) {
        const nodes = nodesIn(CL.LIVELY.find(z => z.id === w.z)), near = nodes.filter(n => Math.hypot(W.nodes.xs[n] - w.x, W.nodes.zs[n] - w.zz) < 90), b = (near.length > 1 ? near : nodes)[(Math.random() * (near.length > 1 ? near : nodes).length) | 0], ids = W.path(w.at, b);
        if (ids && ids.length > 14) { w.idle = 1; continue; }   // path leaves the strip: pick again
        if (ids) { w.route = ids.map(i => ({ x: W.nodes.xs[i] + (Math.random() - .5) * 3, z: W.nodes.zs[i] + (Math.random() - .5) * 3 })); w.at = b; }
        if (Math.random() < 0.35) w.idle = 1 + Math.random() * 8;   // stop for a chat / a coffee (seconds)
        continue;
      }
      let move = w.speed * dt;
      while (move > 0 && w.route.length) {
        const q = w.route[0], dx = q.x - w.x, dz = q.z - w.zz, d = Math.hypot(dx, dz);
        if (d <= move) { w.x = q.x; w.zz = q.z; w.route.shift(); move -= d; } else { w.x += dx / d * move; w.zz += dz / d * move; move = 0; }
      }
    }
    sim.walkers = sim.walkers.filter(w => !w.gone);
  }

  /* ------------------------------ small talk ------------------------------ */
  sim.nearestFolk = function (r) {
    const p = S.player; let best = null, bd = r || 14;
    if (p.at) { for (const n of S.npcs) if (n.at === p.at) return n; return null; }
    for (const n of S.npcs) { if (n.at) continue; const d = Math.hypot(n.px - p.x, n.pz - p.z); if (d < bd) { bd = d; best = n; } }
    if (!best) for (const w of sim.walkers) { const d = Math.hypot(w.x - p.x, w.zz - p.z); if (d < bd) { bd = d; best = w; } }
    return best;
  };
  // what's around a spot: the street-life strip it's in and the nearest found place
  function localLine(x, z, key) {
    const pick = a => a[Math.floor(CL.hash01(key, Math.floor(S.minutes / 20)) * a.length)];
    const strip = CL.LIVELY.find(zn => { const c = CL.geo.toXZ(zn.lat, zn.lng); return Math.hypot(c.x - x, c.z - z) < zn.r; });
    const q = W.poisNear(x, z, 70).filter(p => S.discovered.has(p.id) && p.category !== "home").sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0];
    const opts = [];
    if (strip && CL.LOCAL_LINES[strip.id]) opts.push(pick(CL.LOCAL_LINES[strip.id]));
    if (q && CL.PLACE_LINES[q.category]) opts.push(q.name + "? " + pick(CL.PLACE_LINES[q.category]));
    if (q && q.localTip && CL.hash01(key + "t", S.minutes | 0) < .4) opts.push("Tip about " + q.name + ": " + q.localTip);
    return opts.length ? opts[Math.floor(CL.hash01(key + "o", Math.floor(S.minutes / 10)) * opts.length)] : null;
  }
  sim.localLine = localLine;
  sim.talkTo = function (n) {
    if (!n) return null;
    if (n.zz != null) {   // a passer-by from the street crowd
      const zn = CL.LIVELY.find(z => z.id === n.z), pal = zn ? zn.palette : "town", names = CL.PASSERBY[pal];
      if (!n.name) { n.name = names[Math.floor(Math.random() * names.length)]; n.role = pal === "students" ? "Student" : "Local"; n.id = "w:" + n.name + Math.random().toString(36).slice(2, 5); }
      n.idle = Math.max(n.idle || 0, 6);   // they stop for a chat
      const text = localLine(n.x, n.zz, n.id) || "Lovely day for it.";
      bus.emit("talk", { npc: n, text });
      return text;
    }
    const L = CL.NPC_LINES, pick = (a, k) => a[Math.floor(CL.hash01(n.id + k, Math.floor(S.minutes / 30)) * a.length)];
    const g = n.goal && W.byId.get(n.goal), here = n.at && W.byId.get(n.at);
    const tipOf = q => q && q.localTip ? q.localTip : "";
    let line;
    const roleLines = L.role[n.role];
    if (here) line = CL.hash01(n.id, S.minutes | 0) < .5 && roleLines ? pick(roleLines, "r") : pick(L.at, "a").replace("{here}", here.name).replace("{tip}", tipOf(here));
    else if (g) line = pick(L.going, "g").replace("{goal}", g.name).replace("{tip}", tipOf(g));
    else line = pick(L.home, "h");
    const met = !S.met[n.id]; S.met[n.id] = (S.met[n.id] || 0) + 1;
    if (g && !S.discovered.has(g.id)) { discover(g); line += ` (${g.name} added to your map.)`; }
    if (met) feed(`Met ${n.name} (${n.role})`, "visit");
    const here2 = !n.at && localLine(n.px, n.pz, n.id);
    if (here2 && CL.hash01(n.id + "l", Math.floor(S.minutes / 15)) < .5) line = here2;
    const text = (met ? pick(L.greet, "x") + " I'm " + n.name + ". " : "") + line.trim();
    bus.emit("talk", { npc: n, text });
    return text;
  };

  /* ------------------------------ discovery ------------------------------ */
  function discover(p, quiet) {
    if (S.discovered.has(p.id)) return;
    S.discovered.add(p.id);
    bus.emit("discover", p);
    if (!quiet) feed(`Discovered ${p.name} (${CL.CATEGORIES[p.category].label}, ${CL.ZONES[p.zone].label})`, "discover", p.id);
  }
  function discoverAround(x, z, quiet) { for (const p of W.poisNear(x, z, CL.CONFIG.discoverRadius)) discover(p, quiet); }
  sim.discoveredByZone = function () {
    const out = {};
    for (const k of Object.keys(CL.ZONES)) out[k] = { found: 0, visited: 0, total: 0 };
    for (const p of W.pois) { if (p.category === "home") continue; const z = out[p.zone]; z.total++; if (S.discovered.has(p.id)) z.found++; if (S.visits[p.id]) z.visited++; }
    return out;
  };
  sim.toggleFav = pid => { if (S.favs.has(pid)) S.favs.delete(pid); else S.favs.add(pid); return S.favs.has(pid); };

  /* ------------------------------ events + clock ------------------------------ */
  function scheduleEvents() {
    const now = S.minutes, today = time.dayNo(now);
    for (const d of [today, today + 1]) {
      const base = (d - 1) * 1440, dow = time.dow(base);
      for (const e of CL.EVENTS) {
        const key = e.id + ":" + d;
        if (S.announced[key]) continue;
        let on = e.days.includes(dow);
        if (!on && e.chanceOtherNights) on = CL.hash01(key, 7) < e.chanceOtherNights;
        if (!on) continue;
        const start = base + e.start * 60, end = base + e.end * 60;
        if (start - now > CL.EVENT_LEAD_HOURS * 60 || end <= now) continue;
        S.announced[key] = true;
        if (!W.byId.has(e.poi)) continue;
        const inst = { key, tag: e.tag, poi: e.poi, start, end, title: e.title, emoji: e.emoji };
        S.events.push(inst);
        feed(`${e.emoji} ${e.title} (${time.fmt(start)}-${time.fmt(end)})`, "event", e.poi);
        bus.emit("pulse", inst);
      }
    }
    S.events = S.events.filter(e => e.end > now);
  }
  let lastHourTick = -1;
  // game-time step (clock, events, townsfolk)
  sim.tick = function (gameDt) {
    while (gameDt > 0) {
      const step = Math.min(0.5, gameDt); gameDt -= step;
      S.minutes += step;
      const h = Math.floor(S.minutes / 60);
      if (h !== lastHourTick) { lastHourTick = h; scheduleEvents(); }
      for (const n of S.npcs) stepNpc(n, step);
    }
  };
  // real-time step for the player (movement is independent of clock speed)
  // street life runs on real seconds (speeds in m/s, a bit brisk to read at map scale); density follows the clock
  sim.stepLife = function (dt) { if (W.nodes) stepCrowd(dt); };
  sim.stepPlayer = function (dt, run) { if (P().at) stepInside(dt); else stepRoute(dt, run); };

  /* ------------------------------ save / load (ids only) ------------------------------ */
  sim.serialize = function () {
    const p = S.player;
    return { v: 2, minutes: S.minutes, discovered: [...S.discovered], visits: S.visits, done: S.done, met: S.met, lastVisit: S.lastVisit, favs: [...S.favs], announced: S.announced,
      events: S.events, feed: S.feed.slice(-40), player: { x: p.x, z: p.z, at: p.at, room: p.room, ix: Math.round(p.ix), iz: Math.round(p.iz) } };
  };
  function validSave(d) {
    const record = v => v && typeof v === "object" && !Array.isArray(v);
    if (!record(d) || d.v !== 2 || !Number.isFinite(d.minutes) || d.minutes < 0) return false;
    if (!["discovered", "favs"].every(k => Array.isArray(d[k]) && d[k].every(id => typeof id === "string"))) return false;
    if (!["visits", "done", "met", "lastVisit", "announced"].every(k => record(d[k]))) return false;
    if (!Array.isArray(d.events) || !d.events.every(e => record(e) && Number.isFinite(e.start) && Number.isFinite(e.end) && typeof e.poi === "string")) return false;
    if (!Array.isArray(d.feed) || !d.feed.every(f => record(f) && typeof f.text === "string")) return false;
    const p = d.player;
    if (!record(p) || !Number.isFinite(p.x) || !Number.isFinite(p.z)) return false;
    if (p.at && (!Number.isFinite(p.ix) || !Number.isFinite(p.iz))) return false;
    return true;
  }
  function restore(d) {
    Object.assign(S, { minutes: d.minutes, visits: d.visits || {}, done: d.done || {}, met: d.met || {}, lastVisit: d.lastVisit || {}, announced: d.announced || {}, events: d.events || [], feed: d.feed || [] });
    S.discovered = new Set((d.discovered || []).filter(id => W.byId.has(id)));
    S.favs = new Set(d.favs || []);
    if (d.player) {
      Object.assign(S.player, { x: d.player.x, z: d.player.z, at: null, room: null });
      if (d.player.at && W.byId.has(d.player.at) && sim.layouts[d.player.room]) Object.assign(S.player, { at: d.player.at, room: d.player.room, ix: d.player.ix, iz: d.player.iz });
    }
  }
})(window.CL = window.CL || {});
