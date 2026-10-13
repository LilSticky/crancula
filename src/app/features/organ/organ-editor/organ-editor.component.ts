import {ChangeDetectionStrategy, Component, computed, effect, inject, input, linkedSignal, signal, untracked} from '@angular/core';
import type {ErrorStateMatcher} from '@angular/material/core';
import {MatButton} from '@angular/material/button';
import {MatError, MatFormField, MatHint, MatInput, MatLabel} from '@angular/material/input';
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
  type OrganViolation,
  type OrganViolationCode,
  toDraft,
  toSnapshot,
  validateOrgan,
} from '@api/index';
import {OrganLibrary} from '../organ-library.store';

type TapeBedField = keyof OrganDraft['tapeBed'];

/** A rule message ready for the translate pipe. */
interface ViolationMessage {
  readonly key: string;
  readonly params: Readonly<Record<string, string | number>>;
}

/** Violations about missing input wait until their field was touched; wrong values show right away. */
const MISSING_VALUE_CODES: ReadonlySet<OrganViolationCode> = new Set([
  'name-required',
  'pipes-required',
  'pipe-note-required',
  'value-required',
]);

@Component({
  selector: 'cranc-organ-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, MatFormField, MatLabel, MatInput, MatHint, MatError, MatButton, MatIcon],
  templateUrl: './organ-editor.component.html',
  styles: `
    .organ-editor {
      display: flex;
      flex-direction: column;
      max-width: 40rem;
    }

    .violation {
      color: var(--mat-sys-error);
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

  /** Paths of the fields the user has edited. */
  private readonly touched = signal<ReadonlySet<string>>(new Set());

  private readonly shownViolations = computed<ReadonlyMap<string, readonly ViolationMessage[]>>(() => {
    const result = validateOrgan(this.draft());
    const touched = this.touched();
    const byPath = new Map<string, ViolationMessage[]>();
    for (const violation of result.ok ? [] : result.error) {
      if (!isShown(violation, touched)) continue;
      byPath.set(violation.path, [...(byPath.get(violation.path) ?? []), toMessage(violation)]);
    }
    return byPath;
  });

  private readonly errorStateMatchers = new Map<string, ErrorStateMatcher>();

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

  /** The rule messages to show at the field with this path. */
  protected violationsAt(path: string): readonly ViolationMessage[] {
    return this.shownViolations().get(path) ?? [];
  }

  /** Puts the Material form field of `path` into its error state while a message is shown there. */
  protected errorStateAt(path: string): ErrorStateMatcher {
    let matcher = this.errorStateMatchers.get(path);
    if (!matcher) {
      matcher = {isErrorState: () => this.violationsAt(path).length > 0};
      this.errorStateMatchers.set(path, matcher);
    }
    return matcher;
  }

  protected setName(value: string): void {
    this.touch('name');
    this.draft.update((draft) => ({...draft, name: value}));
  }

  protected setTapeBed(field: TapeBedField, value: string): void {
    this.touch(`tapeBed.${field}`);
    this.draft.update((draft) => ({...draft, tapeBed: {...draft.tapeBed, [field]: toNumber(value)}}));
  }

  protected setMinimumGap(value: string): void {
    this.touch('minimumGap');
    this.draft.update((draft) => ({...draft, minimumGap: toNumber(value)}));
  }

  protected setPipeNote(row: number, value: string): void {
    this.touch(`pipes.${row}.note`);
    this.draft.update((draft) => ({
      ...draft,
      pipes: draft.pipes.map((pipe, index) => (index === row ? {note: toNumber(value)} : pipe)),
    }));
  }

  protected addPipe(): void {
    this.changeStructure(addPipe);
  }

  private touch(path: string): void {
    this.touched.update((touched) => new Set(touched).add(path));
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

function isShown(violation: OrganViolation, touched: ReadonlySet<string>): boolean {
  if (!MISSING_VALUE_CODES.has(violation.code)) return true;
  // "Add at least one Pipe" belongs to the whole Organ: show it once anything was edited.
  return violation.path === 'pipes' ? touched.size > 0 : touched.has(violation.path);
}

function toMessage(violation: OrganViolation): ViolationMessage {
  return {key: `ORGAN.VIOLATION.${violation.code.toUpperCase().replace(/-/g, '_')}`, params: violation.params ?? {}};
}

/** Empty input → `null`; anything else as typed, so that validation can report it. */
function toNumber(value: string): number | null {
  return value.trim() === '' ? null : Number(value);
}

function sameOrgan(a: Organ, b: Organ): boolean {
  return JSON.stringify(toSnapshot([a])) === JSON.stringify(toSnapshot([b]));
}
