import {
  Project,
  ProductionActivity,
  ProductionJob,
  WorldBible,
  Character,
  StoryConcept,
  Season,
  Episode,
  SceneItem,
  MediaAsset,
} from '../types/database';

// ============================================================================
// PRODUCTION MODE (GO LIVE): ZERO PRE-SEEDED DUMMY DATA
// Every new account and clean workspace starts with 0 projects, 0 activities,
// 0 jobs, 0 characters, 0 scenes, and 0 media assets.
// ============================================================================

export const INITIAL_DEMO_PROJECTS: Project[] = [];

export const INITIAL_DEMO_ACTIVITIES: ProductionActivity[] = [];

export const INITIAL_DEMO_JOBS: ProductionJob[] = [];

export const INITIAL_DEMO_WORLD_BIBLES: Record<string, WorldBible> = {};

export const INITIAL_DEMO_CHARACTERS: Character[] = [];

export const INITIAL_DEMO_STORY_CONCEPTS: Record<string, StoryConcept> = {};

export const INITIAL_DEMO_SEASONS: Season[] = [];

export const INITIAL_DEMO_EPISODES: Episode[] = [];

export const INITIAL_DEMO_SCENES: SceneItem[] = [];

export const INITIAL_DEMO_MEDIA_ASSETS: MediaAsset[] = [];
