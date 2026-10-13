import {ApiError, type ApiProblem, type Msg} from './i18n';
export type Channel = 'helpline' | 'bank' | 'portal';
export type StepState = {channel: Channel; state: 'not_started' | 'later' | 'no_answer' | 'waiting' | 'resolved'; remind_at: string | null; due: boolean; reported: boolean; reference: string | null};
export type JourneyPlan = {steps: StepState[]; next_channel: Channel | null; reason: string; reason_msg: Msg};
export type Facts = {amount_paise: number; occurred_at: string; bank: string; method: 'UPI' | 'Card' | 'Net banking' | 'Other'; reference: string; payee: string; description: string; source: 'manual' | 'sample' | 'fixture' | 'text' | 'ai_provider'};
export type Report = {reference: string; reported_at: string; recorded_at: string; updated_at: string};
export type Source = {evidence_id?: string; label: string; label_msg?: Msg; origin: string; origin_msg?: Msg; quote: string; quote_verified?: boolean | null; field?: string; value?: string | number | null; unreadable?: boolean};
export type Choice = {id: string; label: string; label_msg: Msg; value?: string | number; input?: string; sources?: Source[]};
export type Question = {id: string; kind: string; text: string; text_msg: Msg; help: string; help_msg: Msg; why_msg: Msg; reasons: string[]; reason_msgs?: Msg[]; sources: Source[]; choices: Choice[]; payment?: string; field?: string; deferred?: boolean; answer?: {choice: string; value?: string | number}};
export type Change = {id: string; type: 'update' | 'add'; label: string; label_msg: Msg; field?: string; before?: string | number | null; after?: string | number | null; transaction?: Partial<Transaction>; complete?: boolean; blocked?: string; blocked_msg?: Msg | null};
export type Unsure = {text: string; text_msg?: Msg; conflict?: boolean};
export type Reconciliation = {questions: Question[]; answered: Question[]; changes: Change[]; unsure: Unsure[]; links: Record<string, {status: string; payment?: string}>; payment_names: Record<string, Msg>; note_msg: Msg};
export type Transaction = {id: string; amount_paise: number; occurred_at: string; reference: string; payee: string; method: Facts['method']};
export type Fact = {value: string | number | null; status: 'read' | 'unreadable'; quote: string; quote_verified?: boolean | null};
export type EvidenceItem = {id: string; kind: string; origin: string; label: string; label_msg?: Msg; text: string; added_at: string; facts: Record<string, Fact>; provider?: {name: string; model: string}};
export type CorrectionChange = {label: string; label_msg?: Msg; field?: string; before?: string | number | null; after?: string | number | null; before_text?: string; after_text: string};
export type Correction = {version: number; at: string; source: string; changes: CorrectionChange[]};
export type Case = Facts & {transactions: Transaction[]; total_paise: number; facts_version: number; corrections: Correction[]; evidence: {items: EvidenceItem[]}; reconciliation: Reconciliation; plan?: JourneyPlan; id: string; created_at: string; reports: Partial<Record<Channel, Report>>; status: string; reports_recorded: number; missing_fields: string[]};
export type Docs = Record<Channel, string>;
export type Reading = {status: 'read' | 'manual' | 'needs_consent' | 'unavailable' | 'failed'; source: 'ai_provider' | 'pasted_text' | 'synthetic_fixture' | null; facts: Record<string, Fact>; notes: Msg[]; fields: Partial<Facts>; reading_id?: string; provider?: {name: string; model: string} | null};
export type ProviderStatus = {provider: string; model: string; enabled: boolean; missing: string[]; timeout_seconds: number};

/** Calls the local API. Failures become ApiError with message codes for translation. */
export async function api<T>(path: string, init: RequestInit = {}, timeoutMs = 15000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  init.signal?.addEventListener('abort', () => controller.abort());
  try {
    const response = await fetch('/api' + path, {...init, signal: controller.signal,
      headers: {...(init.body && !(init.body instanceof FormData) ? {'Content-Type': 'application/json'} : {}), ...init.headers}});
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const detail = body.detail;
      const problems: ApiProblem[] = Array.isArray(detail) ? detail : detail && typeof detail === 'object' ? [detail] : [{code: 'err.generic'}];
      throw new ApiError(problems.map(p => ({...p, code: p.code || 'err.generic'})), response.status);
    }
    return response.status === 204 ? undefined as T : await response.json();
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e instanceof Error && e.name === 'AbortError') throw new ApiError([{code: init.signal?.aborted ? 'err.cancelled' : 'err.timeout_client'}]);
    throw new ApiError([{code: 'err.network'}]);
  } finally { clearTimeout(timeout); }
}
export const localInput = (value: string) => new Date(new Date(value).getTime() + 330 * 60000).toISOString().slice(0, 16);
export const fromInput = (value: string) => new Date(value + '+05:30').toISOString();
export async function downloadPDF(id: string) {
  const response = await fetch('/api/cases/' + id + '/pack.pdf', {signal: AbortSignal.timeout(15000)}).catch(() => null);
  if (!response) throw new ApiError([{code: 'err.network'}]);
  if (!response.ok) { const result = await response.json().catch(() => ({})); throw new ApiError([result.detail?.code ? result.detail : {code: 'err.generic'}]); }
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = id + '-case-pack.pdf'; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
// Accepts what people type: ₹18,000 · Rs. 1,80,000 · INR 18000.50
export function parsePaise(text: string): number | null {
  const cleaned = text.trim().replace(/^(₹|rs\.?|inr)\s*/i, '').replace(/[,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned) || Number(cleaned) <= 0) return null;
  return Math.round(Number(cleaned) * 100);
}
