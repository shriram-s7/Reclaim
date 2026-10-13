# Active technical contract

Local synthetic-data prototype. Backend defaults to 127.0.0.1:8000. No external calls.
React app reads all case data through /api. SQLite persists cases across restarts.

## Case
UUID-based id; integer amount_paise; timezone-aware occurred_at; bank, method,
reference, payee, description; confirmed=true; extraction source; created_at;
report map with helpline/portal/bank entries containing reference, reported_at,
recorded_at. Blank reference is allowed for a report with number pending.

Status is derived: in_progress or reports_recorded. This is user-attested completion,
not an external status. Missing fields remain visible and appear as “Not provided”.
No customer names, account credentials or full account numbers are required.

## Endpoints
GET /api/health; GET /api/sample; POST /api/extract (image);
POST /api/cases; GET /api/cases; GET /api/cases/{id};
PUT /api/cases/{id}/reports/{channel}; DELETE /api/cases/{id};
GET /api/cases/{id}/docs; GET /api/cases/{id}/pack.pdf;
GET /api/cases/{id}/export.json.
Evidence and corrections (C07): see docs/EVIDENCE_RECONCILIATION.md. Confirmed payments
live in `transactions` (first mirrored in top-level fields); evidence candidates never
change them without an answered question and a re-confirmed, version-checked apply.

Image extraction initially supports the bundled synthetic image by SHA-256; unknown
images return manual mode. Enforce decoded image type and size, reject animation and
oversized dimensions. Evidence bytes are not retained. Live OCR is not implemented.

## Boundaries
Server templates use confirmed facts and conditional wording. PDF text is XML-escaped.
No input text is rendered as HTML. CORS is not opened to arbitrary sites. TrustedHost
restricts local hostnames and mutating API calls check browser Origin. No endpoint
contacts bank or government systems. The reviewer queue is local and unauthenticated;
it must not be exposed to a network or loaded with personal information.

## Handoff
STATUS.md is the current truth; docs/PROGRESS.md is historical. Backend tests and
frontend production build are the repeatable checks. Run scripts/verify.ps1 after
changing core behavior. Record browser checks separately from automated test results.
