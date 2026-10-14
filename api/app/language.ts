/** The languages the application is translated into. */
export type Language = 'en' | 'de';

export function isLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'de';
}
