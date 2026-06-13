import {Component, input, model} from '@angular/core';
import {MatFormField, MatInput, MatLabel} from "@angular/material/input";
import {TranslatePipe} from "@ngx-translate/core";
import {FormValueControl} from "@angular/forms/signals";

@Component({
  selector: 'cranc-text-form-field',
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
        type="text"
        [value]="value()"
        (input)="set($event)"
      >
    </mat-form-field>
  `,
  styles: ``,
})
export class TextFormFieldComponent implements FormValueControl<string> {
  value = model<string>('')
  label = input<string>('')

  set(event: Event) {
    const target = (event as InputEvent).target
    if (target) {
      const value = (target as HTMLInputElement).value;
      this.value.set(value);
    }
  }
}
