import {TestBed} from '@angular/core/testing';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {TranslateService} from '@ngx-translate/core';
import {vi} from 'vitest';
import {provideTestTranslations} from '../../../../../testing/test-translations';
import type {LeaveProblem, UnsavedChanges} from '../leave-unsaved.guard';
import {LeaveUnsavedDialogComponent} from './leave-unsaved-dialog.component';

async function render(data: UnsavedChanges) {
  const close = vi.fn<(result?: boolean) => void>();
  TestBed.configureTestingModule({
    providers: [
      provideTestTranslations(),
      {provide: MatDialogRef, useValue: {close}},
      {provide: MAT_DIALOG_DATA, useValue: data},
    ],
  });
  // The wording of the two introductions is not under test; make them recognisable.
  TestBed.inject(TranslateService).setTranslation(
    'en',
    {ORGAN: {LEAVE: {UNSAVED: 'Your changes are not saved.', INVALID: 'Fix these before saving:'}}},
    true,
  );
  const fixture = TestBed.createComponent(LeaveUnsavedDialogComponent);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const button = (testId: string) => {
    const found = element.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`);
    if (!found) throw new Error(`no button ${testId}`);
    return found;
  };
  const problems = () =>
    [...element.querySelectorAll('[data-testid="leave-problem"]')].map((item) =>
      item.textContent?.replace(/\s+/g, ' ').trim(),
    );
  return {element, button, problems, close};
}

const nameMissing: LeaveProblem = {
  field: {key: 'ORGAN.EDITOR.NAME', params: {}},
  message: {key: 'ORGAN.VIOLATION.NAME_REQUIRED', params: {}},
};
const duplicate: LeaveProblem = {
  field: {key: 'ORGAN.EDITOR.ROW', params: {row: 3}},
  message: {key: 'ORGAN.VIOLATION.DUPLICATE_PIPE', params: {noteName: 'C4'}},
};

describe('LeaveUnsavedDialogComponent', () => {
  it('says the changes are not saved when there is no problem', async () => {
    const {element, problems} = await render({problems: []});

    expect(element.textContent).toContain('Your changes are not saved.');
    expect(element.textContent).not.toContain('Fix these before saving:');
    expect(problems()).toEqual([]);
  });

  it('introduces the problems and lists each with its translated field and message', async () => {
    const {element, problems} = await render({problems: [nameMissing, duplicate]});

    expect(element.textContent).toContain('Fix these before saving:');
    expect(element.textContent).not.toContain('Your changes are not saved.');
    expect(problems()).toEqual([
      expect.stringMatching(/^Name\W+Please enter a name\.$/),
      expect.stringMatching(/^Row 3\W+Another Pipe already plays C4\.$/),
    ]);
  });

  it('closes with false when the user stays', async () => {
    const {button, close} = await render({problems: [nameMissing]});

    button('stay').click();

    expect(close).toHaveBeenCalledWith(false);
  });

  it('closes with true when the user discards', async () => {
    const {button, close} = await render({problems: []});

    button('discard').click();

    expect(close).toHaveBeenCalledWith(true);
  });

  it('focuses "stay" initially', async () => {
    const {button} = await render({problems: []});

    expect(button('stay').hasAttribute('cdkFocusInitial')).toBe(true);
  });

  it('shows "stay" as the filled button and "discard" as a text button', async () => {
    const {button} = await render({problems: []});

    expect(button('stay').classList.contains('mdc-button--unelevated')).toBe(true);
    expect(button('discard').classList.contains('mat-mdc-button')).toBe(true);
    expect(button('discard').classList.contains('mdc-button--outlined')).toBe(false);
    expect(button('discard').classList.contains('mdc-button--unelevated')).toBe(false);
  });
});
