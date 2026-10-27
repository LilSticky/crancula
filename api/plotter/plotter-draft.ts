import {DEFAULT_OVERLAP, DEFAULT_TAPE_SPACING, type Plotter, type PlotterId} from './plotter';

/** A Plotter as entered in the editor. It may be invalid; see `validatePlotter`. */
export interface PlotterDraft {
  /** Absent until the Plotter is stored for the first time. */
  readonly id?: PlotterId;
  readonly name: string;
  readonly workingWidth: number | null;
  readonly roll: boolean;
  /** Kept while roll is on, so that switching roll back off restores it; not checked then. */
  readonly workingLength: number | null;
  /** Kept while roll is on, like the working length. */
  readonly overlap: number | null;
  /** Kept while roll is off, like the working length; not checked then. */
  readonly tapeSpacing: number | null;
}

export function emptyPlotterDraft(): PlotterDraft {
  return {
    name: '',
    workingWidth: null,
    roll: false,
    workingLength: null,
    overlap: DEFAULT_OVERLAP,
    tapeSpacing: DEFAULT_TAPE_SPACING,
  };
}

export function draftOf(plotter: Plotter): PlotterDraft {
  if (plotter.roll) {
    return {
      id: plotter.id,
      name: plotter.name,
      workingWidth: plotter.workingWidth,
      roll: true,
      workingLength: null,
      overlap: DEFAULT_OVERLAP,
      tapeSpacing: plotter.tapeSpacing,
    };
  }
  return {
    id: plotter.id,
    name: plotter.name,
    workingWidth: plotter.workingWidth,
    roll: false,
    workingLength: plotter.workingLength,
    overlap: plotter.overlap,
    tapeSpacing: DEFAULT_TAPE_SPACING,
  };
}
