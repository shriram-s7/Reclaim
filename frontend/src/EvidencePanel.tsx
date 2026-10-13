import {useEffect, useState} from 'react';
import {ArrowRight, Check, FileSearch, HelpCircle, Pencil, Plus, Trash2} from 'lucide-react';
import {api, money, date, localInput, fromInput, parsePaise, type Case, type Choice, type Question, type Source, type Transaction} from './api';

const kinds = {receipt:'Payment receipt',bank_message:'Bank message',chat:'Chat message',screenshot:'Screenshot',other:'Other document'};
const fieldNames:Record<string,string> = {amount_paise:'Amount',occurred_at:'Date and time',reference:'Reference',payee:'Recipient'};
const linkText = (status:string, payment?:string, names:Record<string,string> = {}) =>
  status==='linked'?`Used for ${names[payment||'']||'a payment'}`:status==='waiting'?'Waiting for your answer':status==='unrelated'?'You said it is not about your loss':status==='unknown'?'You were not sure · not used':'No payment details found';
const errText = (e:unknown) => e instanceof Error?e.message:'Something went wrong. Try again.';
const shownValue = (field:string, value:string|number|null) => value===null?'Unreadable':field==='amount_paise'?money(Number(value)):field==='occurred_at'?date(String(value)):String(value);

type Props = {c:Case;refresh:()=>Promise<void>;notify:(text:string)=>void};

/** Evidence checks are optional: reporting actions above never wait for them. */
export function EvidencePanel({c,refresh,notify}:Props){
  const r = c.reconciliation;
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  async function run(action:()=>Promise<unknown>, done:string){
    setBusy(true);setError('');
    try{await action();await refresh();if(done)notify(done)}catch(e){setError(errText(e))}finally{setBusy(false)}
  }
  const question = r.questions[0];
  const ready = r.changes.filter(change=>change.type==='update'||change.complete);
  return <section className="evidence-card" id="evidence" aria-labelledby="evidence-heading">
    <div className="draft-header"><span className="icon-box"><FileSearch size={21}/></span><div><h2 id="evidence-heading">Check your evidence</h2><p>Optional. Add a message or receipt and we compare it with your saved details. Reporting does not need to wait.</p></div></div>
    {error&&<p className="error" role="alert">{error}</p>}
    {question?<QuestionCard key={question.id} q={question} index={1} total={r.questions.length} busy={busy}
        onAnswer={(choice,value)=>run(()=>api(`/cases/${c.id}/clarifications/${encodeURIComponent(question.id)}`,{method:'PUT',body:JSON.stringify(value===undefined?{choice}:{choice,value})}),'')}/>
      :r.changes.length>0?<ChangesReview c={c} busy={busy} ready={ready.length}
        onApply={()=>run(()=>api(`/cases/${c.id}/corrections`,{method:'POST',body:JSON.stringify({version:c.facts_version,confirmed:true})}),'Your case and all drafts now use the corrected details.')}/>
      :c.evidence.items.length>0&&<p className="calm-note" role="status"><Check size={16}/> No open questions about your evidence.</p>}
    {r.unsure.length>0&&<div className="unsure"><strong>Still uncertain</strong><ul>{r.unsure.map(u=><li key={u.text}>{u.text}</li>)}</ul><p>Uncertain details are not added to your payments. Drafts list conflicting details you are still checking; unknown details show as “Not provided”.</p></div>}
    <Payments items={c.transactions} total={c.total_paise}/>
    {c.evidence.items.length>0&&<div className="evidence-list"><h3>Evidence you added</h3>{c.evidence.items.map(item=><article key={item.id} className="evidence-item">
      <div><strong>{item.label}</strong><small>{item.origin==='synthetic_fixture'?'Synthetic practice evidence · fixture, not AI':item.origin==='pasted_text'?'Pasted text · local text rules, not AI':'Typed by you'}</small>
        <span className="link-status">{linkText(r.links[item.id]?.status||'',r.links[item.id]?.payment,r.payment_names)}</span>
        <ul>{Object.entries(item.facts).filter(([f])=>fieldNames[f]).map(([f,fact])=><li key={f}>{fieldNames[f]}: <strong>{shownValue(f,fact.value)}</strong>{fact.quote&&<q>{fact.quote}</q>}</li>)}</ul></div>
      <button className="icon-button" disabled={busy} aria-label={'Remove '+item.label} onClick={()=>run(()=>api(`/cases/${c.id}/evidence/${item.id}`,{method:'DELETE'}),'Evidence removed. Your saved payments did not change.')}><Trash2 size={17}/></button></article>)}</div>}
    <AddEvidence busy={busy} onAdd={body=>run(()=>api(`/cases/${c.id}/evidence`,{method:'POST',body:JSON.stringify(body)}),'Evidence added. Answer any questions below it.')}/>
    <details className="demo-tools"><summary>Practice with fictional evidence</summary><p className="small">These are labelled synthetic fixtures for the sample ₹18,000 case. They show how checks work; they are not AI reading.</p><div className="answer-options">
      {[['amount-conflict','Receipt and message disagree'],['possible-duplicate','Two screenshots of one payment?'],['unreadable-reference','Reference cannot be read']].map(([key,label])=><button key={key} className="button secondary" disabled={busy||c.evidence.items.length>=18} onClick={()=>run(()=>api(`/cases/${c.id}/evidence/practice/${key}`,{method:'POST'}),'Practice evidence added.')}>{label}</button>)}</div></details>
    {r.answered.length>0&&<details className="demo-tools"><summary>Your answers ({r.answered.length})</summary><ul className="answer-list">{r.answered.map(q=><li key={q.id}><span>{q.text}</span><strong>{answerText(q)}</strong><button className="text-button" disabled={busy} onClick={()=>run(()=>api(`/cases/${c.id}/clarifications/${encodeURIComponent(q.id)}`,{method:'DELETE'}),'')}>Change</button></li>)}</ul><p className="small">Changing an answer never removes a payment you already confirmed. Use “Correct my saved details” for that.</p></details>}
    <CorrectDetails c={c} busy={busy} onSave={body=>run(()=>api(`/cases/${c.id}/facts`,{method:'PUT',body:JSON.stringify(body)}),'Details corrected. All drafts were updated.')}/>
    {c.corrections.length>0&&<div className="history"><h3>Corrections you confirmed</h3><ul>{c.corrections.slice().reverse().map(entry=><li key={entry.version}><small>{date(entry.at)}</small>{entry.changes.map(change=><span key={change.label}>{change.label}: {change.before_text?`${change.before_text} → `:''}<strong>{change.after_text}</strong></span>)}</li>)}</ul></div>}
    <p className="small"><HelpCircle size={14}/> {r.note}</p>
  </section>
}

function answerText(q:Question){
  const a=q.answer;if(!a)return '';
  if(a.choice==='value')return q.choices.find(c=>c.value!==undefined&&String(c.value)===String(a.value))?.label||(q.kind.startsWith('fill:')?'Yes, add it':'Chosen value');
  if(a.choice==='enter')return 'You entered: '+(q.field?shownValue(q.field,a.value??null):String(a.value));
  return q.choices.find(c=>c.id===a.choice)?.label||a.choice;
}

function SourceLine({s}:{s:Source}){return <li><span>{s.label}{s.field?` · ${s.field}: ${s.value}`:''}</span><small>{s.origin}</small>{s.quote&&<q>{s.quote}</q>}</li>}

function QuestionCard({q,index,total,busy,onAnswer}:{q:Question;index:number;total:number;busy:boolean;onAnswer:(choice:string,value?:string|number)=>void}){
  const [entering,setEntering] = useState<Choice|null>(null);
  const [text,setText] = useState('');
  const [problem,setProblem] = useState('');
  function submit(event:React.FormEvent){event.preventDefault();setProblem('');
    if(entering?.input==='amount_paise'){const paise=parsePaise(text);if(paise===null){setProblem('Enter the amount as a number, for example 18000.');return}onAnswer('enter',paise);return}
    if(entering?.input==='occurred_at'){if(!text){setProblem('Choose the date and time.');return}onAnswer('enter',fromInput(text));return}
    if(!text.trim()){setProblem('Type it, or choose “I don’t know”.');return}onAnswer('enter',text.trim());
  }
  return <div className="question-card" role="group" aria-labelledby={'q-'+q.id}>
    <span className="eyebrow">QUESTION {index} OF {total}</span>
    <h3 id={'q-'+q.id}>{q.text}</h3>{q.help&&<p>{q.help}</p>}
    {q.reasons.length>0&&<ul className="reasons">{q.reasons.map(reason=><li key={reason}>{reason}</li>)}</ul>}
    {q.sources.length>0&&<div className="sources"><span className="eyebrow">WHERE THIS CAME FROM</span><ul>{q.sources.map((s,i)=><SourceLine key={i} s={s}/>)}</ul></div>}
    {!entering?<div className="choice-list">{q.choices.map(choice=><button key={choice.id} className={'button '+(choice.id==='unknown'?'secondary quiet':'secondary')} disabled={busy}
        onClick={()=>choice.input?(setEntering(choice),setText('')):onAnswer(choice.id)}>
        <span>{choice.label}</span>{choice.sources&&<small>From: {choice.sources.map(s=>s.label+(s.quote?` (“${s.quote}”)`:'')).join(' · ')}</small>}</button>)}</div>
    :<form onSubmit={submit} className="enter-form"><label>{fieldNames[entering.input||'']||'Value'}
        {entering.input==='occurred_at'?<input type="datetime-local" required value={text} max={localInput(new Date().toISOString())} onChange={e=>setText(e.target.value)}/>
        :<input inputMode={entering.input==='amount_paise'?'decimal':'text'} maxLength={entering.input==='payee'?200:100} value={text} autoFocus onChange={e=>setText(e.target.value)}
           placeholder={entering.input==='amount_paise'?'e.g. 18000':'Type exactly as shown'}/>}</label>
      {problem&&<p className="error" role="alert">{problem}</p>}
      <div className="answer-options"><button className="button primary" disabled={busy}>Save answer <ArrowRight size={16}/></button><button type="button" className="text-button" onClick={()=>setEntering(null)}>Back</button></div></form>}
  </div>
}

function ChangesReview({c,busy,ready,onApply}:{c:Case;busy:boolean;ready:number;onApply:()=>void}){
  const [checked,setChecked] = useState(false);
  useEffect(()=>setChecked(false),[c.facts_version,c.reconciliation.changes.length]);
  return <div className="question-card changes">
    <span className="eyebrow">CHECK BEFORE ANYTHING CHANGES</span><h3>Your answers suggest {c.reconciliation.changes.length===1?'this change':'these changes'}</h3>
    <ul>{c.reconciliation.changes.map(change=><li key={change.id}>{change.type==='update'?<>{change.label}: {change.before_text} → <strong>{change.after_text}</strong></>:<>{change.label}: <strong>{change.after_text||'details unknown'}</strong>{change.blocked&&<em> {change.blocked}</em>}</>}</li>)}</ul>
    {ready>0?<><label className="confirm-box"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/><span>I have checked {ready===1?'this change':'these changes'} against my original evidence. Update my case and every draft.</span></label>
      <button className="button primary" disabled={!checked||busy} onClick={onApply}>Update my case <Check size={17}/></button></>
    :<p>Nothing can be added yet. Answer the missing details, or leave it: your reporting is not blocked.</p>}
  </div>
}

function Payments({items,total}:{items:Transaction[];total:number}){
  return <div className="payments"><h3>Payments in your case</h3><ul>{items.map((t,i)=><li key={t.id}><span>Payment {i+1}</span><strong>{money(t.amount_paise)}</strong><small>{date(t.occurred_at)} · {t.method} · Ref: {t.reference||'not known'}</small></li>)}</ul>
    {items.length>1&&<p className="total">Total confirmed by you: <strong>{money(total)}</strong></p>}</div>
}

type EvidenceBody = {kind:string;text?:string;typed?:Record<string,string|number|boolean>};
function AddEvidence({busy,onAdd}:{busy:boolean;onAdd:(body:EvidenceBody)=>Promise<void>}){
  const [open,setOpen] = useState(false);
  const [kind,setKind] = useState('bank_message');
  const [mode,setMode] = useState<'text'|'typed'>('text');
  const [text,setText] = useState('');
  const [amount,setAmount] = useState('');const [when,setWhen] = useState('');
  const [reference,setReference] = useState('');const [unreadable,setUnreadable] = useState(false);const [payee,setPayee] = useState('');
  const [problem,setProblem] = useState('');
  async function submit(event:React.FormEvent){event.preventDefault();setProblem('');
    if(mode==='text'){if(!text.trim()){setProblem('Paste the message text.');return}await onAdd({kind,text});setText('');setOpen(false);return}
    const typed:Record<string,string|number|boolean> = {};
    if(amount){const paise=parsePaise(amount);if(paise===null){setProblem('Enter the amount as a number, for example 18000.');return}typed.amount_paise=paise}
    if(when)typed.occurred_at=fromInput(when);
    if(unreadable)typed.reference_unreadable=true;else if(reference.trim())typed.reference=reference.trim();
    if(payee.trim())typed.payee=payee.trim();
    if(!Object.keys(typed).length){setProblem('Enter at least one detail this evidence shows.');return}
    await onAdd({kind,typed});setAmount('');setWhen('');setReference('');setUnreadable(false);setPayee('');setOpen(false);
  }
  if(!open)return <button className="button secondary" onClick={()=>setOpen(true)}><Plus size={16}/> Add evidence</button>;
  return <form className="add-evidence" onSubmit={submit}><h3>Add evidence</h3>
    <div className="fields-grid"><label>What is it?<select value={kind} onChange={e=>setKind(e.target.value)}>{Object.entries(kinds).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
      <label>How will you add it?<select value={mode} onChange={e=>setMode(e.target.value as 'text'|'typed')}><option value="text">Paste the message text</option><option value="typed">Type what it shows</option></select></label></div>
    {mode==='text'?<label className="full-label">Message text<textarea rows={3} maxLength={4000} value={text} onChange={e=>setText(e.target.value)} placeholder="Paste a fictional message. Do not paste OTPs, PINs or passwords."/></label>
    :<div className="fields-grid"><label>Amount shown <span className="optional">if shown</span><input inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="e.g. 18000"/></label>
      <label>Date and time shown <span className="optional">if shown</span><input type="datetime-local" value={when} min="2000-01-01T00:00" max={localInput(new Date().toISOString())} onChange={e=>setWhen(e.target.value)}/></label>
      <label>Reference shown <span className="optional">if readable</span><input maxLength={100} value={reference} disabled={unreadable} onChange={e=>setReference(e.target.value)} placeholder="Type exactly as shown"/></label>
      <label>Recipient shown <span className="optional">if shown</span><input maxLength={200} value={payee} onChange={e=>setPayee(e.target.value)}/></label>
      <label className="confirm-box"><input type="checkbox" checked={unreadable} onChange={e=>{setUnreadable(e.target.checked);if(e.target.checked)setReference('')}}/><span>There is a reference, but I can’t read it</span></label></div>}
    <p className="small">Images are not read or stored in this prototype. Text is checked by local rules on this machine.</p>
    {problem&&<p className="error" role="alert">{problem}</p>}
    <div className="answer-options"><button className="button primary" disabled={busy}>Add and check <ArrowRight size={16}/></button><button type="button" className="text-button" onClick={()=>setOpen(false)}>Cancel</button></div></form>
}

function CorrectDetails({c,busy,onSave}:{c:Case;busy:boolean;onSave:(body:Record<string,unknown>)=>Promise<void>}){
  const [open,setOpen] = useState(false);
  const [paymentId,setPaymentId] = useState('T1');
  const payment = c.transactions.find(t=>t.id===paymentId)||c.transactions[0];
  const initial = ()=>({amount:String(payment.amount_paise/100),when:localInput(payment.occurred_at),reference:payment.reference,payee:payment.payee,method:payment.method,bank:c.bank,description:c.description});
  const [form,setForm] = useState(initial);
  const [checked,setChecked] = useState(false);const [problem,setProblem] = useState('');
  useEffect(()=>{setForm(initial());setChecked(false)},[paymentId,c.facts_version,open]);
  const set = (key:keyof ReturnType<typeof initial>) => (e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) => {setForm(f=>({...f,[key]:e.target.value}));setChecked(false)};
  async function submit(event:React.FormEvent){event.preventDefault();setProblem('');
    const body:Record<string,unknown> = {version:c.facts_version,confirmed:true,transaction_id:payment.id};
    const paise=parsePaise(form.amount);if(paise===null){setProblem('Enter the amount as a number, for example 18000.');return}
    if(paise!==payment.amount_paise)body.amount_paise=paise;
    if(!form.when){setProblem('Enter the date and time of the payment.');return}
    if(Math.floor(Date.parse(fromInput(form.when))/60000)!==Math.floor(Date.parse(payment.occurred_at)/60000))body.occurred_at=fromInput(form.when);
    if(form.reference.trim()!==payment.reference)body.reference=form.reference.trim();
    if(form.payee.trim()!==payment.payee)body.payee=form.payee.trim();
    if(form.method!==payment.method)body.method=form.method;
    if(form.bank.trim()!==c.bank)body.bank=form.bank.trim();
    if(form.description.trim()!==c.description)body.description=form.description.trim();
    if(Object.keys(body).length===3){setProblem('Nothing has changed.');return}
    await onSave(body);setOpen(false);
  }
  if(!open)return <button className="text-button correct-link" onClick={()=>setOpen(true)}><Pencil size={15}/> Correct my saved details</button>;
  return <form className="add-evidence" onSubmit={submit}><h3>Correct my saved details</h3><p className="small">Changes replace your saved details and every draft. Reports you already saved keep their times and references.</p>
    {c.transactions.length>1&&<label>Which payment?<select value={paymentId} onChange={e=>setPaymentId(e.target.value)}>{c.transactions.map((t,i)=><option key={t.id} value={t.id}>Payment {i+1} · {money(t.amount_paise)}</option>)}</select></label>}
    <div className="fields-grid"><label>Amount (₹)<input inputMode="decimal" value={form.amount} onChange={set('amount')}/></label>
      <label>Date and time (IST)<input type="datetime-local" required min="2000-01-01T00:00" max={localInput(new Date().toISOString())} value={form.when} onChange={set('when')}/></label>
      <label>Reference <span className="optional">leave empty if unknown</span><input maxLength={100} value={form.reference} onChange={set('reference')}/></label>
      <label>Recipient <span className="optional">leave empty if unknown</span><input maxLength={200} value={form.payee} onChange={set('payee')}/></label>
      <label>Payment method<select value={form.method} onChange={set('method')}><option>UPI</option><option>Card</option><option>Net banking</option><option>Other</option></select></label>
      <label>Your bank<input maxLength={100} value={form.bank} onChange={set('bank')}/></label></div>
    <label className="full-label">What happened<textarea rows={3} maxLength={4000} value={form.description} onChange={set('description')}/></label>
    <label className="confirm-box"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/><span>I have checked these corrected details. Replace my saved details and update every draft.</span></label>
    {problem&&<p className="error" role="alert">{problem}</p>}
    <div className="answer-options"><button className="button primary" disabled={!checked||busy}>Save correction <Check size={16}/></button><button type="button" className="text-button" onClick={()=>setOpen(false)}>Cancel</button></div></form>
}
