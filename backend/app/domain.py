"""Confirmed facts and user-attested reports; no legal eligibility inference."""
from datetime import datetime, timedelta, timezone
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator
import re
from .formats import IST, money, shown_time
from .messages import UserError

CHANNELS = ('helpline', 'bank', 'portal')
METHODS = Literal['UPI', 'Card', 'Net banking', 'Other']
TRANSACTION_FIELDS = ('amount_paise', 'occurred_at', 'reference', 'payee', 'method')

def utcnow() -> datetime:
    return datetime.now(timezone.utc)

def valid_time(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise UserError('err.timezone')
    if value > utcnow():
        raise UserError('err.future')
    return value.astimezone(timezone.utc)

def transaction_time(value: datetime) -> datetime:
    value = valid_time(value)
    # Catches mistyped years such as 0026; not a legal or eligibility limit.
    if value.year < 2000:
        raise UserError('err.year')
    return value

def plain_text(value: str) -> str:
    if any(ord(c) < 32 and c not in '\n\t\r' for c in value):
        raise UserError('err.control')
    return value

def bank_name(value: str) -> str:
    if not any(c.isalpha() for c in value):
        raise UserError('err.bank_number')
    return value

class CaseInput(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    amount_paise: int = Field(gt=0, le=1_000_000_000, strict=True)
    occurred_at: datetime
    bank: str = Field(min_length=2, max_length=100)
    method: METHODS = 'UPI'
    reference: str = Field(default='', max_length=100)
    payee: str = Field(default='', max_length=200)
    description: str = Field(min_length=10, max_length=4000)
    source: Literal['manual', 'sample', 'fixture', 'text', 'ai_provider'] = 'manual'
    reading_id: str | None = Field(default=None, pattern=r'^[0-9a-f]{32}$')
    confirmed: Literal[True]

    _time = field_validator('occurred_at')(transaction_time)
    _text = field_validator('bank', 'reference', 'payee', 'description')(plain_text)
    _bank = field_validator('bank')(bank_name)

class FactsCorrection(BaseModel):
    """A user correction of saved facts. Only supplied fields change."""
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    version: int = Field(ge=1, strict=True)
    confirmed: Literal[True]
    transaction_id: str = Field(default='T1', pattern=r'^T\d{1,3}$')
    amount_paise: int | None = Field(default=None, gt=0, le=1_000_000_000, strict=True)
    occurred_at: datetime | None = None
    reference: str | None = Field(default=None, max_length=100)
    payee: str | None = Field(default=None, max_length=200)
    method: METHODS | None = None
    bank: str | None = Field(default=None, min_length=2, max_length=100)
    description: str | None = Field(default=None, min_length=10, max_length=4000)

    _time = field_validator('occurred_at')(lambda v: v if v is None else transaction_time(v))
    _text = field_validator('bank', 'reference', 'payee', 'description')(lambda v: v if v is None else plain_text(v))
    _bank = field_validator('bank')(lambda v: v if v is None else bank_name(v))

class ReportInput(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    reference: str = Field(default='', max_length=100)
    reported_at: datetime
    _time = field_validator('reported_at')(valid_time)

def transactions(case: dict) -> list[dict]:
    """Confirmed transactions. Cases saved before C07 hold one, in top-level fields."""
    if case.get('transactions'):
        return [dict(t) for t in case['transactions']]
    return [{'id': 'T1', **{key: case[key] for key in TRANSACTION_FIELDS}}]

def store_transactions(case: dict, items: list[dict]) -> None:
    """Persist transactions; the first stays mirrored in top-level fields for older readers."""
    case['transactions'] = items
    case.update({key: items[0][key] for key in TRANSACTION_FIELDS})

def earliest_transaction(case: dict) -> datetime:
    return min(datetime.fromisoformat(t['occurred_at']) for t in transactions(case))

def check_report_order(case: dict) -> None:
    """Saved report times must not precede the earliest confirmed payment."""
    first = earliest_transaction(case)
    for channel, report in case['reports'].items():
        if datetime.fromisoformat(report['reported_at']) < first:
            raise UserError('err.report_order', channel=channel)

def decorate(case: dict) -> dict:
    from .journey import plan
    from .evidence import reconcile
    case = dict(case)
    case['transactions'] = transactions(case)
    case['total_paise'] = sum(t['amount_paise'] for t in case['transactions'])
    case['facts_version'] = case.get('facts_version', 1)
    case.setdefault('corrections', [])
    case.setdefault('evidence', {'items': [], 'answers': {}})
    case['reports_recorded'] = len(case['reports'])
    case['status'] = 'reports_recorded' if len(case['reports']) == 3 else 'in_progress'
    case['missing_fields'] = [label for key, label in
        [('reference', 'Transaction reference'), ('payee', 'Recipient details')]
        if not case[key]]
    case['policy'] = {'status': 'not_assessed', 'message':
        'Reporting assistance only. Your bank determines liability and any reimbursement.'}
    case['plan'] = plan(case)
    case['reconciliation'] = reconcile(case)
    return case
