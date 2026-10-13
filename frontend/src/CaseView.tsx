import {useEffect, useState} from 'react';
import {AlertCircle, ArrowRight, ArrowUpRight, Check, CheckCircle2, ChevronLeft, Circle, Copy, Download, HelpCircle, Landmark, Phone, ShieldCheck, Trash2} from 'lucide-react';
import {api, downloadPDF, fromInput, localInput, type Case, type Channel, type Docs} from './api';
import {ApiError, useI18n} from './i18n';
import {channels, go, icons} from './nav';
import {GuidedStep} from './GuidedStep';
import {EvidencePanel} from './EvidencePanel';

const isMissing = (e: unknown) => e instanceof ApiError && e.problems.some(p => p.code === 'err.case_missing');

export function CaseView({id, notify}: {id: string; notify: (text: string) => void}) {
  const {t, m, money, date, errorText} = useI18n();
  const [c, setC] = useState<Case | null>(null); const [docs, setDocs] = useState<Docs | null>(null); const [active, setActive] = useState<Channel>('helpline');
  const [reference, setReference] = useState(''); const [reportedAt, setReportedAt] = useState(localInput(new Date().toISOString()));
  const [attest, setAttest] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState<unknown>(null); const [deleting, setDeleting] = useState(false);
  async function refresh() {
    setError(null);
    try {const [value, text] = await Promise.all([api<Case>('/cases/' + id), api<Docs>('/cases/' + id + '/docs')]); setC(value); setDocs(text)}
    catch (e) {if (isMissing(e) && localStorage.getItem('reclaim-case') === id) localStorage.removeItem('reclaim-case'); setError(e)}
  }
  useEffect(() => {setC(null); setDocs(null); void refresh()}, [id]);
  useEffect(() => {const r = c?.reports[active]; setReference(r?.reference || ''); setReportedAt(localInput(r?.reported_at || new Date().toISOString())); setAttest(false)}, [active, c]);
  async function save(e: React.FormEvent) {e.preventDefault(); setBusy(true); setError(null); try {await api('/cases/' + id + '/reports/' + active, {method: 'PUT', body: JSON.stringify({reference, reported_at: fromInput(reportedAt)})}); await refresh(); notify(t('toast.report_saved'))} catch (e) {setError(e)} finally {setBusy(false)}}
  async function remove() {setBusy(true); try {await api('/cases/' + id, {method: 'DELETE'}); if (localStorage.getItem('reclaim-case') === id) localStorage.removeItem('reclaim-case'); notify(t('toast.case_deleted')); go('/')} catch (e) {setError(e); setDeleting(false)} finally {setBusy(false)}}
  async function copy() {try {await navigator.clipboard.writeText(docs?.[active] || ''); notify(t('toast.copied'))} catch {notify(t('toast.copy_manual'))}}
  async function exportPDF() {setBusy(true); setError(null); try {await downloadPDF(id); notify(t('toast.pdf'))} catch (e) {setError(e)} finally {setBusy(false)}}
  if (!c) return <div className="inner-page"><h1 className="page-title">{t('case.loading_title')}</h1>{error ? <div className="error" role="alert">{errorText(error)}<button onClick={refresh}>{t('case.retry')}</button><button onClick={() => go('/')}>{t('case.go_home')}</button></div> : <p role="status">{t('case.loading')}</p>}</div>;
  const Icon = icons[active];
  const questions = c.reconciliation.questions.filter(q => !q.deferred).length;
  return <div className="inner-page page-enter"><button className="back-link" onClick={() => go('/')}><ChevronLeft size={17}/> {t('case.overview')}</button>
    <div className="section-heading"><div><div className="eyebrow">{t('case.eyebrow', {id})}</div><h1 className="page-title">{t('case.title')}</h1>
      <p className="muted">{c.transactions.length > 1 ? t('case.total_many', {total_paise: c.total_paise, n: c.transactions.length}) : money(c.total_paise)} · {c.bank} · {date(c.occurred_at)}</p></div>
      <button disabled={busy} className="button secondary" onClick={exportPDF}><Download size={17}/> {t('case.pack')}</button></div>
    {error ? <div className="error" role="alert">{errorText(error)}</div> : null}
    <div className={'progress-banner ' + (c.reports_recorded === 3 ? 'complete' : '')}><div className="progress-count">{c.reports_recorded}<span>/3</span></div>
      <div><strong>{c.reports_recorded === 3 ? t('case.progress_done') : t('case.progress_todo')}</strong><p>{c.plan ? m(c.plan.reason_msg) : t('case.progress_hint')}</p></div><span className="soft-badge">{t('case.saved_by_you')}</span></div>
    {c.plan?.next_channel && c.plan.next_channel !== active && <button className="button primary suggested-next" onClick={() => setActive(c.plan!.next_channel!)}>{t('case.suggested', {action: t(`action.${c.plan.next_channel}`)})} <ArrowRight size={17}/></button>}
    {questions > 0 ? <a className="evidence-banner" href="#evidence"><HelpCircle size={17}/> {t(questions === 1 ? 'case.one_question' : 'case.questions', {n: questions})} <span>{t('case.answer')}</span></a>
      : c.reconciliation.changes.length > 0 && <a className="evidence-banner" href="#evidence"><HelpCircle size={17}/> {t('case.changes_waiting')} <span>{t('case.review')}</span></a>}
    {c.missing_fields.length > 0 && <div className="missing-note"><AlertCircle size={17}/> {t('case.missing', {fields: c.missing_fields.map(f => t(f === 'Transaction reference' ? 'field.reference' : 'field.payee')).join(', ')})}</div>}
    <div className="case-grid"><aside className="step-menu"><span className="eyebrow">{t('case.actions_label')}</span>
      {channels.map((ch, i) => {const I = icons[ch]; const state = c.plan?.steps.find(s => s.channel === ch)?.state || (c.reports[ch] ? 'waiting' : 'not_started');
        return <button key={ch} className={'step-tab ' + (ch === active ? 'selected' : '')} onClick={() => setActive(ch)}><span className="step-icon"><I size={20}/></span><div><small>{t('case.action_n', {n: i + 1})}</small><strong>{t(`action.${ch}`)}</strong><span>{t(`state.${state}`)}</span></div>{c.reports[ch] ? <CheckCircle2 size={18} className="green"/> : <Circle size={16}/>}</button>})}
      <div className="case-side-note"><ShieldCheck size={19}/><p>{t('case.side_note')}</p></div>
      <a href={'/api/cases/' + id + '/export.json'} className="text-button"><Download size={15}/> {t('case.export')}</a><button className="text-button delete-link" onClick={() => setDeleting(true)}><Trash2 size={15}/> {t('case.delete')}</button></aside>
      <section className="draft-card"><div className="draft-header"><span className="icon-box"><Icon size={21}/></span><div><h2>{t(`action.${active}`)}</h2><p>{t(`case.draft_intro.${active}`)}</p></div></div>
        <div className="draft-label"><span>{active === 'helpline' ? t('case.call_notes') : t('case.prepared_draft')}</span><button className="text-button" onClick={copy}><Copy size={15}/> {t('case.copy')}</button></div>
        <textarea className="draft-text" readOnly aria-label={t('case.draft_label')} lang="en" value={docs?.[active] || t('case.draft_loading')} rows={12}/>
        <p className="small drafts-english">{t('case.drafts_english')}</p>
        <div className="external-action">{active === 'helpline' ? <a href="tel:1930" className="button primary"><Phone size={16}/> {t('urgent.call')} <ArrowUpRight size={16}/></a>
          : active === 'portal' ? <a href="https://cybercrime.gov.in/" target="_blank" rel="noreferrer" className="button primary">{t('case.open_portal')} <ArrowUpRight size={17}/></a>
          : <div className="bank-tip"><Landmark size={20}/><span>{t('case.bank_tip')}</span></div>}<span className="muted small">{t('case.keep_reference')}</span></div>
        <GuidedStep id={id} channel={active} plan={c.plan} refresh={refresh} onNext={ch => {setActive(ch); window.scrollTo(0, 0)}}>
          <form className="report-form" onSubmit={save}><h3>{c.reports[active] ? t('report.update_title') : t('report.title')}</h3><p>{t('report.intro')}</p>
            <div className="fields-grid"><label>{t('report.reference')} <span className="optional">{t('report.if_received')}</span><input maxLength={100} value={reference} onChange={e => setReference(e.target.value)} placeholder={t('report.reference_ph')}/></label>
              <label>{t('report.when')}<input required type="datetime-local" min={localInput(c.occurred_at)} max={localInput(new Date().toISOString())} value={reportedAt} onChange={e => setReportedAt(e.target.value)}/></label></div>
            <label className="confirm-box"><input type="checkbox" required checked={attest} onChange={e => setAttest(e.target.checked)}/><span>{t('report.attest')}</span></label>
            <button className="button secondary" disabled={busy || !attest}>{busy ? t('review.saving') : t('report.save')}<Check size={17}/></button></form>
        </GuidedStep>
      </section></div>
    <EvidencePanel c={c} refresh={refresh} notify={notify}/>
    <div className="gentle-note"><HelpCircle size={18}/><p>{t('case.policy')}</p></div>
    {deleting && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="delete-heading"><h2 id="delete-heading">{t('delete.title')}</h2><p>{t('delete.text')}</p>
      <div className="modal-actions"><button autoFocus className="button secondary" onClick={() => setDeleting(false)}>{t('delete.keep')}</button><button disabled={busy} className="button danger" onClick={remove}>{t('delete.confirm')}</button></div></section></div>}
  </div>;
}
