import {useEffect, useState} from 'react';
import {ArrowRight, ArrowUpRight, Check, Circle, ClipboardCheck, Eye, LockKeyhole, Plus, ShieldCheck, X} from 'lucide-react';
import {api, type Case} from './api';
import {useI18n} from './i18n';
import {channels, go} from './nav';

/** Local demonstration of a review queue. Not part of the everyday reporting journey. */
export function Dashboard() {
  const {t, money, errorText} = useI18n();
  const [cases, setCases] = useState<Case[]>([]); const [error, setError] = useState<unknown>(null); const [filter, setFilter] = useState('all'); const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let live = true; let timer: ReturnType<typeof setTimeout>;
    async function refresh() {try {const data = await api<Case[]>('/cases'); if (live) {setCases(data); setError(null); setLoaded(true)}} catch (e) {if (live) setError(e)} finally {if (live) timer = setTimeout(refresh, 2500)}}
    void refresh(); return () => {live = false; clearTimeout(timer)};
  }, []);
  const complete = cases.filter(c => c.reports_recorded === 3).length; const missing = cases.filter(c => c.missing_fields.length > 0).length;
  const shown = cases.filter(c => filter === 'all' || (filter === 'open' ? c.reports_recorded < 3 : c.reports_recorded === 3));
  return <div className="inner-page dashboard page-enter"><div className="section-heading"><div><span className="eyebrow">{t('dash.eyebrow')}</span><h1 className="page-title">{t('dash.title')}</h1><p className="muted">{t('dash.sub')}</p></div><button className="button primary" onClick={() => go('/prepare')}><Plus size={17}/> {t('dash.new')}</button></div>
    <div className="workspace-notice"><Eye size={17}/> {t('dash.notice')}</div>
    <div className="metrics">{([['dash.m.cases', cases.length, 'dash.m.cases_sub'], ['dash.m.open', cases.length - complete, 'dash.m.open_sub'], ['dash.m.done', complete, 'dash.m.done_sub'], ['dash.m.missing', missing, 'dash.m.missing_sub']] as const).map(([title, value, caption]) => <div className="metric" key={title}><span>{t(title)}</span><strong>{value}</strong><small>{t(caption)}</small></div>)}</div>
    <section className="queue"><div className="queue-heading"><div><h2>{t('dash.queue')} <span className="count-pill">{cases.length}</span></h2><span className="muted small">{t('dash.queue_sub')}</span></div>
      <div className="segmented" aria-label={t('dash.filter')}>{['all', 'open', 'done'].map(key => <button key={key} className={filter === key ? 'selected' : ''} onClick={() => setFilter(key)}>{t(`dash.filter.${key}`)}</button>)}</div></div>
    {error ? <div className="error" role="alert">{t('dash.interrupted')} {errorText(error)}</div> : null}
    <div className="table-wrap"><table><thead><tr><th>{t('dash.col.case')}</th><th>{t('dash.col.amount')}</th><th>{t('dash.col.record')}</th><th>{t('dash.col.details')}</th><th>{t('dash.col.status')}</th><th><span className="sr-only">{t('dash.col.open')}</span></th></tr></thead>
      <tbody>{shown.map(c => <tr key={c.id}><td><strong>{c.id}</strong><small>{c.bank} · {c.method}</small></td><td className="amount-cell">{money(c.total_paise ?? c.amount_paise)}</td>
        <td><div className="report-dots">{channels.map(ch => <span title={t(`action.${ch}`)} key={ch} className={c.reports[ch] ? 'done' : ''}>{c.reports[ch] ? <Check size={12}/> : <Circle size={10}/>} {t(`dash.short.${ch}`)}</span>)}</div></td>
        <td>{c.missing_fields.length ? <span className="amber">{t('dash.missing_n', {n: c.missing_fields.length})}</span> : <span className="green">{t('dash.ready')}</span>}</td>
        <td><span className={'status-pill ' + (c.reports_recorded === 3 ? 'done' : '')}>{c.reports_recorded === 3 ? t('dash.recorded') : t('dash.in_progress')}</span></td>
        <td><button className="icon-button" aria-label={t('dash.open_case', {id: c.id})} onClick={() => go('/case/' + c.id)}><ArrowUpRight size={19}/></button></td></tr>)}</tbody></table></div>
    {!shown.length && <div className="empty-state"><ClipboardCheck size={34}/><h3>{loaded ? t('dash.empty_title') : t('dash.loading')}</h3><p>{loaded ? t('dash.empty_text') : t('dash.connecting')}</p>{loaded && <button className="button secondary" onClick={() => go('/prepare')}>{t('dash.prepare')} <ArrowRight size={16}/></button>}</div>}
    </section><div className="queue-footer"><LockKeyhole size={16}/> {t('dash.footer')}</div>
  </div>;
}

export function Stage() {
  const {t} = useI18n();
  return <div className="stage"><header><button className="brand" onClick={() => go('/')}><ShieldCheck/> reclaim.</button><span>{t('stage.tagline')}</span><button className="button secondary" onClick={() => go('/')}><X size={17}/> {t('stage.exit')}</button></header>
    <div className="stage-panels"><section><span className="eyebrow">{t('stage.assistant')}</span><iframe title={t('stage.assistant')} src="/?embedded=1"/></section><section><span className="eyebrow">{t('stage.review')}</span><iframe title={t('stage.review')} src="/bank?embedded=1"/></section></div>
    <footer>{t('stage.footer')}</footer></div>;
}
