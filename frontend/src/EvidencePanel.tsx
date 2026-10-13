import {useEffect, useRef, useState} from 'react';
import {ArrowRight, Check, FileSearch, HelpCircle, Pencil, Plus, Trash2, Upload} from 'lucide-react';
import {api, fromInput, localInput, parsePaise, type Case, type Choice, type ProviderStatus, type Question, type Reading, type Source, type Transaction} from './api';
import {useI18n} from './i18n';

const kinds = ['receipt', 'bank_message', 'chat', 'screenshot', 'other'];
const methodKey = (method: string) => 'method.' + method.toLowerCase().replace(' ', '');
type Props = {c: Case; refresh: () => Promise<void>; notify: (text: string) => void};

/** Evidence checks are optional: reporting actions above never wait for them. */
export function EvidencePanel({c, refresh, notify}: Props) {
  const {t, m, money, date, errorText} = useI18n();
  const r = c.reconciliation;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true); setError(null);
    try {await action(); await refresh(); if (done) notify(t(done))} catch (e) {setError(e)} finally {setBusy(false)}
  }
  const question = r.questions[0];
  const ready = r.changes.filter(change => change.type === 'update' || change.complete);
  const shownValue = (field: string, value: string | number | null | undefined) => value === null || value === undefined || value === '' ? t('value.unknown')
    : field === 'amount_paise' ? money(Number(value)) : field === 'occurred_at' ? date(String(value)) : field === 'method' ? t(methodKey(String(value))) : String(value);
  const linkText = (link?: {status: string; payment?: string}) => !link ? '' : link.status === 'linked' ? t('evidence.link.linked', {payment: r.payment_names[link.payment || '']}) : t(`evidence.link.${link.status}`);
  const itemLabel = (item: {label: string; label_msg?: {key: string; params?: Record<string, unknown>}}) => item.label_msg ? m(item.label_msg) : item.label;
  return <section className="evidence-card" id="evidence" aria-labelledby="evidence-heading">
    <div className="draft-header"><span className="icon-box"><FileSearch size={21}/></span><div><h2 id="evidence-heading">{t('evidence.title')}</h2><p>{t('evidence.intro')}</p></div></div>
    {error ? <p className="error" role="alert">{errorText(error)}</p> : null}
    {question ? <QuestionCard key={question.id} q={question} index={1} total={r.questions.length} busy={busy}
        onAnswer={(choice, value) => run(() => api(`/cases/${c.id}/clarifications/${encodeURIComponent(question.id)}`, {method: 'PUT', body: JSON.stringify(value === undefined ? {choice} : {choice, value})}), '')}/>
      : r.changes.length > 0 ? <ChangesReview c={c} busy={busy} ready={ready.length} shownValue={shownValue}
        onApply={() => run(() => api(`/cases/${c.id}/corrections`, {method: 'POST', body: JSON.stringify({version: c.facts_version, confirmed: true})}), 'toast.corrected')}/>
      : c.evidence.items.length > 0 && <p className="calm-note" role="status"><Check size={16}/> {t('evidence.no_questions')}</p>}
    {r.unsure.length > 0 && <div className="unsure"><strong>{t('evidence.unsure_title')}</strong><ul>{r.unsure.map((u, i) => <li key={i}>{u.text_msg ? m(u.text_msg) : u.text}</li>)}</ul><p>{t('evidence.unsure_note')}</p></div>}
    <Payments items={c.transactions} total={c.total_paise}/>
    {c.evidence.items.length > 0 && <div className="evidence-list"><h3>{t('evidence.added')}</h3>{c.evidence.items.map(item => <article key={item.id} className="evidence-item">
      <div><strong>{itemLabel(item)}</strong><small>{t(`origin.${item.origin}`)}</small>
        <span className="link-status">{linkText(r.links[item.id])}</span>
        <ul>{Object.entries(item.facts).filter(([f]) => f !== 'method').map(([f, fact]) => <li key={f}>{t(`fieldtitle.${f}`)}: <strong>{fact.status === 'unreadable' ? t('value.unreadable') : shownValue(f, fact.value)}</strong>{fact.quote && <q>{fact.quote}</q>}</li>)}</ul></div>
      <button className="icon-button" disabled={busy} aria-label={t('evidence.remove', {label: itemLabel(item)})} onClick={() => run(() => api(`/cases/${c.id}/evidence/${item.id}`, {method: 'DELETE'}), 'toast.evidence_removed')}><Trash2 size={17}/></button></article>)}</div>}
    <AddEvidence c={c} busy={busy} setBusy={setBusy} refresh={refresh} notify={notify}/>
    <details className="demo-tools"><summary>{t('evidence.practice')}</summary><p className="small">{t('evidence.practice_note')}</p><div className="answer-options">
      {['amount-conflict', 'possible-duplicate', 'unreadable-reference'].map(key => <button key={key} className="button secondary" disabled={busy || c.evidence.items.length >= 18} onClick={() => run(() => api(`/cases/${c.id}/evidence/practice/${key}`, {method: 'POST'}), 'toast.practice_added')}>{t(`evidence.practice.${key}`)}</button>)}</div></details>
    {r.answered.length > 0 && <details className="demo-tools"><summary>{t('evidence.answers', {n: r.answered.length})}</summary><ul className="answer-list">{r.answered.map(q => <li key={q.id}><span>{m(q.text_msg)}</span><strong>{answerText(q)}</strong><button className="text-button" disabled={busy} onClick={() => run(() => api(`/cases/${c.id}/clarifications/${encodeURIComponent(q.id)}`, {method: 'DELETE'}), '')}>{t('evidence.change')}</button></li>)}</ul><p className="small">{t('evidence.change_note')}</p></details>}
    <CorrectDetails c={c} busy={busy} onSave={body => run(() => api(`/cases/${c.id}/facts`, {method: 'PUT', body: JSON.stringify(body)}), 'toast.details_corrected')}/>
    {c.corrections.length > 0 && <div className="history"><h3>{t('evidence.history')}</h3><ul>{c.corrections.slice().reverse().map(entry => <li key={entry.version}><small>{date(entry.at)}</small>
      {entry.changes.map((change, i) => <span key={i}>{change.label_msg ? m(change.label_msg) : change.label}: {change.field && 'after' in change
        ? <>{change.before !== null && change.before !== undefined && change.before !== '' ? `${shownValue(change.field, change.before)} → ` : ''}<strong>{shownValue(change.field, change.after)}</strong></>
        : <>{change.before_text ? `${change.before_text} → ` : ''}<strong>{change.after_text}</strong></>}</span>)}</li>)}</ul></div>}
    <p className="small"><HelpCircle size={14}/> {m(r.note_msg)}</p>
  </section>;

  function answerText(q: Question) {
    const a = q.answer; if (!a) return '';
    if (a.choice === 'value') {const picked = q.choices.find(choice => choice.value !== undefined && String(choice.value) === String(a.value)); return picked ? m(picked.label_msg) : t('choice.add')}
    if (a.choice === 'enter') return t('evidence.you_entered', {value: q.field ? shownValue(q.field, a.value ?? null) : String(a.value)});
    const picked = q.choices.find(choice => choice.id === a.choice); return picked ? m(picked.label_msg) : a.choice;
  }
}

function SourceLine({s}: {s: Source}) {
  const {t, m, money, date} = useI18n();
  const value = !s.field ? '' : s.unreadable ? t('value.unreadable') : s.field === 'amount_paise' ? money(Number(s.value)) : s.field === 'occurred_at' ? date(String(s.value)) : String(s.value ?? '');
  return <li><span>{s.label_msg ? m(s.label_msg) : s.label}{s.field ? ` · ${t(`field.${s.field}`)}: ${value}` : ''}</span><small>{s.origin_msg ? m(s.origin_msg) : s.origin}</small>
    {s.quote && <q>{s.quote}</q>}{s.quote && s.quote_verified === true && <small className="read-badge">{t('read.quote_verified')}</small>}
    {s.quote && !s.quote_verified && s.origin_msg?.key === 'origin.ai_provider' && <small className="read-badge">{t('read.quote_ai')}</small>}</li>;
}

function QuestionCard({q, index, total, busy, onAnswer}: {q: Question; index: number; total: number; busy: boolean; onAnswer: (choice: string, value?: string | number) => void}) {
  const {t, m} = useI18n();
  const [entering, setEntering] = useState<Choice | null>(null);
  const [text, setText] = useState('');
  const [problem, setProblem] = useState('');
  function submit(event: React.FormEvent) {
    event.preventDefault(); setProblem('');
    if (entering?.input === 'amount_paise') {const paise = parsePaise(text); if (paise === null) {setProblem('intake.err.amount'); return} onAnswer('enter', paise); return}
    if (entering?.input === 'occurred_at') {if (!text) {setProblem('evidence.choose_time'); return} onAnswer('enter', fromInput(text)); return}
    if (!text.trim()) {setProblem('evidence.type_or_unsure'); return}
    onAnswer('enter', text.trim());
  }
  const main = q.choices.filter(choice => choice.id !== 'later');
  const later = q.choices.find(choice => choice.id === 'later');
  return <div className="question-card" role="group" aria-labelledby={'q-' + q.id}>
    <span className="eyebrow">{t('evidence.question_n', {n: index, total})}</span>
    {q.deferred && <p className="small deferred">{t('evidence.deferred')}</p>}
    <h3 id={'q-' + q.id}>{m(q.text_msg)}</h3>{q.help_msg && <p>{m(q.help_msg)}</p>}
    <p className="why-line"><strong>{t('intake.why_label')}</strong> {m(q.why_msg)}</p>
    {(q.reason_msgs?.length ?? 0) > 0 && <div className="reasons-box"><span className="eyebrow">{t('evidence.reasons')}</span><ul className="reasons">{q.reason_msgs!.map((reason, i) => <li key={i}>{m(reason)}</li>)}</ul></div>}
    {q.sources.length > 0 && <div className="sources"><span className="eyebrow">{t('evidence.where_from')}</span><ul>{q.sources.map((s, i) => <SourceLine key={i} s={s}/>)}</ul></div>}
    {!entering ? <div className="choice-list">{main.map(choice => <button key={choice.id} className={'button ' + (choice.id === 'unknown' ? 'secondary quiet' : 'secondary')} disabled={busy}
        onClick={() => choice.input ? (setEntering(choice), setText('')) : onAnswer(choice.id)}>
        <span>{m(choice.label_msg)}</span>{choice.sources && <small>{t('evidence.from')} {choice.sources.map(s => (s.label_msg ? m(s.label_msg) : s.label) + (s.quote ? ` (“${s.quote}”)` : '')).join(' · ')}</small>}</button>)}
      {later && !q.deferred && <button className="text-button" disabled={busy} onClick={() => onAnswer('later')}>{m(later.label_msg)}</button>}</div>
    : <form onSubmit={submit} className="enter-form"><label>{t(`fieldtitle.${entering.input || 'reference'}`)}
        {entering.input === 'occurred_at' ? <input type="datetime-local" required value={text} max={localInput(new Date().toISOString())} onChange={e => setText(e.target.value)}/>
        : <input inputMode={entering.input === 'amount_paise' ? 'decimal' : 'text'} maxLength={entering.input === 'payee' ? 200 : 100} value={text} autoFocus onChange={e => setText(e.target.value)}
            placeholder={entering.input === 'amount_paise' ? t('intake.amount_ph') : t('evidence.exact_ph')}/>}</label>
      {problem && <p className="error" role="alert">{t(problem)}</p>}
      <div className="answer-options"><button className="button primary" disabled={busy}>{t('evidence.save_answer')} <ArrowRight size={16}/></button><button type="button" className="text-button" onClick={() => setEntering(null)}>{t('intake.back')}</button></div></form>}
  </div>;
}

function ChangesReview({c, busy, ready, shownValue, onApply}: {c: Case; busy: boolean; ready: number; shownValue: (field: string, value: string | number | null | undefined) => string; onApply: () => void}) {
  const {t, m, money, date} = useI18n();
  const [checked, setChecked] = useState(false);
  useEffect(() => setChecked(false), [c.facts_version, c.reconciliation.changes.length]);
  const summary = (tx: Partial<Transaction>) => [tx.amount_paise ? money(tx.amount_paise) : '', tx.occurred_at ? date(tx.occurred_at) : '', tx.reference, tx.payee].filter(Boolean).join(' · ');
  return <div className="question-card changes">
    <span className="eyebrow">{t('changes.eyebrow')}</span><h3>{t(c.reconciliation.changes.length === 1 ? 'changes.title_one' : 'changes.title_many')}</h3>
    <ul>{c.reconciliation.changes.map(change => <li key={change.id}>{change.type === 'update' ? <>{m(change.label_msg)}: {shownValue(change.field || '', change.before)} → <strong>{shownValue(change.field || '', change.after)}</strong></>
      : <>{m(change.label_msg)}: <strong>{summary(change.transaction || {}) || t('value.unknown')}</strong>{change.blocked_msg && <em> {m(change.blocked_msg)}</em>}</>}</li>)}</ul>
    {ready > 0 ? <><label className="confirm-box"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)}/><span>{t(ready === 1 ? 'changes.confirm_one' : 'changes.confirm_many')}</span></label>
      <button className="button primary" disabled={!checked || busy} onClick={onApply}>{t('changes.apply')} <Check size={17}/></button></>
    : <p>{t('changes.blocked')}</p>}
  </div>;
}

function Payments({items, total}: {items: Transaction[]; total: number}) {
  const {t, money, date} = useI18n();
  return <div className="payments"><h3>{t('payments.title')}</h3><ul>{items.map((tx, i) => <li key={tx.id}><span>{t('payment.n', {n: i + 1})}</span><strong>{money(tx.amount_paise)}</strong>
    <small>{date(tx.occurred_at)} · {t(methodKey(tx.method))} · {t('payments.ref', {reference: tx.reference || t('value.unknown')})}</small></li>)}</ul>
    {items.length > 1 && <p className="total">{t('payments.total')} <strong>{money(total)}</strong></p>}</div>;
}

type AddMode = 'image' | 'text' | 'typed';
function AddEvidence({c, busy, setBusy, refresh, notify}: {c: Case; busy: boolean; setBusy: (b: boolean) => void; refresh: () => Promise<void>; notify: (text: string) => void}) {
  const {t, m, errorText} = useI18n();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AddMode>('image');
  const [kind, setKind] = useState('bank_message');
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [consent, setConsent] = useState(false);
  const [amount, setAmount] = useState(''); const [when, setWhen] = useState('');
  const [reference, setReference] = useState(''); const [unreadable, setUnreadable] = useState(false); const [payee, setPayee] = useState('');
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [problem, setProblem] = useState<unknown>('');
  const [result, setResult] = useState<Reading | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => {if (open) api<ProviderStatus>('/extraction/status').then(setStatus).catch(() => setStatus(null))}, [open]);
  useEffect(() => () => abort.current?.abort(), []);
  const enabled = Boolean(status?.enabled);
  function reset() {setText(''); setFile(null); setAmount(''); setWhen(''); setReference(''); setUnreadable(false); setPayee(''); setConsent(false); setResult(null); setProblem(''); setOpen(false)}
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setProblem(''); setResult(null);
    if (mode === 'typed') {
      const typed: Record<string, string | number | boolean> = {};
      if (amount) {const paise = parsePaise(amount); if (paise === null) {setProblem('intake.err.amount'); return} typed.amount_paise = paise}
      if (when) typed.occurred_at = fromInput(when);
      if (unreadable) typed.reference_unreadable = true; else if (reference.trim()) typed.reference = reference.trim();
      if (payee.trim()) typed.payee = payee.trim();
      if (!Object.keys(typed).length) {setProblem('err.typed_empty'); return}
      setBusy(true);
      try {await api(`/cases/${c.id}/evidence`, {method: 'POST', body: JSON.stringify({kind, typed})}); await refresh(); notify(t('toast.evidence_added')); reset()}
      catch (e) {setProblem(e)} finally {setBusy(false)}
      return;
    }
    if (mode === 'image' && !file) {setProblem('read.choose_file_first'); return}
    if (mode === 'text' && !text.trim()) {setProblem('read.paste_first'); return}
    const form = new FormData(); form.append('kind', mode === 'image' ? 'screenshot' : kind); form.append('consent', String(enabled && consent));
    if (mode === 'image' && file) form.append('image', file); else form.append('text', text);
    abort.current = new AbortController(); setBusy(true);
    try {
      const response = await api<{reading: Reading}>(`/cases/${c.id}/evidence/read`, {method: 'POST', body: form, signal: abort.current.signal}, ((status?.timeout_seconds || 45) + 20) * 1000);
      await refresh();
      // Pasted text is kept even when nothing was found; a screenshot is only kept if something was read.
      if (response.reading.status === 'read' || (mode === 'text' && response.reading.source)) {notify(t('toast.evidence_added')); reset()}
      else setResult(response.reading);
    } catch (e) {setProblem(e)} finally {setBusy(false)}
  }
  const show = (p: unknown) => typeof p === 'string' ? (p ? t(p) : '') : errorText(p);
  if (!open) return <button className="button secondary" onClick={() => setOpen(true)}><Plus size={16}/> {t('evidence.add')}</button>;
  return <form className="add-evidence" onSubmit={submit}><h3>{t('evidence.add')}</h3>
    <div className="segmented" role="group" aria-label={t('evidence.add_how')}>{(['image', 'text', 'typed'] as AddMode[]).map(k => <button type="button" key={k} className={mode === k ? 'selected' : ''} aria-pressed={mode === k} onClick={() => {setMode(k); setProblem(''); setResult(null)}}>{t(`evidence.mode.${k}`)}</button>)}</div>
    {mode === 'image' ? <label className="upload-field"><span>{t('read.image_label')}</span><span className="upload-button"><Upload size={16}/> {file ? file.name : t('read.choose_image')}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setFile(e.target.files?.[0] || null)}/></span></label>
    : mode === 'text' ? <><label>{t('evidence.what_is_it')}<select value={kind} onChange={e => setKind(e.target.value)}>{kinds.map(k => <option key={k} value={k}>{t(`kindtitle.${k}`)}</option>)}</select></label>
        <label className="full-label">{t('read.text_label')}<textarea rows={3} maxLength={4000} value={text} onChange={e => setText(e.target.value)} placeholder={t('read.text_ph')}/></label></>
    : <><label>{t('evidence.what_is_it')}<select value={kind} onChange={e => setKind(e.target.value)}>{kinds.map(k => <option key={k} value={k}>{t(`kindtitle.${k}`)}</option>)}</select></label>
      <div className="fields-grid"><label>{t('evidence.amount_shown')} <span className="optional">{t('evidence.if_shown')}</span><input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder={t('intake.amount_ph')}/></label>
        <label>{t('evidence.time_shown')} <span className="optional">{t('evidence.if_shown')}</span><input type="datetime-local" value={when} min="2000-01-01T00:00" max={localInput(new Date().toISOString())} onChange={e => setWhen(e.target.value)}/></label>
        <label>{t('evidence.reference_shown')} <span className="optional">{t('evidence.if_readable')}</span><input maxLength={100} value={reference} disabled={unreadable} onChange={e => setReference(e.target.value)} placeholder={t('evidence.exact_ph')}/></label>
        <label>{t('evidence.payee_shown')} <span className="optional">{t('evidence.if_shown')}</span><input maxLength={200} value={payee} onChange={e => setPayee(e.target.value)}/></label>
        <label className="confirm-box"><input type="checkbox" checked={unreadable} onChange={e => {setUnreadable(e.target.checked); if (e.target.checked) setReference('')}}/><span>{t('evidence.ref_unreadable')}</span></label></div></>}
    {mode !== 'typed' && (enabled ? <label className="confirm-box"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}/><span>{mode === 'image' ? t('read.consent') : t('read.consent_text_optional')}</span></label>
      : <p className="small">{mode === 'image' ? t('read.not_setup_image') : t('read.local_text')}</p>)}
    {mode === 'typed' && <p className="small">{t('evidence.typed_note')}</p>}
    {show(problem) && <p className="error" role="alert">{show(problem)}</p>}
    {result && <div className="read-result" role="status"><strong>{t(`read.title.${result.status}`)}</strong>{result.notes.map((note, i) => <p key={i} className="small">{m(note)}</p>)}</div>}
    <div className="answer-options">{busy && mode !== 'typed' ? <><span role="status">{t('read.reading')}</span><button type="button" className="text-button" onClick={() => abort.current?.abort()}>{t('read.cancel')}</button></>
      : <><button className="button primary" disabled={busy}>{t('evidence.add_check')} <ArrowRight size={16}/></button><button type="button" className="text-button" onClick={reset}>{t('read.cancel')}</button></>}</div></form>;
}

function CorrectDetails({c, busy, onSave}: {c: Case; busy: boolean; onSave: (body: Record<string, unknown>) => Promise<void>}) {
  const {t, money} = useI18n();
  const [open, setOpen] = useState(false);
  const [paymentId, setPaymentId] = useState('T1');
  const payment = c.transactions.find(tx => tx.id === paymentId) || c.transactions[0];
  const initial = () => ({amount: String(payment.amount_paise / 100), when: localInput(payment.occurred_at), reference: payment.reference, payee: payment.payee, method: payment.method, bank: c.bank, description: c.description});
  const [form, setForm] = useState(initial);
  const [checked, setChecked] = useState(false); const [problem, setProblem] = useState('');
  useEffect(() => {setForm(initial()); setChecked(false)}, [paymentId, c.facts_version, open]);
  const set = (key: keyof ReturnType<typeof initial>) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {setForm(f => ({...f, [key]: e.target.value})); setChecked(false)};
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setProblem('');
    const body: Record<string, unknown> = {version: c.facts_version, confirmed: true, transaction_id: payment.id};
    const paise = parsePaise(form.amount); if (paise === null) {setProblem('intake.err.amount'); return}
    if (paise !== payment.amount_paise) body.amount_paise = paise;
    if (!form.when) {setProblem('intake.err.time_missing'); return}
    if (Math.floor(Date.parse(fromInput(form.when)) / 60000) !== Math.floor(Date.parse(payment.occurred_at) / 60000)) body.occurred_at = fromInput(form.when);
    if (form.reference.trim() !== payment.reference) body.reference = form.reference.trim();
    if (form.payee.trim() !== payment.payee) body.payee = form.payee.trim();
    if (form.method !== payment.method) body.method = form.method;
    if (form.bank.trim() !== c.bank) body.bank = form.bank.trim();
    if (form.description.trim() !== c.description) body.description = form.description.trim();
    if (Object.keys(body).length === 3) {setProblem('err.nothing_changed'); return}
    await onSave(body); setOpen(false);
  }
  if (!open) return <button className="text-button correct-link" onClick={() => setOpen(true)}><Pencil size={15}/> {t('correct.open')}</button>;
  return <form className="add-evidence" onSubmit={submit}><h3>{t('correct.open')}</h3><p className="small">{t('correct.note')}</p>
    {c.transactions.length > 1 && <label>{t('correct.which')}<select value={paymentId} onChange={e => setPaymentId(e.target.value)}>{c.transactions.map((tx, i) => <option key={tx.id} value={tx.id}>{t('payment.n', {n: i + 1})} · {money(tx.amount_paise)}</option>)}</select></label>}
    <div className="fields-grid"><label>{t('intake.amount')}<input inputMode="decimal" value={form.amount} onChange={set('amount')}/></label>
      <label>{t('intake.time')}<input type="datetime-local" required min="2000-01-01T00:00" max={localInput(new Date().toISOString())} value={form.when} onChange={set('when')}/></label>
      <label>{t('intake.reference')} <span className="optional">{t('correct.empty_unknown')}</span><input maxLength={100} value={form.reference} onChange={set('reference')}/></label>
      <label>{t('intake.payee')} <span className="optional">{t('correct.empty_unknown')}</span><input maxLength={200} value={form.payee} onChange={set('payee')}/></label>
      <label>{t('intake.method')}<select value={form.method} onChange={set('method')}>{['UPI', 'Card', 'Net banking', 'Other'].map(mt => <option key={mt} value={mt}>{t(methodKey(mt))}</option>)}</select></label>
      <label>{t('intake.bank')}<input maxLength={100} value={form.bank} onChange={set('bank')}/></label></div>
    <label className="full-label">{t('intake.description')}<textarea rows={3} maxLength={4000} value={form.description} onChange={set('description')}/></label>
    <label className="confirm-box"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)}/><span>{t('correct.confirm')}</span></label>
    {problem && <p className="error" role="alert">{t(problem)}</p>}
    <div className="answer-options"><button className="button primary" disabled={!checked || busy}>{t('correct.save')} <Check size={16}/></button><button type="button" className="text-button" onClick={() => setOpen(false)}>{t('read.cancel')}</button></div></form>;
}
