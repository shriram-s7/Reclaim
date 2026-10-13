# Guided workflow milestone - C05

User priority: dynamic, personalized, validated, ordinary-person workflow; allow real
delays and uncertainty, minimize typing, support regional-language assistance.

## Implemented
- Intake: amount/date; bank/method; optional reference/recipient; incident choices and
  editable description; final confirmation. At most two ordinary data inputs per screen.
- Choices after each reporting action: later, no answer, or actually reported.
- Saved report transitions to waiting, not automatically resolved. Reference can be pending.
- Waiting users can schedule a check-in or explicitly mark the step resolved. This is
  not a verified authority outcome and does not imply recovery.
- A deterministic server plan selects due reminders first, then unstarted reporting
  channels, then outstanding attempts. It exposes a reason, not a model confidence score.
- Chosen reminder times persist in SQLite. UI checks due status every 30 seconds,
  including due reminders for other channels. Refresh/reopen recomputes the server plan.
- Calendar download includes an explicit start time and a display alarm. The user must
  import it; actual notifications depend on their calendar and device settings.
- Optional short safety check gives feedback without scoring victims or blocking help.
- Limited Tamil help preview for workflow choices. Not a fully translated or
  native-speaker-validated interface. No voice support is claimed.

## Validation and boundaries
- An attempt does not count as a report. Waiting/resolved requires a saved report.
- A saved report cannot silently revert to an unanswered initial attempt.
- Report time cannot precede transaction time or be in the future.
- Reminder time requires a timezone and must be within the next 30 days.
- Saving a report clears its previous attempt reminder.
- Blank reference remains pending, not an invented acknowledgement.
- Bank name cannot be a number; hidden control characters are rejected.
- High amounts and atypical UPI reference shapes are flagged for human review.
- Validation catches structure, chronology and workflow contradictions. It cannot
  establish truth without external evidence. No prediction that someone will call.

## Verified
- 35 backend tests pass, including new delay/reminder transition tests.
- TypeScript and production frontend build pass.
- Browser: all intake steps, case creation, no-answer branch, reminder save, alternate
  channel suggestion, restart persistence and calendar download.
- Calendar file inspected: UTC times, unique event ID, alarm, and no amount/account data.

## Remaining
- Live evidence extraction, source comparisons and adaptive evidence questions.
- Full Tamil intake, errors and guidance with speaker review; multilingual PDF shaping.
- User-selected custom reminder date/time; current choices cover 15/30/60 min and next-day
  follow-up. Server validates dates but UI currently uses presets.
- SMS/push/background delivery, and calendar-client import/notification testing.
- Correcting previously saved facts with re-confirmation; transaction-level event history.
- Clarifying the difference between a failed follow-up attempt and an initial failed report
  through a dedicated follow-up-attempt state (currently waiting covers follow-up).
- Broader accessibility and independent user testing.

Do not describe this rules-based milestone as live AI evidence intelligence.
