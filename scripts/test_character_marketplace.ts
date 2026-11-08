/**
 * Test Script: Phase 11 Community Asset & Character Marketplace Integration
 * Verifies:
 * 1. Curated Character Packs contain complete Visual Seed Sheets, 3-tier Costumes, and Voice Profiles.
 * 2. Importing a full Character Pack into a target project's Character Studio.
 * 3. Importing a single character from a Character Pack.
 * 4. Publishing a custom Character Pack from a project to the Marketplace.
 */

// Mock browser localStorage for Node.js test execution
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
  fetchCharacterMarketplacePacks,
  importCharacterPackToProject,
  publishCharacterPackToMarketplace,
  fetchCharacters,
  createProjectRecord,
} from '../src/lib/supabase';

async function runCharacterMarketplaceTests() {
  console.log('=== TEST 1: Verify Curated Character Marketplace Packs ===');
  const packsRes = await fetchCharacterMarketplacePacks();
  if (packsRes.error || packsRes.data.length < 4) {
    throw new Error(`Expected at least 4 character packs, got ${packsRes.data.length}`);
  }

  for (const pack of packsRes.data) {
    console.log(`✔ Pack: "${pack.title}" (${pack.genre}) — ${pack.characters.length} characters`);
    for (const char of pack.characters) {
      if (!char.visual_consistency_prompt) {
        throw new Error(`Character ${char.name} missing visual_consistency_prompt`);
      }
      if (!char.costume?.daily_attire || !char.costume?.battle_robes || !char.costume?.accessories_artifacts) {
        throw new Error(`Character ${char.name} missing 3-tier costume breakdown`);
      }
      if (!char.voice_characteristics?.pitch_tone || !char.voice_characteristics?.speech_tempo) {
        throw new Error(`Character ${char.name} missing voice profile`);
      }
      console.log(
        `   • ${char.name} (${char.role}): Seed [OK] | Costume 3-Tier [OK] | Voice Profile [OK]`
      );
    }
  }

  console.log('\n=== TEST 2: Create Target Project & Import Full Character Pack ===');
  const projRes = await createProjectRecord('test_creator_user', {
    name: 'Proyek Uji Karakter Marketplace',
    description: 'Pengujian unduh paket karakter langsung ke Character Studio',
    genre: 'Xianxia / Wuxia',
    production_format: 'Series',
    settings: {
      seasons_count: 1,
      episodes_count: 12,
      episode_duration_minutes: 15,
      scene_count_target: 20,
      aspect_ratio: '16:9',
      output_resolution: '1080p',
      frame_rate: '24fps',
      visual_style: 'Cinematic Donghua 3D',
      output_language: 'id',
      subtitle_language: 'en',
      voice_language: 'id',
      production_quality: 'high',
      production_mode: 'ai_assisted',
      enabled_modules: ['character_studio'],
      enabled_agents: ['master_director'],
      human_approval_required: true,
      credit_budget: 2000,
    },
  });

  if (!projRes.project) {
    throw new Error('Failed to create test project');
  }
  const targetProjectId = projRes.project.id;

  const xianxiaPack = packsRes.data[0];
  const importRes = await importCharacterPackToProject(targetProjectId, xianxiaPack.id);
  if (importRes.error || importRes.imported.length !== xianxiaPack.characters.length) {
    throw new Error(`Failed to import full character pack: ${importRes.error}`);
  }
  console.log(
    `✔ Imported ${importRes.imported.length} characters from "${importRes.packTitle}" into project ${targetProjectId}`
  );

  console.log('\n=== TEST 3: Import Single Character from Another Pack ===');
  const cyberpunkPack = packsRes.data[1];
  const singleTarget = cyberpunkPack.characters[0];
  const singleImportRes = await importCharacterPackToProject(
    targetProjectId,
    cyberpunkPack.id,
    singleTarget.id
  );
  if (singleImportRes.error || singleImportRes.imported.length !== 1) {
    throw new Error(`Failed single character import: ${singleImportRes.error}`);
  }
  console.log(`✔ Imported single character "${singleImportRes.imported[0].name}" into project`);

  const projectCharsRes = await fetchCharacters(targetProjectId);
  console.log(
    `✔ Total characters now in project Character Studio: ${projectCharsRes.data.length}`
  );
  if (projectCharsRes.data.length !== xianxiaPack.characters.length + 1) {
    throw new Error(
      `Expected ${xianxiaPack.characters.length + 1} characters in project, got ${projectCharsRes.data.length}`
    );
  }

  console.log('\n=== TEST 4: Publish Custom Character Pack from Project to Marketplace ===');
  const publishRes = await publishCharacterPackToMarketplace({
    title: 'Pendekar Awan Biru & Netrunner Crossover Pack',
    description: 'Paket karakter kustom hasil kurasi studio.',
    genre: 'Action / Crossover',
    author_name: 'Sutradara Uji',
    tags: ['Crossover', 'Visual Seed Ready'],
    credit_cost: 0,
    characters: projectCharsRes.data.slice(0, 2),
  });

  if (publishRes.error || !publishRes.pack) {
    throw new Error(`Failed to publish character pack: ${publishRes.error}`);
  }
  console.log(
    `✔ Published new community pack: "${publishRes.pack.title}" with ${publishRes.pack.characters.length} characters`
  );

  const updatedPacksRes = await fetchCharacterMarketplacePacks();
  if (updatedPacksRes.data.length !== packsRes.data.length + 1) {
    throw new Error('Published pack did not appear in fetchCharacterMarketplacePacks');
  }
  console.log(
    `✔ Verified Marketplace now contains ${updatedPacksRes.data.length} Character Packs.`
  );
  console.log('\nALL PHASE 11 CHARACTER MARKETPLACE TESTS PASSED SUCCESSFULLY!');
}

runCharacterMarketplaceTests().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
