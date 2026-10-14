# Reclaim current status

Updated: 14 October 2026, Asia/Kolkata. Latest milestone: C09 independent handoff audit.
Local fictional-data prototype; do not expose the unauthenticated backend publicly.

## Verified state
- Claude handoff commits: 77cdd62 (journey fixes), 3cc029e (reconciliation),
  5bac402 (provider adapter), eb20380 (reading-first intake and English/Tamil).
- C09 independently reran inherited checks: 93 backend tests and frontend build passed.
- C09 fixes: evidence/answer mutations now invalidate stale confirmations; a missing,
  consumed or expired reading returns a clear 409 instead of silently losing provenance.
  Intake offers re-reading or explicit manual continuation, retaining answers and clearing
  confirmation. Evidence review reloads on 409 and requires a fresh confirmation.
- Current backend suite: 97 passed. Frontend production build passed.
- Browser: local text reading -> short intake -> review -> audit-server restart ->
  reading-lost warning -> explicit manual choice -> unchecked confirmation -> saved case.
  Fictional case RC-581C6FC70CE8 in tmp/c09-browser.db; amount INR 1,250.50 retained.
  Screenshot: docs/screenshots/c09-reading-recovery.png.

## What works
- Real FastAPI/SQLite persistence, validation, reporting drafts, references, PDF/JSON exports.
- Optional reading, five short intake steps, source quotes, one-question evidence placement,
  conflicts, possible duplicates, multiple confirmed payments and re-confirmed corrections.
- Reporting states distinguish not started, later, no answer, reported/waiting and resolved.
  Reminders persist; in-app due checks and calendar export exist. No SMS/push delivery.
- English/Tamil catalogues (585 keys); Tamil awaits native review. Drafts/PDF are English.
- Live AI adapter exists, but no live provider evaluation is recorded. Local rules and
  labelled fictional image fixtures work without a key. Do not call fixtures AI accuracy.

## Next actions, in order
1. Configure the existing provider locally with fictional data and run the held-out
   evaluation; measure errors/unknowns before claiming screenshot-reading accuracy.
2. Test the complete journey with an independent ordinary user on a real phone; obtain
   native Tamil review. The C09 browser test is desktop, not a real-device test.
3. Add safe removal of mistakenly confirmed payments and custom reminder times.
4. Rehearse conflict, duplicate, unreadable evidence, delayed call and provider-failure demos.

## Known limits
- Evidence comparison is rules-based; matching tolerances are not independently validated.
  New linked evidence can reopen answered conflicts. Human confirmation is still essential.
- Reading cache is bounded, in-memory and lasts two hours; restart loses it. Recovery is
  now explicit. Unsaved answers remain in the browser tab, not a cross-device account.
- Natural-language dates can be missed by the local parser. Live semantic accuracy unknown.
- Tamil input is preserved in JSON, but the bundled PDF font cannot render it; export
  returns an error for unsupported glyphs. No reviewed multilingual PDF.
- No background reminder service, authentication, bank integration, real filing, legal
  eligibility calculator, refund promise or production deployment.
- Topic approval/submission not confirmed. Pre-event provenance remains in PRE_EXISTING.md.

## Run and handoff
Read AGENTS.md, this file, docs/MASTER_PLAN.md and docs/DECISIONS.md before editing.
Run scripts/run.ps1 for http://127.0.0.1:8000 with the normal local database.
C09 audit server: http://127.0.0.1:5173, separate tmp/c09-browser.db.
Run scripts/verify.ps1; the test client needs loopback socket permission in restricted runs.
Checkpoint archives and manifests live in D:/RECLAIM/checkpoints; see RESTORE.md.
C03/C05 archives remain historical baselines. C09 source/build backup is recorded in
checkpoints/C09-MANIFEST.json. Same-drive backups are not off-device disaster recovery.
