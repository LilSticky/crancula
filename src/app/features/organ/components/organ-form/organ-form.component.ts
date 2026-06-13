import {Component, model, OnInit, output} from '@angular/core';
import {Field, form} from "@angular/forms/signals";
import {TranslatePipe} from "@ngx-translate/core";
import {Organ} from "@api/model/organ";
import {MatButton} from "@angular/material/button";
import {TextFormFieldComponent} from "@shared/components/text-form-field/text-form-field.component";
import {NumberFormFieldComponent} from "@shared/components/number-form-field/number-form-field.component";
import {PipesFormComponent} from "./pipes-form/pipes-form.component";
import {MatIcon} from "@angular/material/icon";
import {Pipe} from "@api/model/pipe";
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
    MatIcon,
    MatDivider,

  ],
  templateUrl: './organ-form.component.html',
  styles: `
    .organ-form {
      display: flex;
      flex-direction: column;
      width: 40%;
      margin: auto;
    }
  `,
})
export class OrganFormComponent implements OnInit {
  organModel = model.required<Organ>();
  save = output<Organ>();
  discard = output<Organ | undefined>();
  private initialModel?: Organ;
  protected organForm = form(this.organModel);

  ngOnInit() {
    this.initialModel = this.organModel();
  }

  protected onSubmit($event: SubmitEvent) {
    $event.preventDefault();
    const value = this.organModel();
    console.debug("save organ", value)
    if (value) {
      this.save.emit(value)
    } else {
      console.warn('failed to save empty organ')
    }
  }

  protected onDiscard() {
    const model = this.initialModel;
    if (model) {
      this.discard.emit(model)
    } else {
      // TODO confirm dialog if organ has no previous state
    }
  }

  protected onAddPipe() {
    this.organModel.update(organ => {
      organ.pipes.push(new Pipe())
      return organ;
    })
  }

  protected onDeletePipe(_: Pipe) {
    console.error("Delete pipe is not implemented yet")
  }
}
