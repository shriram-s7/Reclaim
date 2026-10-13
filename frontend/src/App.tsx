import {useEffect, useState} from 'react';
import {CheckCircle2, LayoutDashboard, LockKeyhole, Monitor, ShieldCheck} from 'lucide-react';
import {useI18n} from './i18n';
import {go} from './nav';
import {Home} from './Home';
import {Prepare} from './Prepare';
import {CaseView} from './CaseView';
import {Dashboard, Stage} from './Reviewer';

export function App() {
  const {t, lang, setLang} = useI18n();
  const [path, setPath] = useState(location.pathname);
  const [toast, setToast] = useState('');
  useEffect(() => {const fn = () => setPath(location.pathname); addEventListener('popstate', fn); return () => removeEventListener('popstate', fn)}, []);
  useEffect(() => {if (toast) {const timer = setTimeout(() => setToast(''), 4500); return () => clearTimeout(timer)}}, [toast]);
  if (path === '/stage') return <Stage/>;
  const embedded = new URLSearchParams(location.search).has('embedded');
  return <div className={'app-shell ' + (path === '/bank' ? 'review-shell ' : 'citizen-shell ') + (embedded ? 'embedded' : '')}>
    <aside className="sidebar">
      <button className="brand" onClick={() => go('/')} aria-label={t('app.home_label')}><span className="brand-symbol"><ShieldCheck size={22}/></span>reclaim<span className="brand-dot">.</span></button>
      <div className="workspace-label">{t('app.workspace_label')}</div>
      <nav aria-label={t('nav.label')}>
        <button className={!path.startsWith('/bank') ? 'nav-item active' : 'nav-item'} onClick={() => go('/')}><ShieldCheck size={19}/> {t('nav.assistant')}</button>
        <button className={path === '/bank' ? 'nav-item active' : 'nav-item'} onClick={() => go('/bank')}><LayoutDashboard size={19}/> {t('nav.review')} <span className="tiny-pill">{t('nav.demo_pill')}</span></button>
        <button className="nav-item" onClick={() => go('/stage')}><Monitor size={19}/> {t('nav.presentation')}</button>
      </nav>
      <div className="sidebar-note"><div className="small-icon"><LockKeyhole size={19}/></div><strong>{t('sidebar.title')}</strong><p>{t('sidebar.text')}</p><span>{t('sidebar.safety')}</span></div>
      <div className="sidebar-footer"><span className="online-dot"/> {t('sidebar.footer')} <span>v0.2</span></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><button className="mobile-brand" onClick={() => go('/')} aria-label={t('app.home_label')}>reclaim.</button><span>{t('app.tagline')}</span>
        <div><button className="lang-toggle" onClick={() => setLang(lang === 'en' ? 'ta' : 'en')} lang={lang === 'en' ? 'ta' : 'en'} aria-label={t('lang.switch_label')}>{lang === 'en' ? 'தமிழ்' : 'English'}</button>
          <span className="demo-label">{t('app.demo_label')}</span><span className="avatar">R</span></div></header>
      {lang === 'ta' && <p className="review-notice" role="note">{t('lang.review_notice')}</p>}
      <main>{path === '/bank' ? <Dashboard/> : path.startsWith('/case/') ? <CaseView id={path.split('/')[2]} notify={setToast}/> : path === '/prepare' ? <Prepare notify={setToast}/> : <Home/>}</main>
      <footer className="page-footer"><ShieldCheck size={14}/> {t('footer.disclaimer')}<span>{t('footer.tagline')}</span></footer>
    </div>
    {toast && <div className="toast" role="status"><CheckCircle2 size={18}/>{toast}</div>}
  </div>;
}
