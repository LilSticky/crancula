import {TestBed} from '@angular/core/testing';
import {provideTestTranslations} from '../../../../../testing/test-translations';
import type {Zoom} from '../pixels-per-millimetre';
import {TapeStatusLineComponent, type PointerText} from './tape-status-line.component';

interface Inputs {
  readonly pointer?: PointerText | undefined;
  readonly zoom?: Zoom;
  readonly saveProblem?: {readonly reason: string} | null;
}

async function render({pointer, zoom = '1:1', saveProblem = null}: Inputs = {}) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({providers: [provideTestTranslations()]});
  const fixture = TestBed.createComponent(TapeStatusLineComponent);
  fixture.componentRef.setInput('pointer', pointer);
  fixture.componentRef.setInput('zoom', zoom);
  fixture.componentRef.setInput('saveProblem', saveProblem);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const line = element.querySelector('[data-testid="status-line"]');
  const part = (testId: string) => element.querySelector(`[data-testid="${testId}"]`)?.textContent?.replace(/\s+/g, ' ').trim();
  return {text: line?.textContent?.replace(/\s+/g, ' ').trim() ?? '', part};
}

describe('TapeStatusLineComponent', () => {
  it('shows the Column with its mm and the row with its note name while the pointer is over the Tape', async () => {
    const {text} = await render({pointer: {column: '72', mm: '177.5', row: '25', note: 'F5'}});

    expect(text).toContain('Column 72 at 177.5 mm');
    expect(text).toContain('Row 25, F5');
  });

  it('shows no row when the pointer is between rows', async () => {
    const {text, part} = await render({pointer: {column: '72', mm: '177.5', row: undefined, note: ''}});

    expect(text).toContain('Column 72 at 177.5 mm');
    expect(part('pointer-row')).toBeUndefined();
  });

  it('shows no position without the pointer', async () => {
    const {text} = await render();

    expect(text).not.toMatch(/Column \d+ at/);
  });

  it('names the zoom', async () => {
    const {part} = await render({zoom: '2:1'});

    expect(part('zoom-state')).toBe('2:1');
  });

  it('says Saved without a save problem', async () => {
    const {part} = await render();

    expect(part('save-state')).toBe('Saved');
  });

  it('says why the Tapes could not be saved', async () => {
    const {part} = await render({saveProblem: {reason: 'disk full'}});

    expect(part('save-state')).toContain('disk full');
  });
});
