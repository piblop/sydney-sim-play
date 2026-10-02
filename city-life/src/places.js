/* City Life - Places API (New) with strict cost rules:
   - Nearby Search once per zone at startup, minimal field mask (id, displayName, location, primaryType)
   - Place Details only when the player clicks a discovered POI; cached in memory for the session
   - nothing from the game loop or autonomy ever calls this file; saves keep place ids only */
(function (CL) {
  const P = CL.places = { enabled: false, calls: { nearby: 0, details: 0, photos: 0 }, cache: new Map(), pending: new Map() };
  const BASE = "https://places.googleapis.com/v1";
  P.init = function (key) { P.key = key; P.enabled = !!key; };

  P.nearbyAllZones = async function () {
    if (!P.enabled) return [];
    const out = [];
    for (const z of Object.values(CL.ZONES)) {
      try {
        P.calls.nearby++;
        const r = await fetch(`${BASE}/places:searchNearby`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Goog-Api-Key": P.key, "X-Goog-FieldMask": "places.id,places.displayName,places.location,places.primaryType" },
          body: JSON.stringify({ includedTypes: CL.NEARBY_TYPES, maxResultCount: 20, rankPreference: "POPULARITY",
            locationRestriction: { circle: { center: { latitude: z.lat, longitude: z.lng }, radius: z.r } } }),
        });
        if (!r.ok) { console.warn("Nearby Search failed", r.status, await r.text()); continue; }
        const j = await r.json();
        out.push(...(j.places || []));
      } catch (e) { console.warn("Nearby Search error", e); }
    }
    CL.bus.emit("places-calls", P.calls);
    return out;
  };

  const DETAIL_FIELDS = "id,displayName,primaryType,rating,userRatingCount,currentOpeningHours,regularOpeningHours,priceLevel,photos,formattedAddress,businessStatus";
  // Returns cached details or fetches once (concurrent clicks share one request)
  P.details = function (placeId) {
    if (!P.enabled || !placeId) return Promise.resolve(null);
    if (P.cache.has(placeId)) return Promise.resolve(P.cache.get(placeId));
    if (P.pending.has(placeId)) return P.pending.get(placeId);
    P.calls.details++; CL.bus.emit("places-calls", P.calls);
    const req = fetch(`${BASE}/places/${encodeURIComponent(placeId)}`, { headers: { "X-Goog-Api-Key": P.key, "X-Goog-FieldMask": DETAIL_FIELDS } })
      .then(r => r.ok ? r.json() : null).catch(() => null)
      .then(d => { P.pending.delete(placeId); if (d) P.cache.set(placeId, d); return d; });
    P.pending.set(placeId, req);
    return req;
  };
  // One photo per place; the media endpoint redirects to the image. Author attribution must be shown with it.
  P.photo = function (d) {
    const ph = d && d.photos && d.photos[0];
    if (!ph) return null;
    if (P.cache.has("photo:" + d.id)) return P.cache.get("photo:" + d.id);
    P.calls.photos++; CL.bus.emit("places-calls", P.calls);
    const out = { src: `${BASE}/${ph.name}/media?maxWidthPx=480&key=${encodeURIComponent(P.key)}`, authors: ph.authorAttributions || [] };
    P.cache.set("photo:" + d.id, out);
    return out;
  };
})(window.CL = window.CL || {});
