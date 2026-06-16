import {min, minLength, required, schema} from "@angular/forms/signals";
import {Organ} from "@api/model/organ";
import {OrganPipe} from "@api/model/organPipe";

export const pipesFormSchema = schema<OrganPipe[]>((path) => {
  // TODO validate Pipes
  console.log("validation on pipes called", path)
});

export const organFormSchema = schema<Organ>((path) => {
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
  // Ignore Pipes, they are handled by pipesFormSchema
})
