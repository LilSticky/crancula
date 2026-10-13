import {applyEach, min, minLength, required, schema} from "@angular/forms/signals";
import {OrganPipe} from "@api/model/organPipe";

import {FormOrgan} from "./form-organ";

export const pipeFormSchema = schema<OrganPipe>((path) => {
  required(path.name)
  required(path.pitch)
});

export const organFormSchema = schema<FormOrgan>((path) => {
  // Organ Name
  required(path.name, {message: "FORM_VALIDATION.REQUIRED"});
  minLength(path.name, 1, {message: "FORM_VALIDATION.MIN_LENGTH"})
  // Tape Border
  required(path.tape.tapeBorderMm, {message: "FORM_VALIDATION.REQUIRED"})
  min(path.tape.tapeBorderMm, 0, {message: "FORM_VALIDATION.MIN_VALUE"})
  // Tape Width
  required(path.tape.tapeWidthMm, {message: "FORM_VALIDATION.REQUIRED"})
  min(path.tape.tapeWidthMm, 1, {message: "FORM_VALIDATION.MIN_VALUE"})
  // Hole Spacing
  required(path.tape.holeSpacingMm, {message: "FORM_VALIDATION.REQUIRED"})
  min(path.tape.holeSpacingMm, 0, {message: "FORM_VALIDATION.MIN_VALUE"})
  // Hole Diameter
  required(path.tape.holeDiameterMm, {message: "FORM_VALIDATION.REQUIRED"})
  min(path.tape.holeDiameterMm, 1, {message: "FORM_VALIDATION.MIN_VALUE"})
  // Pipes
  applyEach(path.pipes, pipeFormSchema)
})
