import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NumberFormFieldComponent } from './number-form-field.component';

describe('NumberFormFieldComponent', () => {
  let component: NumberFormFieldComponent;
  let fixture: ComponentFixture<NumberFormFieldComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NumberFormFieldComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NumberFormFieldComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
