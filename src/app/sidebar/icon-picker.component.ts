import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconId, MarkersService } from '../shared/markers.service';
import { UploadService } from '../shared/upload.service';
import { StateService } from '../state/state.service';
import { ToastService } from '../state/toast.service';
import type { Marker } from '../api/types';

@Component({
  selector: 'app-icon-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="field">
      <label>Icon</label>
      <div class="icon-field" [class.is-dragover]="dragOver" (dragover)="onOver($event)" (dragleave)="dragOver = false" (drop)="onDrop($event)">
        <div class="icon-field__preview">
          <img *ngIf="current" [src]="current" alt="" (error)="onImgError($event)" />
          <span *ngIf="!current">＋</span>
        </div>
        <input type="url" [ngModel]="current" (ngModelChange)="setUrl($event)" placeholder="Paste or drop an image URL — or compose below" />
      </div>

      <details class="adv">
        <summary>Compose a marker</summary>
        <div class="iconpick">
          <div class="iconpick__row">
            <label class="iconpick__color" title="Icon color">
              <input type="color" [(ngModel)]="color" (ngModelChange)="recolor()" /><span>Color</span>
            </label>
            <select [(ngModel)]="baseImg" (ngModelChange)="recolor()" title="Base marker">
              <option value="">Default base</option>
              <option *ngFor="let b of bases" [value]="b.base_img || ''">{{ b.name }}</option>
            </select>
          </div>
          <input class="iconpick__search" type="search" [(ngModel)]="q" [placeholder]="'Search ' + total + ' icons (fa, ra)…'" />
          <div class="iconpick__grid" *ngIf="q.trim()">
            <button type="button" *ngFor="let m of matches()" (click)="pick(m)" [class.is-active]="isActive(m)" [title]="m.family + '-' + m.icon">
              <img [src]="thumb(m)" loading="lazy" alt="" />
            </button>
            <div *ngIf="!matches().length" class="iconpick__none">No icons match “{{ q }}”.</div>
          </div>
          <div class="field-hint" *ngIf="!q.trim()">Type to search Font Awesome (<code>fa</code>) and RPG-Awesome (<code>ra</code>) icons.</div>
        </div>
      </details>
    </div>
  `,
})
export class IconPickerComponent implements OnInit {
  @Input() set value(v: string | undefined) {
    this.current = v || '';
    const parsed = this.markers.parse(this.current);
    if (parsed) {
      this.lastPick = parsed.icon;
      this.color = parsed.color;
      this.baseImg = parsed.baseImg;
    }
  }
  @Output() valueChange = new EventEmitter<string>();

  current = '';
  color = '#ff007a';
  baseImg = '';
  q = '';
  bases: Marker[] = [];
  total = 0;
  dragOver = false;

  private icons: IconId[] = [];
  private lastPick: IconId | null = null;

  constructor(
    private markers: MarkersService,
    public upload: UploadService,
    private st: StateService,
    private toast: ToastService,
  ) {}

  async ngOnInit() {
    this.icons = await this.markers.iconList();
    this.total = this.icons.length;
    this.bases = await this.markers.baseMarkers();
  }

  matches(): IconId[] {
    const q = this.q.trim().toLowerCase();
    if (!q) return [];
    const out: IconId[] = [];
    for (const m of this.icons) {
      if (m.icon.includes(q) || m.family === q) {
        out.push(m);
        if (out.length >= 24) break;
      }
    }
    return out;
  }
  thumb(m: IconId) {
    return this.markers.compose(m.family, m.icon, this.color, this.baseImg || undefined);
  }
  isActive(m: IconId) {
    return this.lastPick?.family === m.family && this.lastPick?.icon === m.icon;
  }

  pick(m: IconId) {
    this.lastPick = m;
    this.setUrl(this.thumb(m));
  }
  recolor() {
    if (this.lastPick) this.setUrl(this.thumb(this.lastPick));
  }

  setUrl(v: string) {
    this.current = v;
    this.valueChange.emit(v);
  }

  onOver(e: DragEvent) {
    e.preventDefault();
    this.dragOver = true;
  }
  async onDrop(e: DragEvent) {
    e.preventDefault();
    this.dragOver = false;
    const dt = e.dataTransfer;
    if (!dt) return;
    const file = [...(dt.files || [])].find((f) => f.type.startsWith('image/'));
    if (file) {
      try {
        this.setUrl(await this.upload.upload(file, { owner: this.st.owner() }));
      } catch (err: any) {
        this.toast.show(err.message, 'error');
      }
      return;
    }
    const url = dt.getData('text/uri-list') || dt.getData('text/plain');
    if (url) this.setUrl(url.split('\n')[0].trim());
  }

  onImgError(e: Event) {
    (e.target as HTMLElement).style.opacity = '0.3';
  }
}
