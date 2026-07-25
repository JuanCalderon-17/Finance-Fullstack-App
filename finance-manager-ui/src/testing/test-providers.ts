import { importProvidersFrom } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Routes } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

/**
 * The providers every component/service in this app needs to be instantiated in a
 * test: HTTP (mocked), the router (which also supplies ActivatedRoute) and
 * ngx-translate. Without these, `TestBed.createComponent` throws NullInjectorError.
 *
 * TranslateModule.forRoot() with no loader echoes the key back, so assertions can
 * expect the translation key itself and stay language independent.
 */
export const provideTestingDependencies = (routes: Routes = []) => [
  provideHttpClient(),
  provideHttpClientTesting(),
  provideRouter(routes),
  importProvidersFrom(TranslateModule.forRoot())
];
