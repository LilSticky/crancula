import type {Provider} from '@angular/core';
import {provideTranslateLoader, provideTranslateService, type TranslateLoader, type TranslationObject} from '@ngx-translate/core';
import {type Observable, of} from 'rxjs';
import de from '../assets/i18n/de.json';
import en from '../assets/i18n/en.json';

class StaticTranslationLoader implements TranslateLoader {
  getTranslation(lang: string): Observable<TranslationObject> {
    return of(lang === 'de' ? de : en);
  }
}

/** The real English and German texts, without HTTP. */
export function provideTestTranslations(lang: 'en' | 'de' = 'en'): Provider[] {
  return provideTranslateService({loader: provideTranslateLoader(StaticTranslationLoader), lang, fallbackLang: 'en'});
}
