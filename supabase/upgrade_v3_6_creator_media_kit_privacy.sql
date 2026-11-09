-- ============================================================================
-- AI MOVIE FACTORY - PHASE 15 SPRINT 3: CREATOR MEDIA KIT PRIVACY & COLUMN HARDENING
-- Migration: upgrade_v3_6_creator_media_kit_privacy.sql
-- Description: Adds privacy controls (is_public, share_phone, share_email) to
--              creator_media_kits and establishes a sanitized public view.
-- ============================================================================

-- 1. Add privacy control columns to public.creator_media_kits
ALTER TABLE public.creator_media_kits 
    ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS share_phone BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS share_email BOOLEAN NOT NULL DEFAULT true;

-- 2. Verify RLS remains strictly restricted to the owner and platform super admins
ALTER TABLE public.creator_media_kits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own media kit" ON public.creator_media_kits;
CREATE POLICY "Users can view own media kit"
    ON public.creator_media_kits FOR SELECT
    USING (auth.uid() = user_id OR public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can upsert own media kit" ON public.creator_media_kits;
CREATE POLICY "Users can upsert own media kit"
    ON public.creator_media_kits FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 3. Dedicated Sanitized Public View for External Brand Sponsors
-- Ensures direct phone/WhatsApp numbers and non-public data are never scraped or exposed
CREATE OR REPLACE VIEW public.creator_public_media_kits AS
SELECT 
    id,
    user_id,
    studio_name,
    bio,
    primary_niche,
    location,
    rate_card_tier1,
    rate_card_tier2,
    rate_card_tier3,
    custom_pitch_hook,
    CASE WHEN share_email = true THEN contact_email ELSE NULL END AS contact_email,
    CASE WHEN share_phone = true THEN contact_phone ELSE NULL END AS contact_phone,
    updated_at
FROM public.creator_media_kits
WHERE is_public = true;

-- Grant read permission on sanitized view to anonymous visitors and authenticated users
GRANT SELECT ON public.creator_public_media_kits TO anon, authenticated;
