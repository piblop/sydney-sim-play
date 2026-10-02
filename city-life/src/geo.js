/* City Life - geometry, time and opening-hours helpers (no DOM, no three.js). */
(function (CL) {
  // Same projection as the parent Sydney Sim build (data/map.js meta): 1 unit = 1 m,
  // x = east, z = south, origin at map.json's origin.
  const LAT0 = -33.8875, LON0 = 151.185, M_LAT = 110574.0, M_LON = 92410.51;
  const geo = CL.geo = {
    LAT0, LON0,
    toXZ: (lat, lon) => ({ x: (lon - LON0) * M_LON, z: (LAT0 - lat) * M_LAT }),
    toLL: (x, z) => ({ lat: LAT0 - z / M_LAT, lng: LON0 + x / M_LON }),
    dist: (a, b) => Math.hypot(a.x - b.x, a.z - b.z),
  };

  // play area: Camperdown & USyd, Newtown & Enmore, Glebe & Forest Lodge, Chippendale & Darlington, Pyrmont & Ultimo
  geo.BBOX = { s: -33.9065, w: 151.1640, n: -33.8620, e: 151.2050 };
  geo.inPlay = (lat, lon) => lat > geo.BBOX.s && lat < geo.BBOX.n && lon > geo.BBOX.w && lon < geo.BBOX.e;

  /* ---------- time: S.minutes counts from Monday 00:00 of week 1 ---------- */
  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const DAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const time = CL.time = {
    DAY_NAMES, DAY_LONG,
    dow: m => (Math.floor(m / 1440) + 1) % 7,      // 0 = Sunday (JS / Places convention)
    minOfDay: m => ((m % 1440) + 1440) % 1440,
    hour: m => (((m % 1440) + 1440) % 1440) / 60,
    dayNo: m => Math.floor(m / 1440) + 1,
    fmt(m) {
      const md = time.minOfDay(m), h = Math.floor(md / 60), mm = Math.floor(md % 60);
      const ap = h < 12 ? "am" : "pm", h12 = ((h + 11) % 12) + 1;
      return mm ? `${h12}:${String(mm).padStart(2, "0")}${ap}` : `${h12}${ap}`;
    },
  };

  /* ---------- opening hours ----------
     Internal form: week[7] = list of [openMin, closeMin] per JS weekday (0 = Sun);
     close may exceed 1440 to run past midnight. Text form used by the data files:
       "Mo-Fr 7-16; Sa,Su 8-15"   "Mo-Su 0-24"   "Fr 7-22.5"   "Sa 10-28" (to 4am) */
  const DK = { Su: 0, Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6 };
  const hours = CL.hours = {
    // OSM-style opening_hours subset: "Mo-Fr 7-15; Sa,Su 8-14", "Mo-Fr 07:30-16:00",
    // split shifts "Mo-Sa 12:00-15:00,17:30-21:00", open-ended "Tu-Sa 17:00+" (read as 5 h),
    // "Su[1] 10-15" (nth weekday -> that weekday). "PH ..." and "... off" rules are skipped.
    parse(text) {
      const week = [[], [], [], [], [], [], []];
      if (!text) return week;
      const mins = t => t.includes(":") ? +t.split(":")[0] * 60 + +t.split(":")[1] : Math.round(+t * 60);
      const RANGE = /^(\d{1,2}(?::\d\d|\.\d+)?)(?:-(\d{1,2}(?::\d\d|\.\d+)?)|(\+))$/;
      for (const part of text.split(";").map(s => s.trim()).filter(Boolean)) {
        const sp = part.search(/\s\d/); if (sp < 0) continue;
        const dayTxt = part.slice(0, sp).replace(/\[[^\]]*\]/g, ""), ranges = part.slice(sp + 1).replace(/\s/g, "").split(",");
        const days = new Set();
        for (const tok of dayTxt.replace(/\s/g, "").split(",")) {
          const [a, b] = tok.split("-");
          if (!(a in DK)) continue;
          if (!b) { days.add(DK[a]); continue; }
          for (let d = DK[a], i = 0; i < 7; i++, d = (d + 1) % 7) { days.add(d); if (d === DK[b]) break; }
        }
        for (const r of ranges) {
          const m = r.match(RANGE); if (!m) continue;
          const o = mins(m[1]), c = m[3] ? o + 300 : mins(m[2]);
          for (const d of days) week[d].push([o, c]);
        }
      }
      return week;
    },
    // Places API (New) currentOpeningHours / regularOpeningHours -> week
    fromPlaces(oh) {
      if (!oh || !oh.periods) return null;
      const week = [[], [], [], [], [], [], []];
      for (const p of oh.periods) {
        if (!p.open) continue;
        if (!p.close) { for (let d = 0; d < 7; d++) week[d].push([0, 1440]); break; } // open 24/7
        const o = p.open.hour * 60 + (p.open.minute || 0);
        let c = p.close.hour * 60 + (p.close.minute || 0);
        const span = (p.close.day - p.open.day + 7) % 7;
        c += span * 1440;
        if (c <= o) c += 1440;
        week[p.open.day].push([o, c]);
      }
      return week;
    },
    isOpen(week, m) {
      if (!week) return true;
      const d = time.dow(m), md = time.minOfDay(m);
      if (week[d].some(([o, c]) => md >= o && md < c)) return true;
      const y = (d + 6) % 7; // yesterday's late session
      return week[y].some(([o, c]) => c > 1440 && md + 1440 < c);
    },
    // minutes until it closes (Infinity if 24h), assumes open now
    closesIn(week, m) {
      if (!week) return Infinity;
      const d = time.dow(m), md = time.minOfDay(m);
      for (const [o, c] of week[d]) if (md >= o && md < c) return c >= 1440 && o === 0 && c - o >= 1440 ? Infinity : c - md;
      const y = (d + 6) % 7;
      for (const [o, c] of week[y]) if (c > 1440 && md + 1440 < c) return c - 1440 - md;
      return 0;
    },
    // absolute minute of the next opening, or null
    nextOpen(week, m) {
      if (!week) return m;
      for (let step = 0; step < 7 * 96; step++) {
        const t = Math.floor(m / 15) * 15 + (step + 1) * 15;
        if (hours.isOpen(week, t)) return t;
      }
      return null;
    },
    // "Closed until 7am" / "Closed until Sat 10am"
    closedReason(week, m) {
      const t = hours.nextOpen(week, m);
      if (t == null) return "Closed";
      const sameDay = time.dayNo(t) === time.dayNo(m);
      const tomorrow = time.dayNo(t) === time.dayNo(m) + 1;
      return `Closed until ${sameDay ? "" : tomorrow && time.minOfDay(t) < 12 * 60 ? "" : DAY_NAMES[time.dow(t)] + " "}${time.fmt(t)}`;
    },
    summary(week) {
      if (!week) return "Always open";
      const txt = d => week[d].length ? week[d].map(([o, c]) => o === 0 && c >= 1440 ? "24 hours" : `${time.fmt(o)}-${time.fmt(c)}`).join(", ") : "closed";
      const order = [1, 2, 3, 4, 5, 6, 0];
      const rows = [];
      for (const d of order) {
        const t = txt(d), last = rows[rows.length - 1];
        if (last && last.t === t) last.to = d; else rows.push({ from: d, to: d, t });
      }
      return rows.map(r => `${DAY_NAMES[r.from]}${r.to !== r.from ? "-" + DAY_NAMES[r.to] : ""} ${r.t}`).join(" · ");
    },
  };

  // deterministic 0..1 hash noise (stable busyness per venue + hour)
  CL.hash01 = (str, n) => {
    let h = 2166136261 ^ n;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ((h >>> 0) % 10000) / 10000;
  };
  CL.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
})(window.CL = window.CL || {});
