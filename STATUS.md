# Reclaim current status

Updated: 13 October 2026, Asia/Kolkata.
Phase: working local prototype; user-focused workflow refinement.

In progress: C08 AI reading + journey + Tamil. C08a done: provider adapter built and tested
with fakes; NOT configured here (no key), so no live extraction exists. See docs/AI_EXTRACTION.md.
Previous milestone: C07 evidence reconciliation with adaptive clarification. Read
docs/EVIDENCE_RECONCILIATION.md (implemented vs simulated). 56 backend tests and the build
pass. Browser-verified all acceptance scenarios on a separate audit DB; existing saved cases
load (copy of reclaim.db, 4 cases). Evidence checks are rules-based; practice evidence is
labelled synthetic fixtures; images are not read; no AI provider is connected.
Earlier: C06 journey audit fixes (Back/reload keeps answers, reference correction keeps
reminders, clear reported/unreported labels).
Previous: C05 guided delays and reminders. Intake has five short steps, at most two
ordinary inputs per screen. Tamil assistance is a limited preview, not a translation.
In-app reminders/calendar export are implemented; SMS/push/background delivery is not.

## User direction
Four teammates. Prioritize implementation. Build for ordinary people, with a clear,
calm workflow; dashboard is secondary and absent from the everyday navigation.

## Completed
- Read all six PDFs (31 pages), preserved originals and extracted searchable text.
- Revised plan and policy/source decisions in docs/MASTER_PLAN.md and docs/DECISIONS.md.
- React + FastAPI + SQLite local app: confirmed case creation, reporting drafts,
  saved references and reporting times, deletion, PDF/JSON exports, demo queue/stage.
- Exact-byte synthetic screenshot fixture and conservative local message parsing.
- Three-step form: payment details -> incident details -> confirmation.
- Removed dashboard/sidebar from citizen flow; simpler copy and next-step action.
- First Git checkpoint: 21c9c7d. Further refinements are saved in a subsequent commit.

## Verification
- Backend: 26 tests passed, one upstream Starlette/httpx deprecation warning.
- Latest frontend production build passed.
- Browser: earlier complete three-report journey reached 3/3 with correct draft references.
- Browser: revised three-step form creates a case; saving a step exposes the correct Next action, which opens the bank draft.
- Local message parsing preserves paise and leaves missing date blank.
- PDF sample rendered and both pages visually inspected; no clipping found.
- Latest 360px case screen measured at 345px document width, without overflow.

## Run and resume
Read AGENTS.md, docs/MASTER_PLAN.md, docs/DECISIONS.md.
Run scripts/run.ps1 from D:/RECLAIM; http://127.0.0.1:8000.
Server started in this chat; if unavailable rerun the script. It is loopback only.
Run scripts/verify.ps1. Restricted execution may need permission for test-loop sockets.

## Next work
Priority: `docs/INTELLIGENCE_ROADMAP.md`. I1 and deterministic I3 are done (C07).
1. I2: provider adapter for image/text reading behind explicit consent, timeout and schema
   validation, producing the same candidate facts; mocked failure/no-key tests first.
2. Held-out synthetic evidence set and results table; independent user test of questions.
3. Removing a confirmed payment with re-confirmation (currently not possible).
4. Custom reminder date/time; review Tamil strings incl. the evidence panel.

## Known limits
- Evidence: duplicate/conflict thresholds are unvalidated product judgments; images are
  never read; practice scenarios are fixtures. See docs/EVIDENCE_RECONCILIATION.md.
- Phone checks used a 360px same-origin frame inside desktop Chrome, not a real device.
- On a phone, "How did this step go?" sits below the draft text; users must scroll to it.
- A server started by an earlier session may still be listening on port 8000 with old
  code. Restart scripts/run.ps1 to serve the C06 build.
- No live screenshot OCR/AI, background reminder delivery, authentication, real filing or bank integration.
- PDF currently supports its bundled Latin font; unsupported glyphs return a clear
  error and JSON preserves the original text. Do not claim Tamil PDF support.
- No refund calculator or legal countdown: future policy remains unverified.
- No GitHub remote, topic approval or submission confirmed. Work is pre-event.
- Synthetic data only. Do not expose the unauthenticated demo queue publicly.

## Immutable backup
C03 source and compiled-frontend ZIPs: `D:\RECLAIM\checkpoints`.
Source: `reclaim-c03-1075d02-source.zip`; build: `reclaim-c03-1075d02-build.zip`.
Both passed ZIP integrity checks. Hashes: checkpoints/C03-MANIFEST.json.
Restore instructions: checkpoints/RESTORE.md. No dependencies or case database included.
These are same-drive backups, not off-device disaster recovery.
