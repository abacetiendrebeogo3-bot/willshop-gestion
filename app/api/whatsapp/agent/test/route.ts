import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/src/infrastructure/supabase/server';
import { AnthropicAIGateway } from '@/src/infrastructure/ai/AnthropicAIGateway';
import { SalesAgentService, SalesAgentContextService } from '@/src/application/services/SalesAgentService';
import { AIToolsRegistry } from '@/src/application/services/AIToolsRegistry';
import { SupabaseProductRepository } from '@/src/infrastructure/repositories/SupabaseDataCoreRepositories';
import { InMemoryOrderRepository } from '@/src/infrastructure/repositories/InMemoryDataCoreRepositories';
import { CreateOrderService } from '@/src/application/services/OrderStockApplicationServices';
import { SupabaseAuditRepository, SupabaseEventRepository } from '@/src/infrastructure/repositories/SupabaseRepositories';
import { getRequiredEnv } from '@/src/config/env';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    let supabaseUrl = '';
    let serviceKey = '';
    try {
      supabaseUrl = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');
      serviceKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    } catch (envErr) {
      console.error('[Config Error] Configuration Supabase manquante dans /api/whatsapp/agent/test:', envErr);
      return NextResponse.json(
        { error: 'Configuration serveur manquante (variables d\'environnement non définies).' },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // 1. Authenticate user
    let user = null;
    try {
      const supabaseUserClient = await createServerSupabaseClient();
      const { data: cookieAuthData } = await supabaseUserClient.auth.getUser();
      if (cookieAuthData?.user) {
        user = cookieAuthData.user;
      }
    } catch {}

    if (!user) {
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7).trim();
        const { data: tokenAuthData } = await supabaseAdmin.auth.getUser(token);
        if (tokenAuthData?.user) {
          user = tokenAuthData.user;
        }
      }
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Session non authentifiée. Veuillez vous reconnecter.' },
        { status: 401 }
      );
    }

    // 2. Resolve organization_id server-side
    const { data: userRoles } = await supabaseAdmin
      .from('user_organization_roles')
      .select('organization_id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order("created_at", { ascending: true });

    const organizationId = userRoles?.[0]?.organization_id;
    if (!organizationId) {
      return NextResponse.json(
        { error: 'Aucune organisation valide associée à cet utilisateur.' },
        { status: 403 }
      );
    }

    // 3. Verify Anthropic API Key
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey || !anthropicApiKey.trim()) {
      return NextResponse.json({
        error: 'Agent IA non configuré — ANTHROPIC_API_KEY manquante dans l\'environnement Vercel.',
      }, { status: 400 });
    }

    // 4. Parse user test message
    const body = await request.json();
    const { messageText } = body;

    if (!messageText || !messageText.trim()) {
      return NextResponse.json({ error: 'Message test requis.' }, { status: 400 });
    }

    // 5. Fetch org settings and active products
    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('settings')
      .eq('id', organizationId)
      .single();

    const aiConfig = org?.settings?.ai_agent_config || {};

    const { data: prodRows } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('status', 'ACTIVE');

    const availableProducts = (prodRows || []).map((p) => ({
      id: p.id,
      organizationId,
      sku: p.sku || 'SKU-001',
      name: p.name,
      category: p.category || 'GENERAL',
      purchasePrice: Number(p.purchase_price || 0),
      sellingPrice: Number(p.selling_price || 0),
      currency: 'XOF',
      minimumStock: Number(p.minimum_stock || 5),
      unit: p.unit || 'unités',
      status: p.status || 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    // 6. Set up Repositories and Services for Tools Execution
    const productRepo = new SupabaseProductRepository(supabaseAdmin);
    const orderRepo = new InMemoryOrderRepository();
    const auditRepo = new SupabaseAuditRepository(supabaseAdmin);
    const eventRepo = new SupabaseEventRepository(supabaseAdmin);
    const createOrderService = new CreateOrderService(orderRepo, productRepo, auditRepo, eventRepo);
    const toolsRegistry = new AIToolsRegistry(productRepo, orderRepo, createOrderService);

    const aiGateway = new AnthropicAIGateway(anthropicApiKey);
    const contextService = new SalesAgentContextService();
    const salesAgentService = new SalesAgentService(aiGateway, contextService, toolsRegistry);

    const mockCustomer: any = {
      id: 'cust_test_playground',
      organizationId,
      firstName: 'Client',
      lastName: 'Test',
      fullName: 'Client Test',
      phone: '+22670000000',
      city: 'Ouagadougou',
      source: 'PLAYGROUND',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockMessages: any[] = [
      {
        id: `msg_test_${Date.now()}`,
        organizationId,
        conversationId: 'conv_test_playground',
        direction: 'INBOUND',
        senderType: 'CUSTOMER',
        senderId: '+22670000000',
        messageType: 'TEXT',
        content: messageText.trim(),
        status: 'RECEIVED',
        createdAt: new Date(),
      },
    ];

    // 7. Execute real Anthropic completion
    const aiResult = await salesAgentService.generateResponse(
      mockCustomer,
      mockMessages,
      availableProducts,
      organizationId,
      aiConfig
    );

    return NextResponse.json({
      success: true,
      responseText: aiResult.responseText,
      triggerHandoff: aiResult.triggerHandoff,
      confidence: aiResult.confidence,
    });
  } catch (error: any) {
    console.error('Error in POST /api/whatsapp/agent/test:', error);
    return NextResponse.json(
      { error: `Erreur Agent IA Anthropic : ${error.message}` },
      { status: 500 }
    );
  }
}
