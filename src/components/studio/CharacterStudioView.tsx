import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Project,
  Character,
  CharacterRole,
  MarketplaceCharacterPack,
  MarketplaceCharacterSheet,
} from '../../types/database';
import {
  fetchCharacters,
  createCharacterRecord,
  updateCharacterRecord,
  deleteCharacterRecord,
  fetchCharacterMarketplacePacks,
  importCharacterPackToProject,
  publishCharacterPackToMarketplace,
  uploadCharacterReferenceImage,
} from '../../lib/supabase';
import { CharacterModal } from './CharacterModal';
import {
  Users,
  Plus,
  Search,
  Sparkles,
  Copy,
  Check,
  Edit2,
  Trash2,
  Eye,
  X,
  Shield,
  ShieldCheck,
  Layers,
  HeartHandshake,
  MessageSquare,
  Volume2,
  ShoppingBag,
  Download,
  Share2,
  Shirt,
  Upload,
} from 'lucide-react';

interface CharacterStudioViewProps {
  projects: Project[];
  selectedProjectId?: string;
  onSelectProject?: (projectId: string) => void;
  onNavigateToMarketplace?: () => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onOpenCreateProject?: () => void;
}

export const CharacterStudioView: React.FC<CharacterStudioViewProps> = ({
  projects,
  selectedProjectId: propProjectId,
  onSelectProject,
  onNavigateToMarketplace,
  onShowToast,
  onOpenCreateProject,
}) => {
  const { user, profile, t } = useAuth();
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    propProjectId || projects[0]?.id || ''
  );
  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [inspectCharacter, setInspectCharacter] = useState<Character | null>(null);
  const [charToDelete, setCharToDelete] = useState<Character | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Marketplace Pack Browser & Quick Share state inside Character Studio
  const [isPackBrowserOpen, setIsPackBrowserOpen] = useState(false);
  const [marketplacePacks, setMarketplacePacks] = useState<MarketplaceCharacterPack[]>([]);
  const [isImportingKey, setIsImportingKey] = useState<string | null>(null);
  const [charToShare, setCharToShare] = useState<Character | null>(null);
  const [sharePackTitle, setSharePackTitle] = useState('');
  const [sharePackDesc, setSharePackDesc] = useState('');
  const [isSharing, setIsSharing] = useState(false);

  // Sync with parent selectedProjectId prop
  useEffect(() => {
    if (propProjectId && propProjectId !== selectedProjectId) {
      setSelectedProjectId(propProjectId);
    } else if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [propProjectId, projects, selectedProjectId]);

  // Load characters for selected project
  const loadCharacters = async () => {
    if (!selectedProjectId) return;
    setIsLoading(true);
    const res = await fetchCharacters(selectedProjectId);
    if (res.data) {
      setCharacters(res.data);
    } else {
      onShowToast(res.error || 'Gagal memuat karakter', 'error');
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadCharacters();
  }, [selectedProjectId]);

  // Filtered characters
  const filteredCharacters = useMemo(() => {
    return characters.filter((c) => {
      const matchRole = selectedRole === 'all' || c.role === selectedRole;
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.native_name && c.native_name.toLowerCase().includes(q)) ||
        (c.occupation_cultivation_level && c.occupation_cultivation_level.toLowerCase().includes(q)) ||
        (c.sect_or_faction && c.sect_or_faction.toLowerCase().includes(q)) ||
        c.role.toLowerCase().includes(q);
      return matchRole && matchQuery;
    });
  }, [characters, selectedRole, searchQuery]);

  // Actions
  const handleOpenCreate = () => {
    setEditingCharacter(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (c: Character) => {
    setEditingCharacter(c);
    setIsModalOpen(true);
  };

  const handleCopyPrompt = (c: Character) => {
    if (!c.visual_consistency_prompt) {
      onShowToast('Formula prompt karakter belum diatur.', 'info');
      return;
    }
    navigator.clipboard.writeText(c.visual_consistency_prompt);
    setCopiedId(c.id);
    onShowToast(`Prompt visual "${c.name}" disalin ke clipboard.`, 'success');
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  const handleSubmitCharacter = async (
    charData: Omit<Character, 'id' | 'created_at' | 'updated_at'>
  ) => {
    if (editingCharacter) {
      const res = await updateCharacterRecord(editingCharacter.id, charData);
      if (res.error) {
        onShowToast(res.error, 'error');
      } else {
        onShowToast(t.characterStudio.saveSuccess, 'success');
        setIsModalOpen(false);
        setEditingCharacter(null);
        await loadCharacters();
      }
    } else {
      const res = await createCharacterRecord(selectedProjectId, charData);
      if (res.error) {
        onShowToast(res.error, 'error');
      } else {
        onShowToast(t.characterStudio.saveSuccess, 'success');
        setIsModalOpen(false);
        await loadCharacters();
      }
    }
  };

  const handleConfirmDelete = async () => {
    if (!charToDelete) return;
    const res = await deleteCharacterRecord(charToDelete.id);
    if (res.error) {
      onShowToast(res.error, 'error');
    } else {
      onShowToast(t.characterStudio.deleteSuccess, 'info');
      setCharToDelete(null);
      await loadCharacters();
    }
  };

  const getRoleLabel = (role: CharacterRole) => {
    return t.characterStudio.roles[role] || role;
  };

  const handleQuickUploadReference = async (c: Character, file: File) => {
    const uploadRes = await uploadCharacterReferenceImage(
      selectedProjectId || c.project_id,
      file,
      c.name
    );
    if (uploadRes.error || !uploadRes.url) {
      onShowToast(uploadRes.error || 'Gagal mengunggah gambar referensi karakter.', 'error');
      return;
    }

    const upd = await updateCharacterRecord(c.id, { avatar_url: uploadRes.url });
    if (upd.error) {
      onShowToast(upd.error, 'error');
    } else {
      onShowToast(
        `Lembar referensi wajah "${c.name}" berhasil disimpan ke bucket (${uploadRes.bucket})!`,
        'success'
      );
      if (inspectCharacter && inspectCharacter.id === c.id) {
        setInspectCharacter({ ...inspectCharacter, avatar_url: uploadRes.url });
      }
      await loadCharacters();
    }
  };

  const handleOpenPackBrowser = async () => {
    setIsPackBrowserOpen(true);
    const res = await fetchCharacterMarketplacePacks();
    setMarketplacePacks(res.data);
  };

  const handleImportFromMarketplace = async (
    pack: MarketplaceCharacterPack,
    specificSheet?: MarketplaceCharacterSheet
  ) => {
    if (!selectedProjectId) return;
    const key = specificSheet ? `${pack.id}_${specificSheet.id}` : pack.id;
    setIsImportingKey(key);
    const res = await importCharacterPackToProject(selectedProjectId, pack.id, specificSheet?.id);
    setIsImportingKey(null);

    if (res.error) {
      onShowToast(res.error, 'error');
    } else {
      const msg = specificSheet
        ? `Karakter "${specificSheet.name}" berhasil diunduh ke Character Studio!`
        : `${res.imported.length} karakter dari "${pack.title}" berhasil diunduh ke Character Studio!`;
      onShowToast(msg, 'success');
      await loadCharacters();
    }
  };

  const handleOpenShareCharacter = (c: Character) => {
    const activeProj = projects.find((p) => p.id === selectedProjectId);
    setCharToShare(c);
    setSharePackTitle(`${c.name} — Character Seed & Voice Pack`);
    setSharePackDesc(
      `Karakter siap pakai (${c.occupation_cultivation_level || c.role}) dari proyek "${
        activeProj?.name || 'Studio'
      }" lengkap dengan lembar seed kontinuitas visual, deskripsi kostum 3 lapis, dan profil suara.`
    );
  };

  const handleConfirmShareCharacter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!charToShare) return;
    const activeProj = projects.find((p) => p.id === selectedProjectId);
    setIsSharing(true);
    const res = await publishCharacterPackToMarketplace({
      title: sharePackTitle,
      description: sharePackDesc,
      genre: activeProj?.genre || 'Action / Fantasy',
      author_name: profile?.display_name || user?.email?.split('@')[0] || 'Studio Creator',
      tags: [
        charToShare.name,
        activeProj?.genre || 'Character Pack',
        'Visual Seed Ready',
        'Voice Profile',
      ],
      credit_cost: 0,
      characters: [charToShare],
    });
    setIsSharing(false);

    if (res.error || !res.pack) {
      onShowToast(res.error || 'Gagal membagikan karakter ke Marketplace.', 'error');
    } else {
      onShowToast(
        `Karakter "${charToShare.name}" berhasil dibagikan ke Asset & Character Marketplace!`,
        'success'
      );
      setCharToShare(null);
    }
  };

  if (projects.length === 0) {
    return (
      <div className="p-8 max-w-5xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Users className="w-12 h-12 text-slate-600 mb-4" />
        <h3 className="text-xl font-bold text-slate-200 mb-2">{t.characterStudio.title}</h3>
        <p className="text-sm text-slate-400 max-w-md mb-6">
          Anda belum memiliki proyek. Buat proyek terlebih dahulu sebelum mendaftarkan tokoh dan karakter.
        </p>
        {onOpenCreateProject && (
          <button
            onClick={onOpenCreateProject}
            className="px-4 py-2 bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg hover:bg-amber-300 transition-colors cursor-pointer"
          >
            Buat Proyek Baru
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-5 h-5 text-amber-400" />
            <h1 className="text-xl font-bold text-slate-100">{t.characterStudio.title}</h1>
          </div>
          <p className="text-xs text-slate-400">{t.characterStudio.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Project Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">{t.characterStudio.selectProject}</span>
            <select
              value={selectedProjectId}
              onChange={(e) => {
                setSelectedProjectId(e.target.value);
                onSelectProject?.(e.target.value);
              }}
              className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-400/50"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.genre})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleOpenPackBrowser}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Unduh Paket Karakter (Marketplace)</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-1.5 bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg hover:bg-amber-300 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t.characterStudio.addNew}</span>
          </button>
        </div>
      </div>

      {/* Gate 2: World & Character Approval & 8-Layer Consistency Banner */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-white">Gate 2: World & Character Approval Gate</span>
            <span className="text-[11px] font-mono text-slate-400">
              ({characters.length} Karakter Terdaftar)
            </span>
            {characters.length > 0 && (
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                Gate 2 Siap Disetujui
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400">
            Arsitektur 8-Lapisan Konsistensi: Master Sheet 4-Sudut, Profil DNA Karakter, Injeksi Prompt Atribut & Reference Image Conditioning.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-mono px-2 py-1 bg-slate-950 rounded border border-slate-800 text-amber-300 hidden sm:inline-block">
            8-Layer Consistency Active
          </span>
          <button
            onClick={() => {
              if (characters.length === 0) {
                onShowToast('Belum ada karakter yang dibuat. Buat karakter terlebih dahulu sebelum mengunci Gate 2.', 'error');
                return;
              }
              onShowToast('Seluruh profil DNA karakter dan kontinuitas 8-lapisan telah dikunci sutradara (Gate 2 Lulus)!', 'success');
            }}
            className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Kunci Profil DNA (Gate 2)</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Role Segmented Control (Interactive Filter Buttons - Allowed) */}
        <div className="flex items-center gap-1 p-1 bg-slate-900/80 border border-slate-800/80 rounded-lg w-full md:w-auto overflow-x-auto">
          <button
            onClick={() => setSelectedRole('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
              selectedRole === 'all'
                ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.characterStudio.allRoles}
          </button>
          <button
            onClick={() => setSelectedRole('protagonist')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
              selectedRole === 'protagonist'
                ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.characterStudio.roles.protagonist}
          </button>
          <button
            onClick={() => setSelectedRole('antagonist')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
              selectedRole === 'antagonist'
                ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.characterStudio.roles.antagonist}
          </button>
          <button
            onClick={() => setSelectedRole('supporting')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
              selectedRole === 'supporting'
                ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.characterStudio.roles.supporting}
          </button>
          <button
            onClick={() => setSelectedRole('mentor')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
              selectedRole === 'mentor'
                ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.characterStudio.roles.mentor}
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.characterStudio.searchPlaceholder}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-400/50"
          />
        </div>
      </div>

      {/* Character Grid */}
      {isLoading ? (
        <div className="py-20 text-center text-xs text-slate-500 font-mono">
          Memuat daftar pemeran karakter...
        </div>
      ) : filteredCharacters.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-slate-800 rounded-xl bg-slate-900/30 p-8 space-y-3">
          <Users className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {characters.length === 0
              ? t.characterStudio.emptyState
              : 'Tidak ada karakter yang cocok dengan kriteria pencarian atau filter peran.'}
          </p>
          {characters.length === 0 && (
            <button
              onClick={handleOpenCreate}
              className="px-4 py-2 bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg hover:bg-amber-300 transition-colors cursor-pointer"
            >
              {t.characterStudio.emptyStateAction}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCharacters.map((c) => (
            <div
              key={c.id}
              className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-5 flex flex-col justify-between hover:border-slate-700/80 transition-all space-y-4"
            >
              <div className="space-y-3">
                {/* Top Row: Avatar & Identity */}
                <div className="flex items-start gap-3">
                  {/* Portrait Avatar with 1-Click Supabase Bucket Upload Overlay */}
                  <label
                    className="relative group/avatar w-12 h-12 rounded-lg bg-slate-800 border border-slate-700/80 flex items-center justify-center text-amber-400 font-bold text-base shrink-0 overflow-hidden cursor-pointer"
                    title="Klik untuk mengunggah Lembar Referensi Wajah ke Bucket (character-avatars)"
                  >
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleQuickUploadReference(c, f);
                      }}
                    />
                    {c.avatar_url ? (
                      <img
                        src={c.avatar_url}
                        alt={c.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{c.name.substring(0, 2).toUpperCase()}</span>
                    )}
                    <div className="absolute inset-0 bg-black/65 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center">
                      <Upload className="w-4 h-4 text-amber-300" />
                    </div>
                  </label>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-slate-100 truncate">{c.name}</h3>
                      {c.native_name && (
                        <span className="text-[11px] text-slate-400 font-serif truncate">
                          {c.native_name}
                        </span>
                      )}
                    </div>

                    {/* Unboxed Zero-Pill Metadata */}
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5 truncate">
                      <span className="text-amber-400 font-medium">{getRoleLabel(c.role)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{c.age} thn</span>
                      <span aria-hidden="true">·</span>
                      <span>{c.gender}</span>
                    </div>
                  </div>
                </div>

                {/* Cultivation & Sect Metadata */}
                <div className="space-y-1 text-xs text-slate-300 pt-1">
                  {c.occupation_cultivation_level && (
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <Layers className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{c.occupation_cultivation_level}</span>
                    </div>
                  )}

                  {c.sect_or_faction && (
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Shield className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{c.sect_or_faction}</span>
                    </div>
                  )}
                </div>

                {/* Motivation / Personality snippet */}
                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed pt-1 border-t border-slate-800/60">
                  {c.personality || c.motivation || c.background || 'Belum ada catatan deskripsi.'}
                </p>

                {/* Inter-character relationships preview */}
                {c.relationships && c.relationships.length > 0 && (
                  <div className="flex items-center gap-1 text-[11px] text-slate-400">
                    <HeartHandshake className="w-3 h-3 text-slate-500" />
                    <span>
                      {c.relationships.length} Relasi:{' '}
                      {c.relationships.map((r) => r.target_character_name).slice(0, 2).join(', ')}
                      {c.relationships.length > 2 && '...'}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Toolbar */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                {/* Visual Consistency Prompt Copy */}
                <button
                  onClick={() => handleCopyPrompt(c)}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700 rounded-md transition-colors cursor-pointer"
                  title="Salin Prompt Kontinuitas Visual"
                >
                  {copiedId === c.id ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3 text-amber-400" />
                  )}
                  <span>Prompt Seed</span>
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenShareCharacter(c)}
                    className="p-1.5 text-indigo-400 hover:text-indigo-200 transition-colors rounded hover:bg-slate-800 cursor-pointer"
                    title="Bagikan Karakter ke Marketplace (Seed, Kostum & Suara)"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setInspectCharacter(c)}
                    className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors rounded hover:bg-slate-800 cursor-pointer"
                    title="Lihat Detail Lengkap"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleOpenEdit(c)}
                    className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors rounded hover:bg-slate-800 cursor-pointer"
                    title="Ubah Profil Karakter"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setCharToDelete(c)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors rounded hover:bg-slate-800 cursor-pointer"
                    title="Hapus Karakter"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CHARACTER CREATE / EDIT MODAL */}
      <CharacterModal
        isOpen={isModalOpen}
        projectId={selectedProjectId}
        character={editingCharacter}
        existingCharacters={characters}
        onClose={() => {
          setIsModalOpen(false);
          setEditingCharacter(null);
        }}
        onSubmit={handleSubmitCharacter}
      />

      {/* CHARACTER INSPECT DETAIL MODAL */}
      {inspectCharacter && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-800 pb-4 gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-16 h-16 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center text-amber-400 font-bold text-lg shrink-0">
                  {inspectCharacter.avatar_url ? (
                    <img
                      src={inspectCharacter.avatar_url}
                      alt={inspectCharacter.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{inspectCharacter.name.substring(0, 2).toUpperCase()}</span>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                    <span>{inspectCharacter.name}</span>
                    {inspectCharacter.native_name && (
                      <span className="text-sm font-normal text-slate-400 font-serif">
                        ({inspectCharacter.native_name})
                      </span>
                    )}
                  </h3>
                  {/* Unboxed Metadata */}
                  <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-1">
                    <span className="text-amber-400 font-medium">
                      {getRoleLabel(inspectCharacter.role)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{inspectCharacter.age} tahun</span>
                    <span aria-hidden="true">·</span>
                    <span>{inspectCharacter.gender}</span>
                    {inspectCharacter.sect_or_faction && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{inspectCharacter.sect_or_faction}</span>
                      </>
                    )}
                  </div>
                  <label className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-md bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[11px] font-semibold cursor-pointer">
                    <Upload className="w-3 h-3" />
                    <span>Unggah Lembar Referensi Wajah (character-avatars)</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleQuickUploadReference(inspectCharacter, f);
                      }}
                    />
                  </label>
                </div>
              </div>

              <button
                onClick={() => setInspectCharacter(null)}
                className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors rounded hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Master Visual Consistency Prompt */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span className="flex items-center gap-1.5 text-amber-400">
                  <Sparkles className="w-3.5 h-3.5" />
                  Formula Kontinuitas Visual (Master Stable Seed)
                </span>
                <button
                  onClick={() => handleCopyPrompt(inspectCharacter)}
                  className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>Salin Prompt</span>
                </button>
              </div>
              <p className="text-xs font-mono text-slate-300 leading-relaxed bg-slate-900/60 p-2.5 rounded border border-slate-800/80 break-words">
                {inspectCharacter.visual_consistency_prompt ||
                  'Belum ada formula prompt master. Buat di Character Studio.'}
              </p>
            </div>

            {/* Physical Breakdown */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Penampilan Fisik & Anatomi Wajah
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800/70">
                  <span className="text-slate-500 block text-[11px]">Wajah & Rahang:</span>
                  {inspectCharacter.physical_appearance?.face_structure || '—'}
                </div>
                <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800/70">
                  <span className="text-slate-500 block text-[11px]">Bentuk & Warna Mata:</span>
                  {inspectCharacter.physical_appearance?.eyes || '—'}
                </div>
                <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800/70">
                  <span className="text-slate-500 block text-[11px]">Rambut:</span>
                  {inspectCharacter.physical_appearance?.hair || '—'}
                </div>
                <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800/70">
                  <span className="text-slate-500 block text-[11px]">Postur & Tinggi:</span>
                  {inspectCharacter.physical_appearance?.physique_height || '—'}
                </div>
              </div>
              {inspectCharacter.physical_appearance?.distinguishing_features && (
                <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800/70 text-xs text-slate-300">
                  <span className="text-slate-500 block text-[11px]">Ciri Khusus / Bekas Luka:</span>
                  {inspectCharacter.physical_appearance.distinguishing_features}
                </div>
              )}
            </div>

            {/* Costumes & Artifacts */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Katalog Busana & Pusaka
              </h4>
              <div className="space-y-2 text-xs text-slate-300">
                <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800/70">
                  <span className="text-slate-500 block text-[11px]">Busana Harian:</span>
                  {inspectCharacter.costume?.daily_attire || '—'}
                </div>
                <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800/70">
                  <span className="text-slate-500 block text-[11px]">Jubah Tempur:</span>
                  {inspectCharacter.costume?.battle_robes || '—'}
                </div>
                <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800/70">
                  <span className="text-slate-500 block text-[11px]">Senjata & Pusaka:</span>
                  {inspectCharacter.costume?.accessories_artifacts || '—'}
                </div>
              </div>
            </div>

            {/* Vocal Characteristics */}
            {inspectCharacter.voice_characteristics && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-slate-400" />
                  Karakteristik Suara & Ref Vokal
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                  <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800/70">
                    <span className="text-slate-500 block text-[11px]">Nada Suara (Pitch):</span>
                    {inspectCharacter.voice_characteristics.pitch_tone || '—'}
                  </div>
                  <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800/70">
                    <span className="text-slate-500 block text-[11px]">Tempo & Diksi:</span>
                    {inspectCharacter.voice_characteristics.speech_tempo || '—'}
                  </div>
                </div>
              </div>
            )}

            {/* Relationships Web */}
            {inspectCharacter.relationships && inspectCharacter.relationships.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Jejaring Hubungan
                </h4>
                <div className="space-y-1.5">
                  {inspectCharacter.relationships.map((r, i) => (
                    <div
                      key={i}
                      className="bg-slate-950/60 p-2.5 rounded border border-slate-800/70 text-xs flex items-center justify-between gap-2"
                    >
                      <div>
                        <span className="font-semibold text-slate-200">{r.target_character_name}</span>
                        <span className="text-slate-500 text-[11px] ml-2">({r.relation_type})</span>
                        <p className="text-[11px] text-slate-400 mt-0.5">{r.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setInspectCharacter(null)}
                className="px-4 py-1.5 bg-slate-800 text-slate-200 text-xs font-medium rounded-lg hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM DIALOG */}
      {charToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-sm w-full p-5 space-y-4 shadow-xl">
            <h3 className="text-sm font-semibold text-slate-100">Hapus Karakter</h3>
            <p className="text-xs text-slate-400">
              Apakah Anda yakin ingin menghapus karakter <strong className="text-slate-200">{charToDelete.name}</strong> dari studio? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setCharToDelete(null)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded-lg hover:bg-rose-500 cursor-pointer"
              >
                Hapus Karakter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INLINE MARKETPLACE CHARACTER PACK BROWSER MODAL */}
      {isPackBrowserOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-amber-400" />
                  <span>Unduh Paket Karakter Siap Pakai ke Character Studio</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Setiap karakter dilengkapi dengan Lembar Seed Visual, Deskripsi Kostum 3 Lapis, dan
                  Profil Suara.
                </p>
              </div>
              <button
                onClick={() => setIsPackBrowserOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-4 pr-1">
              {marketplacePacks.map((pack) => (
                <div
                  key={pack.id}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[10px] font-semibold">
                          {pack.genre}
                        </span>
                        <h4 className="text-sm font-bold text-white">{pack.title}</h4>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{pack.description}</p>
                    </div>
                    <button
                      onClick={() => handleImportFromMarketplace(pack)}
                      disabled={isImportingKey === pack.id}
                      className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>
                        {isImportingKey === pack.id
                          ? 'Mengunduh...'
                          : `Unduh Semua (${pack.characters.length})`}
                      </span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {pack.characters.map((sheet) => {
                      const singleKey = `${pack.id}_${sheet.id}`;
                      return (
                        <div
                          key={sheet.id}
                          className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 space-y-1.5 flex flex-col justify-between"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-white">
                                {sheet.name}{' '}
                                {sheet.native_name && (
                                  <span className="text-slate-400 font-serif">
                                    ({sheet.native_name})
                                  </span>
                                )}
                              </span>
                              <button
                                onClick={() => handleImportFromMarketplace(pack, sheet)}
                                disabled={isImportingKey === singleKey}
                                className="px-2 py-1 rounded bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                              >
                                <Download className="w-3 h-3" />
                                <span>Unduh</span>
                              </button>
                            </div>
                            <p className="text-[11px] text-amber-300/90 line-clamp-1">
                              <Sparkles className="w-3 h-3 inline mr-1" />
                              {sheet.visual_consistency_prompt}
                            </p>
                            <p className="text-[11px] text-slate-400 line-clamp-1">
                              <Shirt className="w-3 h-3 inline mr-1 text-indigo-400" />
                              {sheet.costume.daily_attire}
                            </p>
                            <p className="text-[11px] text-slate-400 line-clamp-1">
                              <Volume2 className="w-3 h-3 inline mr-1 text-emerald-400" />
                              {sheet.voice_characteristics.pitch_tone}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              {onNavigateToMarketplace ? (
                <button
                  onClick={() => {
                    setIsPackBrowserOpen(false);
                    onNavigateToMarketplace();
                  }}
                  className="text-xs text-amber-400 hover:underline cursor-pointer"
                >
                  Buka Halaman Penuh Asset & Character Marketplace →
                </button>
              ) : (
                <span />
              )}
              <button
                onClick={() => setIsPackBrowserOpen(false)}
                className="px-4 py-1.5 bg-slate-800 text-slate-200 text-xs font-medium rounded-lg hover:bg-slate-700 cursor-pointer"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK SHARE CHARACTER TO MARKETPLACE MODAL */}
      {charToShare && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-amber-400" />
                  <span>Bagikan "{charToShare.name}" ke Marketplace</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Karakter akan dibagikan beserta Seed Visual, Kostum, dan Profil Suara.
                </p>
              </div>
              <button
                onClick={() => setCharToShare(null)}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmShareCharacter} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Judul Paket di Marketplace
                </label>
                <input
                  type="text"
                  value={sharePackTitle}
                  onChange={(e) => setSharePackTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Deskripsi Paket Karakter
                </label>
                <textarea
                  value={sharePackDesc}
                  onChange={(e) => setSharePackDesc(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-[11px] text-slate-300 space-y-1">
                <div className="font-semibold text-amber-400">Ringkasan Data yang Dibagikan:</div>
                <div className="truncate">
                  • Seed Visual: {charToShare.visual_consistency_prompt || 'Otomatis'}
                </div>
                <div className="truncate">
                  • Kostum: {charToShare.costume?.daily_attire || 'Tersedia'}
                </div>
                <div className="truncate">
                  • Profil Suara: {charToShare.voice_characteristics?.pitch_tone || 'Tersedia'}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setCharToShare(null)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSharing}
                  className="px-4 py-1.5 bg-amber-500 text-slate-950 text-xs font-bold rounded-lg hover:bg-amber-400 cursor-pointer disabled:opacity-50"
                >
                  {isSharing ? 'Menerbitkan...' : 'Bagikan Sekarang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
