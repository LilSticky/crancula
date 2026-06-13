import {Component, input, model} from '@angular/core';
import {MatFormField, MatInput, MatLabel} from "@angular/material/input";
import {TranslatePipe} from "@ngx-translate/core";
import {FormValueControl} from "@angular/forms/signals";

@Component({
  selector: 'cranc-number-form-field',
  imports: [
    MatFormField,
    MatInput,
    MatLabel,
    TranslatePipe
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
    </mat-form-field>
  `,
  styles: ``,
})
export class NumberFormFieldComponent implements FormValueControl<number> {
  value = model<number>(0)
  label = input<string>('')

  set(event: Event) {
    const target = (event as InputEvent).target
    if (target) {
      const value = (target as HTMLInputElement).value;
      this.value.set(parseInt(value));
    }
  }
}
