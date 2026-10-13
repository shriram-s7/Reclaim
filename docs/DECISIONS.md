# Decision log

## D01 - Source precedence
Original PDFs remain intact. This log and MASTER_PLAN.md supersede contradictory
instructions. User explicitly authorized improvisation and changes to the plans.
The PDF requirement to ask the owner before changing constants does not override that.

## D02 - Policy claims are gated, not treated as verified
The PDFs say a 1 January 2027 scheme pays 85%, capped at INR 25,000, with a five-day
window and 45-day resolution. Their own technical design says primary verification is
still needed. Research on 13 October did not establish an accessible final notification.
Do not equate search failure with proof the scheme does not exist. Treat it as unverified.
Remove the “Ravi gets INR 15,300 back / without it INR 0” pitch and UI guarantees.
Do not implement an old rule as a universal substitute either.

An accessible historical RBI circular describes scenario-dependent liability and
working-day calculations, supporting the need for more than a single calendar countdown:
https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=11040&Mode=0
This is historical context, not a verified complete account of rules in force today.

Verification gate for any future policy profile: exact primary notification URL and
identifier, final/draft status, effective dates, bank types, qualifying transactions,
net-loss definition, prior claims, timezone/day-count semantics, report timestamps,
exceptions, expiry/review date, and tests at all boundaries. Default stays off.

## D03 - Urgency and sequence
Do not delay bank contact until after portal completion. Bank and 1930 actions are
available immediately; drafts help prepare, not submit. The official MHA grievance
page points to 1930 for financial fraud and cybercrime.gov.in for reporting:
https://ncrp-grievanceredressal.mha.gov.in/login.aspx
The official police portal distinguishes platform coordination from LEA powers:
https://cyberpolice2.nic.in/
Reclaim has neither integration nor authority to freeze funds.

## D04 - Truthful evidence
Store reported_at separately from recorded_at. Allow a report with reference pending.
All reporting statuses are user attestation. No “verified” state in this prototype.
Do not claim screenshots attached unless attachments are actually included. The case
pack contains confirmed facts and drafts, not original evidence images.
Preserve handles and reference strings; stripping @ would corrupt evidence.
Treat exact portal character constraints and acknowledgement formats as unverified;
give gentle hints, do not block on unsupported fixed formats.

## D05 - Demo independence
No API key is required. Synthetic fixtures are explicitly labeled and matched by bytes,
not filename. Unknown images lead to manual entry, never another sample's facts.
Model-generated confidence is not a calibrated probability; avoid “92% match”.
No forced delay for theatrical AI processing.

## D06 - Local prototype boundary
Loopback only, synthetic data, no public deployment of the open review queue. User's
folder-based hackathon implementation is local work. Production access control,
tenant isolation, encryption and retention are separate gates, not claimed features.
No automated reminders, background notifications, real submissions or outreach.

## D07 - Hackathon integrity
Work today is pre-event and must be disclosed. FAQ permits reused code/AI when disclosed.
Track local commits and preserve event baseline; never claim all work occurred onsite.
Four team members confirmed. Business work deferred at user's request.

## D08 - Original engineering issues corrected
- Money stored as paise; integer-rupee rounding would change submitted facts.
- Per-report timestamps required; original eligibility signature could not prove timeliness.
- No bank deadline computed from fraud date before a bank report exists.
- Safety screen is core, not a last-night polish task.
- Deletion is core, not a surprise-challenge add-on.
- Independent live AI accuracy needs held-out screenshots; cached fixture tests prove
  plumbing only and must never be advertised as extraction accuracy.

## D09 - Reading inventory
Read complete extracted text: participant instructions/topics (4 pages), FAQs (2),
event flow (1), proposal (1), implementation (15), technical design (8). Total 31.
Text copies in source-text retain page delimiters; originals remain the visual source.
The topic PDF lists four domains but says five; cybersecurity is explicitly listed.

## D10 - Everyday users first (explicit user direction)
The main experience is a calm guided reporting flow, not a dashboard. Remove review
and presentation navigation from the public journey. Use small forms, plain wording,
visible progress and a clear next action. Reviewer tools remain separate demo routes.

## D11 - AI evidence reading (C08, 14 October 2026)
Provider: Anthropic via the official SDK, behind RECLAIM_EXTRACTION_PROVIDER and credentials;
off by default and not configured on this computer. Per-request consent; fixtures never sent;
strict schema plus server re-validation; unclear values stay null; values must appear in their
own quote; pasted-text quotes must be literal substrings. No confidence scores. Readings are
candidates: nothing is saved until the person confirms. Live accuracy is unknown until the
held-out set is run with a configured key.

## D12 - Languages (C08)
English and Tamil share one catalogue structure; English is the single source for backend and
interface. Tamil is labelled as awaiting native-speaker review. Official drafts and the PDF
remain English; multilingual PDF is not claimed until rendering is tested.
