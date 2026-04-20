import {Component, model} from '@angular/core';
import {TextFormFieldComponent} from "@shared/components/text-form-field/text-form-field.component";
import {NumberFormFieldComponent} from "@shared/components/number-form-field/number-form-field.component";
import {Field, FormValueControl} from "@angular/forms/signals";
import {newNote, Note} from "@api/model/profile";
import {MatDivider, MatList, MatListItem} from "@angular/material/list";
import {MatFabButton} from "@angular/material/button";
import {MatIcon} from "@angular/material/icon";
import {TranslatePipe} from "@ngx-translate/core";

@Component({
  selector: 'cranc-notes-form',
  imports: [
    TextFormFieldComponent,
    Field,
    NumberFormFieldComponent,
    MatList,
    MatDivider,
    MatListItem,
    MatFabButton,
    MatIcon,
    TranslatePipe,
  ],
  template: `
    <mat-list>
      @for (note of value(); track $index) {
        <mat-list-item class="notes-form-row">
          <cranc-text-form-field
            [field]="note.name"
            label="PAGES.PROFILE.FORM.NOTE_NAME"
          />
          <cranc-number-form-field
            [field]="note.pitch"
            label="PAGES.PROFILE.FORM.NOTE_PITCH"
          />
        </mat-list-item>
        <mat-divider></mat-divider>
      }
      <mat-list-item class="notes-form-row">
        <button matFab extended (click)="addNote()" style="margin: 10px">
          <mat-icon>add</mat-icon>
          {{ 'PAGES.PROFILE.FORM.NEW_NOTE' | translate }}
        </button>
      </mat-list-item>
    </mat-list>
  `,
  styles: `
    .notes-form-row {
      display: flex;
      flex-direction: row;
    }
  `,
})
export class NotesFormComponent implements FormValueControl<Note[]> {
  value = model<Note[]>([]);

  addNote = () => {
    this.value.update(arr => [...arr, newNote()])
  }
}
