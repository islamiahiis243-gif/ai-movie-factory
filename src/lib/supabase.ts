import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  Project,
  ProjectSettings,
  UserProfile,
  WorldBible,
  Character,
  StoryConcept,
  Season,
  Episode,
  SceneItem,
  ScriptBlock,
  ScriptVersion,
  AgentProjectConfig,
  AgentTask,
  AgentExecutionLog,
  MediaAsset,
  AssetType,
  PipelineJob,
  PipelineJobLog,
  ExportPackage,
  UserSubscription,
  CreditTransaction,
  PaymentOrder,
  SubscriptionTier,
  Workspace,
  WorkspaceMember,
  WorkspaceRole,
  MarketplaceTemplate,
  MarketplaceCharacterPack,
  MarketplaceCharacterSheet,
  StorageBucketName,
  StorageBucketObject,
  StorageUploadResult,
  CreatorMilestone,
  CreatorMediaKitSettings,
} from '../types/database';
import {
  INITIAL_DEMO_PROJECTS,
  INITIAL_DEMO_WORLD_BIBLES,
  INITIAL_DEMO_CHARACTERS,
  INITIAL_DEMO_STORY_CONCEPTS,
  INITIAL_DEMO_SEASONS,
  INITIAL_DEMO_EPISODES,
  INITIAL_DEMO_SCENES,
  INITIAL_DEMO_MEDIA_ASSETS,
} from './demoData';
import {
  generateInitialAgentConfigs,
  generateInitialDemoTasks,
  generateInitialDemoLogs,
} from './orchestrator';
import {
  getInitialPipelineJobs,
  getInitialExportPackages,
} from './pipelineEngine';
import {
  getInitialSubscription,
  getInitialCreditTransactions,
  getInitialPaymentOrders,
} from './billingEngine';
import {
  INITIAL_MARKETPLACE_TEMPLATES,
  INITIAL_CHARACTER_MARKETPLACE_PACKS,
} from './multilingualAdapters';

export function normalizeSupabaseUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  let url = rawUrl.trim();
  // Automatically convert Supabase dashboard URLs into REST API URLs
  if (url.includes('/dashboard/project/')) {
    const match = url.match(/\/dashboard\/project\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      url = `https://${match[1]}.supabase.co`;
    }
  } else if (url.includes('supabase.com/project/')) {
    const match = url.match(/\/project\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      url = `https://${match[1]}.supabase.co`;
    }
  }
  return url.replace(/\/+$/, '');
}

export const rawSupabaseUrl: string =
  (typeof process !== 'undefined' && (process.env?.VITE_SUPABASE_URL || process.env?.SUPABASE_URL)) ||
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  '';
export const supabaseUrl: string = normalizeSupabaseUrl(rawSupabaseUrl);
export const supabaseAnonKey: string = (
  (typeof process !== 'undefined' && (process.env?.VITE_SUPABASE_ANON_KEY || process.env?.SUPABASE_ANON_KEY)) ||
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
  ''
).trim();

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'https://your-project.supabase.co' &&
  !supabaseUrl.includes('placeholder') &&
  supabaseUrl.startsWith('https://')
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * Validates if a given string is a valid UUID format (required for PostgreSQL UUID columns)
 */
export function isValidUUID(str?: string | null): boolean {
  if (!str) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Clean up any legacy v1 demo localStorage keys on startup so production always starts with 0 dummy data
if (typeof window !== 'undefined') {
  try {
    const legacyCleanupDone = localStorage.getItem('ai_movie_factory_v2_prod_cleaned');
    if (!legacyCleanupDone) {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('ai_movie_factory_') && !k.includes('_v2_prod')) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
      localStorage.setItem('ai_movie_factory_v2_prod_cleaned', 'true');
    }
  } catch {
    // ignore storage access issues
  }
}

// Local storage keys (v2_prod: 0 pre-seeded dummy items)
const LOCAL_STORAGE_PROJECTS_KEY = 'ai_movie_factory_projects_v2_prod';
const LOCAL_STORAGE_PROFILE_KEY = 'ai_movie_factory_profile_v2_prod';
const LOCAL_STORAGE_WORLD_BIBLES_KEY = 'ai_movie_factory_world_bibles_v2_prod';
const LOCAL_STORAGE_CHARACTERS_KEY = 'ai_movie_factory_characters_v2_prod';

export function getLocalProjects(): Project[] {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_PROJECTS_KEY);
    if (!data) {
      localStorage.setItem(LOCAL_STORAGE_PROJECTS_KEY, JSON.stringify(INITIAL_DEMO_PROJECTS));
      return INITIAL_DEMO_PROJECTS;
    }
    return JSON.parse(data);
  } catch {
    return INITIAL_DEMO_PROJECTS;
  }
}

export function saveLocalProjects(projects: Project[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_PROJECTS_KEY, JSON.stringify(projects));
  } catch (err) {
    console.error('Failed to persist local projects:', err);
  }
}

export function getLocalProfile(): UserProfile {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_PROFILE_KEY);
    if (!data) {
      const defaultProfile: UserProfile = {
        id: 'local-creator-001',
        display_name: 'Studio Creator',
        avatar_url: null,
        preferred_language: 'id',
        email: 'creator@aimoviefactory.local',
        role: 'Studio Director',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      localStorage.setItem(LOCAL_STORAGE_PROFILE_KEY, JSON.stringify(defaultProfile));
      return defaultProfile;
    }
    return JSON.parse(data);
  } catch {
    return {
      id: 'local-creator-001',
      display_name: 'Studio Creator',
      avatar_url: null,
      preferred_language: 'id',
      email: 'creator@aimoviefactory.local',
      role: 'Studio Director',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
}

export function saveLocalProfile(profile: UserProfile) {
  try {
    localStorage.setItem(LOCAL_STORAGE_PROFILE_KEY, JSON.stringify(profile));
  } catch (err) {
    console.error('Failed to persist local profile:', err);
  }
}

export function getLocalWorldBibles(): Record<string, WorldBible> {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_WORLD_BIBLES_KEY);
    if (!data) {
      localStorage.setItem(LOCAL_STORAGE_WORLD_BIBLES_KEY, JSON.stringify(INITIAL_DEMO_WORLD_BIBLES));
      return INITIAL_DEMO_WORLD_BIBLES;
    }
    return JSON.parse(data);
  } catch {
    return INITIAL_DEMO_WORLD_BIBLES;
  }
}

export function saveLocalWorldBibles(bibles: Record<string, WorldBible>) {
  try {
    localStorage.setItem(LOCAL_STORAGE_WORLD_BIBLES_KEY, JSON.stringify(bibles));
  } catch (err) {
    console.error('Failed to persist local world bibles:', err);
  }
}

export function getLocalCharacters(): Character[] {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_CHARACTERS_KEY);
    if (!data) {
      localStorage.setItem(LOCAL_STORAGE_CHARACTERS_KEY, JSON.stringify(INITIAL_DEMO_CHARACTERS));
      return INITIAL_DEMO_CHARACTERS;
    }
    return JSON.parse(data);
  } catch {
    return INITIAL_DEMO_CHARACTERS;
  }
}

export function saveLocalCharacters(characters: Character[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_CHARACTERS_KEY, JSON.stringify(characters));
  } catch (err) {
    console.error('Failed to persist local characters:', err);
  }
}

const LOCAL_STORAGE_STORY_CONCEPTS_KEY = 'ai_movie_factory_story_concepts_v2_prod';
const LOCAL_STORAGE_SEASONS_KEY = 'ai_movie_factory_seasons_v2_prod';
const LOCAL_STORAGE_EPISODES_KEY = 'ai_movie_factory_episodes_v2_prod';
const LOCAL_STORAGE_SCENES_KEY = 'ai_movie_factory_scenes_v2_prod';
const LOCAL_STORAGE_SCRIPT_VERSIONS_KEY = 'ai_movie_factory_script_versions_v2_prod';

export function getLocalStoryConcepts(): Record<string, StoryConcept> {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_STORY_CONCEPTS_KEY);
    if (!data) {
      localStorage.setItem(LOCAL_STORAGE_STORY_CONCEPTS_KEY, JSON.stringify(INITIAL_DEMO_STORY_CONCEPTS));
      return INITIAL_DEMO_STORY_CONCEPTS;
    }
    return JSON.parse(data);
  } catch {
    return INITIAL_DEMO_STORY_CONCEPTS;
  }
}

export function saveLocalStoryConcepts(concepts: Record<string, StoryConcept>) {
  try {
    localStorage.setItem(LOCAL_STORAGE_STORY_CONCEPTS_KEY, JSON.stringify(concepts));
  } catch (err) {
    console.error('Failed to persist local story concepts:', err);
  }
}

export function getLocalSeasons(): Season[] {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_SEASONS_KEY);
    if (!data) {
      localStorage.setItem(LOCAL_STORAGE_SEASONS_KEY, JSON.stringify(INITIAL_DEMO_SEASONS));
      return INITIAL_DEMO_SEASONS;
    }
    return JSON.parse(data);
  } catch {
    return INITIAL_DEMO_SEASONS;
  }
}

export function saveLocalSeasons(seasons: Season[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_SEASONS_KEY, JSON.stringify(seasons));
  } catch (err) {
    console.error('Failed to persist local seasons:', err);
  }
}

export function getLocalEpisodes(): Episode[] {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_EPISODES_KEY);
    if (!data) {
      localStorage.setItem(LOCAL_STORAGE_EPISODES_KEY, JSON.stringify(INITIAL_DEMO_EPISODES));
      return INITIAL_DEMO_EPISODES;
    }
    return JSON.parse(data);
  } catch {
    return INITIAL_DEMO_EPISODES;
  }
}

export function saveLocalEpisodes(episodes: Episode[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_EPISODES_KEY, JSON.stringify(episodes));
  } catch (err) {
    console.error('Failed to persist local episodes:', err);
  }
}

export function getLocalScenes(): SceneItem[] {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_SCENES_KEY);
    if (!data) {
      localStorage.setItem(LOCAL_STORAGE_SCENES_KEY, JSON.stringify(INITIAL_DEMO_SCENES));
      return INITIAL_DEMO_SCENES;
    }
    return JSON.parse(data);
  } catch {
    return INITIAL_DEMO_SCENES;
  }
}

export function saveLocalScenes(scenes: SceneItem[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_SCENES_KEY, JSON.stringify(scenes));
  } catch (err) {
    console.error('Failed to persist local scenes:', err);
  }
}

export function getLocalScriptVersions(): Record<string, ScriptVersion[]> {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_SCRIPT_VERSIONS_KEY);
    if (!data) return {};
    return JSON.parse(data);
  } catch {
    return {};
  }
}

export function saveLocalScriptVersions(versions: Record<string, ScriptVersion[]>) {
  try {
    localStorage.setItem(LOCAL_STORAGE_SCRIPT_VERSIONS_KEY, JSON.stringify(versions));
  } catch (err) {
    console.error('Failed to persist script versions:', err);
  }
}

const LOCAL_STORAGE_AGENT_CONFIGS_KEY = 'ai_movie_factory_agent_configs_v2_prod';
const LOCAL_STORAGE_AGENT_TASKS_KEY = 'ai_movie_factory_agent_tasks_v2_prod';
const LOCAL_STORAGE_AGENT_LOGS_KEY = 'ai_movie_factory_agent_logs_v2_prod';

export function getLocalAgentConfigs(projectId: string): AgentProjectConfig[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_AGENT_CONFIGS_KEY);
    if (!raw) {
      const initial = generateInitialAgentConfigs(projectId);
      const map: Record<string, AgentProjectConfig[]> = { [projectId]: initial };
      localStorage.setItem(LOCAL_STORAGE_AGENT_CONFIGS_KEY, JSON.stringify(map));
      return initial;
    }
    const map: Record<string, AgentProjectConfig[]> = JSON.parse(raw);
    if (!map[projectId]) {
      const initial = generateInitialAgentConfigs(projectId);
      map[projectId] = initial;
      localStorage.setItem(LOCAL_STORAGE_AGENT_CONFIGS_KEY, JSON.stringify(map));
      return initial;
    }
    return map[projectId];
  } catch {
    return generateInitialAgentConfigs(projectId);
  }
}

export function saveLocalAgentConfigs(projectId: string, configs: AgentProjectConfig[]) {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_AGENT_CONFIGS_KEY);
    const map: Record<string, AgentProjectConfig[]> = raw ? JSON.parse(raw) : {};
    map[projectId] = configs;
    localStorage.setItem(LOCAL_STORAGE_AGENT_CONFIGS_KEY, JSON.stringify(map));
  } catch (err) {
    console.error('Failed to save agent configs:', err);
  }
}

export function getLocalAgentTasks(projectId: string): AgentTask[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_AGENT_TASKS_KEY);
    if (!raw) {
      const initial = generateInitialDemoTasks(projectId);
      const map: Record<string, AgentTask[]> = { [projectId]: initial };
      localStorage.setItem(LOCAL_STORAGE_AGENT_TASKS_KEY, JSON.stringify(map));
      return initial;
    }
    const map: Record<string, AgentTask[]> = JSON.parse(raw);
    if (!map[projectId]) {
      const initial = generateInitialDemoTasks(projectId);
      map[projectId] = initial;
      localStorage.setItem(LOCAL_STORAGE_AGENT_TASKS_KEY, JSON.stringify(map));
      return initial;
    }
    return map[projectId];
  } catch {
    return generateInitialDemoTasks(projectId);
  }
}

export function saveLocalAgentTasks(projectId: string, tasks: AgentTask[]) {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_AGENT_TASKS_KEY);
    const map: Record<string, AgentTask[]> = raw ? JSON.parse(raw) : {};
    map[projectId] = tasks;
    localStorage.setItem(LOCAL_STORAGE_AGENT_TASKS_KEY, JSON.stringify(map));
  } catch (err) {
    console.error('Failed to save agent tasks:', err);
  }
}

export function getLocalAgentLogs(projectId: string): AgentExecutionLog[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_AGENT_LOGS_KEY);
    if (!raw) {
      const initial = generateInitialDemoLogs(projectId);
      const map: Record<string, AgentExecutionLog[]> = { [projectId]: initial };
      localStorage.setItem(LOCAL_STORAGE_AGENT_LOGS_KEY, JSON.stringify(map));
      return initial;
    }
    const map: Record<string, AgentExecutionLog[]> = JSON.parse(raw);
    if (!map[projectId]) {
      const initial = generateInitialDemoLogs(projectId);
      map[projectId] = initial;
      localStorage.setItem(LOCAL_STORAGE_AGENT_LOGS_KEY, JSON.stringify(map));
      return initial;
    }
    return map[projectId];
  } catch {
    return generateInitialDemoLogs(projectId);
  }
}

export function saveLocalAgentLogs(projectId: string, logs: AgentExecutionLog[]) {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_AGENT_LOGS_KEY);
    const map: Record<string, AgentExecutionLog[]> = raw ? JSON.parse(raw) : {};
    map[projectId] = logs;
    localStorage.setItem(LOCAL_STORAGE_AGENT_LOGS_KEY, JSON.stringify(map));
  } catch (err) {
    console.error('Failed to save agent logs:', err);
  }
}

const LOCAL_STORAGE_ASSETS_KEY = 'ai_movie_factory_media_assets_v2_prod';

export function getLocalAssets(projectId: string): MediaAsset[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_ASSETS_KEY);
    if (!raw) {
      return [];
    }
    const map: Record<string, MediaAsset[]> = JSON.parse(raw);
    return map[projectId] || [];
  } catch {
    return [];
  }
}

export function saveLocalAssets(projectId: string, assets: MediaAsset[]) {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_ASSETS_KEY);
    const map: Record<string, MediaAsset[]> = raw ? JSON.parse(raw) : {};
    map[projectId] = assets;
    localStorage.setItem(LOCAL_STORAGE_ASSETS_KEY, JSON.stringify(map));
  } catch (err) {
    console.error('Failed to save media assets:', err);
  }
}

/**
 * Service Layer for Projects & Settings
 */
export async function fetchProjects(_userId: string): Promise<{ data: Project[]; isDemo: boolean; error: string | null }> {
  // If connected to Supabase and an active authenticated session exists
  if (isSupabaseConfigured && supabase) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const activeUserId = session.user.id;
        const { data: projectsData, error: projError } = await supabase
          .from('projects')
          .select(`
            id,
            user_id,
            name,
            description,
            genre,
            custom_genre,
            production_format,
            status,
            thumbnail_url,
            workspace_id,
            created_at,
            updated_at,
            project_settings (
              settings
            )
          `)
          .eq('user_id', activeUserId)
          .order('created_at', { ascending: false });

        if (!projError && projectsData) {
          const formatted: Project[] = projectsData.map((row: any) => ({
            id: row.id,
            user_id: row.user_id,
            name: row.name,
            description: row.description,
            genre: row.genre,
            custom_genre: row.custom_genre,
            production_format: row.production_format,
            status: row.status,
            thumbnail_url: row.thumbnail_url,
            workspace_id: row.workspace_id,
            settings: row.project_settings?.[0]?.settings,
            created_at: row.created_at,
            updated_at: row.updated_at,
            is_demo: false,
          }));

          return { data: formatted, isDemo: false, error: null };
        } else if (projError) {
          console.warn('Supabase projects joined query notice, using direct select fallback:', projError.message);
          const { data: rawProjects, error: rawError } = await supabase
            .from('projects')
            .select('*')
            .eq('user_id', activeUserId)
            .order('created_at', { ascending: false });

          if (!rawError && rawProjects) {
            const formatted: Project[] = rawProjects.map((row: any) => ({
              id: row.id,
              user_id: row.user_id,
              name: row.name,
              description: row.description,
              genre: row.genre,
              custom_genre: row.custom_genre,
              production_format: row.production_format,
              status: row.status,
              thumbnail_url: row.thumbnail_url,
              workspace_id: row.workspace_id,
              settings: undefined,
              created_at: row.created_at,
              updated_at: row.updated_at,
              is_demo: false,
            }));

            return { data: formatted, isDemo: false, error: null };
          }
        }
      } else {
        // Supabase is configured, but user is not signed in yet -> return 0 projects (no fake demo data)
        return { data: [], isDemo: false, error: null };
      }
    } catch (err: any) {
      console.warn('Supabase fetchProjects exception:', err);
    }
  }

  const localList = getLocalProjects();
  return { data: localList, isDemo: false, error: null };
}

export async function createProjectRecord(
  userId: string,
  payload: {
    name: string;
    description: string;
    genre: string;
    custom_genre?: string;
    production_format: string;
    settings: ProjectSettings;
  }
): Promise<{ project: Project | null; error: string | null }> {
  // Generate a valid UUID if supported, else random identifier
  const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `proj-${Date.now()}`;
  const now = new Date().toISOString();

  // Check active Supabase authenticated session
  let activeSessionUser: any = null;
  if (isSupabaseConfigured && supabase) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        activeSessionUser = session.user;
      }
    } catch (sessErr) {
      console.warn('Session verification notice:', sessErr);
    }
  }

  // If user has an active authenticated account with Supabase
  if (activeSessionUser) {
    const authenticatedUserId = activeSessionUser.id;
    try {
      // Ensure user profile exists and is active to satisfy projects INSERT RLS policy
      const { data: existingProfile } = await supabase!
        .from('profiles')
        .select('id, is_active')
        .eq('id', authenticatedUserId)
        .maybeSingle();

      if (!existingProfile) {
        await supabase!.from('profiles').upsert({
          id: authenticatedUserId,
          display_name: activeSessionUser.user_metadata?.display_name || activeSessionUser.email?.split('@')[0] || 'Studio Director',
          email: activeSessionUser.email,
          preferred_language: 'id',
          role: 'creator',
          is_active: true,
          deleted_at: null,
        }, { onConflict: 'id' });
      }

      const { data: projectRow, error: pError } = await supabase!
        .from('projects')
        .insert({
          id: newId,
          user_id: authenticatedUserId,
          name: payload.name,
          description: payload.description,
          genre: payload.genre,
          custom_genre: payload.custom_genre || null,
          production_format: payload.production_format,
          status: 'draft',
        })
        .select()
        .single();

      if (pError) throw pError;

      const { error: sError } = await supabase!
        .from('project_settings')
        .upsert({
          project_id: projectRow.id,
          settings: payload.settings,
        }, { onConflict: 'project_id' });

      if (sError) console.warn('Non-fatal project_settings insert notice:', sError.message);

      const fullProject: Project = {
        ...projectRow,
        settings: payload.settings,
        is_demo: false,
      };

      // Always sync to local storage immediately so project is accessible regardless of connection or session quirks
      const current = getLocalProjects();
      saveLocalProjects([fullProject, ...current.filter((p) => p.id !== fullProject.id)]);

      return { project: fullProject, error: null };
    } catch (err: any) {
      console.warn('Supabase cloud insert notice (code: ' + (err?.code || 'unknown') + '). Falling back to local storage:', err.message);
      // Fallback gracefully to local storage so user never loses their new project
      const localProject: Project = {
        id: newId,
        user_id: authenticatedUserId,
        name: payload.name,
        description: payload.description,
        genre: payload.genre,
        custom_genre: payload.custom_genre || null,
        production_format: payload.production_format,
        status: 'draft',
        settings: payload.settings,
        created_at: now,
        updated_at: now,
        is_demo: true,
      };

      const current = getLocalProjects();
      saveLocalProjects([localProject, ...current]);
      return { project: localProject, error: null };
    }
  }

  // Local storage creation (Guest / Unauthenticated creator mode)
  const localProject: Project = {
    id: newId,
    user_id: userId,
    name: payload.name,
    description: payload.description,
    genre: payload.genre,
    custom_genre: payload.custom_genre || null,
    production_format: payload.production_format,
    status: 'draft',
    settings: payload.settings,
    created_at: now,
    updated_at: now,
    is_demo: true,
  };

  const current = getLocalProjects();
  saveLocalProjects([localProject, ...current]);
  return { project: localProject, error: null };
}

export async function updateProjectRecord(
  projectId: string,
  updates: Partial<Project> & { settings?: ProjectSettings }
): Promise<{ success: boolean; error: string | null }> {
  const now = new Date().toISOString();

  if (isSupabaseConfigured && supabase && isValidUUID(projectId)) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { settings, is_demo, ...projFields } = updates;
        
        const { error: pError } = await supabase
          .from('projects')
          .update({
            ...projFields,
            updated_at: now,
          })
          .eq('id', projectId);

        if (!pError) {
          if (settings) {
            await supabase
              .from('project_settings')
              .update({
                settings: settings,
                updated_at: now,
              })
              .eq('project_id', projectId);
          }
          return { success: true, error: null };
        }
      }
    } catch (err: any) {
      console.warn('Supabase updateProjectRecord notice:', err);
    }
  }

  // Local storage update
  const list = getLocalProjects();
  const index = list.findIndex(p => p.id === projectId);
  if (index !== -1) {
    list[index] = {
      ...list[index],
      ...updates,
      updated_at: now,
    };
    saveLocalProjects(list);
    return { success: true, error: null };
  }
  return { success: false, error: 'Proyek tidak ditemukan' };
}

export async function deleteProjectRecord(projectId: string): Promise<{ success: boolean; error: string | null }> {
  if (isSupabaseConfigured && supabase && isValidUUID(projectId)) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { error } = await supabase
          .from('projects')
          .delete()
          .eq('id', projectId);

        if (!error) return { success: true, error: null };
      }
    } catch (err: any) {
      console.warn('Supabase deleteProjectRecord notice:', err);
    }
  }

  // Local storage delete
  const list = getLocalProjects().filter(p => p.id !== projectId);
  saveLocalProjects(list);
  return { success: true, error: null };
}

// ============================================================================
// PHASE 2: WORLD BUILDER SERVICE METHODS (SSOT Section 8)
// ============================================================================

export async function fetchWorldBible(projectId: string): Promise<{ data: WorldBible | null; error: string | null }> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('story_bibles')
        .select('*')
        .eq('project_id', projectId)
        .single();

      if (error && error.code !== 'PGRST116') {
        return { data: null, error: error.message };
      }
      return { data: data || null, error: null };
    } catch (err: any) {
      return { data: null, error: err.message || 'Failed to fetch world bible' };
    }
  }

  // Local fallback
  const bibles = getLocalWorldBibles();
  const existing = bibles[projectId];
  if (existing) {
    return { data: existing, error: null };
  }

  // Return a newly initialized world bible for this project if not yet exists
  const initial: WorldBible = {
    id: `bible-${projectId}`,
    project_id: projectId,
    world_name: 'Dunia Baru',
    synopsis: '',
    historical_background: '',
    rules_of_the_world: '',
    magic_or_tech_system: '',
    spiritual_energy_rules: '',
    cultivation_realms: [],
    factions: [],
    locations: [],
    timeline: [],
    reference_notes: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  bibles[projectId] = initial;
  saveLocalWorldBibles(bibles);
  return { data: initial, error: null };
}

export async function saveWorldBibleRecord(
  projectId: string,
  payload: Partial<WorldBible>
): Promise<{ data: WorldBible | null; error: string | null }> {
  const now = new Date().toISOString();

  if (isSupabaseConfigured && supabase) {
    try {
      const { data: existing } = await supabase
        .from('story_bibles')
        .select('id')
        .eq('project_id', projectId)
        .single();

      if (existing) {
        const { data, error } = await supabase
          .from('story_bibles')
          .update({
            ...payload,
            updated_at: now,
          })
          .eq('project_id', projectId)
          .select()
          .single();

        if (error) throw error;
        return { data, error: null };
      } else {
        const { data, error } = await supabase
          .from('story_bibles')
          .insert({
            project_id: projectId,
            ...payload,
          })
          .select()
          .single();

        if (error) throw error;
        return { data, error: null };
      }
    } catch (err: any) {
      return { data: null, error: err.message || 'Failed to save world bible' };
    }
  }

  // Local fallback
  const bibles = getLocalWorldBibles();
  const current = bibles[projectId] || {
    id: `bible-${projectId}`,
    project_id: projectId,
    world_name: 'Dunia Baru',
    synopsis: '',
    historical_background: '',
    rules_of_the_world: '',
    magic_or_tech_system: '',
    spiritual_energy_rules: '',
    cultivation_realms: [],
    factions: [],
    locations: [],
    timeline: [],
    created_at: now,
    updated_at: now,
  };

  const updated: WorldBible = {
    ...current,
    ...payload,
    updated_at: now,
  };

  bibles[projectId] = updated;
  saveLocalWorldBibles(bibles);
  return { data: updated, error: null };
}

// ============================================================================
// PHASE 2: CHARACTER STUDIO SERVICE METHODS (SSOT Section 9)
// ============================================================================

export async function fetchCharacters(projectId: string): Promise<{ data: Character[]; error: string | null }> {
  const localChars = getLocalCharacters().filter(c => c.project_id === projectId);

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('characters')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        const cloudIds = new Set(data.map((c: Character) => c.id));
        const merged = [...data, ...localChars.filter(lc => !cloudIds.has(lc.id))];
        return { data: merged, error: null };
      }
    } catch (err: any) {
      console.warn('Supabase fetchCharacters fallback to local storage:', err?.message);
    }
  }

  return { data: localChars, error: null };
}

export async function createCharacterRecord(
  projectId: string,
  charData: Omit<Character, 'id' | 'created_at' | 'updated_at'>
): Promise<{ character: Character | null; error: string | null }> {
  const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `char-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const { project_id: _ignore, ...cleanCharData } = charData;

  const localCharacter: Character = {
    id: newId,
    project_id: projectId,
    ...cleanCharData,
    created_at: now,
    updated_at: now,
  };

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('characters')
        .insert({
          id: newId,
          project_id: projectId,
          ...cleanCharData,
        })
        .select()
        .single();

      if (error) throw error;

      const all = getLocalCharacters();
      saveLocalCharacters([...all.filter(c => c.id !== data.id), data]);
      return { character: data, error: null };
    } catch (err: any) {
      console.warn('Supabase createCharacterRecord fallback to local storage:', err?.message);
    }
  }

  // Local fallback / dual persistence
  const all = getLocalCharacters();
  saveLocalCharacters([...all, localCharacter]);
  return { character: localCharacter, error: null };
}

export async function updateCharacterRecord(
  characterId: string,
  updates: Partial<Character>
): Promise<{ success: boolean; error: string | null }> {
  const now = new Date().toISOString();

  // Always update local storage mirror if present
  const all = getLocalCharacters();
  const idx = all.findIndex(c => c.id === characterId);
  if (idx !== -1) {
    all[idx] = {
      ...all[idx],
      ...updates,
      updated_at: now,
    };
    saveLocalCharacters(all);
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase
        .from('characters')
        .update({
          ...updates,
          updated_at: now,
        })
        .eq('id', characterId);

      if (error) throw error;
      return { success: true, error: null };
    } catch (err: any) {
      if (idx !== -1) {
        return { success: true, error: null };
      }
      return { success: false, error: err.message || 'Failed to update character' };
    }
  }

  if (idx !== -1) {
    return { success: true, error: null };
  }
  return { success: false, error: 'Character not found' };
}

export async function deleteCharacterRecord(characterId: string): Promise<{ success: boolean; error: string | null }> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase
        .from('characters')
        .delete()
        .eq('id', characterId);

      if (error) throw error;
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to delete character' };
    }
  }

  // Local fallback
  const all = getLocalCharacters().filter(c => c.id !== characterId);
  saveLocalCharacters(all);
  return { success: true, error: null };
}

// ============================================================================
// PHASE 2 (PART B): STORY & SCRIPT SERVICE METHODS (SSOT Section 10, 11, 38)
// ============================================================================

// --- Story Concept ---
export async function fetchStoryConcept(projectId: string): Promise<{ data: StoryConcept | null; error: string | null }> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('story_concepts')
        .select('*')
        .eq('project_id', projectId)
        .single();

      if (error && error.code !== 'PGRST116') {
        return { data: null, error: error.message };
      }
      return { data: data || null, error: null };
    } catch (err: any) {
      return { data: null, error: err.message || 'Failed to fetch story concept' };
    }
  }

  // Local fallback
  const concepts = getLocalStoryConcepts();
  const existing = concepts[projectId];
  if (existing) {
    return { data: existing, error: null };
  }

  // Initial default concept
  const defaultConcept: StoryConcept = {
    id: `concept-${projectId}`,
    project_id: projectId,
    logline: '',
    synopsis: '',
    theme: '',
    narrative_structure: 'three_act',
    tone_style: '',
    target_audience: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  concepts[projectId] = defaultConcept;
  saveLocalStoryConcepts(concepts);
  return { data: defaultConcept, error: null };
}

export async function saveStoryConceptRecord(
  projectId: string,
  payload: Partial<StoryConcept>
): Promise<{ data: StoryConcept | null; error: string | null }> {
  const now = new Date().toISOString();

  if (isSupabaseConfigured && supabase) {
    try {
      const { data: existing } = await supabase
        .from('story_concepts')
        .select('id')
        .eq('project_id', projectId)
        .single();

      if (existing) {
        const { data, error } = await supabase
          .from('story_concepts')
          .update({
            ...payload,
            updated_at: now,
          })
          .eq('project_id', projectId)
          .select()
          .single();

        if (error) throw error;
        return { data, error: null };
      } else {
        const { data, error } = await supabase
          .from('story_concepts')
          .insert({
            project_id: projectId,
            ...payload,
          })
          .select()
          .single();

        if (error) throw error;
        return { data, error: null };
      }
    } catch (err: any) {
      return { data: null, error: err.message || 'Failed to save story concept' };
    }
  }

  // Local fallback
  const concepts = getLocalStoryConcepts();
  const current = concepts[projectId] || {
    id: `concept-${projectId}`,
    project_id: projectId,
    logline: '',
    synopsis: '',
    theme: '',
    narrative_structure: 'three_act',
    tone_style: '',
    target_audience: '',
    created_at: now,
    updated_at: now,
  };

  const updated: StoryConcept = {
    ...current,
    ...payload,
    updated_at: now,
  };

  concepts[projectId] = updated;
  saveLocalStoryConcepts(concepts);
  return { data: updated, error: null };
}

// --- Seasons Management ---
export async function fetchSeasons(projectId: string): Promise<{ data: Season[]; error: string | null }> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('seasons')
        .select('*')
        .eq('project_id', projectId)
        .order('season_number', { ascending: true });

      if (error) return { data: [], error: error.message };
      return { data: data || [], error: null };
    } catch (err: any) {
      return { data: [], error: err.message || 'Failed to fetch seasons' };
    }
  }

  // Local fallback (0 auto-seeded dummy seasons)
  const all = getLocalSeasons().filter(s => s.project_id === projectId);
  return { data: all.sort((a, b) => a.season_number - b.season_number), error: null };
}

export async function createSeasonRecord(
  projectId: string,
  seasonData: Omit<Season, 'id' | 'created_at' | 'updated_at'>
): Promise<{ season: Season | null; error: string | null }> {
  const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `season-${Date.now()}`;
  const now = new Date().toISOString();
  const { project_id: _ignore, ...cleanData } = seasonData;

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('seasons')
        .insert({
          id: newId,
          project_id: projectId,
          ...cleanData,
        })
        .select()
        .single();

      if (error) throw error;
      return { season: data, error: null };
    } catch (err: any) {
      return { season: null, error: err.message || 'Failed to create season' };
    }
  }

  // Local fallback
  const newSeason: Season = {
    id: newId,
    project_id: projectId,
    ...cleanData,
    created_at: now,
    updated_at: now,
  };

  const all = getLocalSeasons();
  saveLocalSeasons([...all, newSeason]);
  return { season: newSeason, error: null };
}

export async function updateSeasonRecord(
  seasonId: string,
  updates: Partial<Season>
): Promise<{ success: boolean; error: string | null }> {
  const now = new Date().toISOString();

  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase
        .from('seasons')
        .update({
          ...updates,
          updated_at: now,
        })
        .eq('id', seasonId);

      if (error) throw error;
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to update season' };
    }
  }

  // Local fallback
  const all = getLocalSeasons();
  const idx = all.findIndex(s => s.id === seasonId);
  if (idx !== -1) {
    all[idx] = {
      ...all[idx],
      ...updates,
      updated_at: now,
    };
    saveLocalSeasons(all);
    return { success: true, error: null };
  }
  return { success: false, error: 'Season not found' };
}

export async function deleteSeasonRecord(seasonId: string): Promise<{ success: boolean; error: string | null }> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase
        .from('seasons')
        .delete()
        .eq('id', seasonId);

      if (error) throw error;
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to delete season' };
    }
  }

  // Local fallback
  const all = getLocalSeasons().filter(s => s.id !== seasonId);
  saveLocalSeasons(all);
  return { success: true, error: null };
}

// --- Episodes Management ---
export async function fetchEpisodes(
  seasonId: string,
  projectId: string
): Promise<{ data: Episode[]; error: string | null }> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('episodes')
        .select('*')
        .eq('season_id', seasonId)
        .order('episode_number', { ascending: true });

      if (error) return { data: [], error: error.message };
      return { data: data || [], error: null };
    } catch (err: any) {
      return { data: [], error: err.message || 'Failed to fetch episodes' };
    }
  }

  // Local fallback (0 auto-seeded dummy episodes)
  const all = getLocalEpisodes().filter(e => e.season_id === seasonId);
  return { data: all.sort((a, b) => a.episode_number - b.episode_number), error: null };
}

export async function fetchProjectEpisodes(
  projectId: string
): Promise<{ data: Episode[]; error: string | null }> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('episodes')
        .select('*')
        .eq('project_id', projectId)
        .order('episode_number', { ascending: true });

      if (error) return { data: [], error: error.message };
      return { data: data || [], error: null };
    } catch (err: any) {
      return { data: [], error: err.message || 'Failed to fetch project episodes' };
    }
  }

  // Local fallback (0 auto-seeded dummy episodes)
  const all = getLocalEpisodes().filter(e => e.project_id === projectId);
  return { data: all.sort((a, b) => a.episode_number - b.episode_number), error: null };
}

export async function createEpisodeRecord(
  projectId: string,
  epData: Omit<Episode, 'id' | 'created_at' | 'updated_at'>
): Promise<{ episode: Episode | null; error: string | null }> {
  const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ep-${Date.now()}`;
  const now = new Date().toISOString();
  const { project_id: _ignore, ...cleanData } = epData;

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('episodes')
        .insert({
          id: newId,
          project_id: projectId,
          ...cleanData,
        })
        .select()
        .single();

      if (error) throw error;
      return { episode: data, error: null };
    } catch (err: any) {
      return { episode: null, error: err.message || 'Failed to create episode' };
    }
  }

  // Local fallback
  const newEpisode: Episode = {
    id: newId,
    project_id: projectId,
    ...cleanData,
    created_at: now,
    updated_at: now,
  };

  const all = getLocalEpisodes();
  saveLocalEpisodes([...all, newEpisode]);
  return { episode: newEpisode, error: null };
}

export async function updateEpisodeRecord(
  episodeId: string,
  updates: Partial<Episode>
): Promise<{ success: boolean; error: string | null }> {
  const now = new Date().toISOString();

  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase
        .from('episodes')
        .update({
          ...updates,
          updated_at: now,
        })
        .eq('id', episodeId);

      if (error) throw error;
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to update episode' };
    }
  }

  // Local fallback
  const all = getLocalEpisodes();
  const idx = all.findIndex(e => e.id === episodeId);
  if (idx !== -1) {
    all[idx] = {
      ...all[idx],
      ...updates,
      updated_at: now,
    };
    saveLocalEpisodes(all);
    return { success: true, error: null };
  }
  return { success: false, error: 'Episode not found' };
}

export async function deleteEpisodeRecord(episodeId: string): Promise<{ success: boolean; error: string | null }> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase
        .from('episodes')
        .delete()
        .eq('id', episodeId);

      if (error) throw error;
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to delete episode' };
    }
  }

  // Local fallback
  const all = getLocalEpisodes().filter(e => e.id !== episodeId);
  saveLocalEpisodes(all);
  return { success: true, error: null };
}

// --- Scenes Management ---
export async function fetchScenes(
  episodeId: string,
  projectId: string
): Promise<{ data: SceneItem[]; error: string | null }> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('scenes')
        .select('*')
        .eq('episode_id', episodeId)
        .order('scene_number', { ascending: true });

      if (error) return { data: [], error: error.message };
      return { data: data || [], error: null };
    } catch (err: any) {
      return { data: [], error: err.message || 'Failed to fetch scenes' };
    }
  }

  // Local fallback
  const all = getLocalScenes().filter(s => s.episode_id === episodeId);
  return { data: all.sort((a, b) => a.scene_number - b.scene_number), error: null };
}

export async function fetchProjectScenes(
  projectId: string
): Promise<{ data: SceneItem[]; error: string | null }> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('scenes')
        .select('*')
        .eq('project_id', projectId)
        .order('scene_number', { ascending: true });

      if (error) return { data: [], error: error.message };
      return { data: data || [], error: null };
    } catch (err: any) {
      return { data: [], error: err.message || 'Failed to fetch project scenes' };
    }
  }

  // Local fallback
  const all = getLocalScenes().filter(s => s.project_id === projectId || !s.project_id);
  return { data: all.sort((a, b) => a.scene_number - b.scene_number), error: null };
}

export async function createSceneRecord(
  projectId: string,
  episodeId: string,
  sceneData: Omit<SceneItem, 'id' | 'created_at' | 'updated_at'>
): Promise<{ scene: SceneItem | null; error: string | null }> {
  const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `scene-${Date.now()}`;
  const now = new Date().toISOString();
  const { project_id: _ignore, episode_id: _ignoreEp, ...cleanData } = sceneData;

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('scenes')
        .insert({
          id: newId,
          project_id: projectId,
          episode_id: episodeId,
          ...cleanData,
        })
        .select()
        .single();

      if (error) throw error;
      return { scene: data, error: null };
    } catch (err: any) {
      return { scene: null, error: err.message || 'Failed to create scene' };
    }
  }

  // Local fallback
  const newScene: SceneItem = {
    id: newId,
    project_id: projectId,
    episode_id: episodeId,
    ...cleanData,
    created_at: now,
    updated_at: now,
  };

  const all = getLocalScenes();
  saveLocalScenes([...all, newScene]);
  return { scene: newScene, error: null };
}

export async function updateSceneRecord(
  sceneId: string,
  updates: Partial<SceneItem>
): Promise<{ success: boolean; error: string | null }> {
  const now = new Date().toISOString();

  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase
        .from('scenes')
        .update({
          ...updates,
          updated_at: now,
        })
        .eq('id', sceneId);

      if (error) throw error;
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to update scene' };
    }
  }

  // Local fallback
  const all = getLocalScenes();
  const idx = all.findIndex(s => s.id === sceneId);
  if (idx !== -1) {
    all[idx] = {
      ...all[idx],
      ...updates,
      updated_at: now,
    };
    saveLocalScenes(all);
    return { success: true, error: null };
  }
  return { success: false, error: 'Scene not found' };
}

export async function deleteSceneRecord(sceneId: string): Promise<{ success: boolean; error: string | null }> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase
        .from('scenes')
        .delete()
        .eq('id', sceneId);

      if (error) throw error;
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to delete scene' };
    }
  }

  // Local fallback
  const all = getLocalScenes().filter(s => s.id !== sceneId);
  saveLocalScenes(all);
  return { success: true, error: null };
}

// --- Approval & Versioning Workflow (SSOT Section 10 & 37) ---
export async function approveSceneScript(
  sceneId: string,
  approverName: string = 'Director',
  snapshotOptions?: {
    blocks?: ScriptBlock[];
    versionNumber?: number;
    changelogNote?: string;
  }
): Promise<{ success: boolean; versionSnapshotCreated: boolean; error: string | null }> {
  const now = new Date().toISOString();

  if (isSupabaseConfigured && supabase) {
    try {
      const { error: updateErr } = await supabase
        .from('scenes')
        .update({
          approval_status: 'approved',
          approved_at: now,
          approved_by: approverName,
          updated_at: now,
        })
        .eq('id', sceneId);

      if (updateErr) throw updateErr;

      let snapshotCreated = false;
      if (snapshotOptions && snapshotOptions.blocks && snapshotOptions.blocks.length > 0) {
        const verNum = snapshotOptions.versionNumber || 1;
        const { error: verErr } = await createScriptVersionRecord(sceneId, {
          version_number: verNum,
          changelog_note:
            snapshotOptions.changelogNote ||
            `LOCKED_V${verNum} - Gate 1 Director Script Approval Checkpoint`,
          blocks: snapshotOptions.blocks,
          created_by: approverName,
        });

        if (verErr) {
          // Rollback approval status to draft to prevent split-brain state (Temuan 4)
          await supabase
            .from('scenes')
            .update({
              approval_status: 'draft',
              approved_at: null,
              approved_by: null,
              updated_at: now,
            })
            .eq('id', sceneId);
          throw new Error(
            `Audit trail snapshot failed: ${verErr}. Persetujuan dibatalkan untuk menjaga integritas data.`
          );
        }
        snapshotCreated = true;
      }

      return { success: true, versionSnapshotCreated: snapshotCreated, error: null };
    } catch (err: any) {
      return { success: false, versionSnapshotCreated: false, error: err.message || 'Failed to approve scene' };
    }
  }

  // Local fallback
  const all = getLocalScenes();
  const idx = all.findIndex((s) => s.id === sceneId);
  if (idx !== -1) {
    let snapshotCreated = false;
    if (snapshotOptions && snapshotOptions.blocks && snapshotOptions.blocks.length > 0) {
      const verNum = snapshotOptions.versionNumber || 1;
      const verRes = await createScriptVersionRecord(sceneId, {
        version_number: verNum,
        changelog_note:
          snapshotOptions.changelogNote ||
          `LOCKED_V${verNum} - Gate 1 Director Script Approval Checkpoint`,
        blocks: snapshotOptions.blocks,
        created_by: approverName,
      });
      if (verRes.error) {
        return { success: false, versionSnapshotCreated: false, error: verRes.error };
      }
      snapshotCreated = true;
    }

    all[idx] = {
      ...all[idx],
      approval_status: 'approved',
      approved_at: now,
      approved_by: approverName,
      updated_at: now,
    };
    saveLocalScenes(all);
    return { success: true, versionSnapshotCreated: snapshotCreated, error: null };
  }
  return { success: false, versionSnapshotCreated: false, error: 'Scene not found' };
}

export async function invalidateSceneApproval(
  sceneId: string,
  _reason?: string
): Promise<{ success: boolean; error: string | null }> {
  const now = new Date().toISOString();

  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase
        .from('scenes')
        .update({
          approval_status: 'draft',
          approved_at: null,
          approved_by: null,
          updated_at: now,
        })
        .eq('id', sceneId);

      if (error) throw error;
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to invalidate scene approval' };
    }
  }

  // Local fallback
  const all = getLocalScenes();
  const idx = all.findIndex(s => s.id === sceneId);
  if (idx !== -1) {
    all[idx] = {
      ...all[idx],
      approval_status: 'draft',
      approved_at: undefined,
      approved_by: undefined,
      updated_at: now,
    };
    saveLocalScenes(all);
    return { success: true, error: null };
  }
  return { success: false, error: 'Scene not found' };
}

export async function createScriptVersionRecord(
  sceneId: string,
  data: {
    version_number: number;
    changelog_note: string;
    blocks: any[];
    created_by?: string;
  }
): Promise<{ success: boolean; error: string | null }> {
  const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ver-${Date.now()}`;
  const now = new Date().toISOString();

  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase
        .from('script_versions')
        .insert({
          id: newId,
          scene_id: sceneId,
          version_number: data.version_number,
          changelog_note: data.changelog_note,
          blocks: data.blocks,
          created_at: now,
          created_by: data.created_by,
        });

      if (error) throw error;
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to record script version' };
    }
  }

  // Local fallback
  const all = getLocalScriptVersions();
  const sceneVersions = all[sceneId] || [];
  const newVersion: ScriptVersion = {
    id: newId,
    scene_id: sceneId,
    version_number: data.version_number,
    changelog_note: data.changelog_note,
    blocks: data.blocks,
    created_at: now,
    created_by: data.created_by,
  };

  all[sceneId] = [...sceneVersions, newVersion];
  saveLocalScriptVersions(all);
  return { success: true, error: null };
}

export async function fetchScriptVersions(sceneId: string): Promise<{ data: ScriptVersion[]; error: string | null }> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('script_versions')
        .select('*')
        .eq('scene_id', sceneId)
        .order('version_number', { ascending: false });

      if (error) return { data: [], error: error.message };
      return { data: data || [], error: null };
    } catch (err: any) {
      return { data: [], error: err.message || 'Failed to fetch script versions' };
    }
  }

  const all = getLocalScriptVersions();
  const list = all[sceneId] || [];
  return { data: list.sort((a, b) => b.version_number - a.version_number), error: null };
}

export async function fetchScreenplayBlocks(sceneId: string): Promise<{ data: ScriptBlock[]; error: string | null }> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('scenes')
        .select('blocks')
        .eq('id', sceneId)
        .single();

      if (error) throw error;
      return { data: data?.blocks || [], error: null };
    } catch (err: any) {
      console.warn('Supabase fetchScreenplayBlocks fallback:', err);
    }
  }

  const all = getLocalScenes();
  const target = all.find(s => s.id === sceneId);
  return { data: target?.blocks || [], error: null };
}

// ==========================================
// PHASE 3: AI AGENT SYSTEM SERVICE METHODS
// ==========================================

export async function fetchProjectAgents(projectId: string): Promise<{ data: AgentProjectConfig[]; error: string | null }> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('agent_project_configs')
        .select('*')
        .eq('project_id', projectId)
        .order('agent_role', { ascending: true });

      if (error) throw error;
      if (!data || data.length === 0) {
        // Seed default configs for this project
        const initial = generateInitialAgentConfigs(projectId);
        const { data: inserted, error: insertErr } = await supabase
          .from('agent_project_configs')
          .insert(initial)
          .select();
        if (insertErr) throw insertErr;
        return { data: inserted || initial, error: null };
      }
      return { data: data || [], error: null };
    } catch (err: any) {
      console.warn('Supabase fetchProjectAgents error, falling back to local storage:', err);
    }
  }

  return { data: getLocalAgentConfigs(projectId), error: null };
}

export async function updateProjectAgentConfig(
  projectId: string,
  configId: string,
  updates: Partial<AgentProjectConfig>
): Promise<{ success: boolean; error: string | null }> {
  const now = new Date().toISOString();
  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase
        .from('agent_project_configs')
        .update({
          ...updates,
          updated_at: now,
        })
        .eq('id', configId);

      if (error) throw error;
      return { success: true, error: null };
    } catch (err: any) {
      console.warn('Supabase updateProjectAgentConfig error:', err);
    }
  }

  const list = getLocalAgentConfigs(projectId);
  const updated = list.map(item => item.id === configId ? { ...item, ...updates, updated_at: now } : item);
  saveLocalAgentConfigs(projectId, updated);
  return { success: true, error: null };
}

export async function resetProjectAgentsToDefault(projectId: string): Promise<{ success: boolean; error: string | null }> {
  const initial = generateInitialAgentConfigs(projectId);
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('agent_project_configs').delete().eq('project_id', projectId);
      const { error } = await supabase.from('agent_project_configs').insert(initial);
      if (error) throw error;
      return { success: true, error: null };
    } catch (err: any) {
      console.warn('Supabase resetProjectAgentsToDefault error:', err);
    }
  }

  saveLocalAgentConfigs(projectId, initial);
  return { success: true, error: null };
}

export async function fetchProductionTasks(projectId: string): Promise<{ data: AgentTask[]; error: string | null }> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('production_tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { data: data || [], error: null };
    } catch (err: any) {
      console.warn('Supabase fetchProductionTasks error, fallback to local storage:', err);
    }
  }

  return { data: getLocalAgentTasks(projectId), error: null };
}

export async function createProductionTask(
  projectId: string,
  taskData: Omit<AgentTask, 'id' | 'started_at'>
): Promise<{ data: AgentTask | null; error: string | null }> {
  const now = new Date().toISOString();
  const id = `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const newTask: AgentTask = {
    ...taskData,
    id,
    project_id: projectId,
    started_at: now,
  };

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('production_tasks')
        .insert(newTask)
        .select()
        .single();

      if (error) throw error;
      return { data: data || newTask, error: null };
    } catch (err: any) {
      console.warn('Supabase createProductionTask error, fallback to local storage:', err);
    }
  }

  const list = getLocalAgentTasks(projectId);
  saveLocalAgentTasks(projectId, [newTask, ...list]);
  return { data: newTask, error: null };
}

export async function updateProductionTask(
  projectId: string,
  taskId: string,
  updates: Partial<AgentTask>
): Promise<{ success: boolean; error: string | null }> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase
        .from('production_tasks')
        .update(updates)
        .eq('id', taskId);

      if (error) throw error;
      return { success: true, error: null };
    } catch (err: any) {
      console.warn('Supabase updateProductionTask error:', err);
    }
  }

  const list = getLocalAgentTasks(projectId);
  const updated = list.map(t => t.id === taskId ? { ...t, ...updates } : t);
  saveLocalAgentTasks(projectId, updated);
  return { success: true, error: null };
}

export async function cancelProductionTask(
  projectId: string,
  taskId: string
): Promise<{ success: boolean; error: string | null }> {
  return updateProductionTask(projectId, taskId, {
    status: 'cancelled',
    error_message: 'Dibatalkan oleh Sutradara / User',
  });
}

export async function retryProductionTask(
  projectId: string,
  taskId: string
): Promise<{ success: boolean; error: string | null }> {
  return updateProductionTask(projectId, taskId, {
    status: 'running',
    progress: 10,
    error_message: undefined,
  });
}

export async function approveProductionTask(
  projectId: string,
  taskId: string,
  approverName: string = 'Sutradara Utama'
): Promise<{ success: boolean; error: string | null }> {
  const now = new Date().toISOString();
  return updateProductionTask(projectId, taskId, {
    status: 'completed',
    progress: 100,
    is_approved: true,
    approved_by: approverName,
    approved_at: now,
    completed_at: now,
  });
}

export async function fetchTaskLogs(
  projectId: string,
  taskId?: string
): Promise<{ data: AgentExecutionLog[]; error: string | null }> {
  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase
        .from('agent_execution_logs')
        .select('*')
        .eq('project_id', projectId);

      if (taskId) {
        query = query.eq('task_id', taskId);
      }

      const { data, error } = await query.order('timestamp', { ascending: true });
      if (error) throw error;
      return { data: data || [], error: null };
    } catch (err: any) {
      console.warn('Supabase fetchTaskLogs error, fallback to local storage:', err);
    }
  }

  const logs = getLocalAgentLogs(projectId);
  if (taskId) {
    return { data: logs.filter(l => l.task_id === taskId), error: null };
  }
  return { data: logs, error: null };
}

export async function createTaskLog(
  projectId: string,
  logData: Omit<AgentExecutionLog, 'id' | 'timestamp'>
): Promise<{ data: AgentExecutionLog | null; error: string | null }> {
  const now = new Date().toISOString();
  const id = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const newLog: AgentExecutionLog = {
    ...logData,
    id,
    project_id: projectId,
    timestamp: now,
  };

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('agent_execution_logs')
        .insert(newLog)
        .select()
        .single();

      if (error) throw error;
      return { data: data || newLog, error: null };
    } catch (err: any) {
      console.warn('Supabase createTaskLog error, fallback to local storage:', err);
    }
  }

  const list = getLocalAgentLogs(projectId);
  saveLocalAgentLogs(projectId, [...list, newLog]);
  return { data: newLog, error: null };
}

// ==========================================
// PHASE 4: MEDIA GENERATION SERVICE METHODS
// ==========================================

export async function fetchProjectAssets(
  projectId: string,
  filters?: { type?: AssetType; episodeId?: string; sceneId?: string }
): Promise<{ data: MediaAsset[]; error: string | null }> {
  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase
        .from('assets')
        .select('*')
        .eq('project_id', projectId);

      if (filters?.type) {
        query = query.eq('asset_type', filters.type);
      }
      if (filters?.episodeId) {
        query = query.eq('episode_id', filters.episodeId);
      }
      if (filters?.sceneId) {
        query = query.eq('scene_id', filters.sceneId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return { data: data || [], error: null };
    } catch (err: any) {
      console.warn('Supabase fetchProjectAssets error, falling back to local storage:', err);
    }
  }

  let list = getLocalAssets(projectId);
  if (filters?.type) {
    list = list.filter((a) => a.asset_type === filters.type);
  }
  if (filters?.episodeId) {
    list = list.filter((a) => a.episode_id === filters.episodeId);
  }
  if (filters?.sceneId) {
    list = list.filter((a) => a.scene_id === filters.sceneId);
  }
  return { data: list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), error: null };
}

export async function createMediaAsset(
  projectId: string,
  assetData: Omit<MediaAsset, 'id' | 'created_at' | 'updated_at'>
): Promise<{ data: MediaAsset | null; error: string | null }> {
  const now = new Date().toISOString();
  const id = `asset_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const newAsset: MediaAsset = {
    ...assetData,
    id,
    project_id: projectId,
    created_at: now,
    updated_at: now,
  };

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('assets')
        .insert(newAsset)
        .select()
        .single();

      if (error) throw error;
      return { data: data || newAsset, error: null };
    } catch (err: any) {
      console.warn('Supabase createMediaAsset error, falling back to local storage:', err);
    }
  }

  const list = getLocalAssets(projectId);
  saveLocalAssets(projectId, [newAsset, ...list]);
  return { data: newAsset, error: null };
}

export async function updateMediaAsset(
  projectId: string,
  assetId: string,
  updates: Partial<MediaAsset>
): Promise<{ success: boolean; error: string | null }> {
  const now = new Date().toISOString();
  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase
        .from('assets')
        .update({
          ...updates,
          updated_at: now,
        })
        .eq('id', assetId);

      if (error) throw error;
      return { success: true, error: null };
    } catch (err: any) {
      console.warn('Supabase updateMediaAsset error:', err);
    }
  }

  const list = getLocalAssets(projectId);
  const updated = list.map((a) => (a.id === assetId ? { ...a, ...updates, updated_at: now } : a));
  saveLocalAssets(projectId, updated);
  return { success: true, error: null };
}

export async function deleteMediaAsset(
  projectId: string,
  assetId: string
): Promise<{ success: boolean; error: string | null }> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase
        .from('assets')
        .delete()
        .eq('id', assetId);

      if (error) throw error;
      return { success: true, error: null };
    } catch (err: any) {
      console.warn('Supabase deleteMediaAsset error:', err);
    }
  }

  const list = getLocalAssets(projectId);
  saveLocalAssets(projectId, list.filter((a) => a.id !== assetId));
  return { success: true, error: null };
}

export async function approveMediaAsset(
  projectId: string,
  assetId: string,
  approverName: string = 'Sutradara Utama'
): Promise<{ success: boolean; error: string | null }> {
  const now = new Date().toISOString();
  return updateMediaAsset(projectId, assetId, {
    approval_status: 'approved',
    approved_by: approverName,
    approved_at: now,
  });
}

export async function rejectMediaAsset(
  projectId: string,
  assetId: string
): Promise<{ success: boolean; error: string | null }> {
  return updateMediaAsset(projectId, assetId, {
    approval_status: 'rejected',
  });
}

// ============================================================================
// PHASE 5: PRODUCTION PIPELINE, AUTONOMOUS QUEUE & EXPORT (SSOT Sections 14, 15, 40)
// ============================================================================

const LOCAL_STORAGE_PIPELINE_JOBS_PREFIX = 'ai_movie_factory_pipeline_jobs_v2_prod_';
const LOCAL_STORAGE_JOB_LOGS_PREFIX = 'ai_movie_factory_pipeline_logs_v2_prod_';
const LOCAL_STORAGE_EXPORT_PACKAGES_PREFIX = 'ai_movie_factory_export_packages_v2_prod_';

export function getLocalPipelineJobs(projectId: string): PipelineJob[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_PIPELINE_JOBS_PREFIX}${projectId}`);
    if (!raw) {
      const initial = getInitialPipelineJobs(projectId);
      saveLocalPipelineJobs(projectId, initial);
      return initial;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading local pipeline jobs:', err);
    return getInitialPipelineJobs(projectId);
  }
}

export function saveLocalPipelineJobs(projectId: string, jobs: PipelineJob[]): void {
  try {
    localStorage.setItem(`${LOCAL_STORAGE_PIPELINE_JOBS_PREFIX}${projectId}`, JSON.stringify(jobs));
  } catch (err) {
    console.error('Error saving local pipeline jobs:', err);
  }
}

export function getLocalJobLogs(jobId: string): PipelineJobLog[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_JOB_LOGS_PREFIX}${jobId}`);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Error reading local job logs:', err);
    return [];
  }
}

export function saveLocalJobLogs(jobId: string, logs: PipelineJobLog[]): void {
  try {
    localStorage.setItem(`${LOCAL_STORAGE_JOB_LOGS_PREFIX}${jobId}`, JSON.stringify(logs));
  } catch (err) {
    console.error('Error saving local job logs:', err);
  }
}

export function getLocalExportPackages(projectId: string): ExportPackage[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_EXPORT_PACKAGES_PREFIX}${projectId}`);
    if (!raw) {
      const initial = getInitialExportPackages(projectId);
      saveLocalExportPackages(projectId, initial);
      return initial;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading local export packages:', err);
    return getInitialExportPackages(projectId);
  }
}

export function saveLocalExportPackages(projectId: string, packages: ExportPackage[]): void {
  try {
    localStorage.setItem(`${LOCAL_STORAGE_EXPORT_PACKAGES_PREFIX}${projectId}`, JSON.stringify(packages));
  } catch (err) {
    console.error('Error saving local export packages:', err);
  }
}

// Service Methods for Pipeline Jobs
export async function fetchPipelineJobs(
  projectId: string
): Promise<{ data: PipelineJob[]; error: string | null }> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('pipeline_jobs')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { data: data || [], error: null };
    } catch (err: any) {
      console.warn('Supabase fetchPipelineJobs error, using local fallback:', err);
    }
  }

  const jobs = getLocalPipelineJobs(projectId);
  return { data: jobs, error: null };
}

export async function createPipelineJob(
  projectId: string,
  jobData: Omit<PipelineJob, 'id' | 'created_at' | 'updated_at'>
): Promise<{ data: PipelineJob | null; error: string | null }> {
  const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `job-${Date.now()}`;
  const now = new Date().toISOString();

  const newJob: PipelineJob = {
    ...jobData,
    id: newId,
    project_id: projectId,
    created_at: now,
    updated_at: now,
  };

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('pipeline_jobs')
        .insert(newJob)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (err: any) {
      console.warn('Supabase createPipelineJob error, using local fallback:', err);
    }
  }

  const list = getLocalPipelineJobs(projectId);
  const updated = [newJob, ...list];
  saveLocalPipelineJobs(projectId, updated);
  return { data: newJob, error: null };
}

export async function updatePipelineJob(
  projectId: string,
  jobId: string,
  updates: Partial<PipelineJob>
): Promise<{ success: boolean; error: string | null }> {
  const now = new Date().toISOString();

  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase
        .from('pipeline_jobs')
        .update({ ...updates, updated_at: now })
        .eq('id', jobId);

      if (error) throw error;
      return { success: true, error: null };
    } catch (err: any) {
      console.warn('Supabase updatePipelineJob error, using local fallback:', err);
    }
  }

  const list = getLocalPipelineJobs(projectId);
  const updated = list.map(j => (j.id === jobId ? { ...j, ...updates, updated_at: now } : j));
  saveLocalPipelineJobs(projectId, updated);
  return { success: true, error: null };
}

export async function approvePipelineJob(
  projectId: string,
  jobId: string,
  approverName: string = 'Sutradara Utama'
): Promise<{ success: boolean; error: string | null }> {
  const now = new Date().toISOString();
  return updatePipelineJob(projectId, jobId, {
    is_approved: true,
    approved_by: approverName,
    approved_at: now,
    status: 'running',
    current_stage: 'final_assembly',
    progress: 85,
    stages_completed: ['script_prep', 'image_gen', 'video_gen', 'voice_audio', 'qc_audit', 'user_approval']
  });
}

export async function pausePipelineJob(
  projectId: string,
  jobId: string
): Promise<{ success: boolean; error: string | null }> {
  return updatePipelineJob(projectId, jobId, { status: 'paused' });
}

export async function resumePipelineJob(
  projectId: string,
  jobId: string
): Promise<{ success: boolean; error: string | null }> {
  return updatePipelineJob(projectId, jobId, { status: 'running' });
}

export async function cancelPipelineJob(
  projectId: string,
  jobId: string
): Promise<{ success: boolean; error: string | null }> {
  return updatePipelineJob(projectId, jobId, { status: 'cancelled' });
}

export async function addJobLog(
  jobId: string,
  logData: Omit<PipelineJobLog, 'id' | 'timestamp'>
): Promise<{ data: PipelineJobLog; error: string | null }> {
  const newLog: PipelineJobLog = {
    ...logData,
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    job_id: jobId,
    timestamp: new Date().toISOString()
  };

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('pipeline_job_logs').insert(newLog);
    } catch (err) {
      console.warn('Supabase addJobLog error:', err);
    }
  }

  const existing = getLocalJobLogs(jobId);
  saveLocalJobLogs(jobId, [...existing, newLog]);
  return { data: newLog, error: null };
}

export async function fetchJobLogs(
  jobId: string
): Promise<{ data: PipelineJobLog[]; error: string | null }> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('pipeline_job_logs')
        .select('*')
        .eq('job_id', jobId)
        .order('timestamp', { ascending: true });

      if (error) throw error;
      return { data: data || [], error: null };
    } catch (err) {
      console.warn('Supabase fetchJobLogs error, using local fallback:', err);
    }
  }

  return { data: getLocalJobLogs(jobId), error: null };
}

// Export Packages Methods
export async function fetchExportPackages(
  projectId: string
): Promise<{ data: ExportPackage[]; error: string | null }> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('export_packages')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { data: data || [], error: null };
    } catch (err: any) {
      console.warn('Supabase fetchExportPackages error, using local fallback:', err);
    }
  }

  const list = getLocalExportPackages(projectId);
  return { data: list, error: null };
}

export async function createExportPackage(
  projectId: string,
  pkgData: Omit<ExportPackage, 'id' | 'created_at'>
): Promise<{ data: ExportPackage | null; error: string | null }> {
  const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `pkg-${Date.now()}`;
  const now = new Date().toISOString();

  const newPkg: ExportPackage = {
    ...pkgData,
    id: newId,
    project_id: projectId,
    created_at: now
  };

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('export_packages')
        .insert(newPkg)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (err: any) {
      console.warn('Supabase createExportPackage error, using local fallback:', err);
    }
  }

  const list = getLocalExportPackages(projectId);
  const updated = [newPkg, ...list];
  saveLocalExportPackages(projectId, updated);
  return { data: newPkg, error: null };
}

// ============================================================================
// PHASE 6: COMMERCIAL SAAS & MONETIZATION (SSOT Sections 21, 22, 23, 41)
// ============================================================================

const LOCAL_STORAGE_SUBSCRIPTION_PREFIX = 'ai_movie_factory_subscription_v2_prod_';
const LOCAL_STORAGE_CREDIT_TX_PREFIX = 'ai_movie_factory_credit_tx_v2_prod_';
const LOCAL_STORAGE_PAYMENT_ORDERS_PREFIX = 'ai_movie_factory_payment_orders_v2_prod_';

async function callBillingServerApi(payload: Record<string, any>): Promise<any> {
  if (!isSupabaseConfigured || !supabase) return null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return null;
    const response = await fetch('/api/payment-webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody?.error || `HTTP ${response.status}`);
    }
    return await response.json();
  } catch (err) {
    console.warn('Server billing API notice:', err);
    return null;
  }
}

// Local storage helpers
export function getLocalSubscription(userId: string): UserSubscription {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_SUBSCRIPTION_PREFIX}${userId}`);
    if (!raw) {
      const initial = getInitialSubscription(userId);
      saveLocalSubscription(userId, initial);
      return initial;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading local subscription:', err);
    return getInitialSubscription(userId);
  }
}

export function saveLocalSubscription(userId: string, subscription: UserSubscription): void {
  try {
    localStorage.setItem(`${LOCAL_STORAGE_SUBSCRIPTION_PREFIX}${userId}`, JSON.stringify(subscription));
  } catch (err) {
    console.error('Error saving local subscription:', err);
  }
}

export function getLocalCreditTransactions(userId: string): CreditTransaction[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_CREDIT_TX_PREFIX}${userId}`);
    if (!raw) {
      const initial = getInitialCreditTransactions(userId);
      saveLocalCreditTransactions(userId, initial);
      return initial;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading local credit transactions:', err);
    return getInitialCreditTransactions(userId);
  }
}

export function saveLocalCreditTransactions(userId: string, txs: CreditTransaction[]): void {
  try {
    localStorage.setItem(`${LOCAL_STORAGE_CREDIT_TX_PREFIX}${userId}`, JSON.stringify(txs));
  } catch (err) {
    console.error('Error saving local credit transactions:', err);
  }
}

export function getLocalPaymentOrders(userId: string): PaymentOrder[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_PAYMENT_ORDERS_PREFIX}${userId}`);
    if (!raw) {
      const initial = getInitialPaymentOrders(userId);
      saveLocalPaymentOrders(userId, initial);
      return initial;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading local payment orders:', err);
    return getInitialPaymentOrders(userId);
  }
}

export function saveLocalPaymentOrders(userId: string, orders: PaymentOrder[]): void {
  try {
    localStorage.setItem(`${LOCAL_STORAGE_PAYMENT_ORDERS_PREFIX}${userId}`, JSON.stringify(orders));
  } catch (err) {
    console.error('Error saving local payment orders:', err);
  }
}

// Service Methods for Subscriptions
export async function fetchUserSubscription(
  userId: string
): Promise<{ data: UserSubscription; error: string | null }> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        saveLocalSubscription(userId, data);
        return { data, error: null };
      }
    } catch (err: any) {
      console.warn('Supabase fetchUserSubscription error, using local fallback:', err);
    }
  }

  const sub = getLocalSubscription(userId);
  return { data: sub, error: null };
}

export async function updateUserSubscription(
  userId: string,
  updates: Partial<UserSubscription>
): Promise<{ success: boolean; data?: UserSubscription; error: string | null }> {
  const now = new Date().toISOString();

  if (updates.tier === 'free') {
    const apiRes = await callBillingServerApi({ action: 'switch_free_plan' });
    if (apiRes?.subscription) {
      saveLocalSubscription(userId, apiRes.subscription);
      return { success: true, data: apiRes.subscription, error: null };
    }
  }

  const current = getLocalSubscription(userId);
  const updated: UserSubscription = { ...current, ...updates, updated_at: now };
  saveLocalSubscription(userId, updated);
  return { success: true, data: updated, error: null };
}

// Service Methods for Credit Ledger (SSOT Section 22)
export async function fetchCreditTransactions(
  userId: string
): Promise<{ data: CreditTransaction[]; error: string | null }> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('credit_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data && data.length > 0) {
        saveLocalCreditTransactions(userId, data);
        return { data, error: null };
      }
    } catch (err: any) {
      console.warn('Supabase fetchCreditTransactions error, using local fallback:', err);
    }
  }

  const txs = getLocalCreditTransactions(userId);
  return { data: txs, error: null };
}

export async function recordCreditTransaction(
  userId: string,
  txData: Omit<CreditTransaction, 'id' | 'user_id' | 'created_at' | 'balance_after'>
): Promise<{ data: CreditTransaction | null; error: string | null }> {
  if (txData.transaction_type === 'usage') {
    const apiRes = await callBillingServerApi({
      action: 'record_usage',
      amount: Math.abs(txData.amount),
      project_id: txData.project_id,
      job_id: txData.job_id,
      provider: txData.provider,
      model: txData.model,
      operation: txData.operation,
      estimated_cost_usd: txData.estimated_cost_usd,
      actual_cost_usd: txData.actual_cost_usd,
      description: txData.description,
      idempotency_key: txData.idempotency_key
    });
    if (apiRes?.transaction) {
      const currentTxs = getLocalCreditTransactions(userId);
      saveLocalCreditTransactions(userId, [apiRes.transaction, ...currentTxs]);
      return { data: apiRes.transaction, error: null };
    }
  }

  const currentTxs = getLocalCreditTransactions(userId);
  const latestBalance = currentTxs.length > 0 ? currentTxs[0].balance_after : 150;
  const newBalance = Math.max(0, latestBalance + txData.amount);

  const newTx: CreditTransaction = {
    ...txData,
    id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    user_id: userId,
    balance_after: newBalance,
    created_at: new Date().toISOString()
  };

  const updated = [newTx, ...currentTxs];
  saveLocalCreditTransactions(userId, updated);
  return { data: newTx, error: null };
}

export async function refundCreditTransaction(
  userId: string,
  txId: string,
  reason: string = 'Kompensasi audit teknis / kegagalan render'
): Promise<{ success: boolean; error: string | null }> {
  const apiRes = await callBillingServerApi({
    action: 'refund_tx',
    tx_id: txId,
    reason
  });
  if (apiRes?.transaction) {
    const currentTxs = getLocalCreditTransactions(userId);
    saveLocalCreditTransactions(userId, [apiRes.transaction, ...currentTxs]);
    return { success: true, error: null };
  }

  const txs = getLocalCreditTransactions(userId);
  const target = txs.find(t => t.id === txId);
  if (!target || target.transaction_type !== 'usage') {
    return { success: false, error: 'Transaksi tidak valid untuk dikembalikan.' };
  }

  const refundAmount = Math.abs(target.amount);
  const result = await recordCreditTransaction(userId, {
    project_id: target.project_id,
    job_id: target.job_id,
    transaction_type: 'refund',
    amount: refundAmount,
    provider: target.provider,
    model: target.model,
    operation: `refund_${target.operation}`,
    estimated_cost_usd: 0,
    actual_cost_usd: 0,
    description: `Refund: ${target.description} (${reason})`,
    status: 'completed',
    idempotency_key: `ref_${txId}_${Date.now()}`
  });

  if (result.data) {
    return { success: true, error: null };
  }
  return { success: false, error: 'Gagal memproses refund.' };
}

// Service Methods for Payment Orders
export async function fetchPaymentOrders(
  userId: string
): Promise<{ data: PaymentOrder[]; error: string | null }> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('payment_orders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        saveLocalPaymentOrders(userId, data);
        return { data, error: null };
      }
    } catch (err: any) {
      console.warn('Supabase fetchPaymentOrders error, using local fallback:', err);
    }
  }

  const orders = getLocalPaymentOrders(userId);
  return { data: orders, error: null };
}

export async function createPaymentOrder(
  userId: string,
  orderData: Omit<PaymentOrder, 'id' | 'user_id' | 'created_at' | 'status'>
): Promise<{ data: PaymentOrder | null; error: string | null }> {
  const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ord-${Date.now()}`;
  const now = new Date().toISOString();
  const canonicalPackageType =
    orderData.package_type === 'credit_pack' ? 'topup_credits' : orderData.package_type;

  const newOrder: PaymentOrder = {
    ...orderData,
    package_type: canonicalPackageType,
    id: newId,
    user_id: userId,
    status: 'pending',
    created_at: now
  };

  if (isSupabaseConfigured && supabase && isValidUUID(userId)) {
    try {
      const { data, error } = await supabase
        .from('payment_orders')
        .insert({
          id: newId,
          user_id: userId,
          order_number: newOrder.order_number,
          package_type: canonicalPackageType,
          package_id: newOrder.package_id,
          package_name: newOrder.package_name,
          amount: newOrder.amount,
          currency: newOrder.currency || 'IDR',
          payment_gateway: newOrder.payment_gateway || 'midtrans',
          payment_method: newOrder.payment_method,
          status: 'pending',
          credits_granted: newOrder.credits_granted
        })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        const list = getLocalPaymentOrders(userId);
        saveLocalPaymentOrders(userId, [data, ...list]);
        return { data, error: null };
      }
    } catch (err: any) {
      console.warn('Supabase createPaymentOrder notice, using local pending order:', err?.message || err);
    }
  }

  const list = getLocalPaymentOrders(userId);
  const updated = [newOrder, ...list];
  saveLocalPaymentOrders(userId, updated);
  return { data: newOrder, error: null };
}

export async function simulateSettlePayment(
  userId: string,
  orderId: string
): Promise<{ success: boolean; order?: PaymentOrder; error: string | null }> {
  const orders = getLocalPaymentOrders(userId);
  const idx = orders.findIndex(o => o.id === orderId);
  if (idx === -1) return { success: false, error: 'Order tidak ditemukan' };

  const target = orders[idx];
  const canonicalPackageType =
    target.package_type === 'credit_pack' ? 'topup_credits' : target.package_type;

  // Attempt real server-side settlement via /api/payment-webhook using SUPABASE_SECRET_KEY
  const apiRes = await callBillingServerApi({
    action: 'settle_order',
    order: {
      ...target,
      package_type: canonicalPackageType
    }
  });

  if (apiRes?.order) {
    orders[idx] = apiRes.order;
    saveLocalPaymentOrders(userId, orders);
    if (apiRes.subscription) {
      saveLocalSubscription(userId, apiRes.subscription);
    }
    if (apiRes.transaction) {
      const currentTxs = getLocalCreditTransactions(userId);
      saveLocalCreditTransactions(userId, [apiRes.transaction, ...currentTxs]);
    }
    return { success: true, order: apiRes.order, error: null };
  }

  // Offline / guest fallback
  const now = new Date().toISOString();
  const updatedOrder: PaymentOrder = {
    ...target,
    package_type: canonicalPackageType,
    status: 'settlement',
    paid_at: now,
    external_reference: `MIDTRANS-ID-${target.payment_method.toUpperCase()}-${Date.now().toString().slice(-7)}`
  };

  orders[idx] = updatedOrder;
  saveLocalPaymentOrders(userId, orders);

  if (canonicalPackageType === 'topup_credits') {
    await recordCreditTransaction(userId, {
      transaction_type: 'purchase',
      amount: target.credits_granted,
      provider: 'midtrans',
      model: target.payment_method,
      operation: 'credit_pack_purchase',
      estimated_cost_usd: 0,
      actual_cost_usd: 0,
      description: `Pembelian ${target.package_name} via ${target.payment_method.toUpperCase()}`,
      status: 'completed',
      idempotency_key: `pay_${orderId}`
    });
  } else if (canonicalPackageType === 'subscription') {
    const tier: SubscriptionTier =
      target.package_id === 'creator_indie' || target.package_id === 'plan_creator'
        ? 'creator'
        : target.package_id === 'pro_studio' || target.package_id === 'plan_pro_studio'
        ? 'pro_studio'
        : target.package_id === 'production_house' || target.package_id === 'plan_production_house'
        ? 'production_house'
        : 'free';

    await updateUserSubscription(userId, {
      tier,
      status: 'active',
      price_paid: target.amount,
      credits_allotted: target.credits_granted,
      payment_method: target.payment_method,
      current_period_start: now,
      current_period_end: new Date(Date.now() + 30 * 86400000).toISOString()
    });
    await recordCreditTransaction(userId, {
      transaction_type: 'monthly_allotment',
      amount: target.credits_granted,
      provider: 'midtrans',
      model: target.package_id,
      operation: 'subscription_upgrade_allotment',
      estimated_cost_usd: 0,
      actual_cost_usd: 0,
      description: `Aktivasi Langganan ${target.package_name} via ${target.payment_method.toUpperCase()}`,
      status: 'completed',
      idempotency_key: `sub_allot_${orderId}`
    });
  }

  return { success: true, order: updatedOrder, error: null };
}

export async function submitDirectPaymentProof(
  userId: string,
  orderIdOrNumber: string,
  senderNote: string,
  billingId?: string,
  orderPayload?: Partial<PaymentOrder>
): Promise<{ success: boolean; order?: PaymentOrder; error: string | null }> {
  let target: any = orderPayload;
  if (!target) {
    const orders = getLocalPaymentOrders(userId);
    target = orders.find(o => o.id === orderIdOrNumber || o.order_number === orderIdOrNumber);
  }

  if (!target) return { success: false, error: 'Data tagihan tidak ditemukan' };

  const canonicalPackageType =
    target.package_type === 'credit_pack' ? 'topup_credits' : target.package_type;

  const apiRes = await callBillingServerApi({
    action: 'submit_payment_proof',
    sender_note: senderNote,
    billing_id: billingId,
    order: {
      ...target,
      package_type: canonicalPackageType
    }
  });

  if (apiRes?.order) {
    const orders = getLocalPaymentOrders(userId);
    const existingIdx = orders.findIndex(
      o => o.order_number === apiRes.order.order_number || o.id === apiRes.order.id
    );
    const updatedList =
      existingIdx !== -1
        ? orders.map(o =>
            o.order_number === apiRes.order.order_number || o.id === apiRes.order.id
              ? apiRes.order
              : o
          )
        : [apiRes.order, ...orders];
    saveLocalPaymentOrders(userId, updatedList);

    if (apiRes.subscription) {
      saveLocalSubscription(userId, apiRes.subscription);
    }
    if (apiRes.transaction) {
      const currentTxs = getLocalCreditTransactions(userId);
      saveLocalCreditTransactions(userId, [apiRes.transaction, ...currentTxs]);
    }
    return { success: true, order: apiRes.order, error: null };
  }

  return simulateSettlePayment(userId, orderIdOrNumber);
}

export async function checkPaymentOrderStatus(
  userId: string,
  orderId: string
): Promise<{ success: boolean; order?: PaymentOrder; settled: boolean; error: string | null }> {
  const apiRes = await callBillingServerApi({
    action: 'check_order_status',
    order_id: orderId
  });

  if (apiRes?.order) {
    const orders = getLocalPaymentOrders(userId);
    const idx = orders.findIndex(o => o.id === orderId || o.order_number === apiRes.order.order_number);
    if (idx !== -1) {
      orders[idx] = apiRes.order;
      saveLocalPaymentOrders(userId, orders);
    }
    if (apiRes.subscription) {
      saveLocalSubscription(userId, apiRes.subscription);
    }
    const isSettled =
      apiRes.order.status === 'settlement' ||
      apiRes.order.status === 'completed' ||
      apiRes.order.status === 'paid';
    return { success: true, order: apiRes.order, settled: isSettled, error: null };
  }

  return { success: false, settled: false, error: 'Belum ada pembaruan status dari server.' };
}

export async function adminFetchAllBillingData(): Promise<{
  orders: Array<PaymentOrder & { user_display_name?: string; user_email?: string }>;
  transactions: Array<CreditTransaction & { user_display_name?: string; user_email?: string }>;
  profiles: Array<{ id: string; display_name: string; email: string; role: string }>;
  active_subscriptions_count: number;
} | null> {
  const apiRes = await callBillingServerApi({
    action: 'admin_list_data'
  });
  if (apiRes && Array.isArray(apiRes.orders)) {
    return {
      orders: apiRes.orders,
      transactions: apiRes.transactions || [],
      profiles: apiRes.profiles || [],
      active_subscriptions_count: apiRes.active_subscriptions_count || 0
    };
  }
  return null;
}

export async function adminApprovePaymentOrder(
  orderId: string
): Promise<{ success: boolean; order?: PaymentOrder; error: string | null }> {
  const apiRes = await callBillingServerApi({
    action: 'admin_approve_order',
    order_id: orderId
  });
  if (apiRes?.order) {
    return { success: true, order: apiRes.order, error: null };
  }
  return { success: false, error: 'Gagal menyetujui pesanan pembayaran.' };
}

export async function adminRejectPaymentOrder(
  orderId: string,
  reason: string
): Promise<{ success: boolean; order?: PaymentOrder; error: string | null }> {
  const apiRes = await callBillingServerApi({
    action: 'admin_reject_order',
    order_id: orderId,
    reason
  });
  if (apiRes?.order) {
    return { success: true, order: apiRes.order, error: null };
  }
  return { success: false, error: 'Gagal menolak pesanan pembayaran.' };
}

export async function adminAdjustCredits(
  userId: string,
  amount: number,
  reason: string
): Promise<{ success: boolean; error: string | null }> {
  const apiRes = await callBillingServerApi({
    action: 'admin_adjust',
    target_user_id: userId,
    amount,
    reason
  });
  if (apiRes?.transaction) {
    const currentTxs = getLocalCreditTransactions(userId);
    saveLocalCreditTransactions(userId, [apiRes.transaction, ...currentTxs]);
    return { success: true, error: null };
  }

  const result = await recordCreditTransaction(userId, {
    transaction_type: 'admin_adjustment',
    amount,
    provider: 'system',
    model: 'admin_console',
    operation: 'admin_manual_adjustment',
    estimated_cost_usd: 0,
    actual_cost_usd: 0,
    description: `Admin Adjustment: ${reason}`,
    status: 'completed',
    idempotency_key: `admin_${Date.now()}`
  });

  return { success: Boolean(result.data), error: result.error };
}

export async function fetchAdminFinancialAnalytics(payload: {
  action?: 'overview' | 'run_simulation';
  scenarioKey?: string;
  providerMode?: string;
  tierUsers?: Record<string, number>;
  startDate?: string;
  endDate?: string;
} = {}): Promise<any> {
  if (!isSupabaseConfigured || !supabase) return null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return null;
    const response = await fetch('/api/admin/financial-analytics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody?.message || errBody?.error || `HTTP ${response.status}`);
    }
    return await response.json();
  } catch (err) {
    console.warn('Admin financial analytics fetch error:', err);
    return null;
  }
}

// ==========================================
// Phase 7: Team Collaboration Workspaces (SSOT Section 42)
// ==========================================

const WORKSPACES_KEY = 'ai_movie_factory_workspaces_v2_prod';
const WORKSPACE_MEMBERS_KEY_PREFIX = 'ai_movie_factory_ws_members_v2_prod_';
const MARKETPLACE_TEMPLATES_KEY = 'ai_movie_factory_marketplace_templates_v2_prod';

function getLocalWorkspaces(userId: string): Workspace[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(`${WORKSPACES_KEY}_${userId}`);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('Failed to parse local workspaces', e);
    }
  }

  // Initial default personal workspace (1 seat for owner, 0 dummy collaborators)
  const defaultWorkspace: Workspace = {
    id: `ws-${userId}-default`,
    name: 'Primary Studio Workspace',
    owner_id: userId,
    seat_limit: 1,
    active_seats_count: 1,
    settings: {
      default_language: 'id',
      default_aspect_ratio: '16:9',
      allow_member_media_export: true,
      require_director_approval_for_render: false
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  saveLocalWorkspaces(userId, [defaultWorkspace]);
  return [defaultWorkspace];
}

function saveLocalWorkspaces(userId: string, workspaces: Workspace[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`${WORKSPACES_KEY}_${userId}`, JSON.stringify(workspaces));
}

function getLocalWorkspaceMembers(workspaceId: string, ownerId: string): WorkspaceMember[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(`${WORKSPACE_MEMBERS_KEY_PREFIX}${workspaceId}`);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('Failed to parse local workspace members', e);
    }
  }

  // Only the workspace owner — 0 fake dummy members
  const defaultMembers: WorkspaceMember[] = [
    {
      id: `member-${ownerId}`,
      workspace_id: workspaceId,
      user_id: ownerId,
      role: 'owner',
      invited_email: 'owner@aimoviefactory.id',
      status: 'active',
      joined_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    }
  ];

  saveLocalWorkspaceMembers(workspaceId, defaultMembers);
  return defaultMembers;
}

function saveLocalWorkspaceMembers(workspaceId: string, members: WorkspaceMember[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`${WORKSPACE_MEMBERS_KEY_PREFIX}${workspaceId}`, JSON.stringify(members));
}

export async function fetchWorkspaces(
  userId: string
): Promise<{ data: Workspace[]; error: string | null }> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('workspaces')
        .select('*')
        .eq('owner_id', userId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (data && data.length > 0) return { data, error: null };
    } catch (err: any) {
      console.warn('Supabase fetchWorkspaces error, fallback to local:', err);
    }
  }

  return { data: getLocalWorkspaces(userId), error: null };
}

export async function createWorkspaceRecord(
  userId: string,
  name: string,
  seatLimit = 5
): Promise<{ data: Workspace | null; error: string | null }> {
  const newWorkspace: Workspace = {
    id: `ws-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    name,
    owner_id: userId,
    seat_limit: seatLimit,
    active_seats_count: 1,
    settings: {
      default_language: 'id',
      default_aspect_ratio: '16:9',
      allow_member_media_export: true,
      require_director_approval_for_render: false
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('workspaces')
        .insert(newWorkspace)
        .select()
        .single();
      if (error) throw error;
      return { data, error: null };
    } catch (err: any) {
      console.warn('Supabase createWorkspace error, using local fallback:', err);
    }
  }

  const existing = getLocalWorkspaces(userId);
  const updated = [...existing, newWorkspace];
  saveLocalWorkspaces(userId, updated);

  // Initialize members with owner
  const ownerMember: WorkspaceMember = {
    id: `member-${userId}-${newWorkspace.id}`,
    workspace_id: newWorkspace.id,
    user_id: userId,
    role: 'owner',
    invited_email: 'owner@aimoviefactory.com',
    status: 'active',
    joined_at: new Date().toISOString(),
    created_at: new Date().toISOString()
  };
  saveLocalWorkspaceMembers(newWorkspace.id, [ownerMember]);

  return { data: newWorkspace, error: null };
}

export async function fetchWorkspaceMembers(
  workspaceId: string,
  ownerId: string
): Promise<{ data: WorkspaceMember[]; error: string | null }> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('workspace_members')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('role', { ascending: true });

      if (error) throw error;
      if (data && data.length > 0) return { data, error: null };
    } catch (err: any) {
      console.warn('Supabase fetchWorkspaceMembers error, fallback to local:', err);
    }
  }

  return { data: getLocalWorkspaceMembers(workspaceId, ownerId), error: null };
}

export async function inviteWorkspaceMember(
  workspaceId: string,
  ownerId: string,
  email: string,
  role: WorkspaceRole
): Promise<{ success: boolean; member?: WorkspaceMember; error: string | null }> {
  const members = getLocalWorkspaceMembers(workspaceId, ownerId);
  if (members.some(m => m.invited_email.toLowerCase() === email.toLowerCase())) {
    return { success: false, error: 'Member dengan email ini sudah ada di dalam workspace' };
  }

  const newMember: WorkspaceMember = {
    id: `member-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    workspace_id: workspaceId,
    role,
    invited_email: email,
    status: 'active',
    joined_at: new Date().toISOString(),
    created_at: new Date().toISOString()
  };

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('workspace_members')
        .insert(newMember)
        .select()
        .single();
      if (!error && data) {
        return { success: true, member: data, error: null };
      }
    } catch (err: any) {
      console.warn('Supabase inviteWorkspaceMember error, using local fallback:', err);
    }
  }

  const updated = [...members, newMember];
  saveLocalWorkspaceMembers(workspaceId, updated);

  // Update active count
  const allWorkspaces = getLocalWorkspaces(ownerId);
  const wsIdx = allWorkspaces.findIndex(w => w.id === workspaceId);
  if (wsIdx !== -1) {
    allWorkspaces[wsIdx].active_seats_count = updated.length;
    saveLocalWorkspaces(ownerId, allWorkspaces);
  }

  return { success: true, member: newMember, error: null };
}

export async function removeWorkspaceMember(
  workspaceId: string,
  ownerId: string,
  memberId: string
): Promise<{ success: boolean; error: string | null }> {
  const members = getLocalWorkspaceMembers(workspaceId, ownerId);
  const target = members.find(m => m.id === memberId);
  if (!target) return { success: false, error: 'Member tidak ditemukan' };
  if (target.role === 'owner') return { success: false, error: 'Owner workspace tidak dapat dihapus' };

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase
        .from('workspace_members')
        .delete()
        .eq('id', memberId);
    } catch (err: any) {
      console.warn('Supabase removeWorkspaceMember error:', err);
    }
  }

  const updated = members.filter(m => m.id !== memberId);
  saveLocalWorkspaceMembers(workspaceId, updated);

  // Update active count
  const allWorkspaces = getLocalWorkspaces(ownerId);
  const wsIdx = allWorkspaces.findIndex(w => w.id === workspaceId);
  if (wsIdx !== -1) {
    allWorkspaces[wsIdx].active_seats_count = updated.length;
    saveLocalWorkspaces(ownerId, allWorkspaces);
  }

  return { success: true, error: null };
}

// ==========================================
// Phase 7: Marketplace Templates (SSOT Section 42)
// ==========================================

function getLocalMarketplaceTemplates(): MarketplaceTemplate[] {
  if (typeof window === 'undefined') return INITIAL_MARKETPLACE_TEMPLATES;
  const stored = localStorage.getItem(MARKETPLACE_TEMPLATES_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('Failed to parse local marketplace templates', e);
    }
  }
  localStorage.setItem(MARKETPLACE_TEMPLATES_KEY, JSON.stringify(INITIAL_MARKETPLACE_TEMPLATES));
  return INITIAL_MARKETPLACE_TEMPLATES;
}

export async function fetchMarketplaceTemplates(
  category?: string
): Promise<{ data: MarketplaceTemplate[]; error: string | null }> {
  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase.from('marketplace_templates').select('*');
      if (category && category !== 'all') {
        query = query.eq('category', category);
      }
      const { data, error } = await query.order('downloads_count', { ascending: false });
      if (error) throw error;
      if (data && data.length > 0) return { data, error: null };
    } catch (err: any) {
      console.warn('Supabase fetchMarketplaceTemplates error, fallback to local:', err);
    }
  }

  const local = getLocalMarketplaceTemplates();
  if (category && category !== 'all') {
    return { data: local.filter(t => t.category === category), error: null };
  }
  return { data: local, error: null };
}

export async function cloneMarketplaceTemplateToProject(
  userId: string,
  templateId: string
): Promise<{ success: boolean; project?: Project; error: string | null }> {
  const templates = getLocalMarketplaceTemplates();
  const template = templates.find(t => t.id === templateId);
  if (!template) return { success: false, error: 'Template tidak ditemukan' };

  const content = template.content_data || {};
  const projectTitle = `${template.title} (Clone)`;
  const projectDesc = template.description;

  // Create Project Record
  const newProjectRes = await createProjectRecord(userId, {
    name: projectTitle,
    description: projectDesc,
    genre: (content.genre || 'Action') as string,
    production_format: (content.format || 'Feature film') as string,
    settings: {
      seasons_count: 1,
      episodes_count: 12,
      episode_duration_minutes: 2,
      scene_count_target: 36,
      aspect_ratio: '16:9',
      output_resolution: '1080p',
      frame_rate: '24fps',
      visual_style: template.visual_style || 'Cinematic High Fidelity',
      output_language: template.language || 'en',
      subtitle_language: 'id',
      voice_language: template.language || 'en',
      production_quality: 'cinematic',
      production_mode: 'ai_assisted',
      enabled_modules: ['world_builder', 'character_studio', 'story_script', 'storyboard', 'media_studio', 'production_pipeline'],
      enabled_agents: ['master_director', 'script_writer', 'storyboard_director'],
      human_approval_required: true,
      credit_budget: 1000
    }
  });

  if (!newProjectRes.project) {
    return { success: false, error: newProjectRes.error || 'Gagal mengklon proyek template' };
  }

  const project = newProjectRes.project;

  // Populate Story Bible if present
  if (content.bible_theme || content.bible_rules) {
    await saveWorldBibleRecord(project.id, {
      world_name: `${template.title} World`,
      synopsis: content.bible_theme || 'Cinematic world rules and universe lore.',
      rules_of_the_world: content.bible_rules || 'Established physical, technological, and magical constants.',
      magic_or_tech_system: 'Structured spiritual arts and metaphysical laws',
      historical_background: 'Ancient historical lineage and epic world lore.'
    });
  }

  // Populate Characters if present
  if (Array.isArray(content.characters)) {
    for (const char of content.characters) {
      await createCharacterRecord(project.id, {
        project_id: project.id,
        name: char.name || 'Hero',
        role: (char.role || 'protagonist') as any,
        age: '24',
        gender: 'Not specified',
        personality: char.personality_traits ? char.personality_traits.join(', ') : 'Determined, courageous',
        motivation: 'Pursuing mastery and destiny',
        background: 'Legendary lineage and cultivation training',
        physical_appearance: {
          face_structure: 'Defined features',
          eyes: 'Piercing dark eyes',
          hair: 'Long flowing dark hair',
          physique_height: 'Athletic, 180cm',
          distinguishing_features: 'Signature mark'
        },
        costume: {
          daily_attire: char.costume_notes || 'Iconic signature costume',
          battle_robes: 'Reinforced ceremonial battle armor',
          accessories_artifacts: 'Jade medallion talisman'
        },
        voice_characteristics: {
          pitch_tone: 'Confident baritone',
          speech_tempo: 'Deliberate and authoritative'
        },
        visual_consistency_prompt: char.visual_description || 'Detailed cinematic character portrait, 8k resolution',
        relationships: []
      });
    }
  }

  // Increment download count locally
  template.downloads_count += 1;
  const allTemplates = getLocalMarketplaceTemplates();
  const tIdx = allTemplates.findIndex(t => t.id === templateId);
  if (tIdx !== -1) {
    allTemplates[tIdx] = template;
    localStorage.setItem(MARKETPLACE_TEMPLATES_KEY, JSON.stringify(allTemplates));
  }

  return { success: true, project, error: null };
}

// ============================================================================
// Phase 11: Community Asset & Character Marketplace Packs (Character Studio)
// ============================================================================

const CHARACTER_MARKETPLACE_PACKS_KEY = 'ai_movie_factory_character_packs_v1';

function getLocalCharacterPacks(): MarketplaceCharacterPack[] {
  if (typeof window === 'undefined') return INITIAL_CHARACTER_MARKETPLACE_PACKS;
  const stored = localStorage.getItem(CHARACTER_MARKETPLACE_PACKS_KEY);
  if (stored) {
    try {
      const parsed: MarketplaceCharacterPack[] = JSON.parse(stored);
      // Ensure any new initial packs are merged in
      const existingIds = new Set(parsed.map(p => p.id));
      const merged = [
        ...parsed,
        ...INITIAL_CHARACTER_MARKETPLACE_PACKS.filter(ip => !existingIds.has(ip.id)),
      ];
      return merged;
    } catch (e) {
      console.error('Failed to parse local character marketplace packs', e);
    }
  }
  localStorage.setItem(
    CHARACTER_MARKETPLACE_PACKS_KEY,
    JSON.stringify(INITIAL_CHARACTER_MARKETPLACE_PACKS)
  );
  return INITIAL_CHARACTER_MARKETPLACE_PACKS;
}

function saveLocalCharacterPacks(packs: MarketplaceCharacterPack[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CHARACTER_MARKETPLACE_PACKS_KEY, JSON.stringify(packs));
}

export async function fetchCharacterMarketplacePacks(
  genre?: string
): Promise<{ data: MarketplaceCharacterPack[]; error: string | null }> {
  const localPacks = getLocalCharacterPacks();
  if (genre && genre !== 'all') {
    return {
      data: localPacks.filter(p => p.genre.toLowerCase().includes(genre.toLowerCase())),
      error: null,
    };
  }
  return { data: localPacks, error: null };
}

export async function importCharacterPackToProject(
  projectId: string,
  packId: string,
  specificCharacterId?: string
): Promise<{ imported: Character[]; packTitle: string; error: string | null }> {
  if (!projectId) {
    return { imported: [], packTitle: '', error: 'Pilih proyek tujuan terlebih dahulu.' };
  }

  const packs = getLocalCharacterPacks();
  const pack = packs.find(p => p.id === packId);
  if (!pack) {
    return { imported: [], packTitle: '', error: 'Paket karakter tidak ditemukan di Marketplace.' };
  }

  const targetSheets = specificCharacterId
    ? pack.characters.filter(c => c.id === specificCharacterId)
    : pack.characters;

  if (targetSheets.length === 0) {
    return { imported: [], packTitle: pack.title, error: 'Tidak ada karakter untuk diunduh.' };
  }

  const importedCharacters: Character[] = [];

  for (const sheet of targetSheets) {
    const res = await createCharacterRecord(projectId, {
      project_id: projectId,
      name: sheet.name,
      native_name: sheet.native_name || '',
      role: sheet.role,
      age: String(sheet.age),
      gender: sheet.gender,
      occupation_cultivation_level: sheet.occupation_cultivation_level,
      sect_or_faction: sheet.sect_or_faction || '',
      personality: sheet.personality,
      motivation: sheet.motivation,
      background: sheet.background,
      physical_appearance: {
        face_structure: sheet.physical_appearance?.face_structure || '',
        eyes: sheet.physical_appearance?.eyes || '',
        hair: sheet.physical_appearance?.hair || '',
        physique_height: sheet.physical_appearance?.physique_height || '',
        distinguishing_features: sheet.physical_appearance?.distinguishing_features || '',
      },
      costume: {
        daily_attire: sheet.costume?.daily_attire || '',
        battle_robes: sheet.costume?.battle_robes || '',
        accessories_artifacts: sheet.costume?.accessories_artifacts || '',
      },
      voice_characteristics: {
        pitch_tone: sheet.voice_characteristics?.pitch_tone || '',
        speech_tempo: sheet.voice_characteristics?.speech_tempo || '',
        voice_actor_reference: sheet.voice_characteristics?.voice_actor_reference || '',
      },
      visual_consistency_prompt: sheet.visual_consistency_prompt,
      relationships: [],
      avatar_url: sheet.avatar_url,
    });

    if (res.character) {
      importedCharacters.push(res.character);
    }
  }

  // Increment download counter
  const updatedPacks = packs.map(p =>
    p.id === packId ? { ...p, downloads_count: (p.downloads_count || 0) + 1 } : p
  );
  saveLocalCharacterPacks(updatedPacks);

  return {
    imported: importedCharacters,
    packTitle: pack.title,
    error: null,
  };
}

export async function publishCharacterPackToMarketplace(payload: {
  title: string;
  description: string;
  genre: string;
  author_name: string;
  tags: string[];
  credit_cost?: number;
  thumbnail_url?: string;
  characters: Character[];
}): Promise<{ pack: MarketplaceCharacterPack | null; error: string | null }> {
  if (!payload.title.trim()) {
    return { pack: null, error: 'Judul paket karakter wajib diisi.' };
  }
  if (!payload.characters || payload.characters.length === 0) {
    return { pack: null, error: 'Pilih minimal 1 karakter untuk dibagikan ke Marketplace.' };
  }

  const now = new Date().toISOString();
  const packId = `cpack_comm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const sheets: MarketplaceCharacterSheet[] = payload.characters.map((c, idx) => ({
    id: `csheet_${Date.now()}_${idx}`,
    name: c.name,
    native_name: c.native_name || '',
    role: c.role,
    age: Number(c.age) || 24,
    gender: c.gender || 'Pria',
    occupation_cultivation_level: c.occupation_cultivation_level || 'Master',
    sect_or_faction: c.sect_or_faction || '',
    personality: c.personality || '',
    motivation: c.motivation || '',
    background: c.background || '',
    physical_appearance: {
      face_structure: c.physical_appearance?.face_structure || 'Proporsional sinematik',
      eyes: c.physical_appearance?.eyes || 'Sorot mata ekspresif tajam',
      hair: c.physical_appearance?.hair || 'Rambut ditata sinematik',
      physique_height: c.physical_appearance?.physique_height || 'Proporsi atletis',
      distinguishing_features: c.physical_appearance?.distinguishing_features || '',
    },
    costume: {
      daily_attire: c.costume?.daily_attire || 'Busana khas karakter utama',
      battle_robes: c.costume?.battle_robes || 'Busana aksi / formal tempur',
      accessories_artifacts: c.costume?.accessories_artifacts || 'Artefak khas karakter',
    },
    voice_characteristics: {
      pitch_tone: c.voice_characteristics?.pitch_tone || 'Bariton / Sopran jernih sinematik',
      speech_tempo: c.voice_characteristics?.speech_tempo || 'Terukur dan ekspresif',
      voice_actor_reference: c.voice_characteristics?.voice_actor_reference || 'Cinema Voice Reference',
    },
    visual_consistency_prompt:
      c.visual_consistency_prompt ||
      `[Master Character Seed: ${c.name}, ${c.gender}, ${c.occupation_cultivation_level || 'hero'}, wearing ${c.costume?.daily_attire || 'signature attire'}, cinematic 8k]`,
    avatar_url: c.avatar_url,
  }));

  const newPack: MarketplaceCharacterPack = {
    id: packId,
    title: payload.title.trim(),
    description: payload.description.trim() || `Paket karakter komunitas (${sheets.length} karakter siap pakai lengkap dengan seed visual, kostum, dan profil suara).`,
    genre: payload.genre || 'Action / Fantasy',
    author_name: payload.author_name || 'Studio Creator',
    downloads_count: 1,
    rating: 5.0,
    reviews_count: 1,
    credit_cost: payload.credit_cost ?? 0,
    tags: payload.tags.length > 0 ? payload.tags : ['Character Pack', 'Visual Seed Ready', payload.genre || 'Custom'],
    thumbnail_url:
      payload.thumbnail_url ||
      'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&h=350&fit=crop',
    is_community_shared: true,
    characters: sheets,
    created_at: now,
  };

  const currentPacks = getLocalCharacterPacks();
  saveLocalCharacterPacks([newPack, ...currentPacks]);

  // Optionally sync metadata to Supabase marketplace_templates if configured
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('marketplace_templates').insert({
        id: packId,
        title: newPack.title,
        description: newPack.description,
        category: 'character_archetype',
        genre: newPack.genre,
        author_name: newPack.author_name,
        downloads_count: 1,
        rating: 5.0,
        reviews_count: 1,
        credit_cost: newPack.credit_cost,
        tags: newPack.tags,
        thumbnail_url: newPack.thumbnail_url,
        preview_data: {
          world_summary: newPack.description,
          characters_count: sheets.length,
          scenes_count: 0,
          target_languages: ['id', 'en'],
          characters: sheets,
        },
      });
    } catch (err) {
      // Non-fatal if RLS or schema restricts public insert
      console.warn('Marketplace cloud sync notice (stored locally):', err);
    }
  }

  return { pack: newPack, error: null };
}

// ============================================================================
// Phase 12: Supabase Storage Bucket Media Persistence (character-avatars & project-assets)
// ============================================================================

const STUDIO_STORAGE_BUCKETS_KEY = 'ai_movie_factory_storage_buckets_v1';

function getLocalBucketObjects(): StorageBucketObject[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(STUDIO_STORAGE_BUCKETS_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('Failed to parse local storage bucket objects', e);
    }
  }
  return [];
}

function saveLocalBucketObjects(objects: StorageBucketObject[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STUDIO_STORAGE_BUCKETS_KEY, JSON.stringify(objects));
  } catch (e) {
    console.warn('Local storage bucket quota reached, retaining latest 25 objects:', e);
    localStorage.setItem(STUDIO_STORAGE_BUCKETS_KEY, JSON.stringify(objects.slice(0, 25)));
  }
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof FileReader === 'undefined') {
      resolve(`data:${blob.type || 'image/png'};base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Gagal membaca berkas gambar lokal.'));
    reader.readAsDataURL(blob);
  });
}

export async function uploadToStudioBucket(
  bucket: StorageBucketName,
  projectId: string,
  fileOrPayload: File | Blob | { name: string; type: string; size?: number; dataUrl: string },
  customLabel?: string
): Promise<StorageUploadResult> {
  const safeProjectId = projectId || 'global-studio';
  const isRawObject = 'dataUrl' in fileOrPayload;
  const rawName = isRawObject
    ? fileOrPayload.name
    : (fileOrPayload as File).name || `${customLabel || 'asset'}.png`;
  const mimeType = fileOrPayload.type || 'image/png';
  const sizeBytes = isRawObject
    ? fileOrPayload.size || fileOrPayload.dataUrl.length
    : fileOrPayload.size || 0;

  // Validate size limit (10MB for character-avatars, 50MB for project-assets)
  const maxBytes = bucket === 'character-avatars' ? 10 * 1024 * 1024 : 50 * 1024 * 1024;
  if (sizeBytes > maxBytes) {
    return {
      url: null,
      bucket,
      path: '',
      storageMode: 'local_persist',
      error: `Ukuran berkas melebihi batas maksimum bucket ${bucket} (${Math.round(maxBytes / 1048576)} MB).`,
    };
  }

  const sanitizedName = rawName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${safeProjectId}/${Date.now()}_${sanitizedName}`;
  const now = new Date().toISOString();

  // 1. Attempt live Supabase Storage Bucket upload if configured and File/Blob is provided
  if (isSupabaseConfigured && supabase && !isRawObject) {
    try {
      const { error: uploadErr } = await supabase.storage
        .from(bucket)
        .upload(storagePath, fileOrPayload as Blob, {
          cacheControl: '3600',
          upsert: true,
          contentType: mimeType,
        });

      if (uploadErr) throw uploadErr;

      const { data: pubData } = supabase.storage.from(bucket).getPublicUrl(storagePath);
      const publicUrl = pubData?.publicUrl;

      if (publicUrl) {
        const objRecord: StorageBucketObject = {
          id: `stobj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          bucket,
          project_id: safeProjectId,
          path: storagePath,
          file_name: sanitizedName,
          mime_type: mimeType,
          size_bytes: sizeBytes,
          public_url: publicUrl,
          storage_mode: 'supabase_storage',
          created_at: now,
        };
        const current = getLocalBucketObjects();
        saveLocalBucketObjects([objRecord, ...current]);

        return {
          url: publicUrl,
          bucket,
          path: storagePath,
          storageMode: 'supabase_storage',
          objectRecord: objRecord,
          error: null,
        };
      }
    } catch (err: any) {
      console.warn(
        `Supabase Storage bucket (${bucket}) upload notice — falling back to persistent local bucket cache:`,
        err?.message || err
      );
    }
  }

  // 2. Dual-Layer / Local Persistent Bucket Cache Fallback
  try {
    const dataUrl = isRawObject
      ? fileOrPayload.dataUrl
      : await readBlobAsDataUrl(fileOrPayload as Blob);

    const objRecord: StorageBucketObject = {
      id: `stobj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      bucket,
      project_id: safeProjectId,
      path: storagePath,
      file_name: sanitizedName,
      mime_type: mimeType,
      size_bytes: sizeBytes,
      public_url: dataUrl,
      storage_mode: 'local_persist',
      created_at: now,
    };

    const current = getLocalBucketObjects();
    saveLocalBucketObjects([objRecord, ...current]);

    return {
      url: dataUrl,
      bucket,
      path: storagePath,
      storageMode: 'local_persist',
      objectRecord: objRecord,
      error: null,
    };
  } catch (err: any) {
    return {
      url: null,
      bucket,
      path: storagePath,
      storageMode: 'local_persist',
      error: err?.message || 'Gagal mengunggah berkas ke bucket penyimpanan.',
    };
  }
}

export async function uploadCharacterReferenceImage(
  projectId: string,
  fileOrPayload: File | Blob | { name: string; type: string; size?: number; dataUrl: string },
  characterName?: string
): Promise<StorageUploadResult> {
  return uploadToStudioBucket('character-avatars', projectId, fileOrPayload, characterName || 'char_ref');
}

export async function uploadProjectAssetToBucket(
  projectId: string,
  fileOrPayload: File | Blob | { name: string; type: string; size?: number; dataUrl: string },
  assetLabel?: string
): Promise<StorageUploadResult> {
  return uploadToStudioBucket('project-assets', projectId, fileOrPayload, assetLabel || 'project_asset');
}

export async function listStudioBucketObjects(
  bucket?: StorageBucketName,
  projectId?: string
): Promise<{ data: StorageBucketObject[]; error: string | null }> {
  let all = getLocalBucketObjects();
  if (bucket) {
    all = all.filter((o) => o.bucket === bucket);
  }
  if (projectId) {
    all = all.filter((o) => o.project_id === projectId);
  }
  return { data: all, error: null };
}

// ============================================================================
// PHASE 15: CREATOR MILESTONES & BUSINESS INTELLIGENCE PERSISTENCE
// ============================================================================

const LOCAL_STORAGE_CREATOR_MILESTONES_KEY = 'amf_creator_milestones_v1';

export function getLocalCreatorMilestones(userId?: string): CreatorMilestone[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CREATOR_MILESTONES_KEY);
    if (!raw) return [];
    const list: CreatorMilestone[] = JSON.parse(raw);
    if (userId) {
      return list.filter((m) => m.user_id === userId);
    }
    return list;
  } catch {
    return [];
  }
}

export function saveLocalCreatorMilestones(milestones: CreatorMilestone[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_CREATOR_MILESTONES_KEY, JSON.stringify(milestones));
  } catch (err) {
    console.warn('Failed to save local creator milestones:', err);
  }
}

export async function fetchCreatorMilestones(userId: string): Promise<{ data: CreatorMilestone[]; error: string | null }> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('creator_milestones')
        .select('*')
        .eq('user_id', userId)
        .order('release_date', { ascending: false });

      if (!error && data) {
        return { data: data as CreatorMilestone[], error: null };
      }
    } catch (err: any) {
      console.warn('Supabase fetchCreatorMilestones failed, using local cache:', err);
    }
  }

  const localList = getLocalCreatorMilestones(userId);
  return { data: localList, error: null };
}

export async function createCreatorMilestone(
  milestone: Omit<CreatorMilestone, 'id' | 'created_at'>
): Promise<{ data: CreatorMilestone | null; error: string | null }> {
  const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `milestone-${Date.now()}`;
  const now = new Date().toISOString();
  const newRecord: CreatorMilestone = {
    ...milestone,
    id: newId,
    created_at: now,
    updated_at: now,
  };

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('creator_milestones')
        .insert(newRecord)
        .select()
        .single();

      if (error) {
        return { data: null, error: error.message };
      }
      if (data) {
        const all = getLocalCreatorMilestones();
        saveLocalCreatorMilestones([data as CreatorMilestone, ...all]);
        return { data: data as CreatorMilestone, error: null };
      }
    } catch (err: any) {
      return { data: null, error: err.message || 'Gagal menyimpan milestone ke basis data' };
    }
  }

  const all = getLocalCreatorMilestones();
  const updated = [newRecord, ...all];
  saveLocalCreatorMilestones(updated);
  return { data: newRecord, error: null };
}

export async function deleteCreatorMilestone(milestoneId: string): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('creator_milestones').delete().eq('id', milestoneId);
    } catch (err) {
      console.warn('Supabase deleteCreatorMilestone failed:', err);
    }
  }

  const all = getLocalCreatorMilestones();
  const filtered = all.filter((m) => m.id !== milestoneId);
  saveLocalCreatorMilestones(filtered);
  return true;
}

// ============================================================================
// PHASE 15 SPRINT 3: CREATOR MEDIA KIT & COMMERCIAL PROPOSAL SETTINGS
// ============================================================================

const LOCAL_STORAGE_MEDIA_KIT_PREFIX = 'amf_creator_media_kit_settings_v1_';

export function getLocalMediaKitSettings(userId: string): CreatorMediaKitSettings | null {
  if (typeof window === 'undefined' || !userId) return null;
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_MEDIA_KIT_PREFIX}${userId}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveLocalMediaKitSettings(userId: string, settings: CreatorMediaKitSettings): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    localStorage.setItem(`${LOCAL_STORAGE_MEDIA_KIT_PREFIX}${userId}`, JSON.stringify(settings));
  } catch (err) {
    console.warn('Failed to save local media kit settings:', err);
  }
}

export async function fetchCreatorMediaKitSettings(
  userId: string,
  fallbackDefaults?: Partial<CreatorMediaKitSettings>
): Promise<{ data: CreatorMediaKitSettings; error: string | null }> {
  const defaults: CreatorMediaKitSettings = {
    user_id: userId,
    studio_name: fallbackDefaults?.studio_name || 'AMF Film Studio',
    bio: fallbackDefaults?.bio || 'Kreator film independen bertenaga AI generasi baru, memproduksi konten naratif sinematik 4K berkualitas layar lebar.',
    contact_email: fallbackDefaults?.contact_email || 'creator@aimoviefactory.com',
    contact_phone: fallbackDefaults?.contact_phone || '+62 812-3456-7890',
    primary_niche: fallbackDefaults?.primary_niche || 'Sci-Fi Cyberpunk & Misteri Folklor',
    location: fallbackDefaults?.location || 'Indonesia (Global Remote Production)',
    rate_card_tier1: fallbackDefaults?.rate_card_tier1 || 2500000,
    rate_card_tier2: fallbackDefaults?.rate_card_tier2 || 5000000,
    rate_card_tier3: fallbackDefaults?.rate_card_tier3 || 12500000,
    custom_pitch_hook: fallbackDefaults?.custom_pitch_hook || 'Menghadirkan penempatan merek yang memikat secara alami ke dalam alur cerita film sinematik AI beresolusi 4K.',
    is_public: fallbackDefaults?.is_public ?? false,
    share_phone: fallbackDefaults?.share_phone ?? false,
    share_email: fallbackDefaults?.share_email ?? true,
    updated_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('creator_media_kits')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!error && data) {
        return { data: { ...defaults, ...data }, error: null };
      }
    } catch (err: any) {
      console.warn('Supabase fetchCreatorMediaKitSettings failed, using local/defaults:', err);
    }
  }

  const local = getLocalMediaKitSettings(userId);
  if (local) {
    return { data: { ...defaults, ...local }, error: null };
  }

  return { data: defaults, error: null };
}

export async function saveCreatorMediaKitSettings(
  settings: CreatorMediaKitSettings
): Promise<{ data: CreatorMediaKitSettings | null; error: string | null }> {
  const updated = {
    ...settings,
    updated_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('creator_media_kits')
        .upsert(updated, { onConflict: 'user_id' })
        .select()
        .single();

      if (error) {
        return { data: null, error: error.message };
      }
      if (data) {
        saveLocalMediaKitSettings(settings.user_id, data as CreatorMediaKitSettings);
        return { data: data as CreatorMediaKitSettings, error: null };
      }
    } catch (err: any) {
      return { data: null, error: err.message || 'Gagal menyimpan ke Supabase Cloud' };
    }
  }

  saveLocalMediaKitSettings(settings.user_id, updated);
  return { data: updated, error: null };
}
