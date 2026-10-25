import {strToU8, zipSync, type Zippable} from 'fflate';
import {describe, expect, it} from 'vitest';
import type {Result} from '../../result';
import {unzipScore, type MxlRejection} from './mxl';

const SIXTEEN_MIB = 16 * 1024 * 1024;

const CONTAINER = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0">
  <rootfiles>
    <rootfile full-path="music/main.musicxml" media-type="application/vnd.recordare.musicxml+xml"/>
  </rootfiles>
</container>`;

function textOf(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

function scoreOf(result: Result<Uint8Array, MxlRejection>): string {
  if (!result.ok) throw new Error(`expected a Score, got ${result.error}`);
  return textOf(result.value);
}

function rejectionOf(result: Result<Uint8Array, MxlRejection>): MxlRejection {
  if (result.ok) throw new Error('expected a rejection');
  return result.error;
}

/**
 * Flips the first byte of the compressed data of the entry at the start of `archive` into a deflate
 * block of the reserved type, so that inflating it fails. The archive is changed in place.
 */
function corruptFirstEntry(archive: Uint8Array): Uint8Array {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  const nameLength = view.getUint16(26, true);
  const extraLength = view.getUint16(28, true);
  archive[30 + nameLength + extraLength] = 0xff;
  return archive;
}

describe('unzipScore returns the Score the container names', () => {
  it('returns the rootfile of META-INF/container.xml, even when another Score comes first', () => {
    const archive = zipSync({
      'decoy.musicxml': strToU8('<decoy/>'),
      'music/main.musicxml': strToU8('<score-partwise/>'),
      'META-INF/container.xml': strToU8(CONTAINER),
    });

    expect(scoreOf(unzipScore(archive))).toBe('<score-partwise/>');
  });

  it('returns the first .musicxml or .xml entry outside META-INF when there is no container', () => {
    const entries: Zippable = {
      'readme.txt': strToU8('not a Score'),
      'META-INF/other.xml': strToU8('<meta/>'),
      'score.xml': strToU8('<score-partwise/>'),
      'later.musicxml': strToU8('<later/>'),
    };

    expect(scoreOf(unzipScore(zipSync(entries)))).toBe('<score-partwise/>');
  });
});

describe('unzipScore rejects an archive it cannot use', () => {
  it('gives no-score-in-archive for an archive without a Score entry', () => {
    const archive = zipSync({ 'readme.txt': strToU8('no music here') });

    expect(rejectionOf(unzipScore(archive))).toBe('no-score-in-archive');
  });

  it.each([
    ['bytes that are not a zip archive', Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x13, 0x37, 0x00, 0x42])],
    [
      'a zip archive cut short',
      zipSync({ 'score.musicxml': strToU8('<score-partwise/>') }).slice(0, -22),
    ],
  ])('gives damaged-archive for %s', (_, bytes) => {
    expect(() => unzipScore(bytes)).not.toThrow();
    expect(rejectionOf(unzipScore(bytes))).toBe('damaged-archive');
  });

  it('inflates a Score under the limit, so a Score whose compressed data is corrupt is damaged-archive', () => {
    const archive = corruptFirstEntry(zipSync({ 'score.musicxml': strToU8('x'.repeat(1024)) }, { level: 9 }));

    expect(rejectionOf(unzipScore(archive))).toBe('damaged-archive');
  });

  it('gives too-large for a Score over 16 MiB before inflating it, even when its data is corrupt', () => {
    const archive = corruptFirstEntry(
      zipSync({ 'score.musicxml': new Uint8Array(SIXTEEN_MIB + 1) }, { level: 9 }),
    );

    expect(rejectionOf(unzipScore(archive))).toBe('too-large');
  });
});
