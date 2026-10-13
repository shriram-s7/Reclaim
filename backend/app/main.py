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

from fastapi import FastAPI, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from PIL import Image, UnidentifiedImageError
from starlette.middleware.trustedhost import TrustedHostMiddleware
from .domain import CaseInput, ReportInput, CHANNELS, decorate, utcnow
from .documents import documents, pdf_pack
from .extraction import TextInput, parse_text
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
            return JSONResponse({'detail': 'This demo accepts local requests only.'}, status_code=403)
    response = await call_next(request)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Referrer-Policy'] = 'no-referrer'
    response.headers['Cache-Control'] = 'no-store'
    response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; frame-src 'self'; frame-ancestors 'self'; object-src 'none'; base-uri 'self'"
    return response

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
        raise HTTPException(404, 'Case not found. It may have been deleted.')
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

@app.post('/api/extract')
async def extract(image: UploadFile):
    data = await image.read(10 * 1024 * 1024 + 1)
    await image.close()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(413, 'Image must be 10 MB or smaller.')
    try:
        with Image.open(BytesIO(data)) as picture:
            if picture.format not in ('PNG', 'JPEG', 'WEBP') or getattr(picture, 'n_frames', 1) != 1:
                raise ValueError()
            if picture.width * picture.height > 20_000_000:
                raise ValueError()
            picture.verify()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        raise HTTPException(422, 'Use a static PNG, JPEG or WebP image under 20 megapixels.')
    if SAMPLE.exists() and hashlib.sha256(data).digest() == hashlib.sha256(SAMPLE.read_bytes()).digest():
        return {'source': 'fixture', 'fields': {**sample(), 'source': 'fixture'},
                'message': 'Known synthetic sample loaded. This is a fixture, not live AI extraction.'}
    return {'source': 'manual', 'fields': None,
            'message': 'Live screenshot reading is not connected yet. Enter the details below; your image was not saved.'}

@app.post('/api/cases', status_code=201)
def create_case(payload: CaseInput):
    case = payload.model_dump(mode='json')
    case.update(id='RC-' + uuid4().hex[:12].upper(), created_at=utcnow().isoformat(), reports={})
    with db() as connection:
        connection.execute('INSERT INTO cases VALUES (?,?)', (case['id'], json.dumps(case)))
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
        raise HTTPException(404, 'Unknown reporting channel.')
    # Read and update under a write transaction to prevent lost channel updates.
    with db() as connection:
        connection.execute('BEGIN IMMEDIATE')
        row = connection.execute('SELECT data FROM cases WHERE id=?', (case_id,)).fetchone()
        if not row:
            raise HTTPException(404, 'Case not found.')
        case = json.loads(row[0])
        from datetime import datetime
        if payload.reported_at < datetime.fromisoformat(case['occurred_at']):
            raise HTTPException(422, 'Report time cannot be before the transaction.')
        previous = case['reports'].get(channel)
        case['reports'][channel] = {**payload.model_dump(mode='json'),
                                   'recorded_at': previous['recorded_at'] if previous else utcnow().isoformat(),
                                   'updated_at': utcnow().isoformat()}
        case.setdefault('journey', {})[channel] = {'state': 'waiting', 'remind_at': None}
        connection.execute('UPDATE cases SET data=? WHERE id=?', (json.dumps(case), case_id))
    return decorate(case)

@app.put('/api/cases/{case_id}/journey/{channel}')
def update_journey(case_id: str, channel: str, payload: JourneyInput):
    if channel not in CHANNELS:
        raise HTTPException(404, 'Unknown reporting channel.')
    with db() as connection:
        connection.execute('BEGIN IMMEDIATE')
        row = connection.execute('SELECT data FROM cases WHERE id=?', (case_id,)).fetchone()
        if not row:
            raise HTTPException(404, 'Case not found.')
        case = json.loads(row[0])
        if payload.state in ('waiting', 'resolved') and channel not in case['reports']:
            raise HTTPException(422, 'Save the actual reporting details before marking this as waiting or resolved.')
        if payload.state in ('later', 'no_answer', 'not_started') and channel in case['reports']:
            raise HTTPException(422, 'A report is already saved. Use waiting or resolved for its follow-up.')
        event = {**payload.model_dump(mode='json'), 'recorded_at': utcnow().isoformat()}
        case.setdefault('journey', {})[channel] = event
        case.setdefault('journey_history', []).append({'channel': channel, **event})
        connection.execute('UPDATE cases SET data=? WHERE id=?', (json.dumps(case), case_id))
    return decorate(case)

@app.delete('/api/cases/{case_id}', status_code=204)
def delete_case(case_id: str):
    with db() as connection:
        connection.execute('PRAGMA secure_delete=ON')
        result = connection.execute('DELETE FROM cases WHERE id=?', (case_id,))
        if result.rowcount == 0:
            raise HTTPException(404, 'Case not found.')
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
        raise HTTPException(422, str(error))
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
            raise HTTPException(404)
        return FileResponse(DIST / 'index.html')
