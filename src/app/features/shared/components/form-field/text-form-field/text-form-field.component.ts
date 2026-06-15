import {Component, input, model} from '@angular/core';
import {MatError, MatFormField, MatInput, MatLabel} from "@angular/material/input";
import {TranslatePipe} from "@ngx-translate/core";
import {DisabledReason, FormValueControl, ValidationError, WithOptionalField} from "@angular/forms/signals";
import {
  FormBooleanInput,
  FormDisabledInput,
  FormErrorInput,
  FormNameInput,
  FormNumberInput,
  FormPatternInput,
  FormTouchedModel
} from "@shared/components/form-field/form-control-inputs";

@Component({
  selector: 'cranc-text-form-field',
  imports: [
    MatFormField,
    MatInput,
    MatLabel,
    TranslatePipe,
    MatError
  ],
  template: `
    <mat-form-field>
      <mat-label>{{ label() | translate }}</mat-label>
      <input
        matInput
        type="text"
        [value]="value()"
        (input)="set($event)"
      >
      @if (invalid()) {
        @for (error of errors(); track $index) {
          <mat-error>{{ error.message | translate }}</mat-error>
        }
      }
    </mat-form-field>
  `,
})
export class TextFormFieldComponent implements FormValueControl<string> {
  readonly value = model<string>('')
  readonly label = input<string>('')

  readonly errors: FormErrorInput = input<readonly WithOptionalField<ValidationError>[]>([]);
  readonly disabled: FormBooleanInput = input<boolean>(false);
  readonly disabledReasons: FormDisabledInput = input<readonly WithOptionalField<DisabledReason>[]>([]);
  readonly readonly: FormBooleanInput = input<boolean>(false);
  readonly hidden: FormBooleanInput = input<boolean>(false);
  readonly invalid: FormBooleanInput = input<boolean>(false);
  readonly pending: FormBooleanInput = input<boolean>(false);
  readonly touched: FormTouchedModel = model<boolean>(false);
  readonly dirty: FormBooleanInput = input<boolean>(false);
  readonly name: FormNameInput = input<string>("");
  readonly required: FormBooleanInput = input<boolean>(false);
  readonly min: FormNumberInput = input<number | undefined>();
  readonly minLength: FormNumberInput = input<number | undefined>();
  readonly max: FormNumberInput = input<number | undefined>();
  readonly maxLength: FormNumberInput = input<number | undefined>();
  readonly pattern: FormPatternInput = input<readonly RegExp[]>([]);

  set(event: Event) {
    const target = (event as InputEvent).target
    if (target) {
      const value = (target as HTMLInputElement).value;
      this.value.set(value);
    }
  }
}
