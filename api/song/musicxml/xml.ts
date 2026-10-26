/**
 * A small, non-validating XML reader for MusicXML (ADR 27, research R2). It builds a plain element tree and
 * never resolves a DTD or an entity other than the five predefined ones and numeric character references.
 */

export interface XmlElement {
  readonly name: string;
  readonly attributes: ReadonlyMap<string, string>;
  readonly children: readonly XmlElement[];
  /** The character data directly inside the element, CDATA included, its markup not interpreted. */
  readonly text: string;
}

/** Thrown inside the reader for any malformed byte; never leaves {@link parseXml}. */
class MalformedXml extends Error {}

function malformed(): never {
  throw new MalformedXml();
}

const NAME = /[A-Za-z_:À-￿][A-Za-z0-9_:.\-·À-￿]*/y;
const WHITESPACE = /[ \t\r\n]*/y;
const PREDEFINED_ENTITIES: ReadonlyMap<string, string> = new Map([
  ['amp', '&'],
  ['lt', '<'],
  ['gt', '>'],
  ['quot', '"'],
  ['apos', "'"],
]);

/** The element under construction, before it is closed and frozen into an {@link XmlElement}. */
interface OpenElement {
  readonly name: string;
  readonly attributes: Map<string, string>;
  readonly children: XmlElement[];
  text: string;
}

/** The encoding of a file is given by its byte order mark; without one it is UTF-8. */
function decodeText(bytes: Uint8Array): string | undefined {
  const encoding = startsWithBytes(bytes, [0xff, 0xfe])
    ? 'utf-16le'
    : startsWithBytes(bytes, [0xfe, 0xff])
      ? 'utf-16be'
      : 'utf-8';
  try {
    return new TextDecoder(encoding, {fatal: true}).decode(bytes);
  } catch {
    return undefined;
  }
}

function startsWithBytes(bytes: Uint8Array, magic: readonly number[]): boolean {
  return magic.every((value, index) => bytes[index] === value);
}

/** Replaces the references of one run of character data or of an attribute value. */
function decodeReferences(raw: string): string {
  return raw.replace(/&([^;]*);|&/g, (_, reference: string | undefined) =>
    reference === undefined ? malformed() : decodeReference(reference),
  );
}

function decodeReference(reference: string): string {
  const named = PREDEFINED_ENTITIES.get(reference);
  if (named !== undefined) return named;
  if (!reference.startsWith('#')) return malformed();
  const isHex = reference.startsWith('#x');
  const digits = reference.slice(isHex ? 2 : 1);
  const pattern = isHex ? /^[0-9A-Fa-f]+$/ : /^[0-9]+$/;
  if (!pattern.test(digits)) return malformed();
  const codePoint = Number.parseInt(digits, isHex ? 16 : 10);
  if (!isXmlCharacter(codePoint)) return malformed();
  return String.fromCodePoint(codePoint);
}

function isXmlCharacter(codePoint: number): boolean {
  return (
    codePoint === 0x9 ||
    codePoint === 0xa ||
    codePoint === 0xd ||
    (codePoint >= 0x20 && codePoint <= 0xd7ff) ||
    (codePoint >= 0xe000 && codePoint <= 0xfffd) ||
    (codePoint >= 0x10000 && codePoint <= 0x10ffff)
  );
}

/** A bounds-checked cursor over the decoded text of one file. */
class XmlCursor {
  private position = 0;

  constructor(private readonly source: string) {}

  get atEnd(): boolean {
    return this.position >= this.source.length;
  }

  startsWith(text: string): boolean {
    return this.source.startsWith(text, this.position);
  }

  /** Moves past the next occurrence of `terminator`, which must exist. */
  skipPast(terminator: string): string {
    const end = this.source.indexOf(terminator, this.position);
    if (end < 0) return malformed();
    const skipped = this.source.slice(this.position, end);
    this.position = end + terminator.length;
    return skipped;
  }

  skipWhitespace(): void {
    WHITESPACE.lastIndex = this.position;
    WHITESPACE.exec(this.source);
    this.position = WHITESPACE.lastIndex;
  }

  expect(text: string): void {
    if (!this.startsWith(text)) return malformed();
    this.position += text.length;
  }

  name(): string {
    NAME.lastIndex = this.position;
    const match = NAME.exec(this.source);
    if (!match) return malformed();
    this.position = NAME.lastIndex;
    return match[0];
  }

  /** Character data up to the next markup, with its references decoded. */
  charData(): string {
    const next = this.source.indexOf('<', this.position);
    const end = next < 0 ? this.source.length : next;
    const raw = this.source.slice(this.position, end);
    this.position = end;
    return decodeReferences(raw);
  }

  peekChar(): string | undefined {
    return this.source.charAt(this.position) || undefined;
  }

  advance(length: number): void {
    this.position += length;
  }
}

/** Skips what may stand before or after the document element: declarations, comments, instructions, DOCTYPE. */
function skipMisc(cursor: XmlCursor): void {
  for (;;) {
    cursor.skipWhitespace();
    if (cursor.startsWith('<?')) {
      cursor.advance(2);
      cursor.skipPast('?>');
    } else if (cursor.startsWith('<!--')) {
      cursor.advance(4);
      cursor.skipPast('-->');
    } else if (cursor.startsWith('<!DOCTYPE')) {
      cursor.advance('<!DOCTYPE'.length);
      skipDoctypeRest(cursor);
    } else {
      return;
    }
  }
}

/**
 * Skips the rest of a DOCTYPE, including an internal subset in brackets. Declarations in the subset are
 * not read, so no entity or external resource is ever resolved.
 */
function skipDoctypeRest(cursor: XmlCursor): void {
  let inSubset = false;
  for (;;) {
    const character = cursor.peekChar();
    if (character === undefined) return malformed();
    if (!inSubset && character === '>') {
      cursor.advance(1);
      return;
    }
    if (character === '[') {
      inSubset = true;
      cursor.advance(1);
    } else if (character === ']') {
      inSubset = false;
      cursor.advance(1);
    } else if (character === '"' || character === "'") {
      cursor.advance(1);
      cursor.skipPast(character);
    } else if (inSubset && cursor.startsWith('<!--')) {
      cursor.advance(4);
      cursor.skipPast('-->');
    } else {
      cursor.advance(1);
    }
  }
}

function attributeValue(cursor: XmlCursor): string {
  const quote = cursor.peekChar();
  if (quote !== '"' && quote !== "'") return malformed();
  cursor.advance(1);
  const raw = cursor.skipPast(quote);
  if (raw.includes('<')) return malformed();
  // Attribute value normalisation: white space characters become spaces, before references are decoded.
  return decodeReferences(raw.replace(/[\t\n\r]/g, ' '));
}

/** Reads a start tag from its `<`; the element is open unless the tag is self-closing. */
function startTag(cursor: XmlCursor): {readonly element: OpenElement; readonly selfClosing: boolean} {
  cursor.expect('<');
  const name = cursor.name();
  const attributes = new Map<string, string>();
  for (;;) {
    cursor.skipWhitespace();
    if (cursor.startsWith('/>')) {
      cursor.advance(2);
      return {element: {name, attributes, children: [], text: ''}, selfClosing: true};
    }
    if (cursor.startsWith('>')) {
      cursor.advance(1);
      return {element: {name, attributes, children: [], text: ''}, selfClosing: false};
    }
    const attributeName = cursor.name();
    cursor.skipWhitespace();
    cursor.expect('=');
    cursor.skipWhitespace();
    if (attributes.has(attributeName)) return malformed();
    attributes.set(attributeName, attributeValue(cursor));
  }
}

function freeze(element: OpenElement): XmlElement {
  return {name: element.name, attributes: element.attributes, children: element.children, text: element.text};
}

/**
 * Reads one element and its content. The content is read with an explicit stack, so a deeply nested
 * file cannot exhaust the call stack.
 */
function element(cursor: XmlCursor): XmlElement {
  const root = startTag(cursor);
  if (root.selfClosing) return freeze(root.element);
  const open: OpenElement[] = [root.element];

  for (;;) {
    const top = open[open.length - 1];
    if (top === undefined) return malformed();
    if (cursor.atEnd) return malformed();

    if (cursor.startsWith('</')) {
      cursor.advance(2);
      if (cursor.name() !== top.name) return malformed();
      cursor.skipWhitespace();
      cursor.expect('>');
      open.pop();
      const closed = freeze(top);
      const parent = open[open.length - 1];
      if (parent === undefined) return closed;
      parent.children.push(closed);
    } else if (cursor.startsWith('<!--')) {
      cursor.advance(4);
      cursor.skipPast('-->');
    } else if (cursor.startsWith('<![CDATA[')) {
      cursor.advance('<![CDATA['.length);
      top.text += cursor.skipPast(']]>');
    } else if (cursor.startsWith('<?')) {
      cursor.advance(2);
      cursor.skipPast('?>');
    } else if (cursor.startsWith('<')) {
      const child = startTag(cursor);
      if (child.selfClosing) {
        top.children.push(freeze(child.element));
      } else {
        open.push(child.element);
      }
    } else {
      top.text += cursor.charData();
    }
  }
}

function parseDocument(source: string): XmlElement {
  const cursor = new XmlCursor(source);
  skipMisc(cursor);
  if (!cursor.startsWith('<')) return malformed();
  const root = element(cursor);
  skipMisc(cursor);
  if (!cursor.atEnd) return malformed();
  return root;
}

/**
 * Reads the document element of an XML file. UTF-8 and UTF-16 (by byte order mark) are read; the byte
 * order mark is dropped. Returns `undefined` for anything that is not well-formed. Never throws.
 */
export function parseXml(bytes: Uint8Array): XmlElement | undefined {
  const text = decodeText(bytes);
  if (text === undefined) return undefined;
  try {
    return parseDocument(text);
  } catch (error) {
    if (error instanceof MalformedXml) return undefined;
    throw error;
  }
}
