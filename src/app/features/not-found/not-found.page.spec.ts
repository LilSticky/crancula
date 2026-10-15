import {TestBed} from '@angular/core/testing';
import {provideTestTranslations} from '../../../testing/test-translations';
import {NotFoundPage} from './not-found.page';

describe('NotFoundPage', () => {
  it('titles the page in a page head', async () => {
    TestBed.configureTestingModule({providers: [provideTestTranslations()]});
    const fixture = TestBed.createComponent(NotFoundPage);
    fixture.autoDetectChanges();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('h1')).toHaveLength(1);
    expect(element.querySelector('cranc-page-head h1')?.textContent?.trim()).toBe('Something went wrong!');
  });
});
