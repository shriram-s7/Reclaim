# Progress log

## 2026-10-13 - C08a: AI evidence-reading adapter (not configured)
- Checked configuration first: no Anthropic key/token in any environment scope, no `ant`
  profile, provider flag unset. Live extraction cannot run and is not claimed.
- Added official `anthropic` SDK 1.13.0 (pinned with its dependencies) and
  backend/app/provider.py: strict schema, server re-validation, consent gate, timeout,
  size limits, metadata stripping, null-for-unclear, quote grounding, calm manual fallback.
- Endpoints: GET /api/extraction/status, POST /api/evidence/read (intake),
  POST /api/cases/{id}/evidence/read; case creation can attach a reading (reading_id) and
  does not re-ask what the person confirmed. Questions gain "why" and "Answer later".
- Held-out synthetic set (10 images, 6 texts; visually checked, two truth errors fixed
  before any run) and scripts/eval_extraction.py. Local rules: 11 correct, 11 correct-unknown,
  2 missed, 0 wrong. Provider: not run (missing configuration).
- Checks: 84 backend tests passed (28 new provider tests, fakes only; two safety rules
  mutation-checked). See docs/AI_EXTRACTION.md.

## 2026-10-13 - C07: evidence reconciliation with adaptive clarification
- New evidence model (candidate facts + source quote + read/unreadable) kept apart from
  confirmed payments; multiple payments with total; legacy cases normalised on read.
- Deterministic placement (same/separate/unrelated/unknown), possible-duplicate and
  conflict detection, one-question queue with "I don't know", answer changes.
- Proposed changes apply only after re-confirmation (version-checked, logged); manual
  correction form; all drafts and PDF regenerate from confirmed facts.
- Text quotes come from the existing local parser (refactored to return exact quotes;
  behaviour and its tests unchanged).
- Checks: 56 backend tests passed (17 new); build passed; real reclaim.db copy (4 cases)
  loads with docs/PDF/export; browser walkthrough of all five acceptance scenarios plus
  typed evidence and manual correction; 360px without overflow.
- Found and fixed during browser check: "1 minutes" wording; unknown references were
  duplicated into drafts' "still checking" list; case view briefly kept the previous
  case's data when switching cases.
- Simulated: practice evidence is synthetic fixtures. Not built: image reading, AI provider.

## 2026-10-13 - C06: implementation audit against documentation
- Baseline re-run before edits: 35 tests passed, build passed. Then walked the journey in
  Chrome on a separate audit server (127.0.0.1:5173, tmp/audit.db) and API probes.
- Defects found and fixed (each reproduced first):
  1. Browser/phone Back during intake left the app and lost every answer; reload did too.
     Steps are now history entries; unsaved answers are kept in sessionStorage for the tab,
     with a "Clear my answers" control. Draft is removed once the case is created.
  2. "₹18,000" / "Rs. 1,80,000" rejected as invalid amounts. Prefixes/commas now accepted.
  3. Correcting a saved reference silently cancelled the follow-up reminder and turned a
     user-resolved step back into waiting. Corrections now keep state and reminder; first
     report still clears the attempt reminder. Report saves/updates are in journey_history.
  4. Mistyped years (e.g. 0026) created cases. Server rejects years before 2000; the form
     bounds the pickers and warns when a payment is over a year old.
  5. Forward navigation to the check screen could use a stale amount. Amount is re-parsed
     and all steps re-validated at confirmation.
  6. Correction form stayed open after saving; the saved reference was not shown. Form now
     closes; the step shows the saved reference or "pending".
  7. Step labels "no answer"/"waiting" were ambiguous. Now "No answer · not reported yet",
     "Reported · awaiting reply", "Reported · you marked resolved" (user-reported only).
  8. Cancelling a reminder gave no feedback. It now confirms; status is unchanged.
  9. Deleted case left a dead "Continue my report" link. Cleared on not-found.
  10. At 360px the suggested-next-step button overflowed horizontally; now wraps.
  11. Quick incident choices overwrote typed descriptions; they now prepend.
- Checks: 39 backend tests passed (4 new); production build passed; checkpoint ZIP hashes
  match C03/C05 manifests. Screenshot: docs/screenshots/c06-phone-360-audit.jpg.
- Not tested: real phone hardware, screen readers, calendar import, independent users.

## 2026-10-13 - C05: guided delay-aware workflow
- Added persisted journey states, explanation-based next action and reminder times.
- No-answer/later does not mark reported. Waiting/resolved needs an actual saved report.
- Reduced intake to at most two inputs per step; added quick incident choices and an
  optional safety question. Tamil choice assistance is explicitly a review-needed preview.
- Improved bank/time/control-character validation and review warnings.
- 35 tests pass; production build passes. Browser verified no-answer/reminder/persistence.
- Calendar export downloaded and its time/alarm fields inspected; calendar notification
  delivery was not tested and requires user import/settings.
- See GUIDED_WORKFLOW.md for exact limits and next work. C03 ZIPs remain unchanged.

## 2026-10-13 - C04: immutable baseline backup and intelligence audit
- Saved commit 1075d02 to source ZIP plus separate compiled frontend ZIP in checkpoints/.
- Opened both archives, checked CRC integrity, and recorded SHA-256 hashes and restore steps.
- Audited current capabilities: real local backend but no live vision/adaptive reasoning.
- Added INTELLIGENCE_ROADMAP.md with acceptance gates and explicit completion uncertainty.
- Next implementation: I1 evidence provenance, conflicts and re-confirmed case corrections.

## 2026-10-13 - C01: requirements reconciliation
- Read all six source PDFs (31 pages); preserved originals and extracted text.
- Confirmed four-person team; user prioritizes implementation.
- Established durable handoff files and pre-event disclosure.
- Future-rule claims could not be verified from an accessible primary notification.
- Next: implement and test the local case workflow.

## 2026-10-13 - C02: working local prototype
- Implemented React/TypeScript interface, FastAPI API, SQLite persistence, three
  reporting drafts, per-channel reporting records, local queue and export endpoints.
- Synthetic receipt generated locally; exact-byte fixture extraction and manual fallback.
- Frontend production build passed. Backend: 20 tests passed (1 dependency deprecation
  warning). Test sockets required an approved run outside the restricted sandbox.
- Browser: loaded sample, reviewed facts, created case, recorded helpline/bank/portal
  references; progress reached 3/3 and drafts contained earlier references.
- Local server started at http://127.0.0.1:8000. No external deployment.
- Next: PDF visual QA, mobile layout, final handoff documentation and Git checkpoint.

## 2026-10-13 - C03: ordinary-user workflow
- User explicitly prioritized ordinary people and a clear working journey.
- Removed dashboard controls/sidebar from citizen screens; split entry into three steps.
- Simplified labels and added a next-action button after saving a report.
- Added conservative text extraction, PDF unsupported-glyph error, database cleanup.
- 26 backend tests passed; latest frontend build passed. Revised three-step form
  browser-tested to confirmation. Full updated mobile save/next-step QA remains next.
- Sample PDF rendered and visually reviewed on both pages.
- Final browser check: revised flow saved a case, saved one reporting reference, and
  Next opened the bank draft. No horizontal overflow at 360px. Screenshot saved.
