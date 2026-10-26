import {cutWithin, replaceForbiddenCharacters, safeFileName} from '../app/safe-file-name';

/** The longest file name stem, without `.svg`, of a Tape piece: 200 UTF-16 code units, as any safe stem. */
const MAXIMUM_STEM_LENGTH = 200;

/**
 * The file names of `count` Tape pieces of the Tape `tapeName`: "<name> <label>.svg". `label` gives the words for
 * a piece number and the count in the language of the app; numbers are padded with zeros to the digits of the
 * count so they sort in order. The Tape name is shortened so the label stays whole.
 */
export function tapePieceFileNames(
  tapeName: string,
  count: number,
  label: (number: string, count: string) => string,
): readonly string[] {
  const countText = String(count);
  const name = safeFileName(tapeName);
  return Array.from({length: count}, (_, index) => {
    const words = replaceForbiddenCharacters(label(String(index + 1).padStart(countText.length, '0'), countText));
    return `${cutWithin(name, MAXIMUM_STEM_LENGTH - words.length - 1)} ${words}.svg`;
  });
}
