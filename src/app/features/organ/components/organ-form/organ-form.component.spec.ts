import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OrganFormComponent } from './organ-form.component';

describe('OrganFormComponent', () => {
  let component: OrganFormComponent;
  let fixture: ComponentFixture<OrganFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrganFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OrganFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
