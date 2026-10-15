import {Provider} from '@angular/core';
import {MAT_FORM_FIELD_DEFAULT_OPTIONS, MatFormFieldDefaultOptions} from '@angular/material/form-field';

const formFieldDefaults: MatFormFieldDefaultOptions = {
  appearance: 'outline',
  subscriptSizing: 'dynamic',
};

/** Outlined fields app-wide: the theme's density -2 hides the labels of fill fields. */
export function provideFormFieldDefaults(): Provider {
  return {provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: formFieldDefaults};
}
