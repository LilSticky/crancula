import {ComponentFixture, TestBed} from '@angular/core/testing';

import {ProfilesPage} from './profiles.page';
import {TranslateModule} from '@ngx-translate/core';
import {provideRouter} from '@angular/router';

describe('DetailComponent', () => {
  let component: ProfilesPage;
  let fixture: ComponentFixture<ProfilesPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [],
      imports: [ProfilesPage, TranslateModule.forRoot()],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(ProfilesPage);
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
