import {provideRouter} from '@angular/router';
import {TestBed} from '@angular/core/testing';
import {provideTestTranslations} from '../../../../../testing/test-translations';
import {TapeSectionComponent, type TapeSectionView} from './tape-section.component';

const VIEW: TapeSectionView = {
  organId: 'organ-1',
  organName: 'Fairground',
  columnLengthText: '2.5',
  lengthText: '100',
  lengthMmText: '250',
  leadInMm: 30,
  leadInText: '30',
  holesText: '12',
  partNames: [
    {index: 0, name: 'Melody'},
    {index: 2, name: undefined},
  ],
};

async function render(view: TapeSectionView) {
  TestBed.configureTestingModule({providers: [provideTestTranslations(), provideRouter([])]});
  const fixture = TestBed.createComponent(TapeSectionComponent);
  fixture.componentRef.setInput('view', view);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  return {element, section: element.querySelector('[data-testid="tape-section"]')};
}

describe('TapeSectionComponent', () => {
  it('lists Organ, Column length, Columns, length, Lead-in and Holes as a definition list', async () => {
    const {section} = await render(VIEW);

    expect([...(section?.querySelectorAll('dd') ?? [])].slice(0, 6).map((value) => value.textContent?.trim())).toEqual([
      'Fairground',
      '2.5 mm',
      '100',
      '250 mm',
      '30 mm',
      '12',
    ]);
  });

  it('links the Organ to the Organ editor', async () => {
    const {section} = await render(VIEW);

    expect(section?.querySelector('a')?.getAttribute('href')).toBe('/organs/organ-1');
  });

  it('says None for a Lead-in of 0', async () => {
    const {section} = await render({...VIEW, leadInMm: 0, leadInText: '0'});

    expect(section?.textContent).toContain('None');
  });

  it('lists the selected Parts, naming unnamed ones by number', async () => {
    const {element} = await render(VIEW);

    expect([...element.querySelectorAll('[data-testid="selected-part"]')].map((part) => part.textContent?.trim())).toEqual([
      'Melody',
      'Part 3',
    ]);
  });
});
