from datetime import datetime, timedelta, timezone
from io import BytesIO
import pytest
from fastapi.testclient import TestClient
from PIL import Image
from backend.app import main

@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(main, 'DB_PATH', tmp_path / 'test.db')
    with TestClient(main.app) as c:
        yield c

def case_data(client):
    return {**client.get('/api/sample').json(), 'confirmed': True}

def create(client):
    response = client.post('/api/cases', json=case_data(client))
    assert response.status_code == 201, response.text
    return response.json()

def test_case_lifecycle_preserves_actual_report_time(client):
    case = create(client)
    case_id = case['id']
    occurred = datetime.fromisoformat(case['occurred_at'])
    for n, ch in enumerate(('bank', 'helpline', 'portal')):
        at = (occurred + timedelta(minutes=10+n)).isoformat()
        result = client.put(f'/api/cases/{case_id}/reports/{ch}', json={'reference': f'demo-{ch}', 'reported_at': at})
        assert result.status_code == 200
        report = result.json()['reports'][ch]
        assert datetime.fromisoformat(report['reported_at']) == datetime.fromisoformat(at)
        assert report['reported_at'] != report['recorded_at']
    result = client.get('/api/cases/'+case_id).json()
    assert result['status'] == 'reports_recorded'
    assert result['policy']['status'] == 'not_assessed'
    assert len(client.get('/api/cases').json()) == 1
    assert client.delete('/api/cases/'+case_id).status_code == 204
    for suffix in ('', '/docs', '/pack.pdf', '/export.json'):
        assert client.get('/api/cases/'+case_id+suffix).status_code == 404
    assert client.get('/api/cases').json() == []

@pytest.mark.parametrize('field,value', [('amount_paise',0),('amount_paise',-1),('amount_paise',12.5),('amount_paise',True),('confirmed',False),('bank',' '),('description','short'),('occurred_at','2026-10-12T12:00:00'),('occurred_at','2999-01-01T00:00:00Z')])
def test_reject_invalid_case(client,field,value):
    data = case_data(client)
    data[field] = value
    assert client.post('/api/cases',json=data).status_code == 422

def test_drafts_keep_confirmed_facts_without_inventing_filings(client):
    data = case_data(client)
    data.update(amount_paise=1800001, reference='CARD-ABC-123', payee='person.name@bank')
    case = client.post('/api/cases',json=data).json()
    docs = client.get('/api/cases/'+case['id']+'/docs').json()
    for draft in docs.values():
        assert '18,000.01' in draft and 'CARD-ABC-123' in draft and 'person.name@bank' in draft
        assert 'Screenshots are attached' not in draft
        assert 'eligible' not in draft.lower()
    assert 'No report recorded' in docs['portal']
    assert 'Unauthorised' not in docs['bank']

def test_missing_details_do_not_block_reporting(client):
    data=case_data(client); data.update(reference='',payee='')
    case=client.post('/api/cases',json=data).json()
    assert len(case['missing_fields']) == 2
    result=client.put(f"/api/cases/{case['id']}/reports/bank",json={'reference':'','reported_at':datetime.now(timezone.utc).isoformat()})
    assert result.status_code == 200
    assert result.json()['reports_recorded'] == 1
    assert result.json()['status'] == 'in_progress'

def test_report_before_transaction_rejected(client):
    case=create(client)
    result=client.put(f"/api/cases/{case['id']}/reports/bank",json={'reference':'demo','reported_at':'2020-01-01T00:00:00Z'})
    assert result.status_code == 422

def test_edit_report_preserves_first_recording_time(client):
    case=create(client);path=f"/api/cases/{case['id']}/reports/bank"
    first=client.put(path,json={'reference':'','reported_at':datetime.now(timezone.utc).isoformat()}).json()['reports']['bank']
    next_report=client.put(path,json={'reference':'ticket-1','reported_at':first['reported_at']}).json()['reports']['bank']
    assert first['recorded_at'] == next_report['recorded_at']
    assert next_report['reference'] == 'ticket-1'

def test_pdf_long_content_markup_and_reference(client):
    data=case_data(client);data['description']='<script>not executable</script> & ' + ('Long incident details. '*170)
    case=client.post('/api/cases',json=data).json()
    result=client.get(f"/api/cases/{case['id']}/pack.pdf")
    assert result.status_code == 200, result.text[:100] if result.status_code!=200 else ''
    assert result.content.startswith(b'%PDF-')
    assert result.headers['content-type'] == 'application/pdf'

def test_synthetic_image_and_unknown_renamed_image(client):
    response=client.post('/api/extract',files={'image':('any-name.png',main.SAMPLE.read_bytes(),'image/png')})
    assert response.status_code == 200
    assert response.json()['source'] == 'fixture'
    image=BytesIO();Image.new('RGB',(10,10),'red').save(image,format='PNG')
    response=client.post('/api/extract',files={'image':('synthetic-payment.png',image.getvalue(),'image/png')})
    assert response.json()['source'] == 'manual' and response.json()['fields'] is None

def test_invalid_and_oversized_image(client):
    assert client.post('/api/extract',files={'image':('a.png',b'not a png','image/png')}).status_code == 422
    assert client.post('/api/extract',files={'image':('a.png',b'x'*(10*1024*1024+1),'image/png')}).status_code == 413

def test_foreign_origin_rejected(client):
    result=client.post('/api/cases',json=case_data(client),headers={'Origin':'https://untrusted.example'})
    assert result.status_code == 403

def test_unknown_host_rejected(client):
    assert client.get('/api/cases',headers={'Host':'rebind.example'}).status_code == 400

def test_cases_survive_new_client(client):
    case=create(client)
    with TestClient(main.app) as second:
        assert second.get('/api/cases/'+case['id']).json()['amount_paise'] == 1800000

def test_pdf_unsupported_glyph_does_not_silently_corrupt_text(client):
    data=case_data(client);data['description']='Fictional incident: தமிழ்'
    case=client.post('/api/cases',json=data).json()
    assert client.get(f"/api/cases/{case['id']}/pack.pdf").status_code == 422
    assert 'தமிழ்' in client.get(f"/api/cases/{case['id']}/export.json").json()['description']

def test_bank_number_is_not_accepted_as_name(client):
    data=case_data(client);data['bank']='1234567890'
    assert client.post('/api/cases',json=data).status_code==422

def test_hidden_control_characters_are_rejected(client):
    data=case_data(client);data['reference']='123\x00789'
    assert client.post('/api/cases',json=data).status_code==422

@pytest.mark.parametrize('when',['0026-10-12T14:12:00+00:00','1999-12-31T23:00:00+00:00'])
def test_mistyped_transaction_year_is_rejected(client, when):
    response = client.post('/api/cases', json={**case_data(client), 'occurred_at': when})
    assert response.status_code == 422
    assert 'year' in response.text
