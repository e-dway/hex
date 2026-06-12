import { Injectable, signal } from '@angular/core';
import { EMPTY_FC, type Experience, type FeatureCollection, type Tag } from '../api/types';

export type Tab = 'pois' | 'itineraries' | 'tags' | 'experiences';
export type EntityKind = 'poi' | 'itinerary' | 'tag' | 'experience';
export type Selection = { kind: 'poi' | 'itinerary'; id: number } | null;
export interface EditorState {
  kind: EntityKind;
  id?: number;
  isNew: boolean;
  seed?: any; // optional initial data (e.g. clicked feature properties, or a dropped point)
}

@Injectable({ providedIn: 'root' })
export class StateService {
  // The active workspace id. Initialised from the same key the AuthService
  // writes to so a refreshed session shows the right data before the
  // auth->state effect has a chance to run.
  owner = signal(localStorage.getItem('E-DWay:client_id') || '');

  tab = signal<Tab>('pois');
  filter = signal('');

  pois = signal<FeatureCollection>(EMPTY_FC);
  itineraries = signal<FeatureCollection>(EMPTY_FC);
  tags = signal<Tag[]>([]);
  experiences = signal<Experience[]>([]);

  selection = signal<Selection>(null);
  editor = signal<EditorState | null>(null);
  /** A point chosen on the map (bare-click or marker drag) for the editor. */
  pickedPoint = signal<{ lon: number; lat: number } | null>(null);
  /** Where the editor wants the draggable edit marker shown (null = hidden). */
  editMarker = signal<{ lon: number; lat: number } | null>(null);
  /** Map cursor / click-to-place mode (true while adding a new place). */
  createMode = signal(false);

  loading = signal(false);

  /** Bumped after any write so the map view + reference data reload. */
  refreshTick = signal(0);
  bumpRefresh() {
    this.refreshTick.update((n) => n + 1);
  }

  setOwner(o: string) {
    const t = (o || '').trim();
    if (t) this.owner.set(t);
  }

  closeEditor() {
    this.editor.set(null);
    this.selection.set(null);
    this.createMode.set(false);
    this.pickedPoint.set(null);
    this.editMarker.set(null);
  }
}
