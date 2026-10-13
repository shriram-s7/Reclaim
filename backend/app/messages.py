"""User-facing messages as {key, params}. English text comes from the frontend catalog.

frontend/src/i18n/en.json is the single English source; ta.json mirrors its keys. The
backend sends both the English text (for logs, tests and fallbacks) and the key/params,
so the interface can show the person's chosen language. Parameter conventions (shared
with frontend/src/i18n): *_paise -> money, *_at -> IST date and time, field/kind/channel
-> translated names, dict {key, params} -> nested message, list -> messages joined by '; '.
"""
import json
from pathlib import Path
from .formats import money, shown_time

CATALOG = Path(__file__).resolve().parents[2] / 'frontend' / 'src' / 'i18n' / 'en.json'
EN: dict[str, str] = json.loads(CATALOG.read_text(encoding='utf-8'))

def msg(key: str, **params) -> dict:
    if key not in EN:
        raise KeyError(f'Missing English message: {key}')
    return {'key': key, 'params': params}

def _param(name: str, value, params: dict) -> str:
    if isinstance(value, dict) and 'key' in value:
        return render(value['key'], value.get('params', {}))
    if isinstance(value, list):
        return '; '.join(_param(name, v, params) for v in value)
    if value is None or value == '':
        return EN['value.unknown']
    if name.endswith('_paise'):
        return money(value)
    if name.endswith('_at'):
        return shown_time(value)
    if name in ('field', 'kind', 'channel'):
        return EN[f'{name}.{value}']
    if name == 'value':
        return _param(params.get('field', ''), value, {}) if params.get('field') in ('amount_paise', 'occurred_at') else str(value)
    return str(value)

def render(key: str, params: dict | None = None) -> str:
    params = params or {}
    return EN[key].format_map({name: _param(name, value, params) for name, value in params.items()})

def say(key: str, **params) -> str:
    return render(key, params)

def both(obj: dict, name: str, key: str, **params) -> dict:
    """Set obj[name] to English text and obj[name + '_msg'] to the translatable message."""
    obj[name] = render(key, params)
    obj[name + '_msg'] = msg(key, **params)
    return obj

class UserError(ValueError):
    """A validation problem the person can fix, carrying its message key."""
    def __init__(self, key: str, **params):
        self.key, self.params = key, params
        super().__init__(render(key, params))

def detail(error: Exception, fallback: str = 'err.invalid') -> dict:
    if isinstance(error, UserError):
        return {'message': str(error), 'code': error.key, 'params': error.params}
    return {'message': render(fallback), 'code': fallback, 'params': {}}
