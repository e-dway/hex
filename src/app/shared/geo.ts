// Geometry helpers shared across components.

export interface LngLat {
  lon: number;
  lat: number;
}

// POI geometry arrives as a real GeoJSON geometry in the .geojson endpoint, but
// the detail endpoint stores it as a JSON *string* in `point`. Normalise both.
export function readPoint(obj: any): LngLat | null {
  for (let c of [obj?.geometry, obj?.point, obj?.location]) {
    if (!c) continue;
    if (typeof c === 'string') {
      try {
        c = JSON.parse(c);
      } catch {
        continue;
      }
    }
    if (c?.type === 'Point' && Array.isArray(c.coordinates) && c.coordinates.length >= 2) {
      return { lon: +c.coordinates[0], lat: +c.coordinates[1] };
    }
    if (typeof c?.lon === 'number' && typeof c?.lat === 'number') return { lon: c.lon, lat: c.lat };
    if (typeof c?.lng === 'number' && typeof c?.lat === 'number') return { lon: c.lng, lat: c.lat };
  }
  return null;
}

export const makePoint = (lon: number, lat: number) => ({ type: 'Point', coordinates: [+lon, +lat] });

export const fmtCoord = (n: number | null | undefined) => (n == null ? '—' : Number(n).toFixed(5));
export const truncate = (s: string | null | undefined, n = 90) =>
  s && s.length > n ? s.slice(0, n - 1) + '…' : s || '';

// Pick a usable thumbnail URL for a POI (geojson `icon` is the id, not a URL).
export function poiThumb(p: any): string | null {
  const isUrl = (s: any) => typeof s === 'string' && /^https?:\/\//.test(s);
  if (isUrl(p?.image)) return p.image;
  const g = p?.gallery;
  if (Array.isArray(g) && g[0]?.img) return g[0].img;
  if (g && typeof g === 'object' && g.img) return g.img;
  if (isUrl(p?.icon)) return p.icon;
  return null;
}
