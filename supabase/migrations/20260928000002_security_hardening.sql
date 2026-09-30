-- ============================================================================
-- WILLSHOP OS — MIGRATION 20260928000002: SECURITY HARDENING
-- Adds invitation tokens and expiration timestamps to team_employees
-- ============================================================================

ALTER TABLE public.team_employees
  ADD COLUMN IF NOT EXISTS invitation_token VARCHAR(255),
  ADD COLUMN IF NOT EXISTS invitation_expires_at TIMESTAMPTZ;

-- INDEX FOR FAST INVITATION TOKEN LOOKUP
CREATE INDEX IF NOT EXISTS idx_team_employees_invitation_token
  ON public.team_employees (invitation_token)
  WHERE invitation_token IS NOT NULL;

-- AUTO-FIX: Generate tokens for existing pending invitations
UPDATE public.team_employees
SET 
  invitation_token = 'inv_' || replace(gen_random_uuid()::text, '-', ''),
  invitation_expires_at = NOW() + INTERVAL '72 hours'
WHERE invitation_token IS NULL AND user_id IS NULL;
