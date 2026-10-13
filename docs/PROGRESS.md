# Progress log

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
