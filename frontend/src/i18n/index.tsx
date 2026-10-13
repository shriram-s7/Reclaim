import {createContext, useContext, useEffect, useMemo, useState, type ReactNode} from 'react';
import en from './en.json';
import ta from './ta.json';

/** Translation system. en.json is the single English source (the backend reads it too);
 *  ta.json must have exactly the same keys and placeholders (checked by backend tests).
 *  Tamil is awaiting native-speaker review; it is labelled as such in the interface. */
export type Lang = 'en' | 'ta';
export type Params = Record<string, unknown>;
export type Msg = {key: string; params?: Params};
type Catalog = Record<string, string>;
const catalogs: Record<Lang, Catalog> = {en, ta: ta as Catalog};
const STORAGE_KEY = 'reclaim-lang';

const isMsg = (value: unknown): value is Msg => typeof value === 'object' && value !== null && 'key' in value;

export function makeT(lang: Lang) {
  const catalog = catalogs[lang];
  const locale = lang === 'ta' ? 'ta-IN' : 'en-IN';
  const money = (paise: number) => new Intl.NumberFormat(locale, {style: 'currency', currency: 'INR', maximumFractionDigits: paise % 100 ? 2 : 0}).format(paise / 100);
  const date = (iso: string) => new Intl.DateTimeFormat(locale, {dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata'}).format(new Date(iso)) + ' ' + (catalog['time.ist'] ?? en['time.ist']);
  function param(name: string, value: unknown, params: Params): string {
    if (isMsg(value)) return t(value.key, value.params);
    if (Array.isArray(value)) return value.map(v => param(name, v, params)).join('; ');
    if (value === null || value === undefined || value === '') return t('value.unknown');
    if (name.endsWith('_paise') && typeof value === 'number') return money(value);
    if (name.endsWith('_at') && typeof value === 'string') return date(value);
    if (name === 'field' || name === 'kind' || name === 'channel') return t(`${name}.${value}`);
    if (name === 'value' && (params.field === 'amount_paise' || params.field === 'occurred_at')) return param(String(params.field), value, {});
    return String(value);
  }
  function t(key: string, params: Params = {}): string {
    const template = catalog[key] ?? (en as Catalog)[key];
    if (template === undefined) return key;
    return template.replace(/\{(\w+)\}/g, (_, name: string) => name in params ? param(name, params[name], params) : `{${name}}`);
  }
  const m = (message?: Msg | null) => message ? t(message.key, message.params) : '';
  return {t, m, money, date, lang};
}

export type ApiProblem = {code: string; params?: Params; field?: string; message?: string};
/** Errors from api() carry coded problems; render them in the current language. */
export class ApiError extends Error {
  constructor(public problems: ApiProblem[], public status = 0) { super(problems.map(p => p.message || p.code).join(' ')); }
}

type I18n = ReturnType<typeof makeT> & {setLang: (lang: Lang) => void; errorText: (error: unknown) => string};
const Context = createContext<I18n | null>(null);

export function LanguageProvider({children}: {children: ReactNode}) {
  const [lang, setLang] = useState<Lang>(() => localStorage.getItem(STORAGE_KEY) === 'ta' ? 'ta' : 'en');
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
    document.title = makeT(lang).t('app.title');
  }, [lang]);
  const value = useMemo(() => {
    const base = makeT(lang);
    const errorText = (error: unknown) => {
      if (error instanceof ApiError) return error.problems.map(p => p.field && p.code.startsWith('err.type.')
        ? base.t('err.field_prefix', {label: base.t(`field.${p.field}`), message: base.t(p.code, p.params)})
        : base.t(p.code, p.params)).join(' ');
      return base.t('err.generic');
    };
    return {...base, setLang, errorText};
  }, [lang]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useI18n(): I18n {
  const value = useContext(Context);
  if (!value) throw new Error('useI18n must be used inside LanguageProvider');
  return value;
}
