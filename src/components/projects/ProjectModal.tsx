import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Project, ProjectSettings, AspectRatio, ProductionMode, OutputResolution, FrameRate } from '../../types/database';
import { GENRE_OPTIONS, FORMAT_OPTIONS, PRODUCTION_MODULES, INITIAL_AI_AGENTS } from '../../lib/translations';
import { QUICK_START_TEMPLATES, ProjectTemplate } from '../../lib/workflowGates';
import { X, Check, HelpCircle, Sparkles, Film } from 'lucide-react';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    description: string;
    genre: string;
    custom_genre?: string;
    production_format: string;
    settings: ProjectSettings;
  }) => Promise<void>;
  editingProject?: Project | null;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editingProject,
}) => {
  const { t, language } = useAuth();
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState<string>('Xianxia');
  const [customGenre, setCustomGenre] = useState('');
  const [productionFormat, setProductionFormat] = useState<string>('Drama series');

  // Settings State
  const [seasonsCount, setSeasonsCount] = useState<number>(1);
  const [episodesCount, setEpisodesCount] = useState<number>(12);
  const [episodeDuration, setEpisodeDuration] = useState<number>(15);
  const [sceneCountTarget, setSceneCountTarget] = useState<number>(96);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [outputResolution, setOutputResolution] = useState<OutputResolution>('4K');
  const [frameRate, setFrameRate] = useState<FrameRate>('24fps');
  const [visualStyle, setVisualStyle] = useState<string>('3D Donghua Cinematic, Volumetric Lighting, Atmospheric Depth');
  const [outputLanguage, setOutputLanguage] = useState<string>(language);
  const [subtitleLanguage, setSubtitleLanguage] = useState<string>('en');
  const [voiceLanguage, setVoiceLanguage] = useState<string>(language);
  const [productionMode, setProductionMode] = useState<ProductionMode>('ai_assisted');
  const [enabledModules, setEnabledModules] = useState<string[]>([
    'world_builder',
    'character_studio',
    'story_script',
    'storyboard',
    'media_studio',
    'quality_control',
  ]);
  const [enabledAgents, setEnabledAgents] = useState<string[]>([
    'master_director',
    'world_builder_agent',
    'story_architect',
    'script_writer',
    'character_designer',
    'storyboard_director',
    'cinematographer',
    'image_gen_agent',
    'voice_agent',
    'quality_control_agent',
  ]);
  const [humanApprovalRequired, setHumanApprovalRequired] = useState<boolean>(true);
  const [creditBudget, setCreditBudget] = useState<number>(10000);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  // Validation
  const [error, setError] = useState<string | null>(null);

  const handleApplyTemplate = (tmpl: ProjectTemplate) => {
    setSelectedTemplateId(tmpl.id);
    setProductionFormat(tmpl.productionFormat);
    setAspectRatio(tmpl.aspectRatio);
    setOutputResolution(tmpl.outputResolution);
    setFrameRate(tmpl.frameRate);
    setEpisodeDuration(tmpl.episodeDurationMinutes);
    setEpisodesCount(tmpl.episodesCount);
    setSceneCountTarget(tmpl.sceneCountTarget);
    setVisualStyle(tmpl.visualStyle);
    setProductionMode(tmpl.productionMode);
    if (!name.trim()) {
      setName(`Proyek ${tmpl.nameId}`);
    }
    if (!description.trim()) {
      setDescription(tmpl.descriptionId);
    }
  };

  useEffect(() => {
    if (editingProject) {
      setName(editingProject.name);
      setDescription(editingProject.description);
      setGenre(editingProject.genre);
      setCustomGenre(editingProject.custom_genre || '');
      setProductionFormat(editingProject.production_format);

      if (editingProject.settings) {
        const s = editingProject.settings;
        setSeasonsCount(s.seasons_count);
        setEpisodesCount(s.episodes_count);
        setEpisodeDuration(s.episode_duration_minutes);
        setSceneCountTarget(s.scene_count_target);
        setAspectRatio(s.aspect_ratio);
        setOutputResolution(s.output_resolution);
        setFrameRate(s.frame_rate);
        setVisualStyle(s.visual_style);
        setOutputLanguage(s.output_language);
        setSubtitleLanguage(s.subtitle_language);
        setVoiceLanguage(s.voice_language);
        setProductionMode(s.production_mode);
        setEnabledModules(s.enabled_modules || []);
        setEnabledAgents(s.enabled_agents || []);
        setHumanApprovalRequired(s.human_approval_required ?? true);
        setCreditBudget(s.credit_budget || 10000);
      }
    } else {
      // Reset to defaults
      setName('');
      setDescription('');
      setGenre('Xianxia');
      setCustomGenre('');
      setProductionFormat('Drama series');
      setSeasonsCount(1);
      setEpisodesCount(12);
      setEpisodeDuration(15);
      setSceneCountTarget(96);
      setAspectRatio('16:9');
      setOutputResolution('4K');
      setFrameRate('24fps');
      setVisualStyle('3D Donghua Cinematic, Volumetric Lighting, Atmospheric Depth');
      setOutputLanguage(language);
      setSubtitleLanguage('en');
      setVoiceLanguage(language);
      setProductionMode('ai_assisted');
      setEnabledModules(['world_builder', 'character_studio', 'story_script', 'storyboard', 'media_studio', 'quality_control']);
      setEnabledAgents([
        'master_director',
        'world_builder_agent',
        'story_architect',
        'script_writer',
        'character_designer',
        'storyboard_director',
        'cinematographer',
        'image_gen_agent',
        'voice_agent',
        'quality_control_agent',
      ]);
      setHumanApprovalRequired(true);
      setCreditBudget(10000);
      setSelectedTemplateId(null);
    }
    setActiveStep(1);
    setError(null);
  }, [editingProject, isOpen, language]);

  if (!isOpen) return null;

  const toggleModule = (id: string) => {
    setEnabledModules((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const toggleAgent = (id: string) => {
    setEnabledAgents((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Nama proyek wajib diisi.');
      setActiveStep(1);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const fullSettings: ProjectSettings = {
        seasons_count: Number(seasonsCount) || 1,
        episodes_count: Number(episodesCount) || 1,
        episode_duration_minutes: Number(episodeDuration) || 10,
        scene_count_target: Number(sceneCountTarget) || 10,
        target_runtime_minutes: (Number(episodesCount) || 1) * (Number(episodeDuration) || 10),
        aspect_ratio: aspectRatio,
        output_resolution: outputResolution,
        frame_rate: frameRate,
        visual_style: visualStyle.trim() || 'Cinematic',
        output_language: outputLanguage,
        subtitle_language: subtitleLanguage,
        voice_language: voiceLanguage,
        production_quality: outputResolution === '4K' ? 'cinematic' : 'high',
        production_mode: productionMode,
        enabled_modules: enabledModules,
        enabled_agents: enabledAgents,
        human_approval_required: humanApprovalRequired,
        credit_budget: Number(creditBudget) || 5000,
      };

      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        genre: genre === 'Custom' && customGenre.trim() ? customGenre.trim() : genre,
        custom_genre: genre === 'Custom' ? customGenre.trim() : undefined,
        production_format: productionFormat,
        settings: fullSettings,
      });

      onClose();
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan proyek');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#101726] border border-slate-800 rounded-xl max-w-3xl w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              {editingProject ? t.projectModal.editTitle : t.projectModal.createTitle}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              SSOT Section 49: Dynamic Project Configuration
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Navigation Tabs */}
        <div className="flex border-b border-slate-800/80 bg-slate-950/40 px-6">
          <button
            type="button"
            onClick={() => setActiveStep(1)}
            className={`py-3 px-4 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
              activeStep === 1
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            1. {t.projectModal.step1Title}
          </button>
          <button
            type="button"
            onClick={() => setActiveStep(2)}
            className={`py-3 px-4 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
              activeStep === 2
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            2. {t.projectModal.step2Title}
          </button>
          <button
            type="button"
            onClick={() => setActiveStep(3)}
            className={`py-3 px-4 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
              activeStep === 3
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            3. {t.projectModal.step3Title}
          </button>
          <button
            type="button"
            onClick={() => setActiveStep(4)}
            className={`py-3 px-4 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
              activeStep === 4
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            4. {t.projectModal.step4Title}
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs">
              {error}
            </div>
          )}

          {/* STEP 1: Project Identity & Genre */}
          {activeStep === 1 && (
            <div className="space-y-4">
              {!editingProject && (
                <div className="p-4 rounded-xl bg-slate-950/70 border border-amber-400/25 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Pilih Template Cepat Produksi (Quick-Start)
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">1-Klik Konfigurasi Masuk Akal</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {QUICK_START_TEMPLATES.map((tmpl) => {
                      const isSelected = selectedTemplateId === tmpl.id;
                      return (
                        <button
                          key={tmpl.id}
                          type="button"
                          onClick={() => handleApplyTemplate(tmpl)}
                          className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-amber-400/15 border-amber-400 text-white shadow-md shadow-amber-400/10'
                              : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-white flex items-center gap-1">
                              <Film className="w-3 h-3 text-amber-400" />
                              {tmpl.nameId}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-mono">
                              {tmpl.aspectRatio}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 line-clamp-2 leading-snug">
                            {tmpl.descriptionId}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {t.projectModal.nameLabel} <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t.projectModal.namePlaceholder}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {t.projectModal.descLabel}
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t.projectModal.descPlaceholder}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    {t.projectModal.genreLabel}
                  </label>
                  <select
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-400"
                  >
                    {GENRE_OPTIONS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    {t.projectModal.formatLabel}
                  </label>
                  <select
                    value={productionFormat}
                    onChange={(e) => setProductionFormat(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-400"
                  >
                    {FORMAT_OPTIONS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {genre === 'Custom' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    {t.projectModal.customGenreLabel}
                  </label>
                  <input
                    type="text"
                    value={customGenre}
                    onChange={(e) => setCustomGenre(e.target.value)}
                    placeholder="e.g. Supernatural Urban Mystery"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Format & Parameters */}
          {activeStep === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t.projectModal.seasonsLabel}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={seasonsCount}
                    onChange={(e) => setSeasonsCount(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-amber-400 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t.projectModal.episodesLabel}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={episodesCount}
                    onChange={(e) => setEpisodesCount(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-amber-400 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t.projectModal.durationLabel}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={episodeDuration}
                    onChange={(e) => setEpisodeDuration(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-amber-400 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Target Adegan
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={sceneCountTarget}
                    onChange={(e) => setSceneCountTarget(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-amber-400 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t.projectModal.aspectRatioLabel}
                  </label>
                  <select
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-amber-400"
                  >
                    <option value="16:9">16:9 (Landscape / Film Standard)</option>
                    <option value="9:16">9:16 (Vertical Short Drama / Reel)</option>
                    <option value="1:1">1:1 (Square)</option>
                    <option value="4:5">4:5 (Social Showcase)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t.projectModal.resolutionLabel}
                  </label>
                  <select
                    value={outputResolution}
                    onChange={(e) => setOutputResolution(e.target.value as OutputResolution)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-amber-400"
                  >
                    <option value="1080p">1080p Full HD</option>
                    <option value="4K">4K UHD Cinematic</option>
                    <option value="2K">2K Quad HD</option>
                    <option value="720p">720p HD</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t.projectModal.frameRateLabel}
                  </label>
                  <select
                    value={frameRate}
                    onChange={(e) => setFrameRate(e.target.value as FrameRate)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-amber-400"
                  >
                    <option value="24fps">24 fps (Cinematic Standard)</option>
                    <option value="30fps">30 fps (Web / Digital)</option>
                    <option value="60fps">60 fps (High Smoothness)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {t.projectModal.visualStyleLabel}
                </label>
                <input
                  type="text"
                  value={visualStyle}
                  onChange={(e) => setVisualStyle(e.target.value)}
                  placeholder={t.projectModal.visualStylePlaceholder}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t.projectModal.outputLangLabel}
                  </label>
                  <select
                    value={outputLanguage}
                    onChange={(e) => setOutputLanguage(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-amber-400"
                  >
                    <option value="id">Bahasa Indonesia</option>
                    <option value="en">English</option>
                    <option value="zh">Mandarin</option>
                    <option value="ja">Japanese</option>
                    <option value="ko">Korean</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t.projectModal.subLangLabel}
                  </label>
                  <select
                    value={subtitleLanguage}
                    onChange={(e) => setSubtitleLanguage(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-amber-400"
                  >
                    <option value="en">English</option>
                    <option value="id">Bahasa Indonesia</option>
                    <option value="zh">Mandarin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t.projectModal.voiceLangLabel}
                  </label>
                  <select
                    value={voiceLanguage}
                    onChange={(e) => setVoiceLanguage(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-amber-400"
                  >
                    <option value="id">Bahasa Indonesia</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Modules & AI Agents */}
          {activeStep === 3 && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  {t.projectModal.modulesLabel}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {PRODUCTION_MODULES.map((mod) => {
                    const isSelected = enabledModules.includes(mod.id);
                    return (
                      <button
                        key={mod.id}
                        type="button"
                        onClick={() => toggleModule(mod.id)}
                        className={`p-3 rounded-lg border text-left flex items-start justify-between transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-amber-400/10 border-amber-400/40 text-white'
                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-semibold">{mod.name}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{mod.desc}</div>
                        </div>
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ml-2 mt-0.5 ${
                            isSelected ? 'bg-amber-400 border-amber-400 text-slate-950' : 'border-slate-700'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  {t.projectModal.agentsLabel} (14 Specialized AI Roles)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                  {INITIAL_AI_AGENTS.map((agent) => {
                    const isAssigned = enabledAgents.includes(agent.id);
                    return (
                      <button
                        key={agent.id}
                        type="button"
                        onClick={() => toggleAgent(agent.id)}
                        className={`p-2.5 rounded-lg border text-left flex items-center justify-between transition-colors cursor-pointer ${
                          isAssigned
                            ? 'bg-amber-400/10 border-amber-400/40 text-slate-100'
                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="truncate pr-2">
                          <div className="text-xs font-medium truncate">{agent.name}</div>
                          <div className="text-[10px] text-slate-500 truncate">{agent.role}</div>
                        </div>
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                            isAssigned ? 'bg-amber-400 border-amber-400 text-slate-950' : 'border-slate-700'
                          }`}
                        >
                          {isAssigned && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Production Mode & Budget */}
          {activeStep === 4 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  {t.projectModal.prodModeLabel}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {(['manual', 'ai_assisted', 'semi_automated', 'fully_automated'] as ProductionMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setProductionMode(mode)}
                      className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                        productionMode === mode
                          ? 'bg-amber-400/10 border-amber-400/40 text-white'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-semibold">{t.modes[mode]}</div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        {mode === 'ai_assisted' && 'AI menyarankan draf adegan, naskah, dan storyboard dengan verifikasi manusia.'}
                        {mode === 'manual' && 'Kontrol penuh tanpa automasi berkelanjutan.'}
                        {mode === 'semi_automated' && 'Pipeline berjalan otomatis per adegan dengan konfirmasi transisi.'}
                        {mode === 'fully_automated' && 'Otomatisasi menyeluruh dengan titik inspeksi checkpoint wajib.'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="humanApproval"
                  checked={humanApprovalRequired}
                  onChange={(e) => setHumanApprovalRequired(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-amber-400"
                />
                <label htmlFor="humanApproval" className="text-xs cursor-pointer">
                  <div className="font-semibold text-slate-200">{t.projectModal.approvalLabel}</div>
                  <div className="text-slate-400 mt-0.5">{t.projectModal.approvalDesc}</div>
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>{t.projectModal.creditBudgetLabel}</span>
                  <span className="font-mono text-amber-400 tabular-nums font-bold">
                    {creditBudget.toLocaleString()} Kredit
                  </span>
                </label>
                <input
                  type="range"
                  min={1000}
                  max={50000}
                  step={500}
                  value={creditBudget}
                  onChange={(e) => setCreditBudget(Number(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-slate-500 mt-1 font-mono">
                  <span>1.000 (Min)</span>
                  <span>25.000 (Standar)</span>
                  <span>50.000 (Studio Max)</span>
                </div>
              </div>
            </div>
          )}
        </form>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {activeStep > 1 && (
              <button
                type="button"
                onClick={() => setActiveStep((prev) => (prev - 1) as any)}
                className="px-3.5 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-900 border border-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                Kembali
              </button>
            )}
            <span className="text-[11px] text-slate-500 font-mono">
              Langkah {activeStep} dari 4
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              {t.common.cancel}
            </button>

            {activeStep < 4 ? (
              <button
                type="button"
                onClick={() => {
                  if (activeStep === 1 && !name.trim()) {
                    setError('Nama proyek wajib diisi.');
                    return;
                  }
                  setError(null);
                  setActiveStep((prev) => (prev + 1) as any);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors cursor-pointer"
              >
                Lanjutkan
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 rounded-lg transition-colors cursor-pointer flex items-center gap-2"
              >
                {isSubmitting ? t.projectModal.saving : editingProject ? t.projectModal.saveBtn : t.projectModal.createBtn}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
