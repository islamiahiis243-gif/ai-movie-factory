import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Film, User, Globe, LogIn, LogOut, Database, ShieldAlert } from 'lucide-react';
import { LanguageCode, CurrencyCode } from '../../types/database';
import { REGIONAL_CURRENCIES } from '../../lib/multilingualAdapters';

interface NavbarProps {
  onOpenAuth: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenNewProject: () => void;
}

const LANGUAGES: { code: LanguageCode; label: string; flag: string }[] = [
  { code: 'id', label: 'ID', flag: '🇮🇩' },
  { code: 'en', label: 'EN', flag: '🇺🇸' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'es', label: 'ES', flag: '🇪🇸' },
];

export const Navbar: React.FC<NavbarProps> = ({
  onOpenAuth,
  activeTab,
  setActiveTab,
  onOpenNewProject,
}) => {
  const { user, profile, language, setLanguage, currency, setCurrency, t, isConfigured, signOut } = useAuth();

  return (
    <header className="h-16 border-b border-slate-800/80 bg-[#0B0F17]/95 backdrop-blur-md sticky top-0 z-40 px-6 flex items-center justify-between gap-8">
      {/* Zone 1: Single text element wordmark in display face */}
      <button 
        onClick={() => setActiveTab('dashboard')} 
        className="flex items-center gap-2.5 text-left transition-opacity hover:opacity-90 shrink-0 cursor-pointer"
      >
        <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
          <Film className="w-4 h-4" />
        </div>
        <span className="text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0">
          AI MOVIE FACTORY
        </span>
      </button>

      {/* Zone 2: 4-5 clean single-line navigation links */}
      <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer hover:text-white ${
            activeTab === 'dashboard' ? 'text-amber-400' : 'text-slate-400'
          }`}
        >
          {t.nav.dashboard}
        </button>
        <button
          onClick={() => setActiveTab('projects')}
          className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer hover:text-white ${
            activeTab === 'projects' ? 'text-amber-400' : 'text-slate-400'
          }`}
        >
          {t.nav.myProjects}
        </button>
        <button
          onClick={() => setActiveTab('workspaces')}
          className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer hover:text-white ${
            activeTab === 'workspaces' ? 'text-indigo-400' : 'text-slate-400'
          }`}
        >
          {t.nav.workspaces || 'Workspaces'}
        </button>
        <button
          onClick={() => setActiveTab('marketplace')}
          className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer hover:text-white ${
            activeTab === 'marketplace' ? 'text-purple-400' : 'text-slate-400'
          }`}
        >
          {t.nav.marketplace || 'Marketplace'}
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer hover:text-white ${
            activeTab === 'settings' ? 'text-amber-400' : 'text-slate-400'
          }`}
        >
          {t.nav.settings}
        </button>
      </nav>

      {/* Zone 3: Single primary action cluster with Language & Currency switchers & Profile */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Currency Switcher */}
        <div className="relative">
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
            className="appearance-none bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-mono font-semibold text-zinc-300 hover:text-white px-2.5 py-1.5 rounded-md outline-none cursor-pointer"
            title="Pilih Mata Uang Regional / Select Currency"
          >
            {Object.keys(REGIONAL_CURRENCIES).map((c) => (
              <option key={c} value={c} className="bg-zinc-900 text-white">
                {c} ({REGIONAL_CURRENCIES[c as CurrencyCode].symbol})
              </option>
            ))}
          </select>
        </div>

        {/* 5-Language Switcher */}
        <div className="relative">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as LanguageCode)}
            className="appearance-none bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-medium text-zinc-300 hover:text-white px-2.5 py-1.5 rounded-md outline-none cursor-pointer"
            title="Pilih Bahasa Antarmuka / Select UI Language"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code} className="bg-zinc-900 text-white">
                {lang.flag} {lang.label}
              </option>
            ))}
          </select>
        </div>

        {/* Supabase Status Indicator (Quiet unboxed badge) */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-400 px-2 py-1 rounded bg-slate-900/60 border border-slate-800/80">
          {isConfigured ? (
            <>
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-mono text-[11px]">Supabase OK</span>
            </>
          ) : (
            <>
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-amber-300 text-[11px]">Preview Sandbox</span>
            </>
          )}
        </div>

        {/* Primary Action Button */}
        <button
          onClick={onOpenNewProject}
          className="px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-sm shadow-amber-400/20"
        >
          + {t.projects.createNew}
        </button>

        {/* User Account / Auth button */}
        {user ? (
          <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
            <button
              onClick={() => setActiveTab('settings')}
              className="flex items-center gap-2 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
              title={profile.display_name}
            >
              <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                <User className="w-3.5 h-3.5" />
              </div>
              <span className="hidden xl:inline max-w-[100px] truncate">{profile.display_name}</span>
            </button>
            <button
              onClick={() => signOut()}
              className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
              title={t.auth.signOut}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-800 rounded-md transition-colors cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5 text-slate-400" />
            <span>{t.auth.signIn}</span>
          </button>
        )}
      </div>
    </header>
  );
};
