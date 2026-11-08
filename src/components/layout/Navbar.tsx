import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Film, User, Globe, LogIn, LogOut, Database, ShieldAlert, Sparkles, ArrowRight } from 'lucide-react';
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
  const isOwnerAdmin =
    profile?.role === 'admin' ||
    String(user?.email || profile?.email || '').toLowerCase() === 'islamiahiis243@gmail.com';
  const isLandingPage = activeTab === 'landing';

  return (
    <header className="h-16 border-b border-slate-800/80 bg-[#070A0F]/95 backdrop-blur-md sticky top-0 z-50 px-6 flex items-center justify-between gap-6">
      {/* Brand Logo & Wordmark (Shared) */}
      <button 
        onClick={() => setActiveTab(isLandingPage && user ? 'dashboard' : 'landing')} 
        className="flex items-center gap-2.5 text-left transition-opacity hover:opacity-90 shrink-0 cursor-pointer group"
        title="AI Movie Factory (AMF)"
      >
        <div className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-700/80 flex items-center justify-center overflow-hidden shadow-lg group-hover:border-cyan-400/60 transition-colors">
          <img
            src="/assets/branding/amf-emblem.png"
            alt="AMF Logo"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 via-purple-300 to-amber-300 bg-clip-text text-transparent whitespace-nowrap">
            AI MOVIE FACTORY
          </span>
          <span className="text-[9px] font-mono tracking-widest text-slate-400 uppercase">
            AMF Hollywood AI Studio
          </span>
        </div>
      </button>

      {/* Middle Navigation Zone */}
      {isLandingPage ? (
        /* Landing Page: Marketing Conversion Navigation */
        <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-slate-300">
          <a
            href="#features"
            className="transition-colors hover:text-cyan-400 text-slate-300"
          >
            Fitur Studio
          </a>
          <a
            href="#interactive-demo"
            className="transition-colors hover:text-cyan-400 text-slate-300"
          >
            14 Agen AI
          </a>
          <a
            href="#comparison"
            className="transition-colors hover:text-cyan-400 text-slate-300"
          >
            Alur Kerja
          </a>
          <a
            href="#pricing"
            className="transition-colors hover:text-amber-400 text-slate-300 font-semibold"
          >
            Harga & Paket
          </a>
          <a
            href="#faq"
            className="transition-colors hover:text-slate-200 text-slate-400"
          >
            FAQ
          </a>
        </nav>
      ) : (
        /* Studio Cockpit: Internal Creator Navigation */
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
          <button
            onClick={() => setActiveTab('landing')}
            className="transition-colors whitespace-nowrap shrink-0 cursor-pointer text-slate-400 hover:text-cyan-400"
            title="Kunjungi Beranda & Showcase Publik"
          >
            Beranda
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer hover:text-white ${
              activeTab === 'dashboard' ? 'text-amber-400 font-semibold' : 'text-slate-400'
            }`}
          >
            {t.nav.dashboard}
          </button>
          <button
            onClick={() => setActiveTab('projects')}
            className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer hover:text-white ${
              activeTab === 'projects' ? 'text-amber-400 font-semibold' : 'text-slate-400'
            }`}
          >
            {t.nav.myProjects}
          </button>
          <button
            onClick={() => setActiveTab('workspaces')}
            className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer hover:text-white ${
              activeTab === 'workspaces' ? 'text-indigo-400 font-semibold' : 'text-slate-400'
            }`}
          >
            {t.nav.workspaces || 'Ruang Kerja'}
          </button>
          <button
            onClick={() => setActiveTab('marketplace')}
            className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer hover:text-white ${
              activeTab === 'marketplace' ? 'text-purple-400 font-semibold' : 'text-slate-400'
            }`}
          >
            {t.nav.marketplace || 'Pasar Template'}
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer hover:text-white ${
              activeTab === 'settings' ? 'text-amber-400 font-semibold' : 'text-slate-400'
            }`}
          >
            {t.nav.settings}
          </button>
        </nav>
      )}

      {/* Right Controls & Action Cluster */}
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

        {/* Language Switcher */}
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

        {/* When in Studio: Show Database Status & + Proyek Baru */}
        {!isLandingPage && (
          <>
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

            <button
              onClick={onOpenNewProject}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-sm shadow-amber-400/20"
            >
              + {t.projects.createNew}
            </button>
          </>
        )}

        {/* Auth & Profile Actions */}
        {user ? (
          <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
            {/* If on landing page and logged in: prominent button to go into studio */}
            {isLandingPage && (
              <button
                onClick={() => setActiveTab('dashboard')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 rounded-md transition-all shadow-md shadow-amber-400/20 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-slate-950" />
                <span>Masuk Studio Cockpit</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-950" />
              </button>
            )}

            {!isLandingPage && isOwnerAdmin && (
              <button
                onClick={() => setActiveTab('admin_panel')}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-semibold rounded transition-colors cursor-pointer ${
                  activeTab === 'admin_panel'
                    ? 'bg-amber-400 text-slate-950 font-bold'
                    : 'bg-amber-400/10 text-amber-400 border border-amber-400/30 hover:bg-amber-400/20'
                }`}
                title="Buka Konsol Pemilik / Admin"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Admin Konsol</span>
              </button>
            )}

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
          /* Visitor on Landing Page: "Masuk" + "Coba Gratis (150 Kredit)" */
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenAuth}
              className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              {t.auth.signIn}
            </button>
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 hover:from-amber-300 hover:to-amber-200 rounded-md transition-all shadow-md shadow-amber-400/20 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-slate-950" />
              <span>Coba Gratis (150 Kredit)</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
