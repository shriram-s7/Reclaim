"""Loopback-only hackathon demo. Never expose this unauthenticated case queue."""
import hashlib
import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import timedelta
from io import BytesIO
from pathlib import Path
from uuid import uuid4
from urllib.parse import urlparse

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from PIL import Image, UnidentifiedImageError
from starlette.middleware.trustedhost import TrustedHostMiddleware
from .domain import CaseInput, FactsCorrection, ReportInput, CHANNELS, decorate, earliest_transaction, store_transactions, transactions, utcnow
from . import evidence as ev
from .documents import documents, pdf_pack
from .extraction import TextInput, parse_quoted, parse_text
from . import provider
from .messages import EN, UserError, msg, render
from fastapi.exceptions import RequestValidationError
from .journey import JourneyInput

ROOT = Path(__file__).resolve().parents[2]
DB_PATH = Path(os.environ.get('RECLAIM_DB', str(ROOT / 'reclaim.db')))
SAMPLE = ROOT / 'samples' / 'synthetic-payment.png'
app = FastAPI(title='Reclaim local demo', version='0.1.0')
app.add_middleware(TrustedHostMiddleware, allowed_hosts=['localhost', '127.0.0.1', 'testserver'])

@app.middleware('http')
async def local_boundary(request: Request, call_next):
    origin = request.headers.get('origin')
    if request.method not in ('GET', 'HEAD', 'OPTIONS') and origin:
        if origin not in ('http://127.0.0.1:8000', 'http://localhost:8000', 'http://127.0.0.1:5173', 'http://localhost:5173'):
            return JSONResponse({'detail': coded(UserError('err.local_only'))}, status_code=403)
    response = await call_next(request)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Referrer-Policy'] = 'no-referrer'
    response.headers['Cache-Control'] = 'no-store'
    response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; frame-src 'self'; frame-ancestors 'self'; object-src 'none'; base-uri 'self'"
    return response

def coded(error: Exception) -> dict:
    """A user-facing error as {message, code, params}; wrapped UserErrors are unwrapped."""
    inner = error.args[0] if error.args and isinstance(error.args[0], UserError) else error
    if isinstance(inner, UserError):
        return {'message': str(inner), 'code': inner.key, 'params': inner.params}
    return {'message': render('err.invalid'), 'code': 'err.invalid', 'params': {}}

def fail(status: int, key: str, **params) -> HTTPException:
    return HTTPException(status, coded(UserError(key, **params)))

@app.exception_handler(RequestValidationError)
async def validation_errors(request: Request, error: RequestValidationError):
    """Field errors carry a message code so the interface can show them in the chosen language."""
    items = []
    for problem in error.errors():
        field = next((str(part) for part in reversed(problem.get('loc', ())) if isinstance(part, str) and part != 'body'), '')
        cause = (problem.get('ctx') or {}).get('error')
        if isinstance(cause, UserError):
            item = coded(cause)
        else:
            key = f"err.type.{problem['type']}" if f"err.type.{problem['type']}" in EN else 'err.invalid'
            params = {k: v for k, v in (problem.get('ctx') or {}).items() if isinstance(v, (int, float, str)) and not isinstance(v, bool)}
            try:
                item = {'message': render(key, params), 'code': key, 'params': params}
            except (KeyError, IndexError):
                item = {'message': render('err.invalid'), 'code': 'err.invalid', 'params': {}}
        items.append({**item, 'field': field})
    return JSONResponse({'detail': items}, status_code=422)

@contextmanager
def db():
    connection = sqlite3.connect(DB_PATH)
    try:
        connection.execute('CREATE TABLE IF NOT EXISTS cases (id TEXT PRIMARY KEY, data TEXT NOT NULL)')
        with connection:
            yield connection
    finally:
        connection.close()

def get_case(case_id: str):
    with db() as connection:
        row = connection.execute('SELECT data FROM cases WHERE id=?', (case_id,)).fetchone()
    if not row:
        raise fail(404, 'err.case_missing')
    return json.loads(row[0])

@app.get('/api/health')
def health():
    return {'ok': True, 'demo_mode': True, 'now': utcnow().isoformat(), 'policy': 'not_assessed'}

@app.get('/api/sample')
def sample():
    return {'amount_paise': 1800000, 'occurred_at': '2026-10-12T14:12:00+00:00',
            'bank': 'Example Bank (fictional)', 'method': 'UPI', 'reference': '701245678912',
            'payee': 'demo-recipient@example', 'description': 'A caller claimed that my KYC had expired and asked me to make a payment. I later realised that the call was fraudulent.',
            'source': 'sample'}

@app.get('/api/sample/image')
def sample_image():
    return FileResponse(SAMPLE, media_type='image/png', filename='synthetic-payment.png')

def validate_image(data: bytes) -> None:
    if len(data) > provider.MAX_UPLOAD_BYTES:
        raise fail(413, 'err.image_size')
    try:
        with Image.open(BytesIO(data)) as picture:
            if picture.format not in ('PNG', 'JPEG', 'WEBP') or getattr(picture, 'n_frames', 1) != 1:
                raise ValueError()
            if picture.width * picture.height > 20_000_000:
                raise ValueError()
            picture.verify()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        raise fail(422, 'err.image_type')

def is_fixture(data: bytes) -> bool:
    return SAMPLE.exists() and hashlib.sha256(data).digest() == hashlib.sha256(SAMPLE.read_bytes()).digest()

@app.post('/api/extract')
async def extract(image: UploadFile):
    data = await image.read(provider.MAX_UPLOAD_BYTES + 1)
    await image.close()
    validate_image(data)
    if is_fixture(data):
        return {'source': 'fixture', 'fields': {**sample(), 'source': 'fixture'},
                'message': 'Known synthetic sample loaded. This is a fixture, not live AI extraction.'}
    return {'source': 'manual', 'fields': None,
            'message': 'Live screenshot reading is not connected yet. Enter the details below; your image was not saved.'}

@app.get('/api/extraction/status')
def extraction_status():
    return provider.status()

# Readings wait here, in memory only, until the person confirms a case. Nothing is persisted.
READINGS: dict[str, dict] = {}
READING_TTL = timedelta(hours=2)

def remember(reading: dict) -> str:
    now = utcnow()
    for key in [k for k, v in READINGS.items() if now - v['created'] > READING_TTL]:
        READINGS.pop(key, None)
    while len(READINGS) >= 50:
        READINGS.pop(next(iter(READINGS)))
    key = uuid4().hex
    READINGS[key] = {**reading, 'created': now}
    return key

def read_evidence(image: bytes | None, text: str, consent: bool, kind: str) -> dict:
    """Read one piece of evidence. Always returns a usable result; failure means manual entry."""
    if kind not in ev.KINDS:
        raise fail(422, 'err.kind')
    text = text.strip()
    if image is None and not text:
        raise fail(422, 'err.evidence_empty')
    if len(text) > provider.MAX_TEXT:
        raise fail(422, 'err.text_length')
    if any(ord(c) < 32 and c not in '\n\t\r' for c in text):
        raise fail(422, 'err.control')
    result = {'status': 'manual', 'source': None, 'facts': {}, 'notes': [], 'kind': kind,
              'text': text if image is None else '', 'provider': None}
    if image is not None:
        validate_image(image)
        if is_fixture(image):
            fields = sample()
            result.update(status='read', source='synthetic_fixture', notes=[msg('read.fixture')],
                          facts={f: {'value': fields[f], 'status': 'read', 'quote': '', 'quote_verified': None}
                                 for f in ev.FIELDS})
            return result
        if not provider.status()['enabled']:
            # Not set up: say so, rather than asking for consent that cannot be given.
            result.update(status='unavailable', notes=[msg('read.unavailable_setup'), msg('read.nothing_saved')])
            return result
        if not consent:
            result.update(status='needs_consent', notes=[msg('read.needs_consent')])
            return result
    elif not (consent and provider.status()['enabled']):
        # Pasted text can always be read by local rules, without sending it anywhere.
        quoted = parse_quoted(text)
        facts = {f: {'value': v, 'status': 'read', 'quote': q, 'quote_verified': True}
                 for f, (v, q) in quoted.items() if f in ev.FIELDS}
        result.update(status='read' if facts else 'manual', source='pasted_text', facts=facts,
                      notes=[msg('read.local_rules')])
        return result
    try:
        reading = provider.read(image=image, text=None if image is not None else text)
    except provider.ExtractionFailed as failure:
        result.update(status=failure.status, notes=[failure.message, msg('read.nothing_saved')])
        return result
    result.update(status='read' if reading['facts'] else 'manual', source='ai_provider',
                  facts=reading['facts'], notes=reading['notes'], provider={'name': provider.PROVIDER, 'model': provider.MODEL})
    return result

def fields_from(facts: dict) -> dict:
    """Prefill values for the intake form: only values actually read."""
    return {f: fact['value'] for f, fact in facts.items() if fact['status'] == 'read'}

def upload_bytes(image: UploadFile | None) -> bytes | None:
    if image is None:
        return None
    try:
        return image.file.read(provider.MAX_UPLOAD_BYTES + 1)
    finally:
        image.file.close()

@app.post('/api/evidence/read')
def read_for_intake(image: UploadFile | None = File(None), text: str = Form(''), consent: bool = Form(False),
                    kind: str = Form('screenshot')):
    result = read_evidence(upload_bytes(image), text, consent, kind)
    if result['facts']:
        result['reading_id'] = remember({k: result[k] for k in ('kind', 'source', 'facts', 'text', 'provider')})
    return {**result, 'fields': fields_from(result['facts'])}

@app.post('/api/cases/{case_id}/evidence/read', status_code=201)
def read_into_case(case_id: str, image: UploadFile | None = File(None), text: str = Form(''),
                   consent: bool = Form(False), kind: str = Form('screenshot')):
    get_case(case_id)
    result = read_evidence(upload_bytes(image), text, consent, kind)
    with editing(case_id) as case:
        if result['source'] and (result['facts'] or result['text']):
            if len(case['evidence']['items']) >= 20:
                raise UserError('err.evidence_limit')
            ev.new_item(case, kind, result['source'], result['facts'], result['text'], provider=result['provider'])
    return {'reading': result, 'case': decorate(case)}

@app.post('/api/cases', status_code=201)
def create_case(payload: CaseInput):
    case = payload.model_dump(mode='json', exclude={'reading_id'})
    case.update(id='RC-' + uuid4().hex[:12].upper(), created_at=utcnow().isoformat(), reports={},
                facts_version=1, corrections=[], evidence={'items': [], 'answers': {}, 'next': 1})
    store_transactions(case, transactions(case))
    reading = READINGS.get(payload.reading_id) if payload.reading_id else None
    if payload.reading_id and (not reading or utcnow() - reading['created'] > READING_TTL):
        raise fail(409, 'err.reading_expired')
    if reading:
        item = ev.new_item(case, reading['kind'], reading['source'], reading['facts'], reading['text'], provider=reading['provider'])
        ev.settle_with_intake(case, item['id'])
    with db() as connection:
        connection.execute('INSERT INTO cases VALUES (?,?)', (case['id'], json.dumps(case)))
    if payload.reading_id:
        READINGS.pop(payload.reading_id, None)
    return decorate(case)

@app.post('/api/extract-text')
def extract_text(payload: TextInput):
    return parse_text(payload.text)

@app.get('/api/cases')
def list_cases():
    with db() as connection:
        rows = connection.execute('SELECT data FROM cases ORDER BY rowid DESC LIMIT 100').fetchall()
    return [decorate(json.loads(row[0])) for row in rows]

@app.get('/api/cases/{case_id}')
def read_case(case_id: str):
    return decorate(get_case(case_id))

@app.put('/api/cases/{case_id}/reports/{channel}')
def save_report(case_id: str, channel: str, payload: ReportInput):
    if channel not in CHANNELS:
        raise fail(404, 'err.channel')
    # Read and update under a write transaction to prevent lost channel updates.
    with db() as connection:
        connection.execute('BEGIN IMMEDIATE')
        row = connection.execute('SELECT data FROM cases WHERE id=?', (case_id,)).fetchone()
        if not row:
            raise fail(404, 'err.case_missing')
        case = json.loads(row[0])
        if payload.reported_at < earliest_transaction(case):
            raise fail(422, 'err.report_before')
        previous = case['reports'].get(channel)
        case['reports'][channel] = {**payload.model_dump(mode='json'),
                                   'recorded_at': previous['recorded_at'] if previous else utcnow().isoformat(),
                                   'updated_at': utcnow().isoformat()}
        journey = case.setdefault('journey', {})
        if not previous:
            # A first report replaces any attempt state and its reminder.
            journey[channel] = {'state': 'waiting', 'remind_at': None}
        # A correction keeps the user's waiting/resolved choice and follow-up reminder.
        case.setdefault('journey_history', []).append({
            'channel': channel, 'state': 'report_updated' if previous else 'report_saved',
            'remind_at': None, 'recorded_at': utcnow().isoformat()})
        connection.execute('UPDATE cases SET data=? WHERE id=?', (json.dumps(case), case_id))
    return decorate(case)

@app.put('/api/cases/{case_id}/journey/{channel}')
def update_journey(case_id: str, channel: str, payload: JourneyInput):
    if channel not in CHANNELS:
        raise fail(404, 'err.channel')
    with db() as connection:
        connection.execute('BEGIN IMMEDIATE')
        row = connection.execute('SELECT data FROM cases WHERE id=?', (case_id,)).fetchone()
        if not row:
            raise fail(404, 'err.case_missing')
        case = json.loads(row[0])
        if payload.state in ('waiting', 'resolved') and channel not in case['reports']:
            raise fail(422, 'err.save_report_first')
        if payload.state in ('later', 'no_answer', 'not_started') and channel in case['reports']:
            raise fail(422, 'err.report_already')
        event = {**payload.model_dump(mode='json'), 'recorded_at': utcnow().isoformat()}
        case.setdefault('journey', {})[channel] = event
        case.setdefault('journey_history', []).append({'channel': channel, **event})
        connection.execute('UPDATE cases SET data=? WHERE id=?', (json.dumps(case), case_id))
    return decorate(case)

@contextmanager
def editing(case_id: str):
    """Read-modify-write one case under a write lock; domain errors become clear HTTP errors."""
    with db() as connection:
        connection.execute('BEGIN IMMEDIATE')
        row = connection.execute('SELECT data FROM cases WHERE id=?', (case_id,)).fetchone()
        if not row:
            raise fail(404, 'err.case_missing')
        case = json.loads(row[0])
        case.setdefault('evidence', {'items': [], 'answers': {}})
        previous_evidence = json.dumps(case['evidence'], sort_keys=True)
        previous_version = case.get('facts_version', 1)
        try:
            yield case
        except PermissionError as error:
            raise HTTPException(409, coded(error))
        except LookupError as error:
            raise HTTPException(404, coded(error))
        except ValueError as error:
            raise HTTPException(422, coded(error))
        # A review also depends on candidate evidence and answers. Invalidate old
        # confirmations even when the confirmed payment itself has not changed.
        if case.get('facts_version', 1) == previous_version and json.dumps(case['evidence'], sort_keys=True) != previous_evidence:
            case['facts_version'] = previous_version + 1
        connection.execute('UPDATE cases SET data=? WHERE id=?', (json.dumps(case), case_id))

@app.post('/api/cases/{case_id}/evidence', status_code=201)
def add_evidence(case_id: str, payload: ev.EvidenceInput):
    with editing(case_id) as case:
        if len(case['evidence']['items']) >= 20:
            raise UserError('err.evidence_limit')
        ev.add_evidence(case, payload)
    return decorate(case)

@app.post('/api/cases/{case_id}/evidence/practice/{scenario}', status_code=201)
def add_practice_evidence(case_id: str, scenario: str):
    with editing(case_id) as case:
        try:
            ev.add_practice(case, scenario)
        except KeyError:
            raise fail(404, 'err.practice_unknown')
    return decorate(case)

@app.delete('/api/cases/{case_id}/evidence/{evidence_id}')
def remove_evidence(case_id: str, evidence_id: str):
    # Removing evidence never removes a confirmed payment; it only drops its candidate facts.
    with editing(case_id) as case:
        items = case['evidence']['items']
        if not any(item['id'] == evidence_id for item in items):
            raise LookupError(UserError('err.evidence_missing'))
        case['evidence']['items'] = [item for item in items if item['id'] != evidence_id]
        case['evidence']['answers'].pop(f'place:{evidence_id}', None)
    return decorate(case)

@app.put('/api/cases/{case_id}/clarifications/{question_id}')
def answer_question(case_id: str, question_id: str, payload: ev.AnswerInput):
    with editing(case_id) as case:
        ev.record_answer(case, question_id, payload)
    return decorate(case)

@app.delete('/api/cases/{case_id}/clarifications/{question_id}')
def change_answer(case_id: str, question_id: str):
    with editing(case_id) as case:
        ev.forget_answer(case, question_id)
    return decorate(case)

@app.post('/api/cases/{case_id}/corrections')
def apply_corrections(case_id: str, payload: ev.ApplyInput):
    with editing(case_id) as case:
        ev.apply_changes(case, payload)
    return decorate(case)

@app.put('/api/cases/{case_id}/facts')
def correct_facts(case_id: str, payload: FactsCorrection):
    with editing(case_id) as case:
        ev.correct_facts(case, payload)
    return decorate(case)

@app.delete('/api/cases/{case_id}', status_code=204)
def delete_case(case_id: str):
    with db() as connection:
        connection.execute('PRAGMA secure_delete=ON')
        result = connection.execute('DELETE FROM cases WHERE id=?', (case_id,))
        if result.rowcount == 0:
            raise fail(404, 'err.case_missing')
    return Response(status_code=204)

@app.get('/api/cases/{case_id}/docs')
def case_documents(case_id: str):
    return documents(get_case(case_id))

@app.get('/api/cases/{case_id}/pack.pdf')
def case_pdf(case_id: str):
    case = get_case(case_id)
    try:
        data = pdf_pack(case)
    except ValueError as error:
        raise HTTPException(422, coded(error))
    return Response(data, media_type='application/pdf', headers={
        'Content-Disposition': f'attachment; filename="{case["id"]}-case-pack.pdf"'})

@app.get('/api/cases/{case_id}/export.json')
def export_case(case_id: str):
    case = decorate(get_case(case_id))
    return JSONResponse(case, headers={'Content-Disposition': f'attachment; filename="{case["id"]}.json"'})

DIST = ROOT / 'frontend' / 'dist'
if DIST.exists():
    app.mount('/assets', StaticFiles(directory=DIST / 'assets'), name='assets')
    @app.get('/{path:path}')
    def frontend(path: str):
        if path.startswith('api/'):
            raise fail(404, 'err.not_found')
        return FileResponse(DIST / 'index.html')
