-- ============================================================================
-- WILLSHOP OS — MIGRATION 20260928000001: WORKFLOW SCHEDULER & COMMERCIAL FOLLOWUPS
-- Enables scheduled follow-up execution, commercial task creation, and stop condition tracking
-- ============================================================================

-- 1. ADD SCHEDULING & CONTEXT COLUMNS TO AUTOMATION EXECUTIONS
ALTER TABLE public.automation_executions
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS step_key VARCHAR(100),
  ADD COLUMN IF NOT EXISTS workflow_run_id UUID,
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.whatsapp_conversations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stop_reason VARCHAR(255);

-- 2. CREATE INDEXES FOR HIGH-PERFORMANCE WORKER QUERIES
CREATE INDEX IF NOT EXISTS idx_automation_exec_scheduled 
  ON public.automation_executions (organization_id, status, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_automation_exec_run_id 
  ON public.automation_executions (organization_id, workflow_run_id);

CREATE INDEX IF NOT EXISTS idx_customer_engagements_assigned_status 
  ON public.customer_engagements (organization_id, assigned_to, status, due_at);

-- 3. ENSURE RLS POLICIES REMAIN STRICT FOR TENANT ISOLATION
ALTER TABLE public.automation_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_engagements ENABLE ROW LEVEL SECURITY;
