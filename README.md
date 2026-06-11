# HEX — HopOnMobility Experiences Manager

An Angular admin UI for the HopOnMobility **Experiences** API
(`https://experiences.hoponmobility.com`). It shows POIs (places) and itineraries
(routes) on a MapLibre map and lets tourism partners create / edit / delete the
underlying data — places, routes, tags and bookable experiences.

Travel-brand-vibrant design (magenta places · indigo routes · amber highlights),
light + dark via `light-dark()`, fonts Bricolage Grotesque / Hanken Grotesk.
See `.impeccable.md` for the design context.

## Stack

- **Angular 21** (standalone components, signals, zone-based change detection), TypeScript 5.9
- **MapLibre GL** (wrapped directly in `MapComponent`)
- **openapi-typescript + openapi-fetch** — the API client types are generated
  from `openapi.json`; CRUD calls are fully typed end-to-end
- No backend of its own — the API has open CORS, so the browser calls it directly

## ⚠️ Node version (this host)

Angular 21 needs Node `^20.19 || ^22.12 || >=24`. This box is Ubuntu 18.04
(glibc 2.27), so the **standard** Node 20/22/24 binaries won't run (they need
glibc ≥2.28). Use the **unofficial glibc-217 Node 22 build**, which links against
glibc 2.17 and runs here:

```bash
# one-time install
curl -sL https://unofficial-builds.nodejs.org/download/release/v22.12.0/node-v22.12.0-linux-x64-glibc-217.tar.gz \
  | tar -xz -C "$HOME/.local"
# use it (every shell)
export PATH="$HOME/.local/node-v22.12.0-linux-x64-glibc-217/bin:$PATH"
node -v   # v22.12.0
```

> The nvm Node 16 used by the previous version **cannot** run Angular 21's CLI.
> On a modern OS (glibc ≥2.28) just use a normal Node 22/24 — no unofficial build needed.

## Develop

```bash
export PATH="$HOME/.local/node-v22.12.0-linux-x64-glibc-217/bin:$PATH"
npm install
# dev server (Vite); --allowed-hosts lets you reach it by IP
npx ng serve --host 0.0.0.0 --port 9800 --allowed-hosts
```

Production build → static files in `dist/hex/browser/`:

```bash
npm run build
```

## Deploy on Netlify

The repo ships a `netlify.toml` — just **connect the repo in the Netlify
dashboard** and that's it. Build command, publish dir (`dist/hex/browser`),
Node 22 and an SPA fallback redirect (so `index.html` is served for any deep
URL hit) are all configured. No env vars or secrets needed — the app calls
`experiences.hoponmobility.com` directly and the API has open CORS.

(One harmless build warning here: the lmdb build-cache native module wants
glibc 2.33, so the persistent compile cache is disabled — builds still produce
correct output, just without cross-run caching.)

## Regenerate the API types

When the upstream API changes, refresh `openapi.json` and regenerate:

```bash
curl -s https://experiences.hoponmobility.com/api/openapi.json -o openapi.json
npm run gen:api                 # → src/app/api/schema.ts
```

## Structure

```
openapi.json                 source of truth for API types
src/
  index.html                 fonts + color-scheme meta
  styles.css                 design system — OKLCH tokens, light/dark, all component CSS
  main.ts                    bootstrapApplication(AppComponent, appConfig)
  app/
    app.config.ts            providers (zone change detection, error listeners)
    api/
      schema.ts              generated (openapi-typescript) — do not edit
      types.ts               convenience aliases + GeoJSON types
      api.service.ts         openapi-fetch client; typed CRUD + geojson helpers
    state/
      state.service.ts       signals: owner, tab, selection, editor, data, …
      data.service.ts        loads tags (global) + experiences (owner-scoped)
      theme.service.ts       auto/light/dark via color-scheme + light-dark()
      toast.service.ts       transient notifications
    shared/geo.ts            point parsing, thumbnails, formatting
    map/map.component.ts     MapLibre wrapper — themed basemap, bbox loading, selection, edit marker
    topbar/topbar.component.ts   brand, workspace switcher, status, theme toggle
    sidebar/sidebar.component.ts list (places/routes/tags/experiences) + tabs
    sidebar/editor.component.ts  per-entity create/edit/delete forms + raw-JSON escape hatch
    app.component.ts         shell + toast + data-loading effects
legacy/                      previous no-build vanilla version (kept for reference; safe to delete)
```

## Notes & API quirks (discovered empirically)

- Data is **workspace (`owner`) scoped**. Two are pre-seeded: the default UUID
  `806af00f-…` (has places + routes) and `system`.
- The map loads from the `*.geojson` endpoints for the current viewport bbox; the
  paginated list endpoints can 500 or return empty for some owners, so geojson is
  the list source. Experiences use the JSON list endpoint (no working geojson).
- POI **location** is written as a GeoJSON `Point`; the geojson `icon` property is
  actually the POI id (real thumbnail lives in `image` / `gallery`), handled in `geo.ts`.
- POI **tags** are submitted as tag **names** (strings), per the update schema.
- There is **no auth** in the spec; requests are unauthenticated. Add a token in
  `api.service.ts` if a deployment later requires one.
