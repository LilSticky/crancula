import {ComponentFixture, TestBed} from '@angular/core/testing';

import {PipesFormComponent} from './pipes-form.component';

describe('PipesFormComponent', () => {
  let component: PipesFormComponent;
  let fixture: ComponentFixture<PipesFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PipesFormComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(PipesFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
