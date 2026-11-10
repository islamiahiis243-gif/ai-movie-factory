# AI Movie Factory - Database Schema Documentation

**Document Version:** 4.0  
**Timestamp:** `2026-11-09 21:31 +07:00`  
**Status:** Production Verified (32 Tables, Enterprise RLS, Two-Phase Credit Protocol & Usage Metering)  
**Target Environment:** Supabase Cloud PostgreSQL 15+ (`jixfakvbhugpypjtyshq`)  
**Engine:** Supabase PostgreSQL with Row Level Security (RLS) & Atomic RPC Functions

---

## 1. Schema Overview

The database design follows a multi-tenant, ownership-protected relational architecture where every entity traces ownership to an authenticated user (`auth.users.id`).

```
auth.users (Supabase Auth)
     │
     ▼ (1:1)
public.profiles
     │
     ▼ (1:N)
public.projects
     │
     ├── (1:1) public.project_settings
     ├── (1:1) public.story_bibles
     └── (1:N) public.characters
```

---

## 2. Table Specifications

### 2.1. `public.profiles`
Stores extended user profile information and studio settings.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY, REFERENCES auth.users(id) ON DELETE CASCADE` | User ID from Supabase Auth |
| `display_name` | `TEXT` | `NOT NULL` | Creator name or studio handle |
| `avatar_url` | `TEXT` | `NULLABLE` | Profile picture URL |
| `preferred_language` | `TEXT` | `NOT NULL DEFAULT 'id' CHECK (IN ('id', 'en'))` | UI Language |
| `email` | `TEXT` | `NULLABLE` | User email address |
| `role` | `TEXT` | `DEFAULT 'creator'` | System authorization role |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT timezone('utc', now())` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT timezone('utc', now())` | Last modified timestamp |

### 2.2. `public.projects`
Core entity representing a creative film, series, or drama production.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT uuid_generate_v4()` | Unique project identifier |
| `user_id` | `UUID` | `NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE` | Owner profile ID |
| `name` | `TEXT` | `NOT NULL` | Title of the production |
| `description` | `TEXT` | `NOT NULL DEFAULT ''` | Project logline or synopsis |
| `genre` | `TEXT` | `NOT NULL` | Primary genre (e.g., Xianxia, Sci-Fi) |
| `custom_genre` | `TEXT` | `NULLABLE` | Custom genre title if genre = 'Custom' |
| `production_format` | `TEXT` | `NOT NULL DEFAULT 'Feature film'` | Format (e.g., Drama series, Short film) |
| `status` | `TEXT` | `NOT NULL DEFAULT 'draft'` | Production state |
| `thumbnail_url` | `TEXT` | `NULLABLE` | Poster or project key visual |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT timezone('utc', now())` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT timezone('utc', now())` | Last modified timestamp |

### 2.3. `public.project_settings`
Configurable parameters for production orchestration and AI agent execution.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT uuid_generate_v4()` | Unique settings row ID |
| `project_id` | `UUID` | `NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE` | Associated project ID |
| `settings` | `JSONB` | `NOT NULL DEFAULT '{}'::jsonb` | Full production parameters payload |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT timezone('utc', now())` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT timezone('utc', now())` | Last modified timestamp |

#### JSONB `settings` Schema:
```json
{
  "seasons_count": 1,
  "episodes_count": 12,
  "episode_duration_minutes": 15,
  "scene_count_target": 96,
  "target_runtime_minutes": 180,
  "aspect_ratio": "16:9",
  "output_resolution": "4K",
  "frame_rate": "24fps",
  "visual_style": "3D Donghua Cinematic, Atmospheric Volumetric Lighting",
  "output_language": "id",
  "subtitle_language": "en",
  "voice_language": "id",
  "production_quality": "cinematic",
  "production_mode": "ai_assisted",
  "enabled_modules": ["world_builder", "character_studio", "story_script", "storyboard", "media_studio", "quality_control"],
  "enabled_agents": ["master_director", "world_builder_agent", "story_architect", "script_writer", "character_designer", "storyboard_director"],
  "human_approval_required": true,
  "credit_budget": 10000
}
```

### 2.4. `public.story_bibles`
Stores the universe lore, metaphysics, cultivation hierarchies, factions, geography, and chronological history (SSOT Section 8).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT uuid_generate_v4()` | Unique story bible identifier |
| `project_id` | `UUID` | `NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE` | Associated project ID |
| `world_name` | `TEXT` | `NOT NULL` | Fictional universe name |
| `synopsis` | `TEXT` | `NOT NULL DEFAULT ''` | Core universe summary and tone |
| `historical_background` | `TEXT` | `NOT NULL DEFAULT ''` | Origin, ancient cataclysms, or world wars |
| `rules_of_the_world` | `TEXT` | `NOT NULL DEFAULT ''` | Cosmic laws, limitations, karma rules |
| `magic_or_tech_system` | `TEXT` | `NOT NULL DEFAULT ''` | Magic structure, arrays, or cybernetics |
| `spiritual_energy_rules` | `TEXT` | `NULLABLE` | Qi flow, ley lines, core energy |
| `cultivation_realms` | `JSONB` | `NOT NULL DEFAULT '[]'::jsonb` | Ordered cultivation hierarchy (name, level, criteria) |
| `factions` | `JSONB` | `NOT NULL DEFAULT '[]'::jsonb` | Sects, clans, alignments, leaders, specialties |
| `locations` | `JSONB` | `NOT NULL DEFAULT '[]'::jsonb` | Geography, regions, danger level, controlling faction |
| `timeline` | `JSONB` | `NOT NULL DEFAULT '[]'::jsonb` | Eras, timestamps, milestone events, narrative impact |
| `reference_notes` | `TEXT` | `NULLABLE` | Director notes and style references |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT timezone('utc', now())` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT timezone('utc', now())` | Last modified timestamp |

### 2.5. `public.characters`
Stores individual character sheets, facial breakdown, costumes, voice profile, and master visual prompt seeds (SSOT Section 9).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT uuid_generate_v4()` | Unique character identifier |
| `project_id` | `UUID` | `NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE` | Associated project ID |
| `name` | `TEXT` | `NOT NULL` | Character full name |
| `native_name` | `TEXT` | `NULLABLE` | Original script / Hanzi / title |
| `role` | `TEXT` | `NOT NULL CHECK (role IN ('protagonist', 'antagonist', 'supporting', 'mentor', 'recurring'))` | Narrative role |
| `age` | `TEXT` | `NOT NULL DEFAULT '20'` | Character age description |
| `gender` | `TEXT` | `NOT NULL DEFAULT 'Pria'` | Character gender |
| `occupation_cultivation_level` | `TEXT` | `NULLABLE` | Cultivation realm or profession |
| `sect_or_faction` | `TEXT` | `NULLABLE` | Associated faction or sect |
| `personality` | `TEXT` | `NOT NULL DEFAULT ''` | Core traits and temperament |
| `motivation` | `TEXT` | `NOT NULL DEFAULT ''` | Core desires and goals |
| `background` | `TEXT` | `NOT NULL DEFAULT ''` | Origin and past experiences |
| `physical_appearance` | `JSONB` | `NOT NULL DEFAULT '{}'::jsonb` | Face structure, eyes, hair, physique, scars |
| `costume` | `JSONB` | `NOT NULL DEFAULT '{}'::jsonb` | Daily attire, battle robes, artifacts/accessories |
| `voice_characteristics` | `JSONB` | `NOT NULL DEFAULT '{}'::jsonb` | Pitch, tempo, voice actor reference |
| `visual_consistency_prompt` | `TEXT` | `NOT NULL DEFAULT ''` | Master seed prompt for AI generation |
| `relationships` | `JSONB` | `NOT NULL DEFAULT '[]'::jsonb` | Inter-character connections and dynamic descriptions |
| `avatar_url` | `TEXT` | `NULLABLE` | Character portrait URL |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT timezone('utc', now())` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT timezone('utc', now())` | Last modified timestamp |

### 2.6. `public.story_concepts`
Stores core story premise, logline, theme, and narrative structure framework (SSOT Section 10).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT uuid_generate_v4()` | Unique concept row ID |
| `project_id` | `UUID` | `NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE` | Associated project ID |
| `logline` | `TEXT` | `NOT NULL DEFAULT ''` | Hook sentence |
| `synopsis` | `TEXT` | `NOT NULL DEFAULT ''` | Full overarching story synopsis |
| `theme` | `TEXT` | `NOT NULL DEFAULT ''` | Philosophical theme & core conflict |
| `narrative_structure` | `TEXT` | `NOT NULL DEFAULT 'three_act'` | Narrative structure (three_act, kishotenketsu, etc.) |
| `tone_style` | `TEXT` | `NOT NULL DEFAULT ''` | Atmosphere and emotional tone |
| `target_audience` | `TEXT` | `NOT NULL DEFAULT ''` | Demographic & target viewers |

### 2.7. `public.seasons`
Top-level structural seasons for episodic productions (SSOT Section 10 & 37).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT uuid_generate_v4()` | Unique season ID |
| `project_id` | `UUID` | `NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE` | Associated project ID |
| `season_number` | `INTEGER` | `NOT NULL DEFAULT 1` | Sequential season index |
| `title` | `TEXT` | `NOT NULL` | Season title |
| `synopsis` | `TEXT` | `NOT NULL DEFAULT ''` | Season overarching arc synopsis |
| `target_episodes` | `INTEGER` | `NOT NULL DEFAULT 12` | Planned episode count |
| `status` | `TEXT` | `NOT NULL DEFAULT 'in_development'` | Production status |

### 2.8. `public.episodes`
Individual episodes grouped under seasons.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT uuid_generate_v4()` | Unique episode ID |
| `project_id` | `UUID` | `NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE` | Associated project ID |
| `season_id` | `UUID` | `NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE` | Parent season ID |
| `episode_number` | `INTEGER` | `NOT NULL DEFAULT 1` | Sequential episode index |
| `title` | `TEXT` | `NOT NULL` | Episode title |
| `logline` | `TEXT` | `NOT NULL DEFAULT ''` | Episode-specific logline |
| `target_runtime_minutes` | `INTEGER` | `NOT NULL DEFAULT 15` | Target runtime |
| `scene_count_target` | `INTEGER` | `NOT NULL DEFAULT 8` | Estimated scene count |
| `status` | `TEXT` | `NOT NULL DEFAULT 'draft'` | Status (draft, outline, scripted, approved) |

### 2.9. `public.scenes`
Shot-ready screenplay scene blocks with dialogue, action, and character tagging (SSOT Sections 10, 11).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT uuid_generate_v4()` | Unique scene identifier |
| `project_id` | `UUID` | `NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE` | Associated project ID |
| `episode_id` | `UUID` | `NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE` | Parent episode ID |
| `scene_number` | `INTEGER` | `NOT NULL DEFAULT 1` | Sequential scene index |
| `title` | `TEXT` | `NOT NULL` | Scene title |
| `slugline` | `TEXT` | `NOT NULL` | Standard slugline (e.g. INT. GUBUK - DAWN) |
| `int_ext` | `TEXT` | `NOT NULL DEFAULT 'INT'` | INT / EXT / INT/EXT |
| `location_name` | `TEXT` | `NOT NULL` | Specific scene location |
| `time_of_day` | `TEXT` | `NOT NULL DEFAULT 'DAY'` | DAY, NIGHT, DAWN, DUSK, CONTINUOUS |
| `synopsis` | `TEXT` | `NOT NULL DEFAULT ''` | Scene event summary |
| `emotional_beat` | `TEXT` | `NOT NULL DEFAULT ''` | Dramatic intention and emotional arc |
| `character_ids` | `JSONB` | `NOT NULL DEFAULT '[]'::jsonb` | Tagged character IDs |
| `characters_present` | `JSONB` | `NOT NULL DEFAULT '[]'::jsonb` | Tagged character names |
| `blocks` | `JSONB` | `NOT NULL DEFAULT '[]'::jsonb` | Screenplay blocks (action, dialogue, transition) |
| `visual_continuity_seed`| `TEXT` | `NULLABLE` | Master visual prompt seed for scene |
| `camera_notes` | `TEXT` | `NULLABLE` | Camera angles & director motion notes |
| `audio_sound_notes` | `TEXT` | `NULLABLE` | Sound design, ambience, and music score notes |
| `approval_status` | `TEXT` | `NOT NULL DEFAULT 'draft'` | draft, in_review, approved, revision_requested |
| `approved_at` | `TIMESTAMPTZ` | `NULLABLE` | Approval timestamp |
| `approved_by` | `TEXT` | `NULLABLE` | Director or approver identity |
| `estimated_duration_seconds`| `INTEGER` | `NOT NULL DEFAULT 90` | Scene duration in seconds |
| `versions_count` | `INTEGER` | `NOT NULL DEFAULT 1` | Revision count |

### 2.10. `public.script_versions`
Historical snapshot records of scene screenplays for auditing and review flows (SSOT Section 10).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT uuid_generate_v4()` | Unique version snapshot ID |
| `scene_id` | `UUID` | `NOT NULL REFERENCES public.scenes(id) ON DELETE CASCADE` | Associated scene ID |
| `version_number` | `INTEGER` | `NOT NULL` | Sequential version index |
| `changelog_note` | `TEXT` | `NOT NULL DEFAULT ''` | Creator changelog or rationale |
| `blocks` | `JSONB` | `NOT NULL DEFAULT '[]'::jsonb` | Screenplay blocks snapshot |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT timezone('utc', now())` | Snapshot timestamp |
| `created_by` | `TEXT` | `NULLABLE` | Creator identity |

### 2.11. `public.agent_project_configs`
Project-specific configuration, prompt overrides, and budget limits for each of the 14 AI agents (SSOT Section 12).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT uuid_generate_v4()` | Unique config record ID |
| `project_id` | `UUID` | `NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE` | Associated project ID |
| `agent_role` | `TEXT` | `NOT NULL` | Role identifier (e.g. `master_director`, `script_writer`) |
| `is_enabled` | `BOOLEAN` | `NOT NULL DEFAULT true` | Enable/disable agent in pipeline |
| `model` | `TEXT` | `NOT NULL` | Foundation Gemini model identifier |
| `temperature` | `FLOAT` | `NOT NULL DEFAULT 0.7` | Generation temperature (0.1 to 1.0) |
| `custom_instructions` | `TEXT` | `NOT NULL DEFAULT ''` | Project-specific system prompt override |
| `max_credit_budget` | `INTEGER` | `NOT NULL DEFAULT 1000` | Maximum compute credits threshold |
| `requires_approval` | `BOOLEAN` | `NOT NULL DEFAULT false` | Human approval checkpoint enforcement |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT timezone('utc', now())` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT timezone('utc', now())` | Last modified timestamp |

### 2.12. `public.production_tasks`
Discrete production jobs delegated by the Master Director to specialized agents (SSOT Section 13, 38).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT uuid_generate_v4()` | Unique task execution ID |
| `project_id` | `UUID` | `NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE` | Associated project ID |
| `agent_role` | `TEXT` | `NOT NULL` | Agent assigned to task |
| `title` | `TEXT` | `NOT NULL` | Task title |
| `description` | `TEXT` | `NOT NULL DEFAULT ''` | Task scope and instructions |
| `status` | `TEXT` | `NOT NULL DEFAULT 'pending'` | `pending`, `in_progress`, `needs_approval`, `completed`, `failed` |
| `progress` | `INTEGER` | `NOT NULL DEFAULT 0` | Task completion percentage (0 - 100) |
| `credit_cost` | `INTEGER` | `NOT NULL DEFAULT 10` | Compute credits consumed |
| `input_payload` | `JSONB` | `NOT NULL DEFAULT '{}'::jsonb` | Context and parameters ingested |
| `output_payload` | `JSONB` | `NULLABLE` | Deliverable generated by the agent |
| `error_message` | `TEXT` | `NULLABLE` | Error diagnostics if failed |
| `approved_by` | `TEXT` | `NULLABLE` | Human approver identity |
| `approved_at` | `TIMESTAMPTZ` | `NULLABLE` | Human authorization timestamp |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT timezone('utc', now())` | Task queue timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT timezone('utc', now())` | Last modified timestamp |

### 2.13. `public.agent_execution_logs`
Fine-grained, real-time telemetry events of agent reasoning, tool actions, and human approval checkpoints (SSOT Section 13).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT uuid_generate_v4()` | Unique log event ID |
| `project_id` | `UUID` | `NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE` | Associated project ID |
| `task_id` | `UUID` | `NULLABLE REFERENCES public.production_tasks(id) ON DELETE SET NULL` | Parent task ID |
| `agent_role` | `TEXT` | `NOT NULL` | Logging agent role |
| `level` | `TEXT` | `NOT NULL DEFAULT 'info'` | `info`, `reasoning`, `action`, `approval_required`, `success`, `error` |
| `step_number` | `INTEGER` | `NULLABLE` | Chained workflow step index |
| `message` | `TEXT` | `NOT NULL` | Telemetry log message / agent thought |
| `metadata` | `JSONB` | `NOT NULL DEFAULT '{}'::jsonb` | Diagnostics, tokens, or parameters |
| `timestamp` | `TIMESTAMPTZ` | `NOT NULL DEFAULT timezone('utc', now())` | Event occurrence timestamp |

### 2.14. `public.assets`
Central Production Asset Library storing generated images, video motion clips, voice dubbing tracks, and soundtrack audio (SSOT Section 13, 39).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT uuid_generate_v4()` | Unique asset identifier |
| `project_id` | `UUID` | `NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE` | Associated project ID |
| `episode_id` | `UUID` | `NULLABLE REFERENCES public.episodes(id) ON DELETE SET NULL` | Associated episode ID |
| `scene_id` | `UUID` | `NULLABLE REFERENCES public.scenes(id) ON DELETE SET NULL` | Associated screenplay scene ID |
| `character_id` | `UUID` | `NULLABLE REFERENCES public.characters(id) ON DELETE SET NULL` | Associated character ID |
| `asset_name` | `TEXT` | `NOT NULL` | Display title of asset |
| `asset_type` | `TEXT` | `NOT NULL CHECK (IN ('image', 'video', 'voice', 'audio'))` | High-level media category |
| `subtype` | `TEXT` | `NOT NULL` | Subtype (character_portrait, image_to_video, etc.) |
| `provider` | `TEXT` | `NOT NULL` | AI Provider adapter (google_gemini, runway_gen3, etc.) |
| `model` | `TEXT` | `NOT NULL` | Foundation model ID (gemini-3.1-flash-lite-image, etc.) |
| `prompt` | `TEXT` | `NOT NULL` | Generation prompt input |
| `generation_params` | `JSONB` | `NOT NULL DEFAULT '{}'::jsonb` | Seed, aspect ratio, camera motion, tempo, etc. |
| `status` | `TEXT` | `NOT NULL DEFAULT 'completed'` | queued, generating, completed, failed |
| `credit_cost` | `INTEGER` | `NOT NULL DEFAULT 10` | Compute credits consumed |
| `file_url` | `TEXT` | `NOT NULL` | Media URL or data URI |
| `thumbnail_url` | `TEXT` | `NULLABLE` | Compressed preview thumbnail URL |
| `version` | `INTEGER` | `NOT NULL DEFAULT 1` | Revision number |
| `approval_status` | `TEXT` | `NOT NULL DEFAULT 'draft'` | draft, in_review, approved, rejected |
| `approved_by` | `TEXT` | `NULLABLE` | Approver identity (Creative Director) |
| `approved_at` | `TIMESTAMPTZ` | `NULLABLE` | Authorization timestamp |
| `error_message` | `TEXT` | `NULLABLE` | Provider error message if failed |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT timezone('utc', now())` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT timezone('utc', now())` | Last modified timestamp |

### 2.15. `public.pipeline_jobs`
Autonomous scene-level execution queue tracking stage progression, credit consumption, automated QC audits, and approval checkpoints (SSOT Sections 14, 15, 40).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Unique pipeline job ID |
| `project_id` | `UUID` | `NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE` | Associated project ID |
| `episode_id` | `UUID` | `NULLABLE REFERENCES public.episodes(id) ON DELETE SET NULL` | Target episode ID |
| `scene_id` | `UUID` | `NULLABLE REFERENCES public.scenes(id) ON DELETE SET NULL` | Target scene ID |
| `job_title` | `TEXT` | `NOT NULL` | Descriptive name of job |
| `current_stage` | `TEXT` | `NOT NULL DEFAULT 'script_prep'` | Active pipeline stage (`script_prep`, `image_gen`, `video_gen`, etc.) |
| `status` | `TEXT` | `NOT NULL DEFAULT 'queued'` | `queued`, `running`, `awaiting_approval`, `completed`, `failed`, `paused`, `cancelled` |
| `priority` | `TEXT` | `NOT NULL DEFAULT 'normal'` | `low`, `normal`, `high`, `urgent` |
| `progress` | `INTEGER` | `NOT NULL DEFAULT 0` | Progress percentage (0 - 100) |
| `stages_completed` | `JSONB` | `NOT NULL DEFAULT '[]'::jsonb` | Completed stage history array |
| `qc_report` | `JSONB` | `NULLABLE` | Automated QC evaluation result |
| `generated_asset_ids` | `JSONB` | `NOT NULL DEFAULT '[]'::jsonb` | Generated media asset references |
| `credit_cost` | `INTEGER` | `NOT NULL DEFAULT 15` | Total credits calculated for job |
| `is_approved` | `BOOLEAN` | `NOT NULL DEFAULT false` | Human director checkpoint approval |
| `approved_by` | `TEXT` | `NULLABLE` | Name or ID of approver |
| `approved_at` | `TIMESTAMPTZ` | `NULLABLE` | Approval timestamp |
| `started_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT timezone('utc', now())` | Execution start time |
| `completed_at` | `TIMESTAMPTZ` | `NULLABLE` | Completion timestamp |

### 2.16. `public.pipeline_job_logs`
Granular timestamped telemetry events for stage transitions, automated QC evaluations, and errors.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Unique log entry ID |
| `job_id` | `UUID` | `NOT NULL REFERENCES public.pipeline_jobs(id) ON DELETE CASCADE` | Associated pipeline job |
| `project_id` | `UUID` | `NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE` | Associated project ID |
| `stage` | `TEXT` | `NOT NULL` | Pipeline stage generating log |
| `level` | `TEXT` | `NOT NULL DEFAULT 'info'` | `info`, `action`, `warning`, `error`, `success` |
| `message` | `TEXT` | `NOT NULL` | Log statement |
| `timestamp` | `TIMESTAMPTZ` | `NOT NULL DEFAULT timezone('utc', now())` | Log timestamp |
| `metadata` | `JSONB` | `NULLABLE DEFAULT '{}'::jsonb` | Extra parameters or token counts |

### 2.17. `public.export_packages`
Finished distribution packages containing master audio-video renders and synchronized subtitles (SRT / VTT).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Package ID |
| `project_id` | `UUID` | `NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE` | Associated project ID |
| `episode_id` | `UUID` | `NULLABLE REFERENCES public.episodes(id) ON DELETE SET NULL` | Target episode ID |
| `scene_id` | `UUID` | `NULLABLE REFERENCES public.scenes(id) ON DELETE SET NULL` | Target scene ID |
| `package_title` | `TEXT` | `NOT NULL` | Package display title |
| `format` | `TEXT` | `NOT NULL DEFAULT 'mp4'` | Container format (`mp4`, `prores`, `webm`) |
| `resolution` | `TEXT` | `NOT NULL DEFAULT '1080p'` | `1080p`, `4K` |
| `framerate` | `TEXT` | `NOT NULL DEFAULT '24fps'` | `24fps`, `30fps`, `60fps` |
| `audio_channels` | `TEXT` | `NOT NULL DEFAULT 'Stereo 2.0'` | Stereo 2.0, Surround 5.1 |
| `include_subtitles` | `BOOLEAN` | `NOT NULL DEFAULT true` | Whether subtitles are included |
| `subtitle_format` | `TEXT` | `NOT NULL DEFAULT 'srt'` | `srt`, `vtt` |
| `subtitles_content` | `TEXT` | `NULLABLE` | Generated subtitle transcript string |
| `file_url` | `TEXT` | `NOT NULL` | Master file download URL |
| `file_size_mb` | `NUMERIC(8,2)` | `NOT NULL DEFAULT 42.50` | File size in Megabytes |
| `status` | `TEXT` | `NOT NULL DEFAULT 'ready'` | `ready`, `packaging`, `failed` |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT timezone('utc', now())` | Creation timestamp |

### 2.18. `public.subscriptions`
Subscription tiers, billing cycles, pricing, active renewal dates, and payment provider mappings (SSOT Sections 21, 23, 41).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Unique subscription ID |
| `user_id` | `UUID` | `NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE` | Associated user ID |
| `tier` | `TEXT` | `NOT NULL DEFAULT 'free'` | `free`, `creator`, `pro_studio`, `production_house` |
| `status` | `TEXT` | `NOT NULL DEFAULT 'active'` | `active`, `past_due`, `canceled`, `trialing` |
| `billing_cycle` | `TEXT` | `NOT NULL DEFAULT 'monthly'` | `monthly`, `yearly` |
| `price_paid` | `NUMERIC(12,2)` | `NOT NULL DEFAULT 0` | Subscription price paid |
| `currency` | `TEXT` | `NOT NULL DEFAULT 'IDR'` | Currency code (IDR, USD) |
| `credits_allotted` | `INTEGER` | `NOT NULL DEFAULT 150` | Monthly credit quota granted |
| `current_period_start` | `TIMESTAMPTZ` | `NOT NULL DEFAULT timezone('utc', now())` | Period activation timestamp |
| `current_period_end` | `TIMESTAMPTZ` | `NOT NULL` | Next billing renewal timestamp |
| `cancel_at_period_end` | `BOOLEAN` | `NOT NULL DEFAULT false` | Whether cancellation is pending |
| `payment_provider` | `TEXT` | `NOT NULL DEFAULT 'midtrans'` | `midtrans`, `stripe` |
| `payment_method` | `TEXT` | `NOT NULL DEFAULT 'qris'` | `qris`, `bca_va`, `mandiri_va`, `credit_card` |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT timezone('utc', now())` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT timezone('utc', now())` | Modification timestamp |

### 2.19. `public.credit_transactions`
Immutable auditable transactional ledger recording all credit deductions, top-ups, monthly allotments, and compensations (SSOT Section 22).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Unique transaction ID |
| `user_id` | `UUID` | `NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE` | Associated user profile ID |
| `project_id` | `UUID` | `NULLABLE REFERENCES public.projects(id) ON DELETE SET NULL` | Associated project ID |
| `job_id` | `TEXT` | `NULLABLE` | Associated job identifier |
| `transaction_type` | `TEXT` | `NOT NULL` | `purchase`, `usage`, `refund`, `monthly_allotment`, `admin_adjustment` |
| `amount` | `INTEGER` | `NOT NULL` | Signed credit delta (+ or -) |
| `balance_after` | `INTEGER` | `NOT NULL` | Resulting credit balance |
| `provider` | `TEXT` | `NULLABLE` | AI provider (google_gemini, runway_gen3, midtrans, system) |
| `model` | `TEXT` | `NULLABLE` | AI foundation model (gemini-3.1-flash-lite-image, etc.) |
| `operation` | `TEXT` | `NOT NULL` | Specific operation identifier |
| `estimated_cost_usd` | `NUMERIC(8,4)` | `NOT NULL DEFAULT 0` | Theoretical API cost in USD |
| `actual_cost_usd` | `NUMERIC(8,4)` | `NOT NULL DEFAULT 0` | Actual provider cost in USD |
| `description` | `TEXT` | `NOT NULL` | Plain-text transaction memo |
| `status` | `TEXT` | `NOT NULL DEFAULT 'completed'` | `completed`, `pending`, `failed`, `refunded` |
| `idempotency_key` | `TEXT` | `UNIQUE` | Unique token preventing duplicate charges |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT timezone('utc', now())` | Transaction timestamp |

### 2.20. `public.payment_orders`
Payment orders tracking checkout sessions, payment methods, gateway references, and verified settlements (SSOT Section 21).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Order ID |
| `user_id` | `UUID` | `NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE` | Associated user ID |
| `order_number` | `TEXT` | `NOT NULL UNIQUE` | Human-readable order code (e.g. AMF-SUB-0089) |
| `package_type` | `TEXT` | `NOT NULL` | `subscription`, `credit_pack` |
| `package_id` | `TEXT` | `NOT NULL` | Plan ID or Top-Up Pack ID |
| `package_name` | `TEXT` | `NOT NULL` | Item description |
| `amount` | `NUMERIC(12,2)` | `NOT NULL` | Gross transaction value in IDR |
| `currency` | `TEXT` | `NOT NULL DEFAULT 'IDR'` | Currency code |
| `payment_gateway` | `TEXT` | `NOT NULL DEFAULT 'midtrans'` | `midtrans`, `stripe` |
| `payment_method` | `TEXT` | `NOT NULL DEFAULT 'qris'` | `qris`, `bca_va`, `mandiri_va`, `credit_card` |
| `status` | `TEXT` | `NOT NULL DEFAULT 'pending'` | `pending`, `settlement`, `expire`, `cancel` |
| `credits_granted` | `INTEGER` | `NOT NULL DEFAULT 0` | Total credits added upon settlement |
| `external_reference` | `TEXT` | `NULLABLE` | Gateway transaction identifier |
| `paid_at` | `TIMESTAMPTZ` | `NULLABLE` | Settlement verification timestamp |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT timezone('utc', now())` | Order initiation timestamp |

### 2.21. `public.workspaces`
Collaborative multi-seat studio containers for team production (SSOT Section 42).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Workspace ID |
| `name` | `TEXT` | `NOT NULL` | Studio/team workspace name |
| `owner_id` | `UUID` | `NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE` | Primary owner profile |
| `seat_limit` | `INTEGER` | `NOT NULL DEFAULT 5` | Maximum team seats based on subscription |
| `active_seats_count` | `INTEGER` | `NOT NULL DEFAULT 1` | Count of registered members |
| `settings` | `JSONB` | `NOT NULL DEFAULT '{}'` | Default language, aspect ratio, approval policies |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT timezone('utc', now())` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT timezone('utc', now())` | Update timestamp |

### 2.22. `public.workspace_members`
Collaborator roster within a workspace with Role-Based Access Control (SSOT Section 42).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Membership ID |
| `workspace_id` | `UUID` | `NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE` | Target workspace |
| `user_id` | `UUID` | `NULLABLE REFERENCES public.profiles(id) ON DELETE SET NULL` | Authenticated user profile |
| `role` | `TEXT` | `NOT NULL CHECK (role IN ('owner', 'director', 'writer', 'reviewer'))` | Role in production |
| `invited_email` | `TEXT` | `NOT NULL` | Email address invited |
| `status` | `TEXT` | `NOT NULL DEFAULT 'active'` | `pending`, `active`, `suspended` |
| `joined_at` | `TIMESTAMPTZ` | `NULLABLE` | Membership acceptance date |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT timezone('utc', now())` | Roster creation timestamp |

### 2.23. `public.workspace_invites`
Cryptographic invite tokens for email invitation onboarding (SSOT Section 42).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Invitation ID |
| `workspace_id` | `UUID` | `NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE` | Associated workspace |
| `inviter_id` | `UUID` | `NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE` | Sending user profile |
| `email` | `TEXT` | `NOT NULL` | Invitee email |
| `role` | `TEXT` | `NOT NULL` | Assigned production role |
| `token` | `TEXT` | `NOT NULL UNIQUE` | Cryptographic invite token |
| `status` | `TEXT` | `NOT NULL DEFAULT 'pending'` | `pending`, `accepted`, `expired` |
| `expires_at` | `TIMESTAMPTZ` | `NOT NULL` | Expiration timestamp |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT timezone('utc', now())` | Creation timestamp |

### 2.24. `public.marketplace_templates`
Community-shared cinematic universe bibles, character packs, and workflow pipelines (SSOT Section 42).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Template unique ID |
| `title` | `TEXT` | `NOT NULL` | Template title |
| `description` | `TEXT` | `NOT NULL` | Full description |
| `category` | `TEXT` | `NOT NULL CHECK (category IN ('universe_bible', 'character_pack', 'workflow_pipeline', 'screenplay_arc'))` | Template category |
| `author_id` | `UUID` | `NULLABLE REFERENCES public.profiles(id) ON DELETE SET NULL` | Creator profile |
| `author_name` | `TEXT` | `NOT NULL` | Public creator handle |
| `is_official` | `BOOLEAN` | `NOT NULL DEFAULT false` | Verified official studio badge |
| `language` | `TEXT` | `NOT NULL DEFAULT 'en'` | Default content language |
| `tags` | `TEXT[]` | `NOT NULL DEFAULT '{}'` | Search keywords |
| `downloads_count`| `INTEGER` | `NOT NULL DEFAULT 0` | Times cloned |
| `rating` | `NUMERIC(3,2)` | `NOT NULL DEFAULT 5.0` | Average star rating |
| `visual_style` | `TEXT` | `NULLABLE` | Recommended visual aesthetic |
| `content_data` | `JSONB` | `NOT NULL DEFAULT '{}'` | Structured payload (world rules, characters, etc.) |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT timezone('utc', now())` | Publication date |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT timezone('utc', now())` | Last update |

### 2.25. `public.character_marketplace_packs`
Pre-seeded and community-shared multi-character packs with visual prompt seeds, costumes, and voice profiles.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Pack unique identifier |
| `title` | `TEXT` | `NOT NULL` | Pack title (e.g. Xianxia Immortals) |
| `genre` | `TEXT` | `NOT NULL` | Pack genre category |
| `description` | `TEXT` | `NOT NULL` | Pack summary |
| `characters_data` | `JSONB` | `NOT NULL DEFAULT '[]'` | Array of character dossiers |
| `creator_id` | `UUID` | `NULLABLE REFERENCES public.profiles(id)` | Creator profile |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT timezone('utc', now())` | Creation timestamp |

### 2.26. `public.creator_social_connections`
Social platform OAuth connections with AES-256-GCM encrypted tokens for YouTube, TikTok, Instagram Reels, and Facebook Video.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Connection ID |
| `user_id` | `UUID` | `NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE` | Creator user ID |
| `platform` | `TEXT` | `NOT NULL` | `youtube`, `tiktok`, `instagram`, `facebook` |
| `account_id` | `TEXT` | `NOT NULL` | Platform external account ID |
| `account_name` | `TEXT` | `NOT NULL` | External channel/account display name |
| `encrypted_access_token` | `TEXT` | `NOT NULL` | AES-256-GCM encrypted access token |
| `encrypted_refresh_token`| `TEXT` | `NULLABLE` | AES-256-GCM encrypted refresh token |
| `token_expires_at` | `TIMESTAMPTZ` | `NULLABLE` | Access token expiration timestamp |
| `scopes` | `TEXT[]` | `NOT NULL DEFAULT '{}'` | Authorized OAuth scopes |
| `metadata` | `JSONB` | `DEFAULT '{}'` | Additional platform metadata |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT timezone('utc', now())` | Last token refresh |

### 2.27. `public.publishing_jobs`
Social publishing jobs with multi-step lifecycle, worker lease fencing, and retry protection.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Publishing job identifier |
| `user_id` | `UUID` | `NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE` | Creator user ID |
| `project_id` | `UUID` | `NULLABLE REFERENCES public.projects(id)` | Associated project |
| `connection_id` | `UUID` | `NOT NULL REFERENCES public.creator_social_connections(id)` | Target account |
| `platform` | `TEXT` | `NOT NULL` | Destination platform |
| `title` | `TEXT` | `NOT NULL` | Published video title |
| `description` | `TEXT` | `DEFAULT ''` | Video caption/description |
| `tags` | `TEXT[]` | `DEFAULT '{}'` | Video hashtags |
| `video_url` | `TEXT` | `NOT NULL` | Source video file URL |
| `status` | `TEXT` | `NOT NULL DEFAULT 'queued'` | `queued`, `claiming`, `rendering`, `publishing`, `published`, `failed`, `requires_user_action` |
| `fencing_token` | `BIGINT` | `DEFAULT 0` | Lease fencing token preventing stale worker overwrites |
| `worker_id` | `TEXT` | `NULLABLE` | Current worker instance claiming the lease |
| `lease_expires_at` | `TIMESTAMPTZ`| `NULLABLE` | Worker lease expiration timestamp |
| `external_publish_id` | `TEXT`| `NULLABLE` | Target platform post/video ID |
| `published_video_url` | `TEXT`| `NULLABLE` | Public live URL of published video |
| `retry_count` | `INTEGER`| `DEFAULT 0` | Current retry count (max 3) |
| `error_details` | `JSONB` | `NULLABLE` | Diagnostic failure payload |

### 2.28. `public.oauth_state_transactions`
Single-use state storage for OAuth 2.0 flow with strict 5-minute TTL defending against CSRF and Replay attacks.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `state` | `TEXT` | `PRIMARY KEY` | Cryptographic state token |
| `user_id` | `UUID` | `NOT NULL REFERENCES auth.users(id)` | Initiating user |
| `platform` | `TEXT` | `NOT NULL` | Target platform |
| `redirect_uri` | `TEXT` | `NOT NULL` | Initiating redirect URI |
| `consumed_at` | `TIMESTAMPTZ`| `NULLABLE` | Timestamp when consumed (NULL = unspent) |
| `created_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT timezone('utc', now())` | Creation timestamp |

### 2.29. `public.creator_analytics_snapshots`
Time-series analytics snapshots for published videos with honest nullable retention metrics.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Snapshot ID |
| `user_id` | `UUID` | `NOT NULL REFERENCES auth.users(id)` | Creator profile |
| `publishing_job_id` | `UUID` | `NOT NULL REFERENCES public.publishing_jobs(id)` | Associated publishing job |
| `platform` | `TEXT` | `NOT NULL` | Source platform |
| `views_count` | `BIGINT` | `NOT NULL DEFAULT 0` | Total views |
| `likes_count` | `BIGINT` | `NOT NULL DEFAULT 0` | Total likes |
| `shares_count` | `BIGINT` | `NOT NULL DEFAULT 0` | Total shares |
| `comments_count` | `BIGINT` | `NOT NULL DEFAULT 0` | Total comments |
| `watch_time_seconds` | `NUMERIC` | `NULLABLE DEFAULT NULL` | Total watch time (null if unavailable) |
| `avg_view_duration_seconds`| `NUMERIC` | `NULLABLE DEFAULT NULL` | Average view duration |
| `retention_rate_pct` | `NUMERIC` | `NULLABLE DEFAULT NULL` | Audience retention % |
| `captured_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT timezone('utc', now())` | Snapshot timestamp |

### 2.30. `public.creator_analytics_sync_jobs`
Background synchronization run records for social media metrics.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Job ID |
| `connection_id` | `UUID` | `NOT NULL REFERENCES public.creator_social_connections(id)` | Connected platform account |
| `status` | `TEXT` | `NOT NULL DEFAULT 'queued'` | `queued`, `running`, `completed`, `failed` |
| `synced_items_count`| `INTEGER` | `DEFAULT 0` | Videos refreshed |
| `created_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT timezone('utc', now())` | Run timestamp |

### 2.31. `public.credit_reservations`
Two-phase commit atomic credit holds with row locking, expiration, and idempotency guarantees.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Reservation hold ID |
| `user_id` | `UUID` | `NOT NULL REFERENCES auth.users(id)` | Profile debited |
| `amount` | `INTEGER` | `NOT NULL CHECK (amount > 0)` | Credits reserved on hold |
| `operation` | `TEXT` | `NOT NULL` | Generation operation name |
| `model` | `TEXT` | `NOT NULL DEFAULT 'gemini-2.5-flash'` | AI model identifier |
| `status` | `TEXT` | `NOT NULL DEFAULT 'held'` | `held`, `settled`, `released`, `expired` |
| `expires_at` | `TIMESTAMPTZ`| `NOT NULL` | Hold expiration timestamp (5 min) |
| `metadata` | `JSONB` | `DEFAULT '{}'` | Session and prompt metadata |
| `settled_at` | `TIMESTAMPTZ`| `NULLABLE` | Final settlement timestamp |
| `released_at`| `TIMESTAMPTZ`| `NULLABLE` | Refund/rollback timestamp |
| `created_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT timezone('utc', now())` | Creation timestamp |

### 2.32. `public.ai_usage_records`
Granular token usage telemetry and billing status extracted directly from provider API response metadata.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Telemetry record ID |
| `user_id` | `UUID` | `NOT NULL REFERENCES auth.users(id)` | Creator profile |
| `operation` | `TEXT` | `NOT NULL` | Production task operation |
| `model` | `TEXT` | `NOT NULL` | E.g. `gemini-2.5-flash` |
| `prompt_tokens` | `INTEGER` | `NOT NULL DEFAULT 0` | Input token count |
| `candidates_tokens`| `INTEGER` | `NOT NULL DEFAULT 0` | Output token count |
| `total_tokens` | `INTEGER` | `NOT NULL DEFAULT 0` | Total tokens consumed |
| `cached_tokens`| `INTEGER` | `NOT NULL DEFAULT 0` | Cached tokens count |
| `cost_status` | `TEXT` | `NOT NULL DEFAULT 'free_tier'` | `free_tier`, `metered_real`, `mock_simulated` |
| `execution_duration_ms`| `INTEGER` | `NOT NULL DEFAULT 0` | Latency duration in ms |
| `reservation_id`| `UUID` | `NULLABLE REFERENCES public.credit_reservations(id)`| Associated reservation hold |
| `created_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT timezone('utc', now())` | Creation timestamp |

---

## 3. Row Level Security (RLS) Policies (All 32 Tables)

Every table has Row Level Security explicitly enabled:
1. `profiles`: Users can SELECT and UPDATE only their own record (`auth.uid() = id`).
2. `projects`: Users can SELECT, INSERT, UPDATE, DELETE only records where `auth.uid() = user_id`.
3. `project_settings`: Users can access settings only for projects they own.
4. `story_bibles`: Users can manage world bibles only for projects they own.
5. `characters`: Users can manage characters only for projects they own.
6. `story_concepts`: Users can manage story concepts only for projects they own.
7. `seasons`: Users can manage seasons only for projects they own.
8. `episodes`: Users can manage episodes only for projects they own.
9. `scenes`: Users can manage scenes only for projects they own.
10. `script_versions`: Users can manage script versions only for scenes within projects they own.
11. `agent_project_configs`: Users can manage agent configurations only for projects they own.
12. `production_tasks`: Users can manage production tasks only for projects they own.
13. `agent_execution_logs`: Users can view and record logs only for projects they own.
14. `assets`: Users can view, insert, update, and delete media assets only for projects they own.
15. `pipeline_jobs`: Users can manage autonomous pipeline jobs only for projects they own.
16. `pipeline_job_logs`: Users can view and add job logs only for projects they own.
17. `export_packages`: Users can manage master export packages only for projects they own.
18. `subscriptions`: Users can view and manage only their own subscription records (`auth.uid() = user_id`).
19. `credit_transactions`: Users can view only their own immutable credit transactions (`auth.uid() = user_id`). Server-only writes.
20. `payment_orders`: Users can view and create only their own payment orders (`auth.uid() = user_id`).
21. `workspaces`: Owners can manage workspaces, and registered members can view workspaces they belong to.
22. `workspace_members`: Workspace owners can manage member rosters, and members can view fellow members.
23. `workspace_invites`: Workspace owners can issue invites, and recipients can look up invites via token.
24. `marketplace_templates`: Publicly readable by all users; only authors or admins can modify.
25. `character_marketplace_packs`: Publicly readable; authors can manage their packs.
26. `creator_social_connections`: Strictly creator-isolated (`auth.uid() = user_id`). Tokens never exposed publicly.
27. `publishing_jobs`: Strictly creator-isolated (`auth.uid() = user_id`). Workers update via `service_role`.
28. `oauth_state_transactions`: Single-use state verification. Client read restricted.
29. `creator_analytics_snapshots`: Strictly creator-isolated (`auth.uid() = user_id`). Server-only writes.
30. `creator_analytics_sync_jobs`: Creator-isolated; background sync execution via `service_role`.
31. `credit_reservations`: Strictly creator-isolated (`auth.uid() = user_id`). Managed via atomic RPC functions.
32. `ai_usage_records`: Strictly creator-isolated (`auth.uid() = user_id`). Server-only telemetry inserts.
