---
name: translation-correction
description: Correct usage of translations in Angular from a report.
license: MIT
compatibility: opencode
metadata:
  tags:
    - i18n
    - angular
    - translation
---

## What I do

Step 1: Find the Report 
Search for an existing report in documentation/translation/reports.
If no report is found, stop this skill and run the translation-validator first.

Step 2: Create missing translations
When a translation is missing, create it.
Use the translations in other languages to find the intended message.
If no translation exists for the key, use the key and the surrounding context where it is used to guess the intended message.

Step 3: Match parameter usage
When a translation incorrectly uses parameters, fix their usage.
If the param is used in one language, but not the other or the param is filled at runtime, but not used in any translation:
  Try to find where it was supposed to be used in the sentence and insert the param. Use double curly braces to interpolate the param
If the param is not filled at runtime, add them with you best guess what variable was supposed to be used.

Step 4: Fix meaning mismatches
When the message has different meanings in different languages, change one of them.
Ask the user which translation is the better fit and translate it to the message where it previously had another meaning.


## When to use me

When asked to fix the validations.

After everything is fixed, show a list of the changes and remove the report.
