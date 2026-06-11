import { AfterViewInit, Component, ElementRef, ViewChild, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { StateService, type Tab } from '../state/state.service';
import { EditorComponent } from './editor.component';
import { fmtCoord, poiThumb, readPoint, truncate } from '../shared/geo';
import { pickLocalized } from '../shared/localized';
import type { Feature } from '../api/types';

const TABS: { id: Tab; label: string }[] = [
  { id: 'pois', label: 'Places' },
  { id: 'itineraries', label: 'Routes' },
  { id: 'tags', label: 'Tags' },
  { id: 'experiences', label: 'Experiences' },
];

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule, EditorComponent],
  template: `
    <aside class="sidebar">
      <nav #tabsNav class="tabs" role="tablist">
        <button *ngFor="let t of TABS" class="tab" [class.is-active]="st.tab() === t.id" role="tab" [attr.aria-selected]="st.tab() === t.id" (click)="setTab(t.id)">{{ t.label }}</button>
        <span class="tabs__ink" [style.width.px]="inkW" [style.transform]="'translateX(' + inkX + 'px)'"></span>
      </nav>

      <div class="toolbar">
        <div class="search">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke-width="2"></circle><path d="m20 20-3.5-3.5" stroke-width="2" stroke-linecap="round"></path></svg>
          <input type="search" placeholder="Filter…" aria-label="Filter list" [ngModel]="st.filter()" (ngModelChange)="st.filter.set($event)" />
        </div>
        <button class="btn btn--primary" (click)="create()"><span aria-hidden="true">＋</span> New</button>
      </div>

      <div class="list" role="list">
        <ng-container [ngSwitch]="st.tab()">
          <!-- PLACES -->
          <ng-container *ngSwitchCase="'pois'">
            <ng-container *ngIf="pois().length; else emptyPois">
              <div *ngFor="let f of pois()" class="row" [class.is-selected]="isSel('poi', f)" (click)="openPoi(f)">
                <div class="row__icon"><img *ngIf="thumb(f) as t; else pin" [src]="t" alt="" (error)="hideImg($event)" /><ng-template #pin>📍</ng-template></div>
                <div class="row__body">
                  <div class="row__title">{{ f.properties['name'] || 'Place ' + f.properties['id'] }}</div>
                  <div class="row__sub">{{ coord(f) }}</div>
                </div>
                <span *ngIf="f.properties['highlight']" class="badge badge--star">★</span>
                <span class="badge">r{{ f.properties['relevance'] ?? '·' }}</span>
              </div>
            </ng-container>
            <ng-template #emptyPois>
              <div class="empty">
                <div class="empty__art" [innerHTML]="ART.pin"></div>
                <div class="empty__title">{{ st.loading() ? 'Loading places…' : 'No places yet' }}</div>
                <div class="empty__hint" *ngIf="!st.loading()">Press <kbd>New</kbd> and click the map to add the first place in this workspace.</div>
              </div>
            </ng-template>
          </ng-container>

          <!-- ROUTES -->
          <ng-container *ngSwitchCase="'itineraries'">
            <ng-container *ngIf="itineraries().length; else emptyItin">
              <div *ngFor="let f of itineraries()" class="row" [class.is-selected]="isSel('itinerary', f)" (click)="openItinerary(f)">
                <div class="row__icon"><span class="dash" [style.background]="f.properties['color'] || '#1007a0'"></span></div>
                <div class="row__body">
                  <div class="row__title">{{ f.properties['name'] || 'Route ' + f.properties['id'] }}</div>
                  <div class="row__sub">{{ itinSub(f) }}</div>
                </div>
                <span *ngIf="f.properties['visibility'] && f.properties['visibility'] !== 'visible'" class="badge">{{ f.properties['visibility'] }}</span>
              </div>
            </ng-container>
            <ng-template #emptyItin>
              <div class="empty">
                <div class="empty__art" [innerHTML]="ART.route"></div>
                <div class="empty__title">{{ st.loading() ? 'Loading routes…' : 'No routes yet' }}</div>
                <div class="empty__hint" *ngIf="!st.loading()">Press <kbd>New</kbd> to create the first route in this workspace.</div>
              </div>
            </ng-template>
          </ng-container>

          <!-- TAGS -->
          <ng-container *ngSwitchCase="'tags'">
            <ng-container *ngIf="tags().length; else emptyTags">
              <div *ngFor="let t of tags()" class="row" (click)="openTag(t)">
                <div class="row__icon">#</div>
                <div class="row__body"><div class="row__title">{{ t.name }}</div><div class="row__sub">{{ t.family || '—' }}</div></div>
                <span *ngIf="t.user_preference" class="badge">pref</span>
                <span *ngIf="!t.visible" class="badge">hidden</span>
              </div>
            </ng-container>
            <ng-template #emptyTags>
              <div class="empty"><div class="empty__art" [innerHTML]="ART.tag"></div><div class="empty__title">No tags yet</div><div class="empty__hint">Tags group and filter your places. Create your first with <kbd>New</kbd>.</div></div>
            </ng-template>
          </ng-container>

          <!-- EXPERIENCES -->
          <ng-container *ngSwitchCase="'experiences'">
            <ng-container *ngIf="experiences().length; else emptyExp">
              <div *ngFor="let e of experiences()" class="row" (click)="openExperience(e)">
                <div class="row__icon">{{ e.is_package ? '📦' : '🎫' }}</div>
                <div class="row__body"><div class="row__title">{{ e.name || 'Experience ' + e.id }}</div><div class="row__sub">{{ trunc(e.description) }}</div></div>
                <span class="badge">€{{ e.price ?? 0 }}</span>
                <span *ngIf="!e.active" class="badge badge--off">off</span>
              </div>
            </ng-container>
            <ng-template #emptyExp>
              <div class="empty"><div class="empty__art" [innerHTML]="ART.ticket"></div><div class="empty__title">No experiences</div><div class="empty__hint">Bookable experiences for this workspace show up here once added.</div></div>
            </ng-template>
          </ng-container>
        </ng-container>
      </div>

      <app-editor></app-editor>
    </aside>
  `,
})
export class SidebarComponent implements AfterViewInit {
  TABS = TABS;
  inkW = 0;
  inkX = 0;

  @ViewChild('tabsNav', { static: true }) tabsNav!: ElementRef<HTMLElement>;

  // Pre-sanitised so Angular renders the inline SVG (its [innerHTML] sanitiser
  // would otherwise strip <svg>).
  ART: { pin: SafeHtml; route: SafeHtml; tag: SafeHtml; ticket: SafeHtml };

  pois = computed(() => {
    const q = this.st.filter().toLowerCase();
    return this.st
      .pois()
      .features.filter((f) => !q || String(f.properties['name'] || '').toLowerCase().includes(q))
      .sort((a, b) => (b.properties['relevance'] || 0) - (a.properties['relevance'] || 0));
  });
  itineraries = computed(() => {
    const q = this.st.filter().toLowerCase();
    return this.st.itineraries().features.filter((f) => !q || String(f.properties['name'] || '').toLowerCase().includes(q));
  });
  tags = computed(() => {
    const q = this.st.filter().toLowerCase();
    return this.st.tags().filter((t) => !q || (t.name || '').toLowerCase().includes(q) || (t.family || '').toLowerCase().includes(q));
  });
  experiences = computed(() => {
    const q = this.st.filter().toLowerCase();
    return this.st.experiences().filter((e) => !q || String(e.name || '').toLowerCase().includes(q));
  });

  constructor(public st: StateService, sanitizer: DomSanitizer) {
    const svg = (paths: string) =>
      sanitizer.bypassSecurityTrustHtml(`<svg viewBox="0 0 48 48" width="46" height="46" stroke-width="2">${paths}</svg>`);
    this.ART = {
      pin: svg('<path d="M24 4c-7 0-12 5-12 12 0 9 12 24 12 24s12-15 12-24c0-7-5-12-12-12Z"></path><circle cx="24" cy="16" r="4"></circle>'),
      route: svg('<path d="M10 38c8 0 8-22 18-22s10 14 10 14" stroke-linecap="round"></path><circle cx="10" cy="38" r="3.5"></circle><circle cx="38" cy="30" r="3.5"></circle>'),
      tag: svg('<path d="M6 22V8h14l22 22-14 14L6 22Z" stroke-linejoin="round"></path><circle cx="15" cy="15" r="2.5"></circle>'),
      ticket: svg('<path d="M8 14h32v8a4 4 0 0 0 0 8v4H8v-4a4 4 0 0 0 0-8v-8Z" stroke-linejoin="round"></path><path d="M28 14v20" stroke-dasharray="2 4"></path>'),
    };
  }

  ngAfterViewInit() {
    this.updateInk();
    if ((document as any).fonts?.ready) (document as any).fonts.ready.then(() => this.updateInk());
    addEventListener('resize', () => this.updateInk());
  }

  setTab(t: Tab) {
    this.st.tab.set(t);
    this.st.filter.set('');
    this.st.closeEditor();
    setTimeout(() => this.updateInk());
  }

  private updateInk() {
    const active = this.tabsNav?.nativeElement.querySelector('.tab.is-active') as HTMLElement | null;
    if (!active) return;
    this.inkW = active.offsetWidth;
    this.inkX = active.offsetLeft;
  }

  create() {
    const map: Record<Tab, any> = { pois: 'poi', itineraries: 'itinerary', tags: 'tag', experiences: 'experience' };
    this.st.selection.set(null);
    this.st.editor.set({ kind: map[this.st.tab()], isNew: true });
  }

  openPoi(f: Feature) {
    const id = f.properties['id'];
    this.st.selection.set({ kind: 'poi', id });
    this.st.editor.set({ kind: 'poi', id, isNew: false, seed: f.properties });
  }
  openItinerary(f: Feature) {
    const id = f.properties['id'];
    this.st.selection.set({ kind: 'itinerary', id });
    this.st.editor.set({ kind: 'itinerary', id, isNew: false, seed: f.properties });
  }
  openTag(t: any) {
    this.st.selection.set(null);
    this.st.editor.set({ kind: 'tag', id: t.id, isNew: false, seed: t });
  }
  openExperience(e: any) {
    this.st.selection.set(null);
    this.st.editor.set({ kind: 'experience', id: e.id, isNew: false, seed: e });
  }

  isSel(kind: 'poi' | 'itinerary', f: Feature) {
    const s = this.st.selection();
    return !!s && s.kind === kind && String(s.id) === String(f.properties['id']);
  }

  thumb = (f: Feature) => poiThumb(f.properties);
  hideImg(e: Event) {
    (e.target as HTMLElement).style.display = 'none';
  }
  coord(f: Feature) {
    const p = readPoint(f);
    return p ? `${fmtCoord(p.lat)}, ${fmtCoord(p.lon)}` : 'no location';
  }
  itinSub(f: Feature) {
    const p = f.properties;
    const len = p['length'] ? `${(+p['length']).toFixed(1)} km` : '';
    const stops = Array.isArray(p['pois']) ? `${p['pois'].length} stops` : '';
    return [stops, len, p['category']].filter(Boolean).join(' · ') || '—';
  }
  trunc = (s: any) => truncate(pickLocalized(s), 60);
}
