import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';

// HEX is a single-screen app (no router). Zone-based change detection is kept
// (rather than Angular 21's zoneless default) because the editor updates plain
// component fields after async loads; zones flush those without manual signals.
export const appConfig: ApplicationConfig = {
  providers: [provideBrowserGlobalErrorListeners(), provideZoneChangeDetection({ eventCoalescing: true })],
};
