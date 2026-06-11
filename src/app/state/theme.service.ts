import { Injectable, signal } from '@angular/core';

export type ThemePref = 'auto' | 'light' | 'dark';
const ICON: Record<ThemePref, string> = { auto: '◐', light: '☀', dark: '☾' };

@Injectable({ providedIn: 'root' })
export class ThemeService {
  pref = signal<ThemePref>((localStorage.getItem('hex.theme') as ThemePref) || 'auto');
  resolved = signal<'light' | 'dark'>('light');

  private mq = matchMedia('(prefers-color-scheme: dark)');

  constructor() {
    this.apply();
    this.mq.addEventListener('change', () => {
      if (this.pref() === 'auto') this.resolved.set(this.compute());
    });
  }

  icon() {
    return ICON[this.pref()];
  }
  label() {
    const p = this.pref();
    return p[0].toUpperCase() + p.slice(1);
  }

  cycle() {
    const order: ThemePref[] = ['auto', 'light', 'dark'];
    const next = order[(order.indexOf(this.pref()) + 1) % order.length];
    this.pref.set(next);
    localStorage.setItem('hex.theme', next);
    this.apply();
  }

  private compute(): 'light' | 'dark' {
    const p = this.pref();
    return p === 'auto' ? (this.mq.matches ? 'dark' : 'light') : p;
  }
  private apply() {
    // Forced themes set color-scheme inline; "auto" defers to CSS (follows OS).
    document.documentElement.style.colorScheme = this.pref() === 'auto' ? '' : this.pref();
    this.resolved.set(this.compute());
  }
}
