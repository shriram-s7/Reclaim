from backend.app.extraction import parse_text

def test_text_extracts_exact_paise_and_reference():
    fields=parse_text('INR 18,000.01 debited via UPI. UTR: 701245678912. To demo@bank.\nBank: Fictional Bank')['fields']
    assert fields['amount_paise'] == 1800001
    assert fields['reference'] == '701245678912'
    assert fields['payee'] == 'demo@bank'
    assert fields['bank'] == 'Fictional Bank'
    assert 'occurred_at' not in fields

def test_ambiguous_amounts_are_not_guessed():
    fields=parse_text('INR 500 debited. INR 900 debited. UTR: 111111111111 UTR: 222222222222')['fields']
    assert 'amount_paise' not in fields
    assert 'reference' not in fields

def test_balance_is_not_loss():
    assert 'amount_paise' not in parse_text('Available balance INR 5000.00')['fields']

def test_no_fields_are_invented():
    assert parse_text('A caller asked for money. No reference available.')['fields'] == {}

def test_only_explicit_timezone_is_extracted():
    assert parse_text('On 2026-10-12T19:42:00+05:30')['fields']['occurred_at'] == '2026-10-12T19:42:00+05:30'
    assert 'occurred_at' not in parse_text('Yesterday at 8 pm')['fields']
