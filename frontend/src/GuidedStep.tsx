import {useEffect, useState, type ReactNode} from 'react';
import {api, date, type Channel} from './api';

export type StepState={channel:Channel;state:'not_started'|'later'|'no_answer'|'waiting'|'resolved';message:string;remind_at:string|null;due:boolean;reported:boolean};
export type JourneyPlan={steps:StepState[];next_channel:Channel|null;reason:string;delivery:string};
const names={helpline:'1930',bank:'your bank',portal:'the cybercrime portal'};
export function GuidedStep({id,channel,plan,refresh,onNext,children}:{id:string;channel:Channel;plan?:JourneyPlan;refresh:()=>Promise<void>;onNext:(channel:Channel)=>void;children:ReactNode}){
  const [showForm,setShowForm]=useState(false);
  const [intent,setIntent]=useState<'later'|'no_answer'|'waiting'|null>(null);
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const [tick,setTick]=useState(Date.now());const [tamil,setTamil]=useState(false);
  const step=plan?.steps.find(s=>s.channel===channel);
  useEffect(()=>{setShowForm(false);setIntent(null);setError('')},[channel,step?.reported]);
  useEffect(()=>{const timer=setInterval(()=>setTick(Date.now()),30000);return()=>clearInterval(timer)},[]);
  const due=Boolean(step?.remind_at&&Date.parse(step.remind_at)<=tick);
  const otherDue=plan?.steps.find(s=>s.channel!==channel&&s.remind_at&&Date.parse(s.remind_at)<=tick);
  async function save(state:StepState['state'],minutes?:number){setBusy(true);setError('');try{
    await api('/cases/'+id+'/journey/'+channel,{method:'PUT',body:JSON.stringify({state,remind_at:minutes?new Date(Date.now()+minutes*60000).toISOString():null})});
    await refresh();setIntent(null);
  }catch(e){setError(e instanceof Error?e.message:'Could not save. Try again.')}finally{setBusy(false)}}
  function calendar(){if(!step?.remind_at)return;const stamp=(d:Date)=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');const start=new Date(step.remind_at);
    const content=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Reclaim//Local reminder//EN','BEGIN:VEVENT',`UID:${id}-${channel}-${start.getTime()}@reclaim.local`,`DTSTAMP:${stamp(new Date())}`,`DTSTART:${stamp(start)}`,`DTEND:${stamp(new Date(start.getTime()+15*60000))}`,'SUMMARY:Review your reporting step','DESCRIPTION:Open Reclaim to review your saved next action.','BEGIN:VALARM','TRIGGER:PT0M','ACTION:DISPLAY','DESCRIPTION:Review your reporting step','END:VALARM','END:VEVENT','END:VCALENDAR',''].join('\r\n');
    const url=URL.createObjectURL(new Blob([content],{type:'text/calendar'}));const a=document.createElement('a');a.href=url;a.download='reclaim-reminder.ics';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  const other=plan?.steps.find(s=>s.channel!==channel&&!s.reported&&s.state==='not_started');
  return <section className="guided-step" aria-label="Guided next action">
    <div className="guided-heading"><h3>{tamil?'இந்த படியில் என்ன நடந்தது?':'How did this step go?'}</h3><button className="text-button" onClick={()=>setTamil(!tamil)}>{tamil?'English':'தமிழ் உதவி'}</button></div>
    {tamil&&<p className="small">Tamil help preview · wording needs native-speaker review. Reports remain in English.</p>}
    {error&&<p className="error" role="alert">{error}</p>}
    {otherDue&&<button className="button primary wide" onClick={()=>onNext(otherDue.channel)}>Reminder due: check {names[otherDue.channel]}</button>}
    <p className="state-description" role="status">{step?.message||'Choose what happened. Opening a link does not mean a report was made.'}</p>
    {step?.remind_at&&<div className="reminder-note" role="status"><strong>{due?'Your reminder is due.':'Your reminder is saved.'}</strong><p>{date(step.remind_at)}</p><button className="text-button" onClick={calendar}>Add to my calendar</button><button disabled={busy} className="text-button" onClick={()=>save(step.state)}>Cancel reminder</button><p className="small">Shown while this app is open, or when you return. Import the calendar file for a calendar alert; alerts depend on your calendar settings.</p></div>}
    {!showForm&&!intent&&<div className="answer-options">
      {!step?.reported?<><button className="button secondary" disabled={busy} onClick={()=>setIntent('later')}>{tamil?'பிறகு தொடர்பு கொள்கிறேன்':'I’ll do this later'}</button><button className="button secondary" disabled={busy} onClick={()=>setIntent('no_answer')}>{tamil?'பதில் கிடைக்கவில்லை':'I tried, but got no answer'}</button><button className="button primary" onClick={()=>setShowForm(true)}>{tamil?'புகார் அளித்துவிட்டேன்':'I made the report'}</button></>:
      <><button className="button secondary" disabled={busy} onClick={()=>setIntent('waiting')}>{tamil?'பதிலுக்காக காத்திருக்கிறேன்':'I’m waiting for a reply'}</button><button className="button secondary" onClick={()=>setShowForm(true)}>Add or correct my reference</button>{step.state!=='resolved'&&<button className="button secondary" disabled={busy} onClick={()=>save('resolved')}>This step is resolved</button>}</>}
    </div>}
    {intent&&<div><p>{intent==='no_answer'?`No answer from ${names[channel]} does not complete the report. You can try another reporting channel while waiting.`:intent==='waiting'?'A reply may take time. Keep your complaint reference; choose when you want to check again.':'Reporting promptly matters. Choose a time that works for you; this is your reminder, not a legal deadline.'}</p><h4>{tamil?'எப்போது நினைவூட்ட வேண்டும்?':'When would you like a reminder?'}</h4><div className="answer-options">{(intent==='waiting'?[60,1440]:[15,30,60]).map(minutes=><button className="button secondary" disabled={busy} key={minutes} onClick={()=>save(intent,minutes)}>{minutes===1440?'Tomorrow':minutes===60?'In an hour':`In ${minutes} minutes`}</button>)}<button className="button secondary" disabled={busy} onClick={()=>save(intent)}>Save without reminder</button><button className="text-button" disabled={busy} onClick={()=>setIntent(null)}>Back</button></div></div>}
    {showForm&&<><p>Use the actual reporting time. A busy line or an unanswered call is an attempt, not a completed report. Leave the reference blank if it has not arrived.</p>{children}<button className="text-button" onClick={()=>setShowForm(false)}>Back to choices</button></>}
    {other&&(step?.state==='later'||step?.state==='no_answer'||step?.reported)&&<button className="button primary wide next-action" onClick={()=>onNext(other.channel)}>Meanwhile, continue with {names[other.channel]}</button>}
    <details className="safety-question"><summary>Quick safety check (optional)</summary><SafetyCheck/></details>
  </section>
}
function SafetyCheck(){const [answer,setAnswer]=useState<string|null>(null);return <div><p>Someone offers to recover your money if you share an OTP. What would you do?</p><div className="answer-options"><button className="button secondary" onClick={()=>setAnswer('safe')}>Keep it private</button><button className="button secondary" onClick={()=>setAnswer('unsure')}>I’m not sure</button></div>{answer&&<p role="status">{answer==='safe'?'Yes. Keep OTPs and PINs private.':'You do not need to share an OTP with someone offering recovery help.'} This check never changes your case or blocks reporting.</p>}</div>}
