import {Injectable, inject, signal} from '@angular/core';
import {TranslateService} from '@ngx-translate/core';
import {isLanguage, type Language} from '@api/index';
import {firstValueFrom} from 'rxjs';
import {CRANCULA_API} from '../../core/crancula-api.token';

const LANGUAGE_KEY = 'crancula.language';

/** The language the user picked, remembered in `localStorage`, applied to the translations and told to the main process. */
@Injectable({providedIn: 'root'})
export class LanguagePreference {
  private readonly translate = inject(TranslateService);
  private readonly api = inject(CRANCULA_API);
  private readonly current = signal<Language>(this.initial());

  readonly language = this.current.asReadonly();

  constructor() {
    this.apply(this.current());
  }

  choose(language: Language): void {
    localStorage.setItem(LANGUAGE_KEY, language);
    this.current.set(language);
    this.apply(language);
  }

  private initial(): Language {
    const stored = localStorage.getItem(LANGUAGE_KEY);
    const current = this.translate.getCurrentLang();
    return isLanguage(stored) ? stored : isLanguage(current) ? current : 'en';
  }

  private apply(language: Language): void {
    void firstValueFrom(this.translate.use(language));
    void this.api.app.setLanguage(language);
  }
}
