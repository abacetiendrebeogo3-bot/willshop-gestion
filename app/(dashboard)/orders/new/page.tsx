"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShoppingCart,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Truck,
  MessageSquare,
  Package,
  User,
  ShieldCheck,
} from "lucide-react";

interface ProductCatalogItem {
  id: string;
  name: string;
  sku: string;
  unitPrice: number;
  availableStock: number;
}

interface OrderItemRow {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
}

interface CustomerOption {
  id: string;
  name: string;
  phone: string;
  whatsappConv: string;
  hasIntent: boolean;
}

export default function NewOrderPage() {
  const router = routerNav();

  // Mock catalog
  const catalog: ProductCatalogItem[] = [
    { id: "p1", name: "Riz Parfumé 5kg", sku: "RIZ-05K", unitPrice: 12500, availableStock: 18 },
    { id: "p2", name: "Huile de Tournesol 5L", sku: "HUI-05L", unitPrice: 12000, availableStock: 6 },
    { id: "p3", name: "Sucre Raffiné 1kg", sku: "SUC-01K", unitPrice: 850, availableStock: 45 },
    { id: "p4", name: "Lait Concentré Sucré 1kg", sku: "LAI-01K", unitPrice: 2500, availableStock: 2 }, // Low stock
    { id: "p5", name: "Savon de Ménage (Pack de 5)", sku: "SAV-05P", unitPrice: 3500, availableStock: 24 },
  ];

  // Mock customers
  const customersList: CustomerOption[] = [
    {
      id: "c1",
      name: "Awa Koné",
      phone: "+226 70 12 34 56",
      whatsappConv: "Conv #WA-9921 (Détecté aujourd'hui 10:24)",
      hasIntent: true,
    },
    {
      id: "c2",
      name: "Moussa Traoré",
      phone: "+226 71 23 45 67",
      whatsappConv: "Conv #WA-8812 (Promesse hier)",
      hasIntent: true,
    },
    {
      id: "c3",
      name: "Fatou Diarra",
      phone: "+226 76 34 56 78",
      whatsappConv: "Conv #WA-7734",
      hasIntent: false,
    },
    {
      id: "c4",
      name: "Ibrahim Sanogo",
      phone: "+226 72 45 67 89",
      whatsappConv: "Conv #WA-6645",
      hasIntent: false,
    },
  ];

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("c1");
  const [rows, setRows] = useState<OrderItemRow[]>([
    { id: "row-1", productId: "p1", quantity: 2, unitPrice: 12500 },
  ]);
  const [deliveryRequired, setDeliveryRequired] = useState<boolean>(true);
  const [deliveryZone, setDeliveryZone] = useState<string>("Ouagadougou Centre");
  const [deliveryFee, setDeliveryFee] = useState<number>(1500);
  const [deliveryAddress, setDeliveryAddress] = useState<string>("Secteur 15, face Pharmacie de la Paix");
  const [orderNotes, setOrderNotes] = useState<string>("Client souhaite une livraison avant 14h.");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  function routerNav() {
    return useRouter();
  }

  const selectedCustomer = useMemo(() => {
    return customersList.find((c) => c.id === selectedCustomerId) || customersList[0];
  }, [selectedCustomerId]);

  // Dynamic calculations
  const subtotal = useMemo(() => {
    return rows.reduce((sum, r) => sum + Math.round(r.quantity * r.unitPrice), 0);
  }, [rows]);

  const vat18 = useMemo(() => {
    return Math.round(subtotal * 0.18);
  }, [subtotal]);

  const totalTTC = useMemo(() => {
    const fee = deliveryRequired ? Math.round(deliveryFee) : 0;
    return subtotal + vat18 + fee;
  }, [subtotal, vat18, deliveryRequired, deliveryFee]);

  // Handlers for item rows
  const handleAddRow = () => {
    const defaultProd = catalog[0];
    setRows((prev) => [
      ...prev,
      {
        id: `row-${Date.now()}`,
        productId: defaultProd.id,
        quantity: 1,
        unitPrice: defaultProd.unitPrice,
      },
    ]);
  };

  const handleRemoveRow = (rowId: string) => {
    if (rows.length === 1) return; // Keep at least 1 row
    setRows((prev) => prev.filter((r) => r.id !== rowId));
  };

  const handleProductChange = (rowId: string, newProductId: string) => {
    const prod = catalog.find((p) => p.id === newProductId);
    if (!prod) return;

    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId ? { ...r, productId: prod.id, unitPrice: prod.unitPrice } : r
      )
    );
  };

  const handleQuantityChange = (rowId: string, newQty: number) => {
    const qty = Math.max(1, newQty);
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, quantity: qty } : r)));
  };

  const handleUnitPriceChange = (rowId: string, newPrice: number) => {
    const price = Math.max(0, newPrice);
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, unitPrice: price } : r)));
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSaveIntent = () => {
    showToast("📋 Commande enregistrée avec le statut ORDER_INTENT (Intention)");
    setTimeout(() => {
      router.push("/orders");
    }, 1200);
  };

  const handleConfirmOrder = () => {
    showToast("✅ Commande confirmée (ORDER_CONFIRMED) & Livraison générée !");
    setTimeout(() => {
      router.push("/orders");
    }, 1200);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16 animate-fade-in-up">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-xl font-medium text-xs flex items-center gap-2 border border-gray-800 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-3">
        <div className="flex items-center gap-3">
          <Link
            href="/orders"
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
            title="Retour aux commandes"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Vérifier / Confirmer une commande</h1>
            <p className="text-xs text-gray-500 font-medium">WILLShop OS • Processus d'exécution commerciale</p>
          </div>
        </div>
      </div>

      {/* ORIGIN BANNER: ORDER_INTENT SOURCE */}
      <div className="bg-[#800020]/5 border border-[#800020]/20 p-4 rounded-2xl flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-[#800020] text-white flex items-center justify-center shrink-0 shadow-xs">
          <MessageSquare className="w-4 h-4 text-[#D4A843]" />
        </div>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#800020]">Origine : Intention WhatsApp (ORDER_INTENT)</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#D4A843]/20 text-[#800020] border border-[#D4A843]/30">
              Détecté par IA
            </span>
          </div>
          <p className="text-gray-700">
            Origine : {selectedCustomer.whatsappConv}. Vérifiez attentivement les quantités et la disponibilité du stock physique avant de confirmer.
          </p>
        </div>
      </div>

      {/* SECTION 1: SELECTION DU CLIENT */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-2xs space-y-4">
        <h2 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
          <User className="w-4 h-4 text-[#800020]" />
          <span>1. Informations Client</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-gray-600 font-bold mb-1.5">Sélectionner le client :</label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-[#800020]"
            >
              {customersList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.phone}) {c.hasIntent ? "★ Intent WhatsApp" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-900">{selectedCustomer.name}</span>
              <span className="font-mono text-gray-500">{selectedCustomer.phone}</span>
            </div>
            <p className="text-[11px] text-gray-500">{selectedCustomer.whatsappConv}</p>
          </div>
        </div>
      </div>

      {/* SECTION 2: LIGNES DE COMMANDE ET VÉRIFICATION STOCK */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <h2 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
            <Package className="w-4 h-4 text-[#800020]" />
            <span>2. Lignes de Commande & Stock Physique</span>
          </h2>
          <button
            onClick={handleAddRow}
            className="px-3 py-1.5 rounded-xl bg-[#800020]/10 hover:bg-[#800020]/20 text-[#800020] text-xs font-bold transition-all flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter une ligne</span>
          </button>
        </div>

        {/* Rows Table */}
        <div className="space-y-3">
          {rows.map((row, index) => {
            const currentProd = catalog.find((p) => p.id === row.productId) || catalog[0];
            const lineTotal = Math.round(row.quantity * row.unitPrice);
            const isStockOk = currentProd.availableStock >= row.quantity;

            return (
              <div
                key={row.id}
                className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 space-y-3 text-xs"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  {/* Product Select */}
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-gray-500 font-medium mb-1">
                      Produit #{index + 1}
                    </label>
                    <select
                      value={row.productId}
                      onChange={(e) => handleProductChange(row.id, e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 font-bold text-gray-900 focus:outline-none focus:border-[#800020]"
                    >
                      {catalog.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.sku}) — {p.unitPrice.toLocaleString("fr-FR")} FCFA
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Quantity */}
                  <div className="w-24">
                    <label className="block text-gray-500 font-medium mb-1">Quantité</label>
                    <input
                      type="number"
                      min="1"
                      value={row.quantity}
                      onChange={(e) => handleQuantityChange(row.id, parseInt(e.target.value) || 1)}
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 font-bold text-gray-900 text-center focus:outline-none focus:border-[#800020]"
                    />
                  </div>

                  {/* Unit Price */}
                  <div className="w-32">
                    <label className="block text-gray-500 font-medium mb-1">Prix Unitaire</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={row.unitPrice}
                        onChange={(e) => handleUnitPriceChange(row.id, parseInt(e.target.value) || 0)}
                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 font-bold text-gray-900 font-mono text-right pr-2 focus:outline-none focus:border-[#800020]"
                      />
                    </div>
                  </div>

                  {/* Total Line */}
                  <div className="w-32 text-right">
                    <label className="block text-gray-400 font-medium mb-1">Total Ligne</label>
                    <span className="font-extrabold text-gray-900 font-mono text-sm">
                      {lineTotal.toLocaleString("fr-FR")} FCFA
                    </span>
                  </div>

                  {/* Remove Row Button */}
                  <div className="flex items-end justify-end">
                    <button
                      onClick={() => handleRemoveRow(row.id)}
                      disabled={rows.length === 1}
                      className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors disabled:opacity-30"
                      title="Supprimer la ligne"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Stock Verification Badge */}
                <div className="pt-2 border-t border-gray-200/60 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-500">Vérification stock :</span>
                    {isStockOk ? (
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Stock disponible ({currentProd.availableStock} unités) ✅
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                        <AlertTriangle className="w-3.5 h-3.5" /> ⚠️ Stock insuffisant ({currentProd.availableStock} unités en stock)
                      </span>
                    )}
                  </div>
                  <span className="text-gray-400 font-mono">SKU: {currentProd.sku}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 3: EXPÉDITION & LIVRAISON */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
            <Truck className="w-4 h-4 text-[#800020]" />
            <span>3. Option de Livraison</span>
          </h2>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={deliveryRequired}
              onChange={(e) => setDeliveryRequired(e.target.checked)}
              className="w-4 h-4 text-[#800020] rounded border-gray-300 focus:ring-[#800020]"
            />
            <span className="text-xs font-bold text-gray-900">Livraison nécessaire</span>
          </label>
        </div>

        {deliveryRequired && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2 animate-fade-in">
            <div>
              <label className="block text-gray-600 font-bold mb-1">Zone de livraison :</label>
              <select
                value={deliveryZone}
                onChange={(e) => {
                  setDeliveryZone(e.target.value);
                  if (e.target.value === "Ouagadougou Centre") setDeliveryFee(1500);
                  else if (e.target.value === "Ouaga 2000 / Pissy") setDeliveryFee(2500);
                  else setDeliveryFee(3500);
                }}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 font-bold text-gray-900 focus:outline-none focus:border-[#800020]"
              >
                <option value="Ouagadougou Centre">Ouagadougou Centre (1 500 FCFA)</option>
                <option value="Ouaga 2000 / Pissy">Ouaga 2000 / Pissy (2 500 FCFA)</option>
                <option value="Zone Périphérique">Zone Périphérique (3 500 FCFA)</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-600 font-bold mb-1">Frais de livraison :</label>
              <input
                type="number"
                value={deliveryFee}
                onChange={(e) => setDeliveryFee(parseInt(e.target.value) || 0)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 font-bold text-gray-900 text-right font-mono focus:outline-none focus:border-[#800020]"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-gray-600 font-bold mb-1">Adresse exacte de livraison :</label>
              <input
                type="text"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Indication de rue, numéro de maison, point de repère..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 font-semibold text-gray-900 focus:outline-none focus:border-[#800020]"
              />
            </div>
          </div>
        )}
      </div>

      {/* SECTION 4: CALCUL FINAL & CTAS */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-2xs space-y-4">
        <h2 className="text-sm font-extrabold text-gray-900">4. Total & Reconstitution Financière</h2>

        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2 text-xs font-mono">
          <div className="flex justify-between text-gray-600">
            <span>Sous-total Produits :</span>
            <span className="font-bold text-gray-900">{subtotal.toLocaleString("fr-FR")} FCFA</span>
          </div>

          <div className="flex justify-between text-gray-600">
            <span>TVA 18% (Applicable) :</span>
            <span className="font-bold text-gray-900">{vat18.toLocaleString("fr-FR")} FCFA</span>
          </div>

          {deliveryRequired && (
            <div className="flex justify-between text-gray-600">
              <span>Frais de livraison ({deliveryZone}) :</span>
              <span className="font-bold text-gray-900">{deliveryFee.toLocaleString("fr-FR")} FCFA</span>
            </div>
          )}

          <div className="pt-2 border-t border-gray-300 flex justify-between text-base font-black text-gray-900">
            <span>TOTAL NET TTC :</span>
            <span className="text-[#800020]">{totalTTC.toLocaleString("fr-FR")} FCFA</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
          <button
            onClick={handleSaveIntent}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-[#D4A843] bg-[#D4A843]/10 hover:bg-[#D4A843]/20 text-gray-900 text-xs font-bold transition-all"
          >
            Enregistrer comme intention (ORDER_INTENT)
          </button>

          <button
            onClick={handleConfirmOrder}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#800020] hover:bg-[#660019] text-white text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4 text-[#D4A843]" />
            <span>Confirmer la commande (ORDER_CONFIRMED)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
