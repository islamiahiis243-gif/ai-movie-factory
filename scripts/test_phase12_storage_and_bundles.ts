/**
 * Test Script: Phase 12 — Code-Splitting & Cloud Storage Bucket Media Persistence
 * Verifies:
 * 1. Uploading custom character reference face sheets to `character-avatars` bucket.
 * 2.Persisting `avatar_url` onto Character Studio records (`createCharacterRecord` & `updateCharacterRecord`).
 * 3. Uploading project assets to `project-assets` bucket.
 * 4. Enforcing 10 MB size limit on `character-avatars` bucket.
 * 5. Listing stored bucket objects (`listStudioBucketObjects`).
 */

const memoryStorage: Record<string, string> = {};
(globalThis as any).window = globalThis;
(globalThis as any).localStorage = {
  getItem: (key: string) => memoryStorage[key] ?? null,
  setItem: (key: string, val: string) => {
    memoryStorage[key] = val;
  },
  removeItem: (key: string) => {
    delete memoryStorage[key];
  },
};

import {
  uploadCharacterReferenceImage,
  uploadProjectAssetToBucket,
  listStudioBucketObjects,
  createProjectRecord,
  createCharacterRecord,
  updateCharacterRecord,
  fetchCharacters,
} from '../src/lib/supabase';

async function runPhase12Tests() {
  console.log('=== TEST 1: Create Test Project & Character ===');
  const projRes = await createProjectRecord('creator_phase12', {
    name: 'Proyek Uji Storage Bucket Phase 12',
    description: 'Verifikasi unggahan lembar referensi wajah karakter dan aset proyek',
    genre: 'Xianxia / Wuxia',
    production_format: 'Series',
    settings: {
      seasons_count: 1,
      episodes_count: 6,
      episode_duration_minutes: 15,
      scene_count_target: 12,
      aspect_ratio: '16:9',
      output_resolution: '1080p',
      frame_rate: '24fps',
      visual_style: 'Cinematic',
      output_language: 'id',
      subtitle_language: 'en',
      voice_language: 'id',
      production_quality: 'high',
      production_mode: 'ai_assisted',
      enabled_modules: ['character_studio', 'media_studio'],
      enabled_agents: ['master_director'],
      human_approval_required: true,
      credit_budget: 1500,
    },
  });

  if (!projRes.project) throw new Error('Failed to create test project');
  const projectId = projRes.project.id;

  const charRes = await createCharacterRecord(projectId, {
    project_id: projectId,
    name: 'Bai Lingxiao',
    native_name: '白凌霄',
    role: 'protagonist',
    age: '23',
    gender: 'Wanita',
    occupation_cultivation_level: 'Saintess Puncak Awan Perak',
    sect_or_faction: 'Paviliun Langit Perak',
    personality: 'Tegas, bijaksana, dan tenang.',
    motivation: 'Menjaga segel artefak langit.',
    background: 'Pewaris tunggal Paviliun Langit Perak.',
    physical_appearance: {
      face_structure: 'Wajah oval anggun',
      eyes: 'Mata perak jernih',
      hair: 'Rambut hitam panjang dengan tusuk konde giok perak',
      physique_height: '171 cm, proporsional anggun',
      distinguishing_features: 'Tanda bulan sabit perak di dahi',
    },
    costume: {
      daily_attire: 'Hanfu sutra perak-putih',
      battle_robes: 'Zirah ringan sisik perak',
      accessories_artifacts: 'Pedang Sutra Perak',
    },
    voice_characteristics: {
      pitch_tone: 'Sopran jernih berwibawa',
      speech_tempo: 'Tenang dan terukur',
      voice_actor_reference: 'Xianxia Female Lead Reference',
    },
    visual_consistency_prompt: '[Master Seed: Bai Lingxiao, silver-white Hanfu, crescent forehead mark, 8k]',
    relationships: [],
  });

  if (!charRes.character) throw new Error('Failed to create character');
  console.log(`✔ Created character "${charRes.character.name}" (${charRes.character.id})`);

  console.log('\n=== TEST 2: Upload Custom Face Reference Sheet to character-avatars Bucket ===');
  const mockPngDataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  const avatarUploadRes = await uploadCharacterReferenceImage(
    projectId,
    {
      name: 'bai_lingxiao_face_sheet.png',
      type: 'image/png',
      size: 245760,
      dataUrl: mockPngDataUrl,
    },
    charRes.character.name
  );

  if (avatarUploadRes.error || !avatarUploadRes.url) {
    throw new Error(`Avatar upload failed: ${avatarUploadRes.error}`);
  }
  console.log(
    `✔ Uploaded character reference sheet to bucket "${avatarUploadRes.bucket}" at path "${avatarUploadRes.path}" (${avatarUploadRes.storageMode})`
  );

  const updRes = await updateCharacterRecord(charRes.character.id, {
    avatar_url: avatarUploadRes.url,
  });
  if (updRes.error) throw new Error(`Failed to update character avatar_url: ${updRes.error}`);

  const fetchedChars = await fetchCharacters(projectId);
  const updatedChar = fetchedChars.data.find((c) => c.id === charRes.character!.id);
  if (!updatedChar || updatedChar.avatar_url !== avatarUploadRes.url) {
    throw new Error('Character avatar_url was not persisted properly');
  }
  console.log(`✔ Verified Character Studio persisted avatar_url on "${updatedChar.name}"`);

  console.log('\n=== TEST 3: Upload Project Asset to project-assets Bucket ===');
  const projectAssetRes = await uploadProjectAssetToBucket(
    projectId,
    {
      name: 'silver_pavilion_concept_4k.webp',
      type: 'image/webp',
      size: 1048576,
      dataUrl: mockPngDataUrl,
    },
    'silver_pavilion'
  );

  if (projectAssetRes.error || !projectAssetRes.url) {
    throw new Error(`Project asset upload failed: ${projectAssetRes.error}`);
  }
  console.log(
    `✔ Uploaded project asset to bucket "${projectAssetRes.bucket}" at path "${projectAssetRes.path}"`
  );

  console.log('\n=== TEST 4: Verify Bucket File Size Limit Enforcement ===');
  const oversizedRes = await uploadCharacterReferenceImage(
    projectId,
    {
      name: 'huge_uncompressed_raw.png',
      type: 'image/png',
      size: 15 * 1024 * 1024, // 15 MB > 10 MB limit
      dataUrl: mockPngDataUrl,
    },
    'oversized_test'
  );

  if (!oversizedRes.error) {
    throw new Error('Expected oversized file (>10MB) to be rejected on character-avatars bucket');
  }
  console.log(`✔ Properly rejected oversized file (>10MB): "${oversizedRes.error}"`);

  console.log('\n=== TEST 5: Verify Bucket Object Listing ===');
  const avatarObjects = await listStudioBucketObjects('character-avatars', projectId);
  const assetObjects = await listStudioBucketObjects('project-assets', projectId);

  if (avatarObjects.data.length !== 1 || assetObjects.data.length !== 1) {
    throw new Error(
      `Expected 1 object in each bucket, got character-avatars=${avatarObjects.data.length}, project-assets=${assetObjects.data.length}`
    );
  }
  console.log(
    `✔ Bucket inventory verified: character-avatars (${avatarObjects.data.length} object), project-assets (${assetObjects.data.length} object)`
  );
  console.log('\nALL PHASE 12 STORAGE BUCKET & PERSISTENCE TESTS PASSED SUCCESSFULLY!');
}

runPhase12Tests().catch((err) => {
  console.error('PHASE 12 TEST FAILED:', err);
  process.exit(1);
});
