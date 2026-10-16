import {NgTemplateOutlet} from '@angular/common';
import {ChangeDetectionStrategy, Component, computed, inject, linkedSignal, PendingTasks, signal} from '@angular/core';
import {type FieldTree, form, FormField} from '@angular/forms/signals';
import {ErrorStateMatcher} from '@angular/material/core';
import {MatButton, MatIconButton} from '@angular/material/button';
import {MatCard} from '@angular/material/card';
import {MatCheckbox} from '@angular/material/checkbox';
import {MatChip} from '@angular/material/chips';
import {MatTooltip} from '@angular/material/tooltip';
import {MatError, MatFormField, MatInput, MatLabel, MatSuffix} from '@angular/material/input';
import {MatIcon} from '@angular/material/icon';
import {Router, RouterLink} from '@angular/router';
import {TranslatePipe} from '@ngx-translate/core';
import {
  allowedTranspositions,
  defaultSelectedParts,
  type Fit,
  fitNotesOf,
  fitOf,
  MAXIMUM_MIDI_FILE_SIZE,
  type Organ,
  type PartIndex,
  prefilledColumnLength,
  proposeTransposition,
  noteName,
  readMidiSong,
  tapeLengthInMillimetres,
  transposition,
  type Song,
  type SongRejection,
} from '@api/index';
import {ActionBarComponent} from '../../shared/components/action-bar/action-bar.component';
import {DecimalInputDirective} from '../../shared/decimal-input.directive';
import {formatNumber} from '../../shared/format-number';
import {LanguagePreference} from '../../shared/language-preference';
import {PageHeadComponent} from '../../shared/components/page-head/page-head.component';
import {OrganLibrary} from '../../organ/organ-library.store';
import {pipeRange} from '../../organ/pipe-range';
import {TapeLibrary} from '../tape-library.store';
import {
  type ShownMessage,
  shownMessages,
  ShownViolationMatcher,
  type TapeImportContext,
  type TapeImportDraft,
  createTapeFromDraft,
  tapeImportSchema,
} from './tape-import-form';

/** A translation key and its parameters. */
interface Readiness {
  readonly key: string;
  readonly params: Readonly<Record<string, number | string>>;
}

const NO_SONG_DRAFT: TapeImportDraft = {name: '', columnLength: null, transposition: null};

/** Brings a MIDI Song onto a Tape: choose an Organ and a file, check the proposal, create. */
@Component({
  selector: 'cranc-tape-import',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, RouterLink, MatFormField, MatLabel, MatInput, MatError, MatButton, MatIconButton, MatCheckbox, MatIcon, MatCard, MatChip, MatTooltip, MatSuffix, NgTemplateOutlet, FormField, DecimalInputDirective, PageHeadComponent, ActionBarComponent],
  templateUrl: './tape-import.component.html',
  providers: [{provide: ErrorStateMatcher, useClass: ShownViolationMatcher}],
  styles: `
    .tape-import {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      align-items: start;
    }

    mat-card {
      padding: 20px;
    }

    .group {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 20px;
    }

    .group-title {
      margin: 0;
      font-size: 1rem;
      font-weight: 700;
    }

    .file {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .parts {
      list-style: none;
      margin: 0;
      padding: 0;
      max-height: 15rem;
      overflow-y: auto;
    }

    .part {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      min-height: 40px;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }

    .part-note-count {
      font-variant-numeric: tabular-nums;
    }

    .part-percussion {
      flex-basis: 100%;
      color: var(--mat-sys-on-surface-variant);
    }

    .stepper {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .proposal {
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
    }

    .rejection {
      color: var(--mat-sys-error);
    }

    cranc-action-bar {
      grid-column: 1 / -1;
    }

    .empty-state {
      align-items: flex-start;
      gap: 12px;
    }

    .fit-rows {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .fit-row {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      min-height: 40px;
      padding: 0 8px;
      border: 0;
      background: none;
      font: inherit;
      color: inherit;
      text-align: start;
    }

    button.fit-row {
      cursor: pointer;
    }

    .fit-label {
      flex: 1;
    }

    .fit-count {
      font-variant-numeric: tabular-nums;
    }

    .fit-row.warning,
    .fit-warning {
      color: var(--mat-sys-error);
    }

    .fit-notes {
      margin: 0 0 8px;
      padding-inline-start: 48px;
    }
  `,
})
export class TapeImportComponent {
  private readonly organs = inject(OrganLibrary);
  protected readonly tapes = inject(TapeLibrary);
  private readonly router = inject(Router);
  private readonly pendingTasks = inject(PendingTasks);
  private readonly language = inject(LanguagePreference).language;
  protected readonly noteName = noteName;

  protected readonly organList = this.organs.entities;

  /** The chosen Organ's id; the only Organ is preselected. */
  protected readonly organId = linkedSignal<string>(() => {
    const [only, ...others] = this.organs.entities();
    return only && others.length === 0 ? only.id : '';
  });
  private readonly organ = computed<Organ | undefined>(() => this.organs.entityMap()[this.organId()]);

  protected readonly song = signal<Song | null>(null);
  protected readonly rejection = signal<SongRejection | null>(null);
  /** The name of the chosen file, which can differ from the Song's name. */
  protected readonly fileName = signal('');

  protected readonly organRange = computed(() => {
    const organ = this.organ();
    return organ ? pipeRange(organ) : null;
  });

  protected readonly songFacts = computed(() => {
    const song = this.song();
    return song
      ? {parts: song.parts.length, notes: song.parts.reduce((total, part) => total + part.notes.length, 0)}
      : null;
  });

  /** The selected Parts; a new Song starts with its default Parts. */
  protected readonly selectedParts = linkedSignal<Song | null, ReadonlySet<PartIndex>>({
    source: this.song,
    computation: (song) => (song ? defaultSelectedParts(song) : new Set()),
  });

  protected readonly context = computed<TapeImportContext | null>(() => {
    const song = this.song();
    const organ = this.organ();
    return song && organ ? {song, organ, selectedParts: this.selectedParts()} : null;
  });

  /** The draft starts from the Song's name, the Column length of the Organ and the proposed Transposition. */
  private readonly draft = linkedSignal<TapeImportContext | null, TapeImportDraft>({
    source: this.context,
    computation: (context, previous) => {
      if (context === null) return NO_SONG_DRAFT;
      const sameSong = previous?.source?.song === context.song;
      return {
        name: sameSong ? (previous?.value.name ?? context.song.name) : context.song.name,
        columnLength: prefilledColumnLength(context.organ, this.tapes.tapeEntities()),
        transposition: proposeTransposition(context.song, context.selectedParts, context.organ),
      };
    },
  });

  protected readonly tape: FieldTree<TapeImportDraft> = form(this.draft, tapeImportSchema(this.context));

  /** How the selected Parts meet the Pipes at the Transposition now in the form; absent while it isn't a valid one. */
  protected readonly fit = computed<Fit | null>(() => {
    const context = this.context();
    const semitones = transposition(this.draft().transposition ?? Number.NaN);
    return context && semitones !== undefined
      ? fitOf(context.song, context.selectedParts, context.organ, semitones)
      : null;
  });

  /** The Notes behind the Fit counts, ordered by Column, then Part. */
  protected readonly fitNotes = computed(() => {
    const context = this.context();
    const semitones = transposition(this.draft().transposition ?? Number.NaN);
    if (context === null || semitones === undefined) return {movedByOctaves: [], unplayableNotes: []};
    const {movedByOctaves, unplayableNotes} = fitNotesOf(context.song, context.selectedParts, context.organ, semitones);
    const byColumnThenPart = (a: {column: number; part: number}, b: {column: number; part: number}) =>
      a.column - b.column || a.part - b.part;
    return {
      movedByOctaves: [...movedByOctaves].sort(byColumnThenPart),
      unplayableNotes: [...unplayableNotes].sort(byColumnThenPart),
    };
  });

  protected readonly movedOpen = signal(false);
  protected readonly unplayableOpen = signal(false);

  /** The Transposition the form shows now: the chosen one, or the proposal while none is entered. */
  protected readonly proposal = computed(() => {
    const context = this.context();
    return context ? proposeTransposition(context.song, context.selectedParts, context.organ) : null;
  });

  protected readonly chosenTransposition = computed(() => this.draft().transposition);

  protected readonly allowed = computed(() => {
    const context = this.context();
    return context ? allowedTranspositions(context.song, context.selectedParts) : null;
  });

  protected readonly proposalIsChosen = computed(() => this.proposal() === this.chosenTransposition());

  protected readonly canStepUp = computed(() => {
    const [allowed, chosen] = [this.allowed(), this.chosenTransposition()];
    return allowed !== null && chosen !== null && chosen < allowed.highest;
  });

  protected readonly canStepDown = computed(() => {
    const [allowed, chosen] = [this.allowed(), this.chosenTransposition()];
    return allowed !== null && chosen !== null && chosen > allowed.lowest;
  });

  protected readonly canCreate = computed(
    () => this.context() !== null && this.tape().valid() && this.tapes.loadProblem() === null,
  );

  /** What the action bar says: the first thing that keeps the Tape from being created, or how long it will be. */
  protected readonly readiness = computed((): Readiness => {
    const context = this.context();
    if (this.song() === null) return {key: 'TAPE.IMPORT.CHOOSE_SONG', params: {}};
    if (context === null) return {key: 'TAPE.IMPORT.CHOOSE_ORGAN', params: {}};
    if (context.selectedParts.size === 0) return {key: 'TAPE.IMPORT.STATE_NO_PART', params: {}};
    if (this.tapes.loadProblem() !== null) return {key: 'TAPE.IMPORT.LOAD_PROBLEM', params: {}};
    const result = createTapeFromDraft(context, this.draft());
    if (!result.ok) {
      const count = result.error.length;
      return {key: count === 1 ? 'TAPE.IMPORT.STATE_PROBLEM_ONE' : 'TAPE.IMPORT.STATE_PROBLEMS', params: {count}};
    }
    const {tape} = result.value;
    const length = formatNumber(tapeLengthInMillimetres(tape), this.language());
    return {key: tape.length === 1 ? 'TAPE.IMPORT.STATE_READY_ONE' : 'TAPE.IMPORT.STATE_READY', params: {columns: tape.length, length}};
  });

  /** The Part as the Import Summary names it: its name, or its number counted from 1. */
  protected partLabel(part: number): string {
    return this.song()?.parts[part]?.name ?? `${part + 1}`;
  }

  /** Reads the chosen file into the Song, or into the reason it was rejected. */
  protected chooseSong(input: HTMLInputElement): void {
    void this.pendingTasks.run(() => this.readSong(input));
  }

  private async readSong(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    if (!file) return;
    const result =
      file.size > MAXIMUM_MIDI_FILE_SIZE
        ? ({ok: false, error: 'not-a-midi-file'} as const)
        : readMidiSong(new Uint8Array(await file.arrayBuffer()), file.name);
    if (result.ok) {
      this.rejection.set(null);
      this.fileName.set(file.name);
      this.song.set(result.value);
    } else {
      this.rejection.set(result.error);
      this.song.set(null);
    }
    input.value = '';
  }

  protected isSelected(index: number): boolean {
    return this.selectedParts().has(index as PartIndex);
  }

  protected togglePart(index: number, selected: boolean): void {
    this.selectedParts.update((parts) => {
      const next = new Set(parts);
      if (selected) next.add(index as PartIndex);
      else next.delete(index as PartIndex);
      return next;
    });
  }

  /** Replaces the chosen Transposition with the proposal for the selected Parts. */
  protected useProposal(): void {
    const context = this.context();
    if (context === null) return;
    this.draft.update((draft) => ({
      ...draft,
      transposition: proposeTransposition(context.song, context.selectedParts, context.organ),
    }));
  }

  /** Moves the chosen Transposition by whole semitones. */
  protected step(semitones: number): void {
    this.draft.update((draft) => ({...draft, transposition: (draft.transposition ?? 0) + semitones}));
  }

  /** A number with its sign: "+5", "−3" (minus sign) and "0". */
  protected signed(value: number): string {
    return value > 0 ? `+${value}` : value < 0 ? `−${-value}` : '0';
  }

  protected chooseOrgan(organId: string): void {
    this.organId.set(organId);
  }

  /** The messages to show at a field now. */
  protected messagesAt(field: FieldTree<unknown>): readonly ShownMessage[] {
    return shownMessages(field);
  }

  /** Creates the Tape, stores it with its Song and opens it with the Import Summary. */
  protected async create(): Promise<void> {
    const context = this.context();
    if (context === null || !this.canCreate()) return;
    const result = createTapeFromDraft(context, this.draft());
    if (!result.ok) return;
    const saved = await this.tapes.create(result.value.tape, context.song);
    if (!saved && this.tapes.loadProblem() !== null) return;
    await this.router.navigate(['/tapes', result.value.tape.id], {state: {importSummary: result.value.importSummary}});
  }
}
