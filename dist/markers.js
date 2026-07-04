// Pure helpers for the map view — no preact / registry imports, so they're
// unit-testable in isolation. index.js wraps mapDataAttributes() in a <div>.

// Parse each matched note's coordinate property ("lat,lng") into a marker.
// Entries with a missing or malformed coordinate are skipped. `view.coordinates`
// and `view.markerIcon` may be written as `note.<prop>` or bare; both resolve to
// the frontmatter property name.
export function buildMarkers(entries, view) {
  const v = view || {};
  const coordProp = String(v.coordinates || "note.coordinates").replace(/^note\./, "");
  const iconProp = String(v.markerIcon || "note.kind").replace(/^note\./, "");
  const markers = [];
  for (const e of entries || []) {
    const c = e.properties && e.properties[coordProp];
    if (typeof c !== "string" || !c.includes(",")) continue;
    const parts = c.split(",").map((x) => Number(x.trim()));
    if (parts.length !== 2 || parts.some(Number.isNaN)) continue;
    markers.push({
      lat: parts[0],
      lng: parts[1],
      title: e.title,
      slug: e.slug,
      kind: (e.properties && e.properties[iconProp]) || "",
    });
  }
  return markers;
}

// Compute the `<div class="bases-map">` data-* attributes the client script
// reads: the marker JSON, an optional pre-set centre (kept only if valid JSON),
// the zoom, and the style/marker-colour plugin options when provided.
export function mapDataAttributes(entries, view, options) {
  const opts = options || {};
  const v = view || {};
  let center = "";
  try {
    if (v.center) {
      JSON.parse(String(v.center));
      center = String(v.center);
    }
  } catch (e) {
    center = "";
  }
  const props = {
    class: "bases-map",
    "data-markers": JSON.stringify(buildMarkers(entries, v)),
    "data-center": center,
    "data-zoom": String(v.defaultZoom || v.minZoom || 14),
  };
  if (opts.styleUrl) props["data-style-url"] = String(opts.styleUrl);
  if (opts.markerColor) props["data-marker-color"] = String(opts.markerColor);
  return props;
}
