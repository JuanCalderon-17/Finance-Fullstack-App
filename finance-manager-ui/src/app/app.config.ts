import { ApplicationConfig, importProvidersFrom, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { HttpBackend, HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http'; 
import { provideCharts, withDefaultRegisterables} from 'ng2-charts'
import { routes } from './app.routes';
import { jwtInterceptor  } from './core/interceptors/jwt.interceptor';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';


export function HttpLoaderFactory(http: HttpClient): TranslateLoader {
  return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

export const appConfig: ApplicationConfig = {
  providers: [provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([jwtInterceptor])), 
    provideCharts(withDefaultRegisterables()),

    importProvidersFrom(
      TranslateModule.forRoot({
        defaultLanguage: 'es',
        loader: {
          provide: TranslateLoader,
          useFactory: HttpLoaderFactory, 
          deps: [HttpClient]
        }
      })
    )
  ]   
};
