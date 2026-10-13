# Reclaim current status

Updated: 13 October 2026, Asia/Kolkata.
Phase: working local prototype; user-focused workflow refinement.

Latest milestone: C05 guided delays and reminders. Read docs/GUIDED_WORKFLOW.md.
35 backend tests and the production build pass. Browser verified unanswered attempt ->
saved reminder -> alternate-channel suggestion, restart persistence and calendar export.
Intake now has five short steps, at most two ordinary inputs per screen. Existing
three-step mentions below describe the earlier baseline, not the latest interface.
Tamil assistance is a limited preview, not a completed translation.
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
Priority update: follow `docs/INTELLIGENCE_ROADMAP.md` I1-I5. The existing app is the
baseline; the distinguishing evidence-to-action engine is not built yet.
1. Finish presentation view QA; revised mobile save/next-step flow now verified.
2. Add safe editing of confirmed case facts with explicit re-confirmation.
3. Improve live extraction behind a configured provider; keep honest manual fallback.
4. Review Tamil translations and multilingual PDF font/shaping before enabling them.
5. Add multiple transactions after the single-transaction path is reliable.

## Known limits
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
