/**
 * Database & Domain Types for AI Movie Factory
 * Strictly aligned with SSOT Sections 4, 8, 9, 12, 49, and 50
 */

export type LanguageCode = 'id' | 'en' | 'zh' | 'ja' | 'es';

export type ProductionStatus = 
  | 'draft'
  | 'in_development'
  | 'in_production'
  | 'post_production'
  | 'completed'
  | 'archived';

export type ProductionMode = 
  | 'manual'
  | 'ai_assisted'
  | 'semi_automated'
  | 'fully_automated';

export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:5' | 'custom';

export type OutputResolution = '720p' | '1080p' | '2K' | '4K';
export type FrameRate = '24fps' | '30fps' | '60fps';

export interface UserProfile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  preferred_language: LanguageCode;
  email?: string;
  role?: string;
  credits_balance?: number;
  subscription_tier?: SubscriptionTier;
  created_at: string;
  updated_at: string;
}

export interface ProjectSettings {
  seasons_count: number;
  episodes_count: number;
  episode_duration_minutes: number;
  scene_count_target: number;
  target_runtime_minutes?: number;
  aspect_ratio: AspectRatio;
  custom_aspect_ratio?: string;
  output_resolution: OutputResolution;
  frame_rate: FrameRate;
  visual_style: string;
  animation_style?: string;
  output_language: string;
  subtitle_language: string;
  voice_language: string;
  production_quality: 'standard' | 'high' | 'cinematic';
  production_mode: ProductionMode;
  enabled_modules: string[];
  enabled_agents: string[];
  human_approval_required: boolean;
  credit_budget: number;
  gate5_approved?: boolean;
  gate5_approved_at?: string;
  gate5_approved_by?: string;
  gate5_review_notes?: string;
  gate5_fingerprint?: string;
}

export interface ProjectSettingsRecord {
  id: string;
  project_id: string;
  settings: ProjectSettings;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string;
  genre: string;
  custom_genre: string | null;
  production_format: string;
  status: ProductionStatus;
  thumbnail_url?: string;
  workspace_id?: string | null;
  settings?: ProjectSettings;
  created_at: string;
  updated_at: string;
  is_demo?: boolean;
}

export interface CreateProjectPayload {
  name: string;
  description: string;
  genre: string;
  custom_genre?: string;
  production_format: string;
  settings: ProjectSettings;
}

export interface DashboardMetrics {
  totalProjects: number;
  totalEpisodes: number;
  totalScenes: number;
  activeAgents: number;
  availableCredits: number;
  creditConsumption: number;
  jobsProcessing: number;
  failedJobs: number;
  productionProgressPercentage: number;
}

export interface ProductionActivity {
  id: string;
  project_id: string;
  project_name: string;
  activity_type: string;
  description: string;
  timestamp: string;
  status: 'completed' | 'in_progress' | 'pending' | 'failed';
}

export interface ProductionJob {
  id: string;
  project_id: string;
  project_name: string;
  task_name: string;
  agent_name: string;
  progress: number;
  status: 'pending' | 'queued' | 'running' | 'awaiting_approval' | 'completed' | 'failed' | 'cancelled';
  started_at: string;
}

// ============================================================================
// PHASE 2: WORLD BUILDER TYPES (SSOT Section 8)
// ============================================================================

export interface CultivationRealm {
  id: string;
  name: string;
  level_order: number;
  description: string;
  advancement_requirements?: string;
  powers_abilities?: string;
}

export interface FactionOrSect {
  id: string;
  name: string;
  type: 'sect' | 'clan' | 'kingdom' | 'corporation' | 'syndicate' | 'other';
  alignment: 'righteous' | 'demonic' | 'neutral' | 'chaotic';
  leader?: string;
  headquarters?: string;
  description: string;
  specialties?: string;
}

export interface LocationEntry {
  id: string;
  name: string;
  region: string;
  terrain_climate: string;
  description: string;
  controlling_faction?: string;
  danger_level?: 'peaceful' | 'moderate' | 'perilous' | 'forbidden';
  is_approved?: boolean;
  approval_status?: 'draft' | 'approved';
  approved_at?: string;
  approved_by?: string;
  visual_reference_url?: string;
}

export interface TimelineEvent {
  id: string;
  era: string;
  year_or_time: string;
  title: string;
  description: string;
  significance: string;
}

export interface WorldBible {
  id: string;
  project_id: string;
  world_name: string;
  synopsis: string;
  historical_background: string;
  rules_of_the_world: string;
  magic_or_tech_system: string;
  spiritual_energy_rules?: string;
  cultivation_realms: CultivationRealm[];
  factions: FactionOrSect[];
  locations: LocationEntry[];
  timeline: TimelineEvent[];
  reference_notes?: string;
  is_approved?: boolean;
  approval_status?: 'draft' | 'approved';
  approved_at?: string;
  approved_by?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// PHASE 2: CHARACTER STUDIO TYPES (SSOT Section 9)
// ============================================================================

export type CharacterRole = 'protagonist' | 'antagonist' | 'supporting' | 'mentor' | 'recurring';

export interface CharacterRelationship {
  id: string;
  target_character_id: string;
  target_character_name: string;
  relation_type: string;
  description: string;
}

export interface CharacterPhysicalAppearance {
  face_structure: string;
  eyes: string;
  hair: string;
  physique_height: string;
  distinguishing_features: string;
}

export interface CharacterCostume {
  daily_attire: string;
  battle_robes: string;
  accessories_artifacts: string;
}

export interface CharacterVoice {
  pitch_tone: string;
  speech_tempo: string;
  voice_actor_reference?: string;
}

export interface Character {
  id: string;
  project_id: string;
  name: string;
  native_name?: string;
  role: CharacterRole;
  age: string;
  gender: string;
  occupation_cultivation_level?: string;
  sect_or_faction?: string;
  personality: string;
  motivation: string;
  background: string;
  physical_appearance: CharacterPhysicalAppearance;
  costume: CharacterCostume;
  voice_characteristics: CharacterVoice;
  visual_consistency_prompt: string;
  relationships: CharacterRelationship[];
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// PHASE 2 (PART B): STORY & SCRIPT TYPES (SSOT Section 10, 11, 38)
// ============================================================================

export type NarrativeStructure =
  | 'three_act'
  | 'kishotenketsu'
  | 'five_act'
  | 'heros_journey'
  | 'danmei_tension'
  | 'custom';

export interface StoryConcept {
  id: string;
  project_id: string;
  logline: string;
  synopsis: string;
  theme: string;
  narrative_structure: NarrativeStructure;
  narrative_structure_custom?: string;
  tone_style: string;
  target_audience: string;
  created_at: string;
  updated_at: string;
}

export interface Season {
  id: string;
  project_id: string;
  season_number: number;
  title: string;
  synopsis: string;
  target_episodes: number;
  status: 'planned' | 'in_development' | 'in_production' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface Episode {
  id: string;
  project_id: string;
  season_id: string;
  episode_number: number;
  title: string;
  logline: string;
  synopsis: string;
  target_runtime_minutes: number;
  scene_count_target: number;
  status: 'draft' | 'outline' | 'scripted' | 'approved' | 'in_production';
  created_at: string;
  updated_at: string;
}

export type ScriptBlockType = 'action' | 'dialogue' | 'parenthetical' | 'transition';

export interface ScriptBlock {
  id: string;
  type: ScriptBlockType;
  character_id?: string;
  character_name?: string;
  text: string;
  delivery_note?: string;
}

export type SceneApprovalStatus = 'draft' | 'in_review' | 'approved' | 'revision_requested';

export interface ScriptVersion {
  id: string;
  scene_id: string;
  version_number: number;
  changelog_note: string;
  blocks: ScriptBlock[];
  created_at: string;
  created_by?: string;
}

export interface SceneItem {
  id: string;
  project_id: string;
  episode_id: string;
  scene_number: number;
  title: string;
  slugline: string;
  int_ext: 'INT' | 'EXT' | 'INT/EXT';
  location_name: string;
  time_of_day: 'DAY' | 'NIGHT' | 'DUSK' | 'DAWN' | 'CONTINUOUS';
  synopsis: string;
  emotional_beat: string;
  character_ids: string[];
  characters_present: string[];
  blocks: ScriptBlock[];
  visual_continuity_seed?: string;
  camera_notes?: string;
  audio_sound_notes?: string;
  approval_status: SceneApprovalStatus;
  approved_at?: string;
  approved_by?: string;
  estimated_duration_seconds: number;
  versions_count: number;
  created_at: string;
  updated_at: string;
}

export type Scene = SceneItem;
export type ScreenplayBlock = ScriptBlock;

// ============================================================================
// PHASE 3: AI AGENT SYSTEM TYPES (SSOT Sections 12, 13, 38)
// ============================================================================

export type AgentRole =
  | 'master_director'
  | 'world_builder_agent'
  | 'story_architect'
  | 'script_writer'
  | 'character_designer'
  | 'cultivation_agent'
  | 'fight_choreographer'
  | 'storyboard_director'
  | 'cinematographer'
  | 'image_gen_agent'
  | 'video_gen_agent'
  | 'voice_agent'
  | 'editor_agent'
  | 'qc_agent';

export type AgentCategory = 'direction' | 'writing' | 'visual' | 'audio' | 'qc';

export interface AgentDefinition {
  id: string;
  role: AgentRole;
  name: string;
  title: string;
  category: AgentCategory;
  default_model: string;
  description: string;
  system_prompt: string;
  responsibilities: string[];
  inputs: string[];
  outputs: string[];
  suggested_credit_cost: number;
}

export interface AgentProjectConfig {
  id: string;
  project_id: string;
  agent_role: AgentRole;
  agent_name: string;
  enabled: boolean;
  selected_model: string;
  custom_instructions: string;
  credit_limit_per_run: number;
  requires_approval: boolean;
  execution_priority: number;
  total_runs: number;
  total_credits_used: number;
  updated_at: string;
}

export type AgentTaskStatus =
  | 'queued'
  | 'running'
  | 'awaiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface AgentTask {
  id: string;
  project_id: string;
  workflow_type: string;
  task_name: string;
  agent_role: AgentRole;
  agent_name: string;
  status: AgentTaskStatus;
  progress: number;
  input_params: Record<string, any>;
  output_result?: Record<string, any>;
  error_message?: string;
  requires_human_approval: boolean;
  is_approved: boolean;
  approved_by?: string;
  approved_at?: string;
  dependencies: string[];
  execution_time_seconds: number;
  credits_consumed: number;
  started_at: string;
  completed_at?: string;
}

export type AgentLogLevel = 'info' | 'reasoning' | 'action' | 'approval_required' | 'success' | 'error';

export interface AgentExecutionLog {
  id: string;
  task_id: string;
  project_id: string;
  agent_role: AgentRole;
  agent_name: string;
  level: AgentLogLevel;
  message: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface WorkflowExecutionPlan {
  id: string;
  name: string;
  description: string;
  workflow_key: 'script_generation' | 'character_audit' | 'storyboard_construction' | 'fight_choreography';
  agent_sequence: AgentRole[];
  estimated_credits: number;
  estimated_runtime_seconds: number;
}

// ============================================================================
// PHASE 4: MEDIA GENERATION & ASSET LIBRARY TYPES (SSOT Sections 13, 18, 39)
// ============================================================================

export type AssetType = 'image' | 'video' | 'voice' | 'audio';

export type AssetSubtype =
  | 'character_portrait'
  | 'environment_landscape'
  | 'storyboard_frame'
  | 'concept_art'
  | 'poster'
  | 'scene_reference'
  | 'image_to_video'
  | 'text_to_video'
  | 'action_sequence'
  | 'camera_motion'
  | 'character_dialogue'
  | 'narration'
  | 'voice_profile_sample'
  | 'background_music'
  | 'sound_effect'
  | 'ambient_sound';

export type MediaProviderId =
  | 'google_gemini'
  | 'runway_gen3'
  | 'kling_ai'
  | 'elevenlabs'
  | 'suno_audio';

export type AssetGenerationStatus = 'queued' | 'generating' | 'completed' | 'failed';

export type AssetApprovalStatus = 'draft' | 'in_review' | 'approved' | 'rejected';

export interface MediaGenerationParams {
  aspect_ratio?: '16:9' | '9:16' | '1:1' | '21:9' | '4:3';
  resolution?: '720p' | '1080p' | '4K';
  duration_seconds?: number;
  seed?: number;
  camera_motion?: 'pan_left' | 'pan_right' | 'tilt_up' | 'tilt_down' | 'zoom_in' | 'zoom_out' | 'orbital' | 'static';
  motion_intensity?: number;
  negative_prompt?: string;
  reference_image_url?: string;
  voice_id?: string;
  language?: string;
  tempo?: number;
  emotion_tag?: string;
  music_genre?: string;
  instrumentation?: string;
}

export interface MediaAsset {
  id: string;
  project_id: string;
  episode_id?: string;
  scene_id?: string;
  character_id?: string;
  asset_name: string;
  asset_type: AssetType;
  subtype: AssetSubtype;
  provider: MediaProviderId;
  model: string;
  prompt: string;
  generation_params: MediaGenerationParams;
  status: AssetGenerationStatus;
  credit_cost: number;
  file_url: string;
  thumbnail_url?: string;
  version: number;
  approval_status: AssetApprovalStatus;
  approved_by?: string;
  approved_at?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface MediaGenerationRequest {
  projectId: string;
  episodeId?: string;
  sceneId?: string;
  characterId?: string;
  assetName: string;
  assetType: AssetType;
  subtype: AssetSubtype;
  provider: MediaProviderId;
  model: string;
  prompt: string;
  params: MediaGenerationParams;
}

// ============================================================================
// PHASE 5: PRODUCTION PIPELINE & QC TYPES (SSOT Sections 14, 15, 40)
// ============================================================================

export type PipelineStage =
  | 'script_prep'
  | 'image_gen'
  | 'video_gen'
  | 'voice_audio'
  | 'qc_audit'
  | 'user_approval'
  | 'final_assembly'
  | 'export_ready';

export type PipelineJobStatus =
  | 'queued'
  | 'running'
  | 'awaiting_approval'
  | 'completed'
  | 'failed'
  | 'paused'
  | 'cancelled'
  | 'reconciliation_required';

export type PipelineJobPriority = 'low' | 'normal' | 'high' | 'urgent';

export type QCCheckStatus = 'passed' | 'warning' | 'failed';
export type QCEvaluationMode = 'auto_ai' | 'technical_rule' | 'director_manual';
export type QCSeverity = 'critical_blocker' | 'warning_advisory';
export type QCVerificationSource = 'rule_deterministic' | 'director_signoff' | 'ai_heuristic' | 'pending_live_service';

export type QCPillarCategory =
  // SSOT Section 8: 15 Mandatory Quality Parameters
  | 'facial_consistency'
  | 'costume_continuity'
  | 'environment_consistency'
  | 'lighting_continuity'
  | 'action_continuity'
  | 'anatomy_glitch_detection'
  | 'camera_motion_smoothness'
  | 'lip_sync_accuracy'
  | 'dialogue_clarity'
  | 'audio_mix_balance'
  | 'music_mood_alignment'
  | 'editing_pace_timing'
  | 'aspect_ratio_conformance'
  | 'loudness_compliance'
  | 'export_format_subtitles'
  // Backward-compatibility aliases
  | 'character_consistency'
  | 'story_continuity'
  | 'dialogue_consistency'
  | 'scene_order'
  | 'visual_quality'
  | 'audio_quality'
  | 'aspect_ratio'
  | 'output_resolution'
  | 'missing_assets'
  | 'production_completeness';

export type QCApprovalState = 'draft' | 'submitted' | 'approved' | 'rejected' | 'revision_required';

export interface QCCheckItem {
  id: string;
  check_name: string;
  category: 'visual_continuity' | 'audio_sync' | 'narrative_lore' | 'technical_specs' | QCPillarCategory;
  status: QCCheckStatus;
  score: number;
  details: string;
  recommendation?: string;
  pillar?: QCPillarCategory;
  evaluation_mode?: QCEvaluationMode;
  severity?: QCSeverity;
  verification_source?: QCVerificationSource;
  evidence_basis?: string;
  overridden?: boolean;
  override_reason?: string;
  overridden_by?: string;
  overridden_at?: string;
}

export interface QCReport {
  id: string;
  overall_score: number;
  status: 'passed' | 'warning' | 'failed';
  summary: string;
  checks: QCCheckItem[];
  audited_at: string;
  audited_by_agent: string;
}

export interface QCComprehensiveAudit {
  id: string;
  project_id: string;
  audit_title: string;
  overall_score: number;
  readiness_status: 'passed' | 'warning' | 'failed';
  summary: string;
  audited_at: string;
  audited_by_agent: string;
  checks: QCCheckItem[];
  missing_assets_count: number;
  critical_issues_count: number;
  recommendations: string[];
}

export interface ApprovalEntityItem {
  id: string;
  project_id: string;
  entity_type: 'character' | 'story_concept' | 'script' | 'storyboard' | 'image' | 'video' | 'voice' | 'audio' | 'scene' | 'export_package';
  entity_id: string;
  title: string;
  subtitle?: string;
  version: string | number;
  approval_status: QCApprovalState;
  submitted_by?: string;
  submitted_at?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
  thumbnail_url?: string;
}

export interface PipelineJob {
  id: string;
  project_id: string;
  episode_id?: string;
  scene_id?: string;
  job_title: string;
  current_stage: PipelineStage;
  status: PipelineJobStatus;
  priority: PipelineJobPriority;
  progress: number;
  stages_completed: PipelineStage[];
  qc_report?: QCReport;
  generated_asset_ids: string[];
  credit_cost: number;
  error_message?: string;
  retry_count?: number;
  max_retries?: number;
  idempotency_key?: string;
  is_approved: boolean;
  approved_by?: string;
  approved_at?: string;
  started_at: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface PipelineJobLog {
  id: string;
  job_id: string;
  project_id: string;
  stage: PipelineStage;
  level: 'info' | 'action' | 'warning' | 'error' | 'success';
  message: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface ExportPackage {
  id: string;
  project_id: string;
  episode_id?: string;
  scene_id?: string;
  package_title: string;
  format: 'mp4' | 'prores' | 'webm';
  resolution: '1080p' | '4K';
  framerate: '24fps' | '30fps' | '60fps';
  audio_channels: 'Stereo 2.0' | 'Surround 5.1';
  include_subtitles: boolean;
  subtitle_format: 'srt' | 'vtt';
  subtitles_content?: string;
  file_url: string;
  file_size_mb: number;
  status: 'ready' | 'packaging' | 'failed';
  created_at: string;
}

// ============================================================================
// PHASE 6: COMMERCIAL SAAS & MONETIZATION TYPES (SSOT Sections 21, 22, 23, 41)
// ============================================================================

export type SubscriptionTier = 'free' | 'creator' | 'pro_studio' | 'production_house';
export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'trialing';
export type BillingCycle = 'monthly' | 'yearly';

export interface SubscriptionPlan {
  id: string;
  tier: SubscriptionTier;
  name: string;
  tagline: string;
  monthlyPriceIdr: number;
  yearlyPriceIdr: number;
  monthlyCredits: number;
  maxResolution: string;
  maxConcurrentJobs: number;
  features: string[];
  recommended?: boolean;
}

export interface UserSubscription {
  id: string;
  user_id: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  billing_cycle: BillingCycle;
  price_paid: number;
  currency: string;
  credits_allotted: number;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  payment_provider: 'midtrans' | 'stripe';
  payment_method: string;
  created_at: string;
  updated_at: string;
}

export type CreditTransactionType =
  | 'purchase'
  | 'usage'
  | 'refund'
  | 'monthly_allotment'
  | 'admin_adjustment';

export interface CreditTransaction {
  id: string;
  user_id: string;
  project_id?: string;
  job_id?: string;
  transaction_type: CreditTransactionType;
  amount: number;
  balance_after: number;
  provider?: string;
  model?: string;
  operation: string;
  estimated_cost_usd: number;
  actual_cost_usd: number;
  description: string;
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  idempotency_key?: string;
  created_at: string;
}

export interface CreditTopUpPack {
  id: string;
  name: string;
  credits: number;
  bonusCredits: number;
  priceIdr: number;
  popular?: boolean;
}

export type IndonesianPaymentMethod =
  | 'qris'
  | 'bca_va'
  | 'mandiri_va'
  | 'bni_va'
  | 'bri_va'
  | 'gopay'
  | 'shopeepay'
  | 'dana'
  | 'ovo'
  | 'credit_card';

export interface PaymentOrder {
  id: string;
  user_id: string;
  order_number: string;
  package_type: 'subscription' | 'topup_credits' | 'credit_pack';
  package_id: string;
  package_name: string;
  amount: number;
  currency: string;
  payment_gateway: 'midtrans' | 'stripe';
  payment_method: IndonesianPaymentMethod;
  status: 'pending' | 'processing' | 'completed' | 'settlement' | 'paid' | 'expire' | 'failed' | 'cancel' | 'cancelled';
  credits_granted: number;
  external_reference?: string;
  paid_at?: string;
  created_at: string;
}

export interface PlatformRevenueMetrics {
  mrrIdr: number;
  totalCreditsSold: number;
  totalCreditsConsumed: number;
  totalApiCostUsd: number;
  grossMarginPercent: number;
  activeSubscribers: number;
  activeJobsRunning: number;
}

// ============================================================================
// PHASE 7: GLOBAL EXPANSION, WORKSPACES & MARKETPLACE (SSOT Section 42)
// ============================================================================

export type CurrencyCode = 'IDR' | 'USD' | 'CNY' | 'JPY' | 'EUR';

export type WorkspaceRole = 'owner' | 'director' | 'writer' | 'reviewer';

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id?: string;
  email?: string;
  invited_email: string;
  display_name?: string;
  role: WorkspaceRole;
  avatar_url?: string;
  status: 'active' | 'pending' | 'suspended';
  joined_at?: string;
  created_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  tier?: SubscriptionTier;
  seat_limit: number;
  max_seats?: number;
  active_seats_count: number;
  current_seats?: number;
  settings: {
    default_language?: string;
    default_aspect_ratio?: string;
    allow_member_media_export?: boolean;
    require_director_approval_for_render?: boolean;
    [key: string]: any;
  };
  members?: WorkspaceMember[];
  created_at: string;
  updated_at: string;
}

export interface WorkspaceInvite {
  id: string;
  workspace_id: string;
  email: string;
  role: WorkspaceRole;
  invited_by: string;
  status: 'pending' | 'accepted' | 'expired';
  expires_at: string;
  created_at: string;
}

export type MarketplaceCategory =
  | 'universe_bible'
  | 'character_pack'
  | 'workflow_pipeline'
  | 'screenplay_arc';

export interface MarketplaceTemplate {
  id: string;
  title: string;
  description: string;
  category: MarketplaceCategory;
  genre?: string;
  author_id?: string;
  author_name: string;
  author_avatar?: string;
  is_official?: boolean;
  language?: string;
  downloads_count: number;
  rating: number;
  reviews_count?: number;
  credit_cost?: number;
  tags: string[];
  visual_style?: string;
  thumbnail_url?: string;
  content_data?: {
    genre?: string;
    format?: string;
    aspect_ratio?: string;
    bible_theme?: string;
    bible_rules?: string;
    characters?: any[];
    [key: string]: any;
  };
  preview_data?: {
    world_summary?: string;
    realms_count?: number;
    characters_count?: number;
    scenes_count?: number;
    sample_dialogue?: string;
    target_languages?: string[];
  };
  created_at: string;
  updated_at?: string;
}

export interface MultilingualScriptTranslation {
  language: 'zh' | 'ja' | 'ko' | 'th' | 'ar' | 'es' | 'en' | 'id';
  language_name?: string;
  target_language_name: string;
  translated_title: string;
  translated_slugline: string;
  translated_blocks: ScriptBlock[];
  blocks?: {
    id: string;
    type: 'action' | 'dialogue' | 'parenthetical' | 'transition';
    speaker?: string;
    translated_text: string;
    cultural_notes?: string;
  }[];
  cultural_notes: string[];
}

// ============================================================================
// PHASE 9: TIMELINE EDITING, POST-PRODUCTION & PUBLISHING (SSOT Section 5 & 14)
// ============================================================================

export type TimelineTrackType = 'video' | 'voice' | 'music' | 'sfx' | 'overlay';
export type TransitionType = 'none' | 'hard_cut' | 'cross_dissolve' | 'fade_black' | 'fade_white' | 'wipe_left';
export type ColorGradeLut = 'none' | 'xianxia_ethereal' | 'cyberpunk_neon' | 'film_noir' | 'golden_warmth' | 'kodak_vintage';
export type PublishingPlatformPreset = 'youtube_16_9' | 'tiktok_reels_9_16' | 'cinemascope_2_39' | 'web_drama_4_5';

export interface TimelineClip {
  id: string;
  track: TimelineTrackType;
  title: string;
  asset_id?: string;
  scene_id?: string;
  start_time: number; // in seconds
  duration: number; // in seconds
  source_url?: string;
  volume?: number; // 0.0 to 1.0
  transition_in?: TransitionType;
  transition_duration?: number; // in seconds
  text_overlay?: string;
  speaker?: string;
}

export interface TimelineSequence {
  id: string;
  project_id: string;
  episode_id?: string;
  title: string;
  color_grade_lut: ColorGradeLut;
  aspect_ratio: AspectRatio;
  resolution: OutputResolution;
  target_platform: PublishingPlatformPreset;
  clips: TimelineClip[];
  total_duration: number;
  is_locked?: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// PHASE 11: COMMUNITY ASSET & CHARACTER MARKETPLACE PACKS
// ============================================================================

export interface MarketplaceCharacterSheet {
  id: string;
  name: string;
  native_name?: string;
  role: CharacterRole;
  age: number;
  gender: string;
  occupation_cultivation_level: string;
  sect_or_faction?: string;
  personality: string;
  motivation: string;
  background: string;
  physical_appearance: CharacterPhysicalAppearance;
  costume: CharacterCostume;
  voice_characteristics: CharacterVoice;
  visual_consistency_prompt: string;
  avatar_url?: string;
}

export interface MarketplaceCharacterPack {
  id: string;
  title: string;
  description: string;
  genre: string;
  author_name: string;
  author_avatar?: string;
  downloads_count: number;
  rating: number;
  reviews_count: number;
  credit_cost: number;
  tags: string[];
  thumbnail_url: string;
  is_community_shared?: boolean;
  characters: MarketplaceCharacterSheet[];
  created_at: string;
}

// ============================================================================
// PHASE 12: SUPABASE STORAGE BUCKET MEDIA PERSISTENCE
// ============================================================================

export type StorageBucketName = 'character-avatars' | 'project-assets';

export interface StorageBucketObject {
  id: string;
  bucket: StorageBucketName;
  project_id: string;
  path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  public_url: string;
  storage_mode: 'supabase_storage' | 'local_persist';
  created_at: string;
}

export interface StorageUploadResult {
  url: string | null;
  bucket: StorageBucketName;
  path: string;
  storageMode: 'supabase_storage' | 'local_persist';
  objectRecord?: StorageBucketObject;
  error: string | null;
}

// ============================================================================
// PHASE 15: CREATOR BUSINESS & GROWTH INTELLIGENCE TYPES
// ============================================================================

export type PublishingPlatformKey = 'youtube' | 'tiktok' | 'reels' | 'x_twitter' | 'web_drama';

export interface CreatorMilestone {
  id: string;
  user_id: string;
  project_id?: string;
  project_name: string;
  platform: PublishingPlatformKey;
  video_url?: string;
  views_count: number;
  likes_count: number;
  comments_count: number;
  revenue_earned: number;
  currency: string;
  release_date: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface RetentionHookAnalysis {
  overallScore: number;
  firstThreeSeconds: {
    status: 'optimal' | 'warning' | 'critical';
    score: number;
    description: string;
    actionableTip: string;
  };
  dialogPacing: {
    status: 'optimal' | 'warning' | 'critical';
    score: number;
    description: string;
    actionableTip: string;
  };
  soundDesignPacing: {
    status: 'optimal' | 'warning' | 'critical';
    score: number;
    description: string;
    actionableTip: string;
  };
}

export interface CreatorMediaKitSettings {
  id?: string;
  user_id: string;
  studio_name: string;
  bio: string;
  contact_email: string;
  contact_phone?: string;
  primary_niche: string;
  location: string;
  rate_card_tier1: number;
  rate_card_tier2: number;
  rate_card_tier3: number;
  custom_pitch_hook?: string;
  is_public?: boolean;
  share_phone?: boolean;
  share_email?: boolean;
  updated_at?: string;
}

// ============================================================================
// Phase 6: Independent OTT & Streaming Catalog Architecture (Milestone 2.9)
// ============================================================================

export type OttAccessPolicy = 
  | 'free'                  // Free for all viewers without paywall
  | 'ppv_tvod'             // Transactional Video on Demand / Pay-Per-View per item/episode
  | 'svod_subscriber'      // Exclusive to channel/studio active subscribers
  | 'trailer_preview'      // Free teaser/trailer preview
  | 'hybrid_early_access'; // Early access for subscribers, PPV for general public

export type OttPublicationStatus = 
  | 'production_completed' // Video master rendered & approved at Gate 5
  | 'ready_for_catalog'   // Metadata & artwork drafted, ready for catalog inclusion
  | 'draft_catalog'       // In creator studio catalog staging (hidden from public)
  | 'published'           // Live & discoverable in public OTT storefront
  | 'archived';           // Delisted or retired from public storefront

export type OttContentFormat = 
  | 'short_form_vertical_9_16' 
  | 'cinematic_horizontal_16_9' 
  | 'micro_drama' 
  | 'commercial_anthology';

export type OttMaturityRating = 'ALL' | '13+' | '17+' | '21+';

export type OttMasterApprovalStatus = 'GATE_5_APPROVED' | 'PENDING_APPROVAL' | 'UNAPPROVED';

export interface OttChannel {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  banner_url?: string;
  website_url?: string;
  social_links?: Record<string, string>;
  is_verified: boolean;
  status: 'active' | 'suspended' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface OttSeries {
  id: string;
  channel_id: string;
  user_id: string;
  title: string;
  slug: string;
  synopsis?: string;
  content_format: OttContentFormat;
  genres: string[];
  tags: string[];
  poster_url?: string;
  backdrop_url?: string;
  total_seasons_count: number;
  total_episodes_count: number;
  maturity_rating: OttMaturityRating;
  default_access_policy: OttAccessPolicy;
  publication_status: OttPublicationStatus;
  featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface OttSeason {
  id: string;
  series_id: string;
  season_number: number;
  title: string;
  synopsis?: string;
  poster_url?: string;
  episodes_count: number;
  publication_status: 'draft_catalog' | 'published' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface OttEpisode {
  id: string;
  series_id: string;
  season_id: string;
  user_id: string;
  episode_number: number;
  title: string;
  slug: string;
  synopsis?: string;
  runtime_seconds: number;
  thumbnail_url?: string;
  access_policy: OttAccessPolicy;
  ppv_price_idr: number;
  publication_status: OttPublicationStatus;
  published_at?: string;
  scheduled_release_at?: string;
  
  // Gate 5 Master Asset Integration
  source_project_id?: string;
  master_export_id?: string;
  master_video_url?: string;
  master_video_fingerprint?: string;
  master_approval_status: OttMasterApprovalStatus;
  subtitle_vtt_url?: string;
  chapters_json?: Array<{ time: number; title: string }>;
  
  created_at: string;
  updated_at: string;
}

export interface OttFilm {
  id: string;
  channel_id: string;
  user_id: string;
  title: string;
  slug: string;
  logline?: string;
  synopsis?: string;
  runtime_seconds: number;
  aspect_ratio: '16:9' | '9:16' | '2.39:1' | '4:3';
  genres: string[];
  tags: string[];
  poster_url?: string;
  backdrop_url?: string;
  trailer_video_url?: string;
  access_policy: OttAccessPolicy;
  ppv_price_idr: number;
  publication_status: OttPublicationStatus;
  published_at?: string;
  scheduled_release_at?: string;
  
  // Gate 5 Master Asset Integration
  source_project_id?: string;
  master_export_id?: string;
  master_video_url?: string;
  master_video_fingerprint?: string;
  master_approval_status: OttMasterApprovalStatus;
  subtitle_vtt_url?: string;
  chapters_json?: Array<{ time: number; title: string }>;
  
  created_at: string;
  updated_at: string;
}

export interface OttCastMember {
  id: string;
  user_id: string;
  character_id?: string;
  content_type: 'series' | 'episode' | 'film';
  content_id: string;
  person_or_char_name: string;
  role_type: 'lead_actor' | 'supporting_actor' | 'voice_actor' | 'director' | 'writer' | 'ai_cinematographer';
  avatar_url?: string;
  created_at: string;
}

export interface OttCatalogSummary {
  channel: OttChannel;
  totalSeries: number;
  totalFilms: number;
  totalEpisodes: number;
  totalPublishedItems: number;
  totalDraftItems: number;
  seriesList: OttSeries[];
  filmsList: OttFilm[];
}

// ============================================================================
// OTT CONTENT ACCESS CONTROL & ENTITLEMENT TYPES (Milestone 2.9.1)
// ============================================================================

export type OttAccessPassStatus = 'active' | 'expired' | 'revoked';

export type OttViewerSubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'past_due' | 'revoked';

export interface OttAccessPass {
  id: string;
  user_id: string;
  channel_id: string;
  content_type: 'episode' | 'film' | 'season' | 'series_season_pass';
  content_id: string;
  order_ref_id?: string;
  price_paid_idr: number;
  currency: string;
  status: OttAccessPassStatus;
  valid_from: string;
  valid_until?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OttViewerSubscription {
  id: string;
  user_id: string;
  channel_id: string;
  tier_name: string;
  billing_cycle: 'weekly' | 'monthly' | 'annual';
  status: OttViewerSubscriptionStatus;
  price_paid_idr: number;
  current_period_start: string;
  current_period_end: string;
  auto_renew: boolean;
  created_at: string;
  updated_at: string;
}

export type OttAccessDecisionStatus =
  | 'ALLOWED_FREE'
  | 'ALLOWED_PPV'
  | 'ALLOWED_SVOD'
  | 'ALLOWED_PREVIEW'
  | 'LOGIN_REQUIRED'
  | 'PAYMENT_REQUIRED'
  | 'SUBSCRIPTION_REQUIRED'
  | 'ENTITLEMENT_EXPIRED'
  | 'CONTENT_NOT_PUBLISHED'
  | 'CONTENT_NOT_YET_AVAILABLE'
  | 'CONTENT_UNAVAILABLE'
  | 'ACCESS_REVOKED'
  | 'TENANT_ACCESS_DENIED';

export interface OttEntitlementGrantPayload {
  v: number;
  sub: string;
  cid: string;
  cty: 'episode' | 'film';
  chid: string;
  pol: OttAccessPolicy;
  wm: boolean | string;
  iat: number;
  exp: number;
  jti: string;
}

export interface OttEntitlementGrant {
  grantToken: string;
  expiresAt: string;
  issuedAt: string;
  accessPolicy: OttAccessPolicy;
  watermarkRequired: boolean;
  viewerId: string;
  contentId: string;
  channelId: string;
  grantId: string;
}

export interface OttPlaybackSession {
  ticketId: string;
  videoUrl?: string;
  expiresAt: string;
  isWatermarked: boolean;
  sessionToken: string;
}

export interface OttMonetizationPrompt {
  requiredAction: 'login' | 'purchase_ticket' | 'subscribe' | 'wait_for_release' | 'contact_support';
  priceIdr?: number;
  currency?: string;
  channelId: string;
  contentTitle: string;
  subscriptionTiers?: Array<{
    name: string;
    billingCycle: 'weekly' | 'monthly' | 'annual';
    priceIdr: number;
  }>;
}

export interface OttAccessDecisionResult {
  allowed: boolean;
  status: OttAccessDecisionStatus;
  reason: string;
  contentId: string;
  contentType: 'episode' | 'film';
  channelId: string;
  entitlementGrant?: OttEntitlementGrant;
  previewUrl?: string;
  playbackSession?: OttPlaybackSession;
  monetizationPrompt?: OttMonetizationPrompt;
  evaluatedAt: string;
}

export interface ResolveOttAccessParams {
  viewer?: {
    id: string;
    email?: string;
  } | null;
  channel: OttChannel;
  content: OttEpisode | OttFilm;
  parentSeries?: OttSeries;
  contentType: 'episode' | 'film';
  userPasses?: OttAccessPass[];
  userSubscriptions?: OttViewerSubscription[];
  isPreviewRequest?: boolean;
  currentTime?: Date;
}

