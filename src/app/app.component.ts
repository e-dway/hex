import { Component, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TopbarComponent } from './topbar/topbar.component';
import { SidebarComponent } from './sidebar/sidebar.component';
import { MapComponent } from './map/map.component';
import { StateService } from './state/state.service';
import { DataService } from './state/data.service';
import { ToastService } from './state/toast.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, TopbarComponent, SidebarComponent, MapComponent],
  template: `
    <app-topbar></app-topbar>
    <main class="layout">
      <app-sidebar></app-sidebar>
      <app-map></app-map>
    </main>
    <div id="toast" *ngIf="toast.current() as t" class="toast--show" [class.toast--ok]="t.kind === 'ok'" [class.toast--error]="t.kind === 'error'">
      {{ t.message }}
    </div>
  `,
})
export class AppComponent {
  constructor(public toast: ToastService, private st: StateService, private data: DataService) {
    // Tags are global; (re)load on first run and after any write.
    effect(() => {
      this.st.refreshTick();
      this.data.loadTags();
    });
    // Experiences are owner-scoped; reload on owner change and after writes.
    effect(() => {
      this.st.owner();
      this.st.refreshTick();
      this.data.loadExperiences();
    });
  }
}
