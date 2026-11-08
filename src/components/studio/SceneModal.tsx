import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { SceneItem, Character } from '../../types/database';
import { X, Clapperboard, MapPin, Clock, Heart, Users, Video, Music } from 'lucide-react';

interface SceneModalProps {
  isOpen: boolean;
  scene: SceneItem | null;
  episodeId: string;
  projectId: string;
  existingScenesCount: number;
  availableCharacters: Character[];
  onClose: () => void;
  onSubmit: (data: Omit<SceneItem, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
}

export const SceneModal: React.FC<SceneModalProps> = ({
  isOpen,
  scene,
  episodeId,
  projectId,
  existingScenesCount,
  availableCharacters,
  onClose,
  onSubmit,
}) => {
  const { t } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [sceneNumber, setSceneNumber] = useState(existingScenesCount + 1);
  const [title, setTitle] = useState('');
  const [intExt, setIntExt] = useState<'INT' | 'EXT' | 'INT/EXT'>('INT');
  const [locationName, setLocationName] = useState('');
  const [timeOfDay, setTimeOfDay] = useState<'DAY' | 'NIGHT' | 'DUSK' | 'DAWN' | 'CONTINUOUS'>('DAY');
  const [synopsis, setSynopsis] = useState('');
  const [emotionalBeat, setEmotionalBeat] = useState('');
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<string[]>([]);
  const [durationSec, setDurationSec] = useState(90);
  const [cameraNotes, setCameraNotes] = useState('');
  const [audioNotes, setAudioNotes] = useState('');
  const [visualSeed, setVisualSeed] = useState('');

  useEffect(() => {
    if (scene) {
      setSceneNumber(scene.scene_number);
      setTitle(scene.title || '');
      setIntExt(scene.int_ext || 'INT');
      setLocationName(scene.location_name || '');
      setTimeOfDay(scene.time_of_day || 'DAY');
      setSynopsis(scene.synopsis || '');
      setEmotionalBeat(scene.emotional_beat || '');
      setSelectedCharacterIds(scene.character_ids || []);
      setDurationSec(scene.estimated_duration_seconds || 90);
      setCameraNotes(scene.camera_notes || '');
      setAudioNotes(scene.audio_sound_notes || '');
      setVisualSeed(scene.visual_continuity_seed || '');
    } else {
      setSceneNumber(existingScenesCount + 1);
      setTitle('');
      setIntExt('INT');
      setLocationName('');
      setTimeOfDay('DAY');
      setSynopsis('');
      setEmotionalBeat('');
      setSelectedCharacterIds([]);
      setDurationSec(90);
      setCameraNotes('');
      setAudioNotes('');
      setVisualSeed('');
    }
  }, [scene, existingScenesCount, isOpen]);

  if (!isOpen) return null;

  // Build computed slugline
  const computedSlugline = `${intExt}. ${locationName ? locationName.toUpperCase() : 'LOCATION'} - ${timeOfDay}`;

  const toggleCharacter = (charId: string) => {
    setSelectedCharacterIds((prev) =>
      prev.includes(charId) ? prev.filter((id) => id !== charId) : [...prev, charId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !locationName.trim()) return;

    setIsSubmitting(true);
    const presentCharacterNames = availableCharacters
      .filter((c) => selectedCharacterIds.includes(c.id))
      .map((c) => c.name);

    await onSubmit({
      project_id: projectId,
      episode_id: episodeId,
      scene_number: sceneNumber,
      title,
      slugline: computedSlugline,
      int_ext: intExt,
      location_name: locationName,
      time_of_day: timeOfDay,
      synopsis,
      emotional_beat: emotionalBeat,
      character_ids: selectedCharacterIds,
      characters_present: presentCharacterNames,
      blocks: scene?.blocks || [
        {
          id: `blk-${Date.now()}`,
          type: 'action',
          text: synopsis || 'Adegan dibuka dengan memperlihatkan lingkungan sekitar...',
        },
      ],
      visual_continuity_seed: visualSeed || `${computedSlugline}, cinematic 8k, master lighting`,
      camera_notes: cameraNotes,
      audio_sound_notes: audioNotes,
      approval_status: scene?.approval_status || 'draft',
      approved_at: scene?.approved_at,
      approved_by: scene?.approved_by,
      estimated_duration_seconds: durationSec,
      versions_count: scene?.versions_count || 1,
    });
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Clapperboard className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-slate-100">
              {scene ? t.storyScript.scenes.editScene : t.storyScript.scenes.addScene}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors rounded hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Top Row: Scene Number & Title */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Nomor Adegan</label>
              <input
                type="number"
                min={1}
                value={sceneNumber}
                onChange={(e) => setSceneNumber(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono tabular-nums focus:outline-none focus:border-amber-400/50"
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-slate-400 mb-1 font-medium">Judul Adegan *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Kebangkitan Sang Kaisar Pedang"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-400/50"
              />
            </div>
          </div>

          {/* Slugline Builder: INT/EXT + Location + Time */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3 space-y-2">
            <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Format Header Naskah (Slugline)
            </span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">INT / EXT</label>
                <select
                  value={intExt}
                  onChange={(e) => setIntExt(e.target.value as any)}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none"
                >
                  <option value="INT">INT. (Interior / Dalam Ruangan)</option>
                  <option value="EXT">EXT. (Exterior / Luar Ruangan)</option>
                  <option value="INT/EXT">INT./EXT. (Campuran / Bergerak)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Nama Lokasi *</label>
                <input
                  type="text"
                  required
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  placeholder="Gubuk Murid Luar / Hutan Kabut"
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Waktu</label>
                <select
                  value={timeOfDay}
                  onChange={(e) => setTimeOfDay(e.target.value as any)}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none"
                >
                  <option value="DAY">DAY (Siang Hari)</option>
                  <option value="NIGHT">NIGHT (Malam Hari)</option>
                  <option value="DAWN">DAWN (Fajar Pagi)</option>
                  <option value="DUSK">DUSK (Senja Sore)</option>
                  <option value="CONTINUOUS">CONTINUOUS (Berlanjut)</option>
                </select>
              </div>
            </div>

            {/* Generated Slugline Preview */}
            <div className="pt-2 flex items-center justify-between text-xs font-mono text-amber-400 bg-slate-900/90 px-3 py-1.5 rounded border border-slate-800">
              <span className="text-slate-500 font-sans text-[11px]">Preview:</span>
              <span className="font-bold">{computedSlugline}</span>
            </div>
          </div>

          {/* Synopsis & Emotional Beat */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Ringkasan Adegan</label>
              <textarea
                rows={3}
                value={synopsis}
                onChange={(e) => setSynopsis(e.target.value)}
                placeholder="Uraian apa yang terjadi dalam adegan ini..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-400/50"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Beat Emosional / Intensi</label>
              <textarea
                rows={3}
                value={emotionalBeat}
                onChange={(e) => setEmotionalBeat(e.target.value)}
                placeholder="Contoh: Ketegangan menindas yang memuncak saat Ye Chen menatap lawannya..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-400/50"
              />
            </div>
          </div>

          {/* Character Tagging */}
          <div>
            <label className="block text-slate-400 mb-1.5 font-medium flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-amber-400" />
              <span>Penandaan Karakter yang Hadir (Character Tagging)</span>
            </label>
            {availableCharacters.length === 0 ? (
              <p className="text-[11px] text-slate-500 italic">
                Belum ada karakter yang terdaftar pada proyek ini di Character Studio.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 p-2 bg-slate-950 border border-slate-800 rounded-lg max-h-32 overflow-y-auto">
                {availableCharacters.map((c) => {
                  const isChecked = selectedCharacterIds.includes(c.id);
                  return (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => toggleCharacter(c.id)}
                      className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer border ${
                        isChecked
                          ? 'bg-amber-400/15 border-amber-400/40 text-amber-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {c.name} ({c.role})
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Estimated Duration & Visual Prompt Seed */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Estimasi Durasi (Detik)</label>
              <input
                type="number"
                min={10}
                value={durationSec}
                onChange={(e) => setDurationSec(parseInt(e.target.value) || 90)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono tabular-nums focus:outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-slate-400 mb-1 font-medium">Prompt Kontinuitas Visual</label>
              <input
                type="text"
                value={visualSeed}
                onChange={(e) => setVisualSeed(e.target.value)}
                placeholder="Formula prompt visual adegan untuk generator..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono text-[11px] focus:outline-none"
              />
            </div>
          </div>

          {/* Director Notes: Camera & Sound */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-slate-400 mb-1 font-medium flex items-center gap-1">
                <Video className="w-3.5 h-3.5 text-slate-400" />
                <span>Catatan Kamera (Camera Angles & Motion)</span>
              </label>
              <input
                type="text"
                value={cameraNotes}
                onChange={(e) => setCameraNotes(e.target.value)}
                placeholder="Contoh: Slow push-in to close-up mata elang"
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-medium flex items-center gap-1">
                <Music className="w-3.5 h-3.5 text-slate-400" />
                <span>Catatan Suara & Musik (Audio Notes)</span>
              </label>
              <input
                type="text"
                value={audioNotes}
                onChange={(e) => setAudioNotes(e.target.value)}
                placeholder="Contoh: Suara hembusan angin malam berbobot nada guzheng"
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim() || !locationName.trim()}
              className="px-5 py-2 bg-amber-400 text-slate-950 font-semibold rounded-lg hover:bg-amber-300 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? t.common.loading : t.common.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
