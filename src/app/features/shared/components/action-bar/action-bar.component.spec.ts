import {ChangeDetectionStrategy, Component, signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {ActionBarComponent} from './action-bar.component';

@Component({
  selector: 'cranc-action-bar-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ActionBarComponent],
  template: `
    <cranc-action-bar [label]="label()">
      <span actionBarState data-testid="state">Unsaved changes</span>
      <button type="button" data-testid="save">Save</button>
    </cranc-action-bar>
  `,
})
class HostComponent {
  readonly label = signal('Organ actions');
}

async function render() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const bar = () => {
    const found = element.querySelector<HTMLElement>('cranc-action-bar');
    if (!found) throw new Error('no cranc-action-bar rendered');
    return found;
  };
  return {fixture, host: fixture.componentInstance, bar};
}

describe('ActionBarComponent', () => {
  it('is a labelled region', async () => {
    const {bar} = await render();

    expect(bar().getAttribute('role')).toBe('region');
    expect(bar().getAttribute('aria-label')).toBe('Organ actions');
  });

  it('follows a changed label', async () => {
    const {fixture, host, bar} = await render();

    host.label.set('Tape actions');
    await fixture.whenStable();

    expect(bar().getAttribute('aria-label')).toBe('Tape actions');
  });

  it('projects content marked actionBarState into the state area on the left', async () => {
    const {bar} = await render();

    const state = bar().querySelector<HTMLElement>('[data-testid="action-bar-state"]');
    expect(state?.querySelector('[data-testid="state"]')?.textContent?.trim()).toBe('Unsaved changes');
  });

  it('projects the remaining content into the actions area after the state', async () => {
    const {bar} = await render();

    const state = bar().querySelector<HTMLElement>('[data-testid="action-bar-state"]');
    const actions = bar().querySelector<HTMLElement>('[data-testid="action-bar-actions"]');
    expect(actions?.querySelector('[data-testid="save"]')).not.toBeNull();
    expect(actions?.querySelector('[data-testid="state"]')).toBeNull();
    expect(state?.querySelector('[data-testid="save"]')).toBeNull();
    const order = state && actions ? state.compareDocumentPosition(actions) : 0;
    expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
