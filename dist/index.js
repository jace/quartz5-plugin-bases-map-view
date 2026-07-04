// Registers a "map" view type with bases-page's view registry, so a Base with a
// `type: map` view renders as an interactive MapLibre map (tab beside the table)
// on the published site — markers from each matched note's `coordinates`, click →
// the note's page. Uses the hosted TVC brand style; no vault dependency.
import { h } from "preact";
import { viewRegistry } from "../../bases-page/dist/registry.js";

const CSS =
  ".bases-map{height:70vh;min-height:360px;margin:1rem 0;border-radius:8px;overflow:hidden}";

const SCRIPT = `
document.addEventListener("nav", () => {
  document.querySelectorAll(".bases-map:not([data-init])").forEach((el) => {
    el.setAttribute("data-init", "1");
    const markers = JSON.parse(el.dataset.markers || "[]");
    let center = [77.647, 12.3503];
    let zoom = Number(el.dataset.zoom) || 14;
    try { const c = JSON.parse(el.dataset.center); if (Array.isArray(c)) center = [c[1], c[0]]; } catch (e) {}
    const dark = document.documentElement.getAttribute("saved-theme") === "dark";
    if (!document.getElementById("maplibre-css")) {
      const link = document.createElement("link");
      link.id = "maplibre-css"; link.rel = "stylesheet";
      link.href = "https://unpkg.com/maplibre-gl@4/dist/maplibre-gl.css";
      document.head.appendChild(link);
    }
    const boot = () => {
      const map = new maplibregl.Map({
        container: el,
        style: "https://docs.tvc.farm/static/map/tvc-base-" + (dark ? "dark" : "light") + ".json",
        center: center, zoom: zoom,
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }));
      map.on("load", () => {
        const fc = { type: "FeatureCollection", features: markers.map((m) => ({
          type: "Feature", properties: { title: m.title, slug: m.slug },
          geometry: { type: "Point", coordinates: [m.lng, m.lat] } })) };
        map.addSource("places", { type: "geojson", data: fc });
        map.addLayer({ id: "places", type: "circle", source: "places",
          paint: { "circle-radius": 6, "circle-color": "#18723c",
            "circle-stroke-width": 2, "circle-stroke-color": dark ? "#141613" : "#fbfaf6" } });
        map.addLayer({ id: "places-label", type: "symbol", source: "places",
          layout: { "text-field": ["get", "title"], "text-size": 11,
            "text-offset": [0, 1.3], "text-anchor": "top", "text-font": ["Noto Sans Regular"] },
          paint: { "text-color": dark ? "#dcd6c8" : "#37312a",
            "text-halo-color": dark ? "#141613" : "#fbfaf6", "text-halo-width": 1.5 } });
        map.on("click", "places", (e) => { location.href = e.features[0].properties.slug; });
        map.on("mouseenter", "places", () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", "places", () => { map.getCanvas().style.cursor = ""; });
      });
    };
    if (window.maplibregl) boot();
    else {
      const s = document.createElement("script");
      s.src = "https://unpkg.com/maplibre-gl@4/dist/maplibre-gl.js";
      s.onload = boot; document.head.appendChild(s);
    }
  });
});
`;

function render({ entries, view }) {
  const coordProp = String(view.coordinates || "note.coordinates").replace(/^note\./, "");
  const iconProp = String(view.markerIcon || "note.kind").replace(/^note\./, "");
  const markers = [];
  for (const e of entries || []) {
    const c = e.properties && e.properties[coordProp];
    if (typeof c !== "string" || !c.includes(",")) continue;
    const parts = c.split(",").map((x) => Number(x.trim()));
    if (parts.length !== 2 || parts.some(Number.isNaN)) continue;
    markers.push({
      lat: parts[0], lng: parts[1], title: e.title, slug: e.slug,
      kind: (e.properties && e.properties[iconProp]) || "",
    });
  }
  let center = "";
  try { if (view.center) { JSON.parse(String(view.center)); center = String(view.center); } } catch (e) {}
  return h("div", {
    class: "bases-map",
    "data-markers": JSON.stringify(markers),
    "data-center": center,
    "data-zoom": String(view.defaultZoom || view.minZoom || 14),
  });
}

viewRegistry.register({ id: "map", name: "Map", icon: "map", css: CSS, afterDOMLoaded: SCRIPT, render });

const BasesMapView = () => ({ name: "BasesMapView" });
export default BasesMapView;
