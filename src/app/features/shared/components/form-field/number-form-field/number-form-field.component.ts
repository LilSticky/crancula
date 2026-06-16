import {Component, input, model} from '@angular/core';
import {MatError, MatFormField, MatInput, MatLabel} from "@angular/material/input";
import {TranslatePipe} from "@ngx-translate/core";
import {
  FormBooleanInput,
  FormDisabledInput,
  FormErrorInput,
  FormNameInput,
  FormNumberInput,
  FormPatternInput,
  FormTouchedModel
} from "@shared/components/form-field/form-control-inputs";
import {DisabledReason, FormValueControl, ValidationError, WithOptionalField} from "@angular/forms/signals";

@Component({
  selector: 'cranc-number-form-field',
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
        type="number"
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
  styles: ``,
})
export class NumberFormFieldComponent implements FormValueControl<number> {
  public readonly errors: FormErrorInput = input<readonly WithOptionalField<ValidationError>[]>([]);
  public readonly disabled: FormBooleanInput = input<boolean>(false);
  public readonly disabledReasons: FormDisabledInput = input<readonly WithOptionalField<DisabledReason>[]>([]);
  public readonly readonly: FormBooleanInput = input<boolean>(false);
  public readonly hidden: FormBooleanInput = input<boolean>(false);
  public readonly invalid: FormBooleanInput = input<boolean>(false);
  public readonly pending: FormBooleanInput = input<boolean>(false);
  public readonly touched: FormTouchedModel = model<boolean>(false);
  public readonly dirty: FormBooleanInput = input<boolean>(false);
  public readonly name: FormNameInput = input<string>("");
  public readonly required: FormBooleanInput = input<boolean>(false);
  public readonly min: FormNumberInput = input<number | undefined>();
  public readonly minLength: FormNumberInput = input<number | undefined>();
  public readonly max: FormNumberInput = input<number | undefined>();
  public readonly maxLength: FormNumberInput = input<number | undefined>();
  public readonly pattern: FormPatternInput = input<readonly RegExp[]>([]);

  value = model.required<number>()
  readonly label = input<string>('')

  set(event: Event) {
    const target = (event as InputEvent).target
    if (target) {
      const value = (target as HTMLInputElement).value;
      this.value.set(parseInt(value));
    }
  }
}
