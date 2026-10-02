/* City Life - street furniture and small details on the storybook map, all from
   OpenStreetMap: benches, bus shelters, bike racks, bubblers, picnic tables,
   BBQs, fences, hedges and zebra crossings, plus flower beds and lamp posts.
   Each kind is one instanced toon mesh built from a few merged boxes. */
(function (CL) {
  const K = CL.chibi, P = CL.props = {};

  // merge a list of [w,h,d, x,y,z, colour] boxes into one geometry with vertex colours
  function kit(parts) {
    const pos = [], nor = [], col = [], c = new THREE.Color();
    for (const [w, h, dd, x, y, z, hex] of parts) {
      const g = new THREE.BoxGeometry(w, h, dd); g.translate(x, y + h / 2, z);
      const gi = g.toNonIndexed(); c.set(hex);
      pos.push(...gi.attributes.position.array); nor.push(...gi.attributes.normal.array);
      for (let i = 0; i < gi.attributes.position.count; i++) col.push(c.r, c.g, c.b);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    return g;
  }
  const WOOD = "#b98552", DARK = "#5b5f66", GREEN = "#3f7d5a";
  const KITS = {
    bench: kit([[1.9, .12, .55, 0, .5, 0, WOOD], [1.9, .45, .1, 0, .62, -.25, WOOD], [.12, .5, .5, -.8, 0, 0, DARK], [.12, .5, .5, .8, 0, 0, DARK]]),
    bus: kit([[3.2, .12, 1.4, 0, 2.5, 0, GREEN], [.12, 2.5, .12, -1.5, 0, -.6, DARK], [.12, 2.5, .12, 1.5, 0, -.6, DARK], [3.0, 1.6, .06, 0, .8, -.62, "#bfe3f2"], [1.8, .1, .4, 0, .5, -.35, WOOD], [.1, 3.3, .1, 1.9, 0, .5, DARK], [.7, .7, .06, 1.9, 2.6, .5, "#e8b923"]]),
    bike: kit([[.08, .8, .08, -.6, 0, 0, DARK], [.08, .8, .08, .6, 0, 0, DARK], [1.28, .08, .08, 0, .8, 0, DARK], [.08, .8, .08, -.2, 0, .9, DARK], [.08, .8, .08, .4, 0, .9, DARK], [.68, .08, .08, .1, .8, .9, DARK]]),
    water: kit([[.35, .9, .35, 0, 0, 0, "#6f8fa3"], [.5, .12, .5, 0, .9, 0, "#8fb3c7"]]),
    picnic: kit([[2, .1, .9, 0, .75, 0, WOOD], [2, .08, .3, 0, .45, .7, WOOD], [2, .08, .3, 0, .45, -.7, WOOD], [.12, .75, .8, -.8, 0, 0, WOOD], [.12, .75, .8, .8, 0, 0, WOOD]]),
    bbq: kit([[1.4, .9, .7, 0, 0, 0, "#9aa1a8"], [1.3, .06, .6, 0, .9, 0, "#3a3d42"]]),
    lamp: kit([[.14, 4.2, .14, 0, 0, 0, "#3d4a5a"], [.5, .35, .5, 0, 4.2, 0, "#fff3c4"], [.62, .1, .62, 0, 4.55, 0, "#3d4a5a"]]),
    bed: kit([[2.4, .35, 1.1, 0, 0, 0, "#9b6a45"], [2.2, .25, .9, 0, .35, 0, "#5a9a3e"]]),
  };
  const FLOWERS = ["#ff8fab", "#ffd166", "#f4f1de", "#c77dff", "#ff6b6b"];

  P.build = function (scene, map, inBox) {
    const d = new THREE.Object3D(), hash = CL.hash01, mat = K.bend(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: K.ramp }));
    const place = (kind, list, rot, scale) => {
      if (!list.length) return null;
      const m = new THREE.InstancedMesh(KITS[kind], mat, list.length);
      list.forEach(([x, z, r], i) => { d.position.set(x, 0, z); d.rotation.set(0, r ?? rot ?? 0, 0); d.scale.setScalar(scale || 1.6); d.updateMatrix(); m.setMatrixAt(i, d.matrix); });
      m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; scene.add(m); return m;
    };
    // face each item along the nearest street so benches and shelters sit square to the kerb
    const roadDir = (x, z) => { const n = CL.world.nearestNode(x, z); if (n < 0) return 0; const W = CL.world.nodes, a = W.adj[n][0]; if (a == null) return 0; return Math.atan2(W.xs[a] - W.xs[n], W.zs[a] - W.zs[n]) + Math.PI / 2; };
    const by = {};
    for (const [x, z, k] of map.furni || []) { if (!inBox([x, z]) || CL.world.hit(x, z) >= 0) continue; (by[k] = by[k] || []).push([x, z, roadDir(x, z)]); }
    const counts = {};
    for (const [k, list] of Object.entries(by)) if (KITS[k]) { place(k, list); counts[k] = list.length; }

    // lamp posts along main streets (the night glows sit under these)
    const lamps = [];
    for (const r of map.roads) {
      if (!(r.c === "major" || r.c === "secondary") || r.u || !r.p.some(inBox)) continue;
      for (let i = 1; i < r.p.length; i++) { const [x1, z1] = r.p[i - 1], [x2, z2] = r.p[i], L = Math.hypot(x2 - x1, z2 - z1); for (let s = 18; s < L; s += 36) { const t = s / L, nx = -(z2 - z1) / L * 9, nz = (x2 - x1) / L * 9, x = x1 + (x2 - x1) * t + nx, z = z1 + (z2 - z1) * t + nz; if (inBox([x, z]) && CL.world.hit(x, z) < 0) lamps.push([x, z, 0]); } }
      if (lamps.length > 2500) break;
    }
    place("lamp", lamps, 0, 1.4); counts.lamp = lamps.length;
    P.lampPts = lamps;

    // flower beds by benches in parks, with blooms on top
    const beds = (by.bench || []).filter((b, i) => hash("bed", i) < .35).map(([x, z, r]) => [x + Math.sin(r) * 3, z + Math.cos(r) * 3, r]);
    place("bed", beds); counts.bed = beds.length;
    if (beds.length) {
      const fg = new THREE.IcosahedronGeometry(.28, 0), fm = new THREE.InstancedMesh(fg, K.bend(new THREE.MeshToonMaterial({ color: "#ffffff", gradientMap: K.ramp })), beds.length * 6);
      let k = 0; const c = new THREE.Color();
      beds.forEach(([x, z, r], i) => { for (let j = 0; j < 6; j++) { const u = (j / 5 - .5) * 3.2; d.position.set(x + Math.cos(r) * u, 1.1, z - Math.sin(r) * u); d.rotation.set(0, 0, 0); d.scale.setScalar(1.3); d.updateMatrix(); fm.setMatrixAt(k, d.matrix); fm.setColorAt(k++, c.set(FLOWERS[Math.floor(hash("fl", i * 7 + j) * FLOWERS.length)])); } });
      fm.frustumCulled = false; scene.add(fm);
    }

    // fences (white pickets / railings) and hedges as low walls
    const fpos = [], fcol = [], c = new THREE.Color();
    for (const f of map.fences || []) {
      if (!f.p.some(inBox)) continue;
      const hedge = f.k === "hedge", h = hedge ? 1.4 : .9, w = hedge ? .9 : .12; c.set(hedge ? "#4f9e48" : "#f4efe4");
      for (let i = 1; i < f.p.length; i++) {
        const [x1, z1] = f.p[i - 1], [x2, z2] = f.p[i], L = Math.hypot(x2 - x1, z2 - z1) || 1, nx = -(z2 - z1) / L * w / 2, nz = (x2 - x1) / L * w / 2;
        const q = [[x1 - nx, 0, z1 - nz], [x2 - nx, 0, z2 - nz], [x2 - nx, h, z2 - nz], [x1 - nx, 0, z1 - nz], [x2 - nx, h, z2 - nz], [x1 - nx, h, z1 - nz],
          [x1 + nx, 0, z1 + nz], [x2 + nx, h, z2 + nz], [x2 + nx, 0, z2 + nz], [x1 + nx, 0, z1 + nz], [x1 + nx, h, z1 + nz], [x2 + nx, h, z2 + nz],
          [x1 - nx, h, z1 - nz], [x2 - nx, h, z2 - nz], [x2 + nx, h, z2 + nz], [x1 - nx, h, z1 - nz], [x2 + nx, h, z2 + nz], [x1 + nx, h, z1 + nz]];
        for (const [x, y, z] of q) { fpos.push(x, y, z); fcol.push(c.r, c.g, c.b); }
      }
    }
    if (fpos.length) {
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(fpos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(fcol, 3)); g.computeVertexNormals();
      const m = new THREE.Mesh(g, K.bend(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: K.ramp, side: THREE.DoubleSide }))); m.castShadow = true; m.frustumCulled = false; scene.add(m);
    }
    counts.fences = (map.fences || []).length;

    // zebra crossings: white stripes across the street at the crossing node
    const zeb = [];
    for (const [x, z] of map.crossings || []) { if (!inBox([x, z])) continue; const r = roadDir(x, z); for (let s = -2; s <= 2; s++) zeb.push([x + Math.cos(r) * 0 + Math.sin(r) * s * 1.1, z + Math.cos(r) * s * 1.1, r]); }
    if (zeb.length) {
      const zg = new THREE.PlaneGeometry(.6, 4.2).rotateX(-Math.PI / 2), zm = new THREE.InstancedMesh(zg, K.bend(new THREE.MeshBasicMaterial({ color: "#fbf8ef", depthWrite: false })), zeb.length);
      zeb.forEach(([x, z, r], i) => { d.position.set(x, .05, z); d.rotation.set(0, r, 0); d.scale.setScalar(1); d.updateMatrix(); zm.setMatrixAt(i, d.matrix); });
      zm.renderOrder = -2; zm.frustumCulled = false; scene.add(zm);
    }
    counts.crossings = zeb.length / 5;
    P.counts = counts;
    return counts;
  };
})(window.CL = window.CL || {});
