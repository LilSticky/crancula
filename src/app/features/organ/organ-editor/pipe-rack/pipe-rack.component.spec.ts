import {TestBed} from '@angular/core/testing';
import {signal} from '@angular/core';
import {type FieldTree, form} from '@angular/forms/signals';
import {ErrorStateMatcher} from '@angular/material/core';
import {TestbedHarnessEnvironment} from '@angular/cdk/testing/testbed';
import {MatMenuHarness} from '@angular/material/menu/testing';
import {type OrganDraft, toDraft} from '@api/index';
import {provideTestTranslations} from '../../../../../testing/test-translations';
import {testOrgan} from '../../../../../testing/organs';
import {organFormSchema, SaveAttempt, ShownViolationMatcher} from '../organ-form';
import {PipeRackComponent} from './pipe-rack.component';

async function render({pipeCount = 4, compact = false}: {readonly pipeCount?: number; readonly compact?: boolean} = {}) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideTestTranslations(), SaveAttempt, {provide: ErrorStateMatcher, useClass: ShownViolationMatcher}],
  });
  const organ: FieldTree<OrganDraft> = TestBed.runInInjectionContext(() => form(signal(toDraft(testOrgan('Positive', pipeCount))), organFormSchema));
  const fixture = TestBed.createComponent(PipeRackComponent);
  fixture.componentRef.setInput('organ', organ);
  fixture.componentRef.setInput('compact', compact);
  const added = vi.fn<() => void>();
  const moved = vi.fn<(move: {from: number; to: number}) => void>();
  const removed = vi.fn<(row: number) => void>();
  fixture.componentInstance.pipeAdded.subscribe(added);
  fixture.componentInstance.pipeMoved.subscribe(moved);
  fixture.componentInstance.pipeRemoved.subscribe(removed);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const loader = TestbedHarnessEnvironment.loader(fixture);
  const choose = async (row: number, testId: string) => {
    const menus = await loader.getAllHarnesses(MatMenuHarness.with({selector: '[data-testid="pipe-menu"]'}));
    const menu = menus[row];
    if (!menu) throw new Error(`no Pipe menu in row ${row}`);
    await menu.open();
    const item = document.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`);
    if (!item) throw new Error(`no menu item ${testId}`);
    item.click();
    await fixture.whenStable();
  };
  return {element, added, moved, removed, choose};
}

describe('PipeRackComponent', () => {
  it('lists the Pipes with their row numbers and note names, spread over 3 columns', async () => {
    const {element} = await render({pipeCount: 6});

    const rows = [...element.querySelectorAll('[data-testid="pipe"]')];
    expect(rows).toHaveLength(6);
    expect(element.querySelectorAll('[data-testid="rack-column"]')).toHaveLength(3);
    expect(rows[0]?.querySelector('[data-testid="pipe-row-number"]')?.textContent?.trim()).toBe('1');
    expect(rows[0]?.querySelector<HTMLInputElement>('[data-testid="pipe-note"]')?.value).toBe('60');
    expect(rows[0]?.querySelector('[data-testid="pipe-note-name"]')?.textContent?.trim()).toBe('C4');
  });

  it('has 2 compact columns in a narrow window', async () => {
    const {element} = await render({pipeCount: 4, compact: true});

    expect(element.querySelectorAll('[data-testid="rack-column"]')).toHaveLength(2);
    expect(element.querySelector('.rack')?.classList.contains('compact')).toBe(true);
  });

  it('counts the Pipes', async () => {
    const {element} = await render({pipeCount: 4});

    expect(element.querySelector('[data-testid="pipe-count"]')?.textContent?.trim()).toBe('4 Pipes');
  });

  it('announces a pressed Add Pipe', async () => {
    const {element, added} = await render();

    element.querySelector<HTMLButtonElement>('[data-testid="add-pipe"]')?.click();

    expect(added).toHaveBeenCalledTimes(1);
  });

  it('announces the removal of the Pipe in the chosen row', async () => {
    const {removed, choose} = await render();

    await choose(1, 'remove-pipe');

    expect(removed).toHaveBeenCalledWith(1);
  });

  it('announces moving a Pipe down from the menu', async () => {
    const {moved, choose} = await render();

    await choose(0, 'move-down');

    expect(moved).toHaveBeenCalledWith({from: 0, to: 1});
  });
});
