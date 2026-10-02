/* City Life - chibi characters (big round head, dot eyes, rosy cheeks, stubby
   limbs) with a walk cycle, plus the toon materials and "rolling log" world
   bend shared by the 3D map. Characters face +z; set group.rotation.y to a
   heading from Math.atan2(dx, dz). 1 unit = 1 m at scale 1 (about 1.5 m tall). */
(function (CL) {
  const C = CL.chibi = {};

  // 3-step toon ramp (the flat, soft-shaded look)
  const ramp = (() => {
    const d = new Uint8Array([168, 168, 168, 218, 218, 218, 255, 255, 255]);
    const t = new THREE.DataTexture(d, 3, 1, THREE.RGBFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
  })();
  const toonC = new Map();
  C.toon = (color, extra) => {
    const k = color + (extra ? JSON.stringify(extra) : "");
    if (!toonC.has(k)) toonC.set(k, C.bend(new THREE.MeshToonMaterial(Object.assign({ color, gradientMap: ramp }, extra || {}))));
    return toonC.get(k);
  };
  C.ramp = ramp;

  /* ---------- world bend: things curve down away from the focus point ---------- */
  C.bendU = { uFocus: { value: new THREE.Vector2() }, uBend: { value: 0 } };
  // cut: sink anything standing between the camera and the focus to a low plinth (dollhouse cutaway)
  C.bend = function (mat, cut) {
    if (mat.userData.bent) return mat;
    mat.userData.bent = true;
    if (cut) mat.defines = Object.assign(mat.defines || {}, { CUTAWAY: 1 });
    const prev = mat.onBeforeCompile;
    mat.onBeforeCompile = (sh, r) => {
      if (prev) prev(sh, r);
      sh.uniforms.uFocus = C.bendU.uFocus; sh.uniforms.uBend = C.bendU.uBend;
      sh.vertexShader = "uniform vec2 uFocus;\nuniform float uBend;\n" + sh.vertexShader.replace("#include <project_vertex>", `
        vec4 mvPosition = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
        #endif
        vec4 bwp = modelMatrix * mvPosition;
        vec2 bd = bwp.xz - uFocus;
        #ifdef CUTAWAY
          float cw = 40.0 + bd.y * 1.1;
          float cutK = smoothstep(1.0, 6.0, bd.y) * (1.0 - smoothstep(cw - 5.0, cw, abs(bd.x)));
          bwp.y = mix(bwp.y, min(bwp.y, 1.4), cutK);
        #endif
        float far = min(bd.y + 40.0, 0.0);   // flat around you, rolls away beyond ~40 m north
        bwp.y -= uBend * far * far;
        mvPosition = viewMatrix * bwp;
        gl_Position = projectionMatrix * mvPosition;`);
    };
    mat.needsUpdate = true;
    return mat;
  };
  C.drop = (x, z) => { const u = C.bendU, dx = x - u.uFocus.value.x, dz = z - u.uFocus.value.y, f = Math.min(dz + 40, 0); return u.uBend.value * f * f; };

  /* ---------- one chibi ---------- */
  const G = {
    head: new THREE.SphereGeometry(0.34, 18, 14), hair: new THREE.SphereGeometry(0.36, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
    body: new THREE.SphereGeometry(0.22, 14, 10), limb: new THREE.CylinderGeometry(0.065, 0.06, 0.3, 8), foot: new THREE.SphereGeometry(0.085, 10, 6),
    eye: new THREE.SphereGeometry(0.045, 8, 6), cheek: new THREE.CircleGeometry(0.05, 10), hand: new THREE.SphereGeometry(0.06, 8, 6),
  };
  G.limb.translate(0, -0.15, 0);   // pivot at the top (hip / shoulder)
  const black = new THREE.MeshBasicMaterial({ color: "#2b2320" }), blush = new THREE.MeshBasicMaterial({ color: "#f59aa0", transparent: true, opacity: .8 });
  C.make = function (look, opts) {
    const o = Object.assign({ shirt: "#ff7a00", skin: "#f1c9a0", hair: "#3b2a1a", pants: "#3d4a6b", shoes: "#6b4a3a" }, look || {});
    const bent = !opts || opts.bend !== false, M = c => bent ? C.toon(c) : new THREE.MeshToonMaterial({ color: c, gradientMap: ramp });
    const g = new THREE.Group(), rig = new THREE.Group(); g.add(rig);
    const add = (geo, mat, x, y, z, sx, sy, sz, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (sx) m.scale.set(sx, sy, sz); m.castShadow = true; (parent || rig).add(m); return m; };
    const legL = new THREE.Group(), legR = new THREE.Group(); legL.position.set(-.1, .36, 0); legR.position.set(.1, .36, 0); rig.add(legL, legR);
    add(G.limb, M(o.pants), 0, 0, 0, 1, 1.05, 1, legL); add(G.foot, M(o.shoes), 0, -.32, .03, 1, .7, 1.3, legL);
    add(G.limb, M(o.pants), 0, 0, 0, 1, 1.05, 1, legR); add(G.foot, M(o.shoes), 0, -.32, .03, 1, .7, 1.3, legR);
    const body = add(G.body, M(o.shirt), 0, .55, 0, 1, 1.15, .9);
    const armL = new THREE.Group(), armR = new THREE.Group(); armL.position.set(-.2, .7, 0); armR.position.set(.2, .7, 0); rig.add(armL, armR);
    armL.rotation.z = -.35; armR.rotation.z = .35;
    add(G.limb, M(o.shirt), 0, 0, 0, .9, .85, .9, armL); add(G.hand, M(o.skin), 0, -.27, 0, 1, 1, 1, armL);
    add(G.limb, M(o.shirt), 0, 0, 0, .9, .85, .9, armR); add(G.hand, M(o.skin), 0, -.27, 0, 1, 1, 1, armR);
    const headG = new THREE.Group(); headG.position.set(0, 1.08, 0); rig.add(headG);
    add(G.head, M(o.skin), 0, 0, 0, 1, .95, 1, headG);
    add(G.hair, M(o.hair), 0, .03, -.02, 1, 1, 1, headG);
    if (o.bun) add(G.foot, M(o.hair), 0, .3, -.18, 1.6, 1.6, 1.6, headG);
    const eL = add(G.eye, black, -.12, -.02, .315, .8, 1.25, .5, headG), eR = add(G.eye, black, .12, -.02, .315, .8, 1.25, .5, headG);
    eL.castShadow = eR.castShadow = false;
    for (const s of [-1, 1]) { const ck = add(G.cheek, blush, s * .2, -.1, .3, 1, .7, 1, headG); ck.rotation.y = s * .45; ck.castShadow = false; }
    if (bent) for (const m of [black, blush]) C.bend(m);
    g.userData = { rig, legL, legR, armL, armR, headG, body, eyes: [eL, eR], phase: Math.random() * 6, blinkAt: Math.random() * 4 };
    return g;
  };
  // speed: 0 idle, 1 walk, 2 run. dt in seconds.
  C.animate = function (g, dt, speed, t) {
    const u = g.userData; if (!u.rig) return;
    u.phase += dt * (speed > 1.5 ? 14 : 9) * (speed > 0 ? 1 : 0);
    const s = speed > 0 ? Math.min(1, speed) : 0, sw = Math.sin(u.phase) * (speed > 1.5 ? .95 : .7) * s;
    u.legL.rotation.x = sw; u.legR.rotation.x = -sw;
    u.armL.rotation.x = -sw * .9; u.armR.rotation.x = sw * .9;
    u.rig.position.y = s ? Math.abs(Math.cos(u.phase)) * .07 : Math.sin(t * 2 + u.blinkAt) * .012;
    u.rig.rotation.x = s ? (speed > 1.5 ? .18 : .08) : 0;
    u.headG.rotation.z = s ? Math.sin(u.phase) * .06 : Math.sin(t * .7 + u.blinkAt) * .04;
    // blink every few seconds
    const b = (t + u.blinkAt) % 4.2 < .12;
    for (const e of u.eyes) e.scale.y = b ? .15 : 1.25;
  };
})(window.CL = window.CL || {});
