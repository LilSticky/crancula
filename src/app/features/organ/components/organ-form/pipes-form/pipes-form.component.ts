import {Component, input, model} from '@angular/core';
import {DisabledReason, FormValueControl, ValidationError, WithOptionalField} from "@angular/forms/signals";
import {Pipe} from "@api/model/pipe";
import {TranslatePipe} from "@ngx-translate/core";
import {MatIconButton} from "@angular/material/button";
import {MatIcon} from "@angular/material/icon";
import {Pipes} from "@api/model/pipes";
import {CdkDrag, CdkDragDrop, CdkDropList} from "@angular/cdk/drag-drop";
import {TextFormFieldComponent} from "@shared/components/form-field/text-form-field/text-form-field.component";
import {NumberFormFieldComponent} from "@shared/components/form-field/number-form-field/number-form-field.component";
import {
  FormBooleanInput,
  FormDisabledInput,
  FormErrorInput,
  FormNameInput,
  FormNumberInput,
  FormPatternInput,
  FormTouchedModel
} from "@shared/components/form-field/form-control-inputs";

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

  readonly errors: FormErrorInput = input<readonly WithOptionalField<ValidationError>[]>([]);
  readonly disabled: FormBooleanInput = input<boolean>(false);
  readonly disabledReasons: FormDisabledInput = input<readonly WithOptionalField<DisabledReason>[]>([]);
  readonly readonly: FormBooleanInput = input<boolean>(false);
  readonly hidden: FormBooleanInput = input<boolean>(false);
  readonly invalid: FormBooleanInput = input<boolean>(false);
  readonly pending: FormBooleanInput = input<boolean>(false);
  readonly touched: FormTouchedModel = model<boolean>(false);
  readonly dirty: FormBooleanInput = input<boolean>(false);
  readonly name: FormNameInput = input<string>("");
  readonly required: FormBooleanInput = input<boolean>(false);
  readonly min: FormNumberInput = input<number | undefined>();
  readonly minLength: FormNumberInput = input<number | undefined>();
  readonly max: FormNumberInput = input<number | undefined>();
  readonly maxLength: FormNumberInput = input<number | undefined>();
  readonly pattern: FormPatternInput = input<readonly RegExp[]>([]);

  protected remove(pipe: Pipe) {
    return (pipes: Pipes) => pipes.remove(pipe);
  }

  protected move(event: CdkDragDrop<string[]>) {
    return (pipes: Pipes) => pipes.move(event.previousIndex, event.currentIndex)
  }

  protected moveUp(pipe: Pipe) {
    return (pipes: Pipes) => pipes.move(pipe.index, pipe.index + 1);
  }

  protected moveDown(pipe: Pipe) {
    return (pipes: Pipes) => pipes.move(pipe.index, pipe.index - 1);
  }
}
