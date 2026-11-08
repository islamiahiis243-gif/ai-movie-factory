import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Character,
  CharacterRole,
  CharacterPhysicalAppearance,
  CharacterCostume,
  CharacterVoice,
  CharacterRelationship,
} from '../../types/database';
import { uploadCharacterReferenceImage } from '../../lib/supabase';
import {
  X,
  User,
  Eye,
  Shirt,
  Volume2,
  Sparkles,
  Network,
  Plus,
  Trash2,
  Wand2,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
} from 'lucide-react';

interface CharacterModalProps {
  isOpen: boolean;
  projectId?: string;
  character: Character | null;
  existingCharacters: Character[];
  onClose: () => void;
  onSubmit: (charData: Omit<Character, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
}

export const CharacterModal: React.FC<CharacterModalProps> = ({
  isOpen,
  projectId,
  character,
  existingCharacters,
  onClose,
  onSubmit,
}) => {
  const { t } = useAuth();
  const [activeTab, setActiveTab] = useState<'basic' | 'appearance' | 'costume' | 'voice' | 'prompt' | 'relationships'>('basic');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [nativeName, setNativeName] = useState('');
  const [role, setRole] = useState<CharacterRole>('protagonist');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Pria');
  const [occupation, setOccupation] = useState('');
  const [sect, setSect] = useState('');
  const [personality, setPersonality] = useState('');
  const [motivation, setMotivation] = useState('');
  const [background, setBackground] = useState('');

  // Custom Reference Sheet / Avatar Upload (Phase 12 Supabase Storage Bucket: character-avatars)
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarStorageBadge, setAvatarStorageBadge] = useState<string | null>(null);
  const [avatarUploadError, setAvatarUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Physical
  const [appearance, setAppearance] = useState<CharacterPhysicalAppearance>({
    face_structure: '',
    eyes: '',
    hair: '',
    physique_height: '',
    distinguishing_features: '',
  });

  // Costume
  const [costume, setCostume] = useState<CharacterCostume>({
    daily_attire: '',
    battle_robes: '',
    accessories_artifacts: '',
  });

  // Voice
  const [voice, setVoice] = useState<CharacterVoice>({
    pitch_tone: '',
    speech_tempo: '',
    voice_actor_reference: '',
  });

  // Visual Prompt
  const [prompt, setPrompt] = useState('');

  // Relationships
  const [relationships, setRelationships] = useState<CharacterRelationship[]>([]);

  useEffect(() => {
    setAvatarUploadError(null);
    setAvatarStorageBadge(null);
    if (character) {
      setName(character.name || '');
      setNativeName(character.native_name || '');
      setRole(character.role || 'protagonist');
      setAge(character.age || '');
      setGender(character.gender || 'Pria');
      setOccupation(character.occupation_cultivation_level || '');
      setSect(character.sect_or_faction || '');
      setPersonality(character.personality || '');
      setMotivation(character.motivation || '');
      setBackground(character.background || '');
      setAvatarUrl(character.avatar_url || '');
      setAppearance(
        character.physical_appearance || {
          face_structure: '',
          eyes: '',
          hair: '',
          physique_height: '',
          distinguishing_features: '',
        }
      );
      setCostume(
        character.costume || {
          daily_attire: '',
          battle_robes: '',
          accessories_artifacts: '',
        }
      );
      setVoice(
        character.voice_characteristics || {
          pitch_tone: '',
          speech_tempo: '',
          voice_actor_reference: '',
        }
      );
      setPrompt(character.visual_consistency_prompt || '');
      setRelationships(character.relationships || []);
    } else {
      // Reset form
      setName('');
      setNativeName('');
      setRole('protagonist');
      setAge('20');
      setGender('Pria');
      setOccupation('');
      setSect('');
      setPersonality('');
      setMotivation('');
      setBackground('');
      setAvatarUrl('');
      setAppearance({
        face_structure: '',
        eyes: '',
        hair: '',
        physique_height: '',
        distinguishing_features: '',
      });
      setCostume({
        daily_attire: '',
        battle_robes: '',
        accessories_artifacts: '',
      });
      setVoice({
        pitch_tone: '',
        speech_tempo: '',
        voice_actor_reference: '',
      });
      setPrompt('');
      setRelationships([]);
    }
  }, [character, isOpen]);

  if (!isOpen) return null;

  const handleReferenceFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    setAvatarUploadError(null);
    const targetProject = projectId || character?.project_id || 'studio-project';
    const res = await uploadCharacterReferenceImage(targetProject, file, name || 'character');
    setIsUploadingAvatar(false);

    if (res.error || !res.url) {
      setAvatarUploadError(res.error || 'Gagal mengunggah gambar referensi karakter.');
    } else {
      setAvatarUrl(res.url);
      setAvatarStorageBadge(
        res.storageMode === 'supabase_storage'
          ? `Tersimpan di Cloud Bucket: ${res.bucket}/${res.path}`
          : `Tersimpan di Bucket Cache: ${res.bucket}/${res.path}`
      );
    }
  };

  // Auto-generate consistent visual prompt formula based on attributes
  const handleGeneratePromptSeed = () => {
    const parts = [
      `ultra-detailed cinematic portrait of ${name || 'character'}`,
      nativeName ? `(${nativeName})` : '',
      `${gender}, ${age ? `${age} years old` : ''}`,
      appearance.face_structure ? `${appearance.face_structure}` : '',
      appearance.eyes ? `eyes: ${appearance.eyes}` : '',
      appearance.hair ? `hair: ${appearance.hair}` : '',
      appearance.physique_height ? `build: ${appearance.physique_height}` : '',
      appearance.distinguishing_features ? `features: ${appearance.distinguishing_features}` : '',
      costume.daily_attire ? `wearing ${costume.daily_attire}` : '',
      costume.accessories_artifacts ? `carrying ${costume.accessories_artifacts}` : '',
      '8k resolution, photorealistic, sharp focus, consistent facial identity seed, master cinematography lighting, Octane render quality',
    ].filter(Boolean);

    setPrompt(parts.join(', '));
  };

  // Add Relationship Row
  const handleAddRelationship = () => {
    const newRel: CharacterRelationship = {
      id: `rel-${Date.now()}`,
      target_character_id: '',
      target_character_name: '',
      relation_type: '',
      description: '',
    };
    setRelationships([...relationships, newRel]);
  };

  const handleUpdateRelationship = (index: number, field: keyof CharacterRelationship, val: string) => {
    const updated = [...relationships];
    updated[index] = { ...updated[index], [field]: val };
    setRelationships(updated);
  };

  const handleRemoveRelationship = (index: number) => {
    setRelationships(relationships.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    await onSubmit({
      project_id: projectId || character?.project_id || '',
      name,
      native_name: nativeName || undefined,
      role,
      age,
      gender,
      occupation_cultivation_level: occupation || undefined,
      sect_or_faction: sect || undefined,
      personality,
      motivation,
      background,
      physical_appearance: appearance,
      costume,
      voice_characteristics: voice,
      visual_consistency_prompt: prompt,
      relationships,
      avatar_url: avatarUrl.trim() || undefined,
    });
    setIsSubmitting(false);
  };

  const otherCharacters = existingCharacters.filter((c) => !character || c.id !== character.id);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-3xl w-full my-8 flex flex-col max-h-[90vh] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div>
            <h2 className="text-base font-bold text-slate-100">
              {character ? t.characterStudio.editCharacter : t.characterStudio.addNew}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Spesifikasi identitas komprehensif untuk kontinuitas visual lintas adegan (SSOT Section 9).
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation (Segmented Bar) */}
        <div className="px-6 py-2 border-b border-slate-800 bg-slate-950/30 flex items-center gap-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('basic')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'basic'
                ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>{t.characterStudio.sections.basic}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('appearance')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'appearance'
                ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{t.characterStudio.sections.appearance}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('costume')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'costume'
                ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shirt className="w-3.5 h-3.5" />
            <span>{t.characterStudio.sections.costume}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('voice')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'voice'
                ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>{t.characterStudio.sections.voice}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('prompt')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'prompt'
                ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Visual Prompt Seed</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('relationships')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'relationships'
                ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>{t.characterStudio.sections.relationships}</span>
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* TAB 1: BASIC IDENTITY */}
          {activeTab === 'basic' && (
            <div className="space-y-4">
              {/* Custom Character Face Reference Sheet Upload (Phase 12 Supabase Storage Bucket) */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5" />
                      Lembar Referensi Wajah Karakter (Bucket: character-avatars)
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Unggah foto referensi wajah atau lembar karakter (PNG/JPG/WEBP maks. 10 MB) ke
                      penyimpanan cloud studio untuk menjaga kemiripan visual.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={handleReferenceFileChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingAvatar}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>
                        {isUploadingAvatar ? 'Mengunggah ke Bucket...' : 'Unggah Gambar Referensi'}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="w-16 h-16 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden flex items-center justify-center shrink-0">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={name || 'Character Reference'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-7 h-7 text-slate-600" />
                    )}
                  </div>

                  <div className="flex-1 w-full space-y-1.5">
                    <label className="block text-[11px] text-slate-400">
                      URL Publik Referensi Wajah (atau otomatis terisi saat berkas diunggah):
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={avatarUrl}
                        onChange={(e) => setAvatarUrl(e.target.value)}
                        placeholder="https://.../storage/v1/object/public/character-avatars/..."
                        className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-400/50"
                      />
                      {avatarUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setAvatarUrl('');
                            setAvatarStorageBadge(null);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/50 text-slate-400 hover:text-rose-300 border border-slate-800 text-[11px] cursor-pointer"
                        >
                          Hapus
                        </button>
                      )}
                    </div>

                    {avatarStorageBadge && (
                      <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>{avatarStorageBadge}</span>
                      </div>
                    )}

                    {avatarUploadError && (
                      <div className="text-[11px] text-rose-400">{avatarUploadError}</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    {t.characterStudio.fields.name} *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Contoh: Ye Chen"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-400/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    {t.characterStudio.fields.nativeName}
                  </label>
                  <input
                    type="text"
                    value={nativeName}
                    onChange={(e) => setNativeName(e.target.value)}
                    placeholder="Contoh: 叶辰 / Pendekar Pedang Awan Sembilan"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-400/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    {t.characterStudio.fields.role}
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as CharacterRole)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-400/50"
                  >
                    <option value="protagonist">{t.characterStudio.roles.protagonist}</option>
                    <option value="antagonist">{t.characterStudio.roles.antagonist}</option>
                    <option value="supporting">{t.characterStudio.roles.supporting}</option>
                    <option value="mentor">{t.characterStudio.roles.mentor}</option>
                    <option value="recurring">{t.characterStudio.roles.recurring}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    {t.characterStudio.fields.age}
                  </label>
                  <input
                    type="text"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="Contoh: 19 tahun (penampilan 20-an)"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-400/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    {t.characterStudio.fields.gender}
                  </label>
                  <input
                    type="text"
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    placeholder="Pria / Wanita / Lainnya"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-400/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    {t.characterStudio.fields.occupation}
                  </label>
                  <input
                    type="text"
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)}
                    placeholder="Contoh: Ranah Fondasi Qi Tingkat 7"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-400/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    {t.characterStudio.fields.sect}
                  </label>
                  <input
                    type="text"
                    value={sect}
                    onChange={(e) => setSect(e.target.value)}
                    placeholder="Contoh: Murid Luar Sekte Pedang Awan"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-400/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  {t.characterStudio.fields.personality}
                </label>
                <textarea
                  rows={2}
                  value={personality}
                  onChange={(e) => setPersonality(e.target.value)}
                  placeholder="Tenang di bawah tekanan, gigih, berprinsip pantang tunduk..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-400/50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  {t.characterStudio.fields.motivation}
                </label>
                <textarea
                  rows={2}
                  value={motivation}
                  onChange={(e) => setMotivation(e.target.value)}
                  placeholder="Membalaskan kehancuran klannya dan mencapai Ranah Keabadian..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-400/50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  {t.characterStudio.fields.background}
                </label>
                <textarea
                  rows={3}
                  value={background}
                  onChange={(e) => setBackground(e.target.value)}
                  placeholder="Putra mantan kepala klan yang kehilangan meridian spiritualnya..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-400/50 leading-relaxed"
                />
              </div>
            </div>
          )}

          {/* TAB 2: PHYSICAL APPEARANCE */}
          {activeTab === 'appearance' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  {t.characterStudio.fields.face}
                </label>
                <input
                  type="text"
                  value={appearance.face_structure}
                  onChange={(e) =>
                    setAppearance({ ...appearance, face_structure: e.target.value })
                  }
                  placeholder="Contoh: Rahang tegas, tulang pipi tajam, kulit sedikit kecokelatan"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-400/50"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    {t.characterStudio.fields.eyes}
                  </label>
                  <input
                    type="text"
                    value={appearance.eyes}
                    onChange={(e) => setAppearance({ ...appearance, eyes: e.target.value })}
                    placeholder="Contoh: Mata hitam legam tajam seperti elang, sorot fokus dingin"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-400/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    {t.characterStudio.fields.hair}
                  </label>
                  <input
                    type="text"
                    value={appearance.hair}
                    onChange={(e) => setAppearance({ ...appearance, hair: e.target.value })}
                    placeholder="Contoh: Rambut hitam panjang diikat sebagian dengan pita kain sederhana"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-400/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  {t.characterStudio.fields.physique}
                </label>
                <input
                  type="text"
                  value={appearance.physique_height}
                  onChange={(e) =>
                    setAppearance({ ...appearance, physique_height: e.target.value })
                  }
                  placeholder="Contoh: Tinggi 180cm, tubuh atletis berotot liat karena latihan pedang berat"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-400/50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  {t.characterStudio.fields.distinguishing}
                </label>
                <textarea
                  rows={2}
                  value={appearance.distinguishing_features}
                  onChange={(e) =>
                    setAppearance({ ...appearance, distinguishing_features: e.target.value })
                  }
                  placeholder="Contoh: Luka parut tipis di punggung tangan kiri akibat latihan pedang purba"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-400/50"
                />
              </div>
            </div>
          )}

          {/* TAB 3: COSTUMES & ARTIFACTS */}
          {activeTab === 'costume' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  {t.characterStudio.fields.dailyCostume}
                </label>
                <textarea
                  rows={2}
                  value={costume.daily_attire}
                  onChange={(e) => setCostume({ ...costume, daily_attire: e.target.value })}
                  placeholder="Contoh: Jubah rami biru tua sederhana dengan ban pinggang kulit hitam praktis"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-400/50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  {t.characterStudio.fields.battleRobes}
                </label>
                <textarea
                  rows={2}
                  value={costume.battle_robes}
                  onChange={(e) => setCostume({ ...costume, battle_robes: e.target.value })}
                  placeholder="Contoh: Zirah sutra perak tahan tusukan pedang dengan sulaman naga kabut"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-400/50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  {t.characterStudio.fields.accessories}
                </label>
                <textarea
                  rows={2}
                  value={costume.accessories_artifacts}
                  onChange={(e) =>
                    setCostume({ ...costume, accessories_artifacts: e.target.value })
                  }
                  placeholder="Contoh: Pedang Besi Hitam Karat di punggung, liontin giok hijau warisan ibu"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-400/50"
                />
              </div>
            </div>
          )}

          {/* TAB 4: VOICE PROFILE */}
          {activeTab === 'voice' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    {t.characterStudio.fields.pitch}
                  </label>
                  <input
                    type="text"
                    value={voice.pitch_tone}
                    onChange={(e) => setVoice({ ...voice, pitch_tone: e.target.value })}
                    placeholder="Contoh: Bariton rendah, tegas dan tenang"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-400/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    {t.characterStudio.fields.tempo}
                  </label>
                  <input
                    type="text"
                    value={voice.speech_tempo}
                    onChange={(e) => setVoice({ ...voice, speech_tempo: e.target.value })}
                    placeholder="Contoh: Terukur, minim kata-kata mubazir"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-400/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  {t.characterStudio.fields.actorRef}
                </label>
                <input
                  type="text"
                  value={voice.voice_actor_reference || ''}
                  onChange={(e) =>
                    setVoice({ ...voice, voice_actor_reference: e.target.value })
                  }
                  placeholder="Contoh: Zhao Liying (tone dingin) / Kenjiro Tsuda (deep baritone)"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-400/50"
                />
              </div>
            </div>
          )}

          {/* TAB 5: VISUAL PROMPT FORMULA */}
          {activeTab === 'prompt' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-slate-200">
                    Master Visual Continuity Seed
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Formula prompt yang diinjeksikan otomatis pada setiap storyboard & scene video.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleGeneratePromptSeed}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Susun Otomatis dari Karakter</span>
                </button>
              </div>

              <div>
                <textarea
                  rows={6}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Formula prompt deskripsi visual stabil: ultra-detailed cinematic portrait of..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 font-mono leading-relaxed focus:outline-none focus:border-amber-400/50"
                />
              </div>
            </div>
          )}

          {/* TAB 6: RELATIONSHIPS */}
          {activeTab === 'relationships' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-slate-200">
                    {t.characterStudio.relationships.title}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Hubungkan karakter ini dengan karakter lain dalam cerita.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddRelationship}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t.characterStudio.relationships.addRelation}</span>
                </button>
              </div>

              {relationships.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
                  Belum ada hubungan yang dicatat untuk karakter ini.
                </div>
              ) : (
                <div className="space-y-3">
                  {relationships.map((rel, idx) => (
                    <div
                      key={rel.id || idx}
                      className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2 relative"
                    >
                      <button
                        type="button"
                        onClick={() => handleRemoveRelationship(idx)}
                        className="absolute top-2.5 right-2.5 text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pr-8">
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">
                            {t.characterStudio.relationships.targetName}
                          </label>
                          {otherCharacters.length > 0 ? (
                            <select
                              value={rel.target_character_name}
                              onChange={(e) => {
                                const matched = otherCharacters.find((c) => c.name === e.target.value);
                                handleUpdateRelationship(idx, 'target_character_name', e.target.value);
                                if (matched) {
                                  handleUpdateRelationship(idx, 'target_character_id', matched.id);
                                }
                              }}
                              className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 focus:outline-none"
                            >
                              <option value="">-- Pilih Karakter Terdaftar --</option>
                              {otherCharacters.map((c) => (
                                <option key={c.id} value={c.name}>
                                  {c.name} ({c.role})
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={rel.target_character_name}
                              onChange={(e) =>
                                handleUpdateRelationship(idx, 'target_character_name', e.target.value)
                              }
                              placeholder="Nama karakter target..."
                              className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 focus:outline-none"
                            />
                          )}
                        </div>

                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">
                            {t.characterStudio.relationships.relationType}
                          </label>
                          <input
                            type="text"
                            value={rel.relation_type}
                            onChange={(e) =>
                              handleUpdateRelationship(idx, 'relation_type', e.target.value)
                            }
                            placeholder="Contoh: Musuh Bebuyutan / Guru / Adik Seperguruan"
                            className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">
                          {t.characterStudio.relationships.desc}
                        </label>
                        <input
                          type="text"
                          value={rel.description}
                          onChange={(e) =>
                            handleUpdateRelationship(idx, 'description', e.target.value)
                          }
                          placeholder="Dinamika hubungan atau perselisihan masa lalu..."
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 focus:outline-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Footer Submit Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-5 py-2 bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg hover:bg-amber-300 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? t.common.loading : t.common.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
