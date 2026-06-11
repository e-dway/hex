// Convenience aliases over the OpenAPI-generated schema (src/app/api/schema.ts).
// Regenerate schema with `npm run gen:api` when the API changes.
import type { components } from './schema';

type S = components['schemas'];

export type POIOut = S['POISchemaOut'];
export type POIDetail = S['POISchemaOut'];
export type POICreate = S['POISchema'];
export type POIUpdate = S['POISchemaUpdate'];
export type ItineraryIn = S['ItineraryInSchema'];
export type ItineraryOut = S['ItineraryOutSchema'];
export type Tag = S['TagSchema'];
export type Experience = S['ExperienceSchema'];
export type Marker = S['MarkerSchema'];
export type Icon = S['IconSchema'];

// The *.geojson endpoints declare no response body in the spec, so we model the
// GeoJSON we actually receive here.
export interface Feature {
  type: 'Feature';
  geometry: { type: string; coordinates: any } | Record<string, never>;
  properties: Record<string, any>;
  id?: number | string;
}
export interface FeatureCollection {
  type: 'FeatureCollection';
  features: Feature[];
  items?: number;
}
export const EMPTY_FC: FeatureCollection = { type: 'FeatureCollection', features: [] };
