/* City Life - inside view for enterable places: isometric three.js room with
   wall cutaway and rotation. The player walks around (click the floor or use
   the keys), clicks things to look at them, and leaves by the door (or takes
   the lift, at home). Townsfolk who are here right now stand at their spots. */
(function (CL) {
  const IV = CL.interiorView = { open: false, poi: null, yaw: Math.PI / 4 };
  let renderer, scene, camera, host, labels, built = null, cam = { yaw: Math.PI / 4, goal: Math.PI / 4, zoom: 1 }, wallMode = "cut";
  const figs = new Map();

  IV.init = function (el) {
    host = el;
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    host.querySelector(".iv-canvas").appendChild(renderer.domElement);
    labels = host.querySelector(".iv-labels");
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
    renderer.domElement.addEventListener("pointerup", onTap);
    renderer.domElement.addEventListener("wheel", e => { e.preventDefault(); cam.zoom = CL.clamp(cam.zoom * (e.deltaY < 0 ? 1.1 : 0.9), 0.6, 2.6); }, { passive: false });
    host.querySelector(".iv-rot").onclick = () => rotate(1);
    host.querySelector(".iv-walls").onclick = () => { wallMode = { cut: "up", up: "down", down: "cut" }[wallMode]; host.querySelector(".iv-walls").textContent = "🧱 Walls: " + wallMode; built && buildWalls(); };
    host.querySelector(".iv-exits").addEventListener("click", e => { const b = e.target.closest("[data-exit]"); if (b) IV.exit(b.dataset.exit); });
    CL.bus.on("enter", ({ poi }) => IV.show(poi));
    CL.bus.on("leave", () => IV.close(true));
    CL.bus.on("look", o => IV.caption(o.look));
    CL.bus.on("door", d => { if (d.exits.length === 1) IV.exit(d.exits[0]); else IV.caption("The lift and the front door are here - use the buttons up top.", false); });
  };
  function rotate(dir) { cam.goal += dir * Math.PI / 2; }
  IV.rotate = rotate;
  const exitLabel = x => ({ street: "🚪 Out to the street", roof: "🛗 Rooftop", home: "🛗 Back down to 212" }[x] || x);
  IV.exit = function (x) {
    if (x === "street") { CL.sim.leave(); return; }
    CL.sim.enter(CL.sim.player().at, x);
  };

  IV.show = function (poi) {
    IV.open = true; IV.poi = poi;
    host.classList.add("show");
    const lay = CL.sim.layout();
    host.querySelector(".iv-title").textContent = lay.def.generic ? poi.name : lay.def.name;
    host.querySelector(".iv-exits").innerHTML = lay.def.exits.map(x => `<button data-exit="${x}">${exitLabel(x)}</button>`).join("");
    if (IV.lastKey !== lay.key) { cam.yaw = cam.goal = lay.def.yaw ?? Math.PI / 4; IV.lastKey = lay.key; }
    build(lay);
    IV.caption(lay.def.generic ? (poi.description || "") : lay.key === "home" ? "Unit 212 is one long loft: bath/laundry and the raised bed by the door, then the kitchen, dining, living room and balcony. Click anything to look at it." : lay.key === "roof" ? "The Rhodes House rooftop: lap pool, spa, sauna, gym, tennis court and BBQs." : "");
    IV.resize();
  };
  IV.close = function (fromLeave) { IV.open = false; host.classList.remove("show"); if (!fromLeave && CL.sim.player().at) CL.sim.leave(); };
  IV.resize = function () { if (!host) return; const r = host.querySelector(".iv-canvas").getBoundingClientRect(); renderer.setSize(r.width, r.height); };
  let capT;
  IV.caption = function (txt, keep) {
    const el = host.querySelector(".iv-cap"); clearTimeout(capT);
    el.textContent = txt || ""; el.style.display = txt ? "block" : "none";
    if (txt && !keep) capT = setTimeout(() => { el.style.display = "none"; }, 7000);
  };

  const matC = new Map();
  const mat = c => { if (!matC.has(c)) matC.set(c, new THREE.MeshLambertMaterial({ color: c })); return matC.get(c); };
  const glassMat = new THREE.MeshLambertMaterial({ color: "#bfe3f2", transparent: true, opacity: .35 });
  function part(g, w, h, d, c, x = 0, y = 0, z = 0, m) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m || mat(c));
    mesh.position.set(x, y + h / 2, z); mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh); return mesh;
  }
  // builders take the object's footprint (w x d tiles), local origin at footprint centre
  const B = {
    fridge: (g) => { part(g, .8, 1.7, .7, "#eef2f5"); part(g, .05, .5, .05, "#888", .3, 1.0, .36); },
    counter: (g, o) => { part(g, o.w, .95, o.d * .85, "#8a6446"); part(g, o.w, .06, o.d * .9, "#e9dfcf", 0, .95); if (o.w > 3) { part(g, .5, .45, .4, "#b8bcc2", -o.w / 2 + 1.2, 1.0); part(g, .35, .3, .35, "#d9a066", 1, 1.0); } },
    bar: (g, o) => { part(g, o.w, 1.05, o.d * .8, "#5b3a24"); part(g, o.w, .07, o.d * .9, "#3b2618", 0, 1.05); for (let i = 0; i < o.w; i += 1.5) part(g, .12, .45, .12, ["#e0a030", "#7a2e1d", "#ddd"][i % 3 | 0], -o.w / 2 + .5 + i, 1.1, 0); },
    table: (g, o) => { part(g, o.w * .9, .06, o.d * .9, "#a07850", 0, .72); part(g, .1, .72, .1, "#6b4f3a"); const n = Math.max(2, o.w * 2); for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; part(g, .35, .45, .35, "#3d5a80", Math.cos(a) * (o.w * .5 + .25), 0, Math.sin(a) * (o.d * .5 + .25)); } },
    sofa: (g, o) => { part(g, o.w * .95, .42, .85, "#c0724a"); part(g, o.w * .95, .5, .22, "#a65d39", 0, .42, -.32); },
    tv: (g, o) => { part(g, o.w * .9, .45, .45, "#5b4636"); g.userData.screen = part(g, o.w * .8, .6, .06, "#111", 0, .5, -.1, new THREE.MeshLambertMaterial({ color: "#111", emissive: "#000" })); },
    desk: (g, o) => { part(g, o.w * .9, .74, o.d * .9, "#a0785a"); g.userData.screen = part(g, .55, .38, .06, "#1e2a38", 0, .74, 0, new THREE.MeshLambertMaterial({ color: "#1e2a38", emissive: "#000" })); },
    easel: (g) => { part(g, .08, 1.5, .08, "#8b5e3c", 0, 0, .1); part(g, .7, .55, .05, "#fdfdfd", 0, .8, 0); part(g, .5, .35, .06, "#f4a261", 0, .88, .01); },
    mirror: (g) => { part(g, .7, 1.7, .08, "#cfd8dc"); part(g, .6, 1.5, .02, "#e8f6ff", 0, .1, .05); },
    bed: (g, o) => { part(g, o.w * .95, .38, o.d * .95, "#6b4f3a"); part(g, o.w * .9, .16, o.d * .9, "#7aa6d6", 0, .38); part(g, o.w * .8, .12, .3, "#fff", 0, .54, -o.d / 2 + .3); },
    wardrobe: (g, o) => part(g, o.w * .9, 2.1, o.d * .9, "#b89a78"),
    shower: (g) => { part(g, .9, .08, .9, "#e0e0e0"); part(g, .9, 2, .9, 0, 0, 0, 0, new THREE.MeshLambertMaterial({ color: "#bfe3f2", transparent: true, opacity: .35 })); },
    toilet: (g) => { part(g, .45, .45, .55, "#f4f4f4"); part(g, .45, .5, .18, "#f4f4f4", 0, .2, -.25); },
    vanity: (g, o) => { part(g, o.w * .9, .85, .5, "#ddd"); part(g, o.w * .7, .7, .04, "#e8f6ff", 0, 1.1, -.24); },
    pool: (g, o) => { part(g, o.w, .12, o.d, "#e9e5dc"); part(g, o.w - .4, .14, o.d - .4, "#4fb3d9", 0, 0, 0, new THREE.MeshLambertMaterial({ color: "#4fb3d9", emissive: "#0b3d52" })); },
    gym: (g, o) => { part(g, .6, .15, 1.6, "#333", -.6); part(g, .6, .9, .08, "#555f6b", -.6, .15, -.8); part(g, 1.2, .1, .1, "#999", .8, .9); part(g, .12, .9, .12, "#555", .8); },
    bbq: (g, o) => { part(g, o.w * .9, .9, .6, "#4a4a4a"); part(g, o.w * .8, .05, .5, "#bbb", 0, .9); },
    sauna: (g, o) => { part(g, o.w, 2.1, o.d, "#c28f5c"); part(g, .6, 1.8, .05, "#8a6446", 0, 0, o.d / 2); },
    lounger: (g, o) => part(g, o.w * .9, .3, .6, "#f2f2f2"),
    bookshelf: (g, o) => { part(g, o.w * .9, 1.9, o.d * .9, "#8b5e3c"); [.35, .8, 1.25, 1.6].forEach((y, i) => part(g, o.w * .8, .3, o.d * .7, ["#c0392b", "#2980b9", "#27ae60", "#d4a017"][i], 0, y, .05)); },
    shelf: (g, o) => { part(g, o.w, 2.0, o.d * .7, "#7a5536"); for (let i = 0; i < 4; i++) part(g, o.w * .95, .3, o.d * .5, ["#6d597a", "#b56576", "#355070", "#e56b6f"][i], 0, .3 + i * .45, .12); },
    plant: (g) => { part(g, .4, .45, .4, "#b5651d"); const m = new THREE.Mesh(new THREE.SphereGeometry(.45, 10, 8), mat("#4f8a3a")); m.position.y = .85; m.castShadow = true; g.add(m); },
    restroom: (g) => { part(g, .9, 2.1, .9, "#d8dee3"); part(g, .5, .5, .05, "#4a90d9", 0, 1.3, .46); },
    dancefloor: (g, o) => { g.userData.tiles = []; for (let i = 0; i < o.w; i++) for (let j = 0; j < o.d; j++) g.userData.tiles.push(part(g, .96, .03, .96, "#333", -o.w / 2 + .5 + i, 0, -o.d / 2 + .5 + j, new THREE.MeshLambertMaterial({ color: "#222", emissive: "#000" }))); },
    lectern: (g, o) => { part(g, .8, 1.1, .6, "#6b4f3a"); for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) part(g, .45, .45, .45, "#9d2b2b", -2.4 + c, 0, -1.6 - r * 1.1); },
  };
  Object.assign(B, {
    pedestal: (g, o) => { part(g, o.w * .7, .9, o.d * .7, "#f4f1ea"); part(g, o.w * .6, .6, o.d * .6, 0, 0, .9, 0, glassMat); part(g, .3, .3, .3, "#c9803f", 0, 1.0, 0); },
    painting: (g, o) => { part(g, .1, 1.6, o.d * .85, "#3b2f22", 0, .9, 0); part(g, .12, 1.3, o.d * .7, ["#e76f51", "#2a9d8f", "#e9c46a", "#8338ec"][o.z % 4], .02, 1.05, 0); },
    rack: (g, o) => { part(g, o.w * .95, .08, .08, "#555", 0, 1.5, 0); for (let i = 0; i < o.w * 2; i++) part(g, .3, .8, .5, ["#e76f51", "#264653", "#e9c46a", "#f4a261", "#2a9d8f"][i % 5], -o.w / 2 + .3 + i * .5, .7, 0); part(g, .08, 1.5, .08, "#555", -o.w / 2, 0, 0); part(g, .08, 1.5, .08, "#555", o.w / 2, 0, 0); },
    screen: (g, o) => { g.userData.screen = part(g, o.w, 3.2, .15, "#111", 0, .6, 0, new THREE.MeshLambertMaterial({ color: "#1b2a3a", emissive: "#2a4a7a" })); },
    stage: (g, o) => { part(g, o.w, .8, o.d, "#6b4a33"); part(g, o.w, 3.4, .2, "#9e2a2b", 0, .8, -o.d / 2); },
    arch: (g) => { part(g, .7, 2.8, .7, "#c9a877"); part(g, .9, .3, .9, "#b8955f", 0, 2.8); },
    hall: (g, o) => { part(g, o.w, 3.2, .4, "#c9a877", 0, 0, -.3); part(g, 1.4, 2.2, .1, "#5b3a24", 0, 0, -.05); },
    tree: (g, o) => { part(g, .35, 2.2, .35, "#6b4a2f"); const bloom = CL.time && ((d => d >= 0)(1)); const m = new THREE.Mesh(new THREE.SphereGeometry(o.w * .62, 14, 10), mat("#8e6bd8")); m.scale.y = .6; m.position.y = 2.6; m.castShadow = true; g.add(m); const m2 = m.clone(); m2.material = mat("#7a5cc4"); m2.scale.set(.7, .45, .7); m2.position.set(.6, 3.1, -.4); g.add(m2); },
    bench: (g, o) => { part(g, o.w * .9, .08, o.d * .5, "#8b5e3c", 0, .42); part(g, .08, .42, .08, "#333", -o.w * .35); part(g, .08, .42, .08, "#333", o.w * .35 * (o.w > 1 ? 1 : 0)); },
    board: (g) => { part(g, .1, 1.8, .1, "#5b3a24"); part(g, .9, .7, .06, "#f1e3c3", 0, 1.1); [["#e63946", -.2, 1.5], ["#3d8bfd", .2, 1.35], ["#ffb703", 0, 1.2]].forEach(([c, x, y]) => part(g, .25, .3, .02, c, x, y, .04)); },
    gargoyle: (g) => { part(g, .5, 1.1, .5, "#b8955f"); part(g, .4, .35, .5, "#9c7b4f", 0, 1.1, .1); },
    washer: (g) => { part(g, .6, .85, .6, "#f2f2f2"); const m = new THREE.Mesh(new THREE.CylinderGeometry(.18, .18, .03, 20), mat("#9fb4c2")); m.rotation.x = Math.PI / 2; m.position.set(0, .45, .31); g.add(m); },
    bedplatform: (g, o) => { part(g, o.w, 1.3, o.d, "#e9e4da"); part(g, .7, 1.1, .05, "#b89a78", -o.w / 2 + .6, 0, o.d / 2); part(g, o.w * .7, .25, o.d * .6, "#6b4f3a", -.2, 1.3, .1); part(g, o.w * .66, .14, o.d * .56, "#dfe7ef", -.2, 1.55, .1); part(g, .6, .12, .3, "#fff", -.2, 1.69, -o.d * .2); part(g, .7, .75, .45, "#a0785a", o.w / 2 - .5, 1.3, -o.d / 2 + .35); },
    stairs: (g) => { for (let i = 0; i < 4; i++) part(g, .8, .32 * (i + 1), .25, "#b08a5e", 0, 0, .35 - i * .25); },
    pillar: (g) => part(g, .55, 3.2, .5, "#e6e0d4", 0, 0, -.3),
    pantry: (g) => { part(g, .9, 2.2, .6, "#f4f4f4"); part(g, .03, .3, .03, "#999", .3, 1.0, .31); },
    kbench: (g, o) => { part(g, o.w, .9, .65, "#f4f4f4", 0, 0, .1); part(g, o.w, .05, .68, "#3c3f44", 0, .9, .1); part(g, .6, .02, .5, "#222", -.8, .95, .1); part(g, .45, .04, .35, "#c9ced3", .8, .95, .1); part(g, o.w, .6, .05, "#fff", 0, .95, .42); },
    peninsula: (g, o) => { part(g, .75, 1.0, o.d, "#f7f7f7"); part(g, .85, .05, o.d + .1, "#3c3f44", 0, 1.0); },
    stool: (g) => { part(g, .05, .65, .05, "#222", -.12); part(g, .05, .65, .05, "#222", .12); part(g, .36, .05, .3, "#c8a36e", 0, .65); },
    sideboard: (g, o) => part(g, o.w * .9, .8, .45, "#2b2724"),
    tvunit: (g, o) => { part(g, o.w * .9, .45, .4, "#f1f1f1", 0, 0, .15); g.userData.screen = part(g, o.w * .7, .7, .05, "#111", 0, 1.0, .35, new THREE.MeshLambertMaterial({ color: "#111", emissive: "#000" })); },
    ctable: (g) => part(g, .7, .38, .5, "#2e3033"),
    chair: (g) => { part(g, .45, .45, .45, "#d8d2c4"); part(g, .45, .45, .08, "#c9c1b0", 0, .45, -.2); },
    planter: (g) => { part(g, .8, .5, .5, "#8d6e63"); const m = new THREE.Mesh(new THREE.SphereGeometry(.35, 10, 8), mat("#5d9b4a")); m.position.y = .75; g.add(m); },
    spa: (g, o) => { part(g, o.w, .5, o.d, "#e9e5dc"); part(g, o.w - .3, .06, o.d - .3, "#6fd0e8", 0, .45, 0, new THREE.MeshLambertMaterial({ color: "#6fd0e8", emissive: "#12495a" })); },
    net: (g, o) => { part(g, .06, 1.0, o.d, "#eee"); part(g, .02, .9, o.d, 0, 0, 0, 0, new THREE.MeshLambertMaterial({ color: "#333", transparent: true, opacity: .35 })); },
    picnic: (g, o) => { part(g, o.w * .9, .06, .7, "#8b5e3c", 0, .72); part(g, o.w * .9, .06, .25, "#8b5e3c", 0, .42, .5); part(g, o.w * .9, .06, .25, "#8b5e3c", 0, .42, -.5); part(g, .1, .72, .1, "#6b4f3a"); },
  });

  function build(lay) {
    scene = new THREE.Scene();
    scene.background = new THREE.Color("#2a3140");
    const W = lay.w, H = lay.h;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x5a5a6a, 0.8));
    const sun = new THREE.DirectionalLight(0xfff1dc, 0.65); sun.position.set(W * .2, 30, H * 1.3); sun.target.position.set(W / 2, 0, H / 2);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 90 });
    scene.add(sun, sun.target);
    const tileGeo = new THREE.BoxGeometry(1, .06, 1); tileGeo.translate(0, -.03, 0);
    const floors = new THREE.InstancedMesh(tileGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), W * H); floors.receiveShadow = true;
    const d = new THREE.Object3D(), c = new THREE.Color(); let i = 0;
    for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
      const ch = lay.def.grid[z][x]; if (CL.interiors.solid(ch)) continue;
      d.position.set(x, 0, z); d.updateMatrix(); floors.setMatrixAt(i, d.matrix);
      c.set(lay.def.floors[ch] || "#ccc"); if ((x + z) % 2) c.offsetHSL(0, 0, -0.03); floors.setColorAt(i++, c);
    }
    floors.count = i; scene.add(floors);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(W, H).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ visible: false }));
    ground.position.set(W / 2 - .5, 0, H / 2 - .5); scene.add(ground);
    const wallGeo = new THREE.BoxGeometry(1, 1, 1); wallGeo.translate(0, .5, 0);
    const walls = new THREE.InstancedMesh(wallGeo, new THREE.MeshLambertMaterial({ color: "#f3efe8" }), W * H); walls.castShadow = true; walls.receiveShadow = true;
    const glass = new THREE.InstancedMesh(wallGeo, glassMat, W * H);
    scene.add(walls, glass);
    const objs = new Map();
    for (const o of lay.objects) {
      const g = new THREE.Group(); (B[o.type] || B.table)(g, o);
      g.position.set(o.x + o.w / 2 - .5, 0, o.z + o.d / 2 - .5); g.userData.obj = o;
      scene.add(g); objs.set(o.id, g);
    }
    const door = part(scene, .9, .04, .9, "#ffb000", lay.door.x, 0, lay.door.z, new THREE.MeshBasicMaterial({ color: "#ffb000" }));
    figs.clear(); labels.innerHTML = "";
    const rooms = (lay.def.rooms || []).map(([label, x, z]) => { const el = document.createElement("div"); el.className = "iv-room"; el.textContent = label; labels.appendChild(el); return { el, x, z }; });
    built = { lay, walls, glass, objs, ground, door, rooms, spots: null };
    buildWalls();
  }
  function buildWalls() {
    const { lay, walls, glass } = built, dx = Math.sin(cam.goal), dz = Math.cos(cam.goal);
    const sx = Math.abs(dx) > .3 ? Math.sign(dx) : 0, sz = Math.abs(dz) > .3 ? Math.sign(dz) : 0;
    const floorAt = (i, k) => i >= 0 && k >= 0 && i < lay.w && k < lay.h && !CL.interiors.solid(lay.def.grid[k][i]);
    const d = new THREE.Object3D(); let i = 0, j = 0;
    for (let z = 0; z < lay.h; z++) for (let x = 0; x < lay.w; x++) {
      const ch = lay.def.grid[z][x]; if (!CL.interiors.solid(ch)) continue;
      let edge = false; for (let k = -1; k <= 1 && !edge; k++) for (let i = -1; i <= 1; i++) if (floorAt(x + i, z + k)) { edge = true; break; }
      if (!edge) continue;   // solid fill outside the room's outline
      // cut a wall when there's floor right behind it (seen from the camera), like a dollhouse
      const front = (sx && floorAt(x - sx, z)) || (sz && floorAt(x, z - sz)) || (sx && sz && floorAt(x - sx, z - sz));
      const h = wallMode === "down" ? .25 : wallMode === "up" ? 2.6 : front ? .25 : 2.6;
      d.position.set(x, 0, z); d.scale.set(1, h, 1); d.updateMatrix();
      if (ch === "G") glass.setMatrixAt(j++, d.matrix); else walls.setMatrixAt(i++, d.matrix);
    }
    walls.count = i; walls.instanceMatrix.needsUpdate = true; glass.count = j; glass.instanceMatrix.needsUpdate = true;
  }

  function fig(who) {
    let g = figs.get(who.id);
    if (g) return g;
    g = new THREE.Group();
    part(g, .28, .42, .18, "#2d3142");
    part(g, .38, .45, .24, who.shirt || "#888", 0, .42);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.17, 14, 10), mat(who.skin || "#e0ac69")); head.position.y = 1.04; head.castShadow = true; g.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(.18, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(who.hair || "#333")); hair.position.y = 1.07; g.add(hair);
    scene.add(g); figs.set(who.id, g);
    const el = document.createElement("div"); el.className = "iv-label"; labels.appendChild(el); g.userData.label = el;
    return g;
  }
  // stable seats for strangers: free tiles next to things, then open floor, shuffled per room
  const SHIRT = ["#3d8bfd", "#e8590c", "#2a9d8f", "#f4a261", "#8338ec", "#e63946", "#ffb703", "#6a994e", "#264653", "#ff7aa2", "#577590", "#9d0208"];
  const SKIN = ["#f1c27d", "#e0ac69", "#c68642", "#8d5524", "#ffdbac", "#a0673c"], HAIR = ["#111", "#3b2a1a", "#8b5a2b", "#d4a017", "#555", "#b5651d"];
  function crowdSpots(lay) {
    const f = CL.interiors.bfs(lay, lay.def.start.x, lay.def.start.z), spots = [], used = new Set([lay.door.x + "," + lay.door.z, lay.def.start.x + "," + lay.def.start.z]);
    const ok = (x, z) => CL.interiors.walkable(lay, x, z) && f.dist[z * lay.w + x] > 1 && !used.has(x + "," + z);
    for (const o of lay.objects) for (let j = o.z - 1; j <= o.z + o.d; j++) for (let k = o.x - 1; k <= o.x + o.w; k++) if (ok(k, j)) { used.add(k + "," + j); spots.push({ x: k, z: j, face: Math.atan2(o.x + o.w / 2 - .5 - k, o.z + o.d / 2 - .5 - j) }); }
    for (let z = 0; z < lay.h; z++) for (let x = 0; x < lay.w; x++) if (ok(x, z) && CL.hash01(lay.key + x, z) < .18) { used.add(x + "," + z); spots.push({ x, z, face: CL.hash01(lay.key, x * 31 + z) * 6.28, chat: true }); }
    spots.sort((a, b) => CL.hash01(lay.key + a.x, a.z) - CL.hash01(lay.key + b.x, b.z));
    return spots.map((s, i) => Object.assign(s, { who: { id: "crowd" + i, shirt: SHIRT[i % SHIRT.length], skin: SKIN[(i * 7) % SKIN.length], hair: HAIR[(i * 5) % HAIR.length] } }));
  }
  const ME = { id: "me", name: "You", shirt: "#ff7a00", skin: "#e0ac69", hair: "#2b1b10" };

  IV.frame = function (t) {
    if (!IV.open || !built) return;
    const S = CL.sim.state(), me = CL.sim.player(), lay = built.lay;
    if (me.room && me.room !== lay.key) { IV.show(IV.poi); return; }
    cam.yaw += (cam.goal - cam.yaw) * 0.15; IV.yaw = cam.yaw;
    if (Math.abs(cam.goal - cam.yaw) > 0.01) buildWalls();
    const r = renderer.domElement.getBoundingClientRect(), a = r.width / Math.max(1, r.height);
    const tx = lay.w / 2 - .5, tz = lay.h / 2 - .5, R = 60, pitch = .85;
    camera.position.set(tx + R * Math.cos(pitch) * Math.sin(cam.yaw), R * Math.sin(pitch), tz + R * Math.cos(pitch) * Math.cos(cam.yaw));
    camera.lookAt(tx, 0, tz); camera.updateMatrixWorld();
    // fit: the room's corners (floor and wall tops) in view space, plus room for the top bar and caption
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [cx, cy, cz] of [[-.5, 0, -.5], [lay.w - .5, 0, -.5], [-.5, 0, lay.h - .5], [lay.w - .5, 0, lay.h - .5], [-.5, 2.6, -.5], [lay.w - .5, 2.6, -.5], [-.5, 2.6, lay.h - .5], [lay.w - .5, 2.6, lay.h - .5]]) {
      const v = new THREE.Vector3(cx, cy, cz).applyMatrix4(camera.matrixWorldInverse);
      x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
    }
    const size = Math.max((y1 - y0) * 1.28, (x1 - x0) * 1.06 / a) / cam.zoom, oy = (y0 + y1) / 2 + size * .02;
    Object.assign(camera, { left: (x0 + x1) / 2 - size * a / 2, right: (x0 + x1) / 2 + size * a / 2, top: oy + size / 2, bottom: oy - size / 2 }); camera.updateProjectionMatrix();
    const place = (g, x, y, z) => { g.position.set(x, y, z); const v = new THREE.Vector3(x, y + 1.7, z).project(camera); return [(v.x * .5 + .5) * r.width, (-v.y * .5 + .5) * r.height]; };
    const label = (g, xy, html, cls) => { const el = g.userData.label; el.style.display = "block"; el.style.left = xy[0] + "px"; el.style.top = xy[1] + "px"; if (el._h !== html) { el._h = html; el.innerHTML = html; } el.className = "iv-label " + (cls || ""); };
    // you
    const g = fig(ME); g.visible = true;
    const walking = me.ipath || me.imoving;
    const xy = place(g, me.ix, walking ? Math.abs(Math.sin(t * 12)) * .05 : 0, me.iz);
    g.rotation.y = me.iheading || 0;
    label(g, xy, "<small class='hh'>You</small>", "me");
    me.imoving = false;
    // townsfolk here right now (on the venue's main floor)
    const present = new Set(["me"]);
    if (lay.key === IV.poi.interior) for (const n of CL.sim.npcsAt(IV.poi.id)) {
      present.add(n.id);
      const f = fig(n); f.visible = true; f.rotation.y = Math.PI;
      label(f, place(f, n.ix ?? lay.door.x, 0, n.iz ?? lay.door.z - 1), `<small class="npc">${n.name} · ${n.role}</small>`);
    }
    // everyone else: strangers filling the room as it gets busy
    const busy = lay.key === IV.poi.interior && IV.poi.category !== "home" ? CL.sim.busy(IV.poi) : 0, nCrowd = Math.round((lay.def.crowdMax || 0) * busy);
    if (!built.spots) built.spots = crowdSpots(lay);
    for (let k = 0; k < built.spots.length; k++) {
      const s = built.spots[k], f = fig(s.who); f.visible = k < nCrowd;
      if (k < nCrowd) { present.add(s.who.id); f.position.set(s.x, s.chat ? Math.abs(Math.sin(t * 2 + k)) * .03 : 0, s.z); f.rotation.y = s.face; f.userData.label.style.display = "none"; }
    }
    for (const [id, f] of figs) if (!present.has(id)) { f.visible = false; f.userData.label.style.display = "none"; }
    for (const rm of built.rooms) { const v = new THREE.Vector3(rm.x, 0.1, rm.z).project(camera); rm.el.style.left = ((v.x * .5 + .5) * r.width) + "px"; rm.el.style.top = ((-v.y * .5 + .5) * r.height) + "px"; }
    // juice: TV on in the evening, a lit back room at night, the door glows
    const h = CL.time.hour(S.minutes);
    for (const og of built.objs.values()) {
      if (og.userData.screen) og.userData.screen.material.emissive.set(h >= 18 && h < 23 ? "#4aa3ff" : "#000");
      if (og.userData.tiles) og.userData.tiles.forEach((m, i) => m.material.emissive.setHSL(((t * .2 + i * .13) % 1), .8, CL.sim.liveEvent(IV.poi.id) || h >= 20 ? .35 : .05));
    }
    built.door.material.color.setHSL(.11, 1, .5 + Math.sin(t * 4) * .1);
    renderer.render(scene, camera);
  };

  // tap an object -> walk to it and look; tap the floor -> walk there
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function onTap(e) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects([...built.objs.values()], true);
    for (const hh of hits) {
      let g = hh.object; while (g && !g.userData.obj) g = g.parent;
      if (g && g.userData.obj.look) { CL.sim.walkToObject(g.userData.obj); return; }
    }
    const gh = ray.intersectObject(built.ground)[0];
    if (gh) { const x = Math.round(gh.point.x), z = Math.round(gh.point.z); if (!CL.sim.walkInside(x, z)) IV.caption("Can't get there."); }
  }
  // keys: screen direction (right = +dx, down = +dz) -> room direction, given the camera yaw
  IV.keyDir = function (dx, dz) {
    const y = cam.yaw, fx = -Math.sin(y), fz = -Math.cos(y), rx = Math.cos(y), rz = -Math.sin(y);
    return [dx * rx - dz * fx, dx * rz - dz * fz];
  };
})(window.CL = window.CL || {});
