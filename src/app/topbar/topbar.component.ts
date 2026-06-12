import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '../state/state.service';
import { ThemeService } from '../state/theme.service';
import { AuthService } from '../state/auth.service';

const SHORT = (id: string | null) => (id ? `${id.slice(0, 8)}…${id.slice(-4)}` : '—');

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <header class="topbar">
      <div class="brand">
        <span class="brand__mark" aria-hidden="true">
          <svg viewBox="0 0 28 28" width="26" height="26">
            <path class="brand__route" d="M4 22 C 9 22, 9 8, 14 8 S 19 22, 24 6" fill="none"></path>
            <circle class="brand__pin brand__pin--a" cx="4" cy="22" r="3"></circle>
            <circle class="brand__pin brand__pin--b" cx="24" cy="6" r="3"></circle>
          </svg>
        </span>
        <div class="brand__type">
          <span class="brand__name">HEX</span>
          <span class="brand__tag">HopOnMobility · Experiences Manager</span>
        </div>
      </div>

      <div class="owner">
        <label for="ws">Workspace</label>
        <select id="ws" class="owner__select" [ngModel]="auth.clientId()" (ngModelChange)="switch($event)"
                [disabled]="auth.clients().length <= 1" aria-label="Active workspace">
          <option *ngFor="let id of auth.clients()" [value]="id">{{ short(id) }}</option>
        </select>
        <button class="iconbtn" title="Reload data" aria-label="Reload" (click)="reload()">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M20 11A8 8 0 1 0 18 16M20 5v6h-6" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
          </svg>
        </button>
      </div>

      <div class="topbar__right">
        <div class="status" title="Data status">
          <span class="status__dot" [class.is-busy]="status().kind === 'busy'" [class.is-ok]="status().kind === 'ok'"></span>
          <span class="status__text">{{ status().text }}</span>
        </div>
        <button class="iconbtn iconbtn--label" title="Toggle theme" aria-label="Toggle color theme" (click)="theme.cycle()">
          <span aria-hidden="true">{{ theme.icon() }}</span><span>{{ theme.label() }}</span>
        </button>
        <div class="user" *ngIf="auth.user() as u" [title]="u">
          <span class="user__avatar" aria-hidden="true">{{ initial(u) }}</span>
          <button class="iconbtn iconbtn--label" title="Sign out" aria-label="Sign out" (click)="logout()">
            <span aria-hidden="true">↪</span><span>Sign out</span>
          </button>
        </div>
      </div>
    </header>
  `,
})
export class TopbarComponent {
  short = SHORT;

  status = computed(() => {
    if (this.st.loading()) return { kind: 'busy', text: 'loading' };
    return { kind: 'ok', text: `${this.st.pois().features.length} places · ${this.st.itineraries().features.length} routes` };
  });

  constructor(public st: StateService, public theme: ThemeService, public auth: AuthService) {}

  switch(id: string) {
    if (!id || id === this.auth.clientId()) return;
    this.st.closeEditor();
    this.auth.switchClient(id);
  }

  reload() {
    this.st.bumpRefresh();
  }

  initial(u: string) {
    return (u.trim()[0] || '?').toUpperCase();
  }

  logout() {
    this.auth.logout();
  }
}
