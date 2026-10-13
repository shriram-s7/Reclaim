"""Evaluate evidence reading on the held-out synthetic set (samples/heldout).

Usage (from D:/RECLAIM):  .venv/Scripts/python.exe -m scripts.eval_extraction [--provider]

Local text rules are always evaluated. The AI provider is evaluated only with --provider
and a working configuration, because it sends the synthetic files to Anthropic and costs
money. Without it, provider rows are recorded as "not run" with the missing configuration.
The known demo fixture is excluded; this script refuses to run if any held-out image
matches it. Results go to docs/evaluation/extraction-results.{json,md}.
"""
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from backend.app import provider  # noqa: E402
from backend.app.extraction import parse_quoted  # noqa: E402

HELDOUT = ROOT / 'samples' / 'heldout'
FIXTURE = ROOT / 'samples' / 'synthetic-payment.png'
OUT = ROOT / 'docs' / 'evaluation'
FIELDS = ('amount_paise', 'occurred_at', 'reference', 'payee')

def outcome(expected, got) -> str:
    """correct | correct_unknown | wrong (a different value: the dangerous case) | missed | invented"""
    if expected is None:
        return 'correct_unknown' if got is None else 'invented'
    if got is None:
        return 'missed'
    if isinstance(expected, str) and 'T' in expected and isinstance(got, str):
        return 'correct' if datetime.fromisoformat(expected) == datetime.fromisoformat(got) else 'wrong'
    return 'correct' if expected == got else 'wrong'

def score(expected: dict, facts: dict) -> dict:
    got = {f: (facts.get(f) or {}).get('value') for f in FIELDS}
    return {f: {'expected': expected[f], 'got': got[f], 'outcome': outcome(expected[f], got[f])} for f in FIELDS}

def local_rules(text: str) -> dict:
    return {f: {'value': v} for f, (v, _) in parse_quoted(text).items() if f in FIELDS}

def tally(rows: list[dict]) -> dict:
    counts = {}
    for row in rows:
        for field in row.get('fields', {}).values():
            counts[field['outcome']] = counts.get(field['outcome'], 0) + 1
    return counts

def main(use_provider: bool) -> None:
    truth = json.loads((HELDOUT / 'truth.json').read_text(encoding='utf-8'))
    fixture_hash = hashlib.sha256(FIXTURE.read_bytes()).hexdigest()
    for name in truth['images']:
        if hashlib.sha256((HELDOUT / name).read_bytes()).hexdigest() == fixture_hash:
            raise SystemExit(f'{name} matches the demo fixture; it cannot be used as held-out data.')
    state = provider.status()
    run_provider = use_provider and state['enabled']
    reason = None if run_provider else ('--provider flag not given' if state['enabled'] else
                                        'missing configuration: ' + ', '.join(state['missing']))
    results = {'date': datetime.now(timezone.utc).isoformat(), 'model': provider.MODEL,
               'set': {'images': len(truth['images']), 'texts': len(truth['texts'])},
               'local_rules_texts': [], 'provider_texts': [], 'provider_images': [], 'provider_not_run_reason': reason}
    for name, case in truth['texts'].items():
        results['local_rules_texts'].append({'case': name, 'fields': score(case['expected'], local_rules(case['text']))})
    if run_provider:
        for name, case in truth['texts'].items():
            results['provider_texts'].append(run_case(name, case['expected'], text=case['text']))
        for name, expected in truth['images'].items():
            results['provider_images'].append(run_case(name, expected, image=(HELDOUT / name).read_bytes()))
    for key in ('local_rules_texts', 'provider_texts', 'provider_images'):
        results[key + '_totals'] = tally(results[key])
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'extraction-results.json').write_text(json.dumps(results, indent=1, ensure_ascii=False), encoding='utf-8')
    (OUT / 'extraction-results.md').write_text(report(results), encoding='utf-8')
    print(report(results))

def run_case(name: str, expected: dict, image: bytes | None = None, text: str | None = None) -> dict:
    try:
        reading = provider.read(image=image, text=text)
        return {'case': name, 'fields': score(expected, reading['facts'])}
    except provider.ExtractionFailed as failure:
        return {'case': name, 'failure': f'{failure.status}: {failure.reason}'}

def report(results: dict) -> str:
    lines = ['# Held-out extraction results', '',
             f"Run: {results['date']}. Synthetic held-out set: {results['set']['images']} images, "
             f"{results['set']['texts']} texts (samples/heldout). The demo fixture is excluded.",
             'Outcomes per field: correct, correct_unknown (correctly left empty), wrong (a different value: '
             'the dangerous case), missed (left empty although readable), invented (a value where none is readable).',
             'Ten images and six texts is a smoke test, not an accuracy measurement.', '']
    def table(title, rows):
        lines.extend([f'## {title}', '', '| Case | Amount | Time | Reference | Recipient |', '|---|---|---|---|---|'])
        for row in rows:
            if 'failure' in row:
                lines.append(f"| {row['case']} | failed: {row['failure']} | | | |")
            else:
                lines.append(f"| {row['case']} | " + ' | '.join(row['fields'][f]['outcome'] for f in FIELDS) + ' |')
        lines.append('')
    table('Local text rules (no AI) on held-out texts', results['local_rules_texts'])
    lines.append(f"Totals: {results['local_rules_texts_totals']}")
    lines.append('')
    if results['provider_not_run_reason']:
        lines.extend(['## AI provider (Anthropic)', '', f"**Not run** - {results['provider_not_run_reason']}. "
                      'No live extraction result exists for this set.', ''])
    else:
        table(f"AI provider ({results['model']}) on held-out texts", results['provider_texts'])
        lines.append(f"Totals: {results['provider_texts_totals']}")
        table(f"AI provider ({results['model']}) on held-out images", results['provider_images'])
        lines.append(f"Totals: {results['provider_images_totals']}")
    return '\n'.join(lines) + '\n'

if __name__ == '__main__':
    main('--provider' in sys.argv)
