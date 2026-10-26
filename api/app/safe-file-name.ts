const MAXIMUM_LENGTH = 200;
const FALLBACK_NAME = 'Tape';
/** Characters a Windows file name may not contain: separators, reserved punctuation and control characters. */
// eslint-disable-next-line no-control-regex
export const FORBIDDEN_CHARACTERS = /[<>:"/\\|?*\u0000-\u001f\u007f]/;
const FORBIDDEN_EVERYWHERE = new RegExp(FORBIDDEN_CHARACTERS, 'g');
/** A Windows device name, alone or with any extension (`CON`, `nul.svg`). */
export const DEVICE_NAME = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/i;

/**
 * A file name stem (no extension) that is safe on Windows: never a path, no forbidden characters or device
 * name, at most 200 UTF-16 code units without splitting a surrogate pair, and never empty.
 */
export function safeFileName(name: string): string {
  const cleaned = replaceForbiddenCharacters(name).replace(/^ +/, '').replace(/[ .]+$/, '');
  const named = cleaned === '' ? FALLBACK_NAME : cleaned;
  const safe = DEVICE_NAME.test(named) ? `_${named}` : named;
  return cutWithin(safe, MAXIMUM_LENGTH);
}

/** `text` with every character a file name may not contain replaced by `_`. */
export function replaceForbiddenCharacters(text: string): string {
  return text.replace(FORBIDDEN_EVERYWHERE, '_');
}

/** The longest prefix of `text` of at most `maximum` UTF-16 code units that does not split a surrogate pair. */
export function cutWithin(text: string, maximum: number): string {
  if (text.length <= maximum) return text;
  const last = text.charCodeAt(maximum - 1);
  const splitsPair = last >= 0xd800 && last <= 0xdbff;
  return text.slice(0, splitsPair ? maximum - 1 : maximum);
}
