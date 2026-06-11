// Thin typed-ish client over the HopOnMobility Experiences API.
// All endpoints are documented at https://experiences.hoponmobility.com/api/openapi.json
// CORS is fully open (access-control-allow-origin: *) so the browser calls it directly.

export const API_BASE = "https://experiences.hoponmobility.com/api";

class ApiError extends Error {
  constructor(message, { status, url, body } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.url = url;
    this.body = body;
  }
}

async function request(path, { method = "GET", query, body, raw } = {}) {
  const url = new URL(API_BASE + path);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
    }
  }

  const init = { method, headers: {} };
  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, init);
  } catch (e) {
    throw new ApiError(`Network error: ${e.message}`, { url: url.toString() });
  }

  const text = await res.text();
  if (!res.ok) {
    // The backend sometimes returns a Python traceback as plain text on 500s.
    const snippet = text.split("\n").slice(0, 3).join(" ").slice(0, 300);
    throw new ApiError(`${res.status} ${res.statusText} — ${snippet || "request failed"}`, {
      status: res.status,
      url: url.toString(),
      body: text,
    });
  }

  if (raw) return text;
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError("Expected JSON but got a non-JSON response", {
      status: res.status,
      url: url.toString(),
      body: text,
    });
  }
}

// Convert a maplibre LngLatBounds-ish [w, s, e, n] to the bbox query string.
export const bboxParam = (b) => `${b[0]},${b[1]},${b[2]},${b[3]}`;

export const api = {
  request,

  // ---- POIs ----------------------------------------------------------------
  pois: {
    geojson: (bbox, owner, opts = {}) =>
      request("/pois/pois.geojson", {
        query: { bbox: bboxParam(bbox), owner, filter: opts.filter, itinerary: opts.itinerary },
      }),
    get: (id) => request(`/pois/${id}`),
    create: (payload) => request("/pois/", { method: "POST", body: payload }),
    update: (id, payload) => request(`/pois/${id}`, { method: "PUT", body: payload }),
    remove: (id) => request(`/pois/${id}`, { method: "DELETE" }),
  },

  // ---- Itineraries ---------------------------------------------------------
  itineraries: {
    geojson: (bbox, owner, opts = {}) =>
      request("/itineraries/itineraries.geojson", {
        query: { bbox: bboxParam(bbox), owner, user: opts.user, filter: opts.filter },
      }),
    get: (id) => request(`/itineraries/${id}`),
    create: (payload) => request("/itineraries/", { method: "POST", body: payload }),
    update: (id, payload) => request(`/itineraries/${id}`, { method: "PUT", body: payload }),
    remove: (id) => request(`/itineraries/${id}`, { method: "DELETE" }),
  },

  // ---- Experiences ---------------------------------------------------------
  experiences: {
    list: (owner, { page = 0, ipp = 50, fltr } = {}) =>
      request("/experiences/", { query: { owner, page, ipp, fltr } }),
    get: (id) => request(`/experiences/${id}`),
    create: (payload) => request("/experiences/", { method: "POST", body: payload }),
    update: (id, payload) => request(`/experiences/${id}`, { method: "PUT", body: payload }),
    remove: (id) => request(`/experiences/${id}`, { method: "DELETE" }),
  },

  // ---- Tags ----------------------------------------------------------------
  tags: {
    list: (filter) => request("/tags/", { query: { filter } }),
    create: (payload) => request("/tags/", { method: "POST", body: payload }),
    update: (id, payload) => request(`/tags/${id}`, { method: "PUT", body: payload }),
    remove: (id) => request(`/tags/${id}`, { method: "DELETE" }),
  },

  // ---- Utility / reference data -------------------------------------------
  markers: { list: () => request("/utils/markers/") },
  icons: { list: () => request("/utils/icons/") },
};

export { ApiError };
