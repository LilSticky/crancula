import {ChangeDetectionStrategy, Component, computed, effect, inject, input, linkedSignal, untracked} from '@angular/core';
import {MatButton} from '@angular/material/button';
import {MatFormField, MatHint, MatInput, MatLabel} from '@angular/material/input';
import {MatIcon} from '@angular/material/icon';
import {Router} from '@angular/router';
import {TranslatePipe} from '@ngx-translate/core';
import {
  addPipe,
  emptyOrganDraft,
  midiNoteNumber,
  newOrganId,
  noteName,
  type Organ,
  type OrganDraft,
  toDraft,
  toSnapshot,
  validateOrgan,
} from '@api/index';
import {OrganLibrary} from '../organ-library.store';

type TapeBedField = keyof OrganDraft['tapeBed'];

@Component({
  selector: 'cranc-organ-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, MatFormField, MatLabel, MatInput, MatHint, MatButton, MatIcon],
  templateUrl: './organ-editor.component.html',
  styles: `
    .organ-editor {
      display: flex;
      flex-direction: column;
      max-width: 40rem;
    }

    .pipe {
      display: flex;
      align-items: baseline;
      gap: 1rem;
    }
  `,
})
export class OrganEditorComponent {
  /** Route parameter; absent for a new Organ. */
  readonly id = input<string>();

  private readonly library = inject(OrganLibrary);
  private readonly router = inject(Router);

  /** The Organ as it was when opened: the stored one, or a new one with its id already assigned. */
  private readonly opened = computed<OrganDraft>(() => {
    const id = this.id();
    const stored = id ? untracked(() => this.library.entityMap()[id]) : undefined;
    return stored ? toDraft(stored) : {...emptyOrganDraft(), id: newOrganId()};
  });

  /** The Organ as entered; may be invalid. */
  protected readonly draft = linkedSignal<OrganDraft>(() => this.opened());

  /**
   * What the inputs show. It follows the draft only on structural changes (opening an Organ, adding
   * Pipes), so that re-rendering never rewrites a number while it is being typed.
   */
  protected readonly displayed = linkedSignal<OrganDraft>(() => this.opened());

  protected readonly minimumHoleLength = computed(() => this.draft().tapeBed.holeDiameter ?? '');
  protected readonly noteNames = computed(() =>
    this.draft().pipes.map(({note}) => {
      const valid = note === null ? undefined : midiNoteNumber(note);
      return valid === undefined ? '' : noteName(valid);
    }),
  );

  constructor() {
    effect(() => {
      const id = this.id();
      if (id && !untracked(() => this.library.entityMap()[id])) {
        void this.router.navigate(['/organs'], {replaceUrl: true});
      }
    });

    // Store the Organ whenever it is valid (spec FR-012); there is no Save button.
    effect(() => {
      const result = validateOrgan(this.draft());
      if (result.ok) untracked(() => this.store(result.value));
    });
  }

  protected setName(value: string): void {
    this.draft.update((draft) => ({...draft, name: value}));
  }

  protected setTapeBed(field: TapeBedField, value: string): void {
    this.draft.update((draft) => ({...draft, tapeBed: {...draft.tapeBed, [field]: toNumber(value)}}));
  }

  protected setMinimumGap(value: string): void {
    this.draft.update((draft) => ({...draft, minimumGap: toNumber(value)}));
  }

  protected setPipeNote(row: number, value: string): void {
    this.draft.update((draft) => ({
      ...draft,
      pipes: draft.pipes.map((pipe, index) => (index === row ? {note: toNumber(value)} : pipe)),
    }));
  }

  protected addPipe(): void {
    this.changeStructure(addPipe);
  }

  /** Applies a change to the rows and shows the result in the inputs. */
  private changeStructure(change: (draft: OrganDraft) => OrganDraft): void {
    this.draft.update(change);
    this.displayed.set(this.draft());
  }

  private store(organ: Organ): void {
    const stored = this.library.entityMap()[organ.id];
    if (stored && sameOrgan(stored, organ)) return;
    void this.library.put(organ);
    if (!this.id()) void this.router.navigate(['/organs', organ.id], {replaceUrl: true});
  }
}

/** Empty input → `null`; anything else as typed, so that validation can report it. */
function toNumber(value: string): number | null {
  return value.trim() === '' ? null : Number(value);
}

function sameOrgan(a: Organ, b: Organ): boolean {
  return JSON.stringify(toSnapshot([a])) === JSON.stringify(toSnapshot([b]));
}
