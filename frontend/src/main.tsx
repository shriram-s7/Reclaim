import React, {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ArrowRight, ArrowUpRight, Check, CheckCircle2, ChevronLeft, ClipboardCheck, Copy, Download, FileText, HelpCircle, LayoutDashboard, ListChecks, LockKeyhole, Phone, Plus, ShieldCheck, Trash2, Upload, X, Landmark, Clock3, Circle, Eye, AlertCircle, Monitor, RefreshCw} from 'lucide-react';
import {api, money, date, localInput, fromInput, downloadPDF, type Case, type Facts, type Docs, type Channel} from './api';
import './styles.css';
import './refinements.css';

const channels:Channel[] = ['helpline','bank','portal'];
const channelNames = {helpline:'Call 1930',bank:'Contact your bank',portal:'Complete the portal report'};
const icons = {helpline:Phone,bank:Landmark,portal:FileText};
const emptyFacts = ():Facts => ({amount_paise:0,occurred_at:'',bank:'',method:'Other',reference:'',payee:'',description:'',source:'manual'});
const errText = (e:unknown) => e instanceof Error?e.message:'Something went wrong. Try again.';
function go(path:string) {window.history.pushState({},'',path);window.dispatchEvent(new PopStateEvent('popstate'));window.scrollTo(0,0);}
function App(){
  const [path,setPath] = useState(location.pathname);
  const [toast,setToast] = useState('');
  useEffect(()=>{const fn=()=>setPath(location.pathname);addEventListener('popstate',fn);return()=>removeEventListener('popstate',fn)},[]);
  useEffect(()=>{if(toast){const t=setTimeout(()=>setToast(''),4500);return()=>clearTimeout(t)}},[toast]);
  if(path==='/stage')return <Stage/>;
  return <div className={'app-shell '+(path==='/bank'?'review-shell ':'citizen-shell ')+(new URLSearchParams(location.search).has('embedded')?'embedded':'')}>
    <aside className="sidebar">
      <button className="brand" onClick={()=>go('/')} aria-label="Reclaim home"><span className="brand-symbol"><ShieldCheck size={22}/></span>reclaim<span className="brand-dot">.</span></button>
      <div className="workspace-label">YOUR RECOVERY WORKSPACE</div>
      <nav aria-label="Main navigation">
        <button className={!path.startsWith('/bank')?'nav-item active':'nav-item'} onClick={()=>go('/')}><ShieldCheck size={19}/> Reporting assistant</button>
        <button className={path==='/bank'?'nav-item active':'nav-item'} onClick={()=>go('/bank')}><LayoutDashboard size={19}/> Review workspace <span className="tiny-pill">DEMO</span></button>
        <button className="nav-item" onClick={()=>go('/stage')}><Monitor size={19}/> Presentation view</button>
      </nav>
      <div className="sidebar-note"><div className="small-icon"><LockKeyhole size={19}/></div><strong>Your next step. Your control.</strong><p>We prepare your case. You choose when and where to report it.</p><span>No OTPs. No PINs. No fees.</span></div>
      <div className="sidebar-footer"><span className="online-dot"/> Local prototype <span>v0.1</span></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><button className="mobile-brand" onClick={()=>go('/')} aria-label="Reclaim home">reclaim.</button><span>REPORTING, SIMPLIFIED</span><div><span className="demo-label">Practice demo · fictional details only</span><span className="avatar">R</span></div></header>
      <main>{path==='/bank'?<Dashboard/>:path.startsWith('/case/')?<CaseView id={path.split('/')[2]} notify={setToast}/>:path==='/prepare'?<Prepare notify={setToast}/>:<Home/>}</main>
      <footer className="page-footer"><ShieldCheck size={14}/> Independent prototype. Not a bank or government service.<span>Made for the moments that matter.</span></footer>
    </div>
    {toast&&<div className="toast" role="status"><CheckCircle2 size={18}/>{toast}</div>}
  </div>
}
function Home(){
  const [resume] = useState(()=>localStorage.getItem('reclaim-case'));
  return <div className="home page-enter">
    <div className="eyebrow"><span/> A CLEAR WAY FORWARD</div>
    <div className="hero-grid">
      <section className="hero-copy"><h1>Lost money to a scam?<br/><em>We’ll help you report it.</em></h1><p className="hero-description">Tell us what happened. We’ll prepare what you need to say,<br/>then help you keep track of your reports.</p>
        <div className="hero-actions"><button className="button primary" onClick={()=>go('/prepare')}>Get started <ArrowRight size={18}/></button>{resume&&<button className="text-button" onClick={()=>go('/case/'+resume)}>Continue my report <ArrowUpRight size={16}/></button>}</div>
        <div className="trust-line"><span><Check size={15}/> No account needed</span><span><Check size={15}/> Always in your control</span></div>
      </section>
      <section className="case-preview" aria-label="Example of your case workspace"><div className="preview-top"><span><span className="mini-symbol"><ShieldCheck size={16}/></span> YOUR CASE, TOGETHER</span><span className="tiny-pill">ILLUSTRATION</span></div>
        <div className="preview-title">A little clarity.<br/>A lot less uncertainty.</div><div className="preview-line"/>
        {[['01','Gather the facts','A single, consistent record'],['02','Prepare your reports','The right details, ready to share'],['03','Keep track of progress','References and next actions']].map(([n,title,sub],i)=><div className="preview-step" key={n}><span className={'step-orb '+(i===0?'filled':'')}>{i===0?<Check size={16}/>:n}</span><div><strong>{title}</strong><small>{sub}</small></div>{i===0&&<span className="soft-badge">Start here</span>}</div>)}
        <div className="preview-bottom"><LockKeyhole size={15}/> Your details stay on this demo machine.</div>
      </section>
    </div>
    <section className="urgent-strip"><div className="urgent-icon"><Clock3 size={23}/></div><div><strong>Lost money? Act now. The paperwork can wait.</strong><p>Stop further payments. Call 1930 and contact your bank through its official app or website.</p></div><a className="button call" href="tel:1930"><Phone size={16}/> Call 1930 <ArrowUpRight size={15}/></a></section>
    <div className="section-heading"><div><span className="eyebrow">ONE CASE. THREE ACTIONS.</span><h2>You don’t have to figure it all out at once.</h2></div><span className="muted">Start wherever you need to.</span></div>
    <div className="action-grid">{channels.map((channel,i)=>{const Icon=icons[channel];return <article className="action-card" key={channel}><div className="action-card-top"><Icon size={22}/><span>0{i+1}</span></div><h3>{channelNames[channel]}</h3><p>{channel==='helpline'?'Use the national financial cyber-fraud helpline. Keep the acknowledgement you receive.':channel==='bank'?'Report through your bank’s official channel immediately. Ask for a complaint reference.':'Prepare your incident description for cybercrime.gov.in and record your reference.'}</p><button className="text-button" onClick={()=>go('/prepare')}>Prepare {channel==='helpline'?'call notes':channel==='bank'?'a bank letter':'a complaint'} <ArrowRight size={16}/></button></article>})}</div>
    <div className="gentle-note"><HelpCircle size={18}/><p>Already reported? You can still use Reclaim to organise the facts and save your references. Recovery is never guaranteed.</p></div>
  </div>
}
function Prepare({notify}:{notify:(text:string)=>void}){
  const [facts,setFacts]=useState<Facts>(emptyFacts);
  const [amount,setAmount]=useState('');
  const [step,setStep]=useState(1);
  const [confirmed,setConfirmed]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [sourceNote,setSourceNote]=useState('Enter only fictional details in this prototype.');
  const [sms,setSms]=useState('');
  async function readText(){setBusy(true);setError('');try{
    const result=await api<{fields:Partial<Facts>;message:string}>('/extract-text',{method:'POST',body:JSON.stringify({text:sms})});
    setFacts({...emptyFacts(),...result.fields,source:'text'});setAmount(result.fields.amount_paise?String(result.fields.amount_paise/100):'');setConfirmed(false);setSourceNote(result.message);
  }catch(e){setError(errText(e))}finally{setBusy(false)}}
  function update<K extends keyof Facts>(key:K,value:Facts[K]){setFacts(prev=>({...prev,[key]:value}));setConfirmed(false)}
  async function loadSample(){setBusy(true);setError('');try{const value=await api<Facts>('/sample');setFacts(value);setAmount((value.amount_paise/100).toString());setConfirmed(false);setSourceNote('Fictional sample loaded. Review every field before continuing.')}catch(e){setError(errText(e))}finally{setBusy(false)}}
  async function upload(file:File){setBusy(true);setError('');try{
    if(file.size>10*1024*1024)throw new Error('Use an image smaller than 10 MB.');
    const form=new FormData();form.append('image',file);
    const result=await api<{source:string;fields:Facts|null;message:string}>('/extract',{method:'POST',body:form});
    if(result.fields){setFacts(result.fields);setAmount(String(result.fields.amount_paise/100))}
    else {setFacts(emptyFacts());setAmount('')}
    setConfirmed(false);setSourceNote(result.message);
  }catch(e){setError(errText(e))}finally{setBusy(false)}}
  function review(event:React.FormEvent){event.preventDefault();setError('');
    if(!/^\d+(\.\d{1,2})?$/.test(amount)||Number(amount)<=0){setError('Enter a positive amount with at most two decimal places.');return}
    const paise=Math.round(Number(amount)*100);if(paise>1_000_000_000){setError('This prototype supports amounts up to ₹1 crore.');return}
    if(!facts.occurred_at||new Date(facts.occurred_at)>new Date()){setError('Enter a transaction time that is not in the future.');return}
    setFacts(prev=>({...prev,amount_paise:paise}));setStep(step===1?2:3);setConfirmed(false);window.scrollTo(0,0);
  }
  async function create(){setBusy(true);setError('');try{const c=await api<Case>('/cases',{method:'POST',body:JSON.stringify({...facts,confirmed})});localStorage.setItem('reclaim-case',c.id);notify('Case saved on this machine.');go('/case/'+c.id)}catch(e){setError(errText(e))}finally{setBusy(false)}}
  return <div className="inner-page page-enter"><button className="back-link" onClick={()=>step>1?setStep(step-1):go('/')}><ChevronLeft size={17}/>{step>1?'Back':'Back to home'}</button>
    <div className="section-heading"><div><span className="eyebrow">YOUR CASE STARTS HERE</span><h1 className="page-title">{step===1?'Which payment went wrong?':step===2?'What happened?':'Check your details.'}</h1><p className="muted">{step===1?'Start with the amount, date and your bank.':step===2?'Use your own words. Add a transaction reference if you have it.':'We’ll use these details to prepare your reports.'}</p></div><span className="step-counter">0{step} <span>/ 03</span></span></div>
    <div className="compact-urgent"><Phone size={17}/> You can report now, even without a complete case. <a href="tel:1930">Call 1930 ↗</a></div>
    {error&&<div className="error" role="alert"><AlertCircle size={18}/>{error}</div>}
    <div className="prepare-grid"><section className="form-card">
      {step<3?<><div className="form-card-heading"><span className="icon-box"><FileText size={20}/></span><div><h2>{step===1?'Payment details':'A few details about the incident'}</h2><p>{step===1?'All times are in Indian Standard Time (IST).':'Don’t include passwords, PINs or OTPs.'}</p></div></div>
        {step===1&&<details className="demo-tools"><summary>Try a fictional example or read a message</summary><div className="sample-row"><button className="button secondary" onClick={loadSample} disabled={busy}><Plus size={16}/> Use fictional sample</button><label className={'upload-button '+(busy?'disabled':'')}><Upload size={16}/> Try sample image<input type="file" accept="image/png,image/jpeg,image/webp" aria-label="Upload synthetic payment image" disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file);e.target.value=''}}/></label></div>
        <details className="sms-import"><summary>Have a bank message? Extract details from text.</summary><label>Paste a fictional message<textarea value={sms} maxLength={4000} rows={3} onChange={e=>setSms(e.target.value)} placeholder="INR 18000.00 debited via UPI. UTR: 701245678912. To demo-recipient@example."/></label><button className="button secondary" disabled={busy||!sms.trim()} onClick={readText}>Read message <ArrowRight size={15}/></button><p>Local text rules only. This replaces the current form fields.</p></details>
        <p className="source-note" role="status">{busy?'Loading…':sourceNote}</p>
        </details>}<form onSubmit={review}>{step===1?<div className="fields-grid">
          <label>Amount lost (₹)<input required inputMode="decimal" value={amount} placeholder="e.g. 18,000" onChange={e=>{setAmount(e.target.value);setConfirmed(false)}}/></label>
          <label>Transaction date & time (IST)<input required type="datetime-local" value={facts.occurred_at?localInput(facts.occurred_at):''} onChange={e=>update('occurred_at',e.target.value?fromInput(e.target.value):'')}/></label>
          <label>Your bank<input required minLength={2} maxLength={100} value={facts.bank} placeholder="Bank name" onChange={e=>update('bank',e.target.value)}/></label>
          <label>Payment method<select value={facts.method} onChange={e=>update('method',e.target.value as Facts['method'])}><option>UPI</option><option>Card</option><option>Net banking</option><option>Other</option></select></label>
          </div>:<><div className="fields-grid"><label>Transaction reference <span className="optional">if available</span><input maxLength={100} value={facts.reference} placeholder="UTR or transaction ID" onChange={e=>update('reference',e.target.value)}/></label>
          <label>Recipient <span className="optional">if available</span><input maxLength={200} value={facts.payee} placeholder="UPI ID or recipient name" onChange={e=>update('payee',e.target.value)}/></label>
        </div><label className="full-label">What happened?<textarea required minLength={10} maxLength={4000} rows={4} value={facts.description} placeholder="Describe the incident in your own words. Do not enter passwords, PINs or OTPs." onChange={e=>update('description',e.target.value)}/></label></>}
        <div className="form-bottom"><span><LockKeyhole size={14}/> Saved only when you confirm</span><button className="button primary" disabled={busy}>{step===1?'Continue':'Check my details'} <ArrowRight size={17}/></button></div></form></>:
        <><div className="review-amount"><span>AMOUNT REPORTED</span><strong>{money(facts.amount_paise)}</strong><span>{facts.method} · {facts.bank}</span></div><dl className="fact-list">{[['Transaction time',date(facts.occurred_at)],['Reference',facts.reference||'Not provided'],['Recipient',facts.payee||'Not provided'],['Source',facts.source==='manual'?'Manual entry':facts.source==='text'?'Local text parsing (review required)':'Synthetic demonstration sample']].map(([key,value])=><div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl><h3>Your description</h3><p className="description-review">{facts.description}</p><label className="confirm-box"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>I have checked these details. I understand that creating a case does not submit a report.</span></label><button className="button primary wide" disabled={!confirmed||busy} onClick={create}>{busy?'Saving…':'Show me what to do'}<ArrowRight size={17}/></button></>}
    </section><aside className="help-card"><span className="icon-box light"><ShieldCheck size={22}/></span><h3>Just the details that matter.</h3><p>A transaction reference and a short description help make your reports consistent.</p><div className="divider"/><strong>Can’t find a detail?</strong><p>Leave optional fields empty and add the information directly when reporting.</p><strong>Keep original evidence.</strong><p>Preserve screenshots and messages. This prototype does not store uploaded images or include them in exports.</p><a className="text-button" href="/api/sample/image" download>Download fictional sample <Download size={15}/></a><div className="help-foot"><LockKeyhole size={16}/> Never enter an OTP, PIN, password or full account number.</div></aside></div>
  </div>
}
function CaseView({id,notify}:{id:string;notify:(text:string)=>void}){
  const [c,setC]=useState<Case|null>(null);const [docs,setDocs]=useState<Docs|null>(null);const [active,setActive]=useState<Channel>('helpline');
  const [reference,setReference]=useState('');const [reportedAt,setReportedAt]=useState(localInput(new Date().toISOString()));
  const [attest,setAttest]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [deleting,setDeleting]=useState(false);
  async function refresh(){setError('');try{const [value,text]=await Promise.all([api<Case>('/cases/'+id),api<Docs>('/cases/'+id+'/docs')]);setC(value);setDocs(text)}catch(e){setError(errText(e))}}
  useEffect(()=>{void refresh()},[id]);
  useEffect(()=>{const r=c?.reports[active];setReference(r?.reference||'');setReportedAt(localInput(r?.reported_at||new Date().toISOString()));setAttest(false)},[active,c]);
  async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{await api('/cases/'+id+'/reports/'+active,{method:'PUT',body:JSON.stringify({reference,reported_at:fromInput(reportedAt)})});await refresh();notify('Saved. You can move to the next step.')}catch(e){setError(errText(e))}finally{setBusy(false)}}
  async function remove(){setBusy(true);try{await api('/cases/'+id,{method:'DELETE'});if(localStorage.getItem('reclaim-case')===id)localStorage.removeItem('reclaim-case');notify('Case deleted from this demo.');go('/')}catch(e){setError(errText(e));setDeleting(false)}finally{setBusy(false)}}
  async function copy(){try{await navigator.clipboard.writeText(docs?.[active]||'');notify('Draft copied. Review it before submitting.')}catch{notify('Select the draft text and copy it manually.')}}
  async function exportPDF(){setBusy(true);setError('');try{await downloadPDF(id);notify('Case pack downloaded. Keep your original evidence separately.')}catch(e){setError(errText(e))}finally{setBusy(false)}}
  if(!c)return <div className="inner-page"><h1 className="page-title">Your case</h1>{error?<div className="error" role="alert">{error}<button onClick={refresh}>Retry</button><button onClick={()=>go('/')}>Go home</button></div>:<p role="status">Loading your case…</p>}</div>;
  const Icon=icons[active];
  return <div className="inner-page page-enter"><button className="back-link" onClick={()=>go('/')}><ChevronLeft size={17}/> Overview</button><div className="section-heading"><div><div className="eyebrow">YOUR CASE · {id}</div><h1 className="page-title">One clear step at a time.</h1><p className="muted">{money(c.amount_paise)} · {c.bank} · {date(c.occurred_at)}</p></div><button disabled={busy} className="button secondary" onClick={exportPDF}><Download size={17}/> Case pack</button></div>
    {error&&<div className="error" role="alert">{error}</div>}
    <div className={'progress-banner '+(c.reports_recorded===3?'complete':'')}><div className="progress-count">{c.reports_recorded}<span>/3</span></div><div><strong>{c.reports_recorded===3?'Your reporting records are together.':'Let’s get your reports ready.'}</strong><p>{c.reports_recorded===3?'Keep your references and follow instructions from your bank and the authorities.':'Call 1930 and contact your bank promptly. Complete the portal report as instructed.'}</p></div><span className="soft-badge">Saved by you</span></div>
    {c.missing_fields.length>0&&<div className="missing-note"><AlertCircle size={17}/> Still to gather: {c.missing_fields.join(', ')}. You can report without waiting for a complete pack.</div>}
    <div className="case-grid"><aside className="step-menu"><span className="eyebrow">REPORTING ACTIONS</span>{channels.map((ch,i)=>{const I=icons[ch];return <button key={ch} className={'step-tab '+(ch===active?'selected':'')} onClick={()=>setActive(ch)}><span className="step-icon"><I size={20}/></span><div><small>ACTION 0{i+1}</small><strong>{channelNames[ch]}</strong><span>{c.reports[ch]?'Report recorded':'Not recorded yet'}</span></div>{c.reports[ch]?<CheckCircle2 size={18} className="green"/>:<Circle size={16}/>}</button>})}<div className="case-side-note"><ShieldCheck size={19}/><p>Preparing or copying a draft doesn’t file a complaint. Submit through the official channel.</p></div><a href={'/api/cases/'+id+'/export.json'} className="text-button"><Download size={15}/> Export case data</a><button className="text-button delete-link" onClick={()=>setDeleting(true)}><Trash2 size={15}/> Delete this case</button></aside>
      <section className="draft-card"><div className="draft-header"><span className="icon-box"><Icon size={21}/></span><div><h2>{channelNames[active]}</h2><p>{active==='helpline'?'Use these notes when you speak with the helpline.':active==='bank'?'Use your bank’s official app, website, phone number or branch.':'Review this draft and submit it on the official portal.'}</p></div></div>
      <div className="draft-label"><span>{active==='helpline'?'CALL NOTES':'PREPARED DRAFT'}</span><button className="text-button" onClick={copy}><Copy size={15}/> Copy text</button></div><textarea className="draft-text" readOnly aria-label="Prepared reporting draft" value={docs?.[active]||'Loading draft…'} rows={12}/>
      <div className="external-action">{active==='helpline'?<a href="tel:1930" className="button primary"><Phone size={16}/> Call 1930 <ArrowUpRight size={16}/></a>:active==='portal'?<a href="https://cybercrime.gov.in/" target="_blank" rel="noreferrer" className="button primary">Open official portal <ArrowUpRight size={17}/></a>:<div className="bank-tip"><Landmark size={20}/><span>Find your bank’s fraud reporting option in its official app or website. Reclaim does not send this letter.</span></div>}<span className="muted small">Keep the reference you receive.</span></div>
      <form className="report-form" onSubmit={save}><h3>{c.reports[active]?'Update your reporting record':'Already contacted them?'}</h3><p>After you contact them, save the date and any reference they give you.</p><div className="fields-grid"><label>Complaint reference <span className="optional">if received</span><input maxLength={100} value={reference} onChange={e=>setReference(e.target.value)} placeholder="Leave empty if pending"/></label><label>When you reported (IST)<input required type="datetime-local" value={reportedAt} onChange={e=>setReportedAt(e.target.value)}/></label></div><label className="confirm-box"><input type="checkbox" required checked={attest} onChange={e=>setAttest(e.target.checked)}/><span>I contacted them at the date and time shown above.</span></label><button className="button secondary" disabled={busy||!attest}>{busy?'Saving…':'Save this step'}<Check size={17}/></button></form>{c.reports[active]&&channels.some(ch=>!c.reports[ch])&&<button className="button primary wide next-action" onClick={()=>{setActive(channels.find(ch=>!c.reports[ch])!);window.scrollTo(0,0)}}>Next: {channelNames[channels.find(ch=>!c.reports[ch])!]} <ArrowRight size={17}/></button>}
      </section></div><div className="gentle-note"><HelpCircle size={18}/><p>{c.policy.message} Be wary of anyone promising recovery for a fee.</p></div>
      {deleting&&<div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="delete-heading"><h2 id="delete-heading">Delete this case?</h2><p>This removes the stored case and reporting records from this demo. Export a copy first if you want to keep it.</p><div className="modal-actions"><button autoFocus className="button secondary" onClick={()=>setDeleting(false)}>Keep case</button><button disabled={busy} className="button danger" onClick={remove}>Delete case</button></div></section></div>}
  </div>
}
function Dashboard(){
  const [cases,setCases]=useState<Case[]>([]);const [error,setError]=useState('');const [filter,setFilter]=useState('all');const [loaded,setLoaded]=useState(false);
  useEffect(()=>{let live=true;let timer:ReturnType<typeof setTimeout>;async function refresh(){try{const data=await api<Case[]>('/cases');if(live){setCases(data);setError('');setLoaded(true)}}catch(e){if(live)setError(errText(e))}finally{if(live)timer=setTimeout(refresh,2500)}}void refresh();return()=>{live=false;clearTimeout(timer)}},[]);
  const complete=cases.filter(c=>c.reports_recorded===3).length;const missing=cases.filter(c=>c.missing_fields.length>0).length;
  const shown=cases.filter(c=>filter==='all'||(filter==='open'?c.reports_recorded<3:c.reports_recorded===3));
  return <div className="inner-page dashboard page-enter"><div className="section-heading"><div><span className="eyebrow">RECLAIM / REVIEW WORKSPACE</span><h1 className="page-title">Clarity on every case.</h1><p className="muted">A local view of the same facts and reporting progress.</p></div><button className="button primary" onClick={()=>go('/prepare')}><Plus size={17}/> New case</button></div><div className="workspace-notice"><Eye size={17}/> Demonstration queue · No bank connection · All statuses entered by users</div>
    <div className="metrics">{[['Cases in workspace',cases.length,'Stored on this machine'],['Reports in progress',cases.length-complete,'Next actions still open'],['All reports recorded',complete,'User attestation only'],['Cases with missing facts',missing,'Details to gather']].map(([title,value,caption])=><div className="metric" key={title}><span>{title}</span><strong>{value}</strong><small>{caption}</small></div>)}</div>
    <section className="queue"><div className="queue-heading"><div><h2>Case queue <span className="count-pill">{cases.length}</span></h2><span className="muted small">Latest 100 cases · refreshes automatically</span></div><div className="segmented" aria-label="Filter cases">{[['all','All cases'],['open','In progress'],['done','Recorded']].map(([key,label])=><button key={key} className={filter===key?'selected':''} onClick={()=>setFilter(key)}>{label}</button>)}</div></div>
    {error&&<div className="error" role="alert">Connection interrupted. {error} Retrying…</div>}
    <div className="table-wrap"><table><thead><tr><th>Case / transaction</th><th>Amount</th><th>Reporting record</th><th>Details</th><th>Status</th><th><span className="sr-only">Open</span></th></tr></thead><tbody>{shown.map(c=><tr key={c.id}><td><strong>{c.id}</strong><small>{c.bank} · {c.method}</small></td><td className="amount-cell">{money(c.amount_paise)}</td><td><div className="report-dots">{channels.map(ch=><span title={channelNames[ch]} key={ch} className={c.reports[ch]?'done':''}>{c.reports[ch]?<Check size={12}/>:<Circle size={10}/>} {ch==='helpline'?'1930':ch==='portal'?'Portal':'Bank'}</span>)}</div></td><td>{c.missing_fields.length?<span className="amber">{c.missing_fields.length} missing</span>:<span className="green">Ready</span>}</td><td><span className={'status-pill '+(c.reports_recorded===3?'done':'')}>{c.reports_recorded===3?'Reports recorded':'In progress'}</span></td><td><button className="icon-button" aria-label={'Open case '+c.id} onClick={()=>go('/case/'+c.id)}><ArrowUpRight size={19}/></button></td></tr>)}</tbody></table></div>
    {!shown.length&&<div className="empty-state"><ClipboardCheck size={34}/><h3>{loaded?'A clear workspace starts with one case.':'Loading cases…'}</h3><p>{loaded?'Create a fictional case to see its reporting progress here.':'Connecting to your local workspace.'}</p>{loaded&&<button className="button secondary" onClick={()=>go('/prepare')}>Prepare a case <ArrowRight size={16}/></button>}</div>}
    </section><div className="queue-footer"><LockKeyhole size={16}/> Local synthetic-data prototype. This queue is not suitable for real victim records.</div>
  </div>
}
function Stage(){return <div className="stage"><header><button className="brand" onClick={()=>go('/')}><ShieldCheck/> reclaim.</button><span>ONE CASE. BOTH SIDES.</span><button className="button secondary" onClick={()=>go('/')}><X size={17}/> Exit presentation</button></header><div className="stage-panels"><section><span className="eyebrow">THE REPORTING ASSISTANT</span><iframe title="Reporting assistant" src="/?embedded=1"/></section><section><span className="eyebrow">THE REVIEW WORKSPACE · DEMO</span><iframe title="Review workspace" src="/bank?embedded=1"/></section></div><footer>Synthetic demonstration · No complaints submitted · No recovery guaranteed</footer></div>}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
