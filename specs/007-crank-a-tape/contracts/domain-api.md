# Contract: domain API (`@api`)

```ts
// api/tape/crank-speed.ts
type CrankSpeed = number & { readonly __brand: 'CrankSpeed' };
const MIN_CRANK_SPEED = 1, MAX_CRANK_SPEED = 300, DEFAULT_CRANK_SPEED: CrankSpeed; // 60
function crankSpeed(value: number): CrankSpeed | undefined;

// api/tape/change-crank-speed.ts
function changeCrankSpeed(tape: Tape, speed: number): Result<Tape, 'crank-speed-out-of-range'>;
// same object back when unchanged

// api/preview/performance.ts
interface PreviewNote { readonly pipe: MidiNoteNumber; readonly startColumn: number; readonly endColumn: number }
function performance(tape: Tape, organ: Organ): readonly PreviewNote[];
function columnDuration(tape: Tape, organ: Organ): number | undefined; // seconds
function previewLength(tape: Tape, organ: Organ): number | undefined;  // seconds
function noteFrequency(pipe: MidiNoteNumber): number;                  // Hz, A4 = 440
```

- `Organ.tapePerCrankTurn?: Millimetres`; `validateOrgan` adds `tape-per-crank-turn-not-positive`.
- `Tape.crankSpeed: CrankSpeed`; `validTape` adds `crank-speed-out-of-range`.
- Snapshots: organs v4, tapes v2, migrated on read (ADR 20).
