"""Conservative local text parsing. Unknown or ambiguous fields remain absent."""
import re
from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel, Field

class TextInput(BaseModel):
    text: str = Field(min_length=1, max_length=4000)

def parse_text(text: str) -> dict:
    # Only parse amounts explicitly adjacent to debit/sent/paid language.
    amounts = re.findall(r'(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)(?![\d.])\s*(?:has been\s+|was\s+)?(?:debited|sent|paid)\b', text, re.I)
    amounts += re.findall(r'\b(?:debited|sent|paid)\s*(?:by\s*)?(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)(?![\d.])', text, re.I)
    values = set()
    for amount in amounts:
        if re.fullmatch(r'\d[\d,]*(?:\.\d{1,2})?', amount):
            value = int(Decimal(amount.replace(',', '')) * 100)
            if 0 < value <= 1_000_000_000:
                values.add(value)
    refs = set(re.findall(r'\b(?:UTR|transaction\s+(?:ID|reference)|reference)\s*[:#]\s*([A-Za-z0-9][A-Za-z0-9-]{3,99})', text, re.I))
    payees = set(re.findall(r'\b[\w.\-]{2,100}@[A-Za-z0-9.\-]{2,64}\b', text))
    banks = re.findall(r'^Bank:\s*([^\n\r]{2,100})$', text, re.I | re.M)
    times = re.findall(r'\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})', text)
    fields = {}
    if len(values) == 1: fields['amount_paise'] = values.pop()
    if len(refs) == 1: fields['reference'] = refs.pop()
    if len(payees) == 1: fields['payee'] = payees.pop()
    if len(banks) == 1: fields['bank'] = banks[0].strip()
    if re.search(r'\bUPI\b', text, re.I): fields['method'] = 'UPI'
    if len(set(times)) == 1:
        try: fields['occurred_at'] = datetime.fromisoformat(times[0].replace('Z','+00:00')).isoformat()
        except ValueError: pass
    return {'source': 'text', 'fields': fields, 'message':
            f'{len(fields)} fields found by local text rules. Check every value and fill in missing details. No AI service was used.'}
