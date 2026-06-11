import {Component, model, output} from '@angular/core';
import {Field, form} from "@angular/forms/signals";
import {TranslatePipe} from "@ngx-translate/core";
import {Organ} from "@api/model/organ";
import {MatButton} from "@angular/material/button";
import {TextFormFieldComponent} from "@shared/components/text-form-field/text-form-field.component";
import {NumberFormFieldComponent} from "@shared/components/number-form-field/number-form-field.component";
import {PipesFormComponent} from "./pipes-form/pipes-form.component";
import {MatDivider} from "@angular/material/list";

@Component({
  selector: 'cranc-organ-form',
  imports: [
    TranslatePipe,
    MatButton,
    PipesFormComponent,
    TextFormFieldComponent,
    NumberFormFieldComponent,
    Field,
    MatDivider,
  ],
  template: `
    <form (submit)="submit($event)" class="organ-form">
      <h2>{{ 'PAGES.ORGAN.FORM.TITLE' | translate }}</h2>

      <!-- General Settings Section -->
      <div class="general-settings">
        <cranc-text-form-field
          [field]="organForm.name"
          label="PAGES.ORGAN.FORM.NAME"
          class="name-input"
        />
      </div>
      <mat-divider/>

      <!-- Tape Settings Section -->
      <div class="tape-settings">
        <h3>{{ 'PAGES.ORGAN.FORM.TAPE_SETTINGS' | translate }}</h3>
        <cranc-number-form-field
          [field]="organForm.tapeWidthMm"
          label="PAGES.ORGAN.FORM.TAPE_WIDTH_MM"
        />
        <cranc-number-form-field
          [field]="organForm.rowHeighMm"
          label="PAGES.ORGAN.FORM.SPROCKET_HOLE_SPACING_MM"
        />
      </div>
      <mat-divider/>

      <!-- Hole Settings Section -->
      <div class="hole-settings">
        <h4>{{ 'PAGES.ORGAN.FORM.HOLE_SETTINGS' | translate }}</h4>
        <cranc-number-form-field
          [field]="organForm.holeDiameterMm"
          label="PAGES.ORGAN.FORM.HOLE_DIAMETER_MM"
        />
        <cranc-number-form-field
          [field]="organForm.holeSpacingMm"
          label="PAGES.ORGAN.FORM.HOLE_SPACING_MM"
        />
        <cranc-number-form-field
          [field]="organForm.columnWidthMm"
          label="PAGES.ORGAN.FORM.COLUMN_WIDTH_MM"
        />
      </div>
      <mat-divider/>

      <!-- Pipes Form Section -->
      <cranc-pipes-form [field]="organForm.pipes"/>
      <mat-divider/>

      <!-- Form Action Section -->
      <div class="form-actions">
        <button matButton="filled" type="submit">{{ 'PAGES.ORGAN.FORM.SAVE' | translate }}</button>
      </div>
    </form>
  `,
  styles: `
    .organ-form {
      display: flex;
      flex-direction: column;
    }

    .tape-settings {
      border: 1px solid #ccc;
      padding: 1rem;
      margin-top: 1rem;
      border-radius: 4px;
    }

    .tape-settings h3 {
      margin-top: 0;
    }
  `,
})
export class OrganFormComponent {
  organModel = model.required<Organ>();
  organForm = form(this.organModel);
  save = output<Organ>();

  submit($event: SubmitEvent) {
    $event.preventDefault();
    const value = this.organModel();
    console.debug("save organ", value)
    if (value) {
      this.save.emit(value)
    } else {
      console.warn('failed to save empty organ')
    }
  }
}
