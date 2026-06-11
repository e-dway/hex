// Typed API client. CRUD goes through openapi-fetch (fully typed from the spec);
// the *.geojson endpoints have no declared response body, so they use a small
// typed fetch helper that returns a normalised FeatureCollection.
import { Injectable } from '@angular/core';
import createClient from 'openapi-fetch';
import type { paths } from './schema';
import { EMPTY_FC, type Experience, type FeatureCollection, type Marker, type POIDetail, type Tag } from './types';

export const API_BASE = 'https://experiences.hoponmobility.com';

type Result<T> = { data?: T; error?: unknown; response: Response };

@Injectable({ providedIn: 'root' })
export class ApiService {
  private client = createClient<paths>({ baseUrl: API_BASE });

  private unwrap<T>(r: Result<T>): T {
    if (r.error || !r.response.ok) {
      const e: any = r.error;
      const msg =
        (typeof e === 'string' && e) ||
        e?.detail ||
        e?.message ||
        `${r.response.status} ${r.response.statusText}`;
      throw new Error(String(msg).slice(0, 300));
    }
    return r.data as T;
  }

  private async geojson(path: string, q: Record<string, string | number | undefined>): Promise<FeatureCollection> {
    const url = new URL(API_BASE + path);
    for (const [k, v] of Object.entries(q)) if (v != null && v !== '') url.searchParams.set(k, String(v));
    let res: Response;
    try {
      res = await fetch(url);
    } catch (e: any) {
      throw new Error(`Network error: ${e.message}`);
    }
    const text = await res.text();
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${text.split('\n')[0].slice(0, 180)}`);
    let j: any;
    try {
      j = JSON.parse(text);
    } catch {
      throw new Error('Expected GeoJSON but got a non-JSON response');
    }
    return j && j.type === 'FeatureCollection' && Array.isArray(j.features) ? j : EMPTY_FC;
  }

  // ---- POIs ----------------------------------------------------------------
  poisGeojson(bbox: string, owner: string) {
    return this.geojson('/api/pois/pois.geojson', { bbox, owner });
  }
  async getPoi(id: number): Promise<POIDetail> {
    return this.unwrap(await this.client.GET('/api/pois/{poi_id}', { params: { path: { poi_id: id } } }));
  }
  async createPoi(body: any) {
    return this.unwrap(await this.client.POST('/api/pois/', { body }));
  }
  async updatePoi(id: number, body: any) {
    return this.unwrap(await this.client.PUT('/api/pois/{poi_id}', { params: { path: { poi_id: id } }, body }));
  }
  async deletePoi(id: number) {
    return this.unwrap(await this.client.DELETE('/api/pois/{poi_id}', { params: { path: { poi_id: id } } }));
  }

  // ---- Itineraries ---------------------------------------------------------
  itinerariesGeojson(bbox: string, owner: string) {
    return this.geojson('/api/itineraries/itineraries.geojson', { bbox, owner });
  }
  async getItinerary(id: number) {
    return this.unwrap(await this.client.GET('/api/itineraries/{itinerary_id}', { params: { path: { itinerary_id: id } } }));
  }
  async createItinerary(body: any) {
    return this.unwrap(await this.client.POST('/api/itineraries/', { body }));
  }
  async updateItinerary(id: number, body: any) {
    return this.unwrap(await this.client.PUT('/api/itineraries/{itinerary_id}', { params: { path: { itinerary_id: id } }, body }));
  }
  async deleteItinerary(id: number) {
    return this.unwrap(await this.client.DELETE('/api/itineraries/{itinerary_id}', { params: { path: { itinerary_id: id } } }));
  }

  // ---- Reference -----------------------------------------------------------
  async listMarkers(): Promise<Marker[]> {
    const r: any = this.unwrap(await this.client.GET('/api/utils/markers/', { params: { query: {} as any } }));
    return (r?.results ?? []) as Marker[];
  }

  // ---- Tags ----------------------------------------------------------------
  async listTags(): Promise<Tag[]> {
    return this.unwrap(await this.client.GET('/api/tags/', { params: { query: {} as any } })) as Tag[];
  }
  async createTag(body: any) {
    return this.unwrap(await this.client.POST('/api/tags/', { body }));
  }
  async updateTag(id: number, body: any) {
    return this.unwrap(await this.client.PUT('/api/tags/{tag_id}', { params: { path: { tag_id: id } }, body }));
  }
  async deleteTag(id: number) {
    return this.unwrap(await this.client.DELETE('/api/tags/{tag_id}', { params: { path: { tag_id: id } } }));
  }

  // ---- Experiences ---------------------------------------------------------
  async listExperiences(owner: string, ipp = 100): Promise<Experience[]> {
    const r: any = this.unwrap(
      await this.client.GET('/api/experiences/', { params: { query: { owner, ipp, page: 0 } } })
    );
    return (r?.results ?? []) as Experience[];
  }
  async createExperience(body: any) {
    return this.unwrap(await this.client.POST('/api/experiences/', { body }));
  }
  async updateExperience(id: number, body: any) {
    return this.unwrap(await this.client.PUT('/api/experiences/{experience_id}', { params: { path: { experience_id: id } }, body }));
  }
  async deleteExperience(id: number) {
    return this.unwrap(await this.client.DELETE('/api/experiences/{experience_id}', { params: { path: { experience_id: id } } }));
  }
}
