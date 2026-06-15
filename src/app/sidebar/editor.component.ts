import { Component, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../api/api.service';
import { StateService, type EditorState, type EntityKind } from '../state/state.service';
import { ToastService } from '../state/toast.service';
import { makePoint, readPoint } from '../shared/geo';
import { parseLocalized, serializeLocalized } from '../shared/localized';
import { GalleryComponent } from './gallery.component';
import { ItineraryStopsComponent } from './itinerary-stops.component';
import { IconPickerComponent } from './icon-picker.component';

const VISIBILITY = ['visible', 'hidden', 'private'];
const EYEBROW: Record<EntityKind, string> = { poi: 'place', itinerary: 'route', tag: 'tag', experience: 'experience' };

@Component({
  selector: 'app-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, GalleryComponent, ItineraryStopsComponent, IconPickerComponent],
  template: `
    <section class="detail" *ngIf="st.editor() as ed">
      <div class="detail__head">
        <div>
          <div class="detail__eyebrow">{{ isNew ? 'New ' + EYEBROW[ed.kind] : EYEBROW[ed.kind] }}</div>
          <h2 class="detail__title">{{ title() }}</h2>
        </div>
        <button class="iconbtn detail__close" title="Close editor" aria-label="Close editor" (click)="close()">✕</button>
      </div>

      <div class="detail__body">
        <!-- Description, per language (stored plain-IT or JSON {it,en}) -->
        <ng-template #descFields>
          <div class="field"><label>Description · IT</label><textarea rows="4" [(ngModel)]="descIt" placeholder="Descrizione in italiano"></textarea></div>
          <div class="field">
            <label>Description · EN</label>
            <textarea rows="3" [(ngModel)]="descEn" placeholder="English description (optional)"></textarea>
            <div class="field-hint">Leave English empty to store a plain Italian description.</div>
          </div>
        </ng-template>

        <!-- POI -->
        <ng-container *ngIf="ed.kind === 'poi'">
          <div class="field"><label>Name</label><input type="text" [(ngModel)]="draft.name" placeholder="e.g. Piazza del Duomo" /></div>
          <div class="field--row">
            <div class="field"><label>Latitude</label><input type="number" step="any" [(ngModel)]="lat" (ngModelChange)="onCoord()" /></div>
            <div class="field"><label>Longitude</label><input type="number" step="any" [(ngModel)]="lon" (ngModelChange)="onCoord()" /></div>
          </div>
          <div class="coord-note">Drag the marker on the map, or type coordinates above.</div>
          <div class="field--row">
            <div class="field"><label>Radius (m)</label><input type="number" [(ngModel)]="draft.radius" /></div>
            <div class="field"><label>Relevance</label><input type="number" [(ngModel)]="draft.relevance" /></div>
          </div>
          <ng-container *ngTemplateOutlet="descFields"></ng-container>
          <app-gallery [items]="draft.gallery" (itemsChange)="onGallery($event)"></app-gallery>
          <app-icon-picker [value]="draft.icon" (valueChange)="onIcon($event)"></app-icon-picker>
          <div class="field"><label>Video URL</label><input type="url" [(ngModel)]="draft.video" /></div>
          <div class="field">
            <label>Tags <span class="note">· saved as names</span></label>
            <div class="tagpick">
              <label *ngFor="let t of st.tags()" [title]="t.family || ''">
                <input type="checkbox" [checked]="tagSet.has(t.name)" (change)="toggleTag(t.name, $any($event.target).checked)" />{{ t.name }}
              </label>
            </div>
          </div>
          <div class="field">
            <label>Experiences <span class="note">· this place is part of {{ expSet.size }} of {{ st.experiences().length }}</span></label>
            <div class="tagpick" *ngIf="st.experiences().length; else noExp">
              <label *ngFor="let e of st.experiences()" [title]="e.name || ''">
                <input type="checkbox" [checked]="expSet.has(asNum(e.id))" (change)="toggleExp(asNum(e.id), $any($event.target).checked)" />{{ e.name || ('Experience ' + e.id) }}
              </label>
            </div>
            <ng-template #noExp>
              <div class="field-hint">This workspace has no experiences yet.</div>
            </ng-template>
            <div class="field-hint" *ngIf="isNew">Save the place first, then come back to attach it to experiences.</div>
          </div>
          <div class="field--row">
            <label class="check"><input type="checkbox" [(ngModel)]="draft.highlight" /><span>Feature this place</span></label>
            <label class="check"><input type="checkbox" [(ngModel)]="draft.audio_guide" /><span>Audio guide</span></label>
          </div>
        </ng-container>

        <!-- ITINERARY -->
        <ng-container *ngIf="ed.kind === 'itinerary'">
          <div class="field"><label>Name</label><input type="text" [(ngModel)]="draft.name" /></div>
          <div class="field--row">
            <div class="field"><label>Category</label><input type="text" [(ngModel)]="draft.category" /></div>
            <div class="field"><label>Color (hex)</label><input type="text" [(ngModel)]="draft.color" /></div>
          </div>
          <div class="field"><label>Visibility</label>
            <select [(ngModel)]="draft.visibility"><option *ngFor="let v of VIS" [value]="v">{{ v }}</option></select>
          </div>
          <div class="field"><label>Abstract</label><textarea rows="2" [(ngModel)]="draft.description_abstract"></textarea></div>
          <ng-container *ngTemplateOutlet="descFields"></ng-container>
          <app-gallery [items]="draft.gallery" (itemsChange)="onGallery($event)"></app-gallery>
          <div class="field--row">
            <div class="field"><label>Length (km)</label><input type="number" [(ngModel)]="draft.length" /></div>
            <div class="field"><label>Total duration</label><input type="text" [(ngModel)]="draft.total_duration" /></div>
          </div>
          <div class="field--row">
            <label class="check"><input type="checkbox" [(ngModel)]="draft.directed" /><span>Directed</span></label>
            <label class="check"><input type="checkbox" [(ngModel)]="draft.require_booking" /><span>Require booking</span></label>
          </div>
          <app-itinerary-stops [stops]="draft.pois" (stopsChange)="onStops($event)"></app-itinerary-stops>
          <div class="field-hint">Route geometry (the drawn path) is edited in the raw payload below.</div>
        </ng-container>

        <!-- TAG -->
        <ng-container *ngIf="ed.kind === 'tag'">
          <div class="field"><label>Name</label><input type="text" [(ngModel)]="draft.name" /></div>
          <div class="field"><label>Family</label><input type="text" [(ngModel)]="draft.family" /></div>
          <div class="field"><label>Parent tag</label>
            <select [(ngModel)]="draft.parent_id">
              <option [ngValue]="null">— none —</option>
              <option *ngFor="let t of parentTags()" [ngValue]="t.id">{{ t.name }} ({{ t.id }})</option>
            </select>
          </div>
          <div class="field--row">
            <label class="check"><input type="checkbox" [(ngModel)]="draft.visible" /><span>Visible</span></label>
            <label class="check"><input type="checkbox" [(ngModel)]="draft.user_preference" /><span>User preference</span></label>
          </div>
        </ng-container>

        <!-- EXPERIENCE -->
        <ng-container *ngIf="ed.kind === 'experience'">
          <div class="field"><label>Name</label><input type="text" [(ngModel)]="draft.name" /></div>
          <ng-container *ngTemplateOutlet="descFields"></ng-container>
          <app-gallery [items]="draft.gallery" (itemsChange)="onGallery($event)"></app-gallery>
          <div class="field--row">
            <div class="field"><label>Price</label><input type="number" [(ngModel)]="draft.price" /></div>
            <div class="field"><label>Duration</label><input type="text" [(ngModel)]="draft.duration" /></div>
          </div>
          <div class="field"><label>Reference email</label><input type="text" [(ngModel)]="draft.reference_email" /></div>
          <div class="field--row">
            <label class="check"><input type="checkbox" [(ngModel)]="draft.active" /><span>Active</span></label>
            <label class="check"><input type="checkbox" [(ngModel)]="draft.listed" /><span>Listed</span></label>
          </div>
          <label class="check"><input type="checkbox" [(ngModel)]="draft.is_package" /><span>Is package</span></label>
        </ng-container>

        <details class="adv" (toggle)="onRawToggle($any($event.target).open)">
          <summary>Advanced · raw JSON payload</summary>
          <div class="field" style="margin-top:12px">
            <div class="field-hint">Sent verbatim on save — for any field the form above doesn't surface.</div>
            <textarea class="code" rows="12" spellcheck="false" [(ngModel)]="rawText" (ngModelChange)="onRaw()"></textarea>
          </div>
        </details>
      </div>

      <div class="detail__foot">
        <button *ngIf="!isNew" class="btn btn--danger" (click)="remove()">Delete</button>
        <div class="spacer"></div>
        <button class="btn btn--ghost" (click)="close()">Cancel</button>
        <button class="btn btn--primary" [disabled]="saving" (click)="save()">{{ saving ? 'Saving…' : isNew ? 'Create' : 'Save changes' }}</button>
      </div>
    </section>
  `,
})
export class EditorComponent {
  VIS = VISIBILITY;
  EYEBROW = EYEBROW;

  draft: any = {};
  rawText = '';
  lat: number | null = null;
  lon: number | null = null;
  descIt = '';
  descEn = '';
  isNew = false;
  saving = false;
  tagSet = new Set<string>();
  /** Experience ids this place is part of (POI editor only). */
  expSet = new Set<number>();
  /** The POI core id we sync experience memberships against. */
  private poiCoreId: number | null = null;

  asNum(v: any): number {
    return Number(v);
  }

  constructor(private api: ApiService, public st: StateService, private toast: ToastService) {
    effect(() => {
      const ed = this.st.editor();
      if (ed) this.init(ed);
    });
    // Map drops a point (click or marker drag) → apply to the POI draft.
    effect(() => {
      const p = this.st.pickedPoint();
      const ed = this.st.editor();
      if (p && ed?.kind === 'poi') {
        this.lat = +p.lat.toFixed(6);
        this.lon = +p.lon.toFixed(6);
        this.draft.location = makePoint(p.lon, p.lat);
        this.st.createMode.set(false);
        this.st.editMarker.set({ lon: p.lon, lat: p.lat });
        this.refreshRaw();
      }
    });
  }

  title() {
    if (this.isNew) {
      const k = this.st.editor()?.kind;
      return k === 'poi' ? 'Add a place' : k === 'itinerary' ? 'Add a route' : k === 'tag' ? 'Add a tag' : 'Add an experience';
    }
    return this.draft?.name || '—';
  }

  parentTags() {
    return this.st.tags().filter((t) => t.id !== this.draft?.id);
  }

  private async init(ed: EditorState) {
    this.isNew = ed.isNew;
    let data: any = ed.seed ? { ...ed.seed } : {};
    if (!ed.isNew && ed.id != null) {
      try {
        if (ed.kind === 'poi') data = await this.api.getPoi(ed.id);
        else if (ed.kind === 'itinerary') data = await this.api.getItinerary(ed.id);
        // tags & experiences come full from their list endpoints (seed)
      } catch (e: any) {
        this.toast.show(`Could not load ${ed.kind}: ${e.message}`, 'error');
      }
    }
    data.owner = data.owner || this.st.owner();

    if (ed.kind === 'poi') {
      data.tags = this.tagNames(data.tags);
      const pt = readPoint(data) || (ed.seed?.geometry?.coordinates ? { lon: ed.seed.geometry.coordinates[0], lat: ed.seed.geometry.coordinates[1] } : null);
      this.lat = pt ? pt.lat : null;
      this.lon = pt ? pt.lon : null;
      if (pt) {
        data.location = makePoint(pt.lon, pt.lat);
        this.st.editMarker.set(pt);
        this.st.createMode.set(false);
      } else {
        this.st.editMarker.set(null);
        this.st.createMode.set(true);
      }
      this.tagSet = new Set<string>(data.tags || []);
      if (data.radius == null) data.radius = 30;
      if (data.relevance == null) data.relevance = 5;
      // Derive current experience memberships from the workspace's experiences.
      const coreId = Number(data.id ?? ed.seed?.['id']);
      this.poiCoreId = Number.isFinite(coreId) ? coreId : null;
      this.expSet = new Set<number>();
      if (this.poiCoreId != null) {
        for (const e of this.st.experiences()) {
          if (Array.isArray(e.pois) && e.pois.some((p: any) => Number(p) === this.poiCoreId)) {
            this.expSet.add(Number(e.id));
          }
        }
      }
    } else {
      this.st.editMarker.set(null);
      this.st.createMode.set(false);
      if (ed.kind === 'itinerary') {
        data.pois = Array.isArray(data.pois) ? data.pois : [];
        data.experiences = Array.isArray(data.experiences) ? data.experiences : [];
        data.tags = Array.isArray(data.tags) ? data.tags : [];
        if (this.isNew && !data.color) data.color = '#1007a0';
        if (this.isNew && !data.visibility) data.visibility = 'visible';
      } else if (ed.kind === 'experience') {
        data.pois = Array.isArray(data.pois) ? data.pois : [];
        data.tags = Array.isArray(data.tags) ? data.tags : [];
        data.cross_selling = Array.isArray(data.cross_selling) ? data.cross_selling : [];
        if (this.isNew && data.active == null) data.active = true;
        if (this.isNew && data.listed == null) data.listed = true;
      } else if (ed.kind === 'tag') {
        if (this.isNew && data.visible == null) data.visible = true;
      }
    }
    const dl = parseLocalized(data.description);
    this.descIt = dl.it || '';
    this.descEn = dl.en || '';

    this.draft = data;
    this.refreshRaw();
  }

  onCoord() {
    if (Number.isFinite(this.lat) && Number.isFinite(this.lon)) {
      this.draft.location = makePoint(this.lon!, this.lat!);
      this.st.editMarker.set({ lon: this.lon!, lat: this.lat! });
      this.st.createMode.set(false);
      this.refreshRaw();
    }
  }

  onGallery(items: { img: string }[]) {
    this.draft.gallery = items;
    this.refreshRaw();
  }

  onStops(items: { id: number; name: string }[]) {
    this.draft.pois = items;
    this.refreshRaw();
  }

  onIcon(url: string) {
    this.draft.icon = url;
    this.refreshRaw();
  }

  toggleTag(name: string, on: boolean) {
    if (on) this.tagSet.add(name);
    else this.tagSet.delete(name);
    this.draft.tags = [...this.tagSet];
    this.refreshRaw();
  }

  toggleExp(id: number, on: boolean) {
    if (on) this.expSet.add(id);
    else this.expSet.delete(id);
  }

  /** After a POI save, push any changed experience memberships back via PUTs. */
  private async syncPoiExperiences(poiCoreId: number) {
    const targets: Promise<any>[] = [];
    for (const e of this.st.experiences()) {
      const expId = Number(e.id);
      const pois = (Array.isArray(e.pois) ? e.pois : []).map(Number);
      const was = pois.includes(poiCoreId);
      const now = this.expSet.has(expId);
      if (was === now) continue;
      const nextPois = now ? [...pois, poiCoreId] : pois.filter((p) => p !== poiCoreId);
      targets.push(this.api.updateExperience(expId, { ...e, pois: nextPois }));
    }
    if (targets.length) await Promise.all(targets);
  }

  onRawToggle(open: boolean) {
    if (open) this.refreshRaw();
  }
  refreshRaw() {
    this.rawText = JSON.stringify(this.draft, null, 2);
  }
  onRaw() {
    try {
      this.draft = JSON.parse(this.rawText);
    } catch {
      /* keep typing */
    }
  }

  close() {
    this.st.closeEditor();
  }

  async save() {
    const ed = this.st.editor();
    if (!ed) return;
    this.saving = true;
    try {
      const d = this.draft;
      // Description is stored plain-IT or as a JSON {it,en} string.
      if (ed.kind !== 'tag') d.description = serializeLocalized(this.descIt, this.descEn);
      if (ed.kind === 'poi') {
        if (!d.name) throw new Error('Name is required');
        if (Number.isFinite(this.lat) && Number.isFinite(this.lon)) d.location = makePoint(this.lon!, this.lat!);
        if (!d.location?.coordinates) throw new Error('Location is required — set coordinates');
        const saved: any = ed.isNew ? await this.api.createPoi(d) : await this.api.updatePoi(ed.id!, d);
        // Push experience memberships (only for existing POIs; new ones don't
        // have a stable id until after the create response, but createPoi
        // returns it so we can sync then too).
        const coreId = Number(saved?.id ?? ed.id ?? this.poiCoreId);
        if (Number.isFinite(coreId)) await this.syncPoiExperiences(coreId);
      } else if (ed.kind === 'itinerary') {
        if (!d.name) throw new Error('Name is required');
        // The API writes `pois` as an array of integer ids (read returns objects).
        d.pois = (Array.isArray(d.pois) ? d.pois : [])
          .map((p: any) => (typeof p === 'number' ? p : Number(p?.id)))
          .filter((n: number) => Number.isFinite(n));
        ed.isNew ? await this.api.createItinerary(d) : await this.api.updateItinerary(ed.id!, d);
      } else if (ed.kind === 'tag') {
        if (!d.name) throw new Error('Name is required');
        if (d.parent_id === '' || d.parent_id == null) delete d.parent_id;
        else d.parent_id = Number(d.parent_id);
        ed.isNew ? await this.api.createTag(d) : await this.api.updateTag(ed.id!, d);
      } else {
        ed.isNew ? await this.api.createExperience(d) : await this.api.updateExperience(ed.id!, d);
      }
      this.toast.show(ed.isNew ? 'Created' : 'Saved', 'ok');
      this.st.closeEditor();
      this.st.bumpRefresh();
    } catch (e: any) {
      this.toast.show(e.message, 'error');
    } finally {
      this.saving = false;
    }
  }

  async remove() {
    const ed = this.st.editor();
    if (!ed || ed.id == null) return;
    if (!confirm(`Delete this ${EYEBROW[ed.kind]}? This can't be undone.`)) return;
    try {
      if (ed.kind === 'poi') await this.api.deletePoi(ed.id);
      else if (ed.kind === 'itinerary') await this.api.deleteItinerary(ed.id);
      else if (ed.kind === 'tag') await this.api.deleteTag(ed.id);
      else await this.api.deleteExperience(ed.id);
      this.toast.show('Deleted', 'ok');
      this.st.closeEditor();
      this.st.bumpRefresh();
    } catch (e: any) {
      this.toast.show(e.message, 'error');
    }
  }

  private tagNames(tags: any): string[] {
    if (!Array.isArray(tags)) return [];
    const byId = new Map(this.st.tags().map((t) => [t.id, t.name]));
    return tags.map((t) => (typeof t === 'number' ? byId.get(t) || String(t) : typeof t === 'object' ? t.name : t)).filter(Boolean);
  }
}
