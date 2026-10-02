/* City Life - trees and plants of the Inner West, each species its own chunky
   silhouette (all instanced: one draw call per part per species).
     fig       Moreton Bay fig: short buttressed trunk, huge flat dark dome (parks, cemeteries)
     euc       eucalypt: tall pale trunk, loose clumps of olive-grey leaves
     palm      Canary Island date palm: thick trunk, star of arching fronds (St Stephen's, parks)
     norfolk   Norfolk Island pine: tiered cone (older parks, the harbour edge)
     plane     London plane: round light-green crown (street tree)
     brushbox  brush box: upright oval, dark green (street tree)
     jacaranda purple, wide and airy (October-November bloom)
     frangipani small, splayed branches, cream flowers (front gardens)
     round     generic park tree (two blobs), several greens */
(function (CL) {
  const K = CL.chibi, FO = CL.foliage = {};
  const PARK_MIX = [["fig", .12], ["euc", .24], ["palm", .06], ["norfolk", .04], ["jacaranda", .06], ["round", .48]];
  const STREET_MIX = [["plane", .42], ["brushbox", .3], ["jacaranda", .12], ["euc", .08], ["frangipani", .08]];
  FO.pick = (street, i) => { const mix = street ? STREET_MIX : PARK_MIX; let r = CL.hash01("sp", i), a = 0; for (const [k, p] of mix) { a += p; if (r < a) return k; } return mix[0][0]; };

  // geometry pieces, each unit-sized; placed per instance
  const ico = (r, d) => new THREE.IcosahedronGeometry(r, d);
  const cyl = (t, b, h, s) => { const g = new THREE.CylinderGeometry(t, b, h, s || 7); g.translate(0, h / 2, 0); return g; };
  const frond = (() => { const g = new THREE.ConeGeometry(.35, 3.2, 4); g.translate(0, 1.6, 0); g.rotateX(Math.PI / 2 - .5); return g; })();
  const SPEC = {
    fig:       { trunk: [cyl(.55, .95, 2.6), "#7b6a58"], parts: [[ico(1, 1), [6.2, 3.1, 6.2], [0, 4.2, 0], ["#2f6b3a", "#356f3c", "#2d6436"]], [ico(1, 1), [4.2, 2.4, 4.2], [1.8, 5.6, -1.2], ["#3a7a43", "#3f8249"]], [ico(1, 1), [3.8, 2.1, 3.8], [-2.3, 5.2, 1.4], ["#346f3d"]]] },
    euc:       { trunk: [cyl(.2, .34, 7.4), "#e8e0d2"], parts: [[ico(1, 0), [2.2, 1.6, 2.2], [.6, 7.4, .2], ["#7f9a6a", "#8aa374", "#6f8e60"]], [ico(1, 0), [1.8, 1.3, 1.8], [-1.2, 6.2, -.6], ["#8aa374", "#7a9566"]], [ico(1, 0), [1.6, 1.2, 1.6], [.2, 8.6, -1], ["#94ad7c"]]] },
    palm:      { trunk: [cyl(.42, .55, 5.2, 8), "#8a7258"], fronds: 9, parts: [[ico(1, 0), [.8, .6, .8], [0, 5.3, 0], ["#6b7f3a"]]] },
    norfolk:   { trunk: [cyl(.2, .3, 9, 6), "#7a5b42"], parts: [[new THREE.ConeGeometry(1, 1.4, 7), [2.8, 1.8, 2.8], [0, 3.4, 0], ["#2f6440"]], [new THREE.ConeGeometry(1, 1.4, 7), [2.2, 1.6, 2.2], [0, 5.4, 0], ["#346b45"]], [new THREE.ConeGeometry(1, 1.4, 7), [1.6, 1.4, 1.6], [0, 7.3, 0], ["#3a7349"]], [new THREE.ConeGeometry(1, 1.4, 7), [1, 1.2, 1], [0, 9, 0], ["#3f7a4e"]]] },
    plane:     { trunk: [cyl(.25, .36, 3.4), "#b9a88c"], parts: [[ico(1, 1), [2.7, 2.4, 2.7], [0, 5.2, 0], ["#7fbf5a", "#86c460", "#79b95a"]], [ico(1, 1), [1.8, 1.5, 1.8], [.6, 6.9, -.3], ["#8fcb68"]]] },
    brushbox:  { trunk: [cyl(.22, .32, 2.8), "#8a6446"], parts: [[ico(1, 1), [1.9, 3.2, 1.9], [0, 5.4, 0], ["#3f8a4a", "#3a8045", "#448f4f"]]] },
    jacaranda: { trunk: [cyl(.22, .34, 3.2), "#7a5b42"], parts: [[ico(1, 1), [3.2, 1.7, 3.2], [0, 4.6, 0], ["#9b7fd4", "#a98ae0", "#8f74c9"]], [ico(1, 1), [2, 1.2, 2], [1.2, 5.6, .8], ["#b196e0", "#a48ad8"]]] },
    frangipani:{ trunk: [cyl(.16, .24, 1.6), "#9c8a74"], parts: [[ico(1, 0), [1.4, .8, 1.4], [0, 2.2, 0], ["#5f9a4e"]], [ico(1, 0), [.5, .4, .5], [.5, 2.8, .3], ["#fff4d6"]], [ico(1, 0), [.45, .35, .45], [-.5, 2.7, -.3], ["#ffd1dc"]]] },
    round:     { trunk: [cyl(.28, .4, 3), "#9a6b45"], parts: [[ico(1, 1), [2.6, 2.3, 2.6], [0, 4.8, 0], ["#5fae4e", "#6cbf55", "#4f9e48", "#79c35d", "#5aa85f"]], [ico(1, 1), [1.7, 1.5, 1.7], [.5, 6.5, -.3], ["#6cbf55", "#79c35d", "#5aa85f"]]] },
  };
  FO.build = function (scene, trees) {
    const by = {}; trees.forEach((t, i) => { const k = SPEC[t[2]] ? t[2] : FO.pick(false, i); (by[k] = by[k] || []).push([t[0], t[1], i]); });
    const d = new THREE.Object3D(), c = new THREE.Color(), counts = {};
    const mat = () => K.bend(new THREE.MeshToonMaterial({ color: "#ffffff", gradientMap: K.ramp }));
    for (const [k, list] of Object.entries(by)) {
      const sp = SPEC[k], n = list.length; counts[k] = n;
      const tr = new THREE.InstancedMesh(sp.trunk[0], K.toon(sp.trunk[1]), n);
      const parts = sp.parts.map(p => new THREE.InstancedMesh(p[0], mat(), n));
      const fr = sp.fronds ? new THREE.InstancedMesh(frond, mat(), n * sp.fronds) : null;
      list.forEach(([x, z, i], j) => {
        const s = .8 + CL.hash01("s" + k, i) * .55, ry = CL.hash01("r", i) * 6.28, cr = Math.cos(ry), sr = Math.sin(ry);
        d.position.set(x, 0, z); d.rotation.set(0, ry, 0); d.scale.setScalar(s); d.updateMatrix(); tr.setMatrixAt(j, d.matrix);
        sp.parts.forEach(([, sc, off, cols], pi) => {
          const ox = (off[0] * cr + off[2] * sr) * s, oz = (-off[0] * sr + off[2] * cr) * s;
          d.position.set(x + ox, off[1] * s, z + oz); d.rotation.set(0, ry, 0); d.scale.set(sc[0] * s, sc[1] * s, sc[2] * s); d.updateMatrix();
          parts[pi].setMatrixAt(j, d.matrix); parts[pi].setColorAt(j, c.set(cols[Math.floor(CL.hash01("c" + pi, i) * cols.length)]));
        });
        if (fr) for (let f = 0; f < sp.fronds; f++) {
          d.position.set(x, 5.3 * s, z); d.rotation.set(0, ry + f * 6.28 / sp.fronds, 0, "YXZ"); d.scale.setScalar(s); d.updateMatrix();
          fr.setMatrixAt(j * sp.fronds + f, d.matrix); fr.setColorAt(j * sp.fronds + f, c.set(f % 2 ? "#5f8a3a" : "#6f9a44"));
        }
      });
      for (const m of [tr, ...parts, fr].filter(Boolean)) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; scene.add(m); }
    }
    return counts;
  };
  // low garden shrubs and flower beds for parks: clipped hedges and bursts of colour
  FO.SHRUB_COLS = ["#4f9e48", "#5fae4e", "#3f8a43", "#d86fa0", "#9db4e8", "#f4f1de", "#e0527a", "#f6c945", "#ff9a5a"];
})(window.CL = window.CL || {});
