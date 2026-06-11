// Small DOM + data helpers shared across panels.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (k === "dataset") Object.assign(node.dataset, v);
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// POI geometry comes back as a real GeoJSON geometry in the .geojson endpoint,
// but the detail endpoint stores it as a JSON *string* in `point`. Normalise both.
export function readPoint(obj) {
  const candidates = [obj?.geometry, obj?.point, obj?.location];
  for (let c of candidates) {
    if (!c) continue;
    if (typeof c === "string") {
      try {
        c = JSON.parse(c);
      } catch {
        continue;
      }
    }
    if (c?.type === "Point" && Array.isArray(c.coordinates) && c.coordinates.length >= 2) {
      return { lon: +c.coordinates[0], lat: +c.coordinates[1] };
    }
    if (typeof c?.lon === "number" && typeof c?.lat === "number") return { lon: c.lon, lat: c.lat };
    if (typeof c?.lng === "number" && typeof c?.lat === "number") return { lon: c.lng, lat: c.lat };
  }
  return null;
}

// Build the GeoJSON Point object the API stores for a POI location.
export const makePoint = (lon, lat) => ({ type: "Point", coordinates: [+lon, +lat] });

let toastTimer;
export function toast(message, kind = "info") {
  let box = $("#toast");
  if (!box) {
    box = el("div", { id: "toast" });
    document.body.append(box);
  }
  box.className = `toast toast--${kind}`;
  box.textContent = message;
  box.classList.add("toast--show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.remove("toast--show"), 4200);
}

export async function confirmAction(message) {
  return window.confirm(message);
}

export const fmt = {
  coord: (n) => (n == null ? "—" : Number(n).toFixed(5)),
  truncate: (s, n = 90) => (s && s.length > n ? s.slice(0, n - 1) + "…" : s || ""),
};
