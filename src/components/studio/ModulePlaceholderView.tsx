import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Project } from '../../types/database';
import {
  Compass,
  Users,
  ScrollText,
  Clapperboard,
  Bot,
  Sparkles,
  Workflow,
  CreditCard,
  Coins,
  ShieldCheck,
  ArrowRight,
  Clock,
  Sparkle,
} from 'lucide-react';

interface ModulePlaceholderProps {
  moduleId: string;
  projects: Project[];
  onOpenCreateProject: () => void;
  onSelectProject: (project: Project) => void;
}

export const ModulePlaceholderView: React.FC<ModulePlaceholderProps> = ({
  moduleId,
  projects,
  onOpenCreateProject,
  onSelectProject,
}) => {
  const { t } = useAuth();

  const moduleMeta: Record<string, { title: string; subtitle: string; icon: any; phase: string; specs: string[] }> = {
    world_builder: {
      title: 'World Builder',
      subtitle: 'Arsitektur alam fiksi, sekte, ranah kultivasi, hukum dunia, dan geografi naratif.',
      icon: Compass,
      phase: 'Fase 2 (Creative Development)',
      specs: [
        'Deskripsi dunia & latar belakang historis',
        'Geografi, peta lokasi, kerajaan, dan faksi',
        'Sistem sihir & ranah kultivasi Xianxia (Sects, Realms, Spiritual Energy)',
        'Hierarki kekuatan & dokumen referensi dunia',
      ],
    },
    character_studio: {
      title: 'Character Studio',
      subtitle: 'Manajemen konsistensi identitas, kepribadian, kostum, dan lembar referensi karakter.',
      icon: Users,
      phase: 'Fase 2 (Creative Development)',
      specs: [
        'Profil karakter, latar belakang, kepribadian & motivasi',
        'Katalog kostum & rekaman konsistensi penampilan visual',
        'Karakteristik vokal & hubungan antartokoh',
        'Penyimpanan referensi visual untuk generasi gambar & video stabil',
      ],
    },
    story_script: {
      title: 'Cerita & Naskah (Story & Script)',
      subtitle: 'Pengembangan logline, sinopsis, struktur naratif, dan perincian naskah adegan.',
      icon: ScrollText,
      phase: 'Fase 2 (Creative Development)',
      specs: [
        'Konsep cerita, logline, sinopsis & tema narasi',
        'Outline musim & rincian episode per adegan',
        'Generasi draf naskah & dialog berbantuan AI',
        'Riwayat versi naskah & persetujuan kreator',
      ],
    },
    storyboard: {
      title: 'Storyboard Studio',
      subtitle: 'Komposisi visual per adegan, shot list, pergerakan kamera, dan kontinuitas bingkai.',
      icon: Clapperboard,
      phase: 'Fase 2 / 4',
      specs: [
        'Storyboard per episode & adegan',
        'Shot list, deskripsi sudut pandang & pergerakan kamera',
        'Pemblokiran karakter (character blocking) & pencahayaan',
        'Prompt visual terstruktur per shot',
      ],
    },
    agent_manager: {
      title: 'AI Agent Manager',
      subtitle: 'Pusat komando dan orkestrasi 14 agen khusus AI produksi film.',
      icon: Bot,
      phase: 'Fase 3 (AI Agent System)',
      specs: [
        'Master Director sebagai koordinator alur produksi',
        'Manajemen izin, instruksi peran, dan urutan eksekusi agen',
        'Abstraksi multi-model LLM (Google Gemini, OpenAI, Claude)',
        'Log eksekusi, penanganan galat, dan retry policy tanpa tagihan ganda',
      ],
    },
    media_studio: {
      title: 'Media Studio',
      subtitle: 'Workspace terpadu generasi aset gambar, video, suara karakter, dan audio latar.',
      icon: Sparkles,
      phase: 'Fase 4 (Media Generation)',
      specs: [
        'Generasi frame karakter & referensi visual adegan',
        'Generasi video (Image-to-Video & Text-to-Video)',
        'Sintesis suara multibahasa & konsistensi vokal',
        'Pencatatan biaya kredit riil per generasi aset',
      ],
    },
    production_pipeline: {
      title: 'Pipeline Produksi',
      subtitle: 'Otomatisasi alur kerja bertahap dengan Human Approval Checkpoints wajib.',
      icon: Workflow,
      phase: 'Fase 5 (Production Pipeline)',
      specs: [
        'Mesin workflow sadar dependensi (Story → Script → Storyboard → Render)',
        'Antrean pekerjaan (Job Queue) di latar belakang',
        'Pemeriksaan Kontrol Kualitas (QC) & Kontinuitas Visual',
        'Generasi & regenerasi mandiri per adegan tanpa merender ulang seluruh episode',
      ],
    },
    subscription: {
      title: 'Paket Langganan',
      subtitle: 'Model komersial SaaS berjenjang untuk kreator independen dan studio produksi.',
      icon: CreditCard,
      phase: 'Fase 6 (Commercial SaaS)',
      specs: [
        'Paket Creator (Rp99.000/bln hipotesis awal)',
        'Paket Pro Studio (Rp299.000/bln hipotesis awal)',
        'Paket Production House (Rp999.000/bln hipotesis awal)',
        'Integrasi pembayaran aman dengan verifikasi webhook',
      ],
    },
    credits_usage: {
      title: 'Kredit & Penggunaan',
      subtitle: 'Audit ledger kredit transparan untuk setiap tugas komputasi dan generasi media.',
      icon: Coins,
      phase: 'Fase 6 (Commercial SaaS)',
      specs: [
        'Pencatatan auditable credit ledger per operasi generasi',
        'Perhitungan biaya riil penyedia sebelum pemotongan kredit',
        'Pencegahan pemotongan ganda saat retry pekerjaan',
        'Laporan konsumsi kredit per proyek dan per akun',
      ],
    },
    admin_panel: {
      title: 'Panel Admin Studio',
      subtitle: 'Manajemen pengguna, audit log, analitik operasional, dan parameter sistem.',
      icon: ShieldCheck,
      phase: 'Fase 6 (Commercial SaaS)',
      specs: [
        'Manajemen pengguna & kuota kredit',
        'Pemantauan status pekerjaan dan kegagalan sistem',
        'Konfigurasi adapter model AI server-side',
        'Audit trail kepatuhan dan keamanan database',
      ],
    },
  };

  const meta = moduleMeta[moduleId] || {
    title: moduleId,
    subtitle: 'Modul produksi studio',
    icon: Clock,
    phase: 'Roadmap Berkelanjutan',
    specs: ['Fitur sedang disiapkan sesuai SSOT Dokumen Induk'],
  };

  const Icon = meta.icon;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-[#101726] border border-slate-800/80 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400 shrink-0">
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white tracking-tight">{meta.title}</h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700">
                  {meta.phase}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-xl">{meta.subtitle}</p>
            </div>
          </div>

          <button
            onClick={onOpenCreateProject}
            className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto cursor-pointer"
          >
            + Proyek Baru
          </button>
        </div>

        {/* Specifications from SSOT */}
        <div className="pt-4 border-t border-slate-800/60">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
            Spesifikasi Arsitektur SSOT
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {meta.specs.map((spec, idx) => (
              <div key={idx} className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/60 text-xs text-slate-300 flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 mt-1.5" />
                <span>{spec}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Linked Projects for this module */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white tracking-tight">
            Proyek dengan Konfigurasi Modul Ini Aktif
          </h3>
          <span className="text-xs font-mono text-slate-500">
            {projects.length} Proyek Terdaftar
          </span>
        </div>

        {projects.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-[#101726] border border-slate-800/80">
            <p className="text-xs text-slate-400">Belum ada proyek yang dikonfigurasi.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {projects.map((p) => (
              <div
                key={p.id}
                onClick={() => onSelectProject(p)}
                className="p-4 rounded-xl bg-[#101726] border border-slate-800/80 hover:border-slate-700 transition-colors cursor-pointer flex items-center justify-between group"
              >
                <div>
                  <div className="text-xs text-amber-400 font-medium">{p.genre}</div>
                  <h4 className="text-sm font-semibold text-white group-hover:text-amber-400 transition-colors">
                    {p.name}
                  </h4>
                  <div className="text-[11px] text-slate-400 mt-1 font-mono">
                    {p.settings?.episodes_count || 1} Ep · {p.settings?.aspect_ratio || '16:9'} · {p.production_format}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
