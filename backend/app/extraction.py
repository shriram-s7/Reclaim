"""Conservative local text parsing. Unknown or ambiguous fields remain absent."""
import re
from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel, Field

class TextInput(BaseModel):
    text: str = Field(min_length=1, max_length=4000)

AMOUNT_PATTERNS = (
    # Only parse amounts explicitly adjacent to debit/sent/paid language.
    r'(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)(?![\d.])\s*(?:has been\s+|was\s+)?(?:debited|sent|paid)\b',
    r'\b(?:debited|sent|paid)\s*(?:by\s*)?(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)(?![\d.])')
REFERENCE = r'\b(?:UTR|transaction\s+(?:ID|reference)|reference)\s*[:#]\s*([A-Za-z0-9][A-Za-z0-9-]{3,99})'
PAYEE = r'\b[\w.\-]{2,100}@[A-Za-z0-9.\-]{2,64}\b'
BANK = r'^Bank:\s*([^\n\r]{2,100})$'
TIME = r'\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})'

def _single(found: list[tuple[object, str]]):
    """One distinct value and the exact text it came from, or None when absent/ambiguous."""
    values = {value for value, _ in found}
    if len(values) != 1:
        return None
    value = values.pop()
    return value, next(quote for v, quote in found if v == value)

def parse_quoted(text: str) -> dict:
    """Field -> (value, exact source quote). Ambiguous fields are left out, never guessed."""
    amounts = []
    for pattern in AMOUNT_PATTERNS:
        for match in re.finditer(pattern, text, re.I):
            raw = match.group(1)
            if re.fullmatch(r'\d[\d,]*(?:\.\d{1,2})?', raw):
                value = int(Decimal(raw.replace(',', '')) * 100)
                if 0 < value <= 1_000_000_000:
                    amounts.append((value, match.group(0).strip()))
    found = {
        'amount_paise': amounts,
        'reference': [(m.group(1), m.group(0)) for m in re.finditer(REFERENCE, text, re.I)],
        'payee': [(m.group(0), m.group(0)) for m in re.finditer(PAYEE, text)],
        'bank': [(m.group(1).strip(), m.group(0).strip()) for m in re.finditer(BANK, text, re.I | re.M)],
    }
    times = []
    for match in re.finditer(TIME, text):
        try:
            times.append((datetime.fromisoformat(match.group(0).replace('Z', '+00:00')).isoformat(), match.group(0)))
        except ValueError:
            pass
    found['occurred_at'] = times
    method = re.search(r'\bUPI\b', text, re.I)
    if method:
        found['method'] = [('UPI', method.group(0))]
    return {field: single for field, values in found.items() if (single := _single(values))}

def parse_text(text: str) -> dict:
    fields = {field: value for field, (value, _) in parse_quoted(text).items()}
    return {'source': 'text', 'fields': fields, 'message':
            f'{len(fields)} fields found by local text rules. Check every value and fill in missing details. No AI service was used.'}
