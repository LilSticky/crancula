# Quickstart: validate "Describe my organ"

How to prove the slice works end to end. It refers to the [spec](spec.md),
[data model](data-model.md) and [IPC contract](contracts/organ-library-ipc.md).

## Prerequisites

- Node 22 (`.node-version`)
- Run `npm ci`

## Automated checks (the Definition of Done gate)

| Command | Expected |
|---------|----------|
| `npm run lint` | no errors |
| `npm run test` | Node tests (`api/`, `app/`) and Angular tests (`src/`) green |
| `npm run build` | build succeeds |
| `npm run e2e` | Electron flows green: create → restart, delete → restart, corrupt snapshot, German UI |

## Manual walkthrough (in Electron: `npm run electron:local`)

1. **No Organs at first.** With a fresh `userData` folder the Organ list is empty. In PowerShell,
   set `$env:CRANCULA_USER_DATA` to an empty folder before starting.
2. **Create an Organ.** Enter:
   - name "Street organ";
   - tape width 120, border 5, hole diameter 2.5, row spacing 3.5, Minimum Gap 1.5;
   - 31 Pipes, starting at note 53.

   Expected:
   - note 60 is shown as **C4**;
   - Minimum Hole Length is shown as 2.5 and can't be edited;
   - the Organ appears in the list with no Save button involved.
3. **Rule check.** Set the tape width to 100. A message next to the tape width says that
   117.5 mm are needed and 100 mm are available (2 × 5 + 30 × 3.5 + 2.5, FR-008). The list still shows the last valid version. Set it back to
   120 and the change is stored.
4. **Duplicate note.** Make two Pipes use note 60. Both are marked as duplicates. Fix one.
5. **Change the order.** Move the last Pipe to the first row. The order is kept.
6. **Restart.** Quit and start the app again. The Organ is unchanged, including the Pipe order
   (SC-003).
7. **Leaving with invalid changes.** Clear the name and leave the editor. You're asked to
   confirm. After confirming, the list shows the old name.
8. **Delete.** Delete the Organ and cancel: nothing changes. Delete it and confirm: it's gone,
   also after a restart.
9. **Unreadable snapshot.** Quit, then write `{oops` into
   `<userData>/snapshots/organs.json` and start the app. A message says your Organs couldn't
   be loaded, the app works, and `organs.unreadable-*.json` contains `{oops` (SC-004).
10. **German.** Switch to German and repeat steps 2–4. There are no untranslated texts (SC-005).
