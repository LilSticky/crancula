import {unzipSync, type UnzipFileInfo} from 'fflate';
import {err, ok, type Result} from '../../result';
import {parseXml, type XmlElement} from './xml';

export type MxlRejection = 'too-large' | 'damaged-archive' | 'no-score-in-archive';

/** A Score entry is inflated only if its declared uncompressed size is within this limit (research R3). */
export const MAXIMUM_SCORE_SIZE = 16 * 1024 * 1024;

const CONTAINER_PATH = 'META-INF/container.xml';
const META_INF_PREFIX = 'META-INF/';
const SCORE_EXTENSIONS = ['.musicxml', '.xml'];

/** The entries of an archive, listed without inflating any of them. Throws if the archive is damaged. */
function entriesOf(bytes: Uint8Array): UnzipFileInfo[] {
  const entries: UnzipFileInfo[] = [];
  unzipSync(bytes, {
    filter: (file) => {
      entries.push(file);
      return false;
    },
  });
  return entries;
}

/** Inflates one entry, after its declared size has been checked against the limit. */
function inflate(bytes: Uint8Array, entry: UnzipFileInfo): Result<Uint8Array, MxlRejection> {
  if (entry.originalSize > MAXIMUM_SCORE_SIZE) return err('too-large');
  const files = unzipSync(bytes, {filter: (file) => file.name === entry.name});
  return ok(files[entry.name]);
}

/** The path of the first rootfile the container names, if it names one. */
function rootfilePathOf(container: XmlElement | undefined): string | undefined {
  const rootfiles = container?.children.find((child) => child.name === 'rootfiles');
  const rootfile = rootfiles?.children.find((child) => child.name === 'rootfile');
  return rootfile?.attributes.get('full-path');
}

function isScoreEntry(entry: UnzipFileInfo): boolean {
  const name = entry.name.toLowerCase();
  return !entry.name.startsWith(META_INF_PREFIX) && SCORE_EXTENSIONS.some((extension) => name.endsWith(extension));
}

/** The path of the Score: the rootfile of the container, else the first Score entry outside META-INF/. */
function scorePathOf(bytes: Uint8Array, entries: readonly UnzipFileInfo[]): Result<string, MxlRejection> {
  const container = entries.find((entry) => entry.name === CONTAINER_PATH);
  if (container) {
    const xml = inflate(bytes, container);
    if (!xml.ok) return xml;
    const path = rootfilePathOf(parseXml(xml.value));
    if (path !== undefined) return ok(path);
  }
  const score = entries.find(isScoreEntry);
  return score ? ok(score.name) : err('no-score-in-archive');
}

/**
 * Unpacks a compressed MusicXML file (`.mxl`) and returns the bytes of its Score. Only the Score is
 * inflated, and only if its declared size is within the limit. Never throws.
 */
export function unzipScore(bytes: Uint8Array): Result<Uint8Array, MxlRejection> {
  try {
    const entries = entriesOf(bytes);
    const path = scorePathOf(bytes, entries);
    if (!path.ok) return path;
    const score = entries.find((entry) => entry.name === path.value);
    if (!score) return err('no-score-in-archive');
    return inflate(bytes, score);
  } catch {
    return err('damaged-archive');
  }
}
