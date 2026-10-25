const MAXIMUM_LENGTH = 200;
const FALLBACK_NAME = 'Tape';
// eslint-disable-next-line no-control-regex
const FORBIDDEN = /[<>:"/\\|?*\u0000-\u001f\u007f]/g;
const DEVICE_NAME = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/i;

/**
 * A file name stem (no extension) that is safe on Windows: never a path, no forbidden characters or device
 * name, at most 200 UTF-16 code units without splitting a surrogate pair, and never empty.
 */
export function safeFileName(name: string): string {
  const cleaned = name.replace(FORBIDDEN, '_').replace(/^ +/, '').replace(/[ .]+$/, '');
  const named = cleaned === '' ? FALLBACK_NAME : cleaned;
  const safe = DEVICE_NAME.test(named) ? `_${named}` : named;
  return cut(safe);
}

function cut(name: string): string {
  if (name.length <= MAXIMUM_LENGTH) return name;
  const last = name.charCodeAt(MAXIMUM_LENGTH - 1);
  const splitsPair = last >= 0xd800 && last <= 0xdbff;
  return name.slice(0, splitsPair ? MAXIMUM_LENGTH - 1 : MAXIMUM_LENGTH);
}
