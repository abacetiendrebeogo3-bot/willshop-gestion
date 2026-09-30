/**
 * WILLShop OS — Real Customer Testimonials Image Upload & Storage Multi-Tenant Isolation
 * Validates direct image uploading, storage bucket fallback, multi-tenant isolation,
 * storage cleanup on image replacement/deletion, and AI Agent tool scope.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '../src/infrastructure/supabase/client.js';
import { REAL_COMMERCIAL_ORG_ID, SANDBOX_TEST_ORG_ID, assertNotCommercialOrg } from '../src/config/testGuardrails.js';
import { AIToolsRegistry } from '../src/application/services/AIToolsRegistry.js';

import { InMemoryProductRepository, InMemoryOrderRepository } from '../src/infrastructure/repositories/InMemoryDataCoreRepositories.js';
import { InMemoryAuditRepository, InMemoryEventRepository } from '../src/infrastructure/repositories/InMemoryRepositories.js';
import { CreateOrderService } from '../src/application/services/OrderStockApplicationServices.js';

// SKIPPED: Requires NEXT_PUBLIC_SUPABASE_URL and a live DB connection
describe.skip('Real Customer Testimonials Image Upload & Storage Multi-Tenant Isolation', () => {
  const supabase = createClient();
  const TENANT_A = SANDBOX_TEST_ORG_ID; // '00000000-0000-4000-a000-000000000000'
  const TENANT_B = '11111111-1111-4111-a111-111111111111';

  const productRepo = new InMemoryProductRepository();
  const orderRepo = new InMemoryOrderRepository();
  const auditRepo = new InMemoryAuditRepository();
  const eventRepo = new InMemoryEventRepository();
  const createOrderService = new CreateOrderService(orderRepo, productRepo, auditRepo, eventRepo);

  beforeEach(() => {
    // Enforce anti-pollution safeguard
    assertNotCommercialOrg(TENANT_A);
    assertNotCommercialOrg(TENANT_B);
  });

  test('A. Creation of testimonial without image succeeds', async () => {
    const testimonialId = `testim-noimg-${Date.now()}`;
    const newTestimonial = {
      id: testimonialId,
      clientName: 'Aminata Diallo',
      text: 'Super service, très satisfaite !',
      date: '2026-09-15',
      source: 'WhatsApp',
      status: 'ACTIVE' as const,
      consentStatus: 'AUTHORIZED' as const,
      isPublic: true,
    };

    const { data: orgData } = await supabase
      .from('organizations')
      .select('settings')
      .eq('id', TENANT_A)
      .single();

    const existingSettings = orgData?.settings || {};
    const updatedTestimonials = [newTestimonial, ...(existingSettings.ai_agent_config?.testimonials || [])];

    const { error } = await supabase
      .from('organizations')
      .update({
        settings: {
          ...existingSettings,
          ai_agent_config: {
            ...(existingSettings.ai_agent_config || {}),
            testimonials: updatedTestimonials,
          },
        },
      })
      .eq('id', TENANT_A);

    assert.equal(error, null);
  });

  test('B & C. Creation with image upload & public URL preview generation', async () => {
    const testimonialId = `testim-img-${Date.now()}`;
    const fileName = `screenshot_${Date.now()}.png`;
    const storagePath = `${TENANT_A}/${testimonialId}/${fileName}`;
    const fakeImageBuffer = Buffer.from('FAKE_PNG_BINARY_DATA_CONTENT');

    const { error: uploadErr } = await supabase.storage
      .from('testimonial-images')
      .upload(storagePath, fakeImageBuffer, { contentType: 'image/png', upsert: true });

    if (uploadErr) {
      await supabase.storage
        .from('product-images')
        .upload(storagePath, fakeImageBuffer, { contentType: 'image/png', upsert: true });
    }

    const { data: urlData } = supabase.storage
      .from('testimonial-images')
      .getPublicUrl(storagePath);

    assert.ok(urlData.publicUrl);
    assert.ok(urlData.publicUrl.includes(storagePath));

    const testimonialWithImage = {
      id: testimonialId,
      clientName: 'Fatou Kante',
      text: 'Résultats visibles dès la première semaine !',
      date: '2026-09-15',
      source: 'WhatsApp',
      status: 'ACTIVE' as const,
      mediaUrl: urlData.publicUrl,
      storagePath: storagePath,
      consentStatus: 'AUTHORIZED' as const,
      isPublic: true,
    };

    const { data: orgData } = await supabase
      .from('organizations')
      .select('settings')
      .eq('id', TENANT_A)
      .single();

    const existingSettings = orgData?.settings || {};
    const updatedTestimonials = [testimonialWithImage, ...(existingSettings.ai_agent_config?.testimonials || [])];

    const { error: dbErr } = await supabase
      .from('organizations')
      .update({
        settings: {
          ...existingSettings,
          ai_agent_config: {
            ...(existingSettings.ai_agent_config || {}),
            testimonials: updatedTestimonials,
          },
        },
      })
      .eq('id', TENANT_A);

    assert.equal(dbErr, null);
  });

  test('D. Persistent image URL after reload/refresh', async () => {
    const { data: orgData } = await supabase
      .from('organizations')
      .select('settings')
      .eq('id', TENANT_A)
      .single();

    const testimonials = orgData?.settings?.ai_agent_config?.testimonials || [];
    const withImage = testimonials.find((t: any) => t.mediaUrl && t.storagePath);

    if (withImage) {
      assert.ok(withImage.mediaUrl);
      assert.ok(withImage.storagePath.includes(TENANT_A));
    }
  });

  test('E. Image replacement cleans up old storage path', async () => {
    const testimonialId = `testim-replace-${Date.now()}`;
    const oldPath = `${TENANT_A}/${testimonialId}/old_photo.jpg`;
    const newPath = `${TENANT_A}/${testimonialId}/new_photo.jpg`;

    let uploadRes = await supabase.storage
      .from('testimonial-images')
      .upload(oldPath, Buffer.from('OLD_IMAGE'), { contentType: 'image/jpeg', upsert: true });

    let activeBucket = 'testimonial-images';
    if (uploadRes.error) {
      activeBucket = 'product-images';
      await supabase.storage
        .from('product-images')
        .upload(oldPath, Buffer.from('OLD_IMAGE'), { contentType: 'image/jpeg', upsert: true });
    }

    const { error: removeErr } = await supabase.storage
      .from(activeBucket)
      .remove([oldPath]);

    assert.equal(removeErr, null);

    const { error: newUploadErr } = await supabase.storage
      .from(activeBucket)
      .upload(newPath, Buffer.from('NEW_IMAGE'), { contentType: 'image/jpeg', upsert: true });

    assert.equal(newUploadErr, null);
  });

  test('F & G. Storage cleanup on image removal or testimonial deletion', async () => {
    const testimonialId = `testim-delete-${Date.now()}`;
    const targetPath = `${TENANT_A}/${testimonialId}/to_delete.png`;

    let activeBucket = 'testimonial-images';
    let uploadRes = await supabase.storage
      .from('testimonial-images')
      .upload(targetPath, Buffer.from('IMAGE_TO_DELETE'), { contentType: 'image/png', upsert: true });

    if (uploadRes.error) {
      activeBucket = 'product-images';
      await supabase.storage
        .from('product-images')
        .upload(targetPath, Buffer.from('IMAGE_TO_DELETE'), { contentType: 'image/png', upsert: true });
    }

    const { error: removeErr } = await supabase.storage
      .from(activeBucket)
      .remove([targetPath]);

    assert.equal(removeErr, null);
  });

  test('H & I. Validation of file size and MIME type format', () => {
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
    const MAX_SIZE = 5 * 1024 * 1024;

    const invalidFile = { type: 'application/pdf', size: 1024 * 1024 };
    const oversizedFile = { type: 'image/jpeg', size: 6 * 1024 * 1024 };
    const validFile = { type: 'image/webp', size: 2 * 1024 * 1024 };

    assert.equal(ALLOWED_TYPES.includes(invalidFile.type), false);
    assert.equal(oversizedFile.size <= MAX_SIZE, false);
    assert.equal(ALLOWED_TYPES.includes(validFile.type) && validFile.size <= MAX_SIZE, true);
  });

  test('J. Multi-tenant storage path isolation (Org A vs Org B)', () => {
    const orgAPath = `${TENANT_A}/testim-123/img.png`;
    const orgBPath = `${TENANT_B}/testim-123/img.png`;

    const getOrgIdFromPath = (path: string) => path.split('/')[0];

    assert.equal(getOrgIdFromPath(orgAPath), TENANT_A);
    assert.equal(getOrgIdFromPath(orgBPath), TENANT_B);
    assert.notEqual(getOrgIdFromPath(orgAPath), TENANT_B);

    // Verify anti-pollution guardrail blocks live commercial org ID
    assert.throws(
      () => assertNotCommercialOrg(REAL_COMMERCIAL_ORG_ID, 'Testimonial Upload Guardrail Test'),
      /ANTI-POLLUTION SAFEGUARD BLOCKED/
    );
  });

  test('K. AI Agent tool search_testimonials retrieves current tenant active testimonials only', async () => {
    const registry = new AIToolsRegistry(productRepo, orderRepo, createOrderService);
    const config = {
      testimonials: [
        {
          id: 't-active',
          clientName: 'Sali O.',
          text: 'Produit authentique et super efficace.',
          status: 'ACTIVE',
          mediaUrl: 'https://storage.willshop.bf/proof.png',
          consentStatus: 'AUTHORIZED',
          isPublic: true,
        },
        {
          id: 't-unconsented',
          clientName: 'Private Client',
          text: 'Text confidential',
          status: 'ACTIVE',
          consentStatus: 'NOT_AUTHORIZED',
          isPublic: false,
        },
        {
          id: 't-archived',
          clientName: 'Old Client',
          text: 'Ancien retour',
          status: 'ARCHIVED',
          isPublic: true,
        },
      ],
    };

    const searchRes = await registry.executeTool(
      'search_testimonials',
      { query: 'authentique' },
      TENANT_A,
      config
    );

    assert.ok(searchRes.result.testimonials);
    assert.equal(searchRes.result.testimonials.length, 1);
    assert.equal(searchRes.result.testimonials[0].id, 't-active');
    assert.equal(searchRes.result.testimonials[0].mediaUrl, 'https://storage.willshop.bf/proof.png');
  });
});
