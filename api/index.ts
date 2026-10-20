export type {Result} from './result';
export {midiNoteNumber, noteName, type MidiNoteNumber} from './organ/midi-note-number';
export {
  border,
  millimetres,
  minimumHoleLength,
  newOrganId,
  organId,
  rowSpan,
  tapeBedFit,
  type Millimetres,
  type Organ,
  type OrganId,
  type Pipe,
  type TapeBedFit,
  type TapeBed,
} from './organ/organ';
export {addPipe, emptyOrganDraft, movePipe, removePipe, toDraft, type OrganDraft, type PipeDraft} from './organ/organ-draft';
export {validateOrgan, type OrganViolation, type OrganViolationCode} from './organ/validate-organ';
export {
  parseOrganLibrarySnapshot,
  toSnapshot,
  type OrganLibrarySnapshot,
  type OrganSnapshot,
} from './organ/organ-library-snapshot';
export type {
  CranculaApi,
  OrganLibraryLoadResult,
  OrganLibrarySaveResult,
  SetLanguageResult,
  SnapshotLoadResult,
  SnapshotSaveResult,
  SvgSaveRequest,
  SvgSaveResult,
  TapeLibraryLoadResult,
  TapeLibrarySaveResult,
} from './app/crancula-api';
export {parseSvgSaveRequest} from './app/svg-save-request';
export {isLanguage, type Language} from './app/language';
export {
  defaultSelectedParts,
  songId,
  type Note,
  type Part,
  type PartIndex,
  type Song,
  type SongId,
  type Tick,
  type TicksPerQuarter,
} from './song/song';
export {MAXIMUM_MIDI_FILE_SIZE, readMidiSong, type SongRejection} from './song/midi/read-midi-song';
export {
  addHole,
  changeHoleLength,
  firstFreeColumnAfter,
  moveHole,
  removeHole,
  type HoleEdit,
  type HoleEditRefusal,
  type HoleRef,
} from './tape/hole-edits';
export {
  column,
  columnCount,
  removeHolesOfPipes,
  tapeId,
  tapeLengthInMillimetres,
  transposition,
  validTape,
  type Column,
  type ColumnCount,
  type Hole,
  type Tape,
  type TapeFields,
  type TapeId,
  type TapeRuleViolation,
  type TapeRuleViolationCode,
  type Transposition,
} from './tape/tape';
export {allowedTranspositions, proposeTransposition} from './tape/transposition';
export {fitAndNotesOf, fitNotesOf, fitOf, type Fit, type FitNotes} from './tape/fit';
export {
  createTape,
  prefilledColumnLength,
  type CreatedTape,
  type CreateTapeInput,
  type TapeViolation,
  type TapeViolationCode,
} from './tape/create-tape';
export {
  parseTapeLibrarySnapshot,
  toTapeLibrarySnapshot,
  type TapeLibrary,
  type TapeLibrarySnapshot,
} from './tape/tape-library-snapshot';
export type {HoleFix, ImportSummary} from './tape/import-summary';
export {
  cuttingProblems,
  holesWithCuttingProblems,
  type CuttingProblem,
  type CuttingProblemCode,
  type HoleCuttingProblems,
  type HoleProblem,
} from './tape/cutting-problems';
export {
  transposeHoles,
  transposeRange,
  type HoleFate,
  type HolesToTranspose,
  type Merge,
  type Transposed,
  type TranspositionOutcome,
} from './tape/transpose-holes';
export {renameTape} from './tape/rename-tape';
export {plotterFileName} from './tape/plotter-file-name';
export {plotterSvg} from './tape/plotter-svg';
export {tapeGeometry, type Point, type Slot, type TapeGeometry, type TapeOutline} from './tape/tape-geometry';
