import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewProfilePage } from './new-profile.page';

describe('ProfileFormPageComponent', () => {
  let component: NewProfilePage;
  let fixture: ComponentFixture<NewProfilePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewProfilePage]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NewProfilePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
