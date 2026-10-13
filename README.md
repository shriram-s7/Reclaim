# Reclaim

A local hackathon prototype that helps prepare cyber-fraud reporting documents and
track user-entered references. Built from the six supplied PDFs, with corrections in
[the active plan](docs/MASTER_PLAN.md).

**Start here after switching model or editor:** [STATUS.md](STATUS.md), then
[AGENTS.md](AGENTS.md). Original PDFs are preserved; the revised Markdown governs work.

## Run on this Windows machine

The environment and production frontend have already been installed and built.
From `D:\RECLAIM`:

```powershell
.\scripts\run.ps1
```

Open http://127.0.0.1:8000. Review queue: `/bank`. Side-by-side presentation: `/stage`.
Keep the server on loopback. Do not use personal data or expose this open demo online.

## Fresh setup

Requires Python 3.12+ and Node 20.19+ / npm. Internet is needed for initial installation.

```powershell
.\scripts\setup.ps1
.\scripts\verify.ps1
.\scripts\run.ps1
```

Dependency versions are recorded in `backend/requirements.txt` and
`frontend/package-lock.json`. The current virtual environment uses the bundled
Python 3.12 runtime. The bootstrap uses system pip's `--python` option because that
bundled runtime does not include pip inside the virtual environment.

For frontend development, keep the API running and use `npm run dev` in `frontend`.
Build with `npm run build`. The backend serves `frontend/dist` for the single-port demo.
Restart the backend after its code changes; reload the browser after a frontend build.

## Demo in 90 seconds

1. Point out immediate 1930/bank actions on the home screen.
2. Prepare my case → Use fictional sample → Review details → confirm → Create my case.
3. Show the same amount, reference and recipient in all three drafts.
4. Enter fictional report references and actual demo reporting times; record each action.
5. Open Review workspace and show progress. Download the case pack.

The sample screenshot is `samples/synthetic-payment.png`. Download it from the form
and upload it through “Try sample image” to test the fixture pipeline. It is deliberately
labeled synthetic. Unknown images return manual entry; no API key or external AI service
is configured. Images are not retained or included in the case pack.

## Data and limits

- `reclaim.db` stores fictional cases locally and is ignored by Git.
- Only the resume case ID is kept in browser storage; delete clears the case server-side.
- No government submissions, bank integration, background reminder delivery, authentication or payments.
- Guided delayed/failed contact states, saved in-app reminders and calendar export are
  available. Calendar alerts require import and depend on calendar settings.
- No legal eligibility or compensation calculation; see `docs/DECISIONS.md`.
- Sources of reporting records are users; these are not official filing confirmations.
- Prototype currently supports one transaction per case and an English interface.
- Do not interpret a case pack as evidence that a report was filed or funds recovered.

## Project map

| Location | Purpose |
|---|---|
| `backend/app` | validation, persistence, drafts, PDF, API |
| `backend/tests` | behavior and failure tests |
| `frontend/src` | responsive assistant, queue, presentation view |
| `samples` | fictional receipt and reproducible generator |
| `docs/MASTER_PLAN.md` | phased build and acceptance gates |
| `docs/DECISIONS.md` | corrections, source status, product decisions |
| `docs/PROGRESS.md` | durable milestone history |
| `PRE_EXISTING.md` | disclosure of work before the event |

See `STATUS.md` for the latest verified state and exact next tasks. No GitHub remote
has been configured; local history is not the same as a submitted repository.
