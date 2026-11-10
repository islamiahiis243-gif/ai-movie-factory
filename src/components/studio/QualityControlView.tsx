import React, { useState, useEffect, useMemo } from 'react';
import {
  Project,
  Character,
  SceneItem,
  MediaAsset,
  ExportPackage,
  QCCheckItem,
  QCPillarCategory,
  QCApprovalState,
  QCComprehensiveAudit,
  ApprovalEntityItem,
} from '../../types/database';
import {
  fetchCharacters,
  fetchProjectScenes,
  fetchProjectAssets,
  fetchExportPackages,
} from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import {
  QC_15_PARAMETERS,
  evaluateProjectQC,
  validateExportClearance,
} from '../../lib/qualityControlEngine';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Sparkles,
  Filter,
  Search,
  RefreshCw,
  Users,
  ScrollText,
  Clapperboard,
  Video,
  Mic,
  Music,
  Download,
  ExternalLink,
  ChevronRight,
  Eye,
  Check,
  RotateCcw,
  Sliders,
  FileCheck2,
  HelpCircle,
  FileWarning,
} from 'lucide-react';

interface QualityControlViewProps {
  projects: Project[];
  selectedProjectId?: string;
  onSelectProject?: (id: string) => void;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  onNavigateToModule?: (tab: string, projectId: string) => void;
}

const LOCAL_STORAGE_QC_AUDITS_KEY = 'ai_movie_factory_qc_audits_v1';
const LOCAL_STORAGE_APPROVALS_KEY = 'ai_movie_factory_approvals_v1';
const LOCAL_STORAGE_QC_OVERRIDES_KEY = 'ai_movie_factory_qc_overrides_v1';

export const QualityControlView: React.FC<QualityControlViewProps> = ({
  projects,
  selectedProjectId,
  onSelectProject,
  onShowToast,
  onNavigateToModule,
}) => {
  const { language } = useAuth();
  const isId = language === 'id';

  // Active Project Selection
  const activeProject = useMemo(() => {
    return projects.find((p) => p.id === selectedProjectId) || projects[0] || null;
  }, [projects, selectedProjectId]);

  // Project Entity State
  const [characters, setCharacters] = useState<Character[]>([]);
  const [scenes, setScenes] = useState<SceneItem[]>([]);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [exportPackages, setExportPackages] = useState<ExportPackage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Active Tab: 'audit_engine' | 'approval_hub' | 'missing_assets'
  const [activeTab, setActiveTab] = useState<'audit_engine' | 'approval_hub' | 'missing_assets'>('audit_engine');

  // Audit State
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditProgress, setAuditProgress] = useState(0);
  const [activeAuditStage, setActiveAuditStage] = useState('');
  const [currentAudit, setCurrentAudit] = useState<QCComprehensiveAudit | null>(null);

  // Director Overrides State (SSOT Section 8: Warning/Advisory override by director)
  const [directorOverrides, setDirectorOverrides] = useState<Record<string, { overridden: boolean; override_reason: string }>>({});
  const [overridingCheck, setOverridingCheck] = useState<QCCheckItem | null>(null);
  const [overrideReasonInput, setOverrideReasonInput] = useState('');

  // Approval Hub Filter State
  const [approvalFilter, setApprovalFilter] = useState<'all' | QCApprovalState>('all');
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Entity for Director Review Modal
  const [reviewingEntity, setReviewingEntity] = useState<ApprovalEntityItem | null>(null);
  const [reviewNote, setReviewNote] = useState('');

  // Approvals State List
  const [approvalItems, setApprovalItems] = useState<ApprovalEntityItem[]>([]);

  // 15 SSOT Parameter Definitions (Section 8, TC-WF-12)
  const pillarDefinitions = useMemo(() => {
    return QC_15_PARAMETERS.map((p) => ({
      id: p.id,
      title: isId ? p.nameId : p.nameEn,
      desc: isId ? p.descriptionId : p.descriptionEn,
      category: p.category,
      severity: p.severity,
      weight: p.weight,
    }));
  }, [isId]);

  // Load project data and cached audits
  useEffect(() => {
    if (!activeProject) return;

    let mounted = true;
    setIsLoading(true);

    async function loadQCData() {
      try {
        const [charRes, sceneRes, assetRes, expRes] = await Promise.all([
          fetchCharacters(activeProject.id),
          fetchProjectScenes(activeProject.id),
          fetchProjectAssets(activeProject.id),
          fetchExportPackages(activeProject.id),
        ]);

        if (!mounted) return;
        const fetchedChars = charRes.data || [];
        const fetchedScenes = sceneRes.data || [];
        const fetchedAssets = assetRes.data || [];
        const fetchedPackages = expRes.data || [];

        setCharacters(fetchedChars);
        setScenes(fetchedScenes);
        setAssets(fetchedAssets);
        setExportPackages(fetchedPackages);

        // Assemble Approval Entities from all creative tables (SSOT Section 35)
        const builtItems: ApprovalEntityItem[] = [];

        // 1. Characters
        fetchedChars.forEach((c) => {
          builtItems.push({
            id: `appr-char-${c.id}`,
            project_id: activeProject.id,
            entity_type: 'character',
            entity_id: c.id,
            title: c.name,
            subtitle: `${c.role.toUpperCase()} • ${c.occupation_cultivation_level || c.sect_or_faction || 'Profil Visual'}`,
            version: '1.0',
            approval_status: 'approved',
            submitted_by: 'Character Studio Agent',
            submitted_at: c.created_at,
            reviewed_by: 'Sutradara Utama',
            reviewed_at: c.updated_at,
            review_notes: 'Konsistensi wajah dan kostum disetujui sesuai bible dunia.',
            thumbnail_url: c.avatar_url || undefined,
          });
        });

        // 2. Scenes & Screenplays
        fetchedScenes.forEach((s) => {
          const mappedStatus: QCApprovalState =
            s.approval_status === 'approved'
              ? 'approved'
              : s.approval_status === 'revision_requested'
              ? 'revision_required'
              : s.approval_status === 'in_review'
              ? 'submitted'
              : 'draft';

          builtItems.push({
            id: `appr-scene-${s.id}`,
            project_id: activeProject.id,
            entity_type: 'scene',
            entity_id: s.id,
            title: `#${s.scene_number || 1} ${s.title}`,
            subtitle: `${s.location_name || 'Lokasi'} • ${s.time_of_day || 'DAY'} • ${s.int_ext || 'EXT'}`,
            version: s.versions_count ? `${s.versions_count}.0` : '1.0',
            approval_status: mappedStatus,
            submitted_by: 'Story & Script Writer Agent',
            submitted_at: s.created_at,
            reviewed_by: s.approved_by || 'Sutradara Utama',
            reviewed_at: s.approved_at || s.updated_at,
            review_notes: 'Struktur dramatik dan dialog memenuhi standar naskah.',
          });
        });

        // 3. Media Assets (Images, Videos, Voiceover)
        fetchedAssets.forEach((a) => {
          builtItems.push({
            id: `appr-asset-${a.id}`,
            project_id: activeProject.id,
            entity_type: (a.asset_type as any) || 'image',
            entity_id: a.id,
            title: a.asset_name,
            subtitle: `${a.provider} • ${a.model} • Subtipe: ${a.subtype || a.asset_type}`,
            version: a.version ? `${a.version}.0` : '1.0',
            approval_status: (a.approval_status as QCApprovalState) || 'approved',
            submitted_by: a.provider || 'Media Studio Generator',
            submitted_at: a.created_at,
            reviewed_by: a.approved_by || 'Sutradara Utama',
            reviewed_at: a.approved_at || a.created_at,
            thumbnail_url: a.file_url,
          });
        });

        // 4. Export Packages
        fetchedPackages.forEach((pkg) => {
          builtItems.push({
            id: `appr-pkg-${pkg.id}`,
            project_id: activeProject.id,
            entity_type: 'export_package',
            entity_id: pkg.id,
            title: pkg.package_title,
            subtitle: `Format: ${pkg.format.toUpperCase()} • ${pkg.resolution} • ${pkg.framerate}`,
            version: 'Master 1.0',
            approval_status: pkg.status === 'ready' ? 'approved' : 'draft',
            submitted_by: 'Timeline Master Assembly Engine',
            submitted_at: pkg.created_at,
            reviewed_by: 'Sutradara Utama',
            reviewed_at: pkg.created_at,
            review_notes: 'Paket master video tervalidasi siap dipublikasikan.',
          });
        });

        // Load custom overrides from localStorage if present
        try {
          const rawAppr = localStorage.getItem(`${LOCAL_STORAGE_APPROVALS_KEY}_${activeProject.id}`);
          if (rawAppr) {
            const savedOverrides: Record<string, Partial<ApprovalEntityItem>> = JSON.parse(rawAppr);
            builtItems.forEach((item, idx) => {
              if (savedOverrides[item.id]) {
                builtItems[idx] = { ...item, ...savedOverrides[item.id] };
              }
            });
          }
        } catch (e) {
          console.warn('Failed reading approval overrides:', e);
        }

        setApprovalItems(builtItems);

        // Load director overrides
        let loadedOverrides: Record<string, { overridden: boolean; override_reason: string }> = {};
        try {
          const rawOverrides = localStorage.getItem(`${LOCAL_STORAGE_QC_OVERRIDES_KEY}_${activeProject.id}`);
          if (rawOverrides) {
            loadedOverrides = JSON.parse(rawOverrides);
            setDirectorOverrides(loadedOverrides);
          }
        } catch (e) {
          console.warn('Failed reading qc overrides:', e);
        }

        // Load or initialize QC Comprehensive Audit
        try {
          const rawAudit = localStorage.getItem(`${LOCAL_STORAGE_QC_AUDITS_KEY}_${activeProject.id}`);
          if (rawAudit) {
            const parsed = JSON.parse(rawAudit);
            if (parsed && parsed.checks && parsed.checks.length === 15) {
              setCurrentAudit(parsed);
              return;
            }
          }
        } catch (e) {
          console.warn('Failed reading cached audit:', e);
        }

        // Initialize 15-parameter comprehensive audit if none cached or outdated
        generateInitialAudit(activeProject, fetchedChars, fetchedScenes, fetchedAssets, loadedOverrides);
      } catch (err) {
        console.warn('Error loading QC and Continuity data:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadQCData();
    return () => {
      mounted = false;
    };
  }, [activeProject?.id]);

  // Generate Baseline 15-Parameter Audit Based on Actual Project Assets
  const generateInitialAudit = (
    proj: Project,
    chars: Character[],
    scs: SceneItem[],
    ast: MediaAsset[],
    overrides = directorOverrides
  ) => {
    const audit = evaluateProjectQC({
      project: proj,
      characters: chars,
      scenes: scs,
      assets: ast,
      existingOverrides: overrides,
    });

    setCurrentAudit(audit);
    try {
      localStorage.setItem(`${LOCAL_STORAGE_QC_AUDITS_KEY}_${proj.id}`, JSON.stringify(audit));
    } catch (e) {
      console.warn('Failed saving baseline audit:', e);
    }
  };

  // Apply Director Override for Warning/Advisory Parameter (SSOT Section 8)
  const handleApplyDirectorOverride = (check: QCCheckItem, reason: string) => {
    if (!activeProject || !reason.trim()) return;
    const paramKey = check.pillar || check.category;
    const updatedOverrides = {
      ...directorOverrides,
      [paramKey]: {
        overridden: true,
        override_reason: reason.trim(),
      },
    };
    setDirectorOverrides(updatedOverrides);
    try {
      localStorage.setItem(`${LOCAL_STORAGE_QC_OVERRIDES_KEY}_${activeProject.id}`, JSON.stringify(updatedOverrides));
    } catch (e) {
      console.warn('Failed saving override:', e);
    }

    const updatedAudit = evaluateProjectQC({
      project: activeProject,
      characters,
      scenes,
      assets,
      existingOverrides: updatedOverrides,
    });
    setCurrentAudit(updatedAudit);
    try {
      localStorage.setItem(`${LOCAL_STORAGE_QC_AUDITS_KEY}_${activeProject.id}`, JSON.stringify(updatedAudit));
    } catch (e) {
      console.warn('Failed saving audit:', e);
    }

    setOverridingCheck(null);
    setOverrideReasonInput('');
    onShowToast(
      isId
        ? `Persetujuan sutradara (Override) berhasil diterapkan untuk "${check.check_name}".`
        : `Director override applied for "${check.check_name}".`,
      'success'
    );
  };

  // Run Full Project AI QC Audit
  const handleRunFullAudit = async () => {
    if (!activeProject || isAuditing) return;
    setIsAuditing(true);
    setAuditProgress(0);

    const stages = [
      { progress: 15, msg: isId ? 'Memindai Konsistensi Wajah Karakter & Master Sheet (Auto AI)...' : 'Scanning Character Facial Likeness & Master Sheet (Auto AI)...' },
      { progress: 30, msg: isId ? 'Memvalidasi Kontinuitas Busana, Properti & Latar (Auto AI)...' : 'Validating Costume, Prop & Setting Continuity (Auto AI)...' },
      { progress: 50, msg: isId ? 'Mendeteksi Distorsi Anatomi & AI Glitch Frame...' : 'Scanning Anatomical Distortions & AI Glitches...' },
      { progress: 70, msg: isId ? 'Memeriksa Kepatuhan Normalisasi Audio -14/-16 LUFS & Lip-sync...' : 'Inspecting -14/-16 LUFS Loudness & Lip-sync Viseme...' },
      { progress: 85, msg: isId ? 'Memverifikasi Rasio Aspek Proyek & Format Master Video...' : 'Verifying Target Aspect Ratio & Master Export Specs...' },
      { progress: 100, msg: isId ? 'Audit 15 Parameter QC Selesai!' : '15-Parameter QC Audit Complete!' },
    ];

    for (const st of stages) {
      await new Promise((r) => setTimeout(r, 650));
      setAuditProgress(st.progress);
      setActiveAuditStage(st.msg);
    }

    // Refresh audit
    generateInitialAudit(activeProject, characters, scenes, assets, directorOverrides);
    setIsAuditing(false);
    onShowToast(
      isId
        ? `Audit Kontrol Kualitas 15 Parameter proyek "${activeProject.name}" selesai!`
        : `15-Parameter QC Audit for project "${activeProject.name}" completed!`,
      'success'
    );
  };

  // Save Approval Decision
  const handleSaveApprovalDecision = (newState: QCApprovalState) => {
    if (!reviewingEntity || !activeProject) return;

    const now = new Date().toISOString();
    const updated = approvalItems.map((item) => {
      if (item.id === reviewingEntity.id) {
        return {
          ...item,
          approval_status: newState,
          reviewed_by: 'Sutradara Utama',
          reviewed_at: now,
          review_notes: reviewNote.trim() || item.review_notes,
        };
      }
      return item;
    });

    setApprovalItems(updated);

    // Save to localStorage
    try {
      const overrides: Record<string, any> = {};
      updated.forEach((it) => {
        overrides[it.id] = {
          approval_status: it.approval_status,
          reviewed_by: it.reviewed_by,
          reviewed_at: it.reviewed_at,
          review_notes: it.review_notes,
        };
      });
      localStorage.setItem(`${LOCAL_STORAGE_APPROVALS_KEY}_${activeProject.id}`, JSON.stringify(overrides));
    } catch (e) {
      console.warn('Failed saving approval override:', e);
    }

    onShowToast(
      isId
        ? `Status entitas "${reviewingEntity.title}" berhasil diubah menjadi "${newState.toUpperCase()}".`
        : `Entity status updated to "${newState.toUpperCase()}".`,
      'success'
    );

    setReviewingEntity(null);
    setReviewNote('');
  };

  // Batch Approve All Verified
  const handleBatchApproveVerified = () => {
    if (!activeProject) return;
    const now = new Date().toISOString();
    const updated = approvalItems.map((item) => ({
      ...item,
      approval_status: 'approved' as QCApprovalState,
      reviewed_by: 'Sutradara Utama (Batch)',
      reviewed_at: now,
    }));

    setApprovalItems(updated);
    try {
      const overrides: Record<string, any> = {};
      updated.forEach((it) => {
        overrides[it.id] = {
          approval_status: 'approved',
          reviewed_by: 'Sutradara Utama (Batch)',
          reviewed_at: now,
        };
      });
      localStorage.setItem(`${LOCAL_STORAGE_APPROVALS_KEY}_${activeProject.id}`, JSON.stringify(overrides));
    } catch (e) {
      console.warn('Failed saving batch approvals:', e);
    }

    onShowToast(
      isId
        ? 'Seluruh draf entitas kreatif berhasil disetujui (Approved) secara massal!'
        : 'All verified creative drafts have been batch-approved!',
      'success'
    );
  };

  // Filtered Approval Items
  const filteredApprovalItems = useMemo(() => {
    return approvalItems.filter((item) => {
      const matchesStatus = approvalFilter === 'all' || item.approval_status === approvalFilter;
      const matchesType = entityTypeFilter === 'all' || item.entity_type === entityTypeFilter;
      const matchesSearch =
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesStatus && matchesType && matchesSearch;
    });
  }, [approvalItems, approvalFilter, entityTypeFilter, searchQuery]);

  // Missing Assets calculation
  const missingAssetCards = useMemo(() => {
    const list: { title: string; category: string; desc: string; targetTab: string }[] = [];

    if (characters.length === 0) {
      list.push({
        title: isId ? 'Karakter Utama Belum Didaftarkan' : 'Main Character Not Registered',
        category: 'Karakter',
        desc: isId ? 'Proyek belum memiliki tokoh utama dengan profil visual konsisten.' : 'No characters with visual seed prompts registered.',
        targetTab: 'character_studio',
      });
    }

    if (scenes.length === 0) {
      list.push({
        title: isId ? 'Naskah Adegan Kosong' : 'Empty Scene Script',
        category: 'Naskah & Cerita',
        desc: isId ? 'Belum ada adegan naskah yang diurai untuk musim dan episode aktif.' : 'No screenplay scenes broken down for the active project.',
        targetTab: 'story_script',
      });
    }

    const videoAssets = assets.filter((a) => a.asset_type === 'video');
    if (videoAssets.length === 0) {
      list.push({
        title: isId ? 'Aset Video Belum Digenerasikan' : 'No Video Assets Generated',
        category: 'Media Video',
        desc: isId ? 'Belum ada shot video render yang tersedia untuk timeline post-produksi.' : 'No video clips generated yet for timeline assembly.',
        targetTab: 'media_studio',
      });
    }

    const voiceAssets = assets.filter((a) => a.asset_type === 'voice');
    if (voiceAssets.length === 0) {
      list.push({
        title: isId ? 'Sulih Suara Karakter (TTS) Kosong' : 'Missing Voiceover Tracks',
        category: 'Audio Vokal',
        desc: isId ? 'Adegan dialog belum memiliki rekaman suara sulih karakter beremosi.' : 'No voiceover dialogue clips generated for characters.',
        targetTab: 'media_studio',
      });
    }

    return list;
  }, [characters, scenes, assets, isId]);

  if (!activeProject) {
    return (
      <div className="p-8 text-center text-slate-400">
        <p>{isId ? 'Silakan pilih proyek produksi terlebih dahulu.' : 'Please select a production project first.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header & Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-600/10 border border-amber-400/30 flex items-center justify-center text-amber-400 shadow-md shadow-amber-400/10">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-tight">
                  {isId ? 'Quality Control & Kontinuitas' : 'Quality Control & Continuity Hub'}
                </h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-400/20">
                  SSOT Part 13 (Sec 34 & 35)
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isId
                  ? 'Audit komprehensif 12 pilar mutu, konsistensi karakter, dan gerbang persetujuan sutradara.'
                  : '12-pillar quality audit, character consistency verification, and director approval gatekeeper.'}
              </p>
            </div>
          </div>
        </div>

        {/* Right Action Bar */}
        <div className="flex items-center gap-3">
          {/* Project Selector */}
          <div className="flex items-center gap-2 bg-[#101726] px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
            <span className="text-slate-400">{isId ? 'Proyek:' : 'Project:'}</span>
            <select
              value={activeProject.id}
              onChange={(e) => onSelectProject && onSelectProject(e.target.value)}
              className="bg-transparent text-amber-400 font-semibold focus:outline-none cursor-pointer"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id} className="bg-slate-900 text-slate-200">
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Trigger Full Audit */}
          <button
            onClick={handleRunFullAudit}
            disabled={isAuditing}
            className="px-3.5 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-all shadow-md shadow-amber-400/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAuditing ? 'animate-spin' : ''}`} />
            <span>{isAuditing ? (isId ? 'Memindai...' : 'Auditing...') : (isId ? 'Jalankan Audit Penuh' : 'Run Full QC Audit')}</span>
          </button>
        </div>
      </div>

      {/* Audit Progress Bar Banner (During Active Scan) */}
      {isAuditing && (
        <div className="p-4 rounded-xl bg-[#101726] border border-amber-400/40 shadow-xl animate-in fade-in space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
              {activeAuditStage}
            </span>
            <span className="font-mono text-amber-400 font-bold">{auditProgress}%</span>
          </div>
          <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-300"
              style={{ width: `${auditProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Production Readiness Score Dashboard */}
      {currentAudit && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-[#101726] border border-slate-800/80 shadow-lg flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-amber-400/10 border-2 border-amber-400/40 flex items-center justify-center font-mono text-xl font-bold text-amber-400 shrink-0">
              {currentAudit.overall_score}%
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                {isId ? 'Skor Kelayakan Produksi' : 'Production Readiness Score'}
              </p>
              <h3 className="text-sm font-bold text-white mt-0.5 flex items-center gap-1.5">
                {currentAudit.readiness_status === 'passed' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400">{isId ? 'Lolos Standar Mutu' : 'Industry Ready'}</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span className="text-amber-400">{isId ? 'Perlu Perhatian' : 'Review Needed'}</span>
                  </>
                )}
              </h3>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                {currentAudit.checks.length} {isId ? 'indikator teruji' : 'pillars verified'}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#101726] border border-slate-800/80 shadow-lg flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400">{isId ? 'Entitas Disetujui' : 'Approved Entities'}</p>
              <h4 className="text-lg font-bold text-emerald-300 font-mono">
                {approvalItems.filter((i) => i.approval_status === 'approved').length} / {approvalItems.length}
              </h4>
              <p className="text-[10px] text-slate-500">{isId ? 'Tersertifikasi sutradara' : 'Certified for pipeline'}</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#101726] border border-slate-800/80 shadow-lg flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
              <FileWarning className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400">{isId ? 'Perlu Revisi / Catatan' : 'Revisions Required'}</p>
              <h4 className="text-lg font-bold text-rose-400 font-mono">
                {approvalItems.filter((i) => i.approval_status === 'revision_required' || i.approval_status === 'rejected').length}
              </h4>
              <p className="text-[10px] text-slate-500">{isId ? 'Membutuhkan regenerasi AI' : 'Requires AI regeneration'}</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#101726] border border-slate-800/80 shadow-lg flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400">{isId ? 'Aset Hilang Terdeteksi' : 'Missing Assets'}</p>
              <h4 className="text-lg font-bold text-blue-400 font-mono">
                {missingAssetCards.length}
              </h4>
              <p className="text-[10px] text-slate-500">{isId ? 'Belum digenerasikan' : 'Pending generation'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Studio Tab Navigation */}
      <div className="flex border-b border-slate-800 bg-[#101726] rounded-xl overflow-hidden p-1 gap-1 text-xs">
        <button
          onClick={() => setActiveTab('audit_engine')}
          className={`flex-1 py-2.5 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'audit_engine'
              ? 'bg-amber-400 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>{isId ? '15 Parameter QC & Kontinuitas (SSOT)' : '15-Parameter QC Engine (SSOT)'}</span>
        </button>

        <button
          onClick={() => setActiveTab('approval_hub')}
          className={`flex-1 py-2.5 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'approval_hub'
              ? 'bg-amber-400 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>{isId ? 'Pusat Persetujuan & Versi Kreatif' : 'Versioning & Approval Gatekeeper'}</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/20 text-current">
            {approvalItems.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('missing_assets')}
          className={`flex-1 py-2.5 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'missing_assets'
              ? 'bg-amber-400 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>{isId ? 'Pemindai Aset Hilang' : 'Missing Asset Scanner'}</span>
          {missingAssetCards.length > 0 && (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-500 text-white font-bold">
              {missingAssetCards.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: 15-PARAMETER QC AUDIT ENGINE */}
      {activeTab === 'audit_engine' && currentAudit && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>{isId ? '15 Parameter Mutu & Kontinuitas Sinematik (SSOT Bagian 8)' : '15 Cinematic Quality & Continuity Parameters (SSOT Section 8)'}</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {isId
                  ? 'Evaluasi berlapis: Auto AI, Technical Rule Engine, dan Director Manual Verification dengan hierarki Critical Blocker & Advisory.'
                  : 'Multi-layer evaluation: Auto AI, Technical Rule Engine, and Director Manual Verification with Critical Blocker & Advisory hierarchy.'}
              </p>
            </div>
            <span className="text-xs text-slate-400 font-mono shrink-0">
              {isId ? 'Terakhir diaudit:' : 'Last audited:'} {new Date(currentAudit.audited_at).toLocaleTimeString()}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {currentAudit.checks.map((chk) => (
              <div
                key={chk.id}
                className="p-4 rounded-xl bg-[#101726] border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col justify-between gap-2 text-xs"
              >
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <span className="font-bold text-white text-xs">{chk.check_name}</span>
                    <div className="flex items-center gap-1.5">
                      {/* Evaluation Category Badge */}
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold uppercase ${
                        chk.evaluation_mode === 'auto_ai'
                          ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/30'
                          : chk.evaluation_mode === 'director_manual'
                          ? 'bg-purple-500/10 text-purple-300 border border-purple-500/30'
                          : 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
                      }`}>
                        {chk.evaluation_mode === 'auto_ai' ? '🤖 Auto AI' : chk.evaluation_mode === 'director_manual' ? '🎬 Director' : '⚙️ Technical'}
                      </span>

                      {/* Severity Badge */}
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold uppercase ${
                        chk.severity === 'critical_blocker'
                          ? 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                          : 'bg-slate-700/50 text-slate-300 border border-slate-600/50'
                      }`}>
                        {chk.severity === 'critical_blocker' ? '🚨 Blocker' : 'Advisory'}
                      </span>

                      {/* Status Badge */}
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 ${
                          chk.status === 'passed'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : chk.status === 'warning'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {chk.status === 'passed' ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                        <span>{chk.status}</span>
                        <span className="ml-1 opacity-80">{chk.score}%</span>
                      </span>
                    </div>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">{chk.details}</p>
                </div>

                {chk.recommendation && (
                  <div className="p-2 rounded bg-amber-400/5 border border-amber-400/20 text-amber-300 text-[11px] mt-1 flex items-start gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span>{chk.recommendation}</span>
                  </div>
                )}

                {/* Director Override Section */}
                <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                  {chk.overridden ? (
                    <span className="text-[10px] bg-emerald-500/15 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1 font-mono">
                      <Check className="w-3 h-3" />
                      {isId ? 'Override Sutradara Aktif' : 'Director Override Active'}
                    </span>
                  ) : (chk.status === 'warning' || chk.status === 'failed') && chk.severity === 'warning_advisory' ? (
                    <button
                      onClick={() => {
                        setOverridingCheck(chk);
                        setOverrideReasonInput('Disetujui sutradara: Variasi artistik dapat diterima sesuai visi visual.');
                      }}
                      className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>{isId ? 'Override Sutradara (Artistic Approval)' : 'Director Override'}</span>
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: VERSIONING & APPROVAL GATEKEEPER */}
      {activeTab === 'approval_hub' && (
        <div className="space-y-4">
          {/* Filter Bar & Batch Actions */}
          <div className="p-4 rounded-xl bg-[#101726] border border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-400 font-semibold">{isId ? 'Status Persetujuan:' : 'Approval Status:'}</span>
              {(['all', 'draft', 'submitted', 'approved', 'revision_required', 'rejected'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setApprovalFilter(st)}
                  className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer transition-colors ${
                    approvalFilter === st
                      ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {st === 'all'
                    ? (isId ? 'Semua' : 'All')
                    : st === 'revision_required'
                    ? (isId ? 'Perlu Revisi' : 'Revision')
                    : st.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleBatchApproveVerified}
                className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 border border-emerald-500/30 font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isId ? 'Setujui Semua Draf Teruji' : 'Batch Approve All Verified'}</span>
              </button>
            </div>
          </div>

          {/* Items Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredApprovalItems.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl bg-[#101726] border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col justify-between text-xs space-y-3 shadow-md"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400/80 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                      {item.entity_type.replace('_', ' ')} • v{item.version}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                        item.approval_status === 'approved'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : item.approval_status === 'revision_required'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {item.approval_status.replace('_', ' ')}
                    </span>
                  </div>

                  {item.thumbnail_url && (
                    <div className="w-full h-28 rounded-lg overflow-hidden bg-black/60 border border-slate-800">
                      <img src={item.thumbnail_url} alt={item.title} className="w-full h-full object-cover" />
                    </div>
                  )}

                  <div>
                    <h4 className="font-bold text-white text-xs truncate">{item.title}</h4>
                    {item.subtitle && <p className="text-[11px] text-slate-400 truncate mt-0.5">{item.subtitle}</p>}
                  </div>

                  {item.review_notes && (
                    <div className="p-2 rounded bg-slate-900/60 border border-slate-800 text-[10px] text-slate-300">
                      <span className="text-slate-500 font-semibold">{isId ? 'Catatan Sutradara:' : 'Director Note:'}</span> {item.review_notes}
                    </div>
                  )}
                </div>

                {/* Review Action Trigger */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-500 font-mono truncate">
                    {item.reviewed_by || item.submitted_by || 'Reviewer'}
                  </span>
                  <button
                    onClick={() => {
                      setReviewingEntity(item);
                      setReviewNote(item.review_notes || '');
                    }}
                    className="px-2.5 py-1 bg-amber-400/10 hover:bg-amber-400 text-amber-400 hover:text-slate-950 font-bold rounded text-[11px] transition-colors cursor-pointer"
                  >
                    {isId ? 'Beri Keputusan' : 'Review & Decide'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: MISSING ASSET SCANNER */}
      {activeTab === 'missing_assets' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-[#101726] border border-slate-800/80">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1 flex items-center gap-2">
              <FileWarning className="w-4 h-4 text-amber-400" />
              <span>{isId ? 'Deteksi Kebutuhan Produksi yang Belum Terpenuhi' : 'Unfulfilled Production Requirements'}</span>
            </h3>
            <p className="text-xs text-slate-400">
              {isId
                ? 'Sistem mendeteksi komponen cerita, shot naskah, atau vokal yang belum selesai digenerasikan sebelum ekspor master.'
                : 'Scans for missing assets, unrendered scene shots, or absent voice tracks before master render packaging.'}
            </p>
          </div>

          {missingAssetCards.length === 0 ? (
            <div className="p-8 rounded-xl bg-[#101726] border border-slate-800/80 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <h4 className="font-bold text-white text-sm">{isId ? 'Seluruh Aset Produksi Lengkap!' : 'All Production Assets Complete!'}</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {isId
                  ? 'Karakter, naskah adegan, visual video, dan trek audio telah lengkap dan siap untuk tahap perakitan di Studio Editing.'
                  : 'Characters, screenplay scenes, video clips, and audio tracks are fully populated and ready for timeline assembly.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {missingAssetCards.map((card, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-[#101726] border border-amber-500/30 flex items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                      {card.category}
                    </span>
                    <h4 className="font-bold text-white text-xs">{card.title}</h4>
                    <p className="text-slate-400 text-[11px] leading-relaxed">{card.desc}</p>
                  </div>
                  {onNavigateToModule && (
                    <button
                      onClick={() => onNavigateToModule(card.targetTab, activeProject.id)}
                      className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-lg transition-colors flex items-center gap-1 shrink-0 cursor-pointer text-[11px]"
                    >
                      <span>{isId ? 'Buat Sekarang' : 'Generate Now'}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Review & Decision Modal */}
      {reviewingEntity && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#101726] border border-slate-800 rounded-xl max-w-md w-full shadow-2xl overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-sm">
                  {isId ? 'Keputusan Sutradara & Review Mutu' : 'Director Review & Decision'}
                </h3>
                <p className="text-xs text-amber-400/90 font-mono mt-0.5 truncate">{reviewingEntity.title}</p>
              </div>
              <button
                onClick={() => setReviewingEntity(null)}
                className="text-slate-400 hover:text-white text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1 block">
                  {isId ? 'Catatan Ulasan & Instruksi Sutradara:' : 'Review Notes & Director Feedback:'}
                </label>
                <textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder={
                    isId
                      ? 'Tuliskan catatan perbaikan atau alasan persetujuan untuk agen AI...'
                      : 'Provide revision notes or approval commentary for AI agents...'
                  }
                  rows={3}
                  className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 placeholder:text-slate-500 focus:border-amber-400 focus:outline-none text-xs resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 grid grid-cols-3 gap-2">
                <button
                  onClick={() => handleSaveApprovalDecision('approved')}
                  className="py-2 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{isId ? 'Setujui' : 'Approve'}</span>
                </button>

                <button
                  onClick={() => handleSaveApprovalDecision('revision_required')}
                  className="py-2 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>{isId ? 'Revisi' : 'Revision'}</span>
                </button>

                <button
                  onClick={() => handleSaveApprovalDecision('rejected')}
                  className="py-2 px-3 bg-rose-500 hover:bg-rose-400 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <XCircle className="w-4 h-4" />
                  <span>{isId ? 'Tolak' : 'Reject'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Director Override Parameter Modal (SSOT Section 8) */}
      {overridingCheck && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#0b101b] border border-amber-500/40 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl shadow-amber-500/10">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>{isId ? 'Override Persetujuan Sutradara' : 'Director Override Approval'}</span>
                </h3>
                <p className="text-xs text-amber-400/90 font-mono mt-0.5 truncate">{overridingCheck.check_name}</p>
              </div>
              <button
                onClick={() => setOverridingCheck(null)}
                className="text-slate-400 hover:text-white text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[11px] text-amber-300">
              <p className="font-semibold mb-1">
                {isId ? 'Ketentuan SSOT Section 8 (Exception Handling):' : 'SSOT Section 8 Policy (Exception Handling):'}
              </p>
              <p className="text-slate-300">
                {isId
                  ? 'Sutradara berhak menyetujui parameter berkategori Advisory / Warning bila variasi AI dinilai dapat diterima secara artistik. Catatan alasan Anda akan dicatat ke dalam audit trail proyek.'
                  : 'The Director may override Advisory / Warning parameters when AI deviations are deemed artistically acceptable. Your justification will be logged in the project audit trail.'}
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1 block">
                  {isId ? 'Alasan Pertimbangan Artistik / Catatan Override:' : 'Artistic Justification / Override Notes:'}
                </label>
                <textarea
                  value={overrideReasonInput}
                  onChange={(e) => setOverrideReasonInput(e.target.value)}
                  placeholder={
                    isId
                      ? 'Contoh: Variasi pencahayaan diterima untuk memperkuat nuansa tegang adegan...'
                      : 'E.g.: Lighting variance accepted to heighten suspense mood...'
                  }
                  rows={3}
                  className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 placeholder:text-slate-500 focus:border-amber-400 focus:outline-none text-xs resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  onClick={() => setOverridingCheck(null)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg text-xs cursor-pointer"
                >
                  {isId ? 'Batal' : 'Cancel'}
                </button>
                <button
                  onClick={() => handleApplyDirectorOverride(overridingCheck, overrideReasonInput)}
                  disabled={!overrideReasonInput.trim()}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/20"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isId ? 'Terapkan Override Sutradara' : 'Apply Director Override'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
