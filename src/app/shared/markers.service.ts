import { Injectable } from '@angular/core';
import { ApiService } from '../api/api.service';
import type { Marker } from '../api/types';

export interface IconId {
  family: string;
  icon: string;
}

// Builds composed marker-icon URLs via markers.hoponmobility.com and caches the
// (CORS-less) icon list, which is snapshotted to /marker-icons.json at build.
@Injectable({ providedIn: 'root' })
export class MarkersService {
  readonly base = 'https://markers.hoponmobility.com';

  private icons?: Promise<IconId[]>;
  private bases?: Promise<Marker[]>;

  constructor(private api: ApiService) {}

  iconList(): Promise<IconId[]> {
    if (!this.icons) {
      this.icons = fetch('marker-icons.json')
        .then((r) => r.json())
        .then((d: Record<string, string[]>) =>
          Object.entries(d).flatMap(([family, names]) => names.map((icon) => ({ family, icon })))
        )
        .catch(() => []);
    }
    return this.icons;
  }

  baseMarkers(): Promise<Marker[]> {
    if (!this.bases) this.bases = this.api.listMarkers().catch(() => []);
    return this.bases;
  }

  /** Compose URL, e.g. .../marker/fa-church.png?color=%23ff007a&base_img=… */
  compose(family: string, icon: string, color: string, baseImg?: string): string {
    const u = new URL(`${this.base}/marker/${family}-${icon}.png`);
    if (color) u.searchParams.set('color', color); // URLSearchParams encodes '#' → %23
    if (baseImg) u.searchParams.set('base_img', baseImg);
    return u.toString();
  }

  /** Pull back the icon/color/base from a composed URL (for live recolor). */
  parse(url: string | undefined): { icon: IconId; color: string; baseImg: string } | null {
    if (!url || !url.startsWith(this.base)) return null;
    try {
      const u = new URL(url);
      const m = u.pathname.match(/\/marker\/([^/-]+)-(.+)\.png$/);
      if (!m) return null;
      return { icon: { family: m[1], icon: m[2] }, color: u.searchParams.get('color') || '#000000', baseImg: u.searchParams.get('base_img') || '' };
    } catch {
      return null;
    }
  }
}
