-- ============================================================================
-- WILLSHOP OS — MIGRATION 20260928000004: DELIVERY HARDENING
-- Adds full delivery timestamps, failure reason, recipient name, and RLS indexes
-- ============================================================================

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rescheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failure_reason VARCHAR(255),
  ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Index for Driver & Dispatcher delivery lookups
CREATE INDEX IF NOT EXISTS idx_deliveries_org_driver_status
  ON public.deliveries (organization_id, driver_id, status);

CREATE INDEX IF NOT EXISTS idx_deliveries_org_created
  ON public.deliveries (organization_id, created_at DESC);
