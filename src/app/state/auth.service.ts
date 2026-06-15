import { Injectable, computed, signal } from '@angular/core';

/**
 * Mirrors management-front's auth contract (api.hoponmobility.com/2.0) so the
 * same localStorage keys are used and a session is shaped the same way.
 *
 *   POST /auth/login                             -> { access_token }
 *   GET  /admin/users/{email}?mode=full          -> { clients: [<id>, ...] }
 *   GET  /admin/roles/users/{email}              -> [{ roles: { ... } }]
 *
 * On success we land with: token + clients + active clientId + roles in both
 * signals and localStorage (so refresh restores the session).
 */

// Same-origin proxy — Netlify rewrites `/_api/*` to api.hoponmobility.com/2.0,
// and `ng serve`'s proxy.conf.json does the same in dev. See netlify.toml.
const API = '/_api';

const K = {
  login: 'E-DWay:login',
  user: 'E-DWay:user',
  token: 'E-DWay:token',
  clientId: 'E-DWay:client_id',
  clients: 'E-DWay:clients',
  roles: 'E-DWay:roles',
} as const;

@Injectable({ providedIn: 'root' })
export class AuthService {
  token = signal<string | null>(localStorage.getItem(K.token));
  user = signal<string | null>(readJson(K.user));
  clientId = signal<string | null>(localStorage.getItem(K.clientId));
  clients = signal<string[]>(readJson<string[]>(K.clients) || []);
  roles = signal<any>(readJson(K.roles) || {});

  /** True iff a token + active workspace are both set. */
  authenticated = computed(() => !!this.token() && !!this.clientId());

  async login(email: string, password: string): Promise<void> {
    const e = email.trim();
    if (!e || !password) throw new Error('Email and password are required.');

    // 1. exchange credentials for an access token
    const auth: any = await this.request('/auth/login', { method: 'POST', body: { email: e, password } });
    if (!auth?.access_token) throw new Error('Login returned no access token.');
    this.setToken(auth.access_token);
    this.setUser(e);

    // 2. load the user's workspaces
    let info: any;
    try {
      info = await this.request(`/admin/users/${encodeURIComponent(e)}?mode=full`);
    } catch (err: any) {
      this.logout();
      throw new Error(`Could not load user info: ${err.message}`);
    }
    const list: string[] = Array.isArray(info?.clients) ? info.clients : [];
    if (!list.length) {
      this.logout();
      throw new Error('No workspaces are assigned to this account. Contact an administrator.');
    }
    this.setClients(list);
    this.setClientId(list[0]);

    // 3. load roles — block accounts with none assigned (same as management-front)
    let rolesResp: any;
    try {
      rolesResp = await this.request(`/admin/roles/users/${encodeURIComponent(e)}`);
    } catch (err: any) {
      this.logout();
      throw new Error(`Could not load roles: ${err.message}`);
    }
    if (!rolesResp?.length || !rolesResp[0]?.roles) {
      this.logout();
      throw new Error("Access denied — your account has no roles assigned. Contact an administrator to request them.");
    }
    this.setRoles(rolesResp[0].roles);
    localStorage.setItem(K.login, 'ok');
  }

  logout() {
    for (const k of Object.values(K)) localStorage.removeItem(k);
    this.token.set(null);
    this.user.set(null);
    this.clientId.set(null);
    this.clients.set([]);
    this.roles.set({});
  }

  /** Switch active workspace from the dropdown. */
  switchClient(id: string) {
    if (!this.clients().includes(id)) return;
    this.setClientId(id);
  }

  // ---- internals ----------------------------------------------------------
  private async request(path: string, opts: { method?: string; body?: any } = {}): Promise<any> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    const tok = this.token();
    if (tok) headers['Authorization'] = `Bearer ${tok}`;

    let res: Response;
    try {
      res = await fetch(API + path, {
        method: opts.method || 'GET',
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      });
    } catch (e: any) {
      throw new Error(`Network error: ${e.message}`);
    }
    const text = await res.text();
    if (!res.ok) {
      let msg = `${res.status} ${res.statusText}`;
      try {
        const j = JSON.parse(text);
        const dialogName: string | undefined = j?.dialog?.name;
        msg =
          j?.detail ||
          j?.message ||
          j?.error ||
          (dialogName ? humaniseDialog(dialogName) : null) ||
          msg;
      } catch {}
      throw new Error(msg);
    }
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  private setToken(t: string) { this.token.set(t); localStorage.setItem(K.token, t); }
  private setUser(u: string) { this.user.set(u); localStorage.setItem(K.user, JSON.stringify(u)); }
  private setClients(list: string[]) { this.clients.set(list); localStorage.setItem(K.clients, JSON.stringify(list)); }
  private setRoles(r: any) { this.roles.set(r); localStorage.setItem(K.roles, JSON.stringify(r)); }
  private setClientId(id: string) { this.clientId.set(id); localStorage.setItem(K.clientId, id); }
}

// The backend reports errors via a "dialog" object — map the names we know
// to readable messages so the login screen says something useful.
function humaniseDialog(name: string): string {
  switch (name) {
    case 'error_credential': return 'Email or password is incorrect.';
    case 'error_user_disabled': return 'This account has been disabled.';
    case 'error_user_not_found': return 'No account found for that email.';
    case 'error_token_expired': return 'Your session expired — please sign in again.';
    default: return name.replace(/^error_/, '').replace(/_/g, ' ');
  }
}

function readJson<T = any>(key: string): T | null {
  const v = localStorage.getItem(key);
  if (!v) return null;
  try {
    return JSON.parse(v);
  } catch {
    return v as any;
  }
}
