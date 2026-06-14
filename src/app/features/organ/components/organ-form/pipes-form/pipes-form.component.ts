import {Component, model} from '@angular/core';
import {TextFormFieldComponent} from "@shared/components/text-form-field/text-form-field.component";
import {NumberFormFieldComponent} from "@shared/components/number-form-field/number-form-field.component";
import {FormValueControl} from "@angular/forms/signals";
import {Pipe} from "@api/model/pipe";
import {TranslatePipe} from "@ngx-translate/core";
import {MatIconButton} from "@angular/material/button";
import {MatIcon} from "@angular/material/icon";
import {Pipes} from "@api/model/pipes";

@Component({
  selector: 'cranc-pipes-form',
  imports: [
    TextFormFieldComponent,
    NumberFormFieldComponent,
    TranslatePipe,
    MatIcon,
    MatIconButton,

  ],
  template: `
    <div class="pipe-form-list cranc-form-section">
      <h3>{{ 'PAGES.ORGAN.FORM.PIPE_SETTINGS' | translate }}</h3>
      @for (pipe of value(); track pipe.index) {
        <div class="pipes-form-row">
          <cranc-text-form-field
            [(value)]="pipe.name"
            label="PAGES.ORGAN.FORM.PIPE_NAME"
            class="column"
          />
          <cranc-number-form-field
            [(value)]="pipe.pitch"
            label="PAGES.ORGAN.FORM.PIPE_PITCH"
            class="column"
          />
          <span class="cranc-form-section pipe-actions">
            <button matIconButton (click)="value.update(remove(pipe))">
              <mat-icon>delete</mat-icon>
            </button>
            <button matIconButton (click)="value.update(moveUp(pipe))">
              <mat-icon>keyboard_arrow_up</mat-icon>
            </button>
            <button matIconButton (click)="value.update(moveDown(pipe))">
              <mat-icon>keyboard_arrow_down</mat-icon>
            </button>
          </span>
        </div>
      }
    </div>
  `,
  styles: `
    .pipe-actions {
      display: inline-flex;
    }
  `
})
export class PipesFormComponent implements FormValueControl<Pipes> {
  value = model<Pipes>(new Pipes([]));

  protected remove(pipe: Pipe) {
    return (pipes: Pipes) => {
      pipes.remove(pipe)
      return pipes
    };
  }

  protected moveUp(pipe: Pipe) {
    return (pipes: Pipes) => {
      pipes.moveUp(pipe)
      return pipes
    };
  }

  protected moveDown(pipe: Pipe) {
    return (pipes: Pipes) => {
      pipes.moveDown(pipe);
      return pipes;
    };
  }

// TODO drag-and-drop to change pipe order
}
