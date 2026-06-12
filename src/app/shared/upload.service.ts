import { Injectable } from '@angular/core';

/**
 * Image upload — uses the e-dway signer flow (mirrors the management-front
 * `FileUploadService`):
 *
 *   1. `GET  {api}/utils/imgupload/{owner}/{filename}` → `{ url, gurl }`
 *      - `url`  is a presigned S3 PUT URL (single use)
 *      - `gurl` is a presigned GET URL; the bare object URL is `gurl.split('?')[0]`
 *   2. `PUT  {url}` with the file bytes — only `host` is signed, so any
 *      Content-Type works.
 *
 * The bare public URL is what gets stored in the gallery / POI icon field.
 */

// Same-origin proxy — Netlify rewrites `/_api/*` to api.hoponmobility.com/2.0,
// and `ng serve`'s proxy.conf.json does the same in dev. See netlify.toml.
// (The PUT goes to the absolute presigned `cfg.url` on files.hoponmobility.com,
//  whose bucket CORS already allows this site.)
const UPLOAD_API = '/_api';

interface SignerResponse {
  url: string;
  gurl: string;
  type?: string;
}

@Injectable({ providedIn: 'root' })
export class UploadService {
  async upload(file: File, ctx: { owner?: string } = {}): Promise<string> {
    const owner = (ctx.owner || '').trim();
    if (!owner) throw new Error('Upload needs a workspace — pick one in the top bar first.');

    const signerUrl = `${UPLOAD_API}/utils/imgupload/${encodeURIComponent(owner)}/${encodeURIComponent(file.name)}`;

    let cfg: SignerResponse;
    try {
      const res = await fetch(signerUrl);
      if (!res.ok) throw new Error(`Signer ${res.status} ${res.statusText}`);
      cfg = await res.json();
    } catch (e: any) {
      throw new Error(`Could not get an upload URL: ${e.message}`);
    }
    if (!cfg?.url || !cfg?.gurl) throw new Error('Signer returned an unexpected response.');

    try {
      const res = await fetch(cfg.url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Upload ${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 140)}` : ''}`);
      }
    } catch (e: any) {
      throw new Error(`Upload failed: ${e.message}`);
    }

    // The presigned GET URL with its query stripped is the public object URL.
    return cfg.gurl.split('?')[0];
  }
}
