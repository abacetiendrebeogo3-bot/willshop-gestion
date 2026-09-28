-- ============================================================================
-- WILLSHOP OS — MIGRATION 20260928000003: COMMERCIAL CORE HARDENING
-- Enhances customer assignment, conversation intent tracking, and engagement performance
-- ============================================================================

-- 1. Add assigned_commercial_id to customers table
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS assigned_commercial_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS default_delivery_neighborhood VARCHAR(255);

-- 2. Add order_intent_status & last_engagement_at to whatsapp_conversations
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS order_intent_status VARCHAR(50) DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS last_engagement_at TIMESTAMPTZ;

-- 3. Indexes for fast commercial workspace queries
CREATE INDEX IF NOT EXISTS idx_customers_assigned_commercial
  ON public.customers (organization_id, assigned_commercial_id)
  WHERE assigned_commercial_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_engagements_assigned_due
  ON public.customer_engagements (organization_id, assigned_to, status, due_at);

CREATE INDEX IF NOT EXISTS idx_conversations_intent
  ON public.whatsapp_conversations (organization_id, order_intent_status);
