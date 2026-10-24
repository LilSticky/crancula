import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {ORGAN_PRESETS} from '@api/index';
import {provideTestTranslations} from '../../../../testing/test-translations';
import {testOrgan} from '../../../../testing/organs';
import {OrganLibrary} from '../organ-library.store';
import {OrganEditorComponent} from './organ-editor.component';

async function open(id?: string) {
  const fixture = TestBed.createComponent(OrganEditorComponent);
  if (id) fixture.componentRef.setInput('id', id);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const preset = (presetId: string) => element.querySelector<HTMLButtonElement>(`[data-testid="preset-${presetId}"]`);
  return {fixture, element, preset};
}

describe('OrganEditorComponent presets', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({providers: [provideRouter([]), provideTestTranslations()]});
  });

  it('offers every preset as a starting point for a new Organ', async () => {
    const {preset} = await open();
    for (const {id} of ORGAN_PRESETS) expect(preset(id)).not.toBeNull();
  });

  it('fills the editor from the chosen preset', async () => {
    const {fixture, element, preset} = await open();
    preset('drehorgel-31er')?.click();
    await fixture.whenStable();
    expect(element.querySelector<HTMLInputElement>('[data-testid="name"]')?.value).toBe('31er-Drehorgel');
    expect(element.querySelectorAll('[data-testid="pipe"]')).toHaveLength(31);
  });

  it('does not offer presets for a stored Organ', async () => {
    const organ = testOrgan('Mine');
    await TestBed.inject(OrganLibrary).put(organ);
    const {preset} = await open(organ.id);
    expect(preset(ORGAN_PRESETS[0].id)).toBeNull();
  });
});
