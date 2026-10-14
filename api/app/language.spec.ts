import {describe, expect, it} from 'vitest';
import * as api from '../index';
import {isLanguage, type Language} from './language';

describe('isLanguage', () => {
  it.each(['en', 'de'])('accepts the supported language %s', (value) => {
    expect(isLanguage(value)).toBe(true);
  });

  it.each([['fr'], ['EN'], [''], [null], [undefined], [42], [{}]])('rejects %j', (value) => {
    expect(isLanguage(value)).toBe(false);
  });

  it('narrows to Language', () => {
    const value: unknown = 'de';
    if (!isLanguage(value)) throw new Error('expected a language');
    const language: Language = value;
    expect(language).toBe('de');
  });

  it('is exported from the api entry point', () => {
    expect(api.isLanguage).toBe(isLanguage);
  });
});
