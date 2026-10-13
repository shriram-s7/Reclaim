"""Explainable workflow decisions, independent of model guesses."""
from datetime import datetime, timedelta, timezone
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator

class JourneyInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    state: Literal['not_started', 'later', 'no_answer', 'waiting', 'resolved']
    remind_at: datetime | None = None

    @model_validator(mode='after')
    def check_reminder(self):
        if self.remind_at:
            if self.remind_at.tzinfo is None:
                raise ValueError('Reminder needs a timezone.')
            now = datetime.now(timezone.utc)
            if not now < self.remind_at <= now + timedelta(days=30):
                raise ValueError('Choose a reminder within the next 30 days.')
            if self.state not in ('later', 'no_answer', 'waiting'):
                raise ValueError('This action does not need a reminder.')
        return self

def plan(case: dict, now: datetime | None = None) -> dict:
    now = now or datetime.now(timezone.utc)
    steps = []
    for channel in ('helpline', 'bank', 'portal'):
        report = case['reports'].get(channel)
        saved = case.get('journey', {}).get(channel, {})
        state = saved.get('state', 'waiting' if report else 'not_started')
        reminder = saved.get('remind_at')
        due = bool(reminder and datetime.fromisoformat(reminder) <= now)
        messages = {
            'not_started': 'You have not saved a report for this step yet.',
            'later': 'You chose to do this later. It is still not reported.',
            'no_answer': 'Your attempt did not get an answer. This is not a completed report.',
            'waiting': 'Your report is saved. A reply or reference may take time.',
            'resolved': 'You marked this step as resolved. This does not confirm money was recovered.'}
        steps.append({'channel': channel, 'state': state, 'message': messages[state],
                      'remind_at': reminder, 'due': due, 'reported': bool(report),
                      'reference': report.get('reference', '') if report else None})
    due_steps = [s for s in steps if s['due']]
    open_steps = [s for s in steps if s['state'] == 'not_started']
    retries = [s for s in steps if s['state'] in ('no_answer', 'later')]
    next_step = next(iter(due_steps or open_steps or retries), None)
    return {'steps': steps, 'next_channel': next_step['channel'] if next_step else None,
            'reason': ('Your chosen reminder time has arrived.' if due_steps else
                       'This reporting step has not been started.' if open_steps else
                       'This step still needs a successful report.' if retries else
                       'Your reports are saved. Keep your references while you wait for replies.'),
            'delivery': 'Reminders appear when Reclaim is open. Calendar export is available; no SMS or background notification is sent.'}
