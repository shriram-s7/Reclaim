# Reclaim intelligence milestone and honest completion audit

Date: 13 October 2026. Supersedes the earlier classification of intelligence as
optional polish. The ordinary person's reporting journey remains the main product.

## What we have
A working local reporting assistant, not merely static frontend pages: FastAPI validates
data, SQLite persists it, templates produce consistent drafts, reporting records retain
timestamps, and PDF/JSON exports work. The UI is a guided three-step intake.

What looks intelligent today is conservative regex text parsing and a known synthetic
image fixture. Neither is live vision, scam reasoning, evidence reconciliation or
independently verified filing. The dashboard adds visibility, not intelligence.

## The central differentiator to build
**Turn messy evidence into an explainable next action, with the fewest possible questions.**

A user shares a transaction receipt, a chat excerpt and a bank message. Reclaim builds
a case from these sources. If amounts disagree, it shows the two source snippets and
asks the user to resolve the conflict. If two documents describe the same transaction,
it avoids counting the loss twice. It asks for genuinely missing details, preserves
uncertainty, and produces consistent drafts from the facts the user confirms.

The user sees ordinary sentences and short choices. The judges can expand a separate
“Why this question?” / “Where did this detail come from?” view to inspect the evidence.
This is our proposed distinguishing capability, not a researched claim that no one else
has built something similar. Winning remains dependent on execution and judging.

## Four parts of the engine
1. Evidence reading: a provider adapter reads images/text into candidate facts with
   evidence IDs, exact source quotes where available, and null for absent values.
   A model's claimed confidence is not a calibrated accuracy score.
2. Reconciliation: deterministic rules identify duplicate transactions, conflicts,
   invalid dates, missing facts and mismatched amounts; ambiguous candidates stay separate.
3. Adaptive questions: choose one unresolved, actionable question at a time. Prioritize
   correcting contradictions and high-value missing facts; allow “I don't know”.
   Emergency reporting access is always available and never waits for AI or a score.
4. Action planning: explicit workflow state maps confirmed facts and reporting progress
   to the next action, with a reason. Model prose cannot invent bank policy, legal
   deadlines, official acceptance or a refund. Policy guidance requires verified sources.

The LLM reads and suggests; typed validation and workflow rules control persistence,
documents and actions. No autonomous filing or money handling.

## Strong demo, with honest evidence
Use a small held-out synthetic evidence set, not only the known fixture:
- Receipt and bank SMS show INR 18,000; a chat claims INR 20,000. User is asked which
  figure represents the actual debit, with the relevant sources displayed.
- Two screenshots share the same reference. App marks a possible duplicate rather
  than adding the amounts. User confirms whether they are the same transaction.
- One reference is unreadable. App asks for it or lets the user leave it unknown;
  no invented digits are generated.
- After clarification, show that every draft uses the resolved facts.
- Disable the provider: manual capture still reaches the same reporting flow.

Do not advertise automatic recovery, financial fraud detection accuracy, or live bank
connections. Demonstrate measurable evidence preparation and reduced repetitive input.

## Completion assessment
No honest exact percentage exists before scope and acceptance tests are fixed.
The range below is an engineering estimate, not a measured completion score.

| Area | Current state | Required next proof |
|---|---|---|
| Guided intake and manual reporting | Working first version | Independent user can finish without coaching |
| API, persistence, drafts, exports | Working local prototype | Re-confirmed edits and multiple transactions remain consistent |
| Image evidence reading | Fixture only | Held-out screenshots parsed by real provider with timeout/fallback |
| Text extraction | Basic patterns | Ambiguous formats and balances do not become invented loss amounts |
| Multi-evidence case construction | Not built | Source-linked facts, conflicts and deduplication tested |
| Adaptive clarification | Not built | Only needed questions, unknown option, correction loop |
| Context-aware next action | Fixed reporting workflow | State-driven guidance with visible reasons |
| Tamil and voice accessibility | Not built | Human-reviewed strings; supported-device checks; fallback input |
| Follow-up and reminders | Not built | Clear user-controlled follow-up; no fake delivery claims |
| Policy guidance | Intentionally off | Primary-source verification and applicability tests |
| Hackathon evaluation | 26 API tests; browser checks | Held-out evidence results, user-task results, failure demo |
| Production protection/integrations | Not built | Authentication, isolation, retention, threat review, operational testing |

Against an intelligent hackathon MVP (not a production service), estimate **35-45%
built, 55-65% remaining**. This is weighted judgment: the hardest distinguishing work
is still ahead. The basic reporting prototype is much further along than the intelligent
MVP. A production readiness percentage would be misleading at this stage.

## Revised build order and gates
### I1 - Evidence model and safe corrections (next)
Introduce EvidenceItem, CandidateFact, ConfirmedFact, Transaction, Conflict and
Clarification. Store source provenance separately from confirmed user input. Add case
editing that explicitly requires confirmation and regenerates all drafts. Preserve the
working route during migration. Gate: conflicting and duplicate synthetic facts cannot
silently change totals or documents; saved corrections survive reload.

### I2 - Live evidence reading
Add one bounded image/text provider adapter behind environment configuration, strict
schema validation and explicit data-sharing consent for any external provider.
Use synthetic development data. No credentials yet: adapter and mocked failure tests
can be built, but live extraction cannot be claimed until tested with a configured key.
Gate: held-out inputs, malformed model output, timeout and no-key scenarios recorded.

### I3 - Reconciliation and adaptive questions
Build deterministic conflicts/deduplication, source review and one-question interface.
Give reasons without exposing technical jargon. Gate: the three demo scenarios above
resolve correctly, including “unknown” and corrections; no fixture-based accuracy claim.

### I4 - Integrate into the ordinary user flow
Evidence -> necessary clarifications -> check -> immediate reporting guidance -> saved
references -> downloadable pack. Optional evidence upload never blocks manual reporting.
Use a clear next step; keep reviewer controls off the user journey.
Gate: three independent testers attempt synthetic scenarios; record task time, errors,
requests for help and misunderstandings. These are usability observations, not clinical
or population-level evidence.

### I5 - Final demonstration and targeted accessibility
Reviewed Tamil core prompts if a speaker is available, repeatable reset, provider-failure
demo, backup recording and final artifacts. No voice feature that secretly drops content.
Gate: a complete rehearsal, evidence results table and accurate implementation disclosure.

## Effort estimate and cuts
I1-I4: roughly 12-20 focused engineering hours on the current foundation, subject to
provider access, evidence formats and integration problems. I5: an additional 3-5 hours.
Four teammates can split preparation/testing/translation work, but effort does not
divide linearly by four. These are estimates, not commitments or elapsed-time forecasts.

If time is tight, prioritize I1-I4 with English and one payment channel. Cut voice,
WhatsApp, delivered reminders, policy calculators and dashboard polish first. A working
conflict-resolution demo is stronger than many disconnected features.

## Remaining event work
Technical excellence alone does not replace the event's tech-plus-business evaluation.
Business work was deferred by user request; customer validation, a concise value case,
topic approval, proposal requirements and final submission still need completion.
All existing code is a disclosed pre-event baseline; onsite improvements get separate commits.
