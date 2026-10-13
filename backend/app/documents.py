from io import BytesIO
from pathlib import Path
import os
import reportlab
from xml.sax.saxutils import escape
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from .domain import money, shown_time, transactions
from .evidence import reconcile
from .messages import UserError

FONT_PATH = Path(os.environ.get('RECLAIM_PDF_FONT', str(Path(reportlab.__file__).parent / 'fonts' / 'Vera.ttf')))
pdfmetrics.registerFont(TTFont('ReclaimBodyFont', str(FONT_PATH)))

def payment_facts(case: dict) -> str:
    """Confirmed payments only. Evidence awaiting answers or confirmation is never included."""
    items = transactions(case)
    if len(items) == 1:
        t = items[0]
        return (f"Amount: {money(t['amount_paise'])}\n"
                f"Transaction time: {shown_time(t['occurred_at'])}\n"
                f"Bank: {case['bank']}\nMethod: {t['method']}\n"
                f"Transaction reference: {t['reference'] or 'Not provided'}\n"
                f"Recipient: {t['payee'] or 'Not provided'}")
    lines = [f"Bank: {case['bank']}", f'Payments ({len(items)}):']
    for n, t in enumerate(items, 1):
        lines.append(f"{n}. {money(t['amount_paise'])} on {shown_time(t['occurred_at'])} via {t['method']}; "
                     f"reference: {t['reference'] or 'Not provided'}; recipient: {t['payee'] or 'Not provided'}")
    lines.append(f"Total: {money(sum(t['amount_paise'] for t in items))}")
    return '\n'.join(lines)

def still_checking(case: dict) -> str:
    """Conflicts the person explicitly said they could not settle, stated as uncertainty."""
    notes = [u['text'] for u in reconcile(case)['unsure'] if u.get('conflict')]
    return ('\n\nDetails I am still checking:\n' + '\n'.join('- ' + n for n in notes)) if notes else ''

def documents(case: dict) -> dict:
    facts = payment_facts(case) + still_checking(case)
    total = sum(t['amount_paise'] for t in transactions(case))
    method = transactions(case)[0]['method']
    reports = '\n'.join(
        f"{channel.title()}: " + (
            f"reported by user at {shown_time(case['reports'][channel]['reported_at'])}; "
            f"reference: {case['reports'][channel]['reference'] or 'pending'}"
            if channel in case['reports'] else 'No report recorded in Reclaim')
        for channel in ('helpline', 'bank', 'portal'))
    narrative = case['description']
    return {
        'helpline': f'I want to report a suspected financial cyber fraud.\n\n{facts}\n\nWhat happened, in my words:\n{narrative}\n\nWhat immediate steps should I take? Kindly provide an acknowledgement and instructions for completing my complaint.',
        'portal': f'I am reporting a suspected financial cyber fraud.\n\n{facts}\n\nIncident description:\n{narrative}\n\nReporting record (as entered by me):\n{reports}\n\nI request investigation and assistance with tracing the transaction and preventing further loss. I will supply the evidence available to me through the official reporting channel.',
        'bank': f"Subject: Report of suspected {method} fraud - {money(total)}\n\nTo the Fraud / Grievance Desk, {case['bank']},\n\nI am reporting a suspected fraudulent transaction.\n\n{facts}\n\nWhat happened:\n{narrative}\n\n{reports}\n\nKindly register my complaint and provide its reference number. Take available steps to prevent further loss and investigate the transaction. Explain the applicable dispute process, documents required, and any liability or reimbursement decision in writing.\n\nI will provide identity verification directly through your official channel."
    }

def pdf_pack(case: dict) -> bytes:
    """Plain confirmed facts; escaped content, flowing layout, no fabricated attachments."""
    output = BytesIO()
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name='ReclaimBody', fontName='ReclaimBodyFont', fontSize=10,
                             leading=15, spaceAfter=10, alignment=TA_LEFT, wordWrap='CJK'))
    styles['Title'].textColor = colors.HexColor('#123E37')
    def para(text, style='ReclaimBody'):
        # Base PDF font: use INR and transliterate unsupported punctuation explicitly.
        clean = text.replace('₹', 'INR ').replace('—', '-').replace('’', "'")
        supported = pdfmetrics.getFont('ReclaimBodyFont').face.charToGlyph
        if any(ord(char) not in supported for char in clean if not char.isspace()):
            raise UserError('err.pdf_glyph')
        return Paragraph(escape(clean).replace('\n', '<br/>'), styles[style])
    story = [para('RECLAIM', 'Title'), para('Case preparation record', 'Heading2'),
             para(f"Case {case['id']} | Created {shown_time(case['created_at'])}"),
             para('LOCAL DEMONSTRATION - SYNTHETIC DATA ONLY'),
             para('These are drafts and user-entered reporting records, not proof of filing or a bank decision. Original evidence images are not included. Reclaim does not submit reports or guarantee recovery.')]
    for title, body in documents(case).items():
        story.extend([Spacer(1, 10), para({'helpline': '1930 call notes', 'portal': 'Portal complaint draft', 'bank': 'Bank letter draft'}[title], 'Heading2'), para(body)])
    if case.get('corrections'):
        story.extend([Spacer(1, 10), para('Corrections confirmed by the user', 'Heading2')])
        for entry in case['corrections']:
            changes = '; '.join(f"{c['label']}: {c.get('before_text') or 'added'} -> {c['after_text']}" for c in entry['changes'])
            story.append(para(f"Version {entry['version']}, {shown_time(entry['at'])} ({entry['source']}): {changes}"))
    story.append(para('Use official channels. Never share an OTP, PIN or password with Reclaim. Be wary of anyone promising recovery in exchange for a fee.'))
    def footer(canvas, doc):
        canvas.setFont('Helvetica', 8)
        canvas.setFillColor(colors.HexColor('#64756E'))
        canvas.drawString(42, 25, f"Reclaim | {case['id']} | Synthetic demo")
        canvas.drawRightString(553, 25, f'Page {doc.page}')
    SimpleDocTemplate(output, leftMargin=42, rightMargin=42, topMargin=38,
                      bottomMargin=42, title='Reclaim case pack').build(story, onFirstPage=footer, onLaterPages=footer)
    return output.getvalue()
