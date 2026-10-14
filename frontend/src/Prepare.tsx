import {useEffect, useRef, useState} from 'react';
import {AlertCircle, ArrowRight, Check, ChevronLeft, Download, FileText, LockKeyhole, Phone, Plus, ShieldCheck, Upload} from 'lucide-react';
import {api, fromInput, localInput, parsePaise, type Case, type Fact, type Facts, type ProviderStatus, type Reading} from './api';
import {ApiError, useI18n, type Msg} from './i18n';
import {go} from './nav';

const emptyFacts = (): Facts => ({amount_paise: 0, occurred_at: '', bank: '', method: 'Other', reference: '', payee: '', description: '', source: 'manual'});
const methods: Facts['method'][] = ['UPI', 'Card', 'Net banking', 'Other'];
const methodKey = (m: string) => 'method.' + m.toLowerCase().replace(' ', '');
const sourceFor = {ai_provider: 'ai_provider', pasted_text: 'text', synthetic_fixture: 'fixture'} as const;
const STEP_FIELDS: Record<number, (keyof Facts)[]> = {1: ['amount_paise', 'occurred_at'], 3: ['reference', 'payee']};

// Unsaved intake answers live in this tab only, so Back, reload and phone back keep them.
const DRAFT_KEY = 'reclaim-intake-draft';
type Draft = {facts: Facts; amount: string; readFacts?: Record<string, Fact>; readingId?: string; readSource?: Reading['source']};
function readDraft(): Draft | null {try {const value = sessionStorage.getItem(DRAFT_KEY); return value ? JSON.parse(value) : null} catch {return null}}

/** A problem with one step, as a message key; '' when the step is fine. */
function stepProblem(step: number, facts: Facts, amount: string): string {
  if (step === 1) {
    const paise = parsePaise(amount);
    if (paise === null) return 'intake.err.amount';
    if (paise > 1_000_000_000) return 'intake.err.amount_max';
    if (!facts.occurred_at) return 'intake.err.time_missing';
    const when = new Date(facts.occurred_at);
    if (isNaN(when.getTime()) || when.getFullYear() < 2000) return 'err.year';
    if (when > new Date()) return 'err.future';
  }
  if (step === 2 && (!/[A-Za-z஀-௿]/.test(facts.bank) || facts.bank.trim().length < 2)) return 'err.bank_number';
  if (step === 4 && facts.description.trim().length < 10) return 'intake.err.description';
  return '';
}

export function Prepare({notify}: {notify: (text: string) => void}) {
  const {t, money, date, errorText} = useI18n();
  const [draft] = useState(readDraft);
  const [facts, setFacts] = useState<Facts>(() => draft?.facts || emptyFacts());
  const [amount, setAmount] = useState(draft?.amount || '');
  const [readFacts, setReadFacts] = useState<Record<string, Fact>>(draft?.readFacts || {});
  const [readingId, setReadingId] = useState(draft?.readingId);
  const [readSource, setReadSource] = useState<Reading['source']>(draft?.readSource || null);
  const [step, setStep] = useState(() => {const saved = Number(history.state?.intakeStep); return draft && saved >= 0 && saved <= 5 ? saved : 0});
  const [editing, setEditing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>('');
  const readingExpired = error instanceof ApiError && error.problems.some(p => p.code === 'err.reading_expired');
  const hasAnswers = Boolean(amount || facts.occurred_at || facts.bank || facts.reference || facts.payee || facts.description);
  useEffect(() => {if (hasAnswers) sessionStorage.setItem(DRAFT_KEY, JSON.stringify({facts, amount, readFacts, readingId, readSource}))}, [facts, amount, readFacts, readingId, readSource, hasAnswers]);
  // Browser and phone Back move between intake steps instead of leaving the form.
  useEffect(() => {
    const onPop = () => {
      if (location.pathname !== '/prepare') return;
      const wanted = Number(history.state?.intakeStep) || 0;
      let allowed = wanted;
      for (let s = 1; s < wanted; s++) {if (stepProblem(s, facts, amount)) {allowed = s; break}}
      if (allowed !== wanted) history.replaceState({intakeStep: allowed}, '', location.pathname);
      setStep(allowed); setEditing(false); setError(allowed !== wanted ? stepProblem(allowed, facts, amount) : ''); setConfirmed(false); window.scrollTo(0, 0);
    };
    addEventListener('popstate', onPop); return () => removeEventListener('popstate', onPop);
  }, [facts, amount]);
  const show = (problem: unknown) => typeof problem === 'string' ? (problem ? t(problem) : '') : errorText(problem);
  function goStep(next: number) {history.pushState({intakeStep: next}, '', location.pathname); setStep(next); setEditing(false); setConfirmed(false); setError(''); window.scrollTo(0, 0)}
  function back() {setError(''); if (step > 0 && Number(history.state?.intakeStep) === step) history.back(); else if (step > 0) setStep(step - 1); else go('/')}
  function startOver() {sessionStorage.removeItem(DRAFT_KEY); setFacts(emptyFacts()); setAmount(''); setReadFacts({}); setReadingId(undefined); setReadSource(null); setConfirmed(false); setError(''); history.replaceState({intakeStep: 0}, '', location.pathname); setStep(0)}
  function update<K extends keyof Facts>(key: K, value: Facts[K]) {setFacts(prev => ({...prev, [key]: value})); setConfirmed(false)}
  async function loadSample() {setBusy(true); setError(''); try {const value = await api<Facts>('/sample'); setFacts(value); setAmount((value.amount_paise / 100).toString()); setReadFacts({}); setReadingId(undefined); goStep(1)} catch (e) {setError(e)} finally {setBusy(false)}}
  function useReading(reading: Reading) {
    const fields = reading.fields;
    setFacts(prev => ({...prev, ...fields, source: reading.source ? sourceFor[reading.source] : prev.source}));
    if (fields.amount_paise) setAmount(String(fields.amount_paise / 100));
    setReadFacts(reading.facts); setReadingId(reading.reading_id); setReadSource(reading.source);
    goStep(1);
  }
  function review(event?: {preventDefault(): void}) {
    event?.preventDefault(); setError('');
    for (let s = 1; s <= step; s++) {const problem = stepProblem(s, facts, amount); if (problem) {setError(problem); return}}
    setFacts(prev => ({...prev, amount_paise: parsePaise(amount)!})); goStep(step + 1);
  }
  async function create() {
    setError('');
    for (let s = 1; s <= 4; s++) {const problem = stepProblem(s, facts, amount); if (problem) {setError(problem); return}}
    setBusy(true);
    try {
      const body = {...facts, amount_paise: parsePaise(amount), confirmed, ...(readingId ? {reading_id: readingId} : {})};
      const c = await api<Case>('/cases', {method: 'POST', body: JSON.stringify(body)});
      localStorage.setItem('reclaim-case', c.id); sessionStorage.removeItem(DRAFT_KEY); notify(t('toast.case_saved')); go('/case/' + c.id);
    } catch (e) {setError(e)} finally {setBusy(false)}
  }
  function chooseDescription(text: string) {const current = facts.description.trim(); update('description', !current || current === text ? text : current.includes(text) ? current : text + ' ' + current)}
  const reviewPaise = parsePaise(amount) ?? facts.amount_paise;
  const currentValue = (field: string) => field === 'amount_paise' ? parsePaise(amount) : facts[field as keyof Facts];
  const readUnchanged = (field: string) => readFacts[field]?.status === 'read' && String(readFacts[field].value) === String(currentValue(field));
  const fullyRead = STEP_FIELDS[step]?.every(readUnchanged) && !editing;
  function badge(field: string) {
    const fact = readFacts[field];
    if (!fact) return null;
    if (fact.status === 'unreadable') return <small className="read-badge unreadable">{t('intake.read_unreadable')}</small>;
    if (readUnchanged(field)) return <small className="read-badge">{fact.quote ? t('intake.read_badge', {quote: fact.quote}) : t('intake.read_badge_noquote')}</small>;
    return <small className="read-badge changed">{t('intake.read_changed', {field, value: fact.value})}</small>;
  }
  const stepTitle = step === 5 ? 'intake.step5' : `intake.step${step}`;
  return <div className="inner-page page-enter">
    <div className="intake-nav"><button className="back-link" onClick={back}><ChevronLeft size={17}/>{step > 0 ? t('intake.back') : t('intake.back_home')}</button>{hasAnswers && <button className="text-button" onClick={startOver}>{t('intake.clear')}</button>}</div>
    {draft && step <= 1 && hasAnswers && <p className="source-note" role="status">{t('intake.kept')}</p>}
    <div className="section-heading"><div><span className="eyebrow">{t('intake.eyebrow')}</span><h1 className="page-title">{t(stepTitle + '.title')}</h1><p className="muted">{t(stepTitle + '.sub')}</p></div>
      <span className="step-counter">{step === 0 ? t('intake.before_start') : t('intake.counter', {n: step})}</span></div>
    <div className="compact-urgent"><Phone size={17}/> {t('intake.urgent')} <a href="tel:1930">{t('urgent.call_short')}</a></div>
    {show(error) && <div className="error" role="alert"><AlertCircle size={18}/>{show(error)}</div>}
    {readingExpired && <div className="answer-options">
      <button className="button primary" onClick={() => goStep(0)}>{t('intake.read_again')}</button>
      <button className="button secondary" onClick={() => {setReadingId(undefined); setReadFacts({}); setReadSource(null); setFacts(prev => ({...prev, source: 'manual'})); setConfirmed(false); setError('');}}>{t('intake.keep_typed')}</button>
    </div>}
    <div className="prepare-grid"><section className="form-card">
      {step === 0 ? <ReadEvidence busy={busy} onUse={useReading} onSkip={() => goStep(1)} onSample={loadSample}/> : step < 5 ? <>
        <div className="form-card-heading"><span className="icon-box"><FileText size={20}/></span><div><h2>{step === 1 ? t('intake.card.payment') : t('intake.card.incident')}</h2><p>{step === 1 ? t('intake.card.payment_sub') : t('intake.card.incident_sub')}</p></div></div>
        <p className="why-line"><strong>{t('intake.why_label')}</strong> {t(`intake.step${step}.why`)}</p>
        {fullyRead ? <div className="read-confirm">
          <h3>{t('intake.confirm_read.title')}</h3>
          <dl className="fact-list">{STEP_FIELDS[step].map(field => <div key={field}><dt>{t(`fieldtitle.${field}`)}</dt><dd>{field === 'amount_paise' ? money(reviewPaise) : field === 'occurred_at' ? date(facts.occurred_at) : String(facts[field])}{badge(field)}</dd></div>)}</dl>
          <div className="answer-options"><button className="button primary" onClick={() => review()}>{t('intake.confirm_read.yes')} <Check size={17}/></button><button className="button secondary" onClick={() => setEditing(true)}>{t('intake.confirm_read.change')}</button></div>
        </div> :
        <form onSubmit={review}>{step === 1 ? <div className="fields-grid">
            <label>{t('intake.amount')}<input required inputMode="decimal" value={amount} placeholder={t('intake.amount_ph')} onChange={e => {setAmount(e.target.value); setConfirmed(false)}}/>{badge('amount_paise')}</label>
            <label>{t('intake.time')}<input required type="datetime-local" min="2000-01-01T00:00" max={localInput(new Date().toISOString())} value={facts.occurred_at ? localInput(facts.occurred_at) : ''} onChange={e => update('occurred_at', e.target.value ? fromInput(e.target.value) : '')}/>{badge('occurred_at') || <small className="field-hint">{t('intake.time_hint')}</small>}</label>
          </div> : step === 2 ? <div className="fields-grid"><label>{t('intake.bank')}<input required minLength={2} maxLength={100} value={facts.bank} placeholder={t('intake.bank_ph')} onChange={e => update('bank', e.target.value)}/></label>
            <label>{t('intake.method')}<select value={facts.method} onChange={e => update('method', e.target.value as Facts['method'])}>{methods.map(m => <option key={m} value={m}>{t(methodKey(m))}</option>)}</select></label>
          </div> : step === 3 ? <><div className="fields-grid"><label>{t('intake.reference')} <span className="optional">{t('intake.optional')}</span><input maxLength={100} value={facts.reference} placeholder={t('intake.reference_ph')} onChange={e => update('reference', e.target.value)}/>{badge('reference')}</label>
            <label>{t('intake.payee')} <span className="optional">{t('intake.optional')}</span><input maxLength={200} value={facts.payee} placeholder={t('intake.payee_ph')} onChange={e => update('payee', e.target.value)}/>{badge('payee')}</label></div>
            <button type="button" className="text-button" onClick={() => {update('reference', ''); update('payee', ''); goStep(4)}}>{t('intake.skip_optional')}</button></>
          : <><div className="answer-options">{['caller', 'not_arrived', 'unrecognised', 'job'].map(key => <button type="button" className="button secondary" key={key} onClick={() => chooseDescription(t(`intake.desc.${key}`))}>{t(`intake.desc.${key}`)}</button>)}</div>
            <label className="full-label">{t('intake.description')}<textarea required minLength={10} maxLength={4000} rows={4} value={facts.description} placeholder={t('intake.description_ph')} onChange={e => update('description', e.target.value)}/></label></>}
          <div className="form-bottom"><span><LockKeyhole size={14}/> {t('intake.saved_on_confirm')}</span><button className="button primary" disabled={busy}>{step < 4 ? t('intake.continue') : t('intake.check')} <ArrowRight size={17}/></button></div></form>}</>
      : <ReviewStep facts={facts} reviewPaise={reviewPaise} readFacts={readFacts} readSource={readSource} confirmed={confirmed} setConfirmed={setConfirmed} busy={busy} onCreate={create}/>}
    </section><aside className="help-card"><span className="icon-box light"><ShieldCheck size={22}/></span><h3>{t('help.title')}</h3><p>{t('help.text')}</p><div className="divider"/><strong>{t('help.missing_title')}</strong><p>{t('help.missing_text')}</p><strong>{t('help.keep_title')}</strong><p>{t('help.keep_text')}</p><a className="text-button" href="/api/sample/image" download>{t('help.download_sample')} <Download size={15}/></a><div className="help-foot"><LockKeyhole size={16}/> {t('help.never')}</div></aside></div>
  </div>;
}

function ReviewStep({facts, reviewPaise, readFacts, readSource, confirmed, setConfirmed, busy, onCreate}: {facts: Facts; reviewPaise: number; readFacts: Record<string, Fact>; readSource: Reading['source']; confirmed: boolean; setConfirmed: (v: boolean) => void; busy: boolean; onCreate: () => void}) {
  const {t, money, date} = useI18n();
  const entered: Record<string, unknown> = {amount_paise: reviewPaise, occurred_at: facts.occurred_at, reference: facts.reference, payee: facts.payee};
  const changed = Object.entries(readFacts).filter(([field, fact]) => fact.status === 'read' && field in entered && String(fact.value) !== String(entered[field]) &&
    !(field === 'occurred_at' && Math.abs(Date.parse(String(fact.value)) - Date.parse(facts.occurred_at)) < 60000));
  return <>
    <div className="review-amount"><span>{t('review.amount')}</span><strong>{money(reviewPaise)}</strong><span>{t(methodKey(facts.method))} · {facts.bank}</span></div>
    <dl className="fact-list">{[['review.time', date(facts.occurred_at)], ['review.reference', facts.reference || t('review.not_provided')], ['review.payee', facts.payee || t('review.not_provided')], ['review.source', t(`source.${facts.source}`)]].map(([key, value]) => <div key={key}><dt>{t(key)}</dt><dd>{value}</dd></div>)}</dl>
    {readSource && changed.map(([field, fact]) => <p className="missing-note" key={field}>{t('review.changed', {field, value: fact.value})}</p>)}
    {facts.method === 'UPI' && facts.reference && !/^\d{12}$/.test(facts.reference) && <p className="missing-note">{t('review.ref_shape')}</p>}
    {reviewPaise >= 10000000 && <p className="missing-note">{t('review.zeros', {amount_paise: reviewPaise})}</p>}
    {Date.now() - new Date(facts.occurred_at).getTime() > 365 * 86400000 && <p className="missing-note">{t('review.old')}</p>}
    <h3>{t('review.description')}</h3><p className="description-review">{facts.description}</p>
    <label className="confirm-box"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/><span>{t('review.confirm')}</span></label>
    <button className="button primary wide" disabled={!confirmed || busy} onClick={onCreate}>{busy ? t('review.saving') : t('review.go')}<ArrowRight size={17}/></button>
  </>;
}

/** Optional first step: read a screenshot or message. Never required to continue. */
function ReadEvidence({busy, onUse, onSkip, onSample}: {busy: boolean; onUse: (reading: Reading) => void; onSkip: () => void; onSample: () => void}) {
  const {t, m, money, date, errorText} = useI18n();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<'screenshot' | 'text'>('screenshot');
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [reading, setReading] = useState<Reading | null>(null);
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState<unknown>('');
  const abort = useRef<AbortController | null>(null);
  useEffect(() => {api<ProviderStatus>('/extraction/status').then(setStatus).catch(() => setStatus(null))}, []);
  useEffect(() => () => abort.current?.abort(), []);
  const enabled = Boolean(status?.enabled);
  async function read(event: React.FormEvent) {
    event.preventDefault(); setProblem(''); setReading(null);
    if (kind === 'screenshot' && !file) {setProblem('read.choose_file_first'); return}
    if (kind === 'text' && !text.trim()) {setProblem('read.paste_first'); return}
    const form = new FormData();
    form.append('kind', kind === 'screenshot' ? 'screenshot' : 'bank_message');
    form.append('consent', String(enabled && consent));
    if (kind === 'screenshot' && file) form.append('image', file); else form.append('text', text);
    abort.current = new AbortController(); setWorking(true);
    try {setReading(await api<Reading>('/evidence/read', {method: 'POST', body: form, signal: abort.current.signal}, ((status?.timeout_seconds || 45) + 20) * 1000))}
    catch (e) {setProblem(e)} finally {setWorking(false)}
  }
  const show = (p: unknown) => typeof p === 'string' ? (p ? t(p) : '') : errorText(p);
  const shownFact = (field: string, fact: Fact) => fact.status === 'unreadable' ? t('read.unreadable_value') : field === 'amount_paise' ? money(Number(fact.value)) : field === 'occurred_at' ? date(String(fact.value)) : String(fact.value);
  if (!open) return <div className="read-start">
    <div className="choice-list"><button className="button primary" onClick={() => setOpen(true)}><span>{t('read.yes')}</span></button><button className="button secondary" onClick={onSkip}><span>{t('read.no')}</span></button></div>
    <p className="why-line"><strong>{t('intake.why_label')}</strong> {t('intake.step0.why')}</p>
    <details className="demo-tools"><summary>{t('read.practice')}</summary><div className="sample-row"><button className="button secondary" onClick={onSample} disabled={busy}><Plus size={16}/> {t('read.sample')}</button><a className="text-button" href="/api/sample/image" download>{t('read.sample_download')} <Download size={15}/></a></div></details>
  </div>;
  return <div className="read-evidence">
    {!reading ? <form onSubmit={read}>
      <div className="segmented" role="group" aria-label={t('read.kind_label')}>{(['screenshot', 'text'] as const).map(k => <button type="button" key={k} className={kind === k ? 'selected' : ''} aria-pressed={kind === k} onClick={() => {setKind(k); setProblem('')}}>{t(`read.kind_${k}`)}</button>)}</div>
      {kind === 'screenshot' ? <label className="upload-field"><span>{t('read.image_label')}</span><span className="upload-button"><Upload size={16}/> {file ? file.name : t('read.choose_image')}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => {setFile(e.target.files?.[0] || null); setProblem('')}}/></span></label>
        : <label className="full-label">{t('read.text_label')}<textarea rows={4} maxLength={4000} value={text} onChange={e => setText(e.target.value)} placeholder={t('read.text_ph')}/></label>}
      {enabled ? <label className="confirm-box"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}/><span>{kind === 'screenshot' ? t('read.consent') : t('read.consent_text_optional')}</span></label>
        : <p className="source-note">{kind === 'screenshot' ? t('read.not_setup_image') : t('read.local_text')}</p>}
      {show(problem) && <p className="error" role="alert">{show(problem)}</p>}
      {working ? <div className="reading-wait" role="status"><p>{t('read.reading')}</p><button type="button" className="text-button" onClick={() => abort.current?.abort()}>{t('read.cancel')}</button></div>
        : <div className="answer-options"><button className="button primary" disabled={working}>{t('read.go')} <ArrowRight size={16}/></button><button type="button" className="text-button" onClick={onSkip}>{t('read.type_myself')}</button></div>}
    </form> : <div className="read-result" role="status">
      <h3>{reading.status === 'read' ? t('read.result_title') : t(`read.title.${reading.status}`)}</h3>
      {reading.source && <p className="small">{t(`origin.${reading.source}`)}</p>}
      {Object.keys(reading.facts).length > 0 && <dl className="fact-list">{Object.entries(reading.facts).map(([field, fact]) => <div key={field}><dt>{t(`fieldtitle.${field}`)}</dt><dd>{shownFact(field, fact)}
        {fact.quote && <q>{fact.quote}</q>}{fact.status === 'read' && reading.source === 'ai_provider' && <small className="read-badge">{fact.quote_verified ? t('read.quote_verified') : t('read.quote_ai')}</small>}</dd></div>)}</dl>}
      {reading.notes.map((note: Msg, i) => <p key={i} className="small">{m(note)}</p>)}
      <div className="answer-options">{reading.status === 'read' && Object.keys(reading.fields).length > 0 && <button className="button primary" onClick={() => onUse(reading)}>{t('read.use')} <Check size={16}/></button>}
        <button className={'button ' + (reading.status === 'read' ? 'secondary' : 'primary')} onClick={onSkip}>{t('read.type_myself')}</button>
        <button className="text-button" onClick={() => {setReading(null); setConsent(false)}}>{t('read.try_again')}</button></div>
    </div>}
  </div>;
}
