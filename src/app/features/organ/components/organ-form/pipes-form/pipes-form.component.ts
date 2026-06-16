import {Component, computed, input, model} from '@angular/core';
import {DisabledReason, FormValueControl, ValidationError, WithOptionalField} from '@angular/forms/signals';
import {OrganPipe} from "@api/model/organPipe";
import {TranslatePipe} from "@ngx-translate/core";
import {MatIconButton} from "@angular/material/button";
import {MatIcon} from "@angular/material/icon";
import {OrganPipes} from "@api/model/organPipes";
import {CdkDrag, CdkDragDrop, CdkDropList} from "@angular/cdk/drag-drop";
import {TextFormFieldComponent} from "@shared/components/form-field/text-form-field/text-form-field.component";
import {
  FormBooleanInput,
  FormDisabledInput,
  FormErrorInput,
  FormNameInput,
  FormNumberInput,
  FormPatternInput,
  FormTouchedModel
} from "@shared/components/form-field/form-control-inputs";
import {NumberFormFieldComponent} from "@shared/components/form-field/number-form-field/number-form-field.component";

function move(from: number, to: number): (pipe: OrganPipes) => OrganPipes {
  return (pipes: OrganPipes): OrganPipes => {
    return pipes.move(from, to) ?? pipes;
  };
}

@Component({
  selector: 'cranc-pipes-form',
  imports: [
    TextFormFieldComponent,
    TranslatePipe,
    MatIcon,
    MatIconButton,
    CdkDropList,
    CdkDrag,
    NumberFormFieldComponent,
  ],
  templateUrl: './pipes-form.component.html',
  styleUrl: './pipes-form.component.scss'
})
export class PipesFormComponent implements FormValueControl<OrganPipes> {
  public readonly errors: FormErrorInput = input<readonly WithOptionalField<ValidationError>[]>([]);
  public readonly disabled: FormBooleanInput = input<boolean>(false);
  public readonly disabledReasons: FormDisabledInput = input<readonly WithOptionalField<DisabledReason>[]>([]);
  public readonly readonly: FormBooleanInput = input<boolean>(false);
  public readonly hidden: FormBooleanInput = input<boolean>(false);
  public readonly invalid: FormBooleanInput = input<boolean>(false);
  public readonly pending: FormBooleanInput = input<boolean>(false);
  public readonly touched: FormTouchedModel = model<boolean>(false);
  public readonly dirty: FormBooleanInput = input<boolean>(false);
  public readonly name: FormNameInput = input<string>("");
  public readonly required: FormBooleanInput = input<boolean>(false);
  public readonly min: FormNumberInput = input<number | undefined>();
  public readonly minLength: FormNumberInput = input<number | undefined>();
  public readonly max: FormNumberInput = input<number | undefined>();
  public readonly maxLength: FormNumberInput = input<number | undefined>();
  public readonly pattern: FormPatternInput = input<readonly RegExp[]>([]);

  public readonly value = model.required<OrganPipes>()
  protected readonly pipes = computed((): OrganPipe[] => this.value().toArray());

  protected remove(pipe: OrganPipe) {
    this.value.update((pipes: OrganPipes) => pipes.remove(pipe));
  }

  protected drop(event: CdkDragDrop<string[]>) {
    this.value.update(move(event.previousIndex, event.currentIndex))
  }

  protected moveUp(pipe: OrganPipe) {
    this.value.update(move(pipe.index, pipe.index - 1));
  }

  protected moveDown(pipe: OrganPipe) {
    this.value.update(move(pipe.index, pipe.index + 1));
  }
}
