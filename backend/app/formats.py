"""Display formats shared by documents and messages."""
from datetime import datetime, timedelta, timezone

IST = timezone(timedelta(hours=5, minutes=30))

def shown_time(value: str) -> str:
    return datetime.fromisoformat(value).astimezone(IST).strftime('%d %b %Y, %I:%M %p IST')

def money(paise: int) -> str:
    return f'INR {paise // 100:,}.{paise % 100:02d}'
