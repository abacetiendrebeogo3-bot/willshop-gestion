/**
 * WILLShop OS — Superviseur commercial : tests du moteur de règles.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateConversation,
  buildSupervisorAlerts,
  promiseDueDate,
  SupervisorConversationInput,
} from '../src/application/services/SupervisorEngine.js';

const NOW = new Date('2026-10-22T16:00:00Z');
const ago = (min: number) => new Date(NOW.getTime() - min * 60 * 1000);
const H = 60;
const D = 24 * H;

function conv(partial: Partial<SupervisorConversationInput>): SupervisorConversationInput {
  return {
    conversationId: 'c1',
    customerId: 'cu1',
    customerName: 'Awa Ouedraogo',
    customerPhone: '+22670000000',
    messages: [],
    orders: [],
    ...partial,
  };
}

describe('SupervisorEngine', () => {
  test('nouveau prospect jamais répondu → JAMAIS_CONTACTE urgent', () => {
    const a = evaluateConversation(conv({ messages: [{ direction: 'INBOUND', content: 'Bonsoir le prix ?', createdAt: ago(40) }] }), NOW);
    assert.equal(a?.type, 'JAMAIS_CONTACTE');
    assert.equal(a?.priority, 'URGENT');
    assert.ok(a?.whatsappLink.startsWith('https://wa.me/22670000000?text='));
    assert.ok(a?.suggestedMessage.startsWith('Bonjour Awa'));
  });

  test('client qui attend depuis 3h → NON_REPONDU urgent', () => {
    const a = evaluateConversation(conv({ messages: [
      { direction: 'INBOUND', content: 'Bonjour', createdAt: ago(5 * H) },
      { direction: 'OUTBOUND', content: 'Bonjour, oui ?', createdAt: ago(4 * H) },
      { direction: 'INBOUND', content: 'Vous livrez à Tampouy ?', createdAt: ago(3 * H) },
    ] }), NOW);
    assert.equal(a?.type, 'NON_REPONDU');
    assert.equal(a?.priority, 'URGENT');
  });

  test('simple "merci" du client → pas d alerte', () => {
    const a = evaluateConversation(conv({ messages: [
      { direction: 'OUTBOUND', content: 'Votre commande arrive', createdAt: ago(3 * H) },
      { direction: 'INBOUND', content: 'Ok merci', createdAt: ago(2 * H) },
    ] }), NOW);
    assert.equal(a, null);
  });

  test('message de moins de 15 min → pas encore d alerte', () => {
    const a = evaluateConversation(conv({ messages: [{ direction: 'INBOUND', content: 'Le prix ?', createdAt: ago(5) }] }), NOW);
    assert.equal(a, null);
  });

  test('promesse "demain" échue → PROMESSE_ECHUE', () => {
    const a = evaluateConversation(conv({ messages: [
      { direction: 'INBOUND', content: 'combien le kit ?', createdAt: ago(2 * D) },
      { direction: 'OUTBOUND', content: '6500F', createdAt: ago(2 * D - 10) },
      { direction: 'INBOUND', content: 'Je vais prendre demain', createdAt: ago(2 * D - 20) },
      { direction: 'OUTBOUND', content: "D'accord", createdAt: ago(2 * D - 25) },
    ] }), NOW);
    assert.equal(a?.type, 'PROMESSE_ECHUE');
  });

  test('intéressé puis silence 8h → INTERESSE_SANS_COMMANDE', () => {
    const a = evaluateConversation(conv({ messages: [
      { direction: 'INBOUND', content: 'Quel est le prix ?', createdAt: ago(9 * H) },
      { direction: 'OUTBOUND', content: '6500F livraison 1000F', createdAt: ago(8 * H) },
    ] }), NOW);
    assert.equal(a?.type, 'INTERESSE_SANS_COMMANDE');
  });

  test('commande en cours récente → aucune relance', () => {
    const a = evaluateConversation(conv({
      messages: [
        { direction: 'INBOUND', content: 'Le prix ?', createdAt: ago(9 * H) },
        { direction: 'OUTBOUND', content: '6500F', createdAt: ago(8 * H) },
      ],
      orders: [{ status: 'CONFIRMED', createdAt: ago(2 * H), updatedAt: ago(2 * H) }],
    }), NOW);
    assert.equal(a, null);
  });

  test('commande confirmée depuis 2 jours → COMMANDE_BLOQUEE', () => {
    const a = evaluateConversation(conv({ orders: [{ status: 'CONFIRMED', createdAt: ago(2 * D), updatedAt: ago(2 * D) }] }), NOW);
    assert.equal(a?.type, 'COMMANDE_BLOQUEE');
  });

  test('livré il y a 8 jours sans échange → FIDELISATION', () => {
    const a = evaluateConversation(conv({
      messages: [{ direction: 'OUTBOUND', content: 'Livré ✅', createdAt: ago(9 * D) }],
      orders: [{ status: 'DELIVERED', createdAt: ago(9 * D), updatedAt: ago(8 * D) }],
    }), NOW);
    assert.equal(a?.type, 'FIDELISATION');
  });

  test('contact ignoré (perso) ou mis en pause → aucune alerte', () => {
    const msgs = [{ direction: 'INBOUND' as const, content: 'Tu es où ?', createdAt: ago(3 * H) }];
    assert.equal(evaluateConversation(conv({ messages: msgs, ignored: true }), NOW), null);
    assert.equal(evaluateConversation(conv({ messages: msgs, snoozeUntil: new Date(NOW.getTime() + H * 60000) }), NOW), null);
  });

  test('tri : urgent en premier', () => {
    const alerts = buildSupervisorAlerts([
      conv({ conversationId: 'silence', messages: [{ direction: 'OUTBOUND', content: 'Bonjour', createdAt: ago(2 * D) }] }),
      conv({ conversationId: 'urgent', messages: [{ direction: 'INBOUND', content: 'Allo ?', createdAt: ago(3 * H) }] }),
    ], NOW);
    assert.equal(alerts[0].conversationId, 'urgent');
    assert.equal(alerts.length, 2);
  });

  test('promiseDueDate', () => {
    const t = ago(0);
    assert.equal(promiseDueDate('je prends demain', t).getTime() - t.getTime(), D * 60000);
    assert.equal(promiseDueDate('après-demain', t).getTime() - t.getTime(), 2 * D * 60000);
  });
});
