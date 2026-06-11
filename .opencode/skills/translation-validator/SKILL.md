---
name: translation-validator
description: Validate usage of translations in Angular and create a report.
license: MIT
compatibility: opencode
metadata:
  tags:
    - i18n
    - angular
    - translation
---

## What I do

Step 1: Find all translations
Search src/assets/i18n for available languages
Search components for actual translation pipe/service calls to identify which keys are used.

Step 2: Check unused translations
Compare defined JSON keys against actual Angular template usages found in step 1.
Report keys that exist but aren't called anywhere in the app code.

Step 3: Verify language coverage
Identify which entries have valid values in one language file but use null, comments, or are absent in others.

Step 4: Detect meaning mismatches
Compare string values for identical translation paths across both files.
Flag cases where the message differs unexpectedly or has wrong context/meaning relative to the path structure used in Angular templates.

Step 5: Find unused parameters
Identify {{paramName}} placeholders like "DELETE: "Are you sure... {{ref}}".
Check if all language entries with same key actually define this parameter, and verify it gets passed in component contexts where translation is used at runtime.
Report keys missing from one file entirely or having params without corresponding template usages.

Step 6: Report findings
Report all findings to the user and by writing it to a file in documentation/translation/reports
Output format: HTML table with
* key: translation key for this finding
* issue type: missing, unused, etc
* translation values: a list with the content for this key for each language

## When to use me

When asked to check the translations.

When this skill is done, ask the user if you should run the translation-correction skill with the report that was generated.
