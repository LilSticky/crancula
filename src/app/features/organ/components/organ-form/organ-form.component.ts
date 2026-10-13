import {Component, computed, effect, inject, model, OnInit, output, signal} from '@angular/core';
import {Field, form} from "@angular/forms/signals";
import {TranslatePipe} from "@ngx-translate/core";
import {Organ} from "@api/model/organ";
import {MatButton} from "@angular/material/button";
import {PipesFormComponent} from "./pipes-form/pipes-form.component";
import {MatIcon} from "@angular/material/icon";
import {OrganPipe} from "@api/model/organPipe";
import {MatDivider} from "@angular/material/list";
import {MatDialog, MatDialogConfig} from "@angular/material/dialog";
import {ConfirmableAction, ConfirmDialogComponent} from "@shared/components/confirm-dialog/confirm-dialog.component";
import {organFormSchema} from "./organ-form.schema";
import {TextFormFieldComponent} from "@shared/components/form-field/text-form-field/text-form-field.component";
import {NumberFormFieldComponent} from "@shared/components/form-field/number-form-field/number-form-field.component";
import {FormOrgan} from "./form-organ";

@Component({
  selector: 'cranc-organ-form',
  imports: [
    TranslatePipe,
    MatButton,
    PipesFormComponent,
    TextFormFieldComponent,
    NumberFormFieldComponent,
    MatIcon,
    MatDivider,
    Field
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
  public readonly organModel = model.required<Organ>();
  public readonly save = output<Organ>();
  public readonly discard = output<void>();

  private readonly organFormModel = signal<FormOrgan>(new FormOrgan())
  protected readonly organForm = form(this.organFormModel, organFormSchema);
  private initialValue: Organ = new Organ();
  private readonly dialog = inject(MatDialog);


  constructor() {
    effect(() => {
      this.organFormModel.set(new FormOrgan(this.organModel()))
    });
  }

  ngOnInit() {
    this.initialValue = this.organModel();
  }

  protected onSubmit($event: SubmitEvent) {
    $event.preventDefault();
    const value = this.organFormModel();
    console.debug("save organ", value)
    if (value && this.organForm().valid()) {
      this.save.emit(value.get)
      this.organForm().reset(value)
    }
  }

  protected onDiscard() {
    const value = this.initialValue;
    if (value) {
      const config = new MatDialogConfig()
      config.disableClose = false
      config.data = {
        action: ConfirmableAction.DISCARD,
        entity: this.organFormModel()
      }
      const dialogRef = this.dialog.open(ConfirmDialogComponent, config);
      dialogRef.afterClosed().subscribe(confirmed => {
        if (confirmed) {
          this.discard.emit()
          this.organForm().reset(new FormOrgan(value))
        }
      });
    }
  }

  protected addPipe() {
    return (organ: Organ) => {
      organ.pipes = organ.pipes.add(new OrganPipe());
      return organ
    }
  }

  protected cannotDiscard = computed(() => {
    return !this.organForm().dirty()
  })

  protected cannotSave = computed(() => {
    return !this.organForm().dirty() || this.organForm().invalid()
  })
}
