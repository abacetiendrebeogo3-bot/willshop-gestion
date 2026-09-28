-- ============================================================================
-- WILLSHOP OS — MIGRATION 20260928000005: WHATSAPP & CONVERSATIONS UNIFICATION
-- Unified schema for conversations, message history, intent status, and RLS
-- ============================================================================

-- 1. Ensure conversations table has all required columns
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS order_intent_status VARCHAR(50) DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS last_engagement_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assigned_commercial_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. Create high-performance indexes for conversation queries
CREATE INDEX IF NOT EXISTS idx_conversations_org_intent
  ON public.conversations (organization_id, order_intent_status);

CREATE INDEX IF NOT EXISTS idx_conversations_org_commercial
  ON public.conversations (organization_id, assigned_commercial_id);

CREATE INDEX IF NOT EXISTS idx_conversations_org_user
  ON public.conversations (organization_id, assigned_user_id);

CREATE INDEX IF NOT EXISTS idx_messages_conv_created
  ON public.messages (conversation_id, created_at ASC);

-- 3. Create or replace view for backward compatibility with whatsapp_conversations table queries
CREATE OR REPLACE VIEW public.whatsapp_conversations_view AS
SELECT
  c.id,
  c.organization_id,
  c.customer_id,
  c.whatsapp_number_id,
  c.external_conversation_id,
  c.status,
  c.channel,
  c.assigned_user_id,
  c.assigned_commercial_id,
  c.assigned_agent,
  c.order_intent_status,
  c.last_message_at,
  c.last_engagement_at,
  c.unread_count,
  c.priority,
  c.metadata,
  c.created_at,
  c.updated_at,
  cust.phone AS phone_number,
  CONCAT(cust.first_name, ' ', COALESCE(cust.last_name, '')) AS customer_name
FROM public.conversations c
LEFT JOIN public.customers cust ON cust.id = c.customer_id;
