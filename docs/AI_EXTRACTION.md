# AI evidence reading - C08

Date: 13 October 2026. Code: `backend/app/provider.py`; endpoints in `backend/app/main.py`;
tests `backend/tests/test_provider.py`; held-out set `samples/heldout` (generator
`samples/make_heldout.py`); evaluation `scripts/eval_extraction.py`.

## Configuration status (checked 13 October 2026)
C09 recovery correction: reading IDs expire after two hours, eviction or restart.
Missing/consumed/expired IDs now return 409; no case is silently saved without its reading.
The UI retains answers and offers re-reading or explicit manual continuation with fresh
confirmation. The reading is consumed only after the case database write succeeds.

**Not configured on this computer.** No `ANTHROPIC_API_KEY`/`ANTHROPIC_AUTH_TOKEN` in process,
user or machine environment; no `ant` CLI or profile; `RECLAIM_EXTRACTION_PROVIDER` unset.
No live extraction has ever run. To enable, for fictional data only:

```powershell
$env:RECLAIM_EXTRACTION_PROVIDER = 'anthropic'
$env:ANTHROPIC_API_KEY = '<your key>'        # never commit it; .env files are git-ignored
# optional: RECLAIM_ANTHROPIC_MODEL (default claude-opus-5-5), RECLAIM_EXTRACTION_EFFORT (medium),
#           RECLAIM_EXTRACTION_TIMEOUT seconds (default 45, clamped 5-90)
.\scripts\run.ps1
.venv\Scripts\python.exe scripts\eval_extraction.py --provider   # sends the synthetic set; costs money
```
`GET /api/extraction/status` reports what is missing without revealing any credential.

## Implemented versus not
| Item | Status |
|---|---|
| Anthropic adapter (official SDK 1.13.0), strict JSON schema via `output_config.format` | Implemented, tested with fakes only |
| Server re-validation (pydantic, extra fields rejected, formats, bounds) | Implemented |
| Unclear/absent -> null; value must appear in its own quote, else dropped | Implemented, mutation-checked |
| Pasted text: every quote must be a literal substring of the pasted text | Implemented (verified attribution) |
| Images: quote is the provider's transcription, shown as not verified | Implemented; API citations do not apply to images or structured output |
| Evidence treated as untrusted data (system prompt, data boundary, schema-only output, human confirmation) | Implemented. Semantic misreading cannot be ruled out; nothing is saved without confirmation |
| Explicit per-request consent; no consent -> nothing sent | Implemented |
| Bounded timeout (45 s, no retries), 10 MB upload, 20 MP, resize to 1568 px, metadata stripped | Implemented |
| Refusal, max-tokens, timeout, auth, rate limit, server/connection errors -> manual entry | Implemented, tested |
| Server-side refusal fallback (`fallbacks: "default"`) | Enabled in request; untested live |
| Known demo fixture recognised by hash, never sent, labelled fixture | Implemented |
| Pasted text without consent or provider -> local rules on this computer | Implemented |
| Confidence percentages / verified truth | Deliberately absent |
| Live extraction accuracy | **Unknown - not run** |

## Held-out results
See `docs/evaluation/extraction-results.md`. Local text rules: 11 correct, 11 correctly
unknown, 2 missed, 0 wrong, 0 invented on 6 texts. The misses ("Ref:" label; natural-language
date) are recorded, not tuned away, so the set stays held out. AI provider: not run.

## Ordinary-person journey (C08b)
Evidence -> only necessary questions -> confirmation -> guided reporting -> waiting/follow-up:
1. Optional step 0: "Do you have a screenshot or a bank message?" Yes/No. Reading screen has one
   input (file or pasted text) plus a consent box shown only when a provider is configured.
   Without a provider: screenshots say "not set up" (fixture still recognised); pasted text is
   read by local rules with nothing sent. Reading can be cancelled; Call 1930 stays on screen.
2. The result shows each value with its quote and source label; unreadable values say so.
   "Use these details" pre-fills the steps; "Type the details myself" always works.
3. Steps whose fields were all read show "We read these. Are they right?" (Yes / Change) instead
   of inputs. Each step explains why it asks. Step 3 offers "I don't have these".
4. The review notes any value the person changed from the reading; their value wins.
5. On creation the reading is attached as evidence linked to Payment 1 and questions already
   settled on the confirmation screen are not asked again (answers marked intake_confirmation).
6. On the case page, evidence questions explain why, offer "Not sure" and "Answer later";
   reporting steps keep "later" and "no answer" distinct from a saved report.
Browser-verified 14 October 2026 on an audit DB with the provider unconfigured (as here).
