import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Search,
  Download,
  Star,
  Sparkles,
  BookOpen,
  Users,
  GitFork,
  Layers,
  CheckCircle2,
  Eye,
  Globe,
  Sliders,
  Share2,
  Copy,
  Check,
  Volume2,
  Shield,
  Shirt,
  FolderOpen,
  ArrowRight,
  X,
  Plus,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  MarketplaceTemplate,
  MarketplaceCategory,
  MarketplaceCharacterPack,
  MarketplaceCharacterSheet,
  Project,
  Character,
} from '../../types/database';
import {
  fetchMarketplaceTemplates,
  cloneMarketplaceTemplateToProject,
  fetchCharacterMarketplacePacks,
  importCharacterPackToProject,
  publishCharacterPackToMarketplace,
  fetchCharacters,
} from '../../lib/supabase';
import { SUPPORTED_LANGUAGES } from '../../lib/multilingualAdapters';

interface MarketplaceViewProps {
  projects?: Project[];
  selectedProjectId?: string;
  onSelectProject?: (projectId: string) => void;
  onProjectCloned?: (projectId: string) => void;
  onNavigateToCharacterStudio?: (projectId: string) => void;
  onShowToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const CATEGORY_TABS: { id: MarketplaceCategory | 'all'; label: string; icon: any }[] = [
  { id: 'all', label: 'Semua Template', icon: Layers },
  { id: 'universe_bible', label: 'Universe Bibles', icon: BookOpen },
  { id: 'character_pack', label: 'Character Packs', icon: Users },
  { id: 'workflow_pipeline', label: 'Pipeline Flows', icon: GitFork },
  { id: 'screenplay_arc', label: 'Screenplay Arcs', icon: Sliders },
];

const GENRE_FILTERS = [
  'all',
  'Xianxia / Wuxia',
  'Sci-Fi / Cyberpunk',
  'Action / Historical',
  'Drama / Romance',
];

export const MarketplaceView: React.FC<MarketplaceViewProps> = ({
  projects = [],
  selectedProjectId,
  onSelectProject,
  onProjectCloned,
  onNavigateToCharacterStudio,
  onShowToast,
}) => {
  const { user, profile } = useAuth();
  const userId = user?.id || profile.id;

  // Top-level Marketplace Mode: 'character_packs' vs 'project_templates'
  const [marketplaceMode, setMarketplaceMode] = useState<'character_packs' | 'project_templates'>(
    'character_packs'
  );

  // Target project for importing Character Packs into Character Studio
  const [targetProjectId, setTargetProjectId] = useState<string>(
    selectedProjectId || projects[0]?.id || ''
  );

  useEffect(() => {
    if (selectedProjectId) {
      setTargetProjectId(selectedProjectId);
    } else if (!targetProjectId && projects.length > 0) {
      setTargetProjectId(projects[0].id);
    }
  }, [selectedProjectId, projects]);

  // Character Packs State
  const [characterPacks, setCharacterPacks] = useState<MarketplaceCharacterPack[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [inspectPack, setInspectPack] = useState<MarketplaceCharacterPack | null>(null);
  const [activeSheetIdx, setActiveSheetIdx] = useState<number>(0);
  const [isImportingKey, setIsImportingKey] = useState<string | null>(null);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);

  // Publish Character Pack Modal State
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [publishProjectId, setPublishProjectId] = useState<string>(
    selectedProjectId || projects[0]?.id || ''
  );
  const [projectCharacters, setProjectCharacters] = useState<Character[]>([]);
  const [selectedCharIdsToPublish, setSelectedCharIdsToPublish] = useState<string[]>([]);
  const [packTitle, setPackTitle] = useState('');
  const [packGenre, setPackGenre] = useState('Xianxia / Wuxia');
  const [packDescription, setPackDescription] = useState('');
  const [packTags, setPackTags] = useState('Character Pack, Visual Seed Ready, Voice Profile');
  const [isPublishing, setIsPublishing] = useState(false);

  // Project Templates State
  const [templates, setTemplates] = useState<MarketplaceTemplate[]>([]);
  const [activeCategory, setActiveCategory] = useState<MarketplaceCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<MarketplaceTemplate | null>(null);
  const [isCloningId, setIsCloningId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{
    type: 'success' | 'error';
    text: string;
    projectId?: string;
    isCharacterImport?: boolean;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadMarketplaceData = async () => {
    setIsLoading(true);
    const [packsRes, tmplRes] = await Promise.all([
      fetchCharacterMarketplacePacks(selectedGenre === 'all' ? undefined : selectedGenre),
      fetchMarketplaceTemplates(activeCategory === 'all' ? undefined : activeCategory),
    ]);
    setCharacterPacks(packsRes.data);
    setTemplates(tmplRes.data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadMarketplaceData();
  }, [selectedGenre, activeCategory]);

  // Load characters of selected project when opening Publish Modal
  useEffect(() => {
    const loadCharsForPublish = async () => {
      if (!isPublishModalOpen || !publishProjectId) return;
      const res = await fetchCharacters(publishProjectId);
      setProjectCharacters(res.data);
      setSelectedCharIdsToPublish(res.data.map(c => c.id));
      const proj = projects.find(p => p.id === publishProjectId);
      if (proj && !packTitle) {
        setPackTitle(`${proj.name} — Character Studio Pack`);
        setPackGenre(proj.genre || 'Xianxia / Wuxia');
      }
    };
    loadCharsForPublish();
  }, [isPublishModalOpen, publishProjectId]);

  const handleCopySeed = (id: string, prompt: string) => {
    navigator.clipboard.writeText(prompt);
    setCopiedPromptId(id);
    setTimeout(() => setCopiedPromptId(null), 2000);
  };

  const handleImportPack = async (
    pack: MarketplaceCharacterPack,
    specificCharacter?: MarketplaceCharacterSheet
  ) => {
    if (!targetProjectId) {
      const msg = 'Pilih atau buat proyek tujuan terlebih dahulu sebelum mengunduh karakter.';
      setActionMsg({ type: 'error', text: msg });
      onShowToast?.(msg, 'error');
      return;
    }

    const importKey = specificCharacter ? `${pack.id}_${specificCharacter.id}` : pack.id;
    setIsImportingKey(importKey);
    setActionMsg(null);

    const res = await importCharacterPackToProject(
      targetProjectId,
      pack.id,
      specificCharacter?.id
    );

    setIsImportingKey(null);

    if (res.error) {
      setActionMsg({ type: 'error', text: res.error });
      onShowToast?.(res.error, 'error');
    } else {
      const targetProj = projects.find(p => p.id === targetProjectId);
      const count = res.imported.length;
      const charNames = res.imported.map(c => c.name).join(', ');
      const successText = specificCharacter
        ? `Karakter "${specificCharacter.name}" (lengkap dengan Seed Visual, Kostum & Profil Suara) berhasil diunduh ke Character Studio proyek "${targetProj?.name || 'Aktif'}"!`
        : `${count} karakter dari "${pack.title}" (${charNames}) berhasil diunduh ke Character Studio proyek "${targetProj?.name || 'Aktif'}"!`;

      setActionMsg({
        type: 'success',
        text: successText,
        projectId: targetProjectId,
        isCharacterImport: true,
      });
      onShowToast?.(successText, 'success');
      await loadMarketplaceData();
    }
  };

  const handlePublishCharacterPack = async (e: React.FormEvent) => {
    e.preventDefault();
    const chosenChars = projectCharacters.filter(c => selectedCharIdsToPublish.includes(c.id));
    if (chosenChars.length === 0) {
      onShowToast?.('Pilih minimal 1 karakter untuk dibagikan.', 'error');
      return;
    }

    setIsPublishing(true);
    const res = await publishCharacterPackToMarketplace({
      title: packTitle,
      description: packDescription,
      genre: packGenre,
      author_name: profile?.display_name || user?.email?.split('@')[0] || 'Studio Creator',
      tags: packTags
        .split(',')
        .map(t => t.trim())
        .filter(Boolean),
      credit_cost: 0,
      characters: chosenChars,
    });
    setIsPublishing(false);

    if (res.error || !res.pack) {
      onShowToast?.(res.error || 'Gagal membagikan paket karakter.', 'error');
      return;
    }

    setIsPublishModalOpen(false);
    setPackTitle('');
    setPackDescription('');
    await loadMarketplaceData();
    const msg = `Paket karakter "${res.pack.title}" (${chosenChars.length} karakter) berhasil diterbitkan ke Marketplace!`;
    setActionMsg({ type: 'success', text: msg });
    onShowToast?.(msg, 'success');
  };

  const handleCloneTemplate = async (template: MarketplaceTemplate) => {
    setIsCloningId(template.id);
    setActionMsg(null);

    const res = await cloneMarketplaceTemplateToProject(userId, template.id);
    setIsCloningId(null);

    if (res.success && res.project) {
      setActionMsg({
        type: 'success',
        text: `Template "${template.title}" berhasil dikloning menjadi proyek baru: "${res.project.name}"!`,
        projectId: res.project.id,
      });
      setSelectedTemplate(null);
      loadMarketplaceData();
      if (onProjectCloned) {
        onProjectCloned(res.project.id);
      }
    } else {
      setActionMsg({
        type: 'error',
        text: res.error || 'Gagal mengkloning template ke akun Anda.',
      });
    }
  };

  const filteredCharacterPacks = characterPacks.filter(pack => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      pack.title.toLowerCase().includes(q) ||
      pack.description.toLowerCase().includes(q) ||
      pack.genre.toLowerCase().includes(q) ||
      pack.tags.some(tag => tag.toLowerCase().includes(q)) ||
      pack.characters.some(
        c =>
          c.name.toLowerCase().includes(q) ||
          c.occupation_cultivation_level.toLowerCase().includes(q)
      )
    );
  });

  const filteredTemplates = templates.filter(template => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      template.title.toLowerCase().includes(q) ||
      template.description.toLowerCase().includes(q) ||
      (template.genre || '').toLowerCase().includes(q) ||
      template.tags.some(tag => tag.toLowerCase().includes(q))
    );
  });

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'protagonist':
        return 'Protagonis Utama';
      case 'main_companion':
        return 'Pendamping Utama';
      case 'antagonist':
        return 'Antagonis Utama';
      case 'mentor':
        return 'Mentor / Guru';
      default:
        return 'Pendukung';
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-950/70 via-slate-900 to-purple-950/60 border border-indigo-500/20 rounded-2xl p-6 relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium">
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Asset & Character Studio Marketplace · SSOT Phase 11</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Community Asset & Character Marketplace
            </h1>
            <p className="text-slate-400 text-sm max-w-2xl">
              Bagikan atau unduh paket karakter siap pakai — lengkap dengan{' '}
              <span className="text-amber-300 font-medium">Lembar Seed Kontinuitas Visual</span>,{' '}
              <span className="text-indigo-300 font-medium">Katalog Kostum & Pusaka</span>, dan{' '}
              <span className="text-emerald-300 font-medium">Profil Suara Vokal</span> — langsung ke
              dalam Character Studio proyek Anda.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Target Project Selector for Direct Character Studio Import */}
            {projects.length > 0 && (
              <div className="bg-slate-950/90 border border-slate-800 rounded-xl px-3.5 py-2 flex items-center gap-2.5">
                <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <span className="block text-[10px] uppercase tracking-wider text-slate-500">
                    Proyek Tujuan Unduhan
                  </span>
                  <select
                    value={targetProjectId}
                    onChange={e => {
                      setTargetProjectId(e.target.value);
                      onSelectProject?.(e.target.value);
                    }}
                    className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer pr-2"
                  >
                    {projects.map(p => (
                      <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                        {p.name} ({p.genre})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <button
              onClick={() => {
                setPublishProjectId(targetProjectId || projects[0]?.id || '');
                setIsPublishModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>Bagikan Paket Karakter Proyek</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2 bg-slate-900/90 p-1.5 rounded-xl border border-slate-800">
          <button
            onClick={() => setMarketplaceMode('character_packs')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              marketplaceMode === 'character_packs'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Paket Karakter & Seed Visual ({characterPacks.length})</span>
          </button>
          <button
            onClick={() => setMarketplaceMode('project_templates')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              marketplaceMode === 'project_templates'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Template Proyek & Universe Bible ({templates.length})</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={
              marketplaceMode === 'character_packs'
                ? 'Cari karakter, Xianxia, Cyberpunk, kostum...'
                : 'Cari genre, wuxia, cyberpunk, k-drama...'
            }
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Notification Banner */}
      {actionMsg && (
        <div
          className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            actionMsg.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5 text-sm">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
            <span>{actionMsg.text}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {actionMsg.isCharacterImport &&
              actionMsg.projectId &&
              onNavigateToCharacterStudio && (
                <button
                  onClick={() => onNavigateToCharacterStudio(actionMsg.projectId!)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
                >
                  <span>Buka Character Studio</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            <button
              onClick={() => setActionMsg(null)}
              className="text-xs underline opacity-75 hover:opacity-100 cursor-pointer px-2"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODE 1: CHARACTER STUDIO PACKS (VISUAL SEED, COSTUME, VOICE PROFILE)  */}
      {/* ===================================================================== */}
      {marketplaceMode === 'character_packs' && (
        <>
          {/* Genre Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {GENRE_FILTERS.map(g => (
              <button
                key={g}
                onClick={() => setSelectedGenre(g)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                  selectedGenre === g
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {g === 'all' ? 'Semua Genre Karakter' : g}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map(n => (
                <div
                  key={n}
                  className="bg-slate-900/50 border border-slate-800 rounded-2xl h-96 animate-pulse p-5"
                />
              ))}
            </div>
          ) : filteredCharacterPacks.length === 0 ? (
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
              <Users className="w-10 h-10 text-slate-600 mx-auto" />
              <h3 className="text-base font-semibold text-white">
                Tidak ada Paket Karakter yang cocok
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Coba gunakan kata kunci pencarian lain atau bagikan karakter dari proyek Anda ke
                Marketplace.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredCharacterPacks.map(pack => (
                <div
                  key={pack.id}
                  className="bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 rounded-2xl overflow-hidden flex flex-col transition-all group shadow-lg"
                >
                  {/* Pack Top Banner */}
                  <div className="p-5 border-b border-slate-800/80 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/30 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-[11px] font-semibold text-amber-300">
                            {pack.genre}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-md bg-indigo-500/15 border border-indigo-500/30 text-[11px] font-medium text-indigo-300">
                            {pack.characters.length} Karakter Siap Pakai
                          </span>
                          {pack.is_community_shared && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-semibold text-emerald-300">
                              Komunitas
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors">
                          {pack.title}
                        </h3>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-400 shrink-0">
                        <span className="flex items-center gap-1 text-amber-400 font-semibold">
                          <Star className="w-3.5 h-3.5 fill-amber-400" />
                          {pack.rating}
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Download className="w-3.5 h-3.5 text-indigo-400" />
                          {pack.downloads_count}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed">{pack.description}</p>

                    <div className="flex flex-wrap gap-1.5">
                      {pack.tags.map(tag => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded bg-slate-800/90 text-slate-300 text-[10px]"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Character Roster Preview inside Pack */}
                  <div className="p-5 flex-1 space-y-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                      <span>Daftar Karakter dalam Paket (Seed, Kostum & Suara)</span>
                      <span className="text-slate-500">Oleh {pack.author_name}</span>
                    </div>

                    <div className="space-y-2.5">
                      {pack.characters.map((char, idx) => {
                        const singleImportKey = `${pack.id}_${char.id}`;
                        return (
                          <div
                            key={char.id}
                            className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-3.5 space-y-2.5 hover:border-slate-700 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-white">{char.name}</span>
                                  {char.native_name && (
                                    <span className="text-xs text-slate-400 font-serif">
                                      ({char.native_name})
                                    </span>
                                  )}
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-medium">
                                    {getRoleBadge(char.role)}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  {char.gender}, {char.age} thn · {char.occupation_cultivation_level}
                                  {char.sect_or_faction ? ` · ${char.sect_or_faction}` : ''}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  onClick={() =>
                                    handleCopySeed(char.id, char.visual_consistency_prompt)
                                  }
                                  className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[10px] font-medium text-amber-300 border border-slate-800 flex items-center gap-1 cursor-pointer"
                                  title="Salin Master Visual Seed Prompt"
                                >
                                  {copiedPromptId === char.id ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                  <span>Seed</span>
                                </button>
                                <button
                                  onClick={() => handleImportPack(pack, char)}
                                  disabled={isImportingKey === singleImportKey}
                                  className="px-2.5 py-1 rounded bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-[10px] font-semibold transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                  title="Unduh karakter ini saja ke Character Studio"
                                >
                                  <Download className="w-3 h-3" />
                                  <span>
                                    {isImportingKey === singleImportKey ? 'Mengunduh...' : 'Unduh'}
                                  </span>
                                </button>
                              </div>
                            </div>

                            {/* Compact 3-Pillar Preview: Visual Seed, Costume, Voice Profile */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                              <div className="bg-slate-900/70 border border-slate-800/80 rounded-lg p-2">
                                <span className="text-[10px] text-amber-400 font-semibold flex items-center gap-1 mb-0.5">
                                  <Sparkles className="w-3 h-3" /> Seed Visual & Fisik
                                </span>
                                <p className="text-slate-300 line-clamp-2">
                                  {char.physical_appearance.face_structure};{' '}
                                  {char.physical_appearance.hair}
                                </p>
                              </div>

                              <div className="bg-slate-900/70 border border-slate-800/80 rounded-lg p-2">
                                <span className="text-[10px] text-indigo-400 font-semibold flex items-center gap-1 mb-0.5">
                                  <Shirt className="w-3 h-3" /> Kostum & Pusaka
                                </span>
                                <p className="text-slate-300 line-clamp-2">
                                  {char.costume.daily_attire} · {char.costume.accessories_artifacts}
                                </p>
                              </div>

                              <div className="bg-slate-900/70 border border-slate-800/80 rounded-lg p-2">
                                <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1 mb-0.5">
                                  <Volume2 className="w-3 h-3" /> Profil Suara
                                </span>
                                <p className="text-slate-300 line-clamp-2">
                                  {char.voice_characteristics.pitch_tone} (
                                  {char.voice_characteristics.voice_actor_reference || 'Standar'})
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Pack Action Footer */}
                  <div className="p-4 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between gap-3">
                    <button
                      onClick={() => {
                        setInspectPack(pack);
                        setActiveSheetIdx(0);
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-medium border border-slate-800 transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-amber-400" />
                      <span>Inspeksi Lembar Seed & Kostum</span>
                    </button>

                    <button
                      onClick={() => handleImportPack(pack)}
                      disabled={isImportingKey === pack.id}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-amber-500/10 cursor-pointer disabled:opacity-50"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>
                        {isImportingKey === pack.id
                          ? 'Mengimpor ke Studio...'
                          : `Unduh Semua (${pack.characters.length} Karakter) ke Character Studio`}
                      </span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ===================================================================== */}
      {/* MODE 2: FULL PROJECT TEMPLATES & UNIVERSE BIBLES                      */}
      {/* ===================================================================== */}
      {marketplaceMode === 'project_templates' && (
        <>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {CATEGORY_TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveCategory(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map(n => (
                <div
                  key={n}
                  className="bg-slate-900/50 border border-slate-800 rounded-2xl h-80 animate-pulse p-5"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredTemplates.map(template => (
                <div
                  key={template.id}
                  className="bg-slate-900/90 border border-slate-800 hover:border-indigo-500/40 rounded-2xl overflow-hidden flex flex-col transition-all group"
                >
                  <div className="h-40 bg-slate-950 relative overflow-hidden">
                    <img
                      src={template.thumbnail_url}
                      alt={template.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/30 to-transparent" />
                    <div className="absolute top-3 left-3 flex items-center gap-1.5">
                      <span className="px-2.5 py-1 rounded-md bg-slate-950/80 backdrop-blur-md border border-slate-700 text-[11px] font-medium text-indigo-300">
                        {template.genre}
                      </span>
                    </div>
                    <div className="absolute top-3 right-3">
                      <span
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${
                          template.credit_cost === 0
                            ? 'bg-emerald-500/90 text-slate-950'
                            : 'bg-amber-500/90 text-slate-950'
                        }`}
                      >
                        {template.credit_cost === 0 ? 'GRATIS' : `${template.credit_cost} CR`}
                      </span>
                    </div>
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-1">
                        {template.title}
                      </h3>
                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {template.description}
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {template.tags.slice(0, 4).map(tag => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 text-[10px]"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3 pt-3 border-t border-slate-800/80">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>Oleh {template.author_name}</span>
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1 text-amber-400">
                            <Star className="w-3.5 h-3.5 fill-amber-400" />
                            {template.rating}
                          </span>
                          <span className="flex items-center gap-1">
                            <Download className="w-3.5 h-3.5 text-indigo-400" />
                            {template.downloads_count}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setSelectedTemplate(template)}
                          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Pratinjau</span>
                        </button>
                        <button
                          onClick={() => handleCloneTemplate(template)}
                          disabled={isCloningId === template.id}
                          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <GitFork className="w-3.5 h-3.5" />
                          <span>
                            {isCloningId === template.id ? 'Mengklon...' : 'Klon ke Proyek'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ===================================================================== */}
      {/* CHARACTER PACK DEEP INSPECTOR MODAL (SEED, COSTUME, VOICE)            */}
      {/* ===================================================================== */}
      {inspectPack && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-xs font-semibold">
                    {inspectPack.genre}
                  </span>
                  <span className="text-xs text-slate-400">
                    Oleh {inspectPack.author_name} · {inspectPack.downloads_count} unduhan
                  </span>
                </div>
                <h2 className="text-lg font-bold text-white">{inspectPack.title}</h2>
              </div>
              <button
                onClick={() => setInspectPack(null)}
                className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-white border border-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Character Selector Tabs inside Modal */}
            <div className="px-5 pt-3 bg-slate-950/60 border-b border-slate-800 flex items-center gap-2 overflow-x-auto">
              {inspectPack.characters.map((c, i) => (
                <button
                  key={c.id}
                  onClick={() => setActiveSheetIdx(i)}
                  className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
                    activeSheetIdx === i
                      ? 'border-amber-400 text-amber-300 bg-amber-500/5'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>{c.name}</span>
                  {c.native_name && <span className="font-serif opacity-75">({c.native_name})</span>}
                </button>
              ))}
            </div>

            {/* Active Character Sheet Body */}
            {inspectPack.characters[activeSheetIdx] && (() => {
              const sheet = inspectPack.characters[activeSheetIdx];
              return (
                <div className="p-6 overflow-y-auto space-y-5 flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/70 p-4 rounded-xl border border-slate-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-white">{sheet.name}</h3>
                        {sheet.native_name && (
                          <span className="text-sm text-slate-400 font-serif">
                            ({sheet.native_name})
                          </span>
                        )}
                        <span className="px-2.5 py-0.5 rounded bg-amber-500/15 text-amber-300 text-xs font-medium">
                          {getRoleBadge(sheet.role)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        {sheet.gender} · {sheet.age} tahun · {sheet.occupation_cultivation_level}
                        {sheet.sect_or_faction ? ` · ${sheet.sect_or_faction}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => handleImportPack(inspectPack, sheet)}
                      disabled={isImportingKey === `${inspectPack.id}_${sheet.id}`}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Unduh "{sheet.name}" Saja</span>
                    </button>
                  </div>

                  {/* 1. Master Visual Seed Sheet */}
                  <div className="bg-slate-950 border border-amber-500/30 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4" />
                        1. Lembar Seed Kontinuitas Visual (Master Visual Consistency Seed)
                      </span>
                      <button
                        onClick={() => handleCopySeed(sheet.id, sheet.visual_consistency_prompt)}
                        className="text-xs text-amber-300 hover:text-amber-200 flex items-center gap-1 cursor-pointer"
                      >
                        {copiedPromptId === sheet.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>Salin Prompt Seed</span>
                      </button>
                    </div>
                    <p className="text-xs font-mono text-slate-200 bg-slate-900 p-3 rounded-lg border border-slate-800 leading-relaxed">
                      {sheet.visual_consistency_prompt}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 text-xs">
                      <div className="bg-slate-900/70 p-2.5 rounded-lg border border-slate-800">
                        <span className="text-slate-500 block text-[11px]">Struktur Wajah & Kulit:</span>
                        <span className="text-slate-200">{sheet.physical_appearance.face_structure}</span>
                      </div>
                      <div className="bg-slate-900/70 p-2.5 rounded-lg border border-slate-800">
                        <span className="text-slate-500 block text-[11px]">Mata & Sorot:</span>
                        <span className="text-slate-200">{sheet.physical_appearance.eyes}</span>
                      </div>
                      <div className="bg-slate-900/70 p-2.5 rounded-lg border border-slate-800">
                        <span className="text-slate-500 block text-[11px]">Rambut & Mahkota:</span>
                        <span className="text-slate-200">{sheet.physical_appearance.hair}</span>
                      </div>
                      <div className="bg-slate-900/70 p-2.5 rounded-lg border border-slate-800">
                        <span className="text-slate-500 block text-[11px]">Postur & Ciri Khusus:</span>
                        <span className="text-slate-200">
                          {sheet.physical_appearance.physique_height} —{' '}
                          {sheet.physical_appearance.distinguishing_features}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 2. Costume & Artifact Breakdown */}
                  <div className="bg-slate-950 border border-indigo-500/30 rounded-xl p-4 space-y-2.5">
                    <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                      <Shirt className="w-4 h-4" />
                      2. Deskripsi Kostum Multi-Lapis & Senjata Pusaka
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 space-y-1">
                        <span className="text-[11px] font-semibold text-indigo-400 block">
                          Busana Harian (Daily Attire)
                        </span>
                        <p className="text-slate-300 leading-relaxed">{sheet.costume.daily_attire}</p>
                      </div>
                      <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 space-y-1">
                        <span className="text-[11px] font-semibold text-rose-400 block">
                          Jubah Tempur / Formal (Battle Robes)
                        </span>
                        <p className="text-slate-300 leading-relaxed">{sheet.costume.battle_robes}</p>
                      </div>
                      <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 space-y-1">
                        <span className="text-[11px] font-semibold text-amber-400 block">
                          Senjata & Pusaka (Artifacts)
                        </span>
                        <p className="text-slate-300 leading-relaxed">
                          {sheet.costume.accessories_artifacts}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 3. Voice Profile & Acoustic Reference */}
                  <div className="bg-slate-950 border border-emerald-500/30 rounded-xl p-4 space-y-2.5">
                    <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                      <Volume2 className="w-4 h-4" />
                      3. Profil Suara & Referensi Aktor Vokal (TTS / Dubbing)
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                        <span className="text-[11px] text-slate-500 block">Nada & Warna Suara:</span>
                        <span className="text-slate-200 font-medium">
                          {sheet.voice_characteristics.pitch_tone}
                        </span>
                      </div>
                      <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                        <span className="text-[11px] text-slate-500 block">Tempo & Intonasi:</span>
                        <span className="text-slate-200 font-medium">
                          {sheet.voice_characteristics.speech_tempo}
                        </span>
                      </div>
                      <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                        <span className="text-[11px] text-slate-500 block">Referensi Vokal:</span>
                        <span className="text-emerald-300 font-medium">
                          {sheet.voice_characteristics.voice_actor_reference || 'Cinema Standard'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Modal Footer */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
              <button
                onClick={() => setInspectPack(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
              >
                Tutup
              </button>
              <button
                onClick={() => {
                  handleImportPack(inspectPack);
                  setInspectPack(null);
                }}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>
                  Unduh Seluruh Paket ({inspectPack.characters.length} Karakter) ke Character Studio
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* PUBLISH CHARACTER PACK MODAL (SHARE FROM PROJECT TO MARKETPLACE)      */}
      {/* ===================================================================== */}
      {isPublishModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-amber-400" />
                  <span>Bagikan Paket Karakter ke Marketplace</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Pilih karakter dari Character Studio proyek Anda untuk diterbitkan lengkap dengan
                  lembar seed visual, deskripsi kostum, dan profil suaranya.
                </p>
              </div>
              <button
                onClick={() => setIsPublishModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePublishCharacterPack} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Sumber Proyek
                  </label>
                  <select
                    value={publishProjectId}
                    onChange={e => setPublishProjectId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.genre})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Genre Paket Karakter
                  </label>
                  <input
                    type="text"
                    value={packGenre}
                    onChange={e => setPackGenre(e.target.value)}
                    placeholder="Contoh: Xianxia / Wuxia"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Judul Paket Karakter di Marketplace
                </label>
                <input
                  type="text"
                  value={packTitle}
                  onChange={e => setPackTitle(e.target.value)}
                  placeholder="Contoh: Pendekar Awan Biru — Complete Character Pack"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Deskripsi Paket (Keunggulan Seed, Kostum & Suara)
                </label>
                <textarea
                  value={packDescription}
                  onChange={e => setPackDescription(e.target.value)}
                  rows={2}
                  placeholder="Jelaskan isi paket karakter ini untuk kreator lain..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Tag Pencarian (pisahkan dengan koma)
                </label>
                <input
                  type="text"
                  value={packTags}
                  onChange={e => setPackTags(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Character Checklist */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">
                    Pilih Karakter yang Akan Disertakan ({selectedCharIdsToPublish.length} dipilih)
                  </label>
                  {projectCharacters.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedCharIdsToPublish(
                          selectedCharIdsToPublish.length === projectCharacters.length
                            ? []
                            : projectCharacters.map(c => c.id)
                        )
                      }
                      className="text-[11px] text-amber-400 hover:underline cursor-pointer"
                    >
                      {selectedCharIdsToPublish.length === projectCharacters.length
                        ? 'Batalkan Semua'
                        : 'Pilih Semua'}
                    </button>
                  )}
                </div>

                {projectCharacters.length === 0 ? (
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-center text-xs text-slate-400">
                    Proyek ini belum memiliki karakter di Character Studio. Buat atau unduh karakter
                    terlebih dahulu.
                  </div>
                ) : (
                  <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                    {projectCharacters.map(char => {
                      const isChecked = selectedCharIdsToPublish.includes(char.id);
                      return (
                        <label
                          key={char.id}
                          className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                            isChecked
                              ? 'bg-amber-500/10 border-amber-500/40'
                              : 'bg-slate-950 border-slate-800'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={e => {
                              if (e.target.checked) {
                                setSelectedCharIdsToPublish(prev => [...prev, char.id]);
                              } else {
                                setSelectedCharIdsToPublish(prev =>
                                  prev.filter(id => id !== char.id)
                                );
                              }
                            }}
                            className="mt-1 accent-amber-500"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">{char.name}</span>
                              <span className="text-[10px] text-amber-300">
                                ({getRoleBadge(char.role)})
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 truncate mt-0.5">
                              Seed: {char.visual_consistency_prompt || 'Otomatis'} · Kostum:{' '}
                              {char.costume?.daily_attire || 'Tersedia'} · Suara:{' '}
                              {char.voice_characteristics?.pitch_tone || 'Tersedia'}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPublishModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPublishing || selectedCharIdsToPublish.length === 0}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-bold flex items-center gap-2 cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>
                    {isPublishing
                      ? 'Menerbitkan...'
                      : `Terbitkan Paket (${selectedCharIdsToPublish.length} Karakter)`}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TEMPLATE PREVIEW MODAL (EXISTING PROJECT TEMPLATE WORKFLOW)           */}
      {/* ===================================================================== */}
      {selectedTemplate && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl">
            <div className="h-48 relative">
              <img
                src={selectedTemplate.thumbnail_url}
                alt={selectedTemplate.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />
              <button
                onClick={() => setSelectedTemplate(null)}
                className="absolute top-4 right-4 px-3 py-1 rounded-lg bg-slate-950/80 text-slate-300 hover:text-white text-xs border border-slate-700 cursor-pointer"
              >
                Tutup
              </button>
              <div className="absolute bottom-4 left-6 right-6">
                <span className="px-2.5 py-0.5 rounded bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs">
                  {selectedTemplate.genre}
                </span>
                <h2 className="text-xl font-bold text-white mt-1">{selectedTemplate.title}</h2>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <p className="text-sm text-slate-300 leading-relaxed">
                {selectedTemplate.description}
              </p>

              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">
                  Isi Paket Template (Preview Data)
                </div>

                {selectedTemplate.preview_data?.world_summary && (
                  <div className="text-xs text-slate-300">
                    <span className="text-slate-500">Ringkasan Semesta: </span>
                    {selectedTemplate.preview_data.world_summary}
                  </div>
                )}

                {selectedTemplate.preview_data?.sample_dialogue && (
                  <div className="p-3 rounded-lg bg-slate-900 border-l-2 border-indigo-500 text-xs italic text-slate-200">
                    "{selectedTemplate.preview_data.sample_dialogue}"
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3 pt-1">
                  <div className="bg-slate-900 p-2.5 rounded-lg text-center">
                    <div className="text-sm font-bold text-white">
                      {selectedTemplate.preview_data?.characters_count || 0}
                    </div>
                    <div className="text-[11px] text-slate-400">Karakter</div>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-lg text-center">
                    <div className="text-sm font-bold text-white">
                      {selectedTemplate.preview_data?.scenes_count || 0}
                    </div>
                    <div className="text-[11px] text-slate-400">Adegan</div>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-lg text-center">
                    <div className="text-sm font-bold text-emerald-400">
                      {selectedTemplate.credit_cost === 0
                        ? 'Gratis'
                        : `${selectedTemplate.credit_cost} CR`}
                    </div>
                    <div className="text-[11px] text-slate-400">Biaya Kloning</div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setSelectedTemplate(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                >
                  Batal
                </button>
                <button
                  onClick={() => handleCloneTemplate(selectedTemplate)}
                  disabled={isCloningId === selectedTemplate.id}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
                >
                  <GitFork className="w-4 h-4" />
                  <span>
                    {isCloningId === selectedTemplate.id
                      ? 'Mengkloning...'
                      : 'Kloning ke Proyek Saya Sekarang'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
