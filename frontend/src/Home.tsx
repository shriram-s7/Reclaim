import {useState} from 'react';
import {ArrowRight, ArrowUpRight, Check, Clock3, HelpCircle, LockKeyhole, Phone, ShieldCheck} from 'lucide-react';
import {useI18n} from './i18n';
import {channels, go, icons} from './nav';

export function Home() {
  const {t} = useI18n();
  const [resume] = useState(() => localStorage.getItem('reclaim-case'));
  return <div className="home page-enter">
    <div className="eyebrow"><span/> {t('home.eyebrow')}</div>
    <div className="hero-grid">
      <section className="hero-copy"><h1>{t('home.title')}<br/><em>{t('home.title_em')}</em></h1><p className="hero-description">{t('home.description')}</p>
        <div className="hero-actions"><button className="button primary" onClick={() => go('/prepare')}>{t('home.start')} <ArrowRight size={18}/></button>{resume && <button className="text-button" onClick={() => go('/case/' + resume)}>{t('home.continue')} <ArrowUpRight size={16}/></button>}</div>
        <div className="trust-line"><span><Check size={15}/> {t('home.no_account')}</span><span><Check size={15}/> {t('home.in_control')}</span></div>
      </section>
      <section className="case-preview" aria-label={t('home.preview_label')}><div className="preview-top"><span><span className="mini-symbol"><ShieldCheck size={16}/></span> {t('home.preview_top')}</span><span className="tiny-pill">{t('home.preview_pill')}</span></div>
        <div className="preview-title">{t('home.preview_title')}</div><div className="preview-line"/>
        {[1, 2, 3].map(n => <div className="preview-step" key={n}><span className={'step-orb ' + (n === 1 ? 'filled' : '')}>{n === 1 ? <Check size={16}/> : '0' + n}</span><div><strong>{t(`home.preview_step${n}`)}</strong><small>{t(`home.preview_step${n}_sub`)}</small></div>{n === 1 && <span className="soft-badge">{t('home.preview_start')}</span>}</div>)}
        <div className="preview-bottom"><LockKeyhole size={15}/> {t('home.preview_local')}</div>
      </section>
    </div>
    <section className="urgent-strip"><div className="urgent-icon"><Clock3 size={23}/></div><div><strong>{t('urgent.title')}</strong><p>{t('urgent.text')}</p></div><a className="button call" href="tel:1930"><Phone size={16}/> {t('urgent.call')} <ArrowUpRight size={15}/></a></section>
    <div className="section-heading"><div><span className="eyebrow">{t('home.actions_eyebrow')}</span><h2>{t('home.actions_title')}</h2></div><span className="muted">{t('home.actions_sub')}</span></div>
    <div className="action-grid">{channels.map((channel, i) => {const Icon = icons[channel]; return <article className="action-card" key={channel}><div className="action-card-top"><Icon size={22}/><span>0{i + 1}</span></div><h3>{t(`action.${channel}`)}</h3><p>{t(`home.action_${channel}`)}</p><button className="text-button" onClick={() => go('/prepare')}>{t(`home.prepare_${channel}`)} <ArrowRight size={16}/></button></article>})}</div>
    <div className="gentle-note"><HelpCircle size={18}/><p>{t('home.already')}</p></div>
  </div>;
}
