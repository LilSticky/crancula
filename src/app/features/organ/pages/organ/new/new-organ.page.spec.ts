import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewOrganPage } from './new-organ.page';

describe('OrganFormPageComponent', () => {
  let component: NewOrganPage;
  let fixture: ComponentFixture<NewOrganPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewOrganPage]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NewOrganPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
