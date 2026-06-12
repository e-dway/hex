import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UploadService } from '../shared/upload.service';
import { StateService } from '../state/state.service';
import { ToastService } from '../state/toast.service';

interface Img {
  img: string;
}

@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="field">
      <label>Gallery <span class="note">· {{ items.length }} image{{ items.length === 1 ? '' : 's' }}</span></label>

      <div
        class="gallery__grid"
        [class.is-dragover]="dragOver"
        (dragover)="onZoneOver($event)"
        (dragleave)="onZoneLeave($event)"
        (drop)="onDrop($event)"
      >
        <div
          *ngFor="let it of items; let i = index"
          class="gallery__thumb"
          [class.is-dragging]="dragIndex === i"
          draggable="true"
          (dragstart)="reorderStart(i, $event)"
          (dragover)="reorderOver(i, $event)"
          (drop)="reorderDrop(i, $event)"
          (dragend)="dragIndex = -1"
          [title]="it.img"
        >
          <img [src]="it.img" [alt]="'Gallery image ' + (i + 1)" (error)="onImgError($event)" />
          <button type="button" class="gallery__remove" title="Remove image" aria-label="Remove image" (click)="remove(i)">✕</button>
          <span class="gallery__order">{{ i + 1 }}</span>
        </div>

        <div class="gallery__drop">
          {{ uploading ? 'Uploading ' + uploading + '…' : 'Drop images or an image URL here' }}
        </div>
      </div>

      <div class="gallery__add">
        <input type="url" placeholder="Paste an image URL…" [(ngModel)]="urlInput" (keydown.enter)="addUrl(); $event.preventDefault()" />
        <button type="button" class="btn btn--sm" (click)="addUrl()">Add URL</button>
        <button type="button" class="btn btn--sm" (click)="file.click()">Browse…</button>
        <input #file type="file" accept="image/*" multiple hidden (change)="onPick($event)" />
      </div>
    </div>
  `,
})
export class GalleryComponent {
  @Input() set items(v: any) {
    this._items = this.normalize(v);
  }
  get items(): Img[] {
    return this._items;
  }
  @Output() itemsChange = new EventEmitter<Img[]>();

  private _items: Img[] = [];
  urlInput = '';
  dragOver = false;
  dragIndex = -1;
  uploading = 0;

  constructor(public upload: UploadService, private st: StateService, private toast: ToastService) {}

  private normalize(v: any): Img[] {
    if (Array.isArray(v)) return v.filter((x) => x && x.img).map((x) => ({ img: String(x.img) }));
    if (v && typeof v === 'object') return Object.values(v).filter((x: any) => x && x.img).map((x: any) => ({ img: String(x.img) }));
    return [];
  }
  private emit() {
    this.itemsChange.emit([...this._items]);
  }

  addUrl(url = this.urlInput) {
    const u = (url || '').trim();
    if (!/^https?:\/\//.test(u)) {
      if (u) this.toast.show('Enter a full http(s) image URL', 'error');
      return;
    }
    this._items = [...this._items, { img: u }];
    this.urlInput = '';
    this.emit();
  }

  remove(i: number) {
    this._items = this._items.filter((_, idx) => idx !== i);
    this.emit();
  }

  // ---- reorder (HTML5 DnD between thumbnails) ------------------------------
  reorderStart(i: number, e: DragEvent) {
    this.dragIndex = i;
    e.dataTransfer?.setData('text/hex-reorder', String(i));
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  }
  reorderOver(i: number, e: DragEvent) {
    if (this.dragIndex >= 0) {
      e.preventDefault();
      e.stopPropagation();
    }
  }
  reorderDrop(target: number, e: DragEvent) {
    if (this.dragIndex < 0) return;
    e.preventDefault();
    e.stopPropagation();
    const from = this.dragIndex;
    this.dragIndex = -1;
    if (from === target) return;
    const next = [...this._items];
    const [moved] = next.splice(from, 1);
    next.splice(target, 0, moved);
    this._items = next;
    this.emit();
  }

  // ---- drop zone (external files / URLs) ----------------------------------
  onZoneOver(e: DragEvent) {
    if (this.dragIndex >= 0) return; // internal reorder, not an external drop
    e.preventDefault();
    this.dragOver = true;
  }
  onZoneLeave(e: DragEvent) {
    this.dragOver = false;
  }
  async onDrop(e: DragEvent) {
    if (this.dragIndex >= 0) return; // handled by reorderDrop
    e.preventDefault();
    this.dragOver = false;
    const dt = e.dataTransfer;
    if (!dt) return;
    const files = [...(dt.files || [])].filter((f) => f.type.startsWith('image/'));
    if (files.length) {
      await this.uploadFiles(files);
      return;
    }
    const url = dt.getData('text/uri-list') || dt.getData('text/plain');
    if (url) this.addUrl(url.split('\n')[0]);
  }

  async onPick(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = [...(input.files || [])];
    input.value = '';
    if (files.length) await this.uploadFiles(files);
  }

  private async uploadFiles(files: File[]) {
    const owner = this.st.owner();
    for (const f of files) {
      this.uploading++;
      try {
        const url = await this.upload.upload(f, { owner });
        this._items = [...this._items, { img: url }];
        this.emit();
      } catch (err: any) {
        this.toast.show(err.message, 'error');
      } finally {
        this.uploading--;
      }
    }
  }

  onImgError(e: Event) {
    (e.target as HTMLElement).style.opacity = '0.35';
  }
}
