import {enableProdMode, importProvidersFrom, provideZoneChangeDetection} from '@angular/core';
import {bootstrapApplication} from '@angular/platform-browser';
import {provideHttpClient, withInterceptorsFromDi} from '@angular/common/http';
import {provideRouter} from '@angular/router';

import {AppComponent} from './app/app.component';
import {APP_CONFIG} from './environments/environment';
import {CoreModule} from './app/core/core.module';
import {SharedModule} from './app/shared/shared.module';
import {provideTranslateService} from '@ngx-translate/core';
import {provideTranslateHttpLoader} from '@ngx-translate/http-loader';
import {routes} from "./app.routes";

if (APP_CONFIG.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    provideZoneChangeDetection(),
    provideHttpClient(withInterceptorsFromDi()),
    provideTranslateService({
      loader: provideTranslateHttpLoader({
        prefix: './assets/i18n/',
        suffix: '.json'
      }),
      fallbackLang: 'en',
      lang: 'en'
    }),
    provideRouter(routes),
    importProvidersFrom(
      CoreModule,
      SharedModule
    ),
  ]
}).catch(err => console.error(err));
