-- ============================================================================
-- AI MOVIE FACTORY - PHASE 15 SPRINT 3: CREATOR MEDIA KIT & COMMERCIAL PROPOSAL
-- Migration: upgrade_v3_5_creator_media_kit.sql
-- Description: Adds creator_media_kits table with strict RLS for managing
--              custom studio profiles, brand sponsorship rate cards, and pitch notes.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.creator_media_kits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    studio_name TEXT NOT NULL,
    bio TEXT,
    contact_email TEXT NOT NULL,
    contact_phone TEXT,
    primary_niche TEXT DEFAULT 'Sci-Fi Cyberpunk & Misteri Folklor',
    location TEXT DEFAULT 'Indonesia (Global Remote Production)',
    rate_card_tier1 NUMERIC DEFAULT 2500000,
    rate_card_tier2 NUMERIC DEFAULT 5000000,
    rate_card_tier3 NUMERIC DEFAULT 12500000,
    custom_pitch_hook TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT creator_media_kits_user_id_key UNIQUE (user_id)
);

-- Optimize queries by user
CREATE INDEX IF NOT EXISTS idx_creator_media_kits_user_id ON public.creator_media_kits(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.creator_media_kits ENABLE ROW LEVEL SECURITY;

-- 1. Read Policy: Creator can view own media kit or platform super admin
DROP POLICY IF EXISTS "Users can view own media kit" ON public.creator_media_kits;
CREATE POLICY "Users can view own media kit"
    ON public.creator_media_kits FOR SELECT
    USING (auth.uid() = user_id OR public.is_platform_admin(auth.uid()));

-- 2. Upsert Policy: Creator can insert or update own media kit
DROP POLICY IF EXISTS "Users can upsert own media kit" ON public.creator_media_kits;
CREATE POLICY "Users can upsert own media kit"
    ON public.creator_media_kits FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
