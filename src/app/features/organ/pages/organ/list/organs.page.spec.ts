import {ComponentFixture, TestBed} from '@angular/core/testing';

import {OrgansPage} from './organs.page';
import {TranslateModule} from '@ngx-translate/core';
import {provideRouter} from '@angular/router';

describe('DetailComponent', () => {
  let component: OrgansPage;
  let fixture: ComponentFixture<OrgansPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [],
      imports: [OrgansPage, TranslateModule.forRoot()],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(OrgansPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render title in a h1 tag', () => {
    const compiled = fixture.debugElement.nativeElement;
    expect(compiled.querySelector('h1').textContent).toContain(
      'PAGES.DETAIL.TITLE'
    );
  });
});
