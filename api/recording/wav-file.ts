import {RECORDING_CHANNELS} from './recording-format';

const HEADER_LENGTH = 44;
const BITS_PER_SAMPLE = 16;
const BYTES_PER_SAMPLE = BITS_PER_SAMPLE / 8;
const FORMAT_PCM = 1;
const FMT_CHUNK_LENGTH = 16;

/**
 * A canonical WAV file of 16-bit PCM samples: a 44-byte header followed by the little endian samples.
 */
export function wavFile(pcm: Int16Array, sampleRate: number): Uint8Array {
  const dataLength = pcm.length * BYTES_PER_SAMPLE;
  const bytes = new Uint8Array(HEADER_LENGTH + dataLength);
  const view = new DataView(bytes.buffer);
  const blockAlign = RECORDING_CHANNELS * BYTES_PER_SAMPLE;

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, HEADER_LENGTH - 8 + dataLength, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, FMT_CHUNK_LENGTH, true);
  view.setUint16(20, FORMAT_PCM, true);
  view.setUint16(22, RECORDING_CHANNELS, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, BITS_PER_SAMPLE, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataLength, true);
  pcm.forEach((sample, index) => view.setInt16(HEADER_LENGTH + index * BYTES_PER_SAMPLE, sample, true));
  return bytes;
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let index = 0; index < text.length; index++) {
    view.setUint8(offset + index, text.charCodeAt(index));
  }
}
