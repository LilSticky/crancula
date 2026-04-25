import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OrganPage } from './organ.page';

describe('OrganFormPageComponent', () => {
  let component: OrganPage;
  let fixture: ComponentFixture<OrganPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrganPage]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OrganPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
