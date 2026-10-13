"""Evidence reconciliation acceptance scenarios. All evidence is synthetic."""
import json
import sqlite3
from datetime import datetime, timezone
from backend.app import main
from backend.app.evidence import reconcile
from backend.app.extraction import parse_quoted
from backend.tests.test_cases import client, case_data, create

def practice(client, case, scenario):
    response = client.post(f"/api/cases/{case['id']}/evidence/practice/{scenario}")
    assert response.status_code == 201, response.text
    return response.json()

def answer(client, case, question, choice, value=None):
    body = {'choice': choice} if value is None else {'choice': choice, 'value': value}
    response = client.put(f"/api/cases/{case['id']}/clarifications/{question['id']}", json=body)
    assert response.status_code == 200, response.text
    return response.json()

def first(case):
    return case['reconciliation']['questions'][0]

def apply(client, case):
    return client.post(f"/api/cases/{case['id']}/corrections", json={'version': case['facts_version'], 'confirmed': True})

def test_amount_conflict_shows_sources_and_waits_for_reconfirmation(client):
    case = practice(client, create(client), 'amount-conflict')
    # Each evidence item must be placed by the person; nothing is merged automatically.
    assert [q['kind'] for q in case['reconciliation']['questions']] == ['possible_duplicate', 'possible_duplicate']
    assert 'Both show reference 701245678912' in first(case)['reasons']
    case = answer(client, case, first(case), 'same:T1')
    case = answer(client, case, first(case), 'same:T1')
    question = first(case)
    assert question['kind'] == 'conflict:amount_paise'
    labels = {c['label']: c for c in question['choices']}
    assert set(labels) == {'INR 18,000.00', 'INR 20,000.00', 'I don’t know'}
    # Every option names its sources, including the exact text that was read.
    assert {s['label'] for s in labels['INR 18,000.00']['sources']} == {'Your saved details', 'Practice payment receipt'}
    assert labels['INR 20,000.00']['sources'][0]['quote'] == 'INR 20,000.00 debited'
    assert 'fixture' in labels['INR 20,000.00']['sources'][0]['origin']
    case = answer(client, case, question, 'value:1')
    assert case['reconciliation']['questions'] == []
    assert case['amount_paise'] == 1_800_000 and case['total_paise'] == 1_800_000  # not applied yet
    [change] = case['reconciliation']['changes']
    assert (change['before_text'], change['after_text']) == ('INR 18,000.00', 'INR 20,000.00')
    response = apply(client, case)
    assert response.status_code == 200, response.text
    case = response.json()
    assert case['amount_paise'] == 2_000_000 and case['facts_version'] == 2
    assert case['corrections'][0]['changes'][0]['after_text'] == 'INR 20,000.00'
    # The resolved conflict does not come back and no further change is proposed.
    assert case['reconciliation']['questions'] == [] and case['reconciliation']['changes'] == []

def test_confirmed_correction_appears_in_every_document(client):
    case = practice(client, create(client), 'amount-conflict')
    for _ in range(2):
        case = answer(client, case, first(case), 'same:T1')
    case = apply(client, answer(client, case, first(case), 'value:1')).json()
    docs = client.get(f"/api/cases/{case['id']}/docs").json()
    for name, draft in docs.items():
        assert 'INR 20,000.00' in draft, name
        assert 'INR 18,000.00' not in draft, name
    assert client.get(f"/api/cases/{case['id']}/pack.pdf").status_code == 200
    assert client.get(f"/api/cases/{case['id']}/export.json").json()['transactions'][0]['amount_paise'] == 2_000_000

def test_unknown_conflict_keeps_saved_value_and_states_uncertainty(client):
    case = practice(client, create(client), 'amount-conflict')
    for _ in range(2):
        case = answer(client, case, first(case), 'same:T1')
    case = answer(client, case, first(case), 'unknown')
    assert case['reconciliation']['changes'] == [] and case['amount_paise'] == 1_800_000
    assert apply(client, case).status_code == 422
    bank = client.get(f"/api/cases/{case['id']}/docs").json()['bank']
    assert 'Details I am still checking' in bank and 'INR 20,000.00' in bank

def test_possible_duplicate_never_changes_total_silently(client):
    case = practice(client, create(client), 'possible-duplicate')
    questions = case['reconciliation']['questions']
    assert [q['kind'] for q in questions] == ['possible_duplicate', 'possible_duplicate']
    assert 'Times are 1 minute apart' in questions[1]['reasons']
    assert case['total_paise'] == 1_800_000 and len(case['transactions']) == 1
    case = answer(client, case, first(case), 'same:T1')
    case = answer(client, case, first(case), 'same:T1')
    assert case['total_paise'] == 1_800_000 and len(case['transactions']) == 1
    assert case['reconciliation']['questions'] == [] and case['reconciliation']['changes'] == []

def test_separate_payment_is_proposed_then_added_only_after_confirmation(client):
    case = practice(client, create(client), 'possible-duplicate')
    case = answer(client, case, first(case), 'same:T1')
    case = answer(client, case, first(case), 'new')
    # The cropped screenshot's reference stays unknown; the new payment is still complete.
    question = first(case)
    assert question['kind'] == 'unreadable:reference' and question['sources'][0]['quote'] == 'UTR 70124…(cut off)'
    case = answer(client, case, question, 'unknown')
    [change] = case['reconciliation']['changes']
    assert change['type'] == 'add' and change['complete'] and change['transaction']['reference'] == ''
    assert case['total_paise'] == 1_800_000
    case = apply(client, case).json()
    assert [t['id'] for t in case['transactions']] == ['T1', 'T2'] and case['total_paise'] == 3_600_000
    assert case['reconciliation']['questions'] == [] and case['reconciliation']['changes'] == []
    portal = client.get(f"/api/cases/{case['id']}/docs").json()['portal']
    assert 'Payments (2)' in portal and 'Total: INR 36,000.00' in portal
    assert '70124' not in portal.split('2. ')[1].split(';')[1]  # no partial digits invented

def test_unreadable_reference_allows_unknown_and_reporting_continues(client):
    data = {**case_data(client), 'reference': ''}
    case = client.post('/api/cases', json=data).json()
    case = practice(client, case, 'unreadable-reference')
    case = answer(client, case, first(case), 'same:T1')
    question = first(case)
    assert question['kind'] == 'unreadable:reference'
    assert [c['id'] for c in question['choices']] == ['enter', 'unknown']
    case = answer(client, case, question, 'unknown')
    assert case['reconciliation']['questions'] == [] and case['reference'] == ''
    bank = client.get(f"/api/cases/{case['id']}/docs").json()['bank']
    assert 'Transaction reference: Not provided' in bank and 'still checking' not in bank
    saved = client.put(f"/api/cases/{case['id']}/reports/helpline",
                       json={'reference': '', 'reported_at': datetime.now(timezone.utc).isoformat()})
    assert saved.status_code == 200 and saved.json()['reports_recorded'] == 1

def test_entered_reference_is_validated_then_proposed(client):
    case = client.post('/api/cases', json={**case_data(client), 'reference': ''}).json()
    case = practice(client, case, 'unreadable-reference')
    case = answer(client, case, first(case), 'same:T1')
    question = first(case)
    bad = client.put(f"/api/cases/{case['id']}/clarifications/{question['id']}", json={'choice': 'enter', 'value': '  '})
    assert bad.status_code == 422
    case = answer(client, case, question, 'enter', 'UTR-TYPED-1')
    assert case['reconciliation']['changes'][0]['after'] == 'UTR-TYPED-1'
    assert apply(client, case).json()['reference'] == 'UTR-TYPED-1'

def test_reconfirmation_and_version_are_required(client):
    case = practice(client, create(client), 'amount-conflict')
    for _ in range(2):
        case = answer(client, case, first(case), 'same:T1')
    case = answer(client, case, first(case), 'value:1')
    path = f"/api/cases/{case['id']}/corrections"
    assert client.post(path, json={'version': 1, 'confirmed': False}).status_code == 422
    assert client.post(path, json={'version': 7, 'confirmed': True}).status_code == 409
    assert client.get('/api/cases/' + case['id']).json()['amount_paise'] == 1_800_000

def test_invalid_answers_are_rejected(client):
    case = practice(client, create(client), 'amount-conflict')
    base = f"/api/cases/{case['id']}/clarifications/"
    assert client.put(base + first(case)['id'], json={'choice': 'same:T9'}).status_code == 422
    assert client.put(base + 'place:E99', json={'choice': 'new'}).status_code == 404

def test_changing_an_answer_reopens_the_question(client):
    case = practice(client, create(client), 'possible-duplicate')
    qid = first(case)['id']
    case = answer(client, case, first(case), 'unknown')
    assert any('not sure' in u['text'] for u in case['reconciliation']['unsure'])
    case = client.delete(f"/api/cases/{case['id']}/clarifications/{qid}").json()
    assert first(case)['id'] == qid

def test_unrelated_and_unknown_evidence_is_not_counted(client):
    case = create(client)
    case = client.post(f"/api/cases/{case['id']}/evidence", json={'kind': 'chat', 'typed': {'amount_paise': 99_900}}).json()
    question = first(case)
    assert question['kind'] == 'placement'
    assert {c['id'] for c in question['choices']} == {'same:T1', 'new', 'unrelated', 'unknown'}
    case = answer(client, case, question, 'unrelated')
    assert case['total_paise'] == 1_800_000 and case['reconciliation']['changes'] == []
    assert case['reconciliation']['links']['E1']['status'] == 'unrelated'

def test_pasted_text_keeps_exact_quotes_and_bad_input_is_rejected(client):
    text = 'INR 1,250.50 debited via UPI. UTR: ABC-12345. To someone@bank'
    quoted = parse_quoted(text)
    assert quoted['amount_paise'] == (125_050, 'INR 1,250.50 debited')
    assert all(quote in text for _, quote in quoted.values())
    case = create(client)
    url = f"/api/cases/{case['id']}/evidence"
    item = client.post(url, json={'kind': 'bank_message', 'text': text}).json()['evidence']['items'][0]
    assert item['origin'] == 'pasted_text' and item['facts']['reference']['value'] == 'ABC-12345'
    assert client.post(url, json={'kind': 'chat'}).status_code == 422
    assert client.post(url, json={'kind': 'chat', 'typed': {'reference': 'X1', 'reference_unreadable': True}}).status_code == 422
    assert client.post(url, json={'kind': 'chat', 'typed': {'amount_paise': 0}}).status_code == 422

def test_message_without_details_asks_nothing(client):
    case = create(client)
    case = client.post(f"/api/cases/{case['id']}/evidence", json={'kind': 'chat', 'text': 'Please call me back urgently.'}).json()
    assert case['reconciliation']['questions'] == []
    assert case['reconciliation']['links']['E1']['status'] == 'no_details'

def test_manual_correction_needs_reconfirmation_and_keeps_report_order(client):
    case = create(client)
    path = f"/api/cases/{case['id']}/facts"
    assert client.put(path, json={'version': 1, 'amount_paise': 1_900_000}).status_code == 422
    corrected = client.put(path, json={'version': 1, 'confirmed': True, 'amount_paise': 1_900_000, 'bank': 'Other Bank'}).json()
    assert corrected['amount_paise'] == 1_900_000 and corrected['bank'] == 'Other Bank' and corrected['facts_version'] == 2
    for draft in client.get(f"/api/cases/{case['id']}/docs").json().values():
        assert 'INR 19,000.00' in draft
    assert client.put(path, json={'version': 1, 'confirmed': True, 'amount_paise': 5}).status_code == 409
    client.put(f"/api/cases/{case['id']}/reports/bank", json={'reference': '', 'reported_at': '2026-10-12T15:00:00+00:00'})
    later = client.put(path, json={'version': 2, 'confirmed': True, 'occurred_at': '2026-10-12T16:00:00+00:00'})
    assert later.status_code == 422 and 'before this payment' in later.text
    assert client.put(path, json={'version': 2, 'confirmed': True, 'amount_paise': 1_900_000}).status_code == 422

def test_removing_evidence_never_removes_a_confirmed_payment(client):
    case = practice(client, create(client), 'possible-duplicate')
    case = answer(client, case, first(case), 'same:T1')
    case = answer(client, case, first(case), 'new')
    case = answer(client, case, first(case), 'unknown')
    case = apply(client, case).json()
    case = client.delete(f"/api/cases/{case['id']}/evidence/E2").json()
    assert len(case['transactions']) == 2 and case['total_paise'] == 3_600_000

def test_cases_saved_before_evidence_model_still_load(client):
    legacy = {**case_data(client), 'id': 'RC-LEGACY000001', 'created_at': '2026-10-12T15:00:00+00:00',
              'reports': {'bank': {'reference': 'B-1', 'reported_at': '2026-10-12T15:00:00+00:00',
                                   'recorded_at': '2026-10-12T15:01:00+00:00'}}}
    legacy.pop('confirmed')
    with sqlite3.connect(main.DB_PATH) as connection:
        connection.execute('CREATE TABLE IF NOT EXISTS cases (id TEXT PRIMARY KEY, data TEXT NOT NULL)')
        connection.execute('INSERT INTO cases VALUES (?,?)', (legacy['id'], json.dumps(legacy)))
    case = client.get('/api/cases/RC-LEGACY000001').json()
    assert case['transactions'][0]['amount_paise'] == 1_800_000 and case['facts_version'] == 1
    assert case['reconciliation']['questions'] == []
    assert client.get('/api/cases/RC-LEGACY000001/docs').status_code == 200
    assert client.get('/api/cases/RC-LEGACY000001/pack.pdf').status_code == 200
    case = practice(client, case, 'amount-conflict')
    assert len(case['reconciliation']['questions']) == 2

def test_reconcile_is_deterministic():
    case = {'amount_paise': 1_800_000, 'occurred_at': '2026-10-12T14:12:00+00:00', 'reference': '', 'payee': '',
            'method': 'UPI', 'evidence': {'items': [{'id': 'E1', 'kind': 'receipt', 'origin': 'typed_by_user',
            'label': 'Receipt', 'facts': {'amount_paise': {'value': 1_800_000, 'status': 'read', 'quote': ''}}}], 'answers': {}}}
    assert reconcile(case) == reconcile(case)
