import { Component, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TopbarComponent } from './topbar/topbar.component';
import { SidebarComponent } from './sidebar/sidebar.component';
import { MapComponent } from './map/map.component';
import { LoginComponent } from './login/login.component';
import { StateService } from './state/state.service';
import { DataService } from './state/data.service';
import { ToastService } from './state/toast.service';
import { AuthService } from './state/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, TopbarComponent, SidebarComponent, MapComponent, LoginComponent],
  template: `
    <ng-container *ngIf="auth.authenticated(); else loginScreen">
      <app-topbar></app-topbar>
      <main class="layout">
        <app-sidebar></app-sidebar>
        <app-map></app-map>
      </main>
    </ng-container>
    <ng-template #loginScreen>
      <app-login></app-login>
    </ng-template>
    <div id="toast" *ngIf="toast.current() as t" class="toast--show" [class.toast--ok]="t.kind === 'ok'" [class.toast--error]="t.kind === 'error'">
      {{ t.message }}
    </div>
  `,
})
export class AppComponent {
  constructor(
    public toast: ToastService,
    public auth: AuthService,
    private st: StateService,
    private data: DataService,
  ) {
    // Mirror the authenticated client_id into the app's workspace signal so
    // every existing call that reads st.owner() Just Works.
    effect(() => {
      const id = this.auth.clientId();
      if (id && id !== this.st.owner()) this.st.setOwner(id);
    });

    // Tags are global; (re)load on first run and after any write.
    effect(() => {
      this.st.refreshTick();
      if (this.auth.authenticated()) this.data.loadTags();
    });
    // Experiences are owner-scoped; reload on owner change and after writes.
    effect(() => {
      this.st.owner();
      this.st.refreshTick();
      if (this.auth.authenticated()) this.data.loadExperiences();
    });
  }
}
