-- WILLShop OS V2 Core Foundations Migration
-- Migration: 20260924000001_v2_core_foundations.sql
-- Description: Phase 0 tables for Customer Engagements, Work Routines, Workflow Stack States, Internal Messaging, and Unified Notifications

-- ============================================================================
-- 1. TABLE : customer_engagements (Engagements Clients)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.customer_engagements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.whatsapp_conversations(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  due_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  priority VARCHAR(20) NOT NULL DEFAULT 'IMPORTANT',
  source VARCHAR(50) NOT NULL DEFAULT 'COMMERCIAL_MANUAL',
  evidence JSONB DEFAULT '{}'::jsonb,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_engagement_status CHECK (status IN ('PENDING', 'COMPLETED', 'POSTPONED', 'CANCELLED', 'OVERDUE')),
  CONSTRAINT check_engagement_priority CHECK (priority IN ('URGENT', 'IMPORTANT', 'NORMAL'))
);

-- ============================================================================
-- 2. TABLES : work_routines & routine_steps (Suivi des Routines Guidées)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.work_routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  routine_type VARCHAR(50) NOT NULL,
  routine_date DATE NOT NULL DEFAULT CURRENT_DATE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status VARCHAR(50) NOT NULL DEFAULT 'IN_PROGRESS',
  total_actions_planned INT NOT NULL DEFAULT 0,
  total_actions_completed INT NOT NULL DEFAULT 0,
  total_actions_postponed INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_routine_status CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'INTERRUPTED', 'ABANDONED'))
);

CREATE TABLE IF NOT EXISTS public.routine_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id UUID NOT NULL REFERENCES public.work_routines(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  step_key VARCHAR(100) NOT NULL,
  step_order INT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  planned_items_count INT NOT NULL DEFAULT 0,
  completed_items_count INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. TABLE : workflow_stack_states (Pile d'Interruption & Reprise)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.workflow_stack_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  routine_id UUID NOT NULL REFERENCES public.work_routines(id) ON DELETE CASCADE,
  paused_step VARCHAR(100) NOT NULL,
  step_context JSONB DEFAULT '{}'::jsonb,
  interruption_reason VARCHAR(255) NOT NULL,
  interruption_entity_type VARCHAR(50),
  interruption_entity_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  paused_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 4. TABLES : internal_threads, internal_thread_participants & internal_messages
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.internal_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title VARCHAR(255),
  related_entity_type VARCHAR(50),
  related_entity_id UUID,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.internal_thread_participants (
  thread_id UUID NOT NULL REFERENCES public.internal_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (thread_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.internal_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES public.internal_threads(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type VARCHAR(50) NOT NULL DEFAULT 'TEXT',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 5. TABLE : user_notifications (Notifications Unifiées)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'INFO',
  source_type VARCHAR(50) NOT NULL,
  source_id UUID,
  deep_link VARCHAR(500),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  CONSTRAINT check_notification_priority CHECK (priority IN ('CRITICAL', 'URGENT', 'INFO'))
);

-- ============================================================================
-- INDEXES DE PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_engagements_org_due ON public.customer_engagements(organization_id, due_at, status);
CREATE INDEX IF NOT EXISTS idx_routines_user_date ON public.work_routines(organization_id, user_id, routine_date);
CREATE INDEX IF NOT EXISTS idx_routine_steps_routine ON public.routine_steps(routine_id, step_order);
CREATE INDEX IF NOT EXISTS idx_stack_active ON public.workflow_stack_states(user_id, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_thread_participants_user ON public.internal_thread_participants(user_id, thread_id);
CREATE INDEX IF NOT EXISTS idx_internal_messages_thread ON public.internal_messages(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read ON public.user_notifications(recipient_id, read_at) WHERE read_at IS NULL;

-- ============================================================================
-- RLS (ROW LEVEL SECURITY)
-- ============================================================================
ALTER TABLE public.customer_engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_stack_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_thread_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_engagements ON public.customer_engagements
  FOR ALL USING (organization_id IN (
    SELECT organization_id FROM public.user_organization_roles WHERE user_id = auth.uid() AND deleted_at IS NULL
  ));

CREATE POLICY tenant_isolation_routines ON public.work_routines
  FOR ALL USING (organization_id IN (
    SELECT organization_id FROM public.user_organization_roles WHERE user_id = auth.uid() AND deleted_at IS NULL
  ));

CREATE POLICY tenant_isolation_routine_steps ON public.routine_steps
  FOR ALL USING (organization_id IN (
    SELECT organization_id FROM public.user_organization_roles WHERE user_id = auth.uid() AND deleted_at IS NULL
  ));

CREATE POLICY tenant_isolation_workflow_stack ON public.workflow_stack_states
  FOR ALL USING (organization_id IN (
    SELECT organization_id FROM public.user_organization_roles WHERE user_id = auth.uid() AND deleted_at IS NULL
  ));

CREATE POLICY tenant_isolation_threads ON public.internal_threads
  FOR ALL USING (organization_id IN (
    SELECT organization_id FROM public.user_organization_roles WHERE user_id = auth.uid() AND deleted_at IS NULL
  ));

CREATE POLICY tenant_isolation_participants ON public.internal_thread_participants
  FOR ALL USING (organization_id IN (
    SELECT organization_id FROM public.user_organization_roles WHERE user_id = auth.uid() AND deleted_at IS NULL
  ));

CREATE POLICY tenant_isolation_messages ON public.internal_messages
  FOR ALL USING (organization_id IN (
    SELECT organization_id FROM public.user_organization_roles WHERE user_id = auth.uid() AND deleted_at IS NULL
  ));

CREATE POLICY tenant_isolation_notifications ON public.user_notifications
  FOR ALL USING (organization_id IN (
    SELECT organization_id FROM public.user_organization_roles WHERE user_id = auth.uid() AND deleted_at IS NULL
  ));
