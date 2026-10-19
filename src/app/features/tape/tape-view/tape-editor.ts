import {computed, inject, Injectable, signal} from '@angular/core';
import type {Tape} from '@api/index';
import {TapeLibrary} from '../tape-library.store';
import * as edits from './edit-history';
import {type EditHistory, editHistory} from './edit-history';
import type {SelectableHole} from './hole-selection';

/** One step of the edit history: the Tape and the Hole selected in it. */
export interface TapeEdit {
  readonly tape: Tape;
  readonly selection: SelectableHole | undefined;
}

/** Edits one open Tape with undo and redo; every step is saved through `TapeLibrary.update`. */
@Injectable()
export class TapeEditor {
  private readonly library = inject(TapeLibrary);
  private readonly state = signal<EditHistory<TapeEdit> | undefined>(undefined);

  readonly tape = computed(() => this.state()?.present.tape);
  readonly selection = computed(() => this.state()?.present.selection);
  readonly canUndo = computed(() => {
    const state = this.state();
    return state !== undefined && edits.canUndo(state);
  });
  readonly canRedo = computed(() => {
    const state = this.state();
    return state !== undefined && edits.canRedo(state);
  });

  open(tape: Tape): void {
    this.state.set(editHistory({tape, selection: undefined}));
  }

  /** Remembers the selected Hole with the present entry, so that undoing back to it restores the selection. */
  remember(selection: SelectableHole | undefined): void {
    this.state.update((state) => (state === undefined ? state : {...state, present: {...state.present, selection}}));
  }

  apply(next: TapeEdit): Promise<boolean> {
    return this.step((current) => edits.apply(current, next));
  }

  undo(): Promise<boolean> {
    return this.step(edits.undo);
  }

  redo(): Promise<boolean> {
    return this.step(edits.redo);
  }

  private async step(move: (h: EditHistory<TapeEdit>) => EditHistory<TapeEdit>): Promise<boolean> {
    const current = this.current();
    if (current === undefined) return false;
    const moved = move(current);
    // Also stores a history that was reset to the library's Tape, so tape() shows it.
    this.state.set(moved);
    if (moved === current) return false;
    // A failed save keeps the edit in view (spec 004 edge case).
    return this.library.update(moved.present.tape);
  }

  /** The history, restarted at the library's Tape when that was changed elsewhere. */
  private current(): EditHistory<TapeEdit> | undefined {
    const state = this.state();
    if (state === undefined) return undefined;
    const stored = this.library.tapeEntityMap()[state.present.tape.id];
    if (stored === undefined || stored === state.present.tape) return state;
    return editHistory({tape: stored, selection: undefined});
  }
}
