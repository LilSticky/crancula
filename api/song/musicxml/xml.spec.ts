import {describe, expect, it} from 'vitest';
import {parseXml, type XmlElement} from './xml';

function bytesOf(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/** UTF-16 little endian with its byte order mark; the text is ASCII or BMP only. */
function utf16LeWithBom(text: string): Uint8Array {
  const bytes = [0xff, 0xfe];
  for (let index = 0; index < text.length; index++) {
    const unit = text.charCodeAt(index);
    bytes.push(unit & 0xff, unit >> 8);
  }
  return Uint8Array.from(bytes);
}

/** The document element of a text that is well-formed for the reader. */
function rootOf(text: string): XmlElement {
  const root = parseXml(bytesOf(text));
  if (!root) throw new Error(`expected a document element for ${text}`);
  return root;
}

describe('parseXml builds the element tree', () => {
  it('gives the document element with its name, attributes and children in document order', () => {
    const root = rootOf('<score-partwise version="4.0"><part-list/><part id="P1"/></score-partwise>');

    expect(root.name).toBe('score-partwise');
    expect(root.attributes.get('version')).toBe('4.0');
    expect(root.children.map((child) => child.name)).toEqual(['part-list', 'part']);
    expect(root.children[1]?.attributes.get('id')).toBe('P1');
  });

  it('gives the character data of an element with only text as its text', () => {
    const root = rootOf('<part-name>Flute</part-name>');

    expect(root.text).toBe('Flute');
    expect(root.children).toEqual([]);
  });

  it('reads attribute values in single and double quotes', () => {
    const root = rootOf(`<a x='1' y="2"/>`);

    expect(root.attributes.get('x')).toBe('1');
    expect(root.attributes.get('y')).toBe('2');
  });
});

describe('parseXml decodes character data', () => {
  it('decodes the five predefined entities in text', () => {
    expect(rootOf('<a>&amp; &lt; &gt; &quot; &apos;</a>').text).toBe(`& < > " '`);
  });

  it('decodes the predefined entities in attribute values', () => {
    expect(rootOf('<a title="Tom &amp; &quot;Jerry&quot;"/>').attributes.get('title')).toBe('Tom & "Jerry"');
  });

  it('decodes decimal and hexadecimal character references, outside the BMP too', () => {
    expect(rootOf('<a>&#65;&#x42;&#x1D11E;</a>').text).toBe('AB\u{1D11E}');
  });
});

describe('parseXml skips what is not an element', () => {
  it('skips the XML declaration, comments, processing instructions and a DOCTYPE with an internal subset', () => {
    const root = rootOf(
      [
        '<?xml version="1.0" encoding="UTF-8" standalone="no"?>',
        '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN"',
        '  "http://www.musicxml.org/dtds/partwise.dtd" [',
        '  <!ENTITY boom "boom">',
        '  <!-- a comment with <tags> in it -->',
        ']>',
        '<!-- before the root -->',
        '<?xml-stylesheet href="style.xsl"?>',
        '<score-partwise><!-- inside --><?pi data?><part-list/></score-partwise>',
        '<!-- after the root -->',
      ].join('\n'),
    );

    expect(root.name).toBe('score-partwise');
    expect(root.children.map((child) => child.name)).toEqual(['part-list']);
  });

  it('does not expand an entity declared in the DOCTYPE, so a reference to it is malformed', () => {
    const text = '<!DOCTYPE a [<!ENTITY boom "boom">]><a>&boom;</a>';

    expect(parseXml(bytesOf(text))).toBeUndefined();
  });

  it('reads CDATA as text with its markup left as written', () => {
    expect(rootOf('<words><![CDATA[a < b & "c" &amp;]]></words>').text).toBe('a < b & "c" &amp;');
  });
});

describe('parseXml reads the encodings of a file', () => {
  it('reads UTF-8 with a byte order mark and drops the mark', () => {
    expect(rootOf('﻿<part-name>Flöte</part-name>').text).toBe('Flöte');
  });

  it('reads UTF-16 little endian by its byte order mark', () => {
    const root = parseXml(utf16LeWithBom('<part-name>Flöte</part-name>'));

    expect(root?.name).toBe('part-name');
    expect(root?.text).toBe('Flöte');
  });
});

describe('parseXml rejects what is not well-formed, without throwing', () => {
  it.each([
    ['an empty file', ''],
    ['text without an element', 'hello'],
    ['mismatched end tags', '<a><b></a>'],
    ['an element that is never closed', '<a><b>'],
    ['an attribute value that is never closed', '<a x="1>'],
    ['a comment that is never closed', '<a><!-- x </a>'],
    ['a reference to an unknown entity', '<a>&boom;</a>'],
  ])('gives undefined for %s', (_, text) => {
    expect(() => parseXml(bytesOf(text))).not.toThrow();
    expect(parseXml(bytesOf(text))).toBeUndefined();
  });
});
