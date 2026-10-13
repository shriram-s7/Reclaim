export type Channel = 'helpline' | 'bank' | 'portal';
export type Facts = {amount_paise:number; occurred_at:string; bank:string; method:'UPI'|'Card'|'Net banking'|'Other'; reference:string; payee:string; description:string; source:'manual'|'sample'|'fixture'|'text'};
export type Report = {reference:string;reported_at:string;recorded_at:string;updated_at:string};
export type Case = Facts & {id:string;created_at:string;reports:Partial<Record<Channel,Report>>;status:string;reports_recorded:number;missing_fields:string[];policy:{status:string;message:string}};
export type Docs = Record<Channel,string>;
export async function api<T>(path:string, init:RequestInit = {}):Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch('/api'+path, {...init, signal:controller.signal,
      headers: {...(init.body && !(init.body instanceof FormData) ? {'Content-Type':'application/json'} : {}), ...init.headers}});
    if (!response.ok) {
      const body = await response.json().catch(()=>({}));
      throw new Error(typeof body.detail === 'string' ? body.detail : 'Check the fields and try again.');
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
