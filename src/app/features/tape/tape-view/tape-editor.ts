import {computed, inject, Injectable, signal} from '@angular/core';
import type {Tape} from '@api/index';
import {TapeLibrary} from '../tape-library.store';
import * as history from './edit-history';
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
  private readonly state = signal<history.EditHistory<TapeEdit> | undefined>(undefined);

  readonly tape = computed(() => this.state()?.present.tape);
  readonly selection = computed(() => this.state()?.present.selection);
  readonly canUndo = computed(() => { const s = this.state(); return s !== undefined && history.canUndo(s); });
  readonly canRedo = computed(() => { const s = this.state(); return s !== undefined && history.canRedo(s); });

  open(tape: Tape): void {
    this.state.set(history.editHistory({tape, selection: undefined}));
  }

  apply(next: TapeEdit): Promise<boolean> {
    return this.step((h) => history.apply(h, next));
  }

  undo(): Promise<boolean> {
    return this.step(history.undo);
  }

  redo(): Promise<boolean> {
    return this.step(history.redo);
  }

  private async step(move: (h: history.EditHistory<TapeEdit>) => history.EditHistory<TapeEdit>): Promise<boolean> {
    const current = this.current();
    if (current === undefined) return false;
    const moved = move(current);
    if (moved === current) return false;
    this.state.set(moved);
    return this.library.update(moved.present.tape);
  }

  /** The history, restarted at the library's Tape when that was changed elsewhere. */
  private current(): history.EditHistory<TapeEdit> | undefined {
    const state = this.state();
    if (state === undefined) return undefined;
    const stored = this.library.tapeEntityMap()[state.present.tape.id];
    if (stored === undefined || stored === state.present.tape) return state;
    return history.editHistory({tape: stored, selection: undefined});
  }
}
