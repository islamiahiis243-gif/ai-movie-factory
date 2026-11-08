import React, { useState } from 'react';
import { AgentDefinition, AgentProjectConfig } from '../../types/database';
import { translations } from '../../lib/translations';

interface AgentConfigModalProps {
  agent: AgentDefinition;
  config: AgentProjectConfig;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: Partial<AgentProjectConfig>) => Promise<void>;
  currentLang: 'id' | 'en';
}

const AVAILABLE_MODELS = [
  { id: 'gemini-4-argon', name: 'Gemini 4 Argon (Reasoning, Architecture & QC)' },
  { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash (Script, Dialogue & Fast Logic)' },
  { id: 'gemini-3.1-flash-lite-image', name: 'Gemini 3.1 Flash-Lite Image (Visual Synthesis)' },
  { id: 'gemini-3.8-flash-tts', name: 'Gemini 3.8 Flash TTS (Audio & Voice Synthesis)' },
];

export const AgentConfigModal: React.FC<AgentConfigModalProps> = ({
  agent,
  config,
  isOpen,
  onClose,
  onSave,
  currentLang,
}) => {
  const t = translations[currentLang];
  const [model, setModel] = useState(config.selected_model || agent.default_model);
  const [creditLimit, setCreditLimit] = useState(config.credit_limit_per_run || agent.suggested_credit_cost * 2);
  const [requiresApproval, setRequiresApproval] = useState(config.requires_approval);
  const [customInstructions, setCustomInstructions] = useState(config.custom_instructions || '');
  const [isEnabled, setIsEnabled] = useState(config.enabled);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave({
        selected_model: model,
        credit_limit_per_run: Number(creditLimit),
        requires_approval: requiresApproval,
        custom_instructions: customInstructions,
        enabled: isEnabled,
        updated_at: new Date().toISOString(),
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefault = () => {
    setModel(agent.default_model);
    setCreditLimit(agent.suggested_credit_cost * 2);
    setRequiresApproval(agent.role === 'master_director' || agent.role === 'qc_agent' || agent.role === 'script_writer');
    setCustomInstructions('');
    setIsEnabled(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div 
        className="relative w-full max-w-2xl bg-[#0F172A] border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div>
            <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <span>{agent.name}</span>
              <span className="text-xs font-mono text-slate-400 font-normal">
                [{agent.role}]
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {agent.title} · {agent.description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors p-1"
            aria-label={t.common.close}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 text-sm">
          {/* Active Status Toggle */}
          <div className="flex items-center justify-between p-3.5 bg-slate-900/40 rounded-lg border border-slate-800/80">
            <div>
              <div className="font-medium text-slate-200">
                {t.agentManager.agents.enabled}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {currentLang === 'id' 
                  ? 'Aktifkan agen ini untuk menerima tugas otomatis dari Master Director'
                  : 'Enable this agent to receive autonomous tasks from Master Director'}
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={(e) => setIsEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
            </label>
          </div>

          {/* Model Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              {t.agentManager.configModal.foundationModel}
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900/80 border border-slate-700 rounded-md text-slate-200 focus:outline-none focus:border-amber-500 font-mono text-xs"
            >
              {AVAILABLE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              {currentLang === 'id' 
                ? 'Model fondasi Gemini direkomendasikan sesuai beban komputasi & penataan multimodal.'
                : 'Recommended Gemini model according to compute profile & multimodal synthesis.'}
            </p>
          </div>

          {/* Credit Limit Setting */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              {t.agentManager.configModal.maxCreditBudget}
            </label>
            <div className="relative">
              <input
                type="number"
                min="5"
                step="5"
                value={creditLimit}
                onChange={(e) => setCreditLimit(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-900/80 border border-slate-700 rounded-md text-slate-200 focus:outline-none focus:border-amber-500 font-mono text-xs"
              />
              <span className="absolute right-3 top-2 text-xs text-slate-400 font-mono">Credits / run</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {currentLang === 'id' 
                ? `Biaya rekomendasi dasar: ${agent.suggested_credit_cost} kredit per tugas.`
                : `Suggested base cost: ${agent.suggested_credit_cost} credits per task.`}
            </p>
          </div>

          {/* Human Approval Checkpoint Toggle */}
          <div className="p-3.5 bg-slate-900/40 rounded-lg border border-slate-800/80 space-y-1">
            <div className="flex items-center justify-between">
              <label className="font-medium text-slate-200 cursor-pointer" htmlFor="approval-chk">
                {t.agentManager.configModal.requireApprovalLabel}
              </label>
              <input
                id="approval-chk"
                type="checkbox"
                checked={requiresApproval}
                onChange={(e) => setRequiresApproval(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500 focus:ring-offset-0"
              />
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {t.agentManager.configModal.requireApprovalHelp}
            </p>
          </div>

          {/* Custom System Instructions Override */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              {t.agentManager.configModal.systemInstructions}
            </label>
            <textarea
              rows={4}
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder={t.agentManager.configModal.systemInstructionsPlaceholder}
              className="w-full px-3 py-2 bg-slate-900/80 border border-slate-700 rounded-md text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono text-xs"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              {currentLang === 'id'
                ? 'Instruksi ini digabungkan ke System Prompt baku agen untuk menjaga nada khas semesta proyek.'
                : 'Appended to agent master prompt to inject world-specific styling & tone guidelines.'}
            </p>
          </div>

          {/* Default System Prompt Preview */}
          <div className="p-3 bg-slate-950/70 border border-slate-800/90 rounded-md">
            <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wide mb-1 flex items-center justify-between">
              <span>{currentLang === 'id' ? 'System Prompt Master (Baku)' : 'Base Master System Prompt'}</span>
              <span className="text-slate-400">{agent.system_prompt.length} chars</span>
            </div>
            <p className="text-xs text-slate-400 font-mono line-clamp-3 leading-relaxed whitespace-pre-line">
              {agent.system_prompt}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-between border-t border-slate-800">
            <button
              type="button"
              onClick={handleResetToDefault}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              {t.agentManager.configModal.resetDefaults}
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
              >
                {t.common.cancel}
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 text-xs font-medium bg-amber-600 hover:bg-amber-500 text-white rounded transition-colors disabled:opacity-50"
              >
                {isSaving ? t.common.loading : t.agentManager.configModal.saveConfig}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
