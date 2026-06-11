import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as maplibregl from 'maplibre-gl';
import { ApiService } from '../api/api.service';
import { StateService } from '../state/state.service';
import { ThemeService } from '../state/theme.service';
import { EMPTY_FC, type FeatureCollection } from '../api/types';

const FLORENCE = { center: [11.2553, 43.7696] as [number, number], zoom: 12 };

const PALETTE = {
  light: { poi: '#ff007a', featured: '#e8920a', line: '#1007a0', sel: '#1007a0', poiStroke: '#ffffff', casing: '#ffffff', marker: '#1007a0', label: '#2a2f3a', labelHalo: '#ffffff' },
  dark: { poi: '#ff3d97', featured: '#f5b53d', line: '#7c8cff', sel: '#ffffff', poiStroke: '#1a1438', casing: '#000000', marker: '#7c8cff', label: '#e9ecf5', labelHalo: '#10121a' },
};

function baseStyle(mode: 'light' | 'dark'): any {
  const slug = mode === 'dark' ? 'dark_all' : 'light_all';
  return {
    version: 8,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      base: {
        type: 'raster',
        tiles: ['a', 'b', 'c'].map((s) => `https://${s}.basemaps.cartocdn.com/${slug}/{z}/{x}/{y}@2x.png`),
        tileSize: 256,
        attribution: '© OpenStreetMap contributors © CARTO',
      },
    },
    layers: [{ id: 'base', type: 'raster', source: 'base' }],
  };
}

const esc = (s: any) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="map-wrap">
      <div #mapEl id="map"></div>
      <div class="map-hint" *ngIf="hint()">{{ hint() }}</div>
      <div class="legend" aria-hidden="true">
        <span class="legend__item"><i class="dot dot--poi"></i>Place</span>
        <span class="legend__item"><i class="dot dot--hi"></i>Featured</span>
        <span class="legend__item"><i class="dash"></i>Route</span>
      </div>
    </div>
  `,
})
export class MapComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapEl', { static: true }) mapEl!: ElementRef<HTMLDivElement>;

  hint = signal<string | null>(null);

  private map?: maplibregl.Map;
  private hoverPopup?: maplibregl.Popup;
  private editMarker?: maplibregl.Marker;
  private theme: 'light' | 'dark' = 'light';
  private last: { pois: FeatureCollection; itineraries: FeatureCollection } = { pois: EMPTY_FC, itineraries: EMPTY_FC };
  private selected: { kind: 'poi' | 'itinerary'; id: number } | null = null;
  private reloadSeq = 0;

  constructor(private api: ApiService, public st: StateService, private themeSvc: ThemeService) {
    // Reload the view when owner changes or a write bumps the refresh tick.
    effect(() => {
      this.st.owner();
      this.st.refreshTick();
      if (this.map) this.reload('owner/refresh');
    });
    // Highlight + fly when selection changes (from list or map).
    effect(() => {
      const sel = this.st.selection();
      if (this.map) this.applySelection(sel);
    });
    // Swap basemap with theme.
    effect(() => {
      const mode = this.themeSvc.resolved();
      if (this.map && mode !== this.theme) this.swapTheme(mode);
    });
    // Show / move / hide the draggable edit marker on editor request.
    effect(() => {
      const pos = this.st.editMarker();
      if (this.map) this.syncEditMarker(pos);
    });
    // Crosshair cursor while placing a new place.
    effect(() => {
      const placing = this.st.createMode();
      this.hint.set(placing && !this.st.editMarker() ? 'Click the map to drop this place' : null);
      if (this.map) this.map.getCanvas().style.cursor = placing ? 'crosshair' : '';
    });
  }

  ngAfterViewInit() {
    this.theme = this.themeSvc.resolved();
    this.map = new maplibregl.Map({
      container: this.mapEl.nativeElement,
      style: baseStyle(this.theme),
      ...FLORENCE,
      attributionControl: { compact: true },
      // Sync zoom/center to the URL hash (#zoom/lat/lng) so views are shareable;
      // if the URL already has a hash, the map opens there instead of Florence.
      hash: 'map',
    });
    this.map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    this.map.addControl(new maplibregl.ScaleControl({ maxWidth: 120 }), 'bottom-right');
    this.hoverPopup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 14 });

    this.map.on('load', () => {
      this.installLayers();
      this.wire();
      this.reload('load');
    });
    // No moveend reload: we load the workspace's complete dataset once per
    // owner/refresh, and let MapLibre clip rendering to the viewport.
    this.map.on('error', (e: any) => console.error('Map error:', e.error?.message ?? e.error ?? e));
  }

  ngOnDestroy() {
    this.map?.remove();
  }

  private installLayers() {
    const m = this.map!;
    const c = PALETTE[this.theme];
    for (const id of ['itin-casing', 'itin-line', 'poi-halo', 'poi-dot', 'poi-label']) if (m.getLayer(id)) m.removeLayer(id);
    if (!m.getSource('itineraries')) m.addSource('itineraries', { type: 'geojson', data: this.last.itineraries as any, promoteId: 'id' });
    if (!m.getSource('pois')) m.addSource('pois', { type: 'geojson', data: this.last.pois as any, promoteId: 'id' });

    m.addLayer({
      id: 'itin-casing', type: 'line', source: 'itineraries',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': c.casing, 'line-opacity': 0.5, 'line-width': ['case', ['boolean', ['feature-state', 'selected'], false], 9, 6] },
    });
    m.addLayer({
      id: 'itin-line', type: 'line', source: 'itineraries',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': ['coalesce', ['get', 'color'], c.line], 'line-width': ['case', ['boolean', ['feature-state', 'selected'], false], 5.5, 3], 'line-opacity': 0.95 },
    });
    m.addLayer({
      id: 'poi-halo', type: 'circle', source: 'pois',
      paint: { 'circle-radius': ['case', ['boolean', ['feature-state', 'selected'], false], 22, 0], 'circle-color': c.poi, 'circle-opacity': 0.16 },
    });
    m.addLayer({
      id: 'poi-dot', type: 'circle', source: 'pois',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, ['case', ['boolean', ['feature-state', 'selected'], false], 9, 5], 16, ['case', ['boolean', ['feature-state', 'selected'], false], 15, 8]],
        'circle-color': ['case', ['to-boolean', ['get', 'highlight']], c.featured, c.poi],
        'circle-stroke-color': ['case', ['boolean', ['feature-state', 'selected'], false], c.sel, c.poiStroke],
        'circle-stroke-width': ['case', ['boolean', ['feature-state', 'selected'], false], 3, 1.5],
      },
    });
    m.addLayer({
      id: 'poi-label',
      type: 'symbol',
      source: 'pois',
      minzoom: 11,
      layout: {
        'text-field': ['coalesce', ['get', 'name'], ''],
        'text-font': ['Open Sans Semibold'],
        'text-size': 11,
        'text-anchor': 'top',
        'text-offset': [0, 0.95],
        'text-max-width': 9,
        'text-allow-overlap': false,
        'text-optional': true,
      },
      paint: {
        'text-color': c.label,
        'text-halo-color': c.labelHalo,
        'text-halo-width': 1.4,
        'text-halo-blur': 0.4,
      },
    });
    if (this.selected) this.applySelection(this.selected);
  }

  private swapTheme(mode: 'light' | 'dark') {
    this.theme = mode;
    const m = this.map!;
    const c = PALETTE[mode];
    const slug = mode === 'dark' ? 'dark_all' : 'light_all';
    const tiles = ['a', 'b', 'c'].map((s) => `https://${s}.basemaps.cartocdn.com/${slug}/{z}/{x}/{y}@2x.png`);
    const base: any = m.getSource('base');

    if (base && typeof base.setTiles === 'function') {
      // Swap the basemap tiles in place — keeps the data layers (and their data)
      // intact, so markers/lines stay visible. Just recolor them for the theme.
      base.setTiles(tiles);
      m.setPaintProperty('itin-casing', 'line-color', c.casing);
      m.setPaintProperty('itin-line', 'line-color', ['coalesce', ['get', 'color'], c.line]);
      m.setPaintProperty('poi-halo', 'circle-color', c.poi);
      m.setPaintProperty('poi-dot', 'circle-color', ['case', ['to-boolean', ['get', 'highlight']], c.featured, c.poi]);
      m.setPaintProperty('poi-dot', 'circle-stroke-color', ['case', ['boolean', ['feature-state', 'selected'], false], c.sel, c.poiStroke]);
      m.setPaintProperty('poi-label', 'text-color', c.label);
      m.setPaintProperty('poi-label', 'text-halo-color', c.labelHalo);
    } else {
      // Fallback: full style reset, then re-add our layers once it has loaded.
      m.setStyle(baseStyle(mode));
      const onStyle = () => {
        if (!m.isStyleLoaded()) return;
        m.off('styledata', onStyle);
        this.installLayers();
      };
      m.on('styledata', onStyle);
    }
    this.refreshEditMarkerColor();
  }

  // Marker colour is fixed at creation; recreate it so it matches the theme.
  private refreshEditMarkerColor() {
    if (!this.editMarker) return;
    const ll = this.editMarker.getLngLat();
    this.editMarker.remove();
    this.editMarker = undefined;
    this.syncEditMarker({ lon: ll.lng, lat: ll.lat });
  }

  private wire() {
    const m = this.map!;
    m.on('mousemove', 'poi-dot', (e: any) => {
      m.getCanvas().style.cursor = 'pointer';
      const p = e.features[0].properties;
      this.hoverPopup!
        .setLngLat(e.features[0].geometry.coordinates)
        .setHTML(`<strong>${esc(p.name || 'Place')}</strong><div class="popup-sub">${p.highlight ? 'Featured place' : 'Place'}</div>`)
        .addTo(m);
    });
    m.on('mousemove', 'itin-line', (e: any) => {
      if (m.queryRenderedFeatures(e.point, { layers: ['poi-dot'] }).length) return;
      m.getCanvas().style.cursor = 'pointer';
      const p = e.features[0].properties;
      const stops = Array.isArray(p.pois) ? p.pois.length : null;
      this.hoverPopup!.setLngLat(e.lngLat).setHTML(`<strong>${esc(p.name || 'Route')}</strong><div class="popup-sub">Route${stops != null ? ` · ${stops} stops` : ''}</div>`).addTo(m);
    });
    for (const layer of ['poi-dot', 'itin-line']) {
      m.on('mouseleave', layer, () => {
        m.getCanvas().style.cursor = this.st.createMode() ? 'crosshair' : '';
        this.hoverPopup!.remove();
      });
    }

    m.on('click', 'poi-dot', (e: any) => {
      e.preventDefault();
      const id = e.features[0].properties.id;
      this.st.selection.set({ kind: 'poi', id });
      this.st.editor.set({ kind: 'poi', id, isNew: false, seed: e.features[0].properties });
    });
    m.on('click', 'itin-line', (e: any) => {
      if (e.defaultPrevented) return;
      const id = e.features[0].properties.id;
      this.st.selection.set({ kind: 'itinerary', id });
      this.st.editor.set({ kind: 'itinerary', id, isNew: false, seed: e.features[0].properties });
    });
    m.on('click', (e: any) => {
      if (e.defaultPrevented) return;
      if (m.queryRenderedFeatures(e.point, { layers: ['poi-dot', 'itin-line'] }).length) return;
      if (this.st.createMode()) this.st.pickedPoint.set({ lon: e.lngLat.lng, lat: e.lngLat.lat });
      else this.st.closeEditor();
    });
  }

  // World bbox — the API requires `bbox`, but we want the workspace's complete
  // dataset, not a viewport slice.
  private static readonly WORLD_BBOX = '-180,-85,180,85';

  private async reload(why: string) {
    const m = this.map;
    if (!m || !m.isStyleLoaded()) return;
    const seq = ++this.reloadSeq;
    const owner = this.st.owner();
    const bbox = MapComponent.WORLD_BBOX;
    this.st.loading.set(true);
    try {
      const [pois, itins] = await Promise.allSettled([this.api.poisGeojson(bbox, owner), this.api.itinerariesGeojson(bbox, owner)]);
      if (seq !== this.reloadSeq) return;
      const poiData = pois.status === 'fulfilled' ? pois.value : this.last.pois;
      const itinData = itins.status === 'fulfilled' ? itins.value : this.last.itineraries;
      this.last = { pois: poiData, itineraries: itinData };
      (m.getSource('pois') as any)?.setData(poiData);
      (m.getSource('itineraries') as any)?.setData(itinData);
      this.st.pois.set(poiData);
      this.st.itineraries.set(itinData);
      if (this.selected) this.applySelection(this.selected);
      this.st.loading.set(false);
    } catch (e) {
      this.st.loading.set(false);
      console.error('Map data reload failed', e);
    }
  }

  private applySelection(sel: { kind: 'poi' | 'itinerary'; id: number } | null) {
    const m = this.map!;
    if (this.selected) {
      const src = this.selected.kind === 'poi' ? 'pois' : 'itineraries';
      try { m.setFeatureState({ source: src, id: this.selected.id }, { selected: false }); } catch {}
    }
    this.selected = sel;
    if (!sel) return;
    const src = sel.kind === 'poi' ? 'pois' : 'itineraries';
    try { m.setFeatureState({ source: src, id: sel.id }, { selected: true }); } catch {}
    const fc = sel.kind === 'poi' ? this.last.pois : this.last.itineraries;
    const f = fc.features.find((x) => String(x.id ?? x.properties?.['id']) === String(sel.id));
    if (f) this.flyTo(f.geometry);
  }

  private get reduceMotion() {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private flyTo(geom: any) {
    const m = this.map!;
    const animate = !this.reduceMotion;
    if (geom?.type === 'Point') {
      m.flyTo({ center: geom.coordinates, zoom: Math.max(m.getZoom(), 14), speed: 1.4, animate });
    } else if (geom?.type === 'LineString' && geom.coordinates?.length) {
      const lons = geom.coordinates.map((c: number[]) => c[0]);
      const lats = geom.coordinates.map((c: number[]) => c[1]);
      m.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], { padding: 80, maxZoom: 15, duration: animate ? 800 : 0 });
    }
  }

  private syncEditMarker(pos: { lon: number; lat: number } | null) {
    if (!pos) {
      this.editMarker?.remove();
      this.editMarker = undefined;
      return;
    }
    if (this.editMarker) {
      this.editMarker.setLngLat([pos.lon, pos.lat]);
    } else {
      this.editMarker = new maplibregl.Marker({ color: PALETTE[this.theme].marker, draggable: true })
        .setLngLat([pos.lon, pos.lat])
        .addTo(this.map!);
      this.editMarker.on('dragend', () => {
        const { lng, lat } = this.editMarker!.getLngLat();
        this.st.pickedPoint.set({ lon: lng, lat });
      });
    }
    this.map!.flyTo({ center: [pos.lon, pos.lat], zoom: Math.max(this.map!.getZoom(), 14), speed: 1.4, animate: !this.reduceMotion });
  }
}
