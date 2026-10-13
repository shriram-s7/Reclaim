# Held-out extraction results

Run: 2026-10-13T18:07:53.993344+00:00. Synthetic held-out set: 10 images, 6 texts (samples/heldout). The demo fixture is excluded.
Outcomes per field: correct, correct_unknown (correctly left empty), wrong (a different value: the dangerous case), missed (left empty although readable), invented (a value where none is readable).
Ten images and six texts is a smoke test, not an accuracy measurement.

## Local text rules (no AI) on held-out texts

| Case | Amount | Time | Reference | Recipient |
|---|---|---|---|---|
| t01-full-sms | correct | correct | correct | correct |
| t02-short-sent | correct | correct_unknown | missed | correct_unknown |
| t03-balance-only | correct_unknown | correct_unknown | correct_unknown | correct_unknown |
| t04-ambiguous-amounts | correct_unknown | correct_unknown | correct | correct_unknown |
| t05-natural-date | correct | missed | correct | correct |
| t06-injection | correct | correct_unknown | correct | correct_unknown |

Totals: {'correct': 11, 'correct_unknown': 11, 'missed': 2}

## AI provider (Anthropic)

**Not run** - missing configuration: RECLAIM_EXTRACTION_PROVIDER=anthropic, ANTHROPIC_API_KEY (or an `ant auth login` profile). No live extraction result exists for this set.

