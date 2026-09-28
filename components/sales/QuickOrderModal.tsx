"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  ShoppingCart,
  CheckCircle2,
  Loader2,
  Package,
  MapPin,
  FileText,
  DollarSign,
  User,
  Phone,
} from "lucide-react";
import { createClient } from "@/src/infrastructure/supabase/client";

interface QuickOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderCreated?: (orderData: any) => void;
  initialCustomer?: {
    id: string;
    name: string;
    phone: string;
    conversationId?: string;
    neighborhood?: string;
  };
}

export function QuickOrderModal({
  isOpen,
  onClose,
  onOrderCreated,
  initialCustomer,
}: QuickOrderModalProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const [neighborhood, setNeighborhood] = useState<string>(initialCustomer?.neighborhood || "");
  const [notes, setNotes] = useState<string>("");
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadProducts();
      if (initialCustomer?.neighborhood) {
        setNeighborhood(initialCustomer.neighborhood);
      }
    }
  }, [isOpen, initialCustomer]);

  async function loadProducts() {
    setIsLoadingProducts(true);
    setErrorMsg(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("products")
        .select("id, name, selling_price, status")
        .eq("status", "ACTIVE")
        .order("name", { ascending: true });

      if (data && data.length > 0) {
        setProducts(data);
        setSelectedProductId(data[0].id);
      }
    } catch (err: any) {
      console.error("[QuickOrderModal] Error loading products:", err);
    } finally {
      setIsLoadingProducts(false);
    }
  }

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const unitPrice = selectedProduct ? Number(selectedProduct.selling_price || 0) : 0;
  const totalPrice = unitPrice * Math.max(1, quantity);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!initialCustomer?.id || !selectedProductId) {
      setErrorMsg("Veuillez sélectionner un client et un produit.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/orders/quick-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: initialCustomer.id,
          conversationId: initialCustomer.conversationId,
          productId: selectedProductId,
          quantity,
          neighborhood,
          notes,
          customerName: initialCustomer.name,
          customerPhone: initialCustomer.phone,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Erreur lors de la création de la commande.");
      }

      if (onOrderCreated) {
        onOrderCreated(data);
      }

      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Impossible de finaliser la commande.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-white rounded-3xl border border-[#EBE5DA] shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-[#FAF8F5] border-b border-[#EBE5DA] p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#800020]/10 text-[#800020] flex items-center justify-center font-bold">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-[#1F1917] text-base">Création Commande 1-Clic</h3>
              <p className="text-xs text-stone-500">Validation commerciale & création de livraison</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800">
              {errorMsg}
            </div>
          )}

          {/* Customer Info Card */}
          {initialCustomer && (
            <div className="p-3.5 bg-[#FAF8F5] border border-[#EBE5DA] rounded-2xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 font-bold text-[#1F1917]">
                <User className="w-4 h-4 text-[#800020]" />
                <span>{initialCustomer.name}</span>
              </div>
              <div className="flex items-center gap-1 text-stone-500 font-mono">
                <Phone className="w-3.5 h-3.5" />
                <span>{initialCustomer.phone}</span>
              </div>
            </div>
          )}

          {/* Product Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#1F1917] flex items-center gap-1.5">
              <Package className="w-4 h-4 text-[#800020]" />
              <span>Produit du Catalogue</span>
            </label>
            {isLoadingProducts ? (
              <div className="py-3 text-xs text-stone-500 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#800020]" />
                <span>Chargement du catalogue...</span>
              </div>
            ) : (
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full bg-[#FAF8F5] border border-[#EBE5DA] rounded-2xl px-4 py-3 text-xs text-[#1F1917] font-semibold outline-none focus:border-[#800020]"
                required
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {Number(p.selling_price || 0).toLocaleString("fr-FR")} FCFA
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Quantity & Neighborhood */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#1F1917]">Quantité</label>
              <input
                type="number"
                min="1"
                max="99"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-[#FAF8F5] border border-[#EBE5DA] rounded-2xl px-4 py-2.5 text-xs text-[#1F1917] font-semibold outline-none focus:border-[#800020]"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#1F1917] flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#800020]" />
                <span>Quartier Livraison</span>
              </label>
              <input
                type="text"
                placeholder="Ex: Ouaga 2000, Patte d'Oie"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                className="w-full bg-[#FAF8F5] border border-[#EBE5DA] rounded-2xl px-4 py-2.5 text-xs text-[#1F1917] font-semibold outline-none focus:border-[#800020]"
                required
              />
            </div>
          </div>

          {/* Total Price Summary */}
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between">
            <span className="text-xs font-extrabold text-emerald-950">Montant Total Commande</span>
            <span className="text-lg font-black text-emerald-700">
              {totalPrice.toLocaleString("fr-FR")} FCFA
            </span>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#1F1917] flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-stone-500" />
              <span>Notes / Instruction de livraison (optionnel)</span>
            </label>
            <textarea
              rows={2}
              placeholder="Instructions particulières pour le livreur..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-[#FAF8F5] border border-[#EBE5DA] rounded-2xl px-4 py-2.5 text-xs text-[#1F1917] font-medium outline-none focus:border-[#800020]"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedProductId}
              className="px-6 py-2.5 bg-[#800020] hover:bg-[#660019] text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Validation...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Valider & Créer Livraison</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
