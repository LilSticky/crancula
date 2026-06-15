import {min, minLength, required, SchemaPathTree} from "@angular/forms/signals";
import {Organ} from "@api/model/organ";

export const organFormSchema: (organ: SchemaPathTree<Organ>) => void = (organ: SchemaPathTree<Organ>): void => {
  // Organ Name
  required(organ.name, {message: "FORM_VALIDATION.REQUIRED"});
  minLength(organ.name, 1, {message: "FORM_VALIDATION.MIN_LENGTH"})
  // Tape Border
  required(organ.tape.tapeBorderMm, {message: "FORM_VALIDATION.REQUIRED"})
  min(organ.tape.tapeBorderMm, 0, {message: "FORM_VALIDATION.MIN_VALUE"})
  // Tape Width
  required(organ.tape.tapeWidthMm, {message: "FORM_VALIDATION.REQUIRED"})
  min(organ.tape.tapeWidthMm, 1, {message: "FORM_VALIDATION.MIN_VALUE"})
  // Hole Spacing
  required(organ.tape.holeSpacingMm, {message: "FORM_VALIDATION.REQUIRED"})
  min(organ.tape.holeSpacingMm, 0, {message: "FORM_VALIDATION.MIN_VALUE"})
  // Hole Diameter
  required(organ.tape.holeDiameterMm, {message: "FORM_VALIDATION.REQUIRED"})
  min(organ.tape.holeDiameterMm, 1, {message: "FORM_VALIDATION.MIN_VALUE"})
}
