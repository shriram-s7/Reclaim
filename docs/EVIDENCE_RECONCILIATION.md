# Evidence reconciliation milestone - C07

Date: 13 October 2026. Implements roadmap I1 and the deterministic part of I3.
Code: `backend/app/evidence.py`, `frontend/src/EvidencePanel.tsx`. Tests: `backend/tests/test_evidence.py`.

## Implemented versus simulated
| Capability | Status |
|---|---|
| Evidence model: candidate facts with source, exact quote and read/unreadable status, stored apart from confirmed facts | Implemented |
| Multiple confirmed payments (`transactions`), total, multi-payment drafts | Implemented |
| Pasted-text evidence read by local regex rules with exact quotes | Implemented (rules, not AI) |
| Typed evidence ("type what it shows", incl. "reference unreadable") | Implemented |
| Conflict detection: amount, date/time (10-minute tolerance), reference, recipient | Implemented, deterministic |
| Possible-duplicate detection (same reference, or same amount within 24 h) asking for confirmation | Implemented, deterministic |
| One-question-at-a-time clarification queue with "I don't know" and answer changes | Implemented |
| Proposed changes applied only after explicit re-confirmation, version-checked, logged | Implemented |
| Manual correction of saved facts with re-confirmation; all drafts regenerated | Implemented |
| Practice scenarios (amount conflict, two screenshots, unreadable reference) | **Synthetic fixtures**, labelled in UI and data as not AI |
| Reading screenshots/images | **Not implemented.** Images are not read or stored |
| Live AI / OCR provider | **Not implemented** (roadmap I2) |

## Rules
- Evidence never changes confirmed facts by itself. Every item is placed by the person:
  same payment, separate payment, unrelated, or "I don't know". Nothing auto-merges.
- A separate payment is only *proposed*. The total changes only after re-confirmation.
  A proposed payment without a known amount and time cannot be added.
- Conflict answers store the chosen value, not an index; question IDs derive from the
  linked evidence and the distinct values, so a resolved question stays resolved after
  the change is applied and reopens only when new conflicting evidence arrives.
- "I don't know" keeps the saved value. Conflicts left unknown appear in drafts under
  "Details I am still checking"; unknown references show as "Not provided". No digits are
  inferred from partial or cut-off references.
- Removing evidence or changing an answer never deletes a confirmed payment.
- Corrections are rejected if a saved report time would precede the earliest payment.
- Stale review (facts_version changed) returns 409 and asks the person to check again.
- Cases saved before C07 have no `transactions`/`evidence`; they are normalised on read
  (payment T1 from top-level fields) and written in the new shape on next change. The
  first payment stays mirrored in top-level fields for older readers.

## API
POST /api/cases/{id}/evidence (kind + text or typed); POST /api/cases/{id}/evidence/practice/{scenario};
DELETE /api/cases/{id}/evidence/{evidence_id}; PUT|DELETE /api/cases/{id}/clarifications/{question_id};
POST /api/cases/{id}/corrections {version, confirmed}; PUT /api/cases/{id}/facts {version, confirmed, ...}.
Case reads include `transactions`, `total_paise`, `facts_version`, `corrections`, `evidence`
and `reconciliation` {questions, answered, changes, unsure, links, payment_names, note}.

## Verified (13 October 2026)
- 56 backend tests pass (17 new evidence tests, incl. all five acceptance scenarios,
  version/re-confirmation, invalid answers, legacy JSON, determinism); build passes.
- A copy of the existing `reclaim.db` (4 saved cases) loaded through the new code:
  case, docs, PDF and JSON export all returned 200. The original file hash was unchanged.
- Browser (audit DB, port 5173): amount conflict with sources -> chose ₹20,000 ->
  re-confirmed -> header, drafts and correction history updated; two screenshots ->
  separate payment -> unreadable reference left unknown -> total stayed ₹18,000 until
  confirmation, then ₹36,000 across 2 payments; unreadable reference -> "I don't know" ->
  no question left, reporting steps still usable; typed evidence -> "not about my loss";
  manual correction with confirmation. 360px frame: no horizontal overflow
  (docs/screenshots/c07-evidence-conflict-360.jpg).

## Limits and next
- Duplicate thresholds (24 h, 10 min) are product judgments, not validated on real data.
- Only one best duplicate candidate is offered; with many similar payments the person
  may need the placement question instead. No removal of a confirmed payment yet.
- No independent user testing of question wording. Tamil not provided for this panel.
- PDF lists corrections but not evidence quotes. Pending/unplaced evidence is excluded
  from drafts by design.
- Next: I2 provider adapter behind consent and timeout, feeding the same candidate-fact
  model; then held-out synthetic evidence results and user testing (I4).
