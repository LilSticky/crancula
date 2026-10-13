---
name: i18n-parity
description: Check and fix @ngx-translate keys in src/assets/i18n/ (en.json, de.json) — missing keys in a language, empty values, keys used in src/ that don't exist, unused keys. Use after adding or changing UI text, before committing Angular changes, and when CI's "Translations" step fails.
---

# Translation parity

Every key must exist in both `src/assets/i18n/en.json` and `de.json` (AGENTS.md, i18n). UI texts use dictionary terms from `documentation/DICTIONARY.md` (Organ, Pipe, Tape, …); translate each term the same way in every German key.

## Check

```
npm run i18n:check
```

`scripts/check-i18n.mjs` exits 1 on errors and prints warnings for unused keys. It also runs in CI.

- **Errors**: a key missing in a language, an empty or non-text value, or a key used in `src/` (`'KEY' | translate`, `.instant('KEY')`, `.get('KEY')`, `.stream('KEY')`) that exists in no file.
- **Warnings**: keys no code mentions as a quoted string. Keys built at runtime (`'PREFIX.' + name`) also show up here; check before deleting.

## Fix

1. Missing key: add it to the other language with the right translation, in the same position of the nested structure. If you can't translate confidently, add your best translation and say so in your report; don't leave it empty.
2. Unknown key in code: add it to both files, or fix the typo in the code.
3. Unused key: delete it from both files once you've confirmed nothing builds it dynamically.
4. Rerun `npm run i18n:check` until it shows 0 errors.

Translation files are not production code; the TDD guard does not apply. Commit as `fix(i18n): …` or together with the UI change that needs the key.
