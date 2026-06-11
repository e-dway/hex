import { Injectable } from '@angular/core';

/**
 * Configurable image-upload client. The Experiences API has no upload endpoint,
 * so galleries reference externally-hosted URLs. Point this at your upload
 * service and gallery file-drops will POST there and use the returned URL.
 *
 * ▶ TODO: fill in `UPLOAD` with your endpoint. Until `url` is set, file uploads
 *   are disabled (drag-and-drop of image URLs still works).
 */
const UPLOAD = {
  url: '', // e.g. 'https://files.hoponmobility.com/upload'
  method: 'POST',
  fileField: 'file', // multipart form field name for the binary
  headers: {} as Record<string, string>, // e.g. { Authorization: 'Bearer …' }
  fields: {} as Record<string, string>, // extra static form fields
  // Where the resulting URL is in the response: a dot-path into JSON
  // (e.g. 'url', 'data.url', 'location'), or '$text' for a plain-text body.
  responseUrlPath: 'url',
};

@Injectable({ providedIn: 'root' })
export class UploadService {
  get configured() {
    return !!UPLOAD.url;
  }

  /** Upload one image file and resolve to its hosted URL. */
  async upload(file: File, ctx: { owner?: string } = {}): Promise<string> {
    if (!this.configured) {
      throw new Error('Image upload endpoint is not configured (see upload.service.ts).');
    }
    const form = new FormData();
    form.append(UPLOAD.fileField, file, file.name);
    for (const [k, v] of Object.entries(UPLOAD.fields)) form.append(k, v);
    if (ctx.owner) form.append('owner', ctx.owner);

    let res: Response;
    try {
      res = await fetch(UPLOAD.url, { method: UPLOAD.method, headers: UPLOAD.headers, body: form });
    } catch (e: any) {
      throw new Error(`Upload failed: ${e.message}`);
    }
    const text = await res.text();
    if (!res.ok) throw new Error(`Upload ${res.status} ${res.statusText} — ${text.slice(0, 160)}`);

    if (UPLOAD.responseUrlPath === '$text') return text.trim();
    let body: any;
    try {
      body = JSON.parse(text);
    } catch {
      return text.trim(); // tolerate plain-text URL responses
    }
    const url = UPLOAD.responseUrlPath.split('.').reduce((o, k) => (o == null ? o : o[k]), body);
    if (!url || typeof url !== 'string') {
      throw new Error(`Upload succeeded but no URL at "${UPLOAD.responseUrlPath}" in the response.`);
    }
    return url;
  }
}
