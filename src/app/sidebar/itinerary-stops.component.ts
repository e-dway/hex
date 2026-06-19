import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../api/api.service';
import { StateService } from '../state/state.service';
import { ToastService } from '../state/toast.service';

interface Stop {
  id: number;
  name: string;
}

@Component({
  selector: 'app-itinerary-stops',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="field">
      <label>Stops <span class="note">· {{ list.length }} place{{ list.length === 1 ? '' : 's' }}, in order</span></label>

      <div class="stops">
        <div
          *ngFor="let s of list; let i = index"
          class="stops__item"
          [class.is-dragging]="dragIndex === i"
          draggable="true"
          (dragstart)="dragStart(i, $event)"
          (dragover)="dragOver(i, $event)"
          (drop)="drop(i, $event)"
          (dragend)="dragIndex = -1"
        >
          <span class="stops__num">{{ i + 1 }}</span>
          <span class="stops__name">{{ s.name }}</span>
          <span class="stops__id">#{{ s.id }}</span>
          <button type="button" class="stops__remove" title="Remove stop" aria-label="Remove stop" (click)="remove(i)">✕</button>
        </div>
        <div *ngIf="!list.length" class="stops__empty">No stops yet — search a place in view, or add by id.</div>
      </div>

      <div class="stops__add">
        <input type="search" placeholder="Add a place from this workspace…" [(ngModel)]="q" />
        <input type="number" class="stops__idin" placeholder="or id" [(ngModel)]="idInput" (keydown.enter)="addById(); $event.preventDefault()" />
        <button type="button" class="btn btn--sm" (click)="addById()">Add id</button>
      </div>

      <div class="stops__menu" *ngIf="q.trim() && matches().length">
        <button type="button" *ngFor="let m of matches()" (click)="add(m)">
          <span class="stops__name">{{ m.name }}</span><span class="stops__id">#{{ m.id }}</span>
        </button>
      </div>
      <div class="field-hint">Order is the route order. Drag to reorder. The picker lists every place in this workspace; use add-by-id for a place from another workspace.</div>
    </div>
  `,
})
export class ItineraryStopsComponent {
  @Input() set stops(v: any) {
    this.list = this.normalize(v);
  }
  @Output() stopsChange = new EventEmitter<Stop[]>();

  list: Stop[] = [];
  q = '';
  idInput: number | null = null;
  dragIndex = -1;

  constructor(private api: ApiService, private st: StateService, private toast: ToastService) {}

  private nameOf(id: number): string {
    // Match on the feature's root id — that's the POI core id (what
    // PoiSequence.poi_id expects). `properties.id` is the POIMeta id.
    const f = this.st.pois().features.find((x) => Number(x.id) === Number(id));
    return f ? f.properties['name'] || `Place ${id}` : `Place ${id}`;
  }
  private normalize(v: any): Stop[] {
    if (!Array.isArray(v)) return [];
    return v
      .map((p) => (typeof p === 'number' ? { id: p, name: this.nameOf(p) } : p && p.id != null ? { id: +p.id, name: p.name || this.nameOf(+p.id) } : null))
      .filter((x): x is Stop => !!x);
  }
  private emit() {
    this.stopsChange.emit([...this.list]);
  }

  /** Places loaded on the map, not already stops, matching the query. */
  matches(): Stop[] {
    const q = this.q.trim().toLowerCase();
    const have = new Set(this.list.map((s) => String(s.id)));
    return this.st
      .pois()
      .features.map((f) => ({ id: Number(f.id), name: f.properties['name'] || `Place ${f.id}` }))
      .filter((p) => Number.isFinite(p.id) && !have.has(String(p.id)) && (!q || p.name.toLowerCase().includes(q)))
      .slice(0, 8);
  }

  add(s: Stop) {
    if (this.list.some((x) => x.id === s.id)) return;
    this.list = [...this.list, s];
    this.q = '';
    this.emit();
  }

  async addById() {
    const id = Number(this.idInput);
    if (!Number.isFinite(id) || id <= 0) return;
    if (this.list.some((x) => x.id === id)) {
      this.toast.show('That place is already a stop', 'info');
      this.idInput = null;
      return;
    }
    let name = this.nameOf(id);
    if (name === `Place ${id}`) {
      try {
        const p: any = await this.api.getPoi(id);
        name = p?.name || name;
      } catch {
        this.toast.show(`No place with id ${id}`, 'error');
        return;
      }
    }
    this.list = [...this.list, { id, name }];
    this.idInput = null;
    this.emit();
  }

  remove(i: number) {
    this.list = this.list.filter((_, idx) => idx !== i);
    this.emit();
  }

  dragStart(i: number, e: DragEvent) {
    this.dragIndex = i;
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  }
  dragOver(i: number, e: DragEvent) {
    if (this.dragIndex >= 0) e.preventDefault();
  }
  drop(target: number, e: DragEvent) {
    if (this.dragIndex < 0) return;
    e.preventDefault();
    const from = this.dragIndex;
    this.dragIndex = -1;
    if (from === target) return;
    const next = [...this.list];
    const [moved] = next.splice(from, 1);
    next.splice(target, 0, moved);
    this.list = next;
    this.emit();
  }
}
