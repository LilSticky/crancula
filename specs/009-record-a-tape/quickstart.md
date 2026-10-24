# Quickstart: Record a tape

Validation guide. Contracts: [recording-ipc](contracts/recording-ipc.md), [recording-ui](contracts/recording-ui.md).

## Automated

- `npm run test`: WAV writer, PCM conversion, file names, request parsers, IPC handlers, voice windows,
  TapeRecorder and the Record button.
- `npm run e2e -- record-a-tape`: in real Electron with the save dialog stubbed, Record a Tape as WAV
  and as MP3; the WAV has a valid header, mono 44.1 kHz 16 bit, the expected length (Columns × Column
  time + release, within 1 %) and a non-silent peak; the MP3 starts with a frame sync or ID3 and is not
  empty. The Tape and undo history are unchanged.

## By hand (sound is not tested automatically)

1. `npm run electron:local`, open a Tape of an Organ with a Tape per Crank turn (e.g. the 20er Preset).
2. Record → save as WAV; play it in the system player: it sounds like the Preview at the Tape's Crank
   speed.
3. Record → save as MP3; play it on a phone or in a browser.
4. Open a Tape of an Organ without a Tape per Crank turn: Record is disabled with the hint.
5. Start the Preview: Record is disabled; during a Recording the Preview is disabled.
