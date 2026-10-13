import {Directive, effect, inject, input} from '@angular/core';
import {MatInput} from '@angular/material/input';

/**
 * Puts a Material input without a form control into its error state, so that its form field turns red
 * and shows its `mat-error` messages.
 */
@Directive({selector: 'input[matInput][crancErrorState]'})
export class ErrorStateDirective {
  readonly crancErrorState = input.required<boolean>();

  private readonly matInput = inject(MatInput);

  constructor() {
    effect(() => {
      this.matInput.errorState = this.crancErrorState();
      this.matInput.stateChanges.next();
    });
  }
}
