"""Translation catalogue integrity and coded API errors."""
import ast
import json
import re
from pathlib import Path
from datetime import datetime, timezone
from backend.app import messages
from backend.tests.test_cases import client, case_data, create

ROOT = Path(__file__).resolve().parents[2]
I18N = ROOT / 'frontend' / 'src' / 'i18n'
EN = json.loads((I18N / 'en.json').read_text(encoding='utf-8'))
TA = json.loads((I18N / 'ta.json').read_text(encoding='utf-8'))
PLACEHOLDER = re.compile(r'\{(\w+)\}')

def test_tamil_has_exactly_the_english_keys_and_placeholders():
    assert set(TA) == set(EN)
    for key, text in EN.items():
        assert sorted(PLACEHOLDER.findall(text)) == sorted(PLACEHOLDER.findall(TA[key])), key
        assert TA[key].strip(), key

def test_tamil_is_actually_translated():
    # Strings that legitimately stay identical: placeholders, codes and proper names.
    allowed = {k for k, v in EN.items() if not re.search(r'[A-Za-z]{3,}', PLACEHOLDER.sub('', v)) or v in ('UPI', 'IST', '1930')}
    untranslated = [k for k in EN if EN[k] == TA[k] and k not in allowed]
    assert untranslated == []
    assert sum(bool(re.search('[஀-௿]', v)) for v in TA.values()) > 0.9 * len(TA)

def backend_keys() -> set[str]:
    """Message keys passed as literals to msg/say/both/choice/UserError/fail/ExtractionFailed."""
    keys = set()
    for path in (ROOT / 'backend' / 'app').glob('*.py'):
        for node in ast.walk(ast.parse(path.read_text(encoding='utf-8'))):
            if isinstance(node, ast.Call):
                name = getattr(node.func, 'id', getattr(node.func, 'attr', ''))
                args = [a for a in node.args if isinstance(a, ast.Constant) and isinstance(a.value, str)]
                if name in ('msg', 'say', 'UserError', 'fail', 'ExtractionFailed', 'both', 'choice'):
                    keys |= {a.value for a in args if re.fullmatch(r'[a-z_]+(\.[\w-]+)+', a.value)}
    return keys

def test_every_backend_message_key_exists():
    used = backend_keys()
    assert len(used) > 80
    assert sorted(used - set(EN)) == []

def frontend_keys() -> tuple[set[str], set[str]]:
    literal, families = set(), set()
    for path in list((ROOT / 'frontend' / 'src').rglob('*.tsx')) + list((ROOT / 'frontend' / 'src').glob('*.ts')):
        source = path.read_text(encoding='utf-8')
        literal |= set(re.findall(r"\bt\(\s*'([a-z][\w.-]*)'", source))
        literal |= set(re.findall(r"set(?:Problem|Error|Notice)\('([a-z][\w.-]+\.[\w.-]+)'\)", source))
        families |= {f.split('${')[0] for f in re.findall(r"\bt\(\s*`([^`]*)`", source) if f.split('${')[0]}
    return literal, families

def test_every_frontend_key_exists_and_dynamic_families_are_complete():
    literal, families = frontend_keys()
    assert sorted(literal - set(EN)) == []
    expected = {
        'state.': ['not_started', 'later', 'no_answer', 'waiting', 'resolved'],
        'state.message.': ['not_started', 'later', 'no_answer', 'waiting', 'resolved'],
        'action.': ['helpline', 'bank', 'portal'], 'channel.': ['helpline', 'bank', 'portal'],
        'case.draft_intro.': ['helpline', 'bank', 'portal'], 'dash.short.': ['helpline', 'bank', 'portal'],
        'origin.': ['pasted_text', 'typed_by_user', 'synthetic_fixture', 'ai_provider'],
        'read.title.': ['read', 'manual', 'needs_consent', 'unavailable', 'failed'],
        'evidence.link.': ['linked', 'waiting', 'unrelated', 'unknown', 'no_details'],
        'kindtitle.': ['receipt', 'bank_message', 'chat', 'screenshot', 'other'],
        'source.': ['manual', 'sample', 'fixture', 'text', 'ai_provider'],
        'fieldtitle.': ['amount_paise', 'occurred_at', 'reference', 'payee'],
        'guided.intent.': ['later', 'no_answer', 'waiting'], 'safety.answer.': ['safe', 'unsure'],
        'method.': ['upi', 'card', 'netbanking', 'other'],
        'evidence.practice.': ['amount-conflict', 'possible-duplicate', 'unreadable-reference'],
    }
    for prefix, values in expected.items():
        assert [prefix + v for v in values if prefix + v not in EN] == [], prefix
    for step in range(6):
        assert f'intake.step{step}.title' in EN and f'intake.step{step}.sub' in EN
    for step in range(5):
        assert f'intake.step{step}.why' in EN
    assert {'action.', 'state.', 'origin.'} <= families

def test_api_errors_carry_codes_for_translation(client):
    data = {**case_data(client), 'occurred_at': '0026-01-01T00:00:00+00:00', 'bank': '12345', 'description': 'short'}
    problems = client.post('/api/cases', json=data).json()['detail']
    by_field = {p['field']: p for p in problems}
    assert by_field['occurred_at']['code'] == 'err.year'
    assert by_field['bank']['code'] == 'err.bank_number'
    assert by_field['description']['code'] == 'err.type.string_too_short' and by_field['description']['params'] == {'min_length': 10}
    assert all(p['message'] and p['code'] in EN for p in problems)
    missing = client.get('/api/cases/RC-NOPE').json()['detail']
    assert missing['code'] == 'err.case_missing' and missing['message'] == EN['err.case_missing']
    foreign = client.post('/api/cases', json=case_data(client), headers={'Origin': 'https://untrusted.example'})
    assert foreign.status_code == 403 and foreign.json()['detail']['code'] == 'err.local_only'

def test_domain_errors_raised_inside_editing_are_coded(client):
    case = create(client)
    stale = client.post(f"/api/cases/{case['id']}/corrections", json={'version': 9, 'confirmed': True}).json()['detail']
    assert stale['code'] == 'err.stale_review'
    reminder = client.put(f"/api/cases/{case['id']}/journey/bank", json={'state': 'later', 'remind_at': '2020-01-01T00:00:00Z'}).json()['detail']
    assert reminder[0]['code'] == 'err.reminder_window'

def test_messages_render_parameters_consistently():
    assert messages.say('q.duplicate', kind='screenshot', payment=messages.msg('payment.n', n=1),
                        amount_paise=1_800_000, occurred_at='2026-10-12T14:12:00+00:00') == \
        'Is this screenshot the same payment as Payment 1 (INR 18,000.00, 12 Oct 2026, 07:42 PM IST)?'
    assert messages.say('q.placement.help', amount_paise=None, occurred_at=None) == \
        'It shows not known, not known. It does not clearly match a saved payment.'

def test_question_payload_is_fully_translatable(client):
    case = create(client)
    case = client.post(f"/api/cases/{case['id']}/evidence/practice/amount-conflict").json()
    question = case['reconciliation']['questions'][0]
    for name in ('text_msg', 'help_msg', 'why_msg'):
        assert question[name]['key'] in TA
    assert all(choice['label_msg']['key'] in TA for choice in question['choices'])
    assert all(reason['key'] in TA for reason in question['reason_msgs'])
    assert all(source['origin_msg']['key'] in TA for source in question['sources'])
