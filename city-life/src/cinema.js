/* City Life - 10-second showcase for a place: the camera swoops in from the sky,
   orbits the place and settles back, while effects built from that place's own
   things play around it (clock hands and carillon notes at the Quad, spotlights
   at the Enmore, a train through Newtown station, beer bubbles at the Marly...).
   A letterboxed title card types the name, pops its "known for" chips and slides
   in the real photo when there is one. Plays on a first visit or from the card. */
(function (CL) {
  const C = CL.cinema = { on: false };
  const DUR = 10;
  let MV, scene, t0 = 0, poi = null, fx = [], sprites = [], actors = [], rafT = 0, audio = null, lastEmit = 0;
  const texCache = new Map();
  const emojiTex = e => { if (!texCache.has(e)) { const c = document.createElement("canvas"); c.width = c.height = 96; const x = c.getContext("2d"); x.font = "72px 'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(e, 48, 54); texCache.set(e, new THREE.CanvasTexture(c)); } return texCache.get(e); };

  /* ---------- themes: what each place throws into the air ----------
     fountain: [emojis, per second, upward speed, spread, gravity, size]
     orbit:    [emojis, count, radius, height, size]
     extra:    special actors (spotlights, train, clock, beam, sign flash, splats, fireworks) */
  const THEMES = {
    "camperdown-usyd-quadrangle": { title: "The Quadrangle", tag: "Sandstone, gargoyles and 170 years of lectures", fountain: [["🎓", "🎓", "📜", "🌸"], 10, 14, 10, 9, 3.2], rain: ["🌸", 16], orbit: [["🎵", "🎶", "🔔"], 10, 22, 26, 3], extra: ["clock", "confetti"], chord: [60, 64, 67, 72] },
    "usyd-clocktower-carillon": { alias: "camperdown-usyd-quadrangle" },
    "usyd-great-hall": { tag: "Graduation day under the hammerbeam roof", fountain: [["🎓", "🎓", "🎉"], 14, 16, 8, 9, 3.2], orbit: [["🎵", "🎶"], 8, 18, 18, 2.6], extra: ["confetti"], chord: [60, 64, 67, 72] },
    "camperdown-usyd-fisher": { tag: "Books, all-nighters and the copper Stack", fountain: [["📚", "📖", "📝", "💡"], 12, 12, 12, 7, 3], orbit: [["📄", "📄", "📃"], 14, 20, 20, 2.4], chord: [57, 60, 64, 69] },
    "camperdown-usyd-chau-chak": { tag: "Mummies, antiquities and a very odd sock collection", fountain: [["🏺", "🗿", "🦴", "✨"], 10, 12, 10, 7, 3.2], orbit: [["✨", "✨", "💎"], 12, 16, 16, 2], chord: [62, 65, 69, 74] },
    "camperdown-usyd-manning": { tag: "Band nights since forever", fountain: [["🎸", "🥁", "🎤", "🍻"], 14, 16, 10, 9, 3.2], extra: ["spots", "confetti"], chord: [55, 59, 62, 67] },
    "enmore-venue-enmore-theatre": { tag: "Art Deco since 1937. Tonight: sold out", fountain: [["🎸", "🎤", "🎶", "⭐"], 16, 18, 10, 9, 3.4], orbit: [["🎵", "🎶"], 10, 20, 24, 3], extra: ["spots", "confetti", "marquee"], chord: [55, 59, 62, 67] },
    "newtown-pub-marlborough": { tag: "Open till the wee hours, every night", fountain: [["🍺", "🍻", "🫧", "🎉"], 16, 13, 9, 8, 3], extra: ["signflash", "spots"], chord: [60, 63, 67, 70] },
    "newtown-transport-station": { tag: "Next train: whenever it comes", fountain: [["🎫", "🚉", "👋"], 8, 10, 8, 7, 3], extra: ["train"], chord: [60, 62, 64, 67] },
    "newtown-landmark-i-have-a-dream-mural": { tag: "Painted overnight in 1991. Still here", fountain: [["🎨", "🖌️", "✊", "🌈"], 12, 13, 10, 8, 3.2], extra: ["splats"], chord: [60, 64, 67, 71] },
    "st-stephens-newtown": { tag: "Pyrmont sandstone, a 43 m spire and old palms", fountain: [["🕊️", "🌿", "🔔"], 8, 12, 10, 5, 3], orbit: [["🦜", "🦜", "🕊️"], 7, 24, 30, 3.2], chord: [57, 60, 64, 69] },
    "glebe-landmark-town-hall": { tag: "Victorian Italianate, 1880", fountain: [["🎆", "🎇", "🏛️"], 8, 12, 10, 7, 3], extra: ["fireworks", "clock"], chord: [60, 64, 67, 72] },
    "city-landmark-one-central-park": { tag: "Vertical gardens and a sky-high heliostat", fountain: [["🌿", "🍃", "🌱", "☀️"], 14, 14, 12, 5, 3], extra: ["beam"], chord: [62, 66, 69, 74] },
    "glebe-market-glebe-markets": { tag: "Saturdays: vinyl, vintage and dumplings", fountain: [["🧺", "👗", "💿", "🥟"], 14, 13, 12, 8, 3], extra: ["confetti"], chord: [60, 64, 67, 72] },
    home: { tag: "Unit 212 · rooftop pool on top", fountain: [["🏠", "🏊", "☀️", "🌴"], 10, 12, 10, 8, 3], chord: [60, 64, 67, 72] },
    // by category
    cafe: { fountain: [["☕", "🥐", "🍰", "♨️"], 12, 11, 8, 7, 2.8], steam: true, chord: [60, 64, 67, 72] },
    restaurant: { fountain: [["🍜", "🥟", "🍕", "🌶️"], 12, 12, 9, 8, 2.8], steam: true, chord: [62, 65, 69, 74] },
    pub: { fountain: [["🍺", "🍻", "🫧", "🎯"], 14, 13, 9, 8, 3], chord: [60, 63, 67, 70] },
    bar: { fountain: [["🍸", "🍹", "✨", "🪩"], 14, 13, 9, 8, 3], extra: ["spots"], chord: [58, 62, 65, 70] },
    park: { fountain: [["🦋", "🌼", "🍃", "🐦"], 10, 9, 14, 3, 2.8], orbit: [["🦋", "🦋"], 8, 16, 8, 2.4], chord: [65, 69, 72, 77] },
    library: { fountain: [["📚", "📖", "🤓"], 10, 11, 10, 7, 3], chord: [57, 60, 64, 69] },
    bookshop: { fountain: [["📚", "📖", "✒️"], 10, 11, 10, 7, 3], chord: [57, 60, 64, 69] },
    gallery: { fountain: [["🎨", "🖼️", "🖌️"], 10, 12, 10, 7, 3], extra: ["splats"], chord: [60, 64, 67, 71] },
    museum: { fountain: [["🏺", "🦕", "✨"], 10, 12, 10, 7, 3], chord: [62, 65, 69, 74] },
    gym: { fountain: [["🏋️", "💪", "💦"], 12, 14, 8, 9, 3], chord: [60, 64, 67, 72] },
    livemusic: { fountain: [["🎸", "🎤", "🎶"], 14, 16, 10, 9, 3.2], extra: ["spots"], chord: [55, 59, 62, 67] },
    theatre: { fountain: [["🎭", "🎟️", "⭐"], 12, 14, 10, 8, 3], extra: ["spots"], chord: [60, 64, 67, 72] },
    cinema: { fountain: [["🍿", "🎬", "🎟️"], 12, 13, 9, 8, 3], extra: ["spots"], chord: [60, 64, 67, 72] },
    shop: { fountain: [["🛍️", "🏷️", "✨"], 10, 11, 9, 8, 3], chord: [62, 66, 69, 74] },
    vintageshop: { fountain: [["👗", "🧥", "💿"], 10, 11, 9, 8, 3], chord: [62, 66, 69, 74] },
    supermarket: { fountain: [["🍎", "🥖", "🧀", "🛒"], 10, 11, 9, 8, 3], chord: [60, 64, 67, 72] },
    laundromat: { fountain: [["🫧", "🧺", "👕"], 12, 9, 8, 3, 3], chord: [64, 67, 71, 76] },
    market: { fountain: [["🧺", "🍓", "🌻"], 12, 12, 10, 8, 3], extra: ["confetti"], chord: [60, 64, 67, 72] },
    campus: { fountain: [["🎓", "📚", "☕"], 10, 12, 10, 8, 3], chord: [60, 64, 67, 72] },
    landmark: { fountain: [["📸", "✨", "⭐"], 10, 12, 10, 8, 3], chord: [60, 64, 67, 72] },
  };
  const themeFor = p => { let t = THEMES[p.id]; if (t && t.alias) t = Object.assign({}, THEMES[t.alias], { alias: null }); return Object.assign({}, THEMES[p.category] || THEMES.landmark, t || {}); };

  // seconds into the showcase; C.fixedT pins it (screenshot tests on slow headless GPUs)
  C.elapsed = () => C.fixedT != null ? C.fixedT : performance.now() / 1000 - t0;
  C.init = function (mapview) { MV = mapview; scene = MV.overlay.parent; };

  /* ---------- effects ---------- */
  function sprite(e, size) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex(e), transparent: true, depthWrite: false })); s.scale.set(size, size, 1); s.renderOrder = 30; scene.add(s); return s; }
  function spawn(e, x, y, z, vx, vy, vz, g, size, life) { sprites.push({ s: sprite(e, size), x, y, z, vx, vy, vz, g, life, age: 0, spin: (Math.random() - .5) * 4, size }); }
  function addActor(a) { actors.push(a); return a; }
  const toon = c => CL.chibi.toon(c);
  function extras(th, p, top) {
    for (const k of th.extra || []) {
      if (k === "spots") for (let i = 0; i < 3; i++) {   // sweeping searchlights
        const g = new THREE.ConeGeometry(4, 60, 16, 1, true); g.translate(0, -30, 0); g.rotateX(Math.PI);
        const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: ["#fff3b0", "#b0e0ff", "#ffb0e8"][i], transparent: true, opacity: .22, depthWrite: false, side: THREE.DoubleSide })); m.position.set(p.x + (i - 1) * 8, top, p.z); m.renderOrder = 25; scene.add(m);
        addActor({ m, tick: t => { m.rotation.z = Math.sin(t * 1.3 + i * 2) * .6; m.rotation.x = Math.cos(t * 1.1 + i) * .35; } });
      }
      if (k === "clock") {   // giant clock face whose hands race through the day
        const face = new THREE.Mesh(new THREE.CircleGeometry(5, 40), new THREE.MeshBasicMaterial({ color: "#fdf6e3" })); face.position.set(p.x, top + 12, p.z); scene.add(face);
        const rim = new THREE.Mesh(new THREE.RingGeometry(5, 5.6, 40), new THREE.MeshBasicMaterial({ color: "#b8955e" })); rim.position.copy(face.position); scene.add(rim);
        const hand = (len, w, c) => { const g = new THREE.PlaneGeometry(w, len); g.translate(0, len / 2, 0); const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: c })); m.position.copy(face.position); m.position.z += .05; scene.add(m); return m; };
        const hh = hand(3, .5, "#2b2320"), mh = hand(4.3, .3, "#2b2320");
        for (let i = 0; i < 12; i++) { const d = new THREE.Mesh(new THREE.CircleGeometry(.28, 8), new THREE.MeshBasicMaterial({ color: "#2b2320" })); d.position.set(p.x + Math.sin(i / 12 * 6.28) * 4.3, top + 12 + Math.cos(i / 12 * 6.28) * 4.3, p.z + .04); scene.add(d); actors.push({ m: d, tick: () => d.quaternion.copy(MV.camera.quaternion) }); }
        addActor({ m: face, tick: t => { for (const o of [face, rim, hh, mh]) o.quaternion.copy(MV.camera.quaternion); mh.rotateZ(-t * 6); hh.rotateZ(-t * .5); }, more: [rim, hh, mh] });
      }
      if (k === "train") {   // a Sydney Trains set rolls through
        const g = new THREE.Group(), n = 4;
        for (let c = 0; c < n; c++) { const car = new THREE.Mesh(new THREE.BoxGeometry(18, 3.6, 3), toon("#f2f2ee")); car.position.set(c * 19, 1.8, 0); g.add(car); const band = new THREE.Mesh(new THREE.BoxGeometry(18.1, .7, 3.05), toon("#f4c400")); band.position.set(c * 19, 1.1, 0); g.add(band); const win = new THREE.Mesh(new THREE.BoxGeometry(16, 1, 3.08), toon("#2d3e5c")); win.position.set(c * 19, 2.7, 0); g.add(win); }
        g.position.set(p.x - 90, 0, p.z + 12); scene.add(g); addActor({ m: g, tick: t => { g.position.x = p.x - 110 + t * 24; } });
      }
      if (k === "beam") {   // the heliostat's sunbeam
        const g = new THREE.CylinderGeometry(1.5, 5, 50, 12, 1, true); const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: "#fff4b0", transparent: true, opacity: .3, depthWrite: false, side: THREE.DoubleSide })); m.position.set(p.x, top + 10, p.z + 10); m.rotation.x = .6; m.renderOrder = 25; scene.add(m);
        addActor({ m, tick: t => { m.material.opacity = .2 + Math.sin(t * 3) * .1; m.rotation.z = Math.sin(t) * .3; } });
      }
      if (k === "signflash" || k === "marquee") {   // chaser bulbs round a sign board
        const n = 22, bulbs = [];
        for (let i = 0; i < n; i++) { const a = i / n * 6.28, b = new THREE.Mesh(new THREE.SphereGeometry(.35, 8, 6), new THREE.MeshBasicMaterial({ color: "#ffe066" })); b.position.set(p.x + Math.cos(a) * 7, top + 4 + Math.sin(a) * 2.5, p.z + 3); scene.add(b); bulbs.push(b); }
        addActor({ m: bulbs[0], more: bulbs.slice(1), tick: t => bulbs.forEach((b, i) => b.material.color.set(((i + Math.floor(t * 12)) % 3) ? "#5a4a20" : "#fff3a0")) });
      }
      if (k === "splats") for (let i = 0; i < 9; i++) {   // paint splats that bloom on the ground
        const m = new THREE.Mesh(new THREE.CircleGeometry(1, 12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: ["#e63946", "#f4a261", "#2a9d8f", "#e9c46a", "#8338ec", "#3a86ff"][i % 6], transparent: true })); const a = Math.random() * 6.28, r = 6 + Math.random() * 12; m.position.set(p.x + Math.cos(a) * r, .12, p.z + Math.sin(a) * r); m.scale.setScalar(.01); scene.add(m);
        const at = .6 + i * .7; addActor({ m, tick: t => m.scale.setScalar(t < at ? .01 : Math.min(3.5, (t - at) * 9)) });
      }
      if (k === "fireworks") addActor({ m: null, tick: (t, dt) => { if (Math.random() < dt * 1.6) { const x = p.x + (Math.random() - .5) * 30, y = top + 18 + Math.random() * 10, z = p.z + (Math.random() - .5) * 20, e = ["✨", "💥", "⭐", "🎇"][Math.floor(Math.random() * 4)]; for (let i = 0; i < 14; i++) { const a = i / 14 * 6.28; spawn(e, x, y, z, Math.cos(a) * 8, Math.sin(a) * 8, (Math.random() - .5) * 6, 4, 1.8, 1.4); } } } });
      if (k === "confetti") addActor({ m: null, tick: (t, dt) => { if (t > 1.5 && t < 7) for (let i = 0; i < 8 * dt * 60 / 10; i++) spawn(["🎊", "🎉", "✨"][i % 3], p.x + (Math.random() - .5) * 20, top + 16, p.z + (Math.random() - .5) * 20, (Math.random() - .5) * 4, Math.random() * 3, (Math.random() - .5) * 4, 3, 1.6, 3); } });
    }
  }

  /* ---------- title card ---------- */
  function card(th) {
    const el = document.getElementById("cine");
    const b = poi.brand, photo = (window.CL_PHOTOS || {})[poi.id];
    const chips = (b && b.knownFor && b.knownFor.length ? b.knownFor : CL.sim.thingsAt(poi).map(t => t.label)).slice(0, 4);
    const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    el.innerHTML = `<div class="bar top"></div><div class="bar bot"></div>
      <div class="ct"><div class="cicon">${CL.CATEGORIES[poi.category].icon}</div><div><div class="cname" data-full="${esc(th.title || poi.name)}"></div><div class="csub">${esc(th.tag || (poi.description || "").split(". ")[0])}</div>
      <div class="cchips">${chips.map((c, i) => `<span style="animation-delay:${2.2 + i * .45}s">${esc(c)}</span>`).join("")}</div></div></div>
      ${photo ? `<figure class="cphoto"><img src="${esc(photo.file)}" alt=""><figcaption>${esc(photo.author)} · ${esc(photo.license)}</figcaption></figure>` : ""}
      <div class="cprog"><i></i></div><button class="cskip">Skip ▸</button>`;
    el.hidden = false; el.classList.remove("out"); void el.offsetWidth; el.classList.add("on");
    el.querySelector(".cskip").onclick = () => C.stop();
  }
  function jingle(ch) {
    try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    const f = n => 440 * Math.pow(2, (n - 69) / 12), now = audio.currentTime;
    [...ch, ch[3] + 12].forEach((n, i) => { const o = audio.createOscillator(), g = audio.createGain(); o.type = "triangle"; o.frequency.value = f(n); g.gain.setValueAtTime(.0001, now + i * .12); g.gain.exponentialRampToValueAtTime(.08, now + i * .12 + .02); g.gain.exponentialRampToValueAtTime(.0001, now + i * .12 + .5); o.connect(g).connect(audio.destination); o.start(now + i * .12); o.stop(now + i * .12 + .6); });
  }

  /* ---------- play / stop ---------- */
  C.play = function (pid) {
    const p = CL.world.byId.get(pid); if (!p || !MV || !MV.setCine) return false;
    if (C.on) C.stop(true);
    poi = p; C.on = true; t0 = performance.now() / 1000; lastEmit = 0;
    const th = themeFor(p), top = 10;
    C.theme = th;
    extras(th, p, top);
    if (th.orbit) { const [es, n, r, h, sz] = th.orbit; for (let i = 0; i < n; i++) { const s = sprite(es[i % es.length], sz); addActor({ m: s, tick: t => { const a = t * .9 + i / n * 6.28; s.position.set(p.x + Math.cos(a) * r * .5, h * .6 + Math.sin(t * 2 + i) * 2, p.z + Math.sin(a) * r * .5); s.material.opacity = Math.min(1, t, DUR - t); } }); } }
    document.body.classList.add("cine-on");
    card(th); jingle(th.chord || [60, 64, 67, 72]);
    CL.ui.follow = false;
    MV.setCine(() => { const t = C.elapsed();   // camera: swoop down from the sky, orbit, settle back to the normal view
      const k = Math.min(1, t / DUR), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const dist = t < 8 ? 300 - 230 * Math.min(1, t / 3.2) ** .8 + Math.max(0, t - 5) * 8 : 94 + (t - 8) / 2 * 56;
      const pitch = t < 3.2 ? 1.25 - .7 * (t / 3.2) : t < 8 ? .55 + (t - 3.2) * .02 : .65 + (t - 8) / 2 * .13;
      const yaw = -1.1 + e * 2.4;
      return { x: p.x, z: p.z, dist, pitch, yaw, lookY: 5 };
    });
    return true;
  };
  C.stop = function (quick) {
    if (!C.on) return;
    C.on = false; if (MV.setCine) MV.setCine(null); document.body.classList.remove("cine-on");
    for (const s of sprites) { scene.remove(s.s); s.s.material.dispose(); }
    for (const a of actors) { for (const m of [a.m, ...(a.more || [])]) if (m) scene.remove(m); }
    sprites = []; actors = [];
    const el = document.getElementById("cine"); el.classList.add("out"); setTimeout(() => { if (!C.on) el.hidden = true; }, quick ? 0 : 500);
    CL.ui.follow = true;
    if (poi && !quick) CL.ui.openPoi(poi.id);
  };
  C.frame = function (now) {
    if (!C.on) return;
    const t = C.elapsed(), dt = Math.min(.05, t - (C._last || t)); C._last = t;
    if (t >= DUR) { C.stop(); return; }
    const th = C.theme, p = poi, top = 10;
    // emitters
    if (th.fountain && t < DUR - 1.5) { const [es, rate, up, spread, g, sz] = th.fountain; lastEmit += dt * rate * (t < 2 ? .5 : 1); while (lastEmit >= 1) { lastEmit--; const a = Math.random() * 6.28; spawn(es[Math.floor(Math.random() * es.length)], p.x + Math.cos(a) * 2, top * .5, p.z + Math.sin(a) * 2, Math.cos(a) * spread * (.4 + Math.random() * .6), up * (.7 + Math.random() * .5), Math.sin(a) * spread * (.4 + Math.random() * .6), g, sz * (.8 + Math.random() * .4), 3.2); } }
    if (th.rain && Math.random() < dt * th.rain[1]) spawn(th.rain[0], p.x + (Math.random() - .5) * 60, 40, p.z + (Math.random() - .5) * 60, (Math.random() - .5) * 2, -2, (Math.random() - .5) * 2, .5, 2, 6);
    if (th.steam && Math.random() < dt * 5) spawn("♨️", p.x + (Math.random() - .5) * 4, top * .6, p.z, 0, 3, 0, -.5, 2.4, 2.5);
    // particles
    sprites = sprites.filter(s => {
      s.age += dt; if (s.age > s.life) { scene.remove(s.s); s.s.material.dispose(); return false; }
      s.vy -= s.g * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; if (s.y < .5) { s.y = .5; s.vy *= -.45; s.vx *= .7; s.vz *= .7; }
      const pop = Math.min(1, s.age * 5), fade = Math.min(1, (s.life - s.age) * 2);
      s.s.position.set(s.x, s.y, s.z); s.s.scale.setScalar(s.size * pop * (1 + Math.sin(s.age * 9) * .06)); s.s.material.rotation += s.spin * dt; s.s.material.opacity = fade;
      return true;
    });
    for (const a of actors) a.tick(t, dt);
    // title typing + progress
    const el = document.getElementById("cine"), nm = el.querySelector(".cname");
    if (nm) { const full = nm.dataset.full, n = Math.min(full.length, Math.floor(Math.max(0, t - .6) * 22)); if (nm.textContent.length !== n) nm.textContent = full.slice(0, n); }
    const bar = el.querySelector(".cprog i"); if (bar) bar.style.width = (t / DUR * 100).toFixed(1) + "%";
  };
})(window.CL = window.CL || {});
