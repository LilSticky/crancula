import {ChangeDetectionStrategy, Component, computed, inject, linkedSignal, PendingTasks, signal} from '@angular/core';
import {type FieldTree, form, FormField} from '@angular/forms/signals';
import {ErrorStateMatcher} from '@angular/material/core';
import {MatButton} from '@angular/material/button';
import {MatError, MatFormField, MatInput, MatLabel} from '@angular/material/input';
import {MatIcon} from '@angular/material/icon';
import {Router, RouterLink} from '@angular/router';
import {TranslatePipe} from '@ngx-translate/core';
import {
  createTape,
  defaultSelectedParts,
  MAXIMUM_MIDI_FILE_SIZE,
  type Organ,
  prefilledColumnLength,
  proposeTransposition,
  readMidiSong,
  type Song,
  type SongRejection,
  transposition,
} from '@api/index';
import {OrganLibrary} from '../../organ/organ-library.store';
import {TapeLibrary} from '../tape-library.store';
import {
  type ShownMessage,
  shownMessages,
  ShownViolationMatcher,
  type TapeImportContext,
  type TapeImportDraft,
  tapeImportSchema,
} from './tape-import-form';

const NO_SONG_DRAFT: TapeImportDraft = {name: '', columnLength: null, transposition: null};

/** Brings a MIDI Song onto a Tape: choose an Organ and a file, check the proposal, create. */
@Component({
  selector: 'cranc-tape-import',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, RouterLink, MatFormField, MatLabel, MatInput, MatError, MatButton, MatIcon, FormField],
  templateUrl: './tape-import.component.html',
  providers: [{provide: ErrorStateMatcher, useClass: ShownViolationMatcher}],
  styles: `
    .tape-import {
      display: flex;
      flex-direction: column;
      max-width: 40rem;
    }

    .rejection {
      color: var(--mat-sys-error);
    }
  `,
})
export class TapeImportComponent {
  private readonly organs = inject(OrganLibrary);
  private readonly tapes = inject(TapeLibrary);
  private readonly router = inject(Router);
  private readonly pendingTasks = inject(PendingTasks);

  protected readonly organList = this.organs.entities;

  /** The chosen Organ's id; the only Organ is preselected. */
  protected readonly organId = linkedSignal<string>(() => {
    const [only, ...others] = this.organs.entities();
    return only && others.length === 0 ? only.id : '';
  });
  private readonly organ = computed<Organ | undefined>(() => this.organs.entityMap()[this.organId()]);

  protected readonly song = signal<Song | null>(null);
  protected readonly rejection = signal<SongRejection | null>(null);

  private readonly context = computed<TapeImportContext | null>(() => {
    const song = this.song();
    const organ = this.organ();
    return song && organ ? {song, organ} : null;
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
        transposition: proposeTransposition(context.song, defaultSelectedParts(context.song), context.organ),
      };
    },
  });

  protected readonly tape: FieldTree<TapeImportDraft> = form(this.draft, tapeImportSchema(this.context));

  protected readonly canCreate = computed(() => this.context() !== null && this.tape().valid());

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
      this.song.set(result.value);
    } else {
      this.rejection.set(result.error);
      this.song.set(null);
    }
    input.value = '';
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
    const {name, columnLength, transposition: semitones} = this.draft();
    const valid = transposition(semitones ?? Number.NaN);
    if (context === null || valid === undefined || !this.canCreate()) return;
    const result = createTape({
      song: context.song,
      organ: context.organ,
      selectedParts: defaultSelectedParts(context.song),
      transposition: valid,
      name,
      columnLength: columnLength ?? Number.NaN,
    });
    if (!result.ok) return;
    await this.tapes.create(result.value.tape, context.song);
    await this.router.navigate(['/tapes', result.value.tape.id], {state: {importSummary: result.value.importSummary}});
  }
}
