/**
 * WILLShop OS — Sales Agent AI Tools Registry & Executor
 * AUDIT FIX: Renamed conceptually to SalesAgentToolRegistry to distinguish from AIToolRegistry (CEO Engine).
 * AIToolsRegistry class kept for backward compatibility with existing imports.
 * New code should reference it as SalesAgentToolRegistry via the alias export below.
 * Application Layer — Defines the 9 AI Tools and executes them against Application Services & Repositories.
 * STRICT ARCHITECTURE RULE: NO DIRECT UNGOVERNED DATABASE QUERIES.
 */

import { AnthropicToolDefinition } from '../../infrastructure/ai/AnthropicAIGateway';
import { CreateOrderService } from './OrderStockApplicationServices';
import {
  IProductRepository,
  IOrderRepository,
} from '../../domain/interfaces/IDataCoreRepositories';
import { Product, Order } from '../../domain/entities/DataCoreEntities';
import { SupabaseClient } from '@supabase/supabase-js';
import { IWhatsAppProvider } from '../../domain/interfaces/IWhatsAppProvider';

export interface ToolExecutionContextOptions {
  supabase?: SupabaseClient;
  providerAdapter?: IWhatsAppProvider;
  providerIdentity?: string;
  destinationPhone?: string;
  conversationId?: string;
}

/**
 * Generic normalization function for delivery locations:
 * Removes accents (NFD), converts to lowercase, trims whitespace, and removes punctuation.
 */
export function normalizeDeliveryLocation(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export class AIToolsRegistry {
  constructor(
    private readonly productRepo: IProductRepository,
    private readonly orderRepo: IOrderRepository,
    private readonly createOrderService: CreateOrderService
  ) {}

  /**
   * Returns the Anthropic tool schemas for all 9 AI Tools.
   */
  static getToolDefinitions(): AnthropicToolDefinition[] {
    return [
      {
        name: 'search_products',
        description: 'Recherche les articles disponibles au catalogue avec leurs prix exacts et stock en temps réel.',
        input_schema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Nom ou catégorie du produit recherché' },
          },
        },
      },
      {
        name: 'check_delivery_zone',
        description: 'Vérifie les frais et la disponibilité de livraison pour un quartier ou une ville (ex: Somgandé, Kossodo, Tampouy, Benego, Ouagadougou).',
        input_schema: {
          type: 'object',
          properties: {
            district: { type: 'string', description: 'Nom du quartier ou de la zone du client (ex: Somgandé, Benego)' },
            city: { type: 'string', description: 'Ville du client (ex: Ouagadougou)' },
          },
        },
      },
      {
        name: 'get_order_status',
        description: "Consulte le statut d'avancement d'une commande client par son numéro de commande ou ID.",
        input_schema: {
          type: 'object',
          properties: {
            orderNumber: { type: 'string', description: 'Numéro de commande (ex: WS-12345)' },
          },
          required: ['orderNumber'],
        },
      },
      {
        name: 'create_order',
        description: 'Crée une nouvelle commande et réserve le stock de manière atomique. Les prix sont calculés côté serveur.',
        input_schema: {
          type: 'object',
          properties: {
            customerId: { type: 'string', description: 'ID du client' },
            productId: { type: 'string', description: 'ID du produit' },
            quantity: { type: 'number', description: 'Quantité souhaitée' },
            deliveryFee: { type: 'number', description: 'Frais de livraison appliqués' },
            notes: { type: 'string', description: 'Notes explicatives ou adresse' },
          },
          required: ['customerId', 'productId', 'quantity'],
        },
      },
      {
        name: 'update_engagement_status',
        description: "Met à jour l'étape d'engagement/qualification d'un prospect dans le CRM.",
        input_schema: {
          type: 'object',
          properties: {
            customerId: { type: 'string', description: 'ID du client' },
            status: { type: 'string', description: 'Nouveau statut (NEW, QUALIFIED, NEGOTIATION, WON)' },
          },
          required: ['customerId', 'status'],
        },
      },
      {
        name: 'escalate_to_human',
        description: 'Transfère immédiatement la conversation à un conseiller commercial humain.',
        input_schema: {
          type: 'object',
          properties: {
            reason: { type: 'string', description: 'Raison du transfert à un humain' },
          },
          required: ['reason'],
        },
      },
      {
        name: 'send_product_visual',
        description: "Récupère l'URL visuelle officielle d'un produit pour envoi au client.",
        input_schema: {
          type: 'object',
          properties: {
            productId: { type: 'string', description: 'ID du produit' },
          },
          required: ['productId'],
        },
      },
      {
        name: 'send_product_image',
        description: "Récupère et envoie la photo produit officielle au destinataire sur WhatsApp.",
        input_schema: {
          type: 'object',
          properties: {
            productId: { type: 'string', description: 'ID unique du produit' },
            toPhoneNumber: { type: 'string', description: 'Numéro WhatsApp du destinataire (optionnel)' },
            caption: { type: 'string', description: 'Légende de la photo (nom du produit et prix)' },
          },
          required: ['productId'],
        },
      },
      {
        name: 'search_testimonials',
        description: 'Consulte les témoignages et avis clients réels pour rassurer le client.',
        input_schema: {
          type: 'object',
          properties: {
            productId: { type: 'string', description: 'ID du produit concerné' },
            query: { type: 'string', description: 'Mots-clés ou objections' },
          },
        },
      },
      {
        name: 'send_testimonial',
        description: 'Envoie un témoignage client (texte ou visuel) au client sur WhatsApp.',
        input_schema: {
          type: 'object',
          properties: {
            testimonialId: { type: 'string', description: 'ID unique du témoignage' },
            toPhoneNumber: { type: 'string', description: 'Numéro WhatsApp du destinataire' },
          },
          required: ['testimonialId'],
        },
      },
      {
        name: 'get_payment_methods',
        description: "Consulte la liste des moyens de paiement autorisés et actifs de l'entreprise (Mobile Money, Virement, Paiement à la livraison) avec leurs numéros et instructions réels.",
        input_schema: {
          type: 'object',
          properties: {},
        },
      },
    ];
  }

  /**
   * Executes a tool invocation safely using Application Services.
   */
  async executeTool(
    name: string,
    args: any,
    organizationId: string,
    aiAgentConfig?: any,
    execOptions?: ToolExecutionContextOptions
  ): Promise<{ result: any; triggerHandoff?: boolean }> {
    try {
      switch (name) {
        case 'get_knowledge_base': {
          const configuredFaqs = (aiAgentConfig?.faqs || []) as any[];
          const configuredKb = (aiAgentConfig?.knowledge_base || []) as any[];
          const configuredPolicies = (aiAgentConfig?.policies || []) as any[];

          const activeFaqs = configuredFaqs.filter((f: any) => f.status === 'ACTIVE' || f.status === undefined || f.isActive === true);
          const activeKb = configuredKb.filter((k: any) => k.status === 'ACTIVE' || k.status === undefined || k.isActive === true);
          const activePol = configuredPolicies.filter((p: any) => p.status === 'ACTIVE' || p.status === undefined || p.isActive === true);

          const allEntries = [
            ...activeFaqs.map((f: any) => ({ category: f.category || 'FAQ', title: f.question, content: f.answer })),
            ...activeKb.map((k: any) => ({ category: k.category || 'ENTREPRISE', title: k.title, content: k.content })),
            ...activePol.map((p: any) => ({ category: 'POLITIQUES', title: p.title, content: p.content })),
          ];

          const reqCat = (args.category || '').toUpperCase().trim();
          const query = (args.query || '').toLowerCase().trim();

          const filtered = allEntries.filter((e) => {
            const matchesCat = !reqCat || e.category.toUpperCase().includes(reqCat);
            const matchesQuery = !query || e.title.toLowerCase().includes(query) || e.content.toLowerCase().includes(query);
            return matchesCat && matchesQuery;
          });

          if (filtered.length === 0) {
            return {
              result: {
                found: false,
                entries: [],
                message: "Aucune information correspondante trouvée dans la base de connaissances de l'entreprise.",
              },
            };
          }

          return {
            result: {
              found: true,
              entries: filtered,
            },
          };
        }

        case 'get_payment_methods': {
          const configuredMethods = (aiAgentConfig?.payment_methods || []) as any[];
          const activeMethods = configuredMethods.filter((pm: any) => pm.status === 'ACTIVE' || pm.status === undefined || pm.isActive === true);

          if (activeMethods.length === 0) {
            return {
              result: {
                found: false,
                paymentMethods: [],
                message: "Pour le moment, aucun moyen de paiement n'est configuré pour cette organisation.",
              },
            };
          }

          return {
            result: {
              found: true,
              paymentMethods: activeMethods.map((pm: any) => ({
                name: pm.name,
                identifier: pm.identifier,
                instructions: pm.instructions || '',
              })),
            },
          };
        }

        case 'search_products': {
          const products = await this.productRepo.listByOrg(organizationId);
          const query = (args.query || '').toLowerCase();
          const filtered = products.filter(
            (p: Product) =>
              p.status === 'ACTIVE' &&
              (p.name.toLowerCase().includes(query) || p.sku.toLowerCase().includes(query))
          );
          return {
            result: filtered.map((p: Product) => ({
              id: p.id,
              name: p.name,
              sku: p.sku,
              price: p.sellingPrice,
              stockAvailable: p.minimumStock,
            })),
          };
        }

        case 'check_delivery_zone': {
          const rawCity = args.city || args.district || '';
          const rawDistrict = args.district || args.city || '';

          const queryCityNorm = normalizeDeliveryLocation(rawCity);
          const queryDistrictNorm = normalizeDeliveryLocation(rawDistrict);
          const searchQueryNorm = normalizeDeliveryLocation(`${rawDistrict} ${rawCity}`);

          const configuredZones = (aiAgentConfig?.delivery_zones || []) as any[];

          // Search in real configured delivery zones with Unicode accent normalization
          const matchedZone = configuredZones.find((z: any) => {
            if (z.status === 'ARCHIVED' || z.status === 'INACTIVE') return false;

            const zoneNameNorm = normalizeDeliveryLocation(z.name || '');
            const districtsNorm = Array.isArray(z.districts)
              ? z.districts.map((d: any) => normalizeDeliveryLocation(String(d)))
              : [];

            const nameMatch = zoneNameNorm && (
              zoneNameNorm.includes(searchQueryNorm) ||
              searchQueryNorm.includes(zoneNameNorm) ||
              (queryDistrictNorm && (zoneNameNorm.includes(queryDistrictNorm) || queryDistrictNorm.includes(zoneNameNorm)))
            );

            const districtMatch = districtsNorm.some((dNorm: string) => {
              if (!dNorm) return false;
              return (
                (queryDistrictNorm && (dNorm === queryDistrictNorm || dNorm.includes(queryDistrictNorm) || queryDistrictNorm.includes(dNorm))) ||
                (searchQueryNorm && (dNorm === searchQueryNorm || dNorm.includes(searchQueryNorm) || searchQueryNorm.includes(dNorm))) ||
                (queryCityNorm && dNorm === queryCityNorm)
              );
            });

            return nameMatch || districtMatch;
          });

          if (matchedZone) {
            return {
              result: {
                found: true,
                city: args.city || 'Ouagadougou',
                district: args.district || matchedZone.name,
                zoneName: matchedZone.name,
                deliveryFee: Number(matchedZone.fee),
                fee: Number(matchedZone.fee),
                estimatedDelay: matchedZone.delay || '24h',
                eta: matchedZone.delay || '24h',
                available: true,
                notes: matchedZone.notes || '',
              },
            };
          }

          // Unlisted zone for this organization: DO NOT GUESS OR USE HARDCODED CITY FALLBACKS
          return {
            result: {
              found: false,
              city: args.city || '',
              district: args.district || 'Non répertorié',
              deliveryFee: null,
              fee: null,
              available: false,
              message: "Zone non répertoriée dans les tarifs habituels de l'entreprise. Un conseiller commercial va vérifier les frais de livraison pour votre quartier.",
            },
          };
        }

        case 'get_order_status': {
          const orders = await this.orderRepo.listByOrg(organizationId);
          const matched = orders.find((o: Order) => o.orderNumber === args.orderNumber || o.id === args.orderNumber);
          if (!matched) {
            return { result: { error: `Commande ${args.orderNumber} introuvable.` } };
          }
          return {
            result: {
              orderNumber: matched.orderNumber,
              status: matched.status,
              total: matched.total,
              createdAt: matched.createdAt,
            },
          };
        }

        case 'create_order': {
          const orderResult = await this.createOrderService.execute({
            organizationId,
            customerId: args.customerId,
            items: [{ productId: args.productId, quantity: args.quantity }],
            deliveryFee: args.deliveryFee || 1000,
            notes: args.notes || 'Commande créée par l Agent IA Commercial',
            source: 'WHATSAPP_AI',
          });

          return {
            result: {
              success: true,
              orderId: orderResult.order.id,
              orderNumber: orderResult.order.orderNumber,
              total: orderResult.order.total,
              status: orderResult.order.status,
            },
          };
        }

        case 'update_engagement_status': {
          return {
            result: {
              customerId: args.customerId,
              updatedStatus: args.status,
              success: true,
            },
          };
        }

        case 'escalate_to_human': {
          return {
            result: { handoff: true, reason: args.reason },
            triggerHandoff: true,
          };
        }

        case 'send_product_visual':
        case 'send_product_image': {
          const supabase = execOptions?.supabase;
          const providerAdapter = execOptions?.providerAdapter;
          const providerIdentity = execOptions?.providerIdentity;
          const destPhone = args.toPhoneNumber || execOptions?.destinationPhone;

          if (supabase) {
            let prodRow: any = null;
            const searchId = String(args.productId || '').trim();

            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(searchId);
            if (isUuid) {
              const { data } = await supabase
                .from('products')
                .select('id, name, selling_price, image_url')
                .eq('id', searchId)
                .eq('organization_id', organizationId)
                .maybeSingle();
              prodRow = data;
            }

            if (!prodRow) {
              const { data: matchedProds } = await supabase
                .from('products')
                .select('id, name, selling_price, image_url')
                .eq('organization_id', organizationId)
                .ilike('name', `%${searchId}%`)
                .limit(1);
              prodRow = matchedProds?.[0];
            }

            let finalMediaUrl: string | null = null;
            let primaryImg: any = null;

            if (prodRow?.id) {
              const { data: imgRows } = await supabase
                .from('product_images')
                .select('*')
                .eq('product_id', prodRow.id)
                .eq('organization_id', organizationId)
                .order('is_primary', { ascending: false });

              primaryImg = imgRows?.[0];
              if (primaryImg) {
                if (primaryImg.url && (primaryImg.url.startsWith('http://') || primaryImg.url.startsWith('https://'))) {
                  finalMediaUrl = primaryImg.url;
                } else if (primaryImg.storage_path) {
                  try {
                    const { data: signedData } = await supabase
                      .storage
                      .from('product-images')
                      .createSignedUrl(primaryImg.storage_path, 86400);

                    if (signedData?.signedUrl) {
                      finalMediaUrl = signedData.signedUrl;
                    }
                  } catch (signErr) {
                    console.warn('[AIToolsRegistry] Storage createSignedUrl warning:', signErr);
                  }
                }
              }

              if (!finalMediaUrl && prodRow.image_url && (prodRow.image_url.startsWith('http://') || prodRow.image_url.startsWith('https://'))) {
                finalMediaUrl = prodRow.image_url;
              }
            }

            if (!prodRow || !finalMediaUrl) {
              return {
                result: {
                  success: false,
                  error_code: 'NO_IMAGE_AVAILABLE',
                  message: `Aucune photo n'est disponible ou rattachée au produit ${prodRow?.name || searchId}.`,
                  productName: prodRow?.name || searchId,
                },
              };
            }

            const captionText = args.caption || `📸 ${prodRow.name} — ${prodRow.selling_price ? prodRow.selling_price.toLocaleString('fr-FR') + ' XOF' : ''}`;

            if (providerAdapter && providerIdentity && destPhone) {
              const sendRes = await providerAdapter.sendMediaMessage(providerIdentity, {
                toPhoneNumber: destPhone,
                mediaType: 'image',
                mediaUrl: finalMediaUrl,
                caption: captionText,
              });

              if (sendRes.status === 'SENT' && execOptions?.conversationId) {
                await supabase.from('messages').insert({
                  organization_id: organizationId,
                  conversation_id: execOptions.conversationId,
                  direction: 'OUTBOUND',
                  sender_type: 'AI',
                  sender_id: 'SALES_AI',
                  message_type: 'IMAGE',
                  content: captionText,
                  media_url: finalMediaUrl,
                  external_message_id: sendRes.externalMessageId,
                  status: 'SENT',
                });
              }

              return {
                result: {
                  success: sendRes.status === 'SENT',
                  provider_message_id: sendRes.externalMessageId || null,
                  status: sendRes.status,
                  productName: prodRow.name,
                  imageUrl: finalMediaUrl,
                  caption: captionText,
                  sentToWhatsApp: sendRes.status === 'SENT',
                },
              };
            }

            return {
              result: {
                success: true,
                productName: prodRow.name,
                imageUrl: finalMediaUrl,
                caption: captionText,
                sentToWhatsApp: false,
              },
            };
          }

          const product = await this.productRepo.findById(args.productId, organizationId);
          return {
            result: {
              productId: args.productId,
              productName: product?.name || 'Produit',
              visualUrl: `https://stbzctncpvgqdpybcrmg.supabase.co/storage/v1/object/public/product-images/${args.productId}.jpg`,
            },
          };
        }

        case 'search_testimonials': {
          const testimonials = (aiAgentConfig?.testimonials || []) as any[];
          const activeTestimonials = testimonials.filter(
            (t: any) => t.status !== 'ARCHIVED' && t.status !== 'INACTIVE' && t.isPublic !== false && t.consentStatus !== 'NOT_AUTHORIZED'
          );

          if (activeTestimonials.length === 0) {
            return {
              result: {
                testimonials: [],
                message: "Aucun témoignage client enregistré au catalogue.",
              },
            };
          }

          let filtered = activeTestimonials;
          if (args.productId) {
            filtered = filtered.filter((t: any) => t.productId === args.productId || !t.productId);
          }
          if (args.query) {
            const q = args.query.toLowerCase();
            filtered = filtered.filter((t: any) =>
              (t.text && t.text.toLowerCase().includes(q)) ||
              (t.clientName && t.clientName.toLowerCase().includes(q))
            );
          }

          const finalTestimonials = filtered.length > 0 ? filtered : activeTestimonials.slice(0, 3);

          return {
            result: {
              testimonials: finalTestimonials.map((t: any) => ({
                id: t.id,
                clientName: t.clientName,
                text: t.text,
                date: t.date,
                mediaUrl: t.mediaUrl || null,
              })),
            },
          };
        }

        case 'send_testimonial': {
          const testimonials = (aiAgentConfig?.testimonials || []) as any[];
          const found = testimonials.find((t: any) => t.id === args.testimonialId);

          if (!found) {
            return {
              result: {
                success: false,
                message: `Témoignage ${args.testimonialId} introuvable.`,
              },
            };
          }

          const supabase = execOptions?.supabase;
          const providerAdapter = execOptions?.providerAdapter;
          const providerIdentity = execOptions?.providerIdentity;
          const destPhone = args.toPhoneNumber || execOptions?.destinationPhone;

          if (providerAdapter && providerIdentity && destPhone) {
            let sendRes;
            if (found.mediaUrl) {
              sendRes = await providerAdapter.sendMediaMessage(providerIdentity, {
                toPhoneNumber: destPhone,
                mediaType: 'image',
                mediaUrl: found.mediaUrl,
                caption: `📣 Témoignage ${found.clientName}: "${found.text}"`,
              });
            } else {
              sendRes = await providerAdapter.sendTextMessage(providerIdentity, {
                toPhoneNumber: destPhone,
                messageText: `📣 Témoignage client (${found.clientName}): "${found.text}"`,
              });
            }

            if (sendRes.status === 'SENT' && supabase && execOptions?.conversationId) {
              await supabase.from('messages').insert({
                organization_id: organizationId,
                conversation_id: execOptions.conversationId,
                direction: 'OUTBOUND',
                sender_type: 'AI',
                sender_id: 'SALES_AI',
                message_type: found.mediaUrl ? 'IMAGE' : 'TEXT',
                content: `📣 Témoignage ${found.clientName}: "${found.text}"`,
                media_url: found.mediaUrl || null,
                external_message_id: sendRes.externalMessageId,
                status: 'SENT',
              });
            }

            return {
              result: {
                success: sendRes.status === 'SENT',
                clientName: found.clientName,
                text: found.text,
                sentToWhatsApp: sendRes.status === 'SENT',
              },
            };
          }

          return {
            result: {
              success: true,
              clientName: found.clientName,
              text: found.text,
              sentToWhatsApp: false,
            },
          };
        }

        default:
          return { result: { error: `Outil inconnu : ${name}` } };
      }
    } catch (err: any) {
      console.error(`Error executing AI Tool ${name}:`, err);
      return { result: { error: err.message } };
    }
  }
}

// AUDIT FIX: Semantic alias — use SalesAgentToolRegistry in new code for clarity
// AIToolsRegistry kept for backward compatibility
export { AIToolsRegistry as SalesAgentToolRegistry };
