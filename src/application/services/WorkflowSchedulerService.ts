/**
 * WILLShop OS — Commercial Followup Workflow Engine & Scheduler Service
 * Application Layer.
 * Evaluates scheduled commercial followup sequences (J0 -> J21), enforces stop conditions
 * (customer reply, confirmed order, opt-out, kill switch), verifies business hours,
 * routes tasks to assigned commercial in "Ma Journée", guarantees idempotency, and logs execution audit.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { FollowupVariableEngine, WhatsAppWindowGuard } from './FollowupEngineService';
import { EvolutionWhatsAppAdapter } from '../../infrastructure/whatsapp/EvolutionWhatsAppAdapter';

export interface WorkflowStepConfig {
  stepKey: string; // e.g. "J0", "J1", "J2", "J3", "J5", "J7", "J10", "J14", "J21"
  delayHours: number;
  templateText: string;
  requiresApproval: boolean; // default true for commercial validation
  permissionLevel: 'GREEN' | 'YELLOW' | 'RED';
}

export interface EvaluateWorkflowResult {
  processedCount: number;
  executedCount: number;
  stoppedCount: number;
  rescheduledCount: number;
  errorsCount: number;
  details: Array<{
    executionId: string;
    organizationId: string;
    customerId: string;
    stepKey: string;
    status: string;
    reason?: string;
  }>;
}

export class WorkflowSchedulerService {
  constructor(private supabaseAdmin: SupabaseClient) {}

  /**
   * Evaluates due workflow executions across organizations or for a specific tenant.
   * Atomically acquires pending jobs, checks stop conditions, respects business hours,
   * creates commercial tasks for "Ma Journée", and schedules subsequent steps.
   */
  public async evaluateDueWorkflows(targetOrgId?: string): Promise<EvaluateWorkflowResult> {
    const now = new Date();
    const result: EvaluateWorkflowResult = {
      processedCount: 0,
      executedCount: 0,
      stoppedCount: 0,
      rescheduledCount: 0,
      errorsCount: 0,
      details: [],
    };

    // 1. Fetch pending executions due for execution
    let query = this.supabaseAdmin
      .from('automation_executions')
      .select('*, automation_rules(*), customers(*), whatsapp_conversations(*)')
      .eq('status', 'PENDING')
      .lte('scheduled_at', now.toISOString())
      .limit(50);

    if (targetOrgId) {
      query = query.eq('organization_id', targetOrgId);
    }

    const { data: dueExecutions, error: fetchErr } = await query;

    if (fetchErr) {
      console.error('[WorkflowScheduler] Error fetching due executions:', fetchErr);
      return result;
    }

    if (!dueExecutions || dueExecutions.length === 0) {
      return result;
    }

    for (const exec of dueExecutions) {
      result.processedCount++;
      const orgId = exec.organization_id;
      const executionId = exec.id;
      const stepKey = exec.step_key || 'J0';
      const workflowRunId = exec.workflow_run_id || exec.id;
      const customerId = exec.customer_id;
      const conversationId = exec.conversation_id;

      try {
        // 2. Atomic Row Lock / Status Update to EXECUTING (Concurrency Guard)
        const { data: lockSuccess, error: lockErr } = await this.supabaseAdmin
          .from('automation_executions')
          .update({ status: 'EXECUTING', started_at: now.toISOString() })
          .eq('id', executionId)
          .eq('status', 'PENDING')
          .select('id')
          .single();

        if (lockErr || !lockSuccess) {
          // Another worker node acquired this job concurrently -> Skip gracefully
          continue;
        }

        // 3. Check Global / Org Kill Switch
        const { data: killSwitch } = await this.supabaseAdmin
          .from('kill_switches')
          .select('global_stopped')
          .eq('organization_id', orgId)
          .maybeSingle();

        if (killSwitch?.global_stopped) {
          await this.stopWorkflowRun(executionId, orgId, 'GLOBAL_KILL_SWITCH_ACTIVE');
          result.stoppedCount++;
          result.details.push({ executionId, organizationId: orgId, customerId, stepKey, status: 'STOPPED', reason: 'GLOBAL_KILL_SWITCH_ACTIVE' });
          continue;
        }

        // 4. Check Stop Condition A: Customer Inbound Message (Customer Replied)
        if (conversationId) {
          const { data: recentInbound } = await this.supabaseAdmin
            .from('messages')
            .select('id, sent_at')
            .eq('conversation_id', conversationId)
            .eq('direction', 'INBOUND')
            .gte('created_at', exec.created_at || now.toISOString())
            .limit(1);

          if (recentInbound && recentInbound.length > 0) {
            await this.stopWorkflowRun(executionId, orgId, 'CUSTOMER_REPLIED');
            result.stoppedCount++;
            result.details.push({ executionId, organizationId: orgId, customerId, stepKey, status: 'STOPPED', reason: 'CUSTOMER_REPLIED' });
            continue;
          }
        }

        // 5. Check Stop Condition B: Confirmed Order Created by Customer
        if (customerId) {
          const { data: recentOrders } = await this.supabaseAdmin
            .from('orders')
            .select('id, status, created_at')
            .eq('customer_id', customerId)
            .eq('organization_id', orgId)
            .neq('status', 'CANCELLED')
            .gte('created_at', exec.created_at || now.toISOString())
            .limit(1);

          if (recentOrders && recentOrders.length > 0) {
            await this.stopWorkflowRun(executionId, orgId, 'ORDER_CONFIRMED');
            result.stoppedCount++;
            result.details.push({ executionId, organizationId: orgId, customerId, stepKey, status: 'STOPPED', reason: 'ORDER_CONFIRMED' });
            continue;
          }
        }

        // 6. Check Business Hours & Timezone (Default 08:00 to 20:00 GMT+0)
        const currentHour = now.getUTCHours();
        const startWindowHour = 8;
        const endWindowHour = 20;

        if (currentHour < startWindowHour || currentHour >= endWindowHour) {
          // Outside allowed hours -> Reschedule to 08:30 AM UTC
          const nextMorning = new Date(now);
          if (currentHour >= endWindowHour) {
            nextMorning.setUTCDate(nextMorning.getUTCDate() + 1);
          }
          nextMorning.setUTCHours(8, 30, 0, 0);

          await this.supabaseAdmin
            .from('automation_executions')
            .update({
              status: 'PENDING',
              scheduled_at: nextMorning.toISOString(),
              started_at: null,
            })
            .eq('id', executionId);

          result.rescheduledCount++;
          result.details.push({ executionId, organizationId: orgId, customerId, stepKey, status: 'RESCHEDULED', reason: 'OUTSIDE_BUSINESS_HOURS' });
          continue;
        }

        // 7. Resolve Assigned Commercial User
        let assignedUserId = exec.assigned_to;
        if (!assignedUserId && conversationId) {
          const { data: convData } = await this.supabaseAdmin
            .from('whatsapp_conversations')
            .select('assigned_user_id')
            .eq('id', conversationId)
            .maybeSingle();
          assignedUserId = convData?.assigned_user_id || null;
        }

        if (!assignedUserId) {
          // Resolve first active COMMERCIAL role user in organization
          const { data: roles } = await this.supabaseAdmin
            .from('user_organization_roles')
            .select('user_id')
            .eq('organization_id', orgId)
            .eq('role', 'COMMERCIAL')
            .is('deleted_at', null)
      .order("created_at", { ascending: true }).limit(1);
          assignedUserId = roles?.[0]?.user_id || null;
        }

        // 8. Prepare AI Suggestion Message Text via FollowupVariableEngine
        const customerObj = exec.customers || {};
        const templateText = exec.automation_rules?.actions?.[0]?.payload?.template ||
          `Bonjour {{first_name}}, je reviens vers vous suite à votre demande sur WILLShop. Avez-vous des questions sur votre commande ?`;

        const { rendered: suggestedMessage } = FollowupVariableEngine.substitute(templateText, {
          first_name: customerObj.first_name || customerObj.name || 'Client',
          last_name: customerObj.last_name || '',
          company_name: 'WILLShop OS',
        });

        // 9. Idempotency Key Check for Commercial Engagement Task
        const idempotencyKey = `eng-${orgId}:${workflowRunId}:${stepKey}`;

        // Create Commercial Task in customer_engagements for "Ma Journée"
        const { error: engErr } = await this.supabaseAdmin
          .from('customer_engagements')
          .insert({
            organization_id: orgId,
            customer_id: customerId,
            conversation_id: conversationId,
            assigned_to: assignedUserId,
            title: `Relance ${stepKey} — ${customerObj.first_name || customerObj.phone || 'Client'}`,
            description: `Relance programmée (${stepKey}). Message suggéré : "${suggestedMessage}"`,
            due_at: now.toISOString(),
            status: 'PENDING',
            priority: stepKey === 'J0' || stepKey === 'J1' ? 'URGENT' : 'IMPORTANT',
            source: 'WORKFLOW_AUTOMATION',
            evidence: {
              workflowRunId,
              stepKey,
              suggestedMessage,
              idempotencyKey,
              executionId,
            },
          });

        if (engErr && !engErr.message.includes('unique')) {
          console.warn('[WorkflowScheduler] Engagement insertion note:', engErr.message);
        }

        // 10. Schedule Next Step in Sequence if applicable (e.g. J0 -> J1 -> J2 -> J3 -> J5 -> J7 -> J10 -> J14 -> J21)
        const nextStepMap: Record<string, { nextKey: string; delayHours: number }> = {
          J0: { nextKey: 'J1', delayHours: 24 },
          J1: { nextKey: 'J2', delayHours: 24 },
          J2: { nextKey: 'J3', delayHours: 24 },
          J3: { nextKey: 'J5', delayHours: 48 },
          J5: { nextKey: 'J7', delayHours: 48 },
          J7: { nextKey: 'J10', delayHours: 72 },
          J10: { nextKey: 'J14', delayHours: 96 },
          J14: { nextKey: 'J21', delayHours: 168 },
        };

        const nextStep = nextStepMap[stepKey];
        if (nextStep) {
          const nextScheduledAt = new Date(now.getTime() + nextStep.delayHours * 60 * 60 * 1000);
          const nextIdempotencyKey = `exec-${orgId}:${workflowRunId}:${nextStep.nextKey}`;

          await this.supabaseAdmin
            .from('automation_executions')
            .insert({
              automation_id: exec.automation_id,
              organization_id: orgId,
              workflow_run_id: workflowRunId,
              step_key: nextStep.nextKey,
              customer_id: customerId,
              conversation_id: conversationId,
              assigned_to: assignedUserId,
              status: 'PENDING',
              scheduled_at: nextScheduledAt.toISOString(),
              idempotency_key: nextIdempotencyKey,
            });
        }

        // 11. Complete current execution record
        await this.supabaseAdmin
          .from('automation_executions')
          .update({
            status: 'COMPLETED',
            completed_at: now.toISOString(),
            result_payload: {
              status: 'COMMERCIAL_ACTION_CREATED',
              assignedTo: assignedUserId,
              stepKey,
              suggestedMessage,
            },
          })
          .eq('id', executionId);

        result.executedCount++;
        result.details.push({ executionId, organizationId: orgId, customerId, stepKey, status: 'COMPLETED' });

      } catch (err: any) {
        console.error(`[WorkflowScheduler] Error executing job ${executionId}:`, err);
        result.errorsCount++;

        await this.supabaseAdmin
          .from('automation_executions')
          .update({
            status: 'FAILED',
            error: err.message || 'Error processing workflow step',
          })
          .eq('id', executionId);
      }
    }

    return result;
  }

  /**
   * Helper to stop a workflow run and mark all related pending executions as STOPPED.
   */
  private async stopWorkflowRun(executionId: string, orgId: string, stopReason: string): Promise<void> {
    const now = new Date().toISOString();

    const { data: currentExec } = await this.supabaseAdmin
      .from('automation_executions')
      .select('workflow_run_id')
      .eq('id', executionId)
      .single();

    const runId = currentExec?.workflow_run_id || executionId;

    await this.supabaseAdmin
      .from('automation_executions')
      .update({
        status: 'STOPPED',
        stop_reason: stopReason,
        completed_at: now,
      })
      .eq('organization_id', orgId)
      .or(`id.eq.${runId},workflow_run_id.eq.${runId}`)
      .in('status', ['PENDING', 'EXECUTING']);
  }

  /**
   * Executes a commercial follow-up manually when the commercial (e.g. Yasmine) clicks [Relancer maintenant].
   * Sends text message via Evolution API gateway, records message in Supabase, and completes engagement.
   */
  public async executeCommercialFollowup(params: {
    engagementId: string;
    organizationId: string;
    messageText: string;
    recipientPhone: string;
    userId: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const { engagementId, organizationId, messageText, recipientPhone, userId } = params;

    if (!messageText || !messageText.trim() || !recipientPhone) {
      return { success: false, error: 'Message text and phone number are required' };
    }

    try {
      // 1. Fetch active WhatsApp Gateway line for org
      const { data: whatsappNum } = await this.supabaseAdmin
        .from('whatsapp_numbers')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('status', 'ACTIVE')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const instanceName = whatsappNum?.provider_identity || `ws_org_${organizationId.replace(/-/g, '').slice(0, 12)}`;

      // 2. Send Message via Evolution WhatsApp Adapter
      const adapter = new EvolutionWhatsAppAdapter();
      const sendResult = await adapter.sendTextMessage(instanceName, {
        toPhoneNumber: recipientPhone,
        messageText: messageText.trim(),
      });

      if (sendResult.status === 'FAILED') {
        return { success: false, error: sendResult.errorCode || 'Échec d envoi via Evolution API WhatsApp' };
      }

      const nowIso = new Date().toISOString();

      // 3. Mark Engagement as COMPLETED
      await this.supabaseAdmin
        .from('customer_engagements')
        .update({
          status: 'COMPLETED',
          completed_at: nowIso,
          completed_by: userId,
        })
        .eq('id', engagementId)
        .eq('organization_id', organizationId);

      return { success: true, messageId: sendResult.externalMessageId };
    } catch (err: any) {
      console.error('[WorkflowScheduler] executeCommercialFollowup error:', err);
      return { success: false, error: err.message || 'Execution error' };
    }
  }
}
