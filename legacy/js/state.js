// Minimal observable app state. No framework — just a pub/sub store.

const KNOWN_OWNERS = ["806af00f-827f-4e4a-a5c6-93ffa80bd763", "system"];

const state = {
  owner: localStorage.getItem("hex.owner") || KNOWN_OWNERS[0],
  knownOwners: JSON.parse(localStorage.getItem("hex.knownOwners") || "null") || KNOWN_OWNERS,
  tab: "pois", // pois | itineraries | tags | experiences
  pois: { type: "FeatureCollection", features: [] },
  itineraries: { type: "FeatureCollection", features: [] },
  tags: [],
  experiences: [],
  selection: null, // { kind: 'poi'|'itinerary', id, data }
  createMode: false, // when true, clicking the map drops a new POI
  loading: false,
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emit(event, payload) {
  for (const fn of listeners) fn(event, payload, state);
}

export function get() {
  return state;
}

export function set(patch, event = "change") {
  Object.assign(state, patch);
  emit(event, patch);
}

export function setOwner(owner) {
  const trimmed = (owner || "").trim();
  if (!trimmed) return;
  if (!state.knownOwners.includes(trimmed)) {
    state.knownOwners = [trimmed, ...state.knownOwners].slice(0, 12);
    localStorage.setItem("hex.knownOwners", JSON.stringify(state.knownOwners));
  }
  localStorage.setItem("hex.owner", trimmed);
  set({ owner: trimmed }, "owner");
}
