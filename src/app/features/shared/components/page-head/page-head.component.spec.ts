import {ChangeDetectionStrategy, Component, signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {PageHeadComponent} from './page-head.component';

@Component({
  selector: 'cranc-page-head-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeadComponent],
  template: `
    <cranc-page-head [title]="title()" [subtitle]="subtitle()">
      <button pageHeadActions type="button" data-testid="primary-action">New</button>
      <span data-testid="stray">not an action</span>
    </cranc-page-head>
  `,
})
class HostComponent {
  readonly title = signal('Organs');
  readonly subtitle = signal<string | undefined>(undefined);
}

async function render() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const head = () => {
    const found = element.querySelector<HTMLElement>('cranc-page-head');
    if (!found) throw new Error('no cranc-page-head rendered');
    return found;
  };
  return {fixture, host: fixture.componentInstance, element, head};
}

describe('PageHeadComponent', () => {
  it('renders the title as the one h1', async () => {
    const {head} = await render();

    const headings = head().querySelectorAll('h1');
    expect(headings).toHaveLength(1);
    expect(headings[0].textContent?.trim()).toBe('Organs');
  });

  it('follows a changed title', async () => {
    const {fixture, host, head} = await render();

    host.title.set('Tapes');
    await fixture.whenStable();

    expect(head().querySelector('h1')?.textContent?.trim()).toBe('Tapes');
  });

  it('renders no subtitle paragraph when none is given', async () => {
    const {head} = await render();

    expect(head().querySelector('p')).toBeNull();
  });

  it('renders the subtitle as a paragraph when given', async () => {
    const {fixture, host, head} = await render();

    host.subtitle.set('Describe the instrument you want to punch Tapes for.');
    await fixture.whenStable();

    expect(head().querySelector('p')?.textContent?.trim()).toBe('Describe the instrument you want to punch Tapes for.');
  });

  it('projects content marked pageHeadActions into the actions area after the title', async () => {
    const {head} = await render();

    const actions = head().querySelector<HTMLElement>('[data-testid="page-head-actions"]');
    expect(actions?.querySelector('[data-testid="primary-action"]')).not.toBeNull();
    const title = head().querySelector('h1');
    const order = title && actions ? title.compareDocumentPosition(actions) : 0;
    expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps unmarked content out of the actions area', async () => {
    const {head} = await render();

    const actions = head().querySelector<HTMLElement>('[data-testid="page-head-actions"]');
    expect(actions?.querySelector('[data-testid="stray"]')).toBeNull();
  });
});
