/** A copy of `items` sorted by name in `language`, ignoring case; equal names keep their order. */
export function byName<T extends {readonly name: string}>(items: readonly T[], language: string): T[] {
  const collator = new Intl.Collator(language, {sensitivity: 'accent'});
  return [...items].sort((a, b) => collator.compare(a.name, b.name));
}

/** Tape rows sorted by Organ name, then Tape name; rows without an available Organ come last. */
export function tapesByOrgan<T extends {readonly name: string; readonly organ?: {readonly name: string} | undefined}>(
  rows: readonly T[],
  language: string,
): T[] {
  const collator = new Intl.Collator(language, {sensitivity: 'accent'});
  return [...rows].sort((a, b) => {
    if (a.organ === undefined || b.organ === undefined) {
      return a.organ === b.organ ? collator.compare(a.name, b.name) : a.organ === undefined ? 1 : -1;
    }
    return collator.compare(a.organ.name, b.organ.name) || collator.compare(a.name, b.name);
  });
}
