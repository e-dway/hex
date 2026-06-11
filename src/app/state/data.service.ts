import { Injectable } from '@angular/core';
import { ApiService } from '../api/api.service';
import { StateService } from './state.service';
import { ToastService } from './toast.service';

// Loads the non-spatial reference data (tags are global; experiences are
// owner-scoped). The map owns the bbox-driven geojson view loading.
@Injectable({ providedIn: 'root' })
export class DataService {
  constructor(private api: ApiService, private st: StateService, private toast: ToastService) {}

  async loadTags() {
    try {
      this.st.tags.set(await this.api.listTags());
    } catch (e: any) {
      this.toast.show(`Tags failed to load: ${e.message}`, 'error');
    }
  }

  async loadExperiences() {
    try {
      this.st.experiences.set(await this.api.listExperiences(this.st.owner()));
    } catch (e: any) {
      this.st.experiences.set([]);
      console.warn('experiences load failed', e.message); // 500s for some owners — non-fatal
    }
  }
}
