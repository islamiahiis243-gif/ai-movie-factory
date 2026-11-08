import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Project, WorldBible, CultivationRealm, FactionOrSect, LocationEntry, TimelineEvent } from '../../types/database';
import { fetchWorldBible, saveWorldBibleRecord } from '../../lib/supabase';
import {
  Compass,
  Globe2,
  Sparkles,
  Mountain,
  History,
  Plus,
  Trash2,
  Edit2,
  Save,
  CheckCircle2,
  AlertCircle,
  FolderKanban,
  Shield,
  Layers,
  ChevronRight,
} from 'lucide-react';

interface WorldBuilderViewProps {
  projects: Project[];
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onOpenCreateProject?: () => void;
}

export const WorldBuilderView: React.FC<WorldBuilderViewProps> = ({
  projects,
  onShowToast,
  onOpenCreateProject,
}) => {
  const { t } = useAuth();
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '');
  const [bible, setBible] = useState<WorldBible | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'cultivation' | 'geography' | 'timeline'>('overview');

  // Modals for adding/editing nested entities
  const [realmModalOpen, setRealmModalOpen] = useState(false);
  const [editingRealm, setEditingRealm] = useState<CultivationRealm | null>(null);

  const [factionModalOpen, setFactionModalOpen] = useState(false);
  const [editingFaction, setEditingFaction] = useState<FactionOrSect | null>(null);

  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationEntry | null>(null);

  const [timelineModalOpen, setTimelineModalOpen] = useState(false);
  const [editingTimeline, setEditingTimeline] = useState<TimelineEvent | null>(null);

  // Update selected project if initial projects change
  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  // Load World Bible whenever selected project changes
  useEffect(() => {
    if (!selectedProjectId) return;
    let isMounted = true;
    const loadBible = async () => {
      setIsLoading(true);
      const res = await fetchWorldBible(selectedProjectId);
      if (isMounted) {
        if (res.data) {
          setBible(res.data);
        } else {
          onShowToast(res.error || 'Gagal memuat World Bible', 'error');
        }
        setIsLoading(false);
      }
    };
    loadBible();
    return () => {
      isMounted = false;
    };
  }, [selectedProjectId]);

  const currentProject = projects.find((p) => p.id === selectedProjectId);

  // Save changes to World Bible
  const handleSaveBible = async () => {
    if (!selectedProjectId || !bible) return;
    setIsSaving(true);
    const res = await saveWorldBibleRecord(selectedProjectId, bible);
    setIsSaving(false);

    if (res.error) {
      onShowToast(res.error, 'error');
    } else {
      setBible(res.data);
      onShowToast(t.worldBuilder.saveSuccess, 'success');
    }
  };

  // Helper for generic text field updates
  const handleFieldChange = (field: keyof WorldBible, value: any) => {
    if (!bible) return;
    setBible({
      ...bible,
      [field]: value,
    });
  };

  // --- Realm Management ---
  const handleSaveRealm = (realm: CultivationRealm) => {
    if (!bible) return;
    const existingIndex = bible.cultivation_realms.findIndex((r) => r.id === realm.id);
    let updatedRealms = [...bible.cultivation_realms];
    if (existingIndex >= 0) {
      updatedRealms[existingIndex] = realm;
    } else {
      updatedRealms.push(realm);
    }
    // Sort by level_order
    updatedRealms.sort((a, b) => a.level_order - b.level_order);
    handleFieldChange('cultivation_realms', updatedRealms);
    setRealmModalOpen(false);
    setEditingRealm(null);
  };

  const handleDeleteRealm = (id: string) => {
    if (!bible) return;
    handleFieldChange(
      'cultivation_realms',
      bible.cultivation_realms.filter((r) => r.id !== id)
    );
  };

  // --- Faction Management ---
  const handleSaveFaction = (faction: FactionOrSect) => {
    if (!bible) return;
    const existingIndex = bible.factions.findIndex((f) => f.id === faction.id);
    let updatedFactions = [...bible.factions];
    if (existingIndex >= 0) {
      updatedFactions[existingIndex] = faction;
    } else {
      updatedFactions.push(faction);
    }
    handleFieldChange('factions', updatedFactions);
    setFactionModalOpen(false);
    setEditingFaction(null);
  };

  const handleDeleteFaction = (id: string) => {
    if (!bible) return;
    handleFieldChange(
      'factions',
      bible.factions.filter((f) => f.id !== id)
    );
  };

  // --- Location Management ---
  const handleSaveLocation = (loc: LocationEntry) => {
    if (!bible) return;
    const existingIndex = bible.locations.findIndex((l) => l.id === loc.id);
    let updatedLocations = [...bible.locations];
    if (existingIndex >= 0) {
      updatedLocations[existingIndex] = loc;
    } else {
      updatedLocations.push(loc);
    }
    handleFieldChange('locations', updatedLocations);
    setLocationModalOpen(false);
    setEditingLocation(null);
  };

  const handleDeleteLocation = (id: string) => {
    if (!bible) return;
    handleFieldChange(
      'locations',
      bible.locations.filter((l) => l.id !== id)
    );
  };

  // --- Timeline Management ---
  const handleSaveTimeline = (event: TimelineEvent) => {
    if (!bible) return;
    const existingIndex = bible.timeline.findIndex((e) => e.id === event.id);
    let updatedTimeline = [...bible.timeline];
    if (existingIndex >= 0) {
      updatedTimeline[existingIndex] = event;
    } else {
      updatedTimeline.push(event);
    }
    handleFieldChange('timeline', updatedTimeline);
    setTimelineModalOpen(false);
    setEditingTimeline(null);
  };

  const handleDeleteTimeline = (id: string) => {
    if (!bible) return;
    handleFieldChange(
      'timeline',
      bible.timeline.filter((e) => e.id !== id)
    );
  };

  if (projects.length === 0) {
    return (
      <div className="p-8 max-w-5xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Compass className="w-12 h-12 text-slate-600 mb-4" />
        <h3 className="text-xl font-bold text-slate-200 mb-2">{t.worldBuilder.title}</h3>
        <p className="text-sm text-slate-400 max-w-md mb-6">
          Anda belum memiliki proyek produksi. Buat proyek terlebih dahulu untuk mulai membangun semesta fiksi dan Story Bible.
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
      {/* Header & Project Selector Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Compass className="w-5 h-5 text-amber-400" />
            <h1 className="text-xl font-bold text-slate-100">{t.worldBuilder.title}</h1>
          </div>
          <p className="text-xs text-slate-400">{t.worldBuilder.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Project Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">{t.worldBuilder.selectProject}</span>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-400/50"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.genre})
                </option>
              ))}
            </select>
          </div>

          {/* Save Action */}
          <button
            onClick={handleSaveBible}
            disabled={isSaving || !bible}
            className="flex items-center gap-2 px-4 py-1.5 bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg hover:bg-amber-300 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? t.worldBuilder.saving : t.worldBuilder.saveBtn}</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-xs text-slate-500 font-mono">
          Memuat data World Bible semesta...
        </div>
      ) : !bible ? (
        <div className="py-20 text-center text-xs text-slate-500">
          Tidak ada data semesta untuk proyek ini.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Sub-tab Navigation (Segmented Control - Buttons Allowed) */}
          <div className="flex items-center gap-1 p-1 bg-slate-900/80 border border-slate-800/80 rounded-lg overflow-x-auto">
            <button
              onClick={() => setActiveSubTab('overview')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                activeSubTab === 'overview'
                  ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Globe2 className="w-3.5 h-3.5" />
              <span>{t.worldBuilder.tabs.universe}</span>
            </button>
            <button
              onClick={() => setActiveSubTab('cultivation')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                activeSubTab === 'cultivation'
                  ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t.worldBuilder.tabs.cultivation}</span>
            </button>
            <button
              onClick={() => setActiveSubTab('geography')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                activeSubTab === 'geography'
                  ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Mountain className="w-3.5 h-3.5" />
              <span>{t.worldBuilder.tabs.geography}</span>
            </button>
            <button
              onClick={() => setActiveSubTab('timeline')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                activeSubTab === 'timeline'
                  ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>{t.worldBuilder.tabs.timeline}</span>
            </button>
          </div>

          {/* TAB 1: OVERVIEW & METAPHYSICS */}
          {activeSubTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Globe2 className="w-4 h-4 text-amber-400" />
                  <span>Fondasi Semesta</span>
                </h3>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    {t.worldBuilder.fields.worldName}
                  </label>
                  <input
                    type="text"
                    value={bible.world_name}
                    onChange={(e) => handleFieldChange('world_name', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-400/50"
                    placeholder="Contoh: Benua Tianhuang / Mega-Jakarta 2088"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    {t.worldBuilder.fields.synopsis}
                  </label>
                  <textarea
                    rows={4}
                    value={bible.synopsis}
                    onChange={(e) => handleFieldChange('synopsis', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-400/50 leading-relaxed"
                    placeholder="Ringkasan esensi dunia dan tema konflik utama..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    {t.worldBuilder.fields.history}
                  </label>
                  <textarea
                    rows={5}
                    value={bible.historical_background}
                    onChange={(e) => handleFieldChange('historical_background', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-400/50 leading-relaxed"
                    placeholder="Asal-usul dunia, malapetaka kuno, atau perang pembuka zaman..."
                  />
                </div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Hukum Alam & Sistem Metafisika / Teknologi</span>
                </h3>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    {t.worldBuilder.fields.rules}
                  </label>
                  <textarea
                    rows={4}
                    value={bible.rules_of_the_world}
                    onChange={(e) => handleFieldChange('rules_of_the_world', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-400/50 leading-relaxed"
                    placeholder="Hukum absolut, batasan kosmik, atau hukum karma..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    {t.worldBuilder.fields.magicTech}
                  </label>
                  <textarea
                    rows={4}
                    value={bible.magic_or_tech_system}
                    onChange={(e) => handleFieldChange('magic_or_tech_system', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-400/50 leading-relaxed"
                    placeholder="Prinsip sihir, formasi array, atau arsitektur teknologi siber..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    {t.worldBuilder.fields.spiritualEnergy}
                  </label>
                  <textarea
                    rows={3}
                    value={bible.spiritual_energy_rules || ''}
                    onChange={(e) => handleFieldChange('spiritual_energy_rules', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-400/50 leading-relaxed"
                    placeholder="Penyaluran Qi spiritual, vena tanah, atau pasokan energi sel inti..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CULTIVATION REALMS & FACTIONS (SSOT Section 8) */}
          {activeSubTab === 'cultivation' && (
            <div className="space-y-8">
              {/* Cultivation Realms Section */}
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-amber-400" />
                      <span>{t.worldBuilder.cultivation.title}</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Hierarki tingkatan kekuatan berjenjang (Order Level 1 ke atas) dengan syarat terobosan dan kemampuan.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingRealm({
                        id: `realm-${Date.now()}`,
                        name: '',
                        level_order: (bible.cultivation_realms.length || 0) + 1,
                        description: '',
                        advancement_requirements: '',
                        powers_abilities: '',
                      });
                      setRealmModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t.worldBuilder.cultivation.addRealm}</span>
                  </button>
                </div>

                {bible.cultivation_realms.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
                    Belum ada ranah kultivasi yang ditentukan. Tambahkan ranah berjenjang untuk semesta cerita ini.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead>
                        <tr className="border-b border-slate-800 text-[11px] text-slate-400 font-medium">
                          <th className="py-2 px-3 w-16">Urutan</th>
                          <th className="py-2 px-3">Nama Ranah</th>
                          <th className="py-2 px-3">Deskripsi Ranah</th>
                          <th className="py-2 px-3">Syarat Terobosan</th>
                          <th className="py-2 px-3">Kemampuan Khusus</th>
                          <th className="py-2 px-3 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-sans">
                        {bible.cultivation_realms.map((realm) => (
                          <tr key={realm.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="py-3 px-3 font-mono tabular-nums text-amber-400 font-semibold">
                              #{realm.level_order}
                            </td>
                            <td className="py-3 px-3 font-medium text-slate-100 whitespace-nowrap">
                              {realm.name}
                            </td>
                            <td className="py-3 px-3 text-slate-300 max-w-xs truncate">
                              {realm.description}
                            </td>
                            <td className="py-3 px-3 text-slate-400 max-w-xs truncate">
                              {realm.advancement_requirements || '—'}
                            </td>
                            <td className="py-3 px-3 text-slate-400 max-w-xs truncate">
                              {realm.powers_abilities || '—'}
                            </td>
                            <td className="py-3 px-3 text-right whitespace-nowrap">
                              <button
                                onClick={() => {
                                  setEditingRealm(realm);
                                  setRealmModalOpen(true);
                                }}
                                className="p-1 text-slate-400 hover:text-slate-200 transition-colors mr-1 cursor-pointer"
                                title="Ubah"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteRealm(realm.id)}
                                className="p-1 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                                title="Hapus"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Factions & Sects Section */}
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-amber-400" />
                      <span>{t.worldBuilder.cultivation.sectsTitle}</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Sekte lurus, sekte iblis, klan bangsawan, atau korporasi yang memegang kendali politik dunia.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingFaction({
                        id: `faction-${Date.now()}`,
                        name: '',
                        type: 'sect',
                        alignment: 'righteous',
                        leader: '',
                        headquarters: '',
                        description: '',
                        specialties: '',
                      });
                      setFactionModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t.worldBuilder.cultivation.addSect}</span>
                  </button>
                </div>

                {bible.factions.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
                    Belum ada faksi atau sekte terdaftar. Tambahkan faksi penggerak narasi.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {bible.factions.map((f) => (
                      <div
                        key={f.id}
                        className="bg-slate-950 border border-slate-800/90 rounded-lg p-4 space-y-2 relative"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="text-sm font-semibold text-slate-100">{f.name}</h4>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <span className="capitalize">{f.type}</span>
                              <span aria-hidden="true">·</span>
                              <span className="capitalize">{f.alignment}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setEditingFaction(f);
                                setFactionModalOpen(true);
                              }}
                              className="p-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteFaction(f.id)}
                              className="p-1 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">
                          {f.description}
                        </p>

                        <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                          {f.leader && (
                            <div>
                              <span className="text-slate-500">Pemimpin:</span> {f.leader}
                            </div>
                          )}
                          {f.headquarters && (
                            <div>
                              <span className="text-slate-500">Markas:</span> {f.headquarters}
                            </div>
                          )}
                          {f.specialties && (
                            <div>
                              <span className="text-slate-500">Keahlian:</span> {f.specialties}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: GEOGRAPHY & LOCATIONS */}
          {activeSubTab === 'geography' && (
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <Mountain className="w-4 h-4 text-amber-400" />
                    <span>{t.worldBuilder.locations.title}</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Katalog wilayah geografis, pegunungan terlarang, benteng, dan tingkat ancaman bagi karakter.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setEditingLocation({
                      id: `loc-${Date.now()}`,
                      name: '',
                      region: '',
                      terrain_climate: '',
                      description: '',
                      controlling_faction: '',
                      danger_level: 'moderate',
                    });
                    setLocationModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t.worldBuilder.locations.addLocation}</span>
                </button>
              </div>

              {bible.locations.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
                  Belum ada lokasi terdaftar. Tambahkan titik geografis semesta cerita.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {bible.locations.map((loc) => (
                    <div
                      key={loc.id}
                      className="bg-slate-950 border border-slate-800/90 rounded-lg p-4 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-semibold text-slate-100">{loc.name}</h4>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <span>{loc.region || 'Wilayah Umum'}</span>
                            <span aria-hidden="true">·</span>
                            <span className="capitalize">{loc.danger_level || 'moderate'}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingLocation(loc);
                              setLocationModalOpen(true);
                            }}
                            className="p-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteLocation(loc.id)}
                            className="p-1 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">
                        {loc.description}
                      </p>

                      <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                        {loc.terrain_climate && (
                          <div>
                            <span className="text-slate-500">Iklim / Lanskap:</span> {loc.terrain_climate}
                          </div>
                        )}
                        {loc.controlling_faction && (
                          <div>
                            <span className="text-slate-500">Penguasa:</span> {loc.controlling_faction}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: CHRONOLOGICAL TIMELINE */}
          {activeSubTab === 'timeline' && (
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <History className="w-4 h-4 text-amber-400" />
                    <span>{t.worldBuilder.timeline.title}</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Rangkaian linimasa zaman kuno hingga saat ini yang melandasi ketegangan dunia cerita.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setEditingTimeline({
                      id: `event-${Date.now()}`,
                      era: '',
                      year_or_time: '',
                      title: '',
                      description: '',
                      significance: '',
                    });
                    setTimelineModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t.worldBuilder.timeline.addEvent}</span>
                </button>
              </div>

              {bible.timeline.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
                  Belum ada linimasa peristiwa. Tambahkan tonggak sejarah pembentuk semesta.
                </div>
              ) : (
                <div className="relative border-l border-slate-800 ml-4 pl-6 space-y-6">
                  {bible.timeline.map((ev) => (
                    <div key={ev.id} className="relative group">
                      <div className="absolute -left-[31px] top-1.5 w-2.5 h-2.5 rounded-full bg-amber-400/80 border border-slate-950" />
                      <div className="bg-slate-950 border border-slate-800/90 rounded-lg p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-[11px] font-mono text-amber-400/90 tabular-nums">
                              {ev.era} · {ev.year_or_time}
                            </div>
                            <h4 className="text-sm font-semibold text-slate-100 mt-0.5">{ev.title}</h4>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setEditingTimeline(ev);
                                setTimelineModalOpen(true);
                              }}
                              className="p-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteTimeline(ev.id)}
                              className="p-1 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <p className="text-xs text-slate-300 leading-relaxed">{ev.description}</p>

                        {ev.significance && (
                          <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
                            <span className="text-slate-500">Dampak Naratif:</span> {ev.significance}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* --- REALM MODAL --- */}
      {realmModalOpen && editingRealm && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-sm font-semibold text-slate-100">
              {editingRealm.name ? 'Ubah Ranah Kultivasi' : 'Tambah Ranah Kultivasi Baru'}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Nama Ranah</label>
                <input
                  type="text"
                  value={editingRealm.name}
                  onChange={(e) => setEditingRealm({ ...editingRealm, name: e.target.value })}
                  placeholder="Contoh: Ranah Fondasi Qi (Qi Condensation)"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-400/50"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Tingkat Urutan (Order)</label>
                <input
                  type="number"
                  value={editingRealm.level_order}
                  onChange={(e) =>
                    setEditingRealm({ ...editingRealm, level_order: parseInt(e.target.value) || 1 })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 font-mono tabular-nums focus:outline-none focus:border-amber-400/50"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Deskripsi Ranah</label>
                <textarea
                  rows={2}
                  value={editingRealm.description}
                  onChange={(e) => setEditingRealm({ ...editingRealm, description: e.target.value })}
                  placeholder="Fase pemurnian Qi, pembukaan 108 meridian..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-400/50"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Syarat Terobosan</label>
                <input
                  type="text"
                  value={editingRealm.advancement_requirements || ''}
                  onChange={(e) =>
                    setEditingRealm({ ...editingRealm, advancement_requirements: e.target.value })
                  }
                  placeholder="Membasuh sumsum, pil fondasi sembilan putaran..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-400/50"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Kemampuan Khusus</label>
                <input
                  type="text"
                  value={editingRealm.powers_abilities || ''}
                  onChange={(e) =>
                    setEditingRealm({ ...editingRealm, powers_abilities: e.target.value })
                  }
                  placeholder="Pelepasan pedang terbang, penglihatan spiritual 100 li..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-400/50"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setRealmModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => editingRealm.name.trim() && handleSaveRealm(editingRealm)}
                disabled={!editingRealm.name.trim()}
                className="px-4 py-1.5 bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg hover:bg-amber-300 disabled:opacity-50 cursor-pointer"
              >
                Simpan Ranah
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- FACTION MODAL --- */}
      {factionModalOpen && editingFaction && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-sm font-semibold text-slate-100">
              {editingFaction.name ? 'Ubah Faksi / Sekte' : 'Tambah Faksi / Sekte Baru'}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Nama Faksi / Sekte</label>
                <input
                  type="text"
                  value={editingFaction.name}
                  onChange={(e) => setEditingFaction({ ...editingFaction, name: e.target.value })}
                  placeholder="Contoh: Sekte Pedang Awan Sembilan (Cloud Sword Sect)"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-400/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Tipe Faksi</label>
                  <select
                    value={editingFaction.type}
                    onChange={(e) =>
                      setEditingFaction({ ...editingFaction, type: e.target.value as any })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-400/50 capitalize"
                  >
                    <option value="sect">Sekte (Sect)</option>
                    <option value="clan">Klan (Clan)</option>
                    <option value="kingdom">Kerajaan (Kingdom)</option>
                    <option value="corporation">Korporasi (Corporation)</option>
                    <option value="syndicate">Sindikat (Syndicate)</option>
                    <option value="other">Lainnya</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Afiliasi / Alignment</label>
                  <select
                    value={editingFaction.alignment}
                    onChange={(e) =>
                      setEditingFaction({ ...editingFaction, alignment: e.target.value as any })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-400/50 capitalize"
                  >
                    <option value="righteous">Sekte Lurus (Righteous)</option>
                    <option value="demonic">Sekte Iblis (Demonic)</option>
                    <option value="neutral">Netral (Neutral)</option>
                    <option value="chaotic">Kaotik (Chaotic)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Pemimpin / Tetua Tertinggi</label>
                <input
                  type="text"
                  value={editingFaction.leader || ''}
                  onChange={(e) => setEditingFaction({ ...editingFaction, leader: e.target.value })}
                  placeholder="Contoh: Pemimpin Sekte Bai Cang"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-400/50"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Markas Utama</label>
                <input
                  type="text"
                  value={editingFaction.headquarters || ''}
                  onChange={(e) => setEditingFaction({ ...editingFaction, headquarters: e.target.value })}
                  placeholder="Contoh: Puncak Teratai Surgawi"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-400/50"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Deskripsi Faksi</label>
                <textarea
                  rows={2}
                  value={editingFaction.description}
                  onChange={(e) => setEditingFaction({ ...editingFaction, description: e.target.value })}
                  placeholder="Sejarah dan kedudukan faksi dalam lanskap politik semesta..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-400/50"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Keahlian & Sumber Daya Khusus</label>
                <input
                  type="text"
                  value={editingFaction.specialties || ''}
                  onChange={(e) => setEditingFaction({ ...editingFaction, specialties: e.target.value })}
                  placeholder="Contoh: Seni Pedang Kilat, Vena Batu Roh Langit"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-400/50"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setFactionModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => editingFaction.name.trim() && handleSaveFaction(editingFaction)}
                disabled={!editingFaction.name.trim()}
                className="px-4 py-1.5 bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg hover:bg-amber-300 disabled:opacity-50 cursor-pointer"
              >
                Simpan Faksi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- LOCATION MODAL --- */}
      {locationModalOpen && editingLocation && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-sm font-semibold text-slate-100">
              {editingLocation.name ? 'Ubah Wilayah / Lokasi' : 'Tambah Wilayah / Lokasi Baru'}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Nama Lokasi</label>
                <input
                  type="text"
                  value={editingLocation.name}
                  onChange={(e) => setEditingLocation({ ...editingLocation, name: e.target.value })}
                  placeholder="Contoh: Hutan Kabut Hitam (Black Fog Forest)"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-400/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Wilayah / Realm</label>
                  <input
                    type="text"
                    value={editingLocation.region}
                    onChange={(e) => setEditingLocation({ ...editingLocation, region: e.target.value })}
                    placeholder="Contoh: Wilayah Utara"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-400/50"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Tingkat Bahaya</label>
                  <select
                    value={editingLocation.danger_level || 'moderate'}
                    onChange={(e) =>
                      setEditingLocation({ ...editingLocation, danger_level: e.target.value as any })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-400/50 capitalize"
                  >
                    <option value="peaceful">Damai (Peaceful)</option>
                    <option value="moderate">Menengah (Moderate)</option>
                    <option value="perilous">Berbahaya (Perilous)</option>
                    <option value="forbidden">Terlarang / Maut (Forbidden)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Lanskap & Iklim</label>
                <input
                  type="text"
                  value={editingLocation.terrain_climate}
                  onChange={(e) => setEditingLocation({ ...editingLocation, terrain_climate: e.target.value })}
                  placeholder="Hutan purba berkabut racun, jurang tanpa dasar..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-400/50"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Penguasa / Faksi Pengontrol</label>
                <input
                  type="text"
                  value={editingLocation.controlling_faction || ''}
                  onChange={(e) => setEditingLocation({ ...editingLocation, controlling_faction: e.target.value })}
                  placeholder="Contoh: Tak bertuan / Teritori Sekte Pedang Awan"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-400/50"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Deskripsi & Peran Naratif</label>
                <textarea
                  rows={2}
                  value={editingLocation.description}
                  onChange={(e) => setEditingLocation({ ...editingLocation, description: e.target.value })}
                  placeholder="Tempat ujian sekte, habitat binatang roh tingkat tinggi..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-400/50"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setLocationModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => editingLocation.name.trim() && handleSaveLocation(editingLocation)}
                disabled={!editingLocation.name.trim()}
                className="px-4 py-1.5 bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg hover:bg-amber-300 disabled:opacity-50 cursor-pointer"
              >
                Simpan Lokasi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- TIMELINE MODAL --- */}
      {timelineModalOpen && editingTimeline && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-sm font-semibold text-slate-100">
              {editingTimeline.title ? 'Ubah Titik Linimasa' : 'Tambah Titik Linimasa Baru'}
            </h3>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Nama Era / Zaman</label>
                  <input
                    type="text"
                    value={editingTimeline.era}
                    onChange={(e) => setEditingTimeline({ ...editingTimeline, era: e.target.value })}
                    placeholder="Contoh: Zaman Kuno / Era Baru"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-400/50"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Waktu / Penanggalan</label>
                  <input
                    type="text"
                    value={editingTimeline.year_or_time}
                    onChange={(e) => setEditingTimeline({ ...editingTimeline, year_or_time: e.target.value })}
                    placeholder="Contoh: 10.000 SM / Tahun 2088"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-400/50 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Judul Peristiwa</label>
                <input
                  type="text"
                  value={editingTimeline.title}
                  onChange={(e) => setEditingTimeline({ ...editingTimeline, title: e.target.value })}
                  placeholder="Contoh: Runtuhnya Tembok Surga Purba"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-400/50"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Deskripsi Peristiwa</label>
                <textarea
                  rows={3}
                  value={editingTimeline.description}
                  onChange={(e) => setEditingTimeline({ ...editingTimeline, description: e.target.value })}
                  placeholder="Detail peristiwa sejarah yang mengubah tatanan dunia..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-400/50"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Dampak Terhadap Cerita</label>
                <input
                  type="text"
                  value={editingTimeline.significance}
                  onChange={(e) => setEditingTimeline({ ...editingTimeline, significance: e.target.value })}
                  placeholder="Memicu perburuan artefak purba oleh sang antagonis..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-400/50"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setTimelineModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => editingTimeline.title.trim() && handleSaveTimeline(editingTimeline)}
                disabled={!editingTimeline.title.trim()}
                className="px-4 py-1.5 bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg hover:bg-amber-300 disabled:opacity-50 cursor-pointer"
              >
                Simpan Peristiwa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
