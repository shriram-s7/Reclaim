import type {JourneyPlan} from './GuidedStep';
export type Channel = 'helpline' | 'bank' | 'portal';
export type Facts = {amount_paise:number; occurred_at:string; bank:string; method:'UPI'|'Card'|'Net banking'|'Other'; reference:string; payee:string; description:string; source:'manual'|'sample'|'fixture'|'text'};
export type Report = {reference:string;reported_at:string;recorded_at:string;updated_at:string};
export type Source = {evidence_id?:string;label:string;origin:string;quote:string;field?:string;value?:string};
export type Choice = {id:string;label:string;value?:string|number;input?:string;sources?:Source[]};
export type Question = {id:string;kind:string;text:string;help:string;reasons:string[];sources:Source[];choices:Choice[];payment?:string;field?:string;answer?:{choice:string;value?:string|number}};
export type Change = {id:string;type:'update'|'add';label:string;before_text?:string;after_text:string;complete?:boolean;blocked?:string};
export type Reconciliation = {questions:Question[];answered:Question[];changes:Change[];unsure:{text:string;field?:string}[];links:Record<string,{status:string;payment?:string}>;payment_names:Record<string,string>;note:string};
export type Transaction = {id:string;amount_paise:number;occurred_at:string;reference:string;payee:string;method:Facts['method']};
export type EvidenceItem = {id:string;kind:string;origin:string;label:string;text:string;added_at:string;facts:Record<string,{value:string|number|null;status:'read'|'unreadable';quote:string}>};
export type Correction = {version:number;at:string;source:string;changes:{label:string;before_text?:string;after_text:string}[]};
export type Case = Facts & {transactions:Transaction[];total_paise:number;facts_version:number;corrections:Correction[];evidence:{items:EvidenceItem[]};reconciliation:Reconciliation;plan?:JourneyPlan;id:string;created_at:string;reports:Partial<Record<Channel,Report>>;status:string;reports_recorded:number;missing_fields:string[];policy:{status:string;message:string}};
export type Docs = Record<Channel,string>;
export async function api<T>(path:string, init:RequestInit = {}):Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch('/api'+path, {...init, signal:controller.signal,
      headers: {...(init.body && !(init.body instanceof FormData) ? {'Content-Type':'application/json'} : {}), ...init.headers}});
    if (!response.ok) {
      const body = await response.json().catch(()=>({}));
      const fields:Record<string,string>={bank:'Bank',amount_paise:'Amount',occurred_at:'Transaction time',reported_at:'Reporting time',remind_at:'Reminder time',description:'What happened',reference:'Reference'};
      throw new Error(typeof body.detail === 'string' ? body.detail : Array.isArray(body.detail)?body.detail.map((item:{loc:string[];msg:string})=>(fields[item.loc[item.loc.length-1]]||'Details')+': '+item.msg.replace('Value error, ','')).join(' '):'Check the fields and try again.');
    }
    return response.status === 204 ? undefined as T : await response.json();
  } catch(e) {
    if(e instanceof Error && e.name === 'AbortError') throw new Error('The request took too long. Check the local server and try again.');
    throw e;
  } finally { clearTimeout(timeout); }
}
export const money = (paise:number) => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:paise%100?2:0}).format(paise/100);
export const date = (value:string) => new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'}).format(new Date(value))+' IST';
export const localInput = (value:string) => new Date(new Date(value).getTime()+330*60000).toISOString().slice(0,16);
export const fromInput = (value:string) => new Date(value+'+05:30').toISOString();
export async function downloadPDF(id:string){
  const response=await fetch('/api/cases/'+id+'/pack.pdf',{signal:AbortSignal.timeout(15000)});
  if(!response.ok){const result=await response.json();throw new Error(result.detail||'Could not prepare this PDF.');}
  const url=URL.createObjectURL(await response.blob());
  const anchor=document.createElement('a');anchor.href=url;anchor.download=id+'-case-pack.pdf';anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
// Accepts what people type: ₹18,000 · Rs. 1,80,000 · INR 18000.50
export function parsePaise(text:string):number|null{
  const cleaned=text.trim().replace(/^(₹|rs\.?|inr)\s*/i,'').replace(/[,\s]/g,'');
  if(!/^\d+(\.\d{1,2})?$/.test(cleaned)||Number(cleaned)<=0)return null;
  return Math.round(Number(cleaned)*100);
}
