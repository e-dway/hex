// Application bootstrap: wires the topbar, theme, tabs, map and panels together.

import { api } from "./api.js";
import * as state from "./state.js";
import * as mapc from "./map.js";
import * as panels from "./panels.js";
import { toast } from "./util.js";

const $ = (id) => document.getElementById(id);

// Surface any uncaught error visibly — partners won't have DevTools open, and
// it tells us immediately if something fails to initialise.
function showFatal(msg) {
  console.error("[hex fatal]", msg);
  try { toast(String(msg).slice(0, 200), "error"); } catch {}
}
addEventListener("error", (e) => showFatal(`${e.message} @ ${(e.filename || "").split("/").pop()}:${e.lineno}`));
addEventListener("unhandledrejection", (e) => showFatal(`Promise: ${e.reason?.message || e.reason}`));

function setStatus(kind, text) {
  $("status-dot").className = "status__dot" + (kind ? ` is-${kind}` : "");
  $("status-text").textContent = text;
}

/* ---- Theme (auto / light / dark via color-scheme + light-dark()) -------- */
const THEME_ORDER = ["auto", "light", "dark"];
const THEME_ICON = { auto: "◐", light: "☀", dark: "☾" };
const themePref = () => localStorage.getItem("hex.theme") || "auto";
const resolved = (pref) =>
  pref === "auto" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : pref;

function paintThemeChrome(pref) {
  // Forced themes set color-scheme inline; "auto" defers to CSS (follows OS).
  document.documentElement.style.colorScheme = pref === "auto" ? "" : pref;
  $("theme-icon").textContent = THEME_ICON[pref];
  $("theme-label").textContent = pref[0].toUpperCase() + pref.slice(1);
}

function cycleTheme() {
  const next = THEME_ORDER[(THEME_ORDER.indexOf(themePref()) + 1) % THEME_ORDER.length];
  localStorage.setItem("hex.theme", next);
  paintThemeChrome(next);
  mapc.setTheme(resolved(next));
}

/* ---- Owner selector ------------------------------------------------------ */
function renderOwners() {
  const s = state.get();
  $("owner").value = s.owner;
  $("owners").replaceChildren(
    ...s.knownOwners.map((o) => {
      const opt = document.createElement("option");
      opt.value = o;
      return opt;
    })
  );
}

/* ---- Reference + per-owner data ----------------------------------------- */
async function loadTags() {
  try {
    const tags = await api.tags.list();
    state.set({ tags: Array.isArray(tags) ? tags : tags?.results || [] });
  } catch (e) {
    toast(`Tags failed to load: ${e.message}`, "error");
  }
}

async function loadExperiences() {
  try {
    const res = await api.experiences.list(state.get().owner, { ipp: 100 });
    state.set({ experiences: res?.results || [] });
  } catch (e) {
    state.set({ experiences: [] });
    console.warn("experiences load failed", e.message); // 500s for some owners — non-fatal
  }
  if (state.get().tab === "experiences") panels.renderList();
}

/* ---- Tabs ---------------------------------------------------------------- */
function updateTabInk() {
  const active = document.querySelector(".tab.is-active");
  const ink = $("tabs-ink");
  if (!active || !ink) return;
  ink.style.width = `${active.offsetWidth}px`;
  ink.style.transform = `translateX(${active.offsetLeft}px)`;
}

function setTab(tab) {
  state.set({ tab });
  for (const btn of document.querySelectorAll(".tab")) {
    btn.classList.toggle("is-active", btn.dataset.tab === tab);
  }
  updateTabInk();
  $("filter").value = "";
  panels.closeDetail();
  panels.renderList();
}

function readyStatus() {
  const d = mapc.getData();
  setStatus("ok", `${d.pois.features.length} places · ${d.itineraries.features.length} routes`);
}

/* ---- Boot ---------------------------------------------------------------- */
function boot() {
  renderOwners();
  paintThemeChrome(themePref());
  setStatus("", "starting");

  panels.init({
    onWrite: async () => {
      await Promise.all([mapc.reload(), loadTags(), loadExperiences()]);
      panels.renderList();
    },
  });

  mapc.initMap(
    {
      onSelectPoi: (id, f) => panels.selectPoi(id, f),
      onSelectItinerary: (id, f) => panels.selectItinerary(id, f),
      onCreatePoint: (lngLat) => panels.placePoint(lngLat),
      onClearSelection: () => panels.closeDetail(),
      onLoading: (busy, errors) => {
        state.set({ loading: busy });
        if (busy) setStatus("busy", "loading");
        else if (errors && errors.length) {
          setStatus("error", "partial load");
          toast(errors[0].message, "error");
        } else readyStatus();
        panels.renderList();
      },
      onData: () => panels.renderList(),
      onMapError: (err) => {
        if (err) setStatus("error", "map error — see console");
      },
    },
    resolved(themePref())
  );

  // Render immediately so the sidebar is never blank during map init.
  panels.renderList();

  // Topbar.
  $("owner").addEventListener("change", (e) => {
    state.setOwner(e.target.value);
    renderOwners();
    panels.closeDetail();
    mapc.reload();
    loadExperiences();
  });
  $("reload").addEventListener("click", () => {
    mapc.reload();
    loadTags();
    loadExperiences();
  });
  $("theme").addEventListener("click", cycleTheme);

  $("tabs").addEventListener("click", (e) => {
    const btn = e.target.closest(".tab");
    if (btn) setTab(btn.dataset.tab);
  });
  $("filter").addEventListener("input", () => panels.renderList());
  $("create-btn").addEventListener("click", () => panels.startCreate());

  // Tab indicator: position now, after fonts settle, and on resize.
  updateTabInk();
  if (document.fonts?.ready) document.fonts.ready.then(updateTabInk);
  addEventListener("resize", updateTabInk);

  // Keep the basemap in sync with the OS when in auto mode.
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (themePref() === "auto") mapc.setTheme(resolved("auto"));
  });

  loadTags();
  loadExperiences();
  console.log("[hex] boot complete");
}

try {
  boot();
} catch (e) {
  showFatal(`boot: ${e.message}`);
}
