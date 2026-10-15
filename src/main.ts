import {enableProdMode, importProvidersFrom, provideZoneChangeDetection} from '@angular/core';
import {bootstrapApplication} from '@angular/platform-browser';
import {provideHttpClient, withInterceptorsFromDi, withXhr} from '@angular/common/http';
import {provideRouter, withComponentInputBinding} from '@angular/router';

import {AppComponent} from './app/app.component';
import {APP_CONFIG} from './environments/environment';
import {CoreModule} from './app/core/core.module';
import {SharedModule} from './app/shared/shared.module';
import {provideTranslateService} from '@ngx-translate/core';
import {provideTranslateHttpLoader} from '@ngx-translate/http-loader';
import {routes} from "./app.routes";
import {provideOrganLibrary} from "./app/features/organ/organ-library.store";
import {provideTapeLibrary} from "./app/features/tape/tape-library.store";
import {provideFormFieldDefaults} from "./app/features/shared/form-field-defaults";

if (APP_CONFIG.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    provideZoneChangeDetection(),
    provideHttpClient(withXhr(), withInterceptorsFromDi()),
    provideTranslateService({
      loader: provideTranslateHttpLoader({
        prefix: './assets/i18n/',
        suffix: '.json'
      }),
      fallbackLang: 'en',
      lang: 'en'
    }),
    provideRouter(routes, withComponentInputBinding()),
    provideOrganLibrary(),
    provideTapeLibrary(),
    provideFormFieldDefaults(),
    importProvidersFrom(
      CoreModule,
      SharedModule
    ),
  ]
}).catch(err => console.error(err));
