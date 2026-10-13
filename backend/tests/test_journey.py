from datetime import datetime, timedelta, timezone
import pytest
from pydantic import ValidationError
from backend.app.journey import JourneyInput, plan
from backend.tests.test_cases import client, create

def test_unanswered_is_not_reported_and_other_channel_is_next(client):
    c=create(client)
    r=client.put(f"/api/cases/{c['id']}/journey/helpline",json={'state':'no_answer','remind_at':(datetime.now(timezone.utc)+timedelta(minutes=15)).isoformat()})
    assert r.status_code==200
    assert r.json()['reports_recorded']==0
    assert r.json()['plan']['next_channel']=='bank'
    saved=client.get('/api/cases/'+c['id']).json()
    assert saved['plan']['steps'][0]['state']=='no_answer'
    assert len(saved['journey_history'])==1

def test_due_reminder_takes_priority_without_marking_report_done():
    now=datetime.now(timezone.utc)
    c={'reports':{},'journey':{'portal':{'state':'later','remind_at':(now-timedelta(minutes=1)).isoformat()}}}
    result=plan(c,now)
    assert result['next_channel']=='portal'
    assert result['steps'][2]['due']
    assert not result['steps'][2]['reported']

def test_cannot_claim_waiting_without_report(client):
    c=create(client)
    assert client.put(f"/api/cases/{c['id']}/journey/bank",json={'state':'waiting'}).status_code==422
    assert client.put(f"/api/cases/{c['id']}/journey/bank",json={'state':'resolved'}).status_code==422

def test_report_clears_attempt_reminder_and_can_wait(client):
    c=create(client);base=f"/api/cases/{c['id']}"
    client.put(base+'/journey/bank',json={'state':'later','remind_at':(datetime.now(timezone.utc)+timedelta(hours=1)).isoformat()})
    r=client.put(base+'/reports/bank',json={'reference':'','reported_at':datetime.now(timezone.utc).isoformat()})
    assert r.json()['journey']['bank']['state']=='waiting'
    assert r.json()['journey']['bank']['remind_at'] is None
    assert client.put(base+'/journey/bank',json={'state':'no_answer'}).status_code==422
    assert client.put(base+'/journey/bank',json={'state':'waiting','remind_at':(datetime.now(timezone.utc)+timedelta(days=1)).isoformat()}).status_code==200

@pytest.mark.parametrize('at',['2020-01-01T00:00:00Z','2999-01-01T00:00:00Z','2026-10-14T10:00:00'])
def test_reject_bad_reminder_time(at):
    with pytest.raises(ValidationError):JourneyInput(state='later',remind_at=at)
