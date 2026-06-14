import {Component, model} from '@angular/core';
import {TextFormFieldComponent} from "@shared/components/text-form-field/text-form-field.component";
import {NumberFormFieldComponent} from "@shared/components/number-form-field/number-form-field.component";
import {FormValueControl} from "@angular/forms/signals";
import {Pipe} from "@api/model/pipe";
import {TranslatePipe} from "@ngx-translate/core";
import {MatIconButton} from "@angular/material/button";
import {MatIcon} from "@angular/material/icon";
import {Pipes} from "@api/model/pipes";
import {CdkDrag, CdkDragDrop, CdkDropList} from "@angular/cdk/drag-drop";

@Component({
  selector: 'cranc-pipes-form',
  imports: [
    TextFormFieldComponent,
    NumberFormFieldComponent,
    TranslatePipe,
    MatIcon,
    MatIconButton,
    CdkDropList,
    CdkDrag
  ],
  templateUrl: './pipes-form.component.html',
  styleUrl: './pipes-form.component.scss'
})
export class PipesFormComponent implements FormValueControl<Pipes> {
  value = model<Pipes>(new Pipes([]));

  protected remove(pipe: Pipe) {
    return (pipes: Pipes) => {
      pipes.remove(pipe)
      return pipes
    };
  }

  protected move(event: CdkDragDrop<string[]>) {
    this.value.update((pipes: Pipes) => {
      pipes.move(event.previousIndex, event.currentIndex);
      return pipes
    })
  }

  protected moveUp(pipe: Pipe) {
    return (pipes: Pipes) => {
      pipes.move(pipe.index, pipe.index + 1)
      return pipes
    };
  }

  protected moveDown(pipe: Pipe) {
    return (pipes: Pipes) => {
      pipes.move(pipe.index, pipe.index - 1);
      return pipes;
    };
  }
}
