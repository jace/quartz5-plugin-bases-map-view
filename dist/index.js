// Registers a "map" view type with bases-page's view registry, so a Base with a
// `type: map` view renders as an interactive MapLibre map (tab beside the table),
// markers from each matched note's `coordinates`, click → the note's page.
//
// Brand-agnostic: the map style and marker colour come from plugin options
// (`styleUrl`, `markerColor`), so no site-specific values are baked in. `styleUrl`
// may contain `{mode}`, replaced with `light`/`dark` from Quartz's theme.
import { h } from "preact";
import { viewRegistry } from "../../bases-page/dist/registry.js";
import { mapDataAttributes } from "./markers.js";

const CSS =
  ".bases-map{height:70vh;min-height:360px;margin:1rem 0;border-radius:8px;overflow:hidden}";

const DEFAULT_STYLE = "https://tiles.openfreemap.org/styles/liberty";

const SCRIPT = `
document.addEventListener("nav", () => {
  const isDark = () => document.documentElement.getAttribute("saved-theme") === "dark";
  const styleFor = (el) => (el.dataset.styleUrl || "${DEFAULT_STYLE}").replace("{mode}", isDark() ? "dark" : "light");
  document.querySelectorAll(".bases-map:not([data-init])").forEach((el) => {
    el.setAttribute("data-init", "1");
    const markers = JSON.parse(el.dataset.markers || "[]");
    const markerColor = el.dataset.markerColor || "#2563eb";
    let center = null, zoom = Number(el.dataset.zoom) || 14;
    try { const c = JSON.parse(el.dataset.center); if (Array.isArray(c)) center = [c[1], c[0]]; } catch (e) {}
    const feats = markers.map((m) => ({
      type: "Feature", properties: { title: m.title, slug: m.slug },
      geometry: { type: "Point", coordinates: [m.lng, m.lat] } }));
    // (Re)adds the marker source + layers, recolouring label text/halo for the
    // current theme. Called on first load and again after each style swap
    // (setStyle wipes custom sources/layers), so it stays idempotent.
    const addPlaces = (map) => {
      const textColor = isDark() ? "#e6e6e6" : "#333333";
      const haloColor = isDark() ? "#1a1a1a" : "#ffffff";
      if (!map.getSource("places")) map.addSource("places", { type: "geojson", data: { type: "FeatureCollection", features: feats } });
      if (!map.getLayer("places")) map.addLayer({ id: "places", type: "circle", source: "places",
        paint: { "circle-radius": 6, "circle-color": markerColor, "circle-stroke-width": 2, "circle-stroke-color": haloColor } });
      if (!map.getLayer("places-label")) map.addLayer({ id: "places-label", type: "symbol", source: "places",
        layout: { "text-field": ["get", "title"], "text-size": 11, "text-offset": [0, 1.3], "text-anchor": "top", "text-font": ["Noto Sans Regular"] },
        paint: { "text-color": textColor, "text-halo-color": haloColor, "text-halo-width": 1.5 } });
    };
    if (!document.getElementById("maplibre-css")) {
      const link = document.createElement("link");
      link.id = "maplibre-css"; link.rel = "stylesheet";
      link.href = "https://unpkg.com/maplibre-gl@4/dist/maplibre-gl.css";
      document.head.appendChild(link);
    }
    const boot = () => {
      const map = new maplibregl.Map({
        container: el, style: styleFor(el),
        center: center || [0, 0], zoom: center ? zoom : 1,
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }));
      // Layer-scoped handlers bind by layer id, so registering once survives style swaps.
      map.on("click", "places", (e) => { const s = e.features[0].properties.slug; location.href = s.charAt(0) === "/" ? s : "/" + s; });
      map.on("mouseenter", "places", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "places", () => { map.getCanvas().style.cursor = ""; });
      map.on("load", () => {
        addPlaces(map);
        if (!center && feats.length) {
          const b = new maplibregl.LngLatBounds();
          feats.forEach((f) => b.extend(f.geometry.coordinates));
          map.fitBounds(b, { padding: 40, maxZoom: 16, duration: 0 });
        }
      });
      // Follow Quartz's light/dark toggle live: swap the base style, then re-add
      // the markers once the new style has loaded (setStyle clears custom layers).
      const onTheme = () => { map.setStyle(styleFor(el)); map.once("styledata", () => addPlaces(map)); };
      document.addEventListener("themechange", onTheme);
      if (window.addCleanup) window.addCleanup(() => { document.removeEventListener("themechange", onTheme); map.remove(); });
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

// The <div class="bases-map"> the client script hydrates. All data-* attribute
// logic lives in ./markers.js so it's unit-testable without preact/registry.
function render({ entries, view, options }) {
  return h("div", mapDataAttributes(entries, view, options));
}

// Register in the factory so the plugin's config options reach the renderer via
// ViewRendererProps.options. htmlPlugins keeps it a valid (no-op) transformer.
const BasesMapView = (opts) => {
  viewRegistry.register({
    id: "map", name: "Map", icon: "map",
    css: CSS, afterDOMLoaded: SCRIPT, options: opts || {}, render,
  });
  return { name: "BasesMapView", htmlPlugins: () => [] };
};
export default BasesMapView;
