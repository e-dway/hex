// MapLibre map: renders POIs (points) and itineraries (lines) for the active
// owner, reloading from the *.geojson endpoints whenever the viewport changes.

import { api } from "./api.js";
import { get } from "./state.js";
import { readPoint } from "./util.js";

const FLORENCE = { center: [11.2553, 43.7696], zoom: 12 };

// Brand palette per theme — magenta places, indigo routes, amber featured.
const PALETTE = {
  light: { poi: "#ff007a", featured: "#e8920a", line: "#1007a0", selStroke: "#1007a0", poiStroke: "#ffffff", marker: "#1007a0" },
  dark:  { poi: "#ff3d97", featured: "#f5b53d", line: "#7c8cff", selStroke: "#ffffff", poiStroke: "#1a1438", marker: "#7c8cff" },
};

// Key-free CARTO raster basemap; light = Positron, dark = Dark Matter.
function buildBaseStyle(mode) {
  const slug = mode === "dark" ? "dark_all" : "light_all";
  return {
    version: 8,
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: {
      base: {
        type: "raster",
        tiles: ["a", "b", "c"].map((s) => `https://${s}.basemaps.cartocdn.com/${slug}/{z}/{x}/{y}@2x.png`),
        tileSize: 256,
        attribution: "© OpenStreetMap contributors © CARTO",
      },
    },
    layers: [{ id: "base", type: "raster", source: "base" }],
  };
}

const EMPTY = { type: "FeatureCollection", features: [] };

let map;
let cb = {};
let reloadTimer;
let selected = null; // { kind, id }
let lastData = { pois: EMPTY, itineraries: EMPTY };
let theme = "light";
let hoverPopup;

export function initMap(callbacks = {}, mode = "light") {
  cb = callbacks;
  theme = mode;
  map = new maplibregl.Map({
    container: "map",
    style: buildBaseStyle(mode),
    ...FLORENCE,
    attributionControl: { compact: true },
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
  map.addControl(new maplibregl.ScaleControl({ maxWidth: 120 }), "bottom-right");
  hoverPopup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 14 });

  map.on("load", () => {
    console.log("[hex] map load fired");
    installLayers();
    wireInteractions();
    reload("load");
  });

  map.on("moveend", () => scheduleReload("moveend"));
  map.on("error", (e) => {
    console.error("[map]", e.error?.message || e.error || e);
    cb.onMapError?.(e.error);
  });
}

// (Re)create the data sources + layers for the current theme. Called on first
// load and again after a basemap (theme) swap, which discards custom layers.
function installLayers() {
  const c = PALETTE[theme];
  if (!map.getSource("itineraries")) map.addSource("itineraries", { type: "geojson", data: lastData.itineraries, promoteId: "id" });
  if (!map.getSource("pois")) map.addSource("pois", { type: "geojson", data: lastData.pois, promoteId: "id" });

  map.addLayer({
    id: "itin-casing",
    type: "line",
    source: "itineraries",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": theme === "dark" ? "#000000" : "#ffffff",
      "line-opacity": 0.5,
      "line-width": ["case", ["boolean", ["feature-state", "selected"], false], 9, 6],
    },
  });
  map.addLayer({
    id: "itin-line",
    type: "line",
    source: "itineraries",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": ["coalesce", ["get", "color"], c.line],
      "line-width": ["case", ["boolean", ["feature-state", "selected"], false], 5.5, 3],
      "line-opacity": 0.95,
    },
  });

  map.addLayer({
    id: "poi-halo",
    type: "circle",
    source: "pois",
    paint: {
      "circle-radius": ["case", ["boolean", ["feature-state", "selected"], false], 22, 0],
      "circle-color": c.poi,
      "circle-opacity": 0.16,
    },
  });
  map.addLayer({
    id: "poi-dot",
    type: "circle",
    source: "pois",
    paint: {
      "circle-radius": [
        "interpolate", ["linear"], ["zoom"],
        9, ["case", ["boolean", ["feature-state", "selected"], false], 9, 5],
        16, ["case", ["boolean", ["feature-state", "selected"], false], 15, 8],
      ],
      "circle-color": ["case", ["to-boolean", ["get", "highlight"]], c.featured, c.poi],
      "circle-stroke-color": ["case", ["boolean", ["feature-state", "selected"], false], c.selStroke, c.poiStroke],
      "circle-stroke-width": ["case", ["boolean", ["feature-state", "selected"], false], 3, 1.5],
    },
  });
  reapplySelection();
}

// Swap basemap + layers for a new theme, preserving data + selection.
export function setTheme(mode) {
  if (!map || mode === theme) return;
  theme = mode;
  map.setStyle(buildBaseStyle(mode));
  // setStyle drops custom sources/layers; re-add once the new style is ready.
  const onStyle = () => {
    if (!map.isStyleLoaded()) return;
    map.off("styledata", onStyle);
    installLayers();
  };
  map.on("styledata", onStyle);
}

function wireInteractions() {
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  map.on("mousemove", "poi-dot", (e) => {
    map.getCanvas().style.cursor = "pointer";
    const p = e.features[0].properties;
    const sub = p.highlight ? "Featured place" : "Place";
    hoverPopup
      .setLngLat(e.features[0].geometry.coordinates)
      .setHTML(`<strong>${esc(p.name || "Place")}</strong><div class="popup-sub">${sub}</div>`)
      .addTo(map);
  });
  map.on("mousemove", "itin-line", (e) => {
    if (map.queryRenderedFeatures(e.point, { layers: ["poi-dot"] }).length) return;
    map.getCanvas().style.cursor = "pointer";
    const p = e.features[0].properties;
    const stops = Array.isArray(p.pois) ? p.pois.length : null;
    hoverPopup
      .setLngLat(e.lngLat)
      .setHTML(`<strong>${esc(p.name || "Route")}</strong><div class="popup-sub">Route${stops != null ? ` · ${stops} stops` : ""}</div>`)
      .addTo(map);
  });
  for (const layer of ["poi-dot", "itin-line"]) {
    map.on("mouseleave", layer, () => {
      map.getCanvas().style.cursor = get().createMode ? "crosshair" : "";
      hoverPopup.remove();
    });
  }

  map.on("click", "poi-dot", (e) => {
    e.preventDefault();
    const f = e.features[0];
    cb.onSelectPoi?.(f.properties.id, f);
  });

  map.on("click", "itin-line", (e) => {
    if (e.defaultPrevented) return;
    const f = e.features[0];
    cb.onSelectItinerary?.(f.properties.id, f);
  });

  // Bare-map clicks: drop a new POI in create mode, otherwise clear selection.
  map.on("click", (e) => {
    if (e.defaultPrevented) return;
    const hits = map.queryRenderedFeatures(e.point, { layers: ["poi-dot", "itin-line"] });
    if (hits.length) return;
    if (get().createMode) cb.onCreatePoint?.(e.lngLat);
    else cb.onClearSelection?.();
  });
}

function scheduleReload(why) {
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => reload(why), 300);
}

function currentBbox() {
  const b = map.getBounds();
  return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
}

let reloadSeq = 0;

export async function reload(why = "manual") {
  if (!map || !map.isStyleLoaded()) return;
  const seq = ++reloadSeq;
  const owner = get().owner;
  const bbox = currentBbox();
  if (bbox.some((n) => !Number.isFinite(n))) {
    console.warn("[hex] reload skipped — map has no size yet (bbox NaN)");
    return; // a later moveend retries with a valid bbox
  }
  cb.onLoading?.(true);
  try {
    const [pois, itins] = await Promise.allSettled([
      api.pois.geojson(bbox, owner),
      api.itineraries.geojson(bbox, owner),
    ]);
    // Ignore stale responses so an older/empty reload can't clobber newer data.
    if (seq !== reloadSeq) return;
    // Keep previous data for any leg that failed rather than blanking the view.
    const poiData = pois.status === "fulfilled" ? normalizeFC(pois.value) : lastData.pois;
    const itinData = itins.status === "fulfilled" ? normalizeFC(itins.value) : lastData.itineraries;
    const errs = [pois, itins].filter((r) => r.status === "rejected").map((r) => r.reason);
    console.log(`[hex] reload(${why}) owner=${owner} → places=${poiData.features.length} routes=${itinData.features.length}${errs.length ? ` errors: ${errs.map((e) => e.message).join(" | ")}` : ""}`);
    lastData = { pois: poiData, itineraries: itinData };
    map.getSource("pois")?.setData(poiData);
    map.getSource("itineraries")?.setData(itinData);
    reapplySelection();
    cb.onData?.({ pois: poiData, itineraries: itinData });
    cb.onLoading?.(false, errs);
  } catch (err) {
    console.error("[hex] reload failed", err);
    cb.onLoading?.(false, [err]);
  }
}

export function getData() {
  return lastData;
}

// Guard against the API returning a non-FeatureCollection (e.g. a traceback
// that slipped through) so layers never receive malformed data.
function normalizeFC(d) {
  if (d && d.type === "FeatureCollection" && Array.isArray(d.features)) return d;
  return EMPTY;
}

function reapplySelection() {
  if (selected) setSelected(selected.kind, selected.id);
}

export function setSelected(kind, id) {
  // Clear previous.
  if (selected) {
    const src = selected.kind === "poi" ? "pois" : "itineraries";
    try { map.setFeatureState({ source: src, id: selected.id }, { selected: false }); } catch {}
  }
  selected = id == null ? null : { kind, id };
  if (!selected) return;
  const src = kind === "poi" ? "pois" : "itineraries";
  try { map.setFeatureState({ source: src, id }, { selected: true }); } catch {}
}

export function flyToFeature(geometry) {
  if (!geometry) return;
  if (geometry.type === "Point") {
    map.flyTo({ center: geometry.coordinates, zoom: Math.max(map.getZoom(), 14), speed: 1.4 });
  } else if (geometry.type === "LineString" && geometry.coordinates.length) {
    const lons = geometry.coordinates.map((c) => c[0]);
    const lats = geometry.coordinates.map((c) => c[1]);
    map.fitBounds(
      [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]],
      { padding: 80, maxZoom: 15, duration: 800 }
    );
  }
}

export function flyToLngLat(lon, lat, zoom = 15) {
  map.flyTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), zoom), speed: 1.4 });
}

export function setCreateMode(on) {
  if (map) map.getCanvas().style.cursor = on ? "crosshair" : "";
}

// A draggable marker used while creating/editing a POI position.
let editMarker;
export function showEditMarker(lon, lat, onDragEnd) {
  hideEditMarker();
  editMarker = new maplibregl.Marker({ color: PALETTE[theme].marker, draggable: true })
    .setLngLat([lon, lat])
    .addTo(map);
  editMarker.on("dragend", () => {
    const { lng, lat } = editMarker.getLngLat();
    onDragEnd?.(lng, lat);
  });
  return editMarker;
}
export function moveEditMarker(lon, lat) {
  if (editMarker) {
    editMarker.setLngLat([lon, lat]);
    return true;
  }
  return false;
}

// Move existing marker or create one if absent.
export function ensureEditMarker(lon, lat, onDragEnd) {
  if (!moveEditMarker(lon, lat)) showEditMarker(lon, lat, onDragEnd);
}
export function hideEditMarker() {
  if (editMarker) { editMarker.remove(); editMarker = null; }
}

export { readPoint };
