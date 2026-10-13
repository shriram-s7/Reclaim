"""Evidence reconciliation with adaptive clarification. Deterministic rules only.

Evidence items hold candidate facts with their sources. They never change confirmed
facts directly: every item must be placed by the user (same payment, separate payment,
unrelated or unknown), conflicts become questions, and the resulting proposed changes
apply only after explicit re-confirmation. Unknown stays unknown; nothing is invented.
Every user-facing string is a message (English text plus a translatable `_msg`).
"""
import hashlib
from datetime import datetime, timedelta
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from .domain import (FactsCorrection, check_report_order, money, plain_text, shown_time,
                     store_transactions, transaction_time, transactions, utcnow)
from .extraction import parse_quoted
from .messages import UserError, both, msg, render

FIELDS = ('amount_paise', 'occurred_at', 'reference', 'payee')
KINDS = ('receipt', 'bank_message', 'chat', 'screenshot', 'other')
ORIGINS = ('pasted_text', 'typed_by_user', 'synthetic_fixture', 'ai_provider')
SAME_TIME = timedelta(minutes=10)   # time values this close are treated as one value
NEAR_TIME = timedelta(hours=24)     # payments this close may be duplicates
ORDER = {'possible_duplicate': 0, 'placement': 0, 'conflict:amount_paise': 1, 'enter:amount_paise': 2,
         'conflict:occurred_at': 3, 'enter:occurred_at': 4, 'conflict:reference': 5,
         'conflict:payee': 6, 'unreadable:reference': 7, 'enter:reference': 7, 'fill:reference': 8,
         'fill:payee': 9, 'unreadable:payee': 9, 'unreadable:amount_paise': 2, 'unreadable:occurred_at': 4}

def choice(choice_id: str, key: str, **params) -> dict:
    return both({'id': choice_id}, 'label', key, **params)

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
            raise UserError('err.ref_both')
        if not (self.amount_paise or self.occurred_at or self.reference or self.payee or self.reference_unreadable):
            raise UserError('err.typed_empty')
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
            raise UserError('err.one_source')
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

def label_msg(item: dict) -> dict:
    """Items saved before translation support carry only an English label."""
    return item.get('label_msg') or msg('value.plain', value=item['label'])

def new_item(case: dict, kind: str, origin: str, facts: dict, text: str = '', label: dict | None = None,
             provider: dict | None = None) -> dict:
    evidence = case.setdefault('evidence', {'items': [], 'answers': {}})
    number = evidence.get('next', len(evidence['items']) + 1)
    evidence['next'] = number + 1
    label = label or msg(f'kindtitle.{kind}')
    item = {'id': f'E{number}', 'kind': kind, 'origin': origin, 'label': render(label['key'], label['params']),
            'label_msg': label, 'text': text, 'facts': facts, 'added_at': utcnow().isoformat()}
    if provider:
        item['provider'] = provider
    evidence['items'].append(item)
    return item

def add_evidence(case: dict, data: EvidenceInput) -> dict:
    if data.text:
        facts = {field: {**_fact(value, quote), 'quote_verified': True} for field, (value, quote) in parse_quoted(data.text).items()
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
    new_item(case, 'screenshot', 'synthetic_fixture', facts, label=msg(label))

def add_practice(case: dict, scenario: str) -> None:
    if scenario == 'amount-conflict':
        _screenshot(case, 'label.practice_receipt', 1_800_000, SAMPLE_TIME, '701245678912',
                    {'amount': 'Paid ₹18,000.00', 'time': '12 Oct 2026, 07:42 PM'})
        text = ('Fictional bank SMS: INR 20,000.00 debited via UPI on 2026-10-12T19:42:00+05:30. '
                'UTR: 701245678912. To demo-recipient@example.')
        item = new_item(case, 'bank_message', 'synthetic_fixture', {}, text, msg('label.practice_message'))
        item['facts'] = {f: _fact(v, q) for f, (v, q) in parse_quoted(text).items() if f in FIELDS or f == 'method'}
    elif scenario == 'possible-duplicate':
        _screenshot(case, 'label.practice_screenshot_a', 1_800_000, SAMPLE_TIME, '701245678912',
                    {'amount': '₹18,000.00 paid', 'time': '12 Oct, 7:42 PM'})
        _screenshot(case, 'label.practice_screenshot_b', 1_800_000, '2026-10-12T14:13:00+00:00', '',
                    {'amount': '₹18,000.00', 'time': '12 Oct, 7:43 PM', 'reference': 'UTR 70124…(cut off)'})
    elif scenario == 'unreadable-reference':
        _screenshot(case, 'label.practice_blurred', 1_800_000, SAMPLE_TIME, '',
                    {'amount': '₹18,000.00 paid', 'time': '12 Oct 2026, 7:42 PM', 'reference': 'UTR ▒▒▒▒▒▒ (blurred)'})
    else:
        raise KeyError(scenario)

def _read(item: dict) -> dict:
    return {f: v['value'] for f, v in item['facts'].items() if f in FIELDS and v['status'] == 'read'}

def _source(item: dict, field: str | None = None) -> dict:
    fact = item['facts'].get(field) if field else None
    label = label_msg(item)
    return {'evidence_id': item['id'], 'label': render(label['key'], label['params']), 'label_msg': label,
            **both({}, 'origin', f"origin.{item['origin']}"),
            'quote': (fact or {}).get('quote', ''), 'quote_verified': (fact or {}).get('quote_verified')}

def _saved_source(value) -> dict:
    return {'value': value, **both({}, 'label', 'source.saved'), **both({}, 'origin', 'origin.saved'),
            'quote': '', 'quote_verified': None}

SOURCE_KEYS = ('label', 'label_msg', 'origin', 'origin_msg', 'quote', 'quote_verified')

def _similar(read: dict, candidate: dict) -> tuple[bool, list[dict]]:
    """Possible same payment? Contradicting references rule it out. Reasons are messages."""
    reasons = []
    ref, other = read.get('reference'), candidate.get('reference')
    if ref and other:
        if not _same('reference', ref, other):
            return False, []
        reasons.append(msg('reason.same_reference', reference=ref))
    same_amount = bool(read.get('amount_paise') and read.get('amount_paise') == candidate.get('amount_paise'))
    if same_amount:
        reasons.append(msg('reason.same_amount', amount_paise=read['amount_paise']))
    near = None
    if read.get('occurred_at') and candidate.get('occurred_at'):
        gap = abs(datetime.fromisoformat(read['occurred_at']) - datetime.fromisoformat(candidate['occurred_at']))
        near = gap <= NEAR_TIME
        if near:
            minutes = int(gap.total_seconds() // 60)
            reasons.append(msg('reason.same_time') if not minutes else msg('reason.one_minute') if minutes == 1
                           else msg('reason.minutes', minutes=minutes))
    return bool(reasons and (ref and other or same_amount and near is not False)), reasons

def _valid_entry(field: str, value):
    """Validate a value the person typed in answer to a question."""
    if field == 'amount_paise':
        if not isinstance(value, int) or isinstance(value, bool) or not 0 < value <= 1_000_000_000:
            raise UserError('err.amount_range')
        return value
    if field == 'occurred_at':
        try:
            when = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
        except (TypeError, ValueError):
            raise UserError('err.datetime_invalid')
        return transaction_time(when).isoformat()
    text = plain_text(str(value or '').strip())
    if not text or len(text) > (100 if field == 'reference' else 200):
        raise UserError('err.enter_value', field=field)
    return text

def _texts(messages: list[dict]) -> list[str]:
    return [render(m['key'], m['params']) for m in messages]

def reconcile(case: dict) -> dict:
    """Pure function of the saved case: links, open questions, proposed changes, uncertainty."""
    evidence = case.get('evidence') or {}
    items, answers = evidence.get('items', []), evidence.get('answers', {})
    confirmed = transactions(case)
    names = {t['id']: msg('payment.n', n=n) for n, t in enumerate(confirmed, 1)}
    pending, links, questions, answered, unsure = [], {}, [], [], []
    groups = {t['id']: [] for t in confirmed}
    by_id = {item['id']: item for item in items}
    later = choice('later', 'choice.later')
    dont_know = choice('unknown', 'choice.unknown')

    def ask(question, answer=None):
        kind = question['kind'].split(':')[0]
        question['order'] = ORDER.get(question['kind'], 9)
        both(question, 'why', f'why.{kind}')
        question['choices'] = question['choices'] + [later]
        question['reasons'] = _texts(question.get('reason_msgs', []))
        if answer:
            answered.append({**question, 'answer': answer})
        else:
            # "Answer later" keeps the question open, behind the others.
            question['deferred'] = answers.get(question['id'], {}).get('choice') == 'later'
            questions.append(question)

    def unsure_note(key, **params):
        unsure.append(both({k: params.pop(k) for k in ('payment_id', 'field_id', 'conflict') if k in params}, 'text', key, **params))

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
        if best:
            cid, reasons = best
            question = both({'id': f"place:{item['id']}", 'kind': 'possible_duplicate', 'reason_msgs': reasons,
                             'choices': [choice(f'same:{cid}', 'choice.same_yes'), choice('new', 'choice.separate'), dont_know]},
                            'text', 'q.duplicate', kind=item['kind'], payment=names[cid],
                            amount_paise=values[cid].get('amount_paise'), occurred_at=values[cid].get('occurred_at'))
            both(question, 'help', 'q.duplicate.help')
        else:
            question = both({'id': f"place:{item['id']}", 'kind': 'placement', 'reason_msgs': [],
                             'choices': [choice(f"same:{c['id']}", 'choice.payment', payment=names[c['id']],
                                                amount_paise=values[c['id']].get('amount_paise'),
                                                occurred_at=values[c['id']].get('occurred_at')) for c in candidates]
                                        + [choice('new', 'choice.new'), choice('unrelated', 'choice.unrelated'), dont_know]},
                            'text', 'q.placement', kind=item['kind'])
            both(question, 'help', 'q.placement.help', amount_paise=read.get('amount_paise'), occurred_at=read.get('occurred_at'))
        question['sources'] = [{**_source(item, f), 'field': f,
                                'value': None if fact['status'] == 'unreadable' else fact['value'],
                                'unreadable': fact['status'] == 'unreadable'}
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
            names[pid] = msg('payment.possible', n=len(confirmed) + len(pending))
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
                unsure_note('unsure.placement', label=label_msg(item))

    # 2. Compare each payment's saved value with its linked evidence, field by field.
    resolved = {pid: {} for pid in groups}
    for payment in confirmed + pending:
        pid, eids = payment['id'], groups[payment['id']]
        is_pending = pid.startswith('P-')
        linked = [by_id[e] for e in eids]
        if not linked:
            continue
        for field in FIELDS:
            entries = [] if is_pending or payment.get(field) in (None, '') else [_saved_source(payment[field])]
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
                question = both({'id': qid, 'kind': f'conflict:{field}', 'payment': pid, 'field': field, 'sources': [],
                                 'choices': [{**choice(f'value:{n}', 'value.plain', value=g['value'], field=field), 'value': g['value'],
                                              'sources': [{k: s.get(k) for k in SOURCE_KEYS} for s in g['sources']]}
                                             for n, g in enumerate(distinct)] + [dont_know]},
                                'text', 'q.conflict', field=field, payment=names[pid])
                both(question, 'help', 'q.conflict.help')
                answer = answers.get(qid)
                ok = answer and (answer['choice'] == 'unknown' or any(_same(field, g['value'], answer.get('value')) for g in distinct if answer.get('value') is not None))
                ask(question, answer if ok else None)
                if ok and answer['choice'] == 'unknown':
                    unsure_note('unsure.conflict', payment_id=pid, field_id=field, conflict=True, payment=names[pid], field=field,
                                values=[msg('unsure.value', label=s.get('label_msg') or msg('value.plain', value=s['label']),
                                            value=g['value'], field=field) for g in distinct for s in g['sources'][:1]])
                elif ok:
                    resolved[pid][field] = answer['value']
            elif len(distinct) == 1 and not has_saved:
                value = distinct[0]['value']
                if is_pending:
                    resolved[pid][field] = value
                    continue
                qid = f'fill:{field}:' + _digest(anchor, _norm(field, value))
                ask_fill = both({'id': qid, 'kind': f'fill:{field}', 'payment': pid, 'field': field,
                                 'sources': [{k: s.get(k) for k in SOURCE_KEYS} for s in distinct[0]['sources']],
                                 'choices': [{**choice('value:0', 'choice.add'), 'value': value}, choice('skip', 'choice.skip'), dont_know]},
                                'text', 'q.fill', field=field, value=value, payment=names[pid])
                both(ask_fill, 'help', 'q.fill.help')
                answer = answers.get(qid)
                ok = answer and answer['choice'] in ('value', 'skip', 'unknown')
                ask(ask_fill, answer if ok else None)
                if ok and answer['choice'] == 'value':
                    resolved[pid][field] = value
            elif not distinct and not has_saved and (unreadable or (is_pending and field in ('amount_paise', 'occurred_at'))):
                kind = 'unreadable' if unreadable else 'enter'
                qid = f'{kind}:{field}:' + anchor
                source = unreadable[0] if unreadable else linked[0]
                required = is_pending and field in ('amount_paise', 'occurred_at')
                question = {'id': qid, 'kind': f'{kind}:{field}', 'payment': pid, 'field': field,
                            'sources': [_source(source, field)],
                            'choices': [{**choice('enter', 'choice.enter'), 'input': field},
                                        choice('unknown', 'choice.unknown' if required else 'choice.unknown_continue')]}
                if unreadable:
                    both(question, 'text', 'q.unreadable', field=field, kind=source['kind'])
                else:
                    both(question, 'text', 'q.enter', field=field, payment=names[pid])
                both(question, 'help', 'q.required.help' if required else 'q.optional.help')
                answer = answers.get(qid)
                ok = answer and answer['choice'] in ('enter', 'unknown')
                ask(question, answer if ok else None)
                if ok and answer['choice'] == 'enter':
                    resolved[pid][field] = answer['value']
                elif ok:
                    unsure_note('unsure.unknown', payment_id=pid, field_id=field, payment=names[pid], field=field)

    # 3. Proposed changes. None apply until the person re-confirms them.
    changes = []
    for payment in confirmed:
        for field, value in resolved[payment['id']].items():
            before = payment.get(field)
            if before in (None, '') or not _same(field, before, value) or (field == 'occurred_at' and before != value):
                changes.append(both({'id': f"{payment['id']}:{field}", 'type': 'update', 'payment': payment['id'], 'field': field,
                                     'before': before, 'after': value, 'before_text': shown(field, before), 'after_text': shown(field, value)},
                                    'label', 'change.update', payment=names[payment['id']], field=field))
    for p in pending:
        values = resolved[p['id']]
        method = next((by_id[e]['facts']['method']['value'] for e in p['evidence_ids'] if 'method' in by_id[e]['facts']), 'Other')
        new = {'amount_paise': values.get('amount_paise'), 'occurred_at': values.get('occurred_at'),
               'reference': values.get('reference', ''), 'payee': values.get('payee', ''), 'method': method}
        missing = [f for f in ('amount_paise', 'occurred_at') if not new[f]]
        change = both({'id': p['id'], 'type': 'add', 'payment': p['id'], 'transaction': new, 'evidence_ids': p['evidence_ids'],
                       'complete': not missing, 'after_text': ' · '.join(shown(f, new[f]) for f in FIELDS if new[f])},
                      'label', 'change.add', payment=names[p['id']])
        if missing:
            both(change, 'blocked', 'change.blocked', fields=[msg(f'field.{f}') for f in missing])
        else:
            change['blocked'], change['blocked_msg'] = '', None
        changes.append(change)
    questions.sort(key=lambda q: (q['deferred'], q['order']))
    return {'questions': questions, 'answered': answered, 'changes': changes, 'unsure': unsure,
            'links': links, 'payment_names': names, **both({}, 'note', 'reconcile.note')}

def record_answer(case: dict, question_id: str, data: AnswerInput) -> None:
    result = reconcile(case)
    question = next((q for q in result['questions'] + result['answered'] if q['id'] == question_id), None)
    if not question:
        raise LookupError(UserError('err.question_gone'))
    picked = next((c for c in question['choices'] if c['id'] == data.choice), None)
    if not picked:
        raise UserError('err.choose_offered')
    answer = {'choice': data.choice, 'answered_at': utcnow().isoformat()}
    if data.choice.startswith('value:'):
        # Store the chosen value itself so later evidence cannot shift the meaning of an index.
        answer.update(choice='value', value=picked['value'])
    elif data.choice == 'enter':
        answer['value'] = _valid_entry(question['field'], data.value)
    case['evidence'].setdefault('answers', {})[question_id] = answer

def forget_answer(case: dict, question_id: str) -> None:
    if case.get('evidence', {}).get('answers', {}).pop(question_id, None) is None:
        raise LookupError(UserError('err.no_answer_saved'))

def apply_changes(case: dict, data: ApplyInput) -> list[dict]:
    """Apply every complete proposed change after explicit re-confirmation."""
    if data.version != case.get('facts_version', 1):
        raise PermissionError(UserError('err.stale_review'))
    result = reconcile(case)
    ready = [c for c in result['changes'] if c['type'] == 'update' or c['complete']]
    if not ready:
        raise UserError('err.no_changes_ready')
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
    commit(case, items, [{k: c.get(k) for k in ('type', 'label', 'label_msg', 'field', 'before', 'after', 'before_text', 'after_text', 'created')}
                         for c in ready], 'evidence')
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
        raise PermissionError(UserError('err.stale_form'))
    items = transactions(case)
    target = next((t for t in items if t['id'] == data.transaction_id), None)
    if not target:
        raise LookupError(UserError('err.payment_missing'))
    name = msg('payment.n', n=items.index(target) + 1)
    summary = []
    for field in ('amount_paise', 'occurred_at', 'reference', 'payee', 'method'):
        value = getattr(data, field)
        if value is None:
            continue
        value = value.isoformat() if field == 'occurred_at' else value
        if value != target[field]:
            summary.append(both({'type': 'update', 'field': field, 'before': target[field], 'after': value,
                                 'before_text': shown(field, target[field]), 'after_text': shown(field, value)},
                                'label', 'change.update', payment=name, field=field))
            target[field] = value
    case_level = {f: getattr(data, f) for f in ('bank', 'description') if getattr(data, f) not in (None, case[f])}
    for field, value in case_level.items():
        summary.append(both({'type': 'update', 'field': field, 'before': case[field], 'after': value,
                             'before_text': case[field], 'after_text': value}, 'label', 'change.case', field=field))
    if not summary:
        raise UserError('err.nothing_changed')
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
                saved = next(c for c in question['choices'] if any(s.get('label_msg', {}).get('key') == 'source.saved' for s in c.get('sources', [])))
                answers[question['id']] = {'choice': 'value', 'value': saved['value'], **stamp}
            else:
                answers[question['id']] = {'choice': 'skip' if kind == 'fill' else 'unknown', **stamp}
