import React from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  FolderKanban,
  Compass,
  Users,
  ScrollText,
  Clapperboard,
  Bot,
  Sparkles,
  Workflow,
  Building2,
  ShoppingBag,
  CreditCard,
  Coins,
  Settings,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Scissors,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  collapsed?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { user, profile, t, isConfigured } = useAuth();
  const isOwnerAdmin =
    profile?.role === 'admin' ||
    String(user?.email || profile?.email || '').toLowerCase() === 'islamiahiis243@gmail.com';

  const navGroups = [
    {
      group: t.nav.overview,
      items: [
        { id: 'dashboard', label: t.nav.dashboard, icon: LayoutDashboard, status: 'active' },
        ...(isOwnerAdmin
          ? [{ id: 'admin_panel', label: 'Konsol Pemilik (Admin)', icon: ShieldCheck, status: 'active' }]
          : []),
      ],
    },
    {
      group: t.nav.productionStudio,
      items: [
        { id: 'projects', label: t.nav.myProjects, icon: FolderKanban, status: 'active' },
        { id: 'world_builder', label: t.nav.worldBuilder, icon: Compass, status: 'active' },
        { id: 'character_studio', label: t.nav.characterStudio, icon: Users, status: 'active' },
        { id: 'story_script', label: t.nav.storyScript, icon: ScrollText, status: 'active' },
        { id: 'storyboard', label: t.nav.storyboard, icon: Clapperboard, status: 'active' },
        { id: 'agent_manager', label: t.nav.agentManager, icon: Bot, status: 'active' },
        { id: 'media_studio', label: t.nav.mediaStudio, icon: Sparkles, status: 'active' },
        { id: 'production_pipeline', label: t.nav.productionPipeline, icon: Workflow, status: 'active' },
        { id: 'quality_control', label: (t.nav as any).qualityControl || 'Quality Control & Kontinuitas', icon: ShieldCheck, status: 'active' },
        { id: 'editing_post', label: (t.nav as any).editingPost || 'Editing & Post-Produksi', icon: Scissors, status: 'active' },
      ],
    },
    {
      group: t.nav.collaboration || 'KOLABORASI & KOMUNITAS',
      items: [
        { id: 'workspaces', label: t.nav.workspaces || 'Ruang Kerja Tim', icon: Building2, status: 'active' },
        { id: 'marketplace', label: t.nav.marketplace || 'Pasar Template', icon: ShoppingBag, status: 'active' },
      ],
    },
    {
      group: t.nav.business,
      items: [
        { id: 'subscription', label: t.nav.subscription, icon: CreditCard, status: 'active' },
        { id: 'credits_usage', label: t.nav.creditsUsage, icon: Coins, status: 'active' },
      ],
    },
    {
      group: t.nav.system,
      items: [
        { id: 'settings', label: t.nav.settings, icon: Settings, status: 'active' },
        ...(isOwnerAdmin
          ? [{ id: 'admin_panel', label: t.nav.adminPanel || 'Admin Panel', icon: ShieldCheck, status: 'active' }]
          : []),
      ],
    },
  ];

  return (
    <aside className="w-64 border-r border-slate-800/80 bg-[#0B0F17] flex flex-col shrink-0 min-h-[calc(100vh-4rem)]">
      <div className="p-4 flex-1 overflow-y-auto space-y-6">
        {navGroups.map((group, gIdx) => (
          <div key={gIdx} className="space-y-1">
            <h4 className="text-[11px] font-semibold text-slate-500 tracking-wider px-3 py-1 uppercase">
              {group.group}
            </h4>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-colors text-left cursor-pointer ${
                      isActive
                        ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-400' : 'text-slate-500'}`} />
                      <span className="truncate">{item.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Database Connection Footer Badge */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/40 text-[11px]">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="font-medium">Database Backend</span>
          <span className="font-mono text-[10px] text-slate-500">PostgreSQL</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          {isConfigured ? (
            <div className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Supabase RLS Active</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-amber-400/90">
              <Clock className="w-3.5 h-3.5" />
              <span>Local Sandbox Preview</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
