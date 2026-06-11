// Sidebar list rendering + detail editors for each entity type.

import { api } from "./api.js";
import * as state from "./state.js";
import * as mapc from "./map.js";
import { el, esc, fmt, toast, confirmAction, readPoint, makePoint } from "./util.js";
import { makeForm, row } from "./forms.js";

const VISIBILITY = ["visible", "hidden", "private"];

let afterWrite = () => {};
let activeEditor = null; // { kind, isNew, form }

export function init({ onWrite }) {
  afterWrite = onWrite || (() => {});
}

const listEl = () => document.getElementById("list");
const detailEl = () => document.getElementById("detail");
const filterText = () => (document.getElementById("filter").value || "").trim().toLowerCase();
const match = (s, q) => !q || String(s ?? "").toLowerCase().includes(q);

/* ============================ LIST RENDERING ============================== */

export function renderList() {
  const s = state.get();
  const q = filterText();
  const root = listEl();
  root.replaceChildren();

  if (s.loading && !mapc.getData()[s.tab]?.features?.length) {
    root.append(el("div", { class: "empty" }, [el("div", { class: "empty__hint", text: "Loading…" })]));
    return;
  }

  if (s.tab === "pois") return renderPois(root, q);
  if (s.tab === "itineraries") return renderItineraries(root, q);
  if (s.tab === "tags") return renderTags(root, q);
  if (s.tab === "experiences") return renderExperiences(root, q);
}

function renderPois(root, q) {
  const feats = (mapc.getData().pois.features || []).filter((f) => match(f.properties?.name, q));
  if (!feats.length)
    return root.append(
      emptyState("No places in view", "Pan or zoom the map to find your places — or press <kbd>New</kbd> and click the map to drop one.", "pin")
    );
  feats.sort((a, b) => (b.properties.relevance || 0) - (a.properties.relevance || 0));
  for (const f of feats) root.append(poiRow(f));
}

function poiThumb(p) {
  const isUrl = (s) => typeof s === "string" && /^https?:\/\//.test(s);
  if (isUrl(p.image)) return p.image;
  const g = p.gallery;
  if (Array.isArray(g) && g[0]?.img) return g[0].img;
  if (g && typeof g === "object" && g.img) return g.img;
  if (isUrl(p.icon)) return p.icon; // detail endpoint stores a real URL here
  return null;
}

function poiRow(f) {
  const p = f.properties;
  const pt = readPoint(f);
  const thumb = poiThumb(p);
  const icon = thumb
    ? el("img", { src: thumb, alt: "", onerror: (e) => (e.target.style.display = "none") })
    : "📍";
  const r = el("div", {
    class: "row" + (isSelected("poi", p.id) ? " is-selected" : ""),
    dataset: { kind: "poi", id: p.id },
    onclick: () => selectPoi(p.id, f),
  }, [
    el("div", { class: "row__icon" }, [icon]),
    el("div", { class: "row__body" }, [
      el("div", { class: "row__title", text: p.name || `POI ${p.id}` }),
      el("div", { class: "row__sub", text: pt ? `${fmt.coord(pt.lat)}, ${fmt.coord(pt.lon)}` : "no location" }),
    ]),
    p.highlight ? el("span", { class: "badge badge--star", text: "★" }) : null,
    el("span", { class: "badge", text: `r${p.relevance ?? "·"}` }),
  ]);
  return r;
}

function renderItineraries(root, q) {
  const feats = (mapc.getData().itineraries.features || []).filter((f) => match(f.properties?.name, q));
  if (!feats.length)
    return root.append(
      emptyState("No routes in view", "Routes for this workspace appear here. Pan the map, or create one with <kbd>New</kbd>.", "route")
    );
  for (const f of feats) root.append(itinRow(f));
}

function itinRow(f) {
  const p = f.properties;
  const len = p.length ? `${(+p.length).toFixed(1)} km` : "";
  const pois = Array.isArray(p.pois) ? `${p.pois.length} POIs` : "";
  return el("div", {
    class: "row" + (isSelected("itinerary", p.id) ? " is-selected" : ""),
    dataset: { kind: "itinerary", id: p.id },
    onclick: () => selectItinerary(p.id, f),
  }, [
    el("div", { class: "row__icon", html: `<span class="dash" style="background:${esc(p.color || "#1007a0")}"></span>` }),
    el("div", { class: "row__body" }, [
      el("div", { class: "row__title", text: p.name || `Route ${p.id}` }),
      el("div", { class: "row__sub", text: [pois, len, p.category].filter(Boolean).join(" · ") || "—" }),
    ]),
    p.visibility && p.visibility !== "visible" ? el("span", { class: "badge", text: p.visibility }) : null,
  ]);
}

function renderTags(root, q) {
  const tags = state.get().tags.filter((t) => match(t.name, q) || match(t.family, q));
  if (!tags.length)
    return root.append(emptyState("No tags yet", "Tags group and filter your places. Create your first with <kbd>New</kbd>.", "tag"));
  for (const t of tags) {
    root.append(el("div", {
      class: "row",
      onclick: () => openTagEditor(t),
    }, [
      el("div", { class: "row__icon", text: "#" }),
      el("div", { class: "row__body" }, [
        el("div", { class: "row__title", text: t.name }),
        el("div", { class: "row__sub", text: t.family || "—" }),
      ]),
      t.user_preference ? el("span", { class: "badge", text: "pref" }) : null,
      !t.visible ? el("span", { class: "badge", text: "hidden" }) : null,
    ]));
  }
}

function renderExperiences(root, q) {
  const exps = state.get().experiences.filter((e) => match(e.name, q));
  if (!exps.length)
    return root.append(emptyState("No experiences", "Bookable experiences for this workspace show up here once added.", "ticket"));
  for (const e of exps) {
    root.append(el("div", {
      class: "row",
      onclick: () => openExperienceEditor(e),
    }, [
      el("div", { class: "row__icon", text: e.is_package ? "📦" : "🎫" }),
      el("div", { class: "row__body" }, [
        el("div", { class: "row__title", text: e.name || `Experience ${e.id}` }),
        el("div", { class: "row__sub", text: fmt.truncate(e.description, 60) || "—" }),
      ]),
      el("span", { class: "badge", text: `€${e.price ?? 0}` }),
      !e.active ? el("span", { class: "badge badge--off", text: "off" }) : null,
    ]));
  }
}

const EMPTY_ART = {
  pin: '<svg viewBox="0 0 48 48" width="46" height="46" stroke-width="2"><path d="M24 4c-7 0-12 5-12 12 0 9 12 24 12 24s12-15 12-24c0-7-5-12-12-12Z"/><circle cx="24" cy="16" r="4"/></svg>',
  route: '<svg viewBox="0 0 48 48" width="46" height="46" stroke-width="2"><path d="M10 38c8 0 8-22 18-22s10 14 10 14" stroke-linecap="round"/><circle cx="10" cy="38" r="3.5"/><circle cx="38" cy="30" r="3.5"/></svg>',
  tag: '<svg viewBox="0 0 48 48" width="46" height="46" stroke-width="2"><path d="M6 22V8h14l22 22-14 14L6 22Z" stroke-linejoin="round"/><circle cx="15" cy="15" r="2.5"/></svg>',
  ticket: '<svg viewBox="0 0 48 48" width="46" height="46" stroke-width="2"><path d="M8 14h32v8a4 4 0 0 0 0 8v4H8v-4a4 4 0 0 0 0-8v-8Z" stroke-linejoin="round"/><path d="M28 14v20" stroke-dasharray="2 4"/></svg>',
};

function emptyState(title, hintHtml, art) {
  return el("div", { class: "empty" }, [
    art ? el("div", { class: "empty__art", html: EMPTY_ART[art] || "" }) : null,
    el("div", { class: "empty__title", text: title }),
    el("div", { class: "empty__hint", html: hintHtml }),
  ]);
}
const isSelected = (kind, id) => {
  const sel = state.get().selection;
  return sel && sel.kind === kind && String(sel.id) === String(id);
};

/* ============================ SELECTION =================================== */

export async function selectPoi(id, feature) {
  state.set({ selection: { kind: "poi", id } });
  mapc.setSelected("poi", id);
  if (feature?.geometry) mapc.flyToFeature(feature.geometry);
  renderList();
  let data = feature?.properties || {};
  try {
    data = { ...(await api.pois.get(id)), ...{} };
  } catch (e) {
    toast(`Could not load full POI: ${e.message}`, "error");
  }
  openPoiEditor(data, feature);
}

export async function selectItinerary(id, feature) {
  state.set({ selection: { kind: "itinerary", id } });
  mapc.setSelected("itinerary", id);
  if (feature?.geometry) mapc.flyToFeature(feature.geometry);
  renderList();
  let data = feature?.properties || {};
  try {
    data = await api.itineraries.get(id);
  } catch (e) {
    toast(`Could not load itinerary: ${e.message}`, "error");
  }
  openItineraryEditor(data, feature);
}

/* ============================ EDITOR SHELL =============================== */

function openEditor({ eyebrow, title, kind, isNew, body, onSave, onDelete }) {
  activeEditor = { kind, isNew };
  const detail = detailEl();
  detail.hidden = false;

  const saveBtn = el("button", { class: "btn btn--primary", text: isNew ? "Create" : "Save changes" });
  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";
    try {
      await onSave();
      toast(isNew ? "Created" : "Saved", "ok");
      closeDetail();
      await afterWrite();
    } catch (e) {
      toast(e.message, "error");
      saveBtn.disabled = false;
      saveBtn.textContent = isNew ? "Create" : "Save changes";
    }
  });

  const deleteBtn = !isNew && onDelete
    ? el("button", {
        class: "btn btn--danger",
        text: "Delete",
        onclick: async () => {
          if (!(await confirmAction(`Delete this ${kind}? This can't be undone.`))) return;
          try {
            await onDelete();
            toast("Deleted", "ok");
            closeDetail();
            await afterWrite();
          } catch (e) {
            toast(e.message, "error");
          }
        },
      })
    : null;

  const head = el("div", { class: "detail__head" }, [
    el("div", {}, [
      el("div", { class: "detail__eyebrow", text: eyebrow }),
      el("h2", { class: "detail__title", text: title }),
    ]),
    el("button", { class: "iconbtn detail__close", text: "✕", title: "Close editor", "aria-label": "Close editor", onclick: closeDetail }),
  ]);

  const foot = el("div", { class: "detail__foot" }, [
    deleteBtn,
    el("div", { class: "spacer" }),
    el("button", { class: "btn btn--ghost", text: "Cancel", onclick: closeDetail }),
    saveBtn,
  ]);

  detail.replaceChildren(head, el("div", { class: "detail__body" }, body), foot);
}

export function closeDetail() {
  detailEl().hidden = true;
  detailEl().replaceChildren();
  mapc.hideEditMarker();
  activeEditor = null;
  activeCoords = null;
  state.set({ selection: null, createMode: false });
  mapc.setSelected(null);
  document.getElementById("map-hint").hidden = true;
  renderList();
}

/* ============================ POI EDITOR ================================= */

function openPoiEditor(data, feature) {
  const draft = { ...data };
  draft.owner = draft.owner || state.get().owner;
  // Normalise tag ids -> names so the picker matches and we submit strings.
  draft.tags = normaliseTagNames(draft.tags);

  const pt = readPoint(data) || readPoint(feature) || (feature?.geometry?.coordinates
    ? { lon: feature.geometry.coordinates[0], lat: feature.geometry.coordinates[1] }
    : null);
  if (pt) draft.location = makePoint(pt.lon, pt.lat);

  const isNew = data.id == null;
  const form = makeForm(draft);

  // lat/lon are derived fields that rewrite draft.location.
  const latInput = el("input", { type: "number", step: "any", value: pt ? pt.lat : "" });
  const lonInput = el("input", { type: "number", step: "any", value: pt ? pt.lon : "" });

  const onMarkerDrag = (lng, lat) => {
    latInput.value = lat.toFixed(6);
    lonInput.value = lng.toFixed(6);
    draft.location = makePoint(lng, lat);
    form.refreshRaw();
  };
  const syncLocation = (fly = true) => {
    const lat = parseFloat(latInput.value), lon = parseFloat(lonInput.value);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      draft.location = makePoint(lon, lat);
      form.refreshRaw();
      mapc.ensureEditMarker(lon, lat, onMarkerDrag);
      if (fly) mapc.flyToLngLat(lon, lat, 15);
      document.getElementById("map-hint").hidden = true;
    }
  };
  latInput.addEventListener("input", () => syncLocation(false));
  lonInput.addEventListener("input", () => syncLocation(false));

  // Expose to the map-click create flow.
  activeCoords = { latInput, lonInput, set: onMarkerDrag };

  if (pt) mapc.showEditMarker(pt.lon, pt.lat, onMarkerDrag);
  else showHint("Click the map to drop this place");

  const body = [
    form.text("name", "Name", { placeholder: "e.g. Piazza del Duomo" }),
    field2("Latitude", latInput, "Longitude", lonInput),
    el("div", { class: "coord-note", text: "Drag the marker on the map, or type coordinates above." }),
    row(form.number("radius", "Radius (m)", { min: 0 }), form.number("relevance", "Relevance", { min: 0, max: 100 })),
    form.textarea("description", "Description", { rows: 4, placeholder: "What makes this place worth a stop?" }),
    form.text("icon", "Icon URL", { type: "url" }),
    form.text("video", "Video URL", { type: "url" }),
    form.tags("tags", "Tags", state.get().tags, { byId: false, hint: "Saved as tag names." }),
    row(form.check("highlight", "Feature this place"), form.check("audio_guide", "Audio guide")),
    form.rawJson(),
  ];

  openEditor({
    eyebrow: isNew ? "New place" : "Place",
    title: isNew ? "Add a place" : data.name || `Place ${data.id}`,
    kind: "place",
    isNew,
    body,
    onSave: async () => {
      if (!draft.name) throw new Error("Name is required");
      if (!draft.location || !draft.location.coordinates) throw new Error("Location is required — set coordinates");
      if (isNew) await api.pois.create(draft);
      else await api.pois.update(data.id, draft);
    },
    onDelete: isNew ? null : () => api.pois.remove(data.id),
  });
}

let activeCoords = null;

// Called by app when the user clicks the map (create flow).
export function placePoint(lngLat) {
  if (activeEditor?.kind === "poi" && activeCoords) {
    activeCoords.set(lngLat.lng, lngLat.lat);
    mapc.ensureEditMarker(lngLat.lng, lngLat.lat, activeCoords.set);
    document.getElementById("map-hint").hidden = true;
  } else {
    state.set({ selection: null });
    openPoiEditor(
      { name: "", radius: 30, relevance: 5 },
      { geometry: { type: "Point", coordinates: [lngLat.lng, lngLat.lat] } }
    );
  }
}

/* ============================ ITINERARY EDITOR =========================== */

function openItineraryEditor(data, feature) {
  const draft = { ...data };
  draft.owner = draft.owner || state.get().owner;
  draft.pois = Array.isArray(draft.pois) ? draft.pois : [];
  draft.experiences = Array.isArray(draft.experiences) ? draft.experiences : [];
  draft.tags = Array.isArray(draft.tags) ? draft.tags : [];

  const isNew = data.id == null;
  const form = makeForm(draft);

  const poiCount = draft.pois.length;
  const coords = feature?.geometry?.coordinates?.length;

  const body = [
    form.text("name", "Name"),
    row(form.text("category", "Category"), form.text("color", "Color (hex)")),
    form.select("visibility", "Visibility", VISIBILITY, { default: "visible" }),
    form.textarea("description_abstract", "Abstract", { rows: 2 }),
    form.textarea("description", "Description", { rows: 4 }),
    form.textarea("markdown", "Markdown", { rows: 4, code: true }),
    row(form.number("length", "Length (km)"), form.text("total_duration", "Total duration")),
    row(form.check("directed", "Directed"), form.check("require_booking", "Require booking")),
    row(form.check("do_nearby", "Do nearby"), form.check("visible", "Visible")),
    el("div", { class: "field-hint", text: `${poiCount} stop${poiCount === 1 ? "" : "s"}${coords ? ` · route drawn with ${coords} points` : ""}. Edit stops & geometry in the raw payload below.` }),
    form.rawJson(),
  ];

  openEditor({
    eyebrow: isNew ? "New route" : "Route",
    title: isNew ? "Add a route" : data.name || `Route ${data.id}`,
    kind: "route",
    isNew,
    body,
    onSave: async () => {
      if (!draft.name) throw new Error("Name is required");
      if (isNew) await api.itineraries.create(draft);
      else await api.itineraries.update(data.id, draft);
    },
    onDelete: isNew ? null : () => api.itineraries.remove(data.id),
  });
}

/* ============================ TAG EDITOR ================================= */

function openTagEditor(data) {
  const draft = { ...data };
  const isNew = data.id == null;
  const form = makeForm(draft);
  const parentOptions = [{ value: "", label: "— none —" }, ...state.get().tags
    .filter((t) => t.id !== data.id)
    .map((t) => ({ value: t.id, label: `${t.name} (${t.id})` }))];

  const body = [
    form.text("name", "Name"),
    form.text("family", "Family"),
    form.select("parent_id", "Parent tag", parentOptions),
    row(form.check("visible", "Visible"), form.check("user_preference", "User preference")),
    form.rawJson(),
  ];

  openEditor({
    eyebrow: isNew ? "New tag" : "Tag",
    title: isNew ? "Add a tag" : data.name,
    kind: "tag",
    isNew,
    body,
    onSave: async () => {
      if (!draft.name) throw new Error("Name is required");
      if (draft.parent_id === "" || draft.parent_id == null) delete draft.parent_id;
      else draft.parent_id = Number(draft.parent_id);
      if (isNew) await api.tags.create(draft);
      else await api.tags.update(data.id, draft);
    },
    onDelete: isNew ? null : () => api.tags.remove(data.id),
  });
}

/* ============================ EXPERIENCE EDITOR ========================== */

function openExperienceEditor(data) {
  const draft = { ...data };
  draft.owner = draft.owner || state.get().owner;
  draft.pois = Array.isArray(draft.pois) ? draft.pois : [];
  draft.tags = Array.isArray(draft.tags) ? draft.tags : [];
  draft.cross_selling = Array.isArray(draft.cross_selling) ? draft.cross_selling : [];

  const isNew = data.id == null;
  const form = makeForm(draft);

  const body = [
    form.text("name", "Name"),
    form.textarea("description", "Description", { rows: 4 }),
    row(form.number("price", "Price"), form.text("duration", "Duration")),
    form.text("reference_email", "Reference email"),
    row(form.check("active", "Active"), form.check("listed", "Listed")),
    row(form.check("requires_confirmation", "Requires confirmation"), form.check("can_be_annotated", "Annotatable")),
    form.check("is_package", "Is package"),
    form.rawJson(),
  ];

  openEditor({
    eyebrow: isNew ? "New experience" : "Experience",
    title: isNew ? "Add an experience" : data.name || `Experience ${data.id}`,
    kind: "experience",
    isNew,
    body,
    onSave: async () => {
      if (isNew) await api.experiences.create(draft);
      else await api.experiences.update(data.id, draft);
    },
    onDelete: isNew ? null : () => api.experiences.remove(data.id),
  });
}

/* ============================ CREATE DISPATCH ============================ */

export function startCreate() {
  const tab = state.get().tab;
  closeDetail();
  if (tab === "pois") {
    state.set({ createMode: true });
    openPoiEditor({ name: "", radius: 30, relevance: 5 }, null);
  } else if (tab === "itineraries") {
    openItineraryEditor({ name: "", color: "#1007a0", visibility: "visible", directed: true }, null);
  } else if (tab === "tags") {
    openTagEditor({ name: "", visible: true });
  } else if (tab === "experiences") {
    openExperienceEditor({ name: "", price: 0, active: true, listed: true });
  }
}

/* ============================ helpers ==================================== */

function normaliseTagNames(tags) {
  if (!Array.isArray(tags)) return [];
  const byId = new Map(state.get().tags.map((t) => [t.id, t.name]));
  return tags.map((t) => (typeof t === "number" ? byId.get(t) || String(t) : t)).filter(Boolean);
}

function field2(labelA, inputA, labelB, inputB) {
  return el("div", { class: "field--row" }, [
    el("div", { class: "field" }, [el("label", { text: labelA }), inputA]),
    el("div", { class: "field" }, [el("label", { text: labelB }), inputB]),
  ]);
}

function showHint(text) {
  const h = document.getElementById("map-hint");
  h.textContent = text;
  h.hidden = false;
}
