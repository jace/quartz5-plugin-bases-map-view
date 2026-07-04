import { describe, it, expect } from "vitest";
import { buildMarkers, mapDataAttributes } from "../dist/markers.js";

const entry = (coordinates, extra = {}) => ({
  title: "Place",
  slug: "places/place",
  properties: { coordinates, kind: "house", ...extra },
});

describe("buildMarkers", () => {
  it("parses a 'lat, lng' coordinate into a marker", () => {
    expect(buildMarkers([entry("12.34, 77.65")], {})).toEqual([
      { lat: 12.34, lng: 77.65, title: "Place", slug: "places/place", kind: "house" },
    ]);
  });

  it("skips entries with a missing or malformed coordinate", () => {
    const entries = [
      { title: "A", slug: "a", properties: {} }, // absent
      { title: "B", slug: "b", properties: { coordinates: "no-comma" } }, // no comma
      { title: "C", slug: "c", properties: { coordinates: "12.3, x" } }, // NaN part
      { title: "D", slug: "d", properties: { coordinates: "1, 2, 3" } }, // 3 parts
      { title: "E", slug: "e", properties: { coordinates: "1, 2" } }, // valid
    ];
    expect(buildMarkers(entries, {}).map((m) => m.slug)).toEqual(["e"]);
  });

  it("returns [] when there are no entries", () => {
    expect(buildMarkers(undefined, {})).toEqual([]);
    expect(buildMarkers([], {})).toEqual([]);
  });

  it("resolves note.-prefixed and bare coordinate/icon property names", () => {
    const e = { title: "P", slug: "p", properties: { coordinates: "1,2", kind: "mast" } };
    expect(buildMarkers([e], { coordinates: "note.coordinates", markerIcon: "note.kind" })[0].kind).toBe("mast");
    expect(buildMarkers([e], { coordinates: "coordinates", markerIcon: "kind" })[0].lat).toBe(1);
  });

  it("reads coordinates from a custom property when configured", () => {
    const e = { title: "P", slug: "p", properties: { loc: "3, 4" } };
    expect(buildMarkers([e], { coordinates: "loc" })).toEqual([
      { lat: 3, lng: 4, title: "P", slug: "p", kind: "" },
    ]);
  });

  it("defaults kind to an empty string when the icon property is absent", () => {
    const e = { title: "P", slug: "p", properties: { coordinates: "1,2" } };
    expect(buildMarkers([e], {})[0].kind).toBe("");
  });
});

describe("mapDataAttributes", () => {
  it("emits the container class, marker JSON, and zoom", () => {
    const props = mapDataAttributes([entry("1,2")], { defaultZoom: 15 }, {});
    expect(props.class).toBe("bases-map");
    expect(JSON.parse(props["data-markers"])).toHaveLength(1);
    expect(props["data-zoom"]).toBe("15");
  });

  it("keeps a valid JSON center and drops an invalid one", () => {
    expect(mapDataAttributes([], { center: "[12.3, 77.6]" }, {})["data-center"]).toBe("[12.3, 77.6]");
    expect(mapDataAttributes([], { center: "not-json" }, {})["data-center"]).toBe("");
  });

  it("falls back zoom from defaultZoom → minZoom → 14", () => {
    expect(mapDataAttributes([], { minZoom: 12 }, {})["data-zoom"]).toBe("12");
    expect(mapDataAttributes([], {}, {})["data-zoom"]).toBe("14");
  });

  it("includes style/marker-colour attributes only when the options are set", () => {
    const withOpts = mapDataAttributes([], {}, { styleUrl: "u", markerColor: "#123456" });
    expect(withOpts["data-style-url"]).toBe("u");
    expect(withOpts["data-marker-color"]).toBe("#123456");
    const without = mapDataAttributes([], {}, {});
    expect("data-style-url" in without).toBe(false);
    expect("data-marker-color" in without).toBe(false);
  });
});
