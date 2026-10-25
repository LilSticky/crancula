/** What the MP3 worker posts back: progress while it encodes, then the bytes or the reason it failed. */
export type Mp3EncoderMessage =
  | {readonly progress: number}
  | {readonly bytes: Uint8Array}
  | {readonly error: string};
