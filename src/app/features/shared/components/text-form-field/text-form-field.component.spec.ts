import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TextFormFieldComponent } from './text-form-field.component';

describe('NumberFormFieldComponent', () => {
  let component: TextFormFieldComponent;
  let fixture: ComponentFixture<TextFormFieldComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TextFormFieldComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TextFormFieldComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
