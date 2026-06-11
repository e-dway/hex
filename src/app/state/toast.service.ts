import { Injectable, signal } from '@angular/core';

export interface Toast {
  message: string;
  kind: 'info' | 'ok' | 'error';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  current = signal<Toast | null>(null);
  private timer: any;

  show(message: string, kind: Toast['kind'] = 'info') {
    this.current.set({ message: String(message).slice(0, 220), kind });
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.current.set(null), 4200);
  }
}
