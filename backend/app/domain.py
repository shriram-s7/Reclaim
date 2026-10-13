"""Confirmed facts and user-attested reports; no legal eligibility inference."""
from datetime import datetime, timezone
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator

CHANNELS = ('helpline', 'bank', 'portal')

def utcnow() -> datetime:
    return datetime.now(timezone.utc)

def valid_time(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError('Include a timezone.')
    if value > utcnow():
        raise ValueError('The time cannot be in the future.')
    return value.astimezone(timezone.utc)

class CaseInput(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    amount_paise: int = Field(gt=0, le=1_000_000_000, strict=True)
    occurred_at: datetime
    bank: str = Field(min_length=2, max_length=100)
    method: Literal['UPI', 'Card', 'Net banking', 'Other'] = 'UPI'
    reference: str = Field(default='', max_length=100)
    payee: str = Field(default='', max_length=200)
    description: str = Field(min_length=10, max_length=4000)
    source: Literal['manual', 'sample', 'fixture'] = 'manual'
    confirmed: Literal[True]

    _time = field_validator('occurred_at')(valid_time)

class ReportInput(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    reference: str = Field(default='', max_length=100)
    reported_at: datetime
    _time = field_validator('reported_at')(valid_time)

def decorate(case: dict) -> dict:
    case = dict(case)
    case['reports_recorded'] = len(case['reports'])
    case['status'] = 'reports_recorded' if len(case['reports']) == 3 else 'in_progress'
    case['missing_fields'] = [label for key, label in
        [('reference', 'Transaction reference'), ('payee', 'Recipient details')]
        if not case[key]]
    case['policy'] = {'status': 'not_assessed', 'message':
        'Reporting assistance only. Your bank determines liability and any reimbursement.'}
    return case

def money(paise: int) -> str:
    return f'INR {paise // 100:,}.{paise % 100:02d}'
