import {Directive, inject, model} from '@angular/core';
import type {FormValueControl} from '@angular/forms/signals';
import {transformedValue} from '@angular/forms/signals';
import {formatNumber, parseDecimal} from './format-number';
import {LanguagePreference} from './language-preference';

/**
 * A text input for a decimal number, bound with `[formField]`. It shows the value with the decimal separator of the
 * language while not focused, keeps the text as typed while focused, and reads "," and "." as the separator. Text
 * that is not a number is a `parse` error of the field and leaves the value as it was.
 */
@Directive({
  selector: 'input[crancDecimalInput]',
  host: {
    type: 'text',
    inputmode: 'decimal',
    '[value]': 'text()',
    '(input)': 'type($event)',
    '(blur)': 'show()',
  },
})
export class DecimalInputDirective implements FormValueControl<number | null> {
  readonly value = model.required<number | null>();

  private readonly language = inject(LanguagePreference).language;

  protected readonly text = transformedValue<number | null, string>(this.value, {
    parse: (typed) => {
      const parsed = parseDecimal(typed);
      return parsed !== null && Number.isNaN(parsed) ? {error: {kind: 'parse'}} : {value: parsed};
    },
    format: (value) => (value === null ? '' : formatNumber(value, this.language())),
  });

  protected type(event: Event): void {
    if (event.target instanceof HTMLInputElement) this.text.set(event.target.value);
  }

  /** Replaces the typed text by the value in the notation of the language. */
  protected show(): void {
    const value = this.value();
    if (this.text.parseErrors().length === 0) this.text.set(value === null ? '' : formatNumber(value, this.language()));
  }
}
