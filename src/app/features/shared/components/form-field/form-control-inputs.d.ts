import {InputSignal, InputSignalWithTransform, ModelSignal, OutputRef} from "@angular/core";
import {DisabledReason, ValidationError, WithOptionalField} from "@angular/forms/signals";

export type FormErrorInput =
  InputSignal<readonly WithOptionalField<ValidationError>[]>
  | InputSignalWithTransform<readonly WithOptionalField<ValidationError>[], unknown>;

export type FormBooleanInput = InputSignal<boolean> | InputSignalWithTransform<boolean, unknown>;

export type FormDisabledInput =
  InputSignal<readonly WithOptionalField<DisabledReason>[]>
  | InputSignalWithTransform<readonly WithOptionalField<DisabledReason>[], unknown>;

export type FormTouchedModel =
  ModelSignal<boolean>
  | InputSignal<boolean>
  | InputSignalWithTransform<boolean, unknown>
  | OutputRef<boolean>;

export type FormNameInput = InputSignal<string> | InputSignalWithTransform<string, unknown>;

export type FormNumberInput = InputSignal<number | undefined> | InputSignalWithTransform<number | undefined, unknown>;

export type FormPatternInput = InputSignal<readonly RegExp[]> | InputSignalWithTransform<readonly RegExp[], unknown>;
