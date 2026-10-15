import {Component} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {MatFormFieldModule, MAT_FORM_FIELD_DEFAULT_OPTIONS} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {provideFormFieldDefaults} from './form-field-defaults';

@Component({
  selector: 'cranc-form-field-host',
  imports: [MatFormFieldModule, MatInputModule],
  template: `
    <mat-form-field>
      <mat-label>Tape width</mat-label>
      <input matInput />
    </mat-form-field>
  `,
})
class FormFieldHostComponent {}

describe('provideFormFieldDefaults', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({providers: [provideFormFieldDefaults()]});
  });

  it('makes every form field outlined with dynamic subscript sizing', () => {
    const options = TestBed.inject(MAT_FORM_FIELD_DEFAULT_OPTIONS);

    expect(options.appearance).toBe('outline');
    expect(options.subscriptSizing).toBe('dynamic');
  });

  it('renders a form field with a label in the outline appearance', async () => {
    const fixture = TestBed.createComponent(FormFieldHostComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;

    const field = element.querySelector('mat-form-field');
    expect(field?.classList.contains('mat-form-field-appearance-outline')).toBe(true);
    expect(element.querySelector('mat-label')?.textContent).toContain('Tape width');
  });
});
