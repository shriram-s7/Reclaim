"""Evidence reconciliation with adaptive clarification. Deterministic rules only.

Evidence items hold candidate facts with their sources. They never change confirmed
facts directly: every item must be placed by the user (same payment, separate payment,
unrelated or unknown), conflicts become questions, and the resulting proposed changes
apply only after explicit re-confirmation. Unknown stays unknown; nothing is invented.
"""
import hashlib
from datetime import datetime, timedelta
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from .domain import (FactsCorrection, check_report_order, money, plain_text, shown_time,
                     store_transactions, transaction_time, transactions, utcnow)
from .extraction import parse_quoted

FIELDS = ('amount_paise', 'occurred_at', 'reference', 'payee')
FIELD_NAMES = {'amount_paise': 'amount', 'occurred_at': 'date and time',
               'reference': 'transaction reference', 'payee': 'recipient'}
KINDS = {'receipt': 'payment receipt', 'bank_message': 'bank message', 'chat': 'chat message',
         'screenshot': 'screenshot', 'other': 'document'}
ORIGINS = {'pasted_text': 'Pasted text, read by local text rules (not AI)',
           'typed_by_user': 'Typed by you from your evidence',
           'synthetic_fixture': 'Synthetic practice evidence (fixture, not AI reading)',
           'ai_provider': 'Read by AI (Anthropic Claude). Check every value'}
SAME_TIME = timedelta(minutes=10)   # time values this close are treated as one value
NEAR_TIME = timedelta(hours=24)     # payments this close may be duplicates
DONT_KNOW = {'id': 'unknown', 'label': 'Not sure'}
LATER = {'id': 'later', 'label': 'Answer later'}
WHY = {'possible_duplicate': 'So the same payment is not counted twice.',
       'placement': 'So every payment you lost is included once, and nothing unrelated is added.',
       'conflict': 'Your bank, 1930 and the portal should all receive the same details.',
       'fill': 'Adding it now saves typing it again in every report.',
       'unreadable': 'A reference helps the bank find the payment. It is optional.',
       'enter': 'A payment needs an amount and a time before it can be added.'}
ORDER = {'possible_duplicate': 0, 'placement': 0, 'conflict:amount_paise': 1, 'enter:amount_paise': 2,
         'conflict:occurred_at': 3, 'enter:occurred_at': 4, 'conflict:reference': 5,
         'conflict:payee': 6, 'unreadable:reference': 7, 'enter:reference': 7, 'fill:reference': 8,
         'fill:payee': 9, 'unreadable:payee': 9, 'unreadable:amount_paise': 2, 'unreadable:occurred_at': 4}

class TypedFacts(BaseModel):
    """What a person reads from their own screenshot or paper receipt."""
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    amount_paise: int | None = Field(default=None, gt=0, le=1_000_000_000, strict=True)
    occurred_at: datetime | None = None
    reference: str = Field(default='', max_length=100)
    reference_unreadable: bool = False
    payee: str = Field(default='', max_length=200)
    _time = field_validator('occurred_at')(lambda v: v if v is None else transaction_time(v))
    _text = field_validator('reference', 'payee')(plain_text)

    @model_validator(mode='after')
    def consistent(self):
        if self.reference and self.reference_unreadable:
            raise ValueError('Either type the reference or mark it unreadable, not both.')
        if not (self.amount_paise or self.occurred_at or self.reference or self.payee or self.reference_unreadable):
            raise ValueError('Enter at least one detail that this evidence shows.')
        return self

class EvidenceInput(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    kind: Literal['receipt', 'bank_message', 'chat', 'screenshot', 'other']
    text: str = Field(default='', max_length=4000)
    typed: TypedFacts | None = None
    _text = field_validator('text')(plain_text)

    @model_validator(mode='after')
    def one_source(self):
        if bool(self.text) == bool(self.typed):
            raise ValueError('Paste the message text or type what the evidence shows.')
        return self

class AnswerInput(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    choice: str = Field(min_length=1, max_length=40)
    value: str | int | None = None

class ApplyInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    version: int = Field(ge=1, strict=True)
    confirmed: Literal[True]

def _digest(*parts) -> str:
    return hashlib.sha256('|'.join(map(str, parts)).encode()).hexdigest()[:10]

def _norm(field: str, value):
    return value.strip().upper() if field == 'reference' else value.strip().lower() if field == 'payee' else value

def _same(field: str, a, b) -> bool:
    if field == 'occurred_at':
        return abs(datetime.fromisoformat(a) - datetime.fromisoformat(b)) <= SAME_TIME
    return _norm(field, a) == _norm(field, b)

def shown(field: str, value) -> str:
    if value in (None, ''):
        return 'Not known'
    return money(value) if field == 'amount_paise' else shown_time(value) if field == 'occurred_at' else str(value)

def _fact(value, quote: str = '', status: str = 'read') -> dict:
    return {'value': value, 'status': status, 'quote': quote}

def new_item(case: dict, kind: str, origin: str, facts: dict, text: str = '', label: str = '', provider: dict | None = None) -> dict:
    evidence = case.setdefault('evidence', {'items': [], 'answers': {}})
    number = evidence.get('next', len(evidence['items']) + 1)
    evidence['next'] = number + 1
    item = {'id': f'E{number}', 'kind': kind, 'origin': origin, 'label': label or KINDS[kind].capitalize(),
            'text': text, 'facts': facts, 'added_at': utcnow().isoformat()}
    if provider:
        item['provider'] = provider
    evidence['items'].append(item)
    return item

def add_evidence(case: dict, data: EvidenceInput) -> dict:
    if data.text:
        facts = {field: _fact(value, quote) for field, (value, quote) in parse_quoted(data.text).items()
                 if field in FIELDS or field == 'method'}
        return new_item(case, data.kind, 'pasted_text', facts, data.text)
    typed = data.typed
    facts = {}
    if typed.amount_paise:
        facts['amount_paise'] = _fact(typed.amount_paise)
    if typed.occurred_at:
        facts['occurred_at'] = _fact(typed.occurred_at.isoformat())
    if typed.reference:
        facts['reference'] = _fact(typed.reference)
    elif typed.reference_unreadable:
        facts['reference'] = _fact(None, status='unreadable')
    if typed.payee:
        facts['payee'] = _fact(typed.payee)
    return new_item(case, data.kind, 'typed_by_user', facts)

# Practice scenarios: fictional, labelled fixtures matching the bundled sample case.
SAMPLE_TIME = '2026-10-12T14:12:00+00:00'
def _screenshot(case, label, amount, time, reference, quote):
    facts = {'amount_paise': _fact(amount, quote['amount']), 'occurred_at': _fact(time, quote['time']),
             'payee': _fact('demo-recipient@example', 'To demo-recipient@example')}
    facts['reference'] = _fact(reference, 'UTR ' + reference) if reference else _fact(None, quote['reference'], 'unreadable')
    new_item(case, 'screenshot', 'synthetic_fixture', facts, label=label)

def add_practice(case: dict, scenario: str) -> None:
    if scenario == 'amount-conflict':
        _screenshot(case, 'Practice payment receipt', 1_800_000, SAMPLE_TIME, '701245678912',
                    {'amount': 'Paid ₹18,000.00', 'time': '12 Oct 2026, 07:42 PM'})
        text = ('Fictional bank SMS: INR 20,000.00 debited via UPI on 2026-10-12T19:42:00+05:30. '
                'UTR: 701245678912. To demo-recipient@example.')
        item = new_item(case, 'bank_message', 'synthetic_fixture', {}, text, 'Practice bank message')
        item['facts'] = {f: _fact(v, q) for f, (v, q) in parse_quoted(text).items() if f in FIELDS or f == 'method'}
    elif scenario == 'possible-duplicate':
        _screenshot(case, 'Practice screenshot A', 1_800_000, SAMPLE_TIME, '701245678912',
                    {'amount': '₹18,000.00 paid', 'time': '12 Oct, 7:42 PM'})
        _screenshot(case, 'Practice screenshot B (cropped)', 1_800_000, '2026-10-12T14:13:00+00:00', '',
                    {'amount': '₹18,000.00', 'time': '12 Oct, 7:43 PM', 'reference': 'UTR 70124…(cut off)'})
    elif scenario == 'unreadable-reference':
        _screenshot(case, 'Practice blurred receipt', 1_800_000, SAMPLE_TIME, '',
                    {'amount': '₹18,000.00 paid', 'time': '12 Oct 2026, 7:42 PM', 'reference': 'UTR ▒▒▒▒▒▒ (blurred)'})
    else:
        raise KeyError(scenario)

def _read(item: dict) -> dict:
    return {f: v['value'] for f, v in item['facts'].items() if f in FIELDS and v['status'] == 'read'}

def _source(item: dict, field: str | None = None) -> dict:
    fact = item['facts'].get(field) if field else None
    return {'evidence_id': item['id'], 'label': item['label'], 'origin': ORIGINS[item['origin']],
            'quote': (fact or {}).get('quote', ''), 'quote_verified': (fact or {}).get('quote_verified')}

def _payment_text(candidate: dict) -> str:
    parts = [shown('amount_paise', candidate.get('amount_paise'))]
    if candidate.get('occurred_at'):
        parts.append(shown('occurred_at', candidate['occurred_at']))
    return ' · '.join(parts)

def _similar(read: dict, candidate: dict) -> tuple[bool, list[str]]:
    """Possible same payment? Contradicting references rule it out."""
    reasons = []
    ref, other = read.get('reference'), candidate.get('reference')
    if ref and other:
        if not _same('reference', ref, other):
            return False, []
        reasons.append(f'Both show reference {ref}')
    same_amount = bool(read.get('amount_paise') and read.get('amount_paise') == candidate.get('amount_paise'))
    if same_amount:
        reasons.append(f'Both show {money(read["amount_paise"])}')
    near = None
    if read.get('occurred_at') and candidate.get('occurred_at'):
        gap = abs(datetime.fromisoformat(read['occurred_at']) - datetime.fromisoformat(candidate['occurred_at']))
        near = gap <= NEAR_TIME
        if near:
            minutes = int(gap.total_seconds() // 60)
            reasons.append('Times are ' + ('the same' if not minutes else '1 minute apart' if minutes == 1 else f'{minutes} minutes apart'))
    return bool(reasons and (ref and other or same_amount and near is not False)), reasons

def _valid_entry(field: str, value):
    """Validate a value the person typed in answer to a question."""
    if field == 'amount_paise':
        if not isinstance(value, int) or isinstance(value, bool) or not 0 < value <= 1_000_000_000:
            raise ValueError('Enter an amount greater than zero, up to ₹1 crore.')
        return value
    if field == 'occurred_at':
        try:
            return transaction_time(datetime.fromisoformat(str(value).replace('Z', '+00:00'))).isoformat()
        except (TypeError, ValueError) as error:
            raise ValueError(str(error) if 'year' in str(error) or 'future' in str(error) else 'Enter a valid date and time with a timezone.')
    text = plain_text(str(value or '').strip())
    if not text or len(text) > (100 if field == 'reference' else 200):
        raise ValueError(f'Enter the {FIELD_NAMES[field]}, or choose “I don’t know”.')
    return text

def reconcile(case: dict) -> dict:
    """Pure function of the saved case: links, open questions, proposed changes, uncertainty."""
    evidence = case.get('evidence') or {}
    items, answers = evidence.get('items', []), evidence.get('answers', {})
    confirmed = transactions(case)
    names = {t['id']: f'Payment {n}' for n, t in enumerate(confirmed, 1)}
    pending, links, questions, answered, unsure = [], {}, [], [], []
    groups = {t['id']: [] for t in confirmed}
    by_id = {item['id']: item for item in items}

    def ask(question, answer=None):
        question['order'] = ORDER.get(question['kind'], 9)
        question['why'] = WHY[question['kind'].split(':')[0]]
        question['choices'] = question['choices'] + [LATER]
        if answer:
            answered.append({**question, 'answer': answer})
        else:
            # "Answer later" keeps the question open, behind the others.
            question['deferred'] = answers.get(question['id'], {}).get('choice') == 'later'
            questions.append(question)

    # 1. Place each evidence item. Nothing is linked or merged without the person's answer.
    for item in items:
        read = _read(item)
        if not any(f in item['facts'] for f in FIELDS):
            links[item['id']] = {'status': 'no_details'}
            continue
        candidates = confirmed + pending
        values = {c['id']: c if c in confirmed else {**c, **c['values']} for c in candidates}
        matches = [(c['id'], *_similar(read, values[c['id']])) for c in candidates]
        best = next(((cid, reasons) for cid, ok, reasons in matches if ok), None)
        kind_name = KINDS[item['kind']]
        if best:
            cid, reasons = best
            question = {'id': f"place:{item['id']}", 'kind': 'possible_duplicate',
                        'text': f'Is this {kind_name} the same payment as {names[cid]} ({_payment_text(values[cid])})?',
                        'help': 'It may be another copy of a payment you already have. It is not added to your total unless you say it is separate.',
                        'reasons': reasons,
                        'choices': [{'id': f'same:{cid}', 'label': 'Yes, the same payment'},
                                    {'id': 'new', 'label': 'No, a separate payment'}, DONT_KNOW]}
        else:
            question = {'id': f"place:{item['id']}", 'kind': 'placement',
                        'text': f'Which payment is this {kind_name} about?',
                        'help': f'It shows {_payment_text(read)}. It does not clearly match a saved payment.',
                        'reasons': [],
                        'choices': [{'id': f"same:{c['id']}", 'label': f"{names[c['id']]} · {_payment_text(values[c['id']])}"} for c in candidates]
                                   + [{'id': 'new', 'label': 'Another payment I lost'},
                                      {'id': 'unrelated', 'label': 'It is not about my loss'}, DONT_KNOW]}
        question['sources'] = [{**_source(item, f), 'field': FIELD_NAMES[f],
                                'value': 'Unreadable' if fact['status'] == 'unreadable' else shown(f, fact['value'])}
                               for f, fact in item['facts'].items() if f in FIELDS]
        answer = answers.get(question['id'])
        valid = answer and (answer['choice'] in ('new', 'unrelated', 'unknown') or answer['choice'][5:] in groups)
        ask(question, answer if valid else None)
        if not valid:
            links[item['id']] = {'status': 'waiting'}
        elif answer['choice'] == 'new':
            pid = f"P-{item['id']}"
            pending.append({'id': pid, 'evidence_ids': [item['id']], 'values': dict(read)})
            groups[pid] = [item['id']]
            names[pid] = f'Possible payment {len(confirmed) + len(pending)}'
            links[item['id']] = {'status': 'linked', 'payment': pid}
        elif answer['choice'].startswith('same:'):
            target = answer['choice'][5:]
            groups[target].append(item['id'])
            links[item['id']] = {'status': 'linked', 'payment': target}
            for p in pending:
                if p['id'] == target:
                    p['evidence_ids'].append(item['id'])
                    for f, v in read.items():
                        p['values'].setdefault(f, v)
        else:
            links[item['id']] = {'status': answer['choice']}
            if answer['choice'] == 'unknown':
                unsure.append({'text': f"{item['label']}: you were not sure which payment it belongs to, so it is not used."})

    # 2. Compare each payment's saved value with its linked evidence, field by field.
    resolved = {pid: {} for pid in groups}
    for payment in confirmed + pending:
        pid, eids = payment['id'], groups[payment['id']]
        is_pending = pid.startswith('P-')
        linked = [by_id[e] for e in eids]
        if not linked:
            continue
        for field in FIELDS:
            entries = [] if is_pending or payment.get(field) in (None, '') else [
                {'value': payment[field], 'label': 'Your saved details', 'origin': 'Confirmed by you', 'quote': ''}]
            unreadable = []
            for item in linked:
                fact = item['facts'].get(field)
                if fact and fact['status'] == 'read':
                    entries.append({**_source(item, field), 'value': fact['value']})
                elif fact:
                    unreadable.append(item)
            distinct = []
            for entry in entries:
                group = next((g for g in distinct if _same(field, g['value'], entry['value'])), None)
                if group:
                    group['sources'].append(entry)
                else:
                    distinct.append({'value': entry['value'], 'sources': [entry]})
            anchor = _digest(*sorted(eids))
            has_saved = not is_pending and payment.get(field) not in (None, '')
            if len(distinct) > 1:
                qid = f"conflict:{field}:" + _digest(anchor, *sorted(str(_norm(field, g['value'])) for g in distinct))
                question = {'id': qid, 'kind': f'conflict:{field}', 'payment': pid,
                            'text': f'Your evidence shows different {FIELD_NAMES[field]}s for {names[pid]}. Which is correct?',
                            'help': 'Choose the value from your bank statement or the original receipt if you can.',
                            'reasons': [], 'sources': [],
                            'choices': [{'id': f'value:{n}', 'label': shown(field, g['value']), 'value': g['value'],
                                         'sources': [{k: s.get(k) for k in ('label', 'origin', 'quote', 'quote_verified')} for s in g['sources']]}
                                        for n, g in enumerate(distinct)] + [DONT_KNOW]}
                answer = answers.get(qid)
                ok = answer and (answer['choice'] == 'unknown' or any(_same(field, g['value'], answer.get('value')) for g in distinct if answer.get('value') is not None))
                ask(question, answer if ok else None)
                if ok and answer['choice'] == 'unknown':
                    unsure.append({'payment': pid, 'field': field, 'conflict': True, 'text': f"{names[pid]} {FIELD_NAMES[field]}: " + '; '.join(
                        f"{', '.join(s['label'] for s in g['sources'])} shows {shown(field, g['value'])}" for g in distinct)})
                elif ok:
                    resolved[pid][field] = answer['value']
            elif len(distinct) == 1 and not has_saved:
                value = distinct[0]['value']
                if is_pending:
                    resolved[pid][field] = value
                    continue
                qid = f'fill:{field}:' + _digest(anchor, _norm(field, value))
                ask_fill = {'id': qid, 'kind': f'fill:{field}', 'payment': pid,
                            'text': f'Your evidence shows the {FIELD_NAMES[field]} {shown(field, value)}. Add it to {names[pid]}?',
                            'help': 'Check it against the original before adding it.', 'reasons': [],
                            'sources': [{k: s.get(k) for k in ('label', 'origin', 'quote', 'quote_verified')} for s in distinct[0]['sources']],
                            'choices': [{'id': 'value:0', 'label': 'Yes, add it', 'value': value}, {'id': 'skip', 'label': 'No, leave it out'}, DONT_KNOW]}
                answer = answers.get(qid)
                ok = answer and answer['choice'] in ('value', 'skip', 'unknown')
                ask(ask_fill, answer if ok else None)
                if ok and answer['choice'] == 'value':
                    resolved[pid][field] = value
            elif not distinct and not has_saved and (unreadable or (is_pending and field in ('amount_paise', 'occurred_at'))):
                qid = f"{'unreadable' if unreadable else 'enter'}:{field}:" + anchor
                source = unreadable[0] if unreadable else linked[0]
                required = is_pending and field in ('amount_paise', 'occurred_at')
                question = {'id': qid, 'kind': f"{'unreadable' if unreadable else 'enter'}:{field}", 'payment': pid, 'field': field,
                            'text': (f'The {FIELD_NAMES[field]} on your {KINDS[source["kind"]]} could not be read. Do you know it?' if unreadable
                                     else f'What is the {FIELD_NAMES[field]} of {names[pid]}?'),
                            'help': ('Without it, this payment cannot be added to your case.' if required
                                     else 'You can keep reporting without it. Banks and the portal can look it up.'),
                            'reasons': [], 'sources': [_source(source, field)],
                            'choices': [{'id': 'enter', 'label': 'I know it', 'input': field},
                                        {'id': 'unknown', 'label': 'I don’t know' + ('' if required else ' – continue without it')}]}
                answer = answers.get(qid)
                ok = answer and answer['choice'] in ('enter', 'unknown')
                ask(question, answer if ok else None)
                if ok and answer['choice'] == 'enter':
                    resolved[pid][field] = answer['value']
                elif ok:
                    unsure.append({'payment': pid, 'field': field, 'text': f"{names[pid]} {FIELD_NAMES[field]}: not known."})

    # 3. Proposed changes. None apply until the person re-confirms them.
    changes = []
    for payment in confirmed:
        for field, value in resolved[payment['id']].items():
            before = payment.get(field)
            if before in (None, '') or not _same(field, before, value) or (field == 'occurred_at' and before != value):
                changes.append({'id': f"{payment['id']}:{field}", 'type': 'update', 'payment': payment['id'],
                                'label': f"{names[payment['id']]} {FIELD_NAMES[field]}", 'field': field,
                                'before': before, 'after': value, 'before_text': shown(field, before), 'after_text': shown(field, value)})
    for p in pending:
        values = resolved[p['id']]
        method = next((by_id[e]['facts']['method']['value'] for e in p['evidence_ids'] if 'method' in by_id[e]['facts']), 'Other')
        new = {'amount_paise': values.get('amount_paise'), 'occurred_at': values.get('occurred_at'),
               'reference': values.get('reference', ''), 'payee': values.get('payee', ''), 'method': method}
        missing = [FIELD_NAMES[f] for f in ('amount_paise', 'occurred_at') if not new[f]]
        changes.append({'id': p['id'], 'type': 'add', 'payment': p['id'], 'label': f"Add {names[p['id']]}",
                        'transaction': new, 'evidence_ids': p['evidence_ids'], 'complete': not missing,
                        'after_text': ' · '.join(shown(f, new[f]) for f in FIELDS if new[f]),
                        'blocked': f"Needs the {' and '.join(missing)} before it can be added." if missing else ''})
    questions.sort(key=lambda q: (q['deferred'], q['order']))
    return {'questions': questions, 'answered': answered, 'changes': changes, 'unsure': unsure,
            'links': links, 'payment_names': names,
            'note': 'Rules-based checks of the evidence you added. Not AI, and not verification by a bank or authority.'}

def record_answer(case: dict, question_id: str, data: AnswerInput) -> None:
    result = reconcile(case)
    question = next((q for q in result['questions'] + result['answered'] if q['id'] == question_id), None)
    if not question:
        raise LookupError('This question no longer applies. Reload your case.')
    choice = next((c for c in question['choices'] if c['id'] == data.choice), None)
    if not choice:
        raise ValueError('Choose one of the offered answers.')
    answer = {'choice': data.choice, 'answered_at': utcnow().isoformat()}
    if data.choice.startswith('value:'):
        # Store the chosen value itself so later evidence cannot shift the meaning of an index.
        answer.update(choice='value', value=choice['value'])
    elif data.choice == 'enter':
        try:
            answer['value'] = _valid_entry(question['field'], data.value)
        except ValueError as error:
            raise ValueError(str(error).replace('Value error, ', ''))
    case['evidence'].setdefault('answers', {})[question_id] = answer

def forget_answer(case: dict, question_id: str) -> None:
    if case.get('evidence', {}).get('answers', {}).pop(question_id, None) is None:
        raise LookupError('There is no saved answer for this question.')

def apply_changes(case: dict, data: ApplyInput) -> list[dict]:
    """Apply every complete proposed change after explicit re-confirmation."""
    if data.version != case.get('facts_version', 1):
        raise PermissionError('Your details changed since you reviewed them. Check the updated changes and confirm again.')
    result = reconcile(case)
    ready = [c for c in result['changes'] if c['type'] == 'update' or c['complete']]
    if not ready:
        raise ValueError('There are no complete changes to apply yet.')
    items = transactions(case)
    answers = case['evidence']['answers']
    for change in ready:
        if change['type'] == 'update':
            next(t for t in items if t['id'] == change['payment'])[change['field']] = change['after']
            continue
        new_id = f"T{max(int(t['id'][1:]) for t in items) + 1}"
        items.append({'id': new_id, **change['transaction']})
        change['created'] = new_id
        for key, answer in answers.items():
            if key == f"place:{change['payment'][2:]}" or answer['choice'] == f"same:{change['payment']}":
                answer['choice'] = f'same:{new_id}'
    commit(case, items, [{k: c.get(k) for k in ('type', 'label', 'before_text', 'after_text', 'created')} for c in ready], 'evidence')
    return ready

def commit(case: dict, items: list[dict], summary: list[dict], source: str) -> None:
    trial = {**case, 'transactions': items}
    check_report_order(trial)
    store_transactions(case, items)
    case['facts_version'] = case.get('facts_version', 1) + 1
    case.setdefault('corrections', []).append({'version': case['facts_version'], 'at': utcnow().isoformat(),
                                               'source': source, 'changes': summary})

def correct_facts(case: dict, data: FactsCorrection) -> None:
    """A direct correction of saved facts. The request itself carries the re-confirmation."""
    if data.version != case.get('facts_version', 1):
        raise PermissionError('Your details changed since you opened this form. Check them and confirm again.')
    items = transactions(case)
    target = next((t for t in items if t['id'] == data.transaction_id), None)
    if not target:
        raise LookupError('That payment is not in this case.')
    name = f"Payment {items.index(target) + 1}"
    summary = []
    for field in ('amount_paise', 'occurred_at', 'reference', 'payee', 'method'):
        value = getattr(data, field)
        if value is None:
            continue
        value = value.isoformat() if field == 'occurred_at' else value
        if value != target[field]:
            summary.append({'type': 'update', 'label': f"{name} {FIELD_NAMES.get(field, 'payment method')}",
                            'before_text': shown(field, target[field]), 'after_text': shown(field, value)})
            target[field] = value
    case_level = {f: getattr(data, f) for f in ('bank', 'description') if getattr(data, f) not in (None, case[f])}
    for field, value in case_level.items():
        summary.append({'type': 'update', 'label': field.capitalize(), 'before_text': case[field], 'after_text': value})
    if not summary:
        raise ValueError('Nothing was changed.')
    commit(case, items, summary, 'manual')
    case.update(case_level)

def settle_with_intake(case: dict, evidence_id: str) -> None:
    """The person confirmed their facts while seeing this reading, so do not ask again.

    The evidence is linked to payment 1, and wherever their confirmed value differs from
    the reading, their confirmed value is kept. Answers are marked as coming from intake.
    """
    answers = case['evidence'].setdefault('answers', {})
    stamp = {'answered_at': utcnow().isoformat(), 'by': 'intake_confirmation'}
    answers[f'place:{evidence_id}'] = {'choice': 'same:T1', **stamp}
    for _ in range(len(FIELDS) + 1):
        open_questions = [q for q in reconcile(case)['questions'] if q.get('payment') == 'T1']
        if not open_questions:
            return
        for question in open_questions:
            kind = question['kind'].split(':')[0]
            if kind == 'conflict':
                saved = next(c for c in question['choices'] if any(s['label'] == 'Your saved details' for s in c.get('sources', [])))
                answers[question['id']] = {'choice': 'value', 'value': saved['value'], **stamp}
            else:
                answers[question['id']] = {'choice': 'skip' if kind == 'fill' else 'unknown', **stamp}
