# Reclaim: from panic to a prepared case

Version 2, 13 October 2026. This is the active implementation plan.

Update: `docs/INTELLIGENCE_ROADMAP.md` defines the next milestone. Intelligence is now
the central hackathon deliverable, not optional polish. Preserve the local baseline while
building source-linked evidence reconciliation and adaptive clarification.

## Product
Reclaim helps a person facing payment fraud take immediate reporting actions, turn
their evidence into a consistent case, and keep a record of follow-through.
The main result is **a reviewed case pack and a clear next action**, not a promised refund.
The demo should prove that the same confirmed facts move through call notes, a portal
draft, a bank letter and a reviewer workspace without retyping or losing references.

User requested implementation first; business research and a sales deck are deferred.
Four teammates are available, but no role assignments are assumed or delegated.

## What changed from the PDFs
1. Replace “First-5-Days” with “Report quickly. Keep your case together.” A five-day
   window could suggest waiting is safe and depends on an unverified future rule.
2. Emergency actions appear immediately. Do not make the user upload evidence before
   seeing reporting channels. Bank contact and 1930 are independently accessible.
3. Keep AI as an optional assistant; deterministic documents and manual entry work first.
4. Show missing facts and user corrections, never invented reference digits or confidence.
5. Track drafted, user-reported and independently verified states separately. Prototype
   implements the first two only. Reference entry is not independent verification.
6. The dashboard is a local demonstration of a review queue, not an actual bank inbox.
7. No default entitlement amounts, legal countdown, automated escalation or future clock.
8. Keep paise as integer minor units. Preserve exact reference strings and UPI handles.

## Priority scope
P0: immediate action guide; manual details; mandatory confirmation; persistent cases;
three deterministic drafts; editable reporting records with actual reporting times;
local review queue; case export; deletion; repeatable synthetic sample; failure handling.

P1: explicit synthetic screenshot fixture lookup, safe image validation, text parsing;
PDF case pack; stage view; evidence-gap indicators; mobile accessibility; copy fallback.

P2: live vision extraction with a configured key and bounded timeout; reviewed Tamil
translations; multiple transactions; verified policy profiles; secure deployment.

Defer: WhatsApp API, reminder delivery, bank SSO, bank integrations, real claims,
arbitrary sensitive uploads to third-party models, production multi-tenancy.

## Phases and gates
| Phase | Deliverable | Exit gate |
|---|---|---|
| 0: reconcile | sources, decisions, scope, checkpoints | all six PDFs read; contradictions logged |
| 1: core | case model, validation, persistence, deterministic drafts | API tests cover create/read/report/delete and bad inputs |
| 2: user journey | action guide, sample/manual capture, confirmation, case view | browser can complete a case without a key or internet services |
| 3: evidence and review | known sample extraction, PDF, review queue, stage | exact confirmed facts survive export and queue updates |
| 4: resilience | mobile, failures, privacy and reset/reload | build/tests pass; narrow-screen and end-to-end review recorded |
| 5: optional intelligence | live extraction and Tamil | honest source labels; timeouts; human translation review |
| 6: event finish | challenge work, final verification and submission | artifacts ready before 09:00 jury, submission by 11:00 |

Phases 1-4 are the initial local prototype. A phase is complete only when its gate has
evidence in STATUS.md. Phase 5 must not delay Phase 4. No false “AI” badge for fixtures.

## Event alignment (IST, 14-15 October)
Use the Event Flow's earlier times conservatively: 08:30 registration; 11:00 build start;
11:30 topic validation; 14:30 first evaluation; challenges at 19:00, 00:00, 06:00;
09:00 final evaluation; 10:00-11:00 submission; 11:00 close.
Participant instructions instead say 11:30 start/end. Ask organizers on arrival;
never assume the later deadline. Topic approval and three separate proposals remain
event requirements; only one original Reclaim proposal is present. Do not pretend
they are approved/submitted. User has deferred business work, not removed event rules.

With pre-event code available, use event hours for demonstrated improvements:
- 11:00-11:30: record baseline, confirm approved topic and rules, smoke-test machine.
- 11:30-14:00: improve extraction and evidence-gap handling; rehearse by 14:00.
- 14:30-18:30: reviewed language support or multiple transactions; retain working main flow.
- 19:00-00:00: respond to challenge 1; review PDF, mobile and persistence.
- 00:00-06:00: challenge 2 and targeted hardening; rest in shifts.
- 06:00-08:00: challenge 3; freeze scope at 08:00.
- 08:00-09:00: full rehearsal and backup recording; no new dependencies.
- 09:00-11:00: jury and submission; preserve tagged final baseline.

## Architecture
React + TypeScript + Vite, FastAPI, SQLite, deterministic Python templates, ReportLab.
One origin: backend serves the built frontend; Vite proxies /api during development.
No external fonts or runtime CDN dependency. Loopback only; all data synthetic.
SQLite stores confirmed case JSON; time fields are timezone-aware UTC, displayed IST.
Database paths are stable relative to the repository, not the terminal working folder.
No legal conclusion is derived from a screenshot, a scam label or a completed checklist.

## Tests that matter
- Reject nonpositive/invalid amounts, naive/future timestamps and unconfirmed cases.
- Saving a reference must not silently substitute save-time for the reporting time.
- Completion requires all reporting records, not merely opening external links.
- Templates preserve paise, UTR and @ in handles; no invented attachments or acknowledgements.
- Unknown images use manual fallback; renamed images cannot trigger sample answers.
- PDF handles long text, markup-like input, references and missing fields.
- Deleted cases disappear from reads, exports and the queue.
- No remote services required for local sample path after dependencies are installed.

## Demo
Start with the immediate action buttons. Load a clearly marked fictional ₹18,000 case.
Show evidence confirmation and a missing-field hint. Create the case; copy the bank
letter and portal draft. Enter fictional references with reporting times. Open the
review queue and export the PDF. Close with: “Reclaim makes the next action clear and
keeps the case consistent. Authorities and banks determine the outcome.”

Success measures for a future usability pilot: time to locate reporting actions,
time to prepare a case, correction rate, missing required facts, reporting completion
as attested by users. No recovery-rate, time-saving or adoption claim without measurement.
