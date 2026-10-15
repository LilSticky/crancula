import {Component, signal} from '@angular/core';
import {type ComponentFixture, TestBed} from '@angular/core/testing';
import {type FieldTree, form, FormField, disabled, readonly, validate} from '@angular/forms/signals';
import {vi} from 'vitest';
import {CRANCULA_API, createInMemoryCranculaApi} from '../../core/crancula-api.token';
import {provideTestTranslations} from '../../../testing/test-translations';
import {DecimalInputDirective} from './decimal-input.directive';
import {LanguagePreference} from './language-preference';

interface Draft {
  width: number | null;
}

@Component({
  imports: [FormField, DecimalInputDirective],
  template: `<input crancDecimalInput [formField]="draftForm.width" />`,
})
class HostComponent {
  readonly model = signal<Draft>({width: 1});
  readonly isDisabled = signal(false);
  readonly isReadonly = signal(false);
  readonly draftForm: FieldTree<Draft> = form(this.model, (path) => {
    disabled(path.width, () => this.isDisabled());
    readonly(path.width, () => this.isReadonly());
    validate(path.width, ({value}) => ((value() ?? 0) < 0 ? {kind: 'negative'} : undefined));
  });
}

function stubLocalStorage(): void {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  } satisfies Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>);
}

function setup(language: 'en' | 'de' = 'en') {
  TestBed.configureTestingModule({
    providers: [provideTestTranslations(language), {provide: CRANCULA_API, useValue: createInMemoryCranculaApi()}],
  });
  const preference = TestBed.inject(LanguagePreference);
  const fixture: ComponentFixture<HostComponent> = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
  const type = async (text: string): Promise<void> => {
    input.value = text;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
  };
  const blur = async (): Promise<void> => {
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    await fixture.whenStable();
  };
  return {fixture, host: fixture.componentInstance, input, preference, type, blur};
}

describe('DecimalInputDirective', () => {
  beforeEach(() => stubLocalStorage());
  afterEach(() => vi.unstubAllGlobals());

  it('stores 2.5 for the text "2,5"', async () => {
    const {host, type} = setup();
    await type('2,5');
    expect(host.model().width).toBe(2.5);
  });

  it('stores 2.5 for the text "2.5"', async () => {
    const {host, type} = setup();
    await type('2.5');
    expect(host.model().width).toBe(2.5);
  });

  it('keeps the value and reports a parse error for text that is not a number', async () => {
    const {host, type} = setup();
    await type('abc');
    expect(host.model().width).toBe(1);
    expect(host.draftForm.width().errors().some((error) => error.kind === 'parse')).toBe(true);
  });

  it('shows the value in the notation of the language on blur', async () => {
    const {input, type, blur} = setup('de');
    await type('2.5');
    await blur();
    expect(input.value).toBe('2,5');
  });

  it('reformats the text when the language switches while not focused', async () => {
    const {fixture, host, input, preference} = setup('en');
    host.model.set({width: 2.5});
    fixture.detectChanges();
    expect(input.value).toBe('2.5');

    preference.choose('de');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(input.value).toBe('2,5');
  });

  it('keeps the typed text when the language switches while focused', async () => {
    const {fixture, input, preference, type} = setup('en');
    document.body.appendChild(fixture.nativeElement);
    input.focus();
    await type('2.5');

    preference.choose('de');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(input.value).toBe('2.5');
    fixture.nativeElement.remove();
  });

  it('marks the field touched on blur', async () => {
    const {host, blur} = setup();
    expect(host.draftForm.width().touched()).toBe(false);
    await blur();
    expect(host.draftForm.width().touched()).toBe(true);
  });

  it('renders the input disabled when the field is disabled', async () => {
    const {fixture, host, input} = setup();
    host.isDisabled.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(input.disabled).toBe(true);
  });

  it('renders the input readonly when the field is readonly', async () => {
    const {fixture, host, input} = setup();
    host.isReadonly.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(input.readOnly).toBe(true);
  });

  it('sets aria-invalid when the field is invalid', async () => {
    const {fixture, input, type} = setup();
    expect(input.getAttribute('aria-invalid')).not.toBe('true');
    await type('-1');
    fixture.detectChanges();
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });
});
