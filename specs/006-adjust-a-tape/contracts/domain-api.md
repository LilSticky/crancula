# Contract: domain API

Exported from `@api/index`.

```ts
export function changeColumnLength(
  tape: Tape,
  columnLength: number,
): Result<Tape, 'column-length-must-be-positive'>;
```

| Given | Then |
|-------|------|
| Tape at 5 mm, 100 Columns, value 10 | ok; `columnLength` 10, `length` 100, Holes deep-equal, id/name/organId/songId/selectedParts/transposition equal |
| value equal to the current one | ok with the same object (`toBe`) |
| 0, -1, NaN, Infinity | err `column-length-must-be-positive` |
| Tape whose Holes become too short at the new value | ok; `cuttingProblems` reports them; Holes unchanged |

`validTape({...fields, columnLength: 0})` → err `{code: 'column-length-not-positive'}`.
