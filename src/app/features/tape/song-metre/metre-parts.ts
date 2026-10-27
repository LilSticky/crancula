import type {SongMetre} from '@api/index';

/** One part of the metre a Song keeps, with the values its text needs; a Key names its tonic by translation key. */
export type MetrePart =
  | {readonly kind: 'time-signature'; readonly beats: number; readonly beatType: number}
  | {readonly kind: 'key'; readonly mode: 'major' | 'minor'; readonly tonicKey: string}
  | {readonly kind: 'upbeat'; readonly fraction: string};

/** The translation key of the tonic of a Key: the major or minor name for its fifths, flats counted as `M` and their number. */
function tonicKeyOf(key: NonNullable<SongMetre['key']>): string {
  const mode = key.mode === 'major' ? 'MAJOR' : 'MINOR';
  const fifths = key.fifths < 0 ? `M${-key.fifths}` : `${key.fifths}`;
  return `TAPE.METRE.TONIC.${mode}.${fifths}`;
}

/** The parts a metre keeps, in reading order: Time signature, Key, upbeat. Empty for a metre that keeps none. */
export function metreParts(metre: SongMetre): readonly MetrePart[] {
  const parts: MetrePart[] = [];
  if (metre.timeSignature !== undefined) {
    parts.push({kind: 'time-signature', beats: metre.timeSignature.beats, beatType: metre.timeSignature.beatType});
  }
  if (metre.key !== undefined) parts.push({kind: 'key', mode: metre.key.mode, tonicKey: tonicKeyOf(metre.key)});
  if (metre.upbeat !== undefined) {
    parts.push({kind: 'upbeat', fraction: `${metre.upbeat.numerator}/${metre.upbeat.denominator}`});
  }
  return parts;
}
