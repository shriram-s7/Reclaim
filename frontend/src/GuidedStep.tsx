import {useEffect, useState, type ReactNode} from 'react';
import {api, type Channel, type JourneyPlan, type StepState} from './api';
import {useI18n} from './i18n';

/** After each reporting action: later, no answer, or actually reported; then waiting/follow-up. */
export function GuidedStep({id, channel, plan, refresh, onNext, children}: {id: string; channel: Channel; plan?: JourneyPlan; refresh: () => Promise<void>; onNext: (channel: Channel) => void; children: ReactNode}) {
  const {t, date, errorText} = useI18n();
  const [showForm, setShowForm] = useState(false);
  const [intent, setIntent] = useState<'later' | 'no_answer' | 'waiting' | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<unknown>(null); const [notice, setNotice] = useState('');
  const [tick, setTick] = useState(Date.now());
  const step = plan?.steps.find(s => s.channel === channel);
  useEffect(() => {setShowForm(false); setIntent(null); setError(null)}, [channel, plan]);
  useEffect(() => setNotice(''), [channel]);
  useEffect(() => {const timer = setInterval(() => setTick(Date.now()), 30000); return () => clearInterval(timer)}, []);
  const due = Boolean(step?.remind_at && Date.parse(step.remind_at) <= tick);
  const otherDue = plan?.steps.find(s => s.channel !== channel && s.remind_at && Date.parse(s.remind_at) <= tick);
  async function save(state: StepState['state'], minutes?: number, done = '') {
    setBusy(true); setError(null); setNotice('');
    try {
      await api('/cases/' + id + '/journey/' + channel, {method: 'PUT', body: JSON.stringify({state, remind_at: minutes ? new Date(Date.now() + minutes * 60000).toISOString() : null})});
      await refresh(); setIntent(null); setNotice(done || (minutes ? 'guided.saved_reminder' : 'guided.saved'));
    } catch (e) {setError(e)} finally {setBusy(false)}
  }
  function calendar() {
    if (!step?.remind_at) return;
    const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const start = new Date(step.remind_at);
    // iCalendar text: escape commas and semicolons; content is UTF-8 so Tamil text is kept.
    const ics = (text: string) => text.replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1');
    const content = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Reclaim//Local reminder//EN', 'BEGIN:VEVENT', `UID:${id}-${channel}-${start.getTime()}@reclaim.local`,
      `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(new Date(start.getTime() + 15 * 60000))}`,
      `SUMMARY:${ics(t('calendar.summary'))}`, `DESCRIPTION:${ics(t('calendar.description'))}`,
      'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', `DESCRIPTION:${ics(t('calendar.summary'))}`, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n');
    const url = URL.createObjectURL(new Blob([content], {type: 'text/calendar;charset=utf-8'}));
    const a = document.createElement('a'); a.href = url; a.download = 'reclaim-reminder.ics'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const other = plan?.steps.find(s => s.channel !== channel && !s.reported && s.state === 'not_started');
  const choose = (next: typeof intent) => {setIntent(next); setNotice('')};
  return <section className="guided-step" aria-label={t('guided.label')}>
    <div className="guided-heading"><h3>{t('guided.title')}</h3></div>
    {error ? <p className="error" role="alert">{errorText(error)}</p> : null}
    {notice && <p className="notice" role="status">{t(notice)}</p>}
    {otherDue && <button className="button primary wide" onClick={() => onNext(otherDue.channel)}>{t('guided.other_due', {channel: otherDue.channel})}</button>}
    <p className="state-description" role="status">{step ? t(`state.message.${step.state}`) : t('guided.choose')}</p>
    {step?.reported && <p className="reference-line">{step.reference ? <>{t('guided.reference_saved')} <strong>{step.reference}</strong></> : t('guided.reference_pending')}</p>}
    {step?.remind_at && <div className="reminder-note" role="status"><strong>{due ? t('reminder.due') : t('reminder.saved')}</strong><p>{date(step.remind_at)}</p>
      <button className="text-button" onClick={calendar}>{t('reminder.calendar')}</button>
      <button disabled={busy} className="text-button" onClick={() => save(step.state, undefined, 'reminder.cancelled')}>{t('reminder.cancel')}</button>
      <p className="small">{t('reminder.delivery')}</p></div>}
    {!showForm && !intent && <div className="answer-options">
      {!step?.reported ? <>
        <button className="button secondary" disabled={busy} onClick={() => choose('later')}>{t('guided.later')}</button>
        <button className="button secondary" disabled={busy} onClick={() => choose('no_answer')}>{t('guided.no_answer')}</button>
        <button className="button primary" onClick={() => {setShowForm(true); setNotice('')}}>{t('guided.reported')}</button></>
      : <>
        <button className="button secondary" disabled={busy} onClick={() => choose('waiting')}>{t('guided.waiting')}</button>
        <button className="button secondary" onClick={() => {setShowForm(true); setNotice('')}}>{t('guided.correct_reference')}</button>
        {step.state !== 'resolved' && <button className="button secondary" disabled={busy} onClick={() => save('resolved')}>{t('guided.resolved')}</button>}</>}
    </div>}
    {intent && <div><p>{t(`guided.intent.${intent}`, {channel})}</p><h4>{t('reminder.when')}</h4>
      <div className="answer-options">{(intent === 'waiting' ? [60, 1440] : [15, 30, 60]).map(minutes => <button className="button secondary" disabled={busy} key={minutes} onClick={() => save(intent, minutes)}>
        {minutes === 1440 ? t('reminder.tomorrow') : minutes === 60 ? t('reminder.hour') : t('reminder.minutes', {n: minutes})}</button>)}
        <button className="button secondary" disabled={busy} onClick={() => save(intent)}>{t('reminder.none')}</button>
        <button className="text-button" disabled={busy} onClick={() => setIntent(null)}>{t('intake.back')}</button></div></div>}
    {showForm && <><p>{t('guided.form_intro')}</p>{children}<button className="text-button" onClick={() => setShowForm(false)}>{t('guided.back_to_choices')}</button></>}
    {other && (step?.state === 'later' || step?.state === 'no_answer' || step?.reported) && <button className="button primary wide next-action" onClick={() => onNext(other.channel)}>{t('guided.meanwhile', {channel: other.channel})}</button>}
    <details className="safety-question"><summary>{t('safety.summary')}</summary><SafetyCheck/></details>
  </section>;
}

function SafetyCheck() {
  const {t} = useI18n();
  const [answer, setAnswer] = useState<'safe' | 'unsure' | null>(null);
  return <div><p>{t('safety.question')}</p><div className="answer-options"><button className="button secondary" onClick={() => setAnswer('safe')}>{t('safety.private')}</button><button className="button secondary" onClick={() => setAnswer('unsure')}>{t('safety.unsure')}</button></div>
    {answer && <p role="status">{t(`safety.answer.${answer}`)} {t('safety.never_blocks')}</p>}</div>;
}
