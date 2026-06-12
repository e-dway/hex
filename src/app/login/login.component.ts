import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../state/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <main class="login" (keyup.enter)="submit()">
      <section class="login__card">
        <div class="login__brand">
          <span class="brand__mark" aria-hidden="true">
            <svg viewBox="0 0 28 28" width="32" height="32">
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

        <h1 class="login__title">Sign in</h1>
        <p class="login__hint">Use your HopOnMobility account.</p>

        <div class="field">
          <label for="email">Email</label>
          <input id="email" type="email" autocomplete="email" autofocus
                 [(ngModel)]="email" [disabled]="busy()" placeholder="you@example.com" />
        </div>

        <div class="field">
          <label for="pw">Password</label>
          <input id="pw" type="password" autocomplete="current-password"
                 [(ngModel)]="password" [disabled]="busy()" placeholder="••••••••" />
        </div>

        <div class="login__error" *ngIf="error()">{{ error() }}</div>

        <button class="btn btn--primary login__submit" (click)="submit()" [disabled]="!canSubmit() || busy()">
          {{ busy() ? 'Signing in…' : 'Sign in' }}
        </button>

        <p class="login__legal">
          Authenticates against <code>api.hoponmobility.com</code>. No password is stored locally — only the access token returned on success.
        </p>
      </section>
    </main>
  `,
})
export class LoginComponent {
  email = localStorage.getItem('hex.lastEmail') || '';
  password = '';
  busy = signal(false);
  error = signal<string | null>(null);

  constructor(private auth: AuthService) {}

  canSubmit() {
    return !!this.email.trim() && !!this.password;
  }

  async submit() {
    if (!this.canSubmit() || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.login(this.email, this.password);
      localStorage.setItem('hex.lastEmail', this.email.trim());
      this.password = '';
    } catch (e: any) {
      this.error.set(e.message || 'Sign-in failed.');
    } finally {
      this.busy.set(false);
    }
  }
}
