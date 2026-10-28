import {TestBed} from '@angular/core/testing';
import {MatDialog} from '@angular/material/dialog';
import {provideRouter, Router} from '@angular/router';
import {type Observable, of} from 'rxjs';
import {ORGAN_PRESETS} from '@api/index';
import {provideTestTranslations} from '../../../../testing/test-translations';
import {testOrgan} from '../../../../testing/organs';
import {ConfirmableAction, ConfirmDialogComponent} from '../../shared/components/confirm-dialog/confirm-dialog.component';
import {OrganLibrary} from '../organ-library.store';
import {OrganEditorComponent} from './organ-editor.component';

async function open(id?: string) {
  const fixture = TestBed.createComponent(OrganEditorComponent);
  if (id) fixture.componentRef.setInput('id', id);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const preset = (presetId: string) => element.querySelector<HTMLButtonElement>(`[data-testid="preset-${presetId}"]`);
  const field = (testId: string) => {
    const input = element.querySelector<HTMLInputElement>(`[data-testid="${testId}"]`);
    if (!input) throw new Error(`no field ${testId}`);
    return input;
  };
  const type = async (input: HTMLInputElement, value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };
  /** Presses a preset button and waits for what follows (a confirm dialog, the filled fields). */
  const choose = async (presetId: string) => {
    const button = preset(presetId);
    if (!button) throw new Error(`no preset ${presetId}`);
    button.click();
    await fixture.whenStable();
  };
  /** Presses Save and waits until the write has finished. */
  const save = async () => {
    const button = element.querySelector<HTMLButtonElement>('[data-testid="save-organ"]');
    if (!button) throw new Error('no Save button');
    button.click();
    await fixture.whenStable();
  };
  return {fixture, element, preset, field, type, choose, save};
}

/** Provides a MatDialog whose dialogs close with `confirmed`; returns the mock of its `open`. */
function stubDialog(confirmed: boolean) {
  const openDialog = vi.fn<(component: unknown, config: unknown) => {afterClosed: () => Observable<boolean>}>(() => ({
    afterClosed: () => of(confirmed),
  }));
  TestBed.configureTestingModule({providers: [{provide: MatDialog, useValue: {open: openDialog}}]});
  return openDialog;
}

describe('OrganEditorComponent presets', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({providers: [provideRouter([]), provideTestTranslations()]});
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it.each([
    ['drehorgel-20er', '10', '8.5 mm guide side · 25.35 mm far side'],
    ['drehorgel-31er', '11', '9.75 mm guide side · 11.95 mm far side'],
  ] as const)('fills the Guide margin of %s and shows both Borders of it', async (presetId, guideMargin, border) => {
    const {choose, field} = await open();

    await choose(presetId);

    expect(field('guide-margin').value).toBe(guideMargin);
    expect(field('border').value).toBe(border);
  });

  it('does not offer presets for a stored Organ', async () => {
    const organ = testOrgan('Mine');
    await TestBed.inject(OrganLibrary).put(organ);
    const {preset} = await open(organ.id);
    expect(preset(ORGAN_PRESETS[0].id)).toBeNull();
  });

  it('shows "Start from a preset" as visible text in the page head of a new Organ', async () => {
    const {element} = await open();
    expect(element.querySelector('cranc-page-head')?.textContent).toContain('Start from a preset');
  });

  describe('replacing unsaved changes', () => {
    it('fills a new Organ from a preset without asking when nothing was changed', async () => {
      const openDialog = stubDialog(false);
      const {choose, field} = await open();

      await choose('drehorgel-31er');

      expect(openDialog).not.toHaveBeenCalled();
      expect(field('name').value).toBe('31er-Drehorgel');
    });

    it('asks first through the confirm dialog when the draft has unsaved changes', async () => {
      const openDialog = stubDialog(false);
      const {choose, field, type} = await open();
      await type(field('name'), 'Renamed');

      await choose('drehorgel-31er');

      expect(openDialog).toHaveBeenCalledTimes(1);
      expect(openDialog.mock.calls[0]?.[0]).toBe(ConfirmDialogComponent);
      expect(openDialog.mock.calls[0]?.[1]).toMatchObject({data: {action: ConfirmableAction.DISCARD}});
    });

    it('fills the editor from the preset when the change is confirmed', async () => {
      const openDialog = stubDialog(true);
      const {choose, field, type} = await open();
      await type(field('name'), 'Renamed');

      await choose('drehorgel-31er');

      expect(openDialog).toHaveBeenCalledTimes(1);
      expect(field('name').value).toBe('31er-Drehorgel');
    });

    it('keeps the draft unchanged when the confirm dialog is cancelled', async () => {
      stubDialog(false);
      const {fixture, element, choose, field, type} = await open();
      await type(field('name'), 'Renamed');

      await choose('drehorgel-31er');

      expect(field('name').value).toBe('Renamed');
      expect(element.querySelectorAll('[data-testid="pipe"]')).toHaveLength(0);
      expect(fixture.componentInstance.unsavedChanges()).not.toBeNull();
    });
  });

  describe('saving a chosen preset', () => {
    it('stores one Organ with the original id of the new Organ and the name of the preset', async () => {
      const organId = '5f0c1a2e-3b4d-4e5f-8a9b-0c1d2e3f4a5b';
      vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce(organId);
      vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      const library = TestBed.inject(OrganLibrary);
      const {choose, save} = await open();
      await choose('drehorgel-31er');

      await save();

      expect(library.entities()).toHaveLength(1);
      expect(library.entities()[0]?.id).toBe(organId);
      expect(library.entities()[0]?.name).toBe('31er-Drehorgel');
    });
  });

  describe('editing after choosing a preset', () => {
    it('leaves ORGAN_PRESETS as it was', async () => {
      const before = JSON.stringify(ORGAN_PRESETS);
      const {choose, field, type} = await open();
      await choose('drehorgel-31er');

      await type(field('tape-width'), '100');

      expect(JSON.stringify(ORGAN_PRESETS)).toBe(before);
    });
  });
});
