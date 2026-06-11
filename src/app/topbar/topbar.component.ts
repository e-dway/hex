import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../state/state.service';
import { ThemeService } from '../state/theme.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule],
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
        <label for="owner">Workspace</label>
        <div class="owner__field">
          <input id="owner" list="owners" autocomplete="off" spellcheck="false"
                 [value]="st.owner()" (change)="onOwner($any($event.target).value)" aria-label="Owner workspace id" />
          <datalist id="owners">
            <option *ngFor="let o of st.knownOwners()" [value]="o"></option>
          </datalist>
        </div>
        <button class="iconbtn" title="Reload data in view" aria-label="Reload" (click)="reload()">
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
      </div>
    </header>
  `,
})
export class TopbarComponent {
  status = computed(() => {
    if (this.st.loading()) return { kind: 'busy', text: 'loading' };
    return { kind: 'ok', text: `${this.st.pois().features.length} places · ${this.st.itineraries().features.length} routes` };
  });

  constructor(public st: StateService, public theme: ThemeService) {}

  onOwner(value: string) {
    this.st.closeEditor();
    this.st.setOwner(value);
  }
  reload() {
    this.st.bumpRefresh();
  }
}
