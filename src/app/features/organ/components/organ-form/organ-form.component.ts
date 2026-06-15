import {Component, computed, inject, model, OnInit, output} from '@angular/core';
import {Field, form} from "@angular/forms/signals";
import {TranslatePipe} from "@ngx-translate/core";
import {Organ} from "@api/model/organ";
import {MatButton} from "@angular/material/button";
import {PipesFormComponent} from "./pipes-form/pipes-form.component";
import {MatIcon} from "@angular/material/icon";
import {Pipe} from "@api/model/pipe";
import {MatDivider} from "@angular/material/list";
import {MatDialog, MatDialogConfig} from "@angular/material/dialog";
import {ConfirmableAction, ConfirmDialogComponent} from "@shared/components/confirm-dialog/confirm-dialog.component";
import {organFormSchema} from "./organ-form.schema";
import {TextFormFieldComponent} from "@shared/components/form-field/text-form-field/text-form-field.component";
import {NumberFormFieldComponent} from "@shared/components/form-field/number-form-field/number-form-field.component";


@Component({
  selector: 'cranc-organ-form',
  imports: [
    TranslatePipe,
    MatButton,
    PipesFormComponent,
    TextFormFieldComponent,
    NumberFormFieldComponent,
    Field,
    MatIcon,
    MatDivider,

  ],
  templateUrl: './organ-form.component.html',
  styles: `
    .organ-form {
      display: flex;
      flex-direction: column;
      width: 60%;
      margin: auto;
    }
  `,
})
export class OrganFormComponent implements OnInit {
  organModel = model.required<Organ>();
  save = output<Organ>();
  discard = output<Organ | undefined>();
  private initialModel: Organ = new Organ();
  protected organForm = form(this.organModel, organFormSchema);
  dialog = inject(MatDialog);

  ngOnInit() {
    this.initialModel = this.organModel();
  }

  protected onSubmit($event: SubmitEvent) {
    $event.preventDefault();
    const value = this.organModel();
    console.debug("save organ", value)
    if (value && this.organForm().valid()) {
      this.save.emit(value)
      this.organForm().reset(value)
    }
  }

  protected onDiscard() {
    const value = this.initialModel;
    if (value) {
      const config = new MatDialogConfig()
      config.disableClose = false
      config.data = {
        action: ConfirmableAction.DISCARD,
        entity: this.organModel()
      }
      const dialogRef = this.dialog.open(ConfirmDialogComponent, config);
      dialogRef.afterClosed().subscribe(confirmed => {
        if (confirmed) {
          this.discard.emit(value)
          this.organForm().reset(value)
        }
      });
    }
  }

  protected addPipe() {
    return (organ: Organ) => {
      return organ.pipes.add(new Pipe());
    }
  }

  protected cannotDiscard = computed(() => {
    return !this.organForm().dirty()
  })

  protected cannotSave = computed(() => {
    return !this.organForm().dirty() || this.organForm().invalid()
  })
}
