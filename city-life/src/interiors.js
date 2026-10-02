/* City Life - enterable interiors. Tiles are 1 m. Layouts are painted from
   rectangles so the grids can't go ragged: "#" wall, "G" glazing, "D" the way
   out, any other char is a floor keyed into `floors`. Objects carry a `look`
   line the player reads when they click them. No DOM.

   Home = Unit 212, Rhodes House, 1 Missenden Rd, Camperdown - drawn from the
   agent's floor plan on the rental listing (Morton, Oct 2024, as syndicated to
   Domain): Level 2 loft, entry at the west end off the corridor; bath/laundry;
   raised bed 2.7 x 3.5 m with under-bed storage; kitchen 2.6 x 3.6 m; dining
   5 x 5 m; living 2.7 x 3.3 m narrowing toward a covered balcony 1.8 x 3.3 m
   behind glass sliders; two original warehouse columns on the corridor wall;
   grey carpet, white walls, split-system AC; basement car space. Rooftop
   (pool, spa, sauna, gym, tennis court, BBQs) per the listing text. */
(function (CL) {
  function paint(w, h, rects, cells) {
    const g = Array.from({ length: h }, () => new Array(w).fill("#"));
    for (const [c, x, z, rw, rh] of rects) for (let j = z; j < z + rh; j++) for (let i = x; i < x + rw; i++) g[j][i] = c;
    for (const [x, z, c] of cells) g[z][x] = c;
    return g;
  }
  // O(type, x, z, w, d, look, extra)
  const O = (type, x, z, w, d, look, extra) => Object.assign({ type, x, z, w, d, look: look || "" }, extra || {});

  CL.INTERIOR_DEFS = {
    home: {
      name: "Unit 212, Rhodes House", w: 23, h: 7, exits: ["street", "roof"], yaw: 0.42,
      grid: paint(23, 7, [
        ["h", 1, 1, 7, 1], ["b", 1, 3, 3, 3], ["m", 5, 2, 3, 4], ["k", 8, 1, 3, 5], ["d", 11, 1, 5, 5], ["l", 16, 1, 3, 3], ["y", 20, 1, 2, 3],
      ], [[2, 2, "b"], [19, 1, "G"], [19, 2, "y"], [19, 3, "G"], [1, 0, "D"]]),
      floors: { h: "#9a9ca1", b: "#e9ecec", m: "#9a9ca1", k: "#8f9297", d: "#9a9ca1", l: "#9a9ca1", y: "#c9b89f", D: "#6f7278" },
      rooms: [["Bath / laundry", 2, 4], ["Bed (raised)", 6, 4], ["Kitchen", 9, 3], ["Dining", 13, 3], ["Living", 17, 2], ["Balcony", 20.5, 2]],
      objects: [
        O("toilet", 1, 3, 1, 1, "Bathroom: white tiles floor to ceiling, walk-in shower, vanity with a mirror cabinet."),
        O("washer", 3, 3, 1, 1, "Internal laundry - the washer lives in the bathroom."),
        O("shower", 1, 5, 1, 1, "Walk-in shower behind a tiled half-wall."),
        O("vanity", 3, 5, 1, 1, "Vanity and mirror cabinet."),
        O("bedplatform", 5, 3, 3, 3, "The bed sits up on a platform - 2.7 x 3.5 m, with a study nook and robe. Underneath is a walk-in storage room the same size."),
        O("stairs", 7, 2, 1, 1, "A few timber steps up to the bed platform.", { walkable: true }),
        O("pillar", 5, 1, 1, 1, "One of the building's original 1920s warehouse columns.", { walkable: true }),
        O("fridge", 8, 2, 1, 1, "Stainless fridge next to the pantry."),
        O("pantry", 8, 3, 1, 1, "Pantry."),
        O("kbench", 8, 5, 3, 1, "Galley kitchen, 2.6 x 3.6 m: gas cooktop, oven, dishwasher, white tiled splashback."),
        O("peninsula", 10, 2, 1, 3, "Breakfast bar with three stools, looking out over the dining room."),
        O("stool", 11, 2, 1, 1, "", { walkable: true }), O("stool", 11, 3, 1, 1, "", { walkable: true }), O("stool", 11, 4, 1, 1, "", { walkable: true }),
        O("table", 12, 2, 2, 2, "Dining - a 5 x 5 m room, the biggest in the flat."),
        O("sideboard", 13, 5, 2, 1, "Dark timber sideboard."),
        O("pillar", 15, 1, 1, 1, "The second warehouse column, where the dining room meets the living room.", { walkable: true }),
        O("sofa", 16, 1, 3, 1, "Living room, 2.7 x 3.3 m. Split-system air con above the sofa."),
        O("ctable", 17, 2, 1, 1, "Coffee table.", { walkable: true }),
        O("tvunit", 16, 3, 2, 1, "TV unit on the side wall."),
        O("chair", 20, 1, 1, 1, "Covered balcony, 1.8 x 3.3 m - north-facing, the sunniest spot in the flat."),
        O("planter", 21, 3, 1, 1, "Balcony planter."),
      ],
      start: { x: 1, z: 1 },
    },
    roof: {
      name: "Rhodes House rooftop", w: 30, h: 16, exits: ["home", "street"],
      grid: paint(30, 16, [["r", 1, 1, 28, 14], ["t", 1, 1, 28, 1], ["t", 1, 14, 28, 1], ["t", 1, 1, 1, 14], ["t", 28, 1, 1, 14], ["c", 17, 3, 10, 9], ["g", 3, 10, 5, 4]],
        [[2, 15, "D"]]),
      floors: { r: "#b9b3a6", t: "#c0674d", c: "#5f9a6a", g: "#6c7580", D: "#6f7278" },
      rooms: [["Running track", 14, 1], ["Lap pool", 7.5, 3], ["Tennis court", 22, 7.5], ["Gym", 5.5, 12], ["BBQs", 12.5, 11]],
      objects: [
        O("pool", 3, 3, 10, 3, "Lap pool with city views. Heated? The listing doesn't say."),
        O("spa", 14, 3, 2, 2, "Spa."),
        O("sauna", 14, 6, 2, 2, "Sauna."),
        O("lounger", 4, 7, 2, 1, "Sun lounger.", { walkable: false }), O("lounger", 8, 7, 2, 1, "Sun lounger."),
        O("net", 21, 3, 1, 9, "Tennis court - bring your own racquet.", { walkable: false }),
        O("gym", 4, 11, 3, 2, "Residents' gym: treadmill, bench, a rack of dumbbells."),
        O("bbq", 10, 12, 2, 1, "Gas BBQs."), O("picnic", 13, 12, 2, 1, "Picnic tables with a view back to the city skyline."),
        O("planter", 26, 13, 1, 1, "Planter box."),
      ],
      start: { x: 2, z: 14 },
    },
    quad: {
      name: "The Quadrangle", w: 28, h: 22, exits: ["street"], yaw: Math.PI / 4, crowdMax: 36, outdoor: true,
      grid: paint(28, 22, [["s", 1, 1, 26, 20], ["c", 1, 1, 26, 3], ["c", 1, 1, 3, 20], ["g", 6, 6, 17, 11]], [[27, 11, "D"]]),
      floors: { s: "#d9c7a0", c: "#c4ad84", g: "#7fb069", D: "#a88d62" },
      rooms: [["Cloisters", 14, 2], ["Quad lawn", 14.5, 11.5], ["Clock tower gate", 25, 11]],
      objects: [
        ...[5, 8, 11, 14, 17, 20, 23].map(x => O("arch", x, 3, 1, 1, "Sandstone cloister arches - Edmund Blacket's Gothic Revival, 1850s. Cool and quiet on a hot day.")),
        ...[6, 9, 12, 15, 18].map(z => O("arch", 3, z, 1, 1, "More cloister arches, worn smooth where 170 years of students have leaned on them.")),
        O("hall", 11, 1, 6, 1, "The Great Hall doors. Graduations, concerts, and the odd exam under the hammerbeam roof."),
        O("tree", 19, 7, 3, 3, "The Quad's jacaranda. Tradition says if it's flowering and you haven't started studying for exams, you're too late."),
        O("bench", 8, 17, 2, 1, "Bench on the south path - prime lunch spot."), O("bench", 14, 17, 2, 1, "Bench facing the lawn."), O("bench", 23, 13, 1, 2, "Bench by the tower archway."),
        O("board", 25, 5, 1, 1, "Noticeboard: club flyers, lost keys, a rally at Fisher on Thursday, someone selling a bike."),
        O("gargoyle", 26, 17, 1, 1, "A grotesque peers down from the parapet. Look up - there are dozens of them."),
      ],
      start: { x: 26, z: 11 },
    },
    cafe: {
      name: "Cafe Newtown", w: 16, h: 12, exits: ["street"], crowdMax: 12,
      grid: paint(16, 12, [["c", 1, 1, 14, 10], ["s", 1, 1, 9, 1]], [[8, 11, "D"]]),
      floors: { c: "#d8c3a5", s: "#9c7b5b", D: "#6b4f3a" },
      rooms: [["Counter", 5, 1], ["Tables", 7, 6.5]],
      objects: [
        O("counter", 1, 2, 9, 1, "Counter: espresso machine going flat out, cake cabinet, handwritten specials board.", { staffAt: [5, 1] }),
        O("table", 3, 6, 1, 1, "Two-top by the window."), O("table", 7, 6, 1, 1, "Communal-ish table."), O("table", 11, 6, 1, 1, "Corner table."),
        O("bookshelf", 14, 3, 1, 2, "A shelf of swap books - take one, leave one."), O("plant", 14, 9, 1, 1, ""),
        O("restroom", 12, 9, 1, 1, "Restroom."),
      ],
      start: { x: 8, z: 10 },
    },
    pub: {
      name: "Friend in Hand Hotel", w: 18, h: 13, exits: ["street"], crowdMax: 22,
      grid: paint(18, 13, [["p", 1, 1, 16, 11], ["s", 1, 1, 10, 1], ["f", 12, 6, 5, 4]], [[8, 12, "D"]]),
      floors: { p: "#8b5e3c", s: "#5b3a24", f: "#3a3f58", D: "#4a3020" },
      rooms: [["Bar", 6, 1], ["Back room", 14.5, 8], ["Trivia tables", 5, 8]],
      objects: [
        O("bar", 1, 2, 10, 1, "The bar. Taps, a wall of oddities, and somewhere, George the cockatoo.", { staffAt: [5, 1] }),
        O("table", 3, 7, 2, 1, "Trivia table - Tuesday nights."), O("table", 7, 7, 2, 1, "Trivia table."), O("table", 5, 10, 2, 1, "Table by the fireplace."),
        O("dancefloor", 12, 6, 5, 4, "The back room: crab racing, comedy, open mic.", { walkable: true }),
        O("restroom", 15, 2, 1, 1, "Restroom."),
      ],
      start: { x: 8, z: 11 },
    },
    library: {
      name: "Fisher Library", w: 20, h: 14, exits: ["street"], crowdMax: 20,
      grid: paint(20, 14, [["f", 1, 1, 18, 12], ["a", 10, 8, 9, 5]], [[9, 13, "D"]]),
      floors: { f: "#c9c2b0", a: "#8e6e53", D: "#6b5a44" },
      rooms: [["Reading room", 4.5, 2], ["Stacks", 13.5, 2], ["Seminar room", 14.5, 10.5]],
      objects: [
        O("desk", 2, 3, 5, 1, "Long reading desks, green lamps, silence."), O("desk", 2, 6, 5, 1, "More desks. Someone's left a highlighter."),
        O("shelf", 10, 2, 8, 1, "Stacks: call numbers run on and on."), O("shelf", 10, 5, 8, 1, "Stacks."),
        O("lectern", 13, 12, 3, 1, "Seminar room.", { seats: [11, 9, 7, 2] }),
        O("counter", 2, 10, 3, 1, "Loans desk.", { staffAt: [3, 11] }), O("restroom", 1, 12, 1, 1, "Restroom."),
      ],
      start: { x: 9, z: 12 },
    },
  };

  /* ---------- generic interiors: one per venue type, used by every public place without a hand-made one ---------- */
  const GEN = {
    cafe: { w: 14, h: 11, floor: "#d8c3a5", band: "#9c7b5b", crowd: 10, objs: [
      O("counter", 1, 2, 7, 1, "Counter: coffee machine, a cake cabinet and a jar of biscotti.", { staffAt: [4, 1] }),
      O("table", 3, 6, 1, 1, "Window table."), O("table", 7, 6, 1, 1, "Two-top."), O("table", 10, 4, 1, 1, "Corner table."), O("table", 10, 7, 1, 1, "Table by the plants."),
      O("plant", 12, 1, 1, 1, ""), O("bookshelf", 12, 8, 1, 2, "Swap shelf and the day's papers.")] },
    restaurant: { w: 16, h: 12, floor: "#caa47e", band: "#7a4f36", crowd: 16, objs: [
      O("counter", 1, 2, 6, 1, "The pass: plates going out fast.", { staffAt: [4, 1] }),
      ...[[3, 6], [7, 6], [11, 6], [3, 9], [7, 9], [11, 9]].map(([x, z]) => O("table", x, z, 2, 1, "A table for two, candle and all.")),
      O("plant", 14, 2, 1, 1, ""), O("restroom", 14, 10, 1, 1, "Restroom.")] },
    pub: { w: 16, h: 12, floor: "#8b5e3c", band: "#5b3a24", crowd: 20, objs: [
      O("bar", 1, 2, 9, 1, "The bar: a row of taps, a chalkboard of specials, footy on the telly.", { staffAt: [5, 1] }),
      O("table", 3, 7, 2, 1, "Sticky table with a view of the telly."), O("table", 7, 7, 2, 1, "High table."), O("table", 11, 5, 2, 1, "Booth by the window."),
      O("tv", 12, 1, 3, 1, "The TV: whatever game is on."), O("restroom", 14, 10, 1, 1, "Restroom.")] },
    bar: { w: 14, h: 11, floor: "#3a3f58", band: "#2b2d42", crowd: 18, objs: [
      O("bar", 1, 2, 8, 1, "Backlit shelves of bottles and a bartender who knows every one.", { staffAt: [4, 1] }),
      O("dancefloor", 8, 5, 5, 4, "A little dance floor under the disco ball.", { walkable: true }),
      O("sofa", 1, 8, 3, 1, "Velvet banquette."), O("table", 5, 7, 1, 1, "Candlelit table."), O("restroom", 12, 1, 1, 1, "Restroom.")] },
    library: { w: 18, h: 13, floor: "#c9c2b0", band: "#8e6e53", crowd: 16, objs: [
      O("counter", 2, 10, 3, 1, "Loans and returns.", { staffAt: [3, 11] }),
      O("shelf", 9, 2, 7, 1, "Fiction A-L."), O("shelf", 9, 5, 7, 1, "Fiction M-Z."), O("shelf", 9, 8, 7, 1, "Local history - Newtown, Glebe, Camperdown."),
      O("desk", 2, 3, 4, 1, "Study desks with power points."), O("desk", 2, 6, 4, 1, "Quiet study."), O("sofa", 12, 11, 3, 1, "Reading nook with bean bags.")] },
    museum: { w: 18, h: 13, floor: "#e3dccd", band: "#b8a88a", crowd: 14, objs: [
      O("pedestal", 4, 4, 1, 1, "An ancient pot in a glass case."), O("pedestal", 8, 4, 1, 1, "A carved stone head, older than the city."), O("pedestal", 12, 4, 1, 1, "Fossils, labelled in careful handwriting."),
      O("pedestal", 4, 8, 1, 1, "A model of old Sydney."), O("pedestal", 8, 8, 1, 1, "Scientific instruments in brass."), O("pedestal", 12, 8, 1, 1, "Textiles from across the Pacific."),
      O("painting", 16, 3, 1, 3, "A big painting of the harbour."), O("counter", 2, 11, 3, 1, "Front desk: free entry, maps and a donations box.", { staffAt: [3, 12] })] },
    gallery: { w: 16, h: 12, floor: "#f2efe8", band: "#d9d4c7", crowd: 12, objs: [
      O("painting", 1, 2, 1, 3, "Big bright canvas. The label calls it 'untitled'."), O("painting", 1, 7, 1, 3, "A photo series of Sydney shopfronts."),
      O("painting", 14, 2, 1, 3, "Textile work, hung from the ceiling."), O("painting", 14, 7, 1, 3, "Video piece on a loop."),
      O("pedestal", 7, 5, 2, 2, "A sculpture you're not allowed to touch."), O("counter", 6, 10, 3, 1, "Front desk with catalogues.", { staffAt: [7, 11] })] },
    shop: { w: 14, h: 11, floor: "#e9dfcf", band: "#b89a78", crowd: 8, objs: [
      O("counter", 1, 2, 4, 1, "Counter with a tip jar and a vintage till.", { staffAt: [2, 1] }),
      O("rack", 7, 3, 4, 1, "A rail of things you don't need but want."), O("rack", 7, 6, 4, 1, "More racks."), O("shelf", 12, 2, 1, 6, "Shelves of odds and ends."), O("plant", 1, 9, 1, 1, "")] },
    bookshop: { w: 14, h: 11, floor: "#d8c6a4", band: "#8b5e3c", crowd: 8, objs: [
      O("counter", 1, 2, 4, 1, "Counter piled with staff picks.", { staffAt: [2, 1] }),
      O("bookshelf", 7, 2, 1, 3, "New releases."), O("bookshelf", 10, 2, 1, 3, "Local authors."), O("bookshelf", 7, 6, 1, 3, "Poetry and zines."), O("bookshelf", 10, 6, 1, 3, "Secondhand classics."),
      O("sofa", 1, 8, 3, 1, "An armchair nobody ever gets up from.")] },
    gym: { w: 16, h: 12, floor: "#6c7580", band: "#3a3f48", crowd: 12, objs: [
      O("gym", 2, 2, 3, 2, "Squat rack."), O("gym", 7, 2, 3, 2, "Bench press."), O("gym", 12, 2, 3, 2, "Treadmills."), O("gym", 2, 7, 3, 2, "Rowers."), O("gym", 7, 7, 3, 2, "Dumbbell rack."),
      O("counter", 12, 9, 3, 1, "Reception: towels, water, a smoothie fridge.", { staffAt: [13, 10] })] },
    supermarket: { w: 18, h: 13, floor: "#eef0ea", band: "#3f9d4a", crowd: 16, objs: [
      O("shelf", 3, 2, 10, 1, "Aisle 1: pasta, rice, tins."), O("shelf", 3, 5, 10, 1, "Aisle 2: snacks and Tim Tams."), O("shelf", 3, 8, 10, 1, "Aisle 3: fruit and veg."),
      O("fridge", 16, 2, 1, 1, "Drinks fridge."), O("fridge", 16, 4, 1, 1, "Dairy."), O("counter", 2, 11, 4, 1, "Self-checkouts. Unexpected item in bagging area.", { staffAt: [3, 12] })] },
    laundromat: { w: 12, h: 10, floor: "#dfe8ee", band: "#4f8fcf", crowd: 5, objs: [
      O("washer", 1, 2, 1, 1, "Washer 1."), O("washer", 2, 2, 1, 1, "Washer 2."), O("washer", 3, 2, 1, 1, "Washer 3."), O("washer", 4, 2, 1, 1, "Washer 4."),
      O("washer", 7, 2, 1, 1, "Dryer - $1 for 8 minutes."), O("washer", 8, 2, 1, 1, "Dryer."), O("sofa", 2, 7, 3, 1, "Plastic chairs and a pile of old magazines.")] },
    cinema: { w: 18, h: 14, floor: "#4a2c3a", band: "#2b1b24", crowd: 30, objs: [
      O("screen", 3, 1, 12, 1, "The big screen. Trailers first, obviously."),
      O("lectern", 8, 12, 2, 1, "Candy bar: choc tops and popcorn.", { seats: [10, 8, 6, 4] })] },
    theatre: { w: 18, h: 14, floor: "#6b2a2e", band: "#3b1a1c", crowd: 30, objs: [
      O("stage", 3, 1, 12, 3, "The stage, curtains half open."),
      O("lectern", 8, 12, 2, 1, "Box office and bar.", { seats: [10, 8, 6] })] },
  };
  GEN.livemusic = GEN.theatre; GEN.vintageshop = GEN.shop; GEN.market = GEN.shop; GEN.fishmarket = GEN.supermarket; GEN.campus = GEN.library;
  for (const [cat, t] of Object.entries(GEN)) {
    if (CL.INTERIOR_DEFS["gen-" + cat]) continue;
    const dx = Math.floor(t.w / 2);
    CL.INTERIOR_DEFS["gen-" + cat] = {
      name: "", generic: cat, w: t.w, h: t.h, exits: ["street"], crowdMax: t.crowd,
      grid: paint(t.w, t.h, [["f", 1, 1, t.w - 2, t.h - 2], ["b", 1, 1, t.w - 2, 1]], [[dx, t.h - 1, "D"]]),
      floors: { f: t.floor, b: t.band, D: "#6b4f3a" }, rooms: [], objects: t.objs, start: { x: dx, z: t.h - 2 },
    };
  }
  CL.interiors = CL.interiors || {};
  CL.GEN_INTERIORS = GEN;

  /* ---------- runtime layout ---------- */
  const L = CL.interiors = {};
  const SOLID = c => c === "#" || c === "G";
  L.build = function (key) {
    const def = CL.INTERIOR_DEFS[key];
    const lay = { key, def, w: def.w, h: def.h, blocked: new Uint8Array(def.w * def.h), objects: [] };
    for (let z = 0; z < def.h; z++) for (let x = 0; x < def.w; x++) if (SOLID(def.grid[z][x])) lay.blocked[z * def.w + x] = 1;
    def.objects.forEach((o, i) => {
      const obj = Object.assign({ id: `${key}:${i}` }, o);
      lay.objects.push(obj);
      if (!o.walkable) for (let j = o.z; j < o.z + o.d; j++) for (let k = o.x; k < o.x + o.w; k++) lay.blocked[j * def.w + k] = 1;
    });
    for (let z = 0; z < def.h; z++) for (let x = 0; x < def.w; x++) if (def.grid[z][x] === "D") lay.door = { x, z };
    return lay;
  };
  L.solid = SOLID;
  L.walkable = (lay, x, z) => x >= 0 && z >= 0 && x < lay.w && z < lay.h && !lay.blocked[z * lay.w + x];
  L.bfs = function (lay, sx, sz) {
    sx = CL.clamp(Math.round(sx), 0, lay.w - 1); sz = CL.clamp(Math.round(sz), 0, lay.h - 1);
    const W = lay.w, dist = new Int16Array(W * lay.h).fill(-1), prev = new Int32Array(W * lay.h).fill(-1);
    const s = sz * W + sx; dist[s] = 0; const q = [s];
    for (let i = 0; i < q.length; i++) {
      const c = q[i], cx = c % W, cz = (c / W) | 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, nz = cz + dz, n = nz * W + nx;
        if (!L.walkable(lay, nx, nz) || dist[n] >= 0) continue;
        dist[n] = dist[c] + 1; prev[n] = c; q.push(n);
      }
    }
    return { dist, prev, W };
  };
  L.pathTo = function (f, x, z) {
    let c = z * f.W + x; if (x < 0 || z < 0 || x >= f.W || f.dist[c] < 0) return null;
    const p = []; while (c >= 0 && f.dist[c] > 0) { p.push({ x: c % f.W, z: (c / f.W) | 0 }); c = f.prev[c]; }
    return p.reverse();
  };
  // nearest reachable tile next to (or on, when walkable) an object's footprint
  L.approach = function (lay, f, o) {
    let best = null;
    for (let j = o.z - 1; j <= o.z + o.d; j++) for (let k = o.x - 1; k <= o.x + o.w; k++) {
      const inside = k >= o.x && k < o.x + o.w && j >= o.z && j < o.z + o.d;
      const diag = (k < o.x || k >= o.x + o.w) && (j < o.z || j >= o.z + o.d);
      if ((inside && !o.walkable) || diag || !L.walkable(lay, k, j)) continue;
      const d = f.dist[j * lay.w + k];
      if (d >= 0 && (!best || d < best.d)) best = { x: k, z: j, d };
    }
    return best;
  };
})(window.CL = window.CL || {});
