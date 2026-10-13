# Reclaim current status

Updated: 13 October 2026, Asia/Kolkata.
Phase: working local prototype; user-focused workflow refinement.

Latest milestone: C06 implementation audit and journey fixes (see docs/GUIDED_WORKFLOW.md,
"C06 audit"). 39 backend tests and the production build pass (scripts/verify.ps1).
Browser-verified on a separate audit DB: wrong input, Back/reload without losing answers,
no-answer vs reported labels, waiting + reference correction, reminder cancel, due reminder
after reopening, deleted-case resume link, and 360px layout with no horizontal overflow.
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
Priority: `docs/INTELLIGENCE_ROADMAP.md` I1-I5. The evidence-to-action engine is not built.
1. I1: safe editing of confirmed case facts with explicit re-confirmation.
2. Independent (non-developer) phone walkthrough of the C06 journey; record confusion points.
3. Custom reminder date/time; "later" currently offers only 15/30/60 minutes.
4. Improve live extraction behind a configured provider; keep honest manual fallback.
5. Review Tamil translations and multilingual PDF font/shaping before enabling them.

## Known limits
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
