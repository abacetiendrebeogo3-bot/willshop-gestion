"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Card, Badge, Button } from "@/components/ui/card";
import { DataSourceBadge } from "@/components/ui/data-source-badge";
import { createClient } from "@/src/infrastructure/supabase/client";
import {
  Package,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Edit,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Inbox,
  X,
  TrendingUp,
  DollarSign,
  ShieldCheck,
  Tag,
  Camera,
  Upload,
  Star,
  Trash2,
  Archive,
  Image as ImageIcon,
  FileImage,
} from "lucide-react";

interface LocalCreateImage {
  id: string;
  file: File;
  previewUrl: string;
  isPrimary: boolean;
}

export default function ProductsPage() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");

  // Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [createError, setCreateError] = useState("");
  const [selectedCreateImages, setSelectedCreateImages] = useState<LocalCreateImage[]>([]);

  const [createForm, setCreateForm] = useState({
    name: "",
    sku: "",
    category: "SANTÉ & BEAUTÉ",
    description: "",
    purchasePrice: "2500",
    sellingPrice: "6500",
    initialStock: "20",
    minimumStock: "5",
    status: "ACTIVE",
  });

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState("");
  const [editImages, setEditImages] = useState<any[]>([]);
  const [isUploadingEditImage, setIsUploadingEditImage] = useState(false);

  const [editForm, setEditForm] = useState({
    name: "",
    sku: "",
    category: "",
    description: "",
    purchasePrice: "",
    sellingPrice: "",
    minimumStock: "",
    status: "ACTIVE",
  });

  // Delete & Archive Safeguard Modal State
  const [deleteModalProduct, setDeleteModalProduct] = useState<any | null>(null);
  const [deleteCheckOrdersCount, setDeleteCheckOrdersCount] = useState<number | null>(null);
  const [isCheckingDelete, setIsCheckingDelete] = useState<boolean>(false);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState<boolean>(false);

  // Adjust Stock Modal State
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState<any | null>(null);
  const [adjustQty, setAdjustQty] = useState("10");
  const [adjustReason, setAdjustReason] = useState("Réception fournisseur");
  const [isSubmittingAdjust, setIsSubmittingAdjust] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: roles } = await supabase
        .from("user_organization_roles")
        .select("organization_id")
        .eq("user_id", user.id)
        .is("deleted_at", null)
      .order("created_at", { ascending: true });

      if (!roles || roles.length === 0) return;
      const currentOrgId = roles[0].organization_id;
      setOrgId(currentOrgId);

      const { data: prods, error } = await supabase
        .from("products")
        .select("*, product_stock(*), product_images(*)")
        .eq("organization_id", currentOrgId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[Products Load Error]", error.message);
      } else if (prods) {
        setProducts(prods);
      }
    } catch (err) {
      console.error("[Products Exception]", err);
    } finally {
      setLoading(false);
    }
  }

  // Handle Image Selection for Create Modal
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    addImages(files);
  };

  const addImages = (files: File[]) => {
    if (selectedCreateImages.length + files.length > 5) {
      setCreateError("Maximum 5 images autorisées par produit.");
      return;
    }
    const newImgs: LocalCreateImage[] = [];
    for (const f of files) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
        setCreateError("Formats autorisés : JPG, PNG, WEBP.");
        return;
      }
      if (f.size > 5 * 1024 * 1024) {
        setCreateError("Chaque image doit faire moins de 5 Mo.");
        return;
      }
      newImgs.push({
        id: Math.random().toString(36).substring(2, 9),
        file: f,
        previewUrl: URL.createObjectURL(f),
        isPrimary: selectedCreateImages.length === 0 && newImgs.length === 0,
      });
    }
    setSelectedCreateImages((prev) => [...prev, ...newImgs]);
  };

  const removeCreateImage = (id: string) => {
    setSelectedCreateImages((prev) => {
      const filtered = prev.filter((i) => i.id !== id);
      if (filtered.length > 0 && !filtered.some((i) => i.isPrimary)) {
        filtered[0].isPrimary = true;
      }
      return filtered;
    });
  };

  const setPrimaryCreateImage = (id: string) => {
    setSelectedCreateImages((prev) =>
      prev.map((i) => ({
        ...i,
        isPrimary: i.id === id,
      }))
    );
  };

  // Handle Create Product
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || isSubmittingCreate) return;
    setCreateError("");

    if (!createForm.name.trim()) {
      setCreateError("Le nom du produit est obligatoire.");
      return;
    }

    const pPrice = Number(createForm.purchasePrice);
    const sPrice = Number(createForm.sellingPrice);
    const initStock = Number(createForm.initialStock);

    if (isNaN(pPrice) || pPrice < 0) {
      setCreateError("Le prix d'achat doit être un nombre positif.");
      return;
    }

    if (isNaN(sPrice) || sPrice < 0) {
      setCreateError("Le prix de vente doit être un nombre positif.");
      return;
    }

    if (isNaN(initStock) || initStock < 0) {
      setCreateError("Le stock initial ne peut pas être négatif.");
      return;
    }

    setIsSubmittingCreate(true);

    try {
      const supabase = createClient();
      const sku = createForm.sku.trim() || `WS-${Math.floor(1000 + Math.random() * 9000)}`;

      // 1. Create Product in `products`
      const { data: newProd, error: pErr } = await supabase
        .from("products")
        .insert({
          organization_id: orgId,
          name: createForm.name.trim(),
          sku,
          category: createForm.category,
          description: createForm.description.trim() || null,
          purchase_price: pPrice,
          selling_price: sPrice,
          currency: "XOF",
          minimum_stock: Number(createForm.minimumStock) || 5,
          unit: "UNIT",
          status: createForm.status,
        })
        .select()
        .single();

      if (pErr || !newProd) {
        throw new Error(pErr?.message || "Erreur lors de la création du produit");
      }

      // 2. Initialize Stock in `product_stock` (SSOT)
      const { error: stErr } = await supabase.from("product_stock").insert({
        organization_id: orgId,
        product_id: newProd.id,
        physical_stock: initStock,
        reserved_stock: 0,
        minimum_stock: Number(createForm.minimumStock) || 5,
      });

      if (stErr) {
        throw new Error(`Erreur lors de l'initialisation du stock: ${stErr.message}`);
      }

      // 3. Log Inbound Movement in `stock_movements`
      if (initStock > 0) {
        await supabase.from("stock_movements").insert({
          organization_id: orgId,
          product_id: newProd.id,
          type: "RESTOCK",
          quantity: initStock,
          reason: "Stock initial à la création du produit",
        });
      }

      // 4. Upload Selected Product Images to Supabase Storage & DB
      if (selectedCreateImages.length > 0) {
        for (let idx = 0; idx < selectedCreateImages.length; idx++) {
          const imgItem = selectedCreateImages[idx];
          const ext = imgItem.file.name.split(".").pop() || "jpg";
          const cleanFileName = `img_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}.${ext}`;
          const storagePath = `${orgId}/${newProd.id}/${cleanFileName}`;

          const { error: uploadErr } = await supabase.storage
            .from("product-images")
            .upload(storagePath, imgItem.file, {
              contentType: imgItem.file.type,
              upsert: true,
            });

          if (uploadErr) {
            throw new Error(`Erreur lors de l'upload de l'image ${imgItem.file.name}: ${uploadErr.message}`);
          }

          const { data: urlData } = supabase.storage
            .from("product-images")
            .getPublicUrl(storagePath);

          const { error: dbImgErr } = await supabase.from("product_images").insert({
            organization_id: orgId,
            product_id: newProd.id,
            storage_path: storagePath,
            url: urlData.publicUrl,
            is_primary: imgItem.isPrimary,
            sort_order: idx,
          });

          if (dbImgErr) {
            throw new Error(`Erreur lors de l'enregistrement de l'image ${imgItem.file.name}: ${dbImgErr.message}`);
          }
        }
      }

      setIsCreateModalOpen(false);
      setSelectedCreateImages([]);
      setCreateForm({
        name: "",
        sku: "",
        category: "SANTÉ & BEAUTÉ",
        description: "",
        purchasePrice: "2500",
        sellingPrice: "6500",
        initialStock: "20",
        minimumStock: "5",
        status: "ACTIVE",
      });
      await loadProducts();
    } catch (err: any) {
      setCreateError(err.message || "Erreur lors de l'enregistrement du produit");
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (p: any) => {
    setEditingProduct(p);
    setEditForm({
      name: p.name || "",
      sku: p.sku || "",
      category: p.category || "GENERAL",
      description: p.description || "",
      purchasePrice: String(p.purchase_price || 0),
      sellingPrice: String(p.selling_price || 0),
      minimumStock: String(p.minimum_stock || 5),
      status: p.status || "ACTIVE",
    });
    setEditImages(p.product_images || []);
    setEditError("");
    setIsEditModalOpen(true);
  };

  // Handle Edit Product Images
  const handleAddEditImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !editingProduct || !orgId) return;
    const file = e.target.files[0];
    setIsUploadingEditImage(true);

    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() || "jpg";
      const cleanFileName = `img_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.${ext}`;
      const storagePath = `${orgId}/${editingProduct.id}/${cleanFileName}`;

      const { error: uploadErr } = await supabase.storage
        .from("product-images")
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: true,
        });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from("product-images")
        .getPublicUrl(storagePath);

      const isFirstImg = editImages.length === 0;

      const { data: newImg, error: dbErr } = await supabase
        .from("product_images")
        .insert({
          organization_id: orgId,
          product_id: editingProduct.id,
          storage_path: storagePath,
          url: urlData.publicUrl,
          is_primary: isFirstImg,
          sort_order: editImages.length,
        })
        .select()
        .single();

      if (dbErr) throw dbErr;

      setEditImages((prev) => [...prev, newImg]);
    } catch (err: any) {
      setEditError(`Erreur d'upload : ${err.message}`);
    } finally {
      setIsUploadingEditImage(false);
    }
  };

  const handleSetPrimaryEditImage = async (imageId: string) => {
    if (!editingProduct || !orgId) return;
    try {
      const supabase = createClient();
      await supabase
        .from("product_images")
        .update({ is_primary: false })
        .eq("product_id", editingProduct.id)
        .eq("organization_id", orgId);

      await supabase
        .from("product_images")
        .update({ is_primary: true })
        .eq("id", imageId)
        .eq("organization_id", orgId);

      setEditImages((prev) =>
        prev.map((i) => ({ ...i, is_primary: i.id === imageId }))
      );
    } catch (err) {
      console.error("Erreur image principale:", err);
    }
  };

  const handleDeleteEditImage = async (img: any) => {
    if (!confirm("Voulez-vous vraiment supprimer cette image ?")) return;
    try {
      const supabase = createClient();
      await supabase.from("product_images").delete().eq("id", img.id);
      if (img.storage_path) {
        await supabase.storage.from("product-images").remove([img.storage_path]);
      }
      setEditImages((prev) => prev.filter((i) => i.id !== img.id));
    } catch (err) {
      console.error("Erreur suppression image:", err);
    }
  };

  // Handle Update Product
  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !orgId || isSubmittingEdit) return;
    setEditError("");

    if (!editForm.name.trim()) {
      setEditError("Le nom du produit est obligatoire.");
      return;
    }

    setIsSubmittingEdit(true);

    try {
      const supabase = createClient();
      const { error: uErr } = await supabase
        .from("products")
        .update({
          name: editForm.name.trim(),
          sku: editForm.sku.trim(),
          category: editForm.category,
          description: editForm.description.trim() || null,
          purchase_price: Number(editForm.purchasePrice) || 0,
          selling_price: Number(editForm.sellingPrice) || 0,
          minimum_stock: Number(editForm.minimumStock) || 5,
          status: editForm.status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingProduct.id)
        .eq("organization_id", orgId);

      if (uErr) throw new Error(uErr.message);

      setIsEditModalOpen(false);
      setEditingProduct(null);
      await loadProducts();
    } catch (err: any) {
      setEditError(err.message || "Erreur lors de la modification");
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Handle Toggle Active/Archived Status
  const handleToggleProductStatus = async (p: any) => {
    if (!orgId) return;
    const newStatus = p.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      const supabase = createClient();
      await supabase
        .from("products")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", p.id)
        .eq("organization_id", orgId);

      await loadProducts();
    } catch (err) {
      console.error("Erreur changement statut:", err);
    }
  };

  // Handle Open Delete Confirmation Modal with Order Safeguard Check
  const handleOpenDeleteConfirm = async (p: any) => {
    setDeleteModalProduct(p);
    setIsCheckingDelete(true);
    setDeleteCheckOrdersCount(null);
    try {
      const supabase = createClient();
      const { count } = await supabase
        .from("order_items")
        .select("*", { count: "exact", head: true })
        .eq("product_id", p.id);

      setDeleteCheckOrdersCount(count || 0);
    } catch (err) {
      setDeleteCheckOrdersCount(0);
    } finally {
      setIsCheckingDelete(false);
    }
  };

  const handleConfirmDeleteOrArchive = async (action: "DELETE" | "ARCHIVE") => {
    if (!deleteModalProduct || !orgId) return;
    setIsSubmittingDelete(true);
    try {
      const supabase = createClient();
      if (action === "ARCHIVE") {
        await supabase
          .from("products")
          .update({ status: "INACTIVE", updated_at: new Date().toISOString() })
          .eq("id", deleteModalProduct.id)
          .eq("organization_id", orgId);
      } else {
        await supabase
          .from("products")
          .update({ deleted_at: new Date().toISOString(), status: "INACTIVE" })
          .eq("id", deleteModalProduct.id)
          .eq("organization_id", orgId);
      }
      setDeleteModalProduct(null);
      await loadProducts();
    } catch (err) {
      console.error("Erreur suppression/archivage:", err);
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  // Handle Adjust Stock
  const handleAdjustStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustProduct || !orgId || isSubmittingAdjust) return;

    setIsSubmittingAdjust(true);
    try {
      const supabase = createClient();
      const stock = adjustProduct.product_stock?.[0];
      const addQty = Number(adjustQty) || 0;

      if (stock) {
        await supabase
          .from("product_stock")
          .update({
            physical_stock: (stock.physical_stock || 0) + addQty,
          })
          .eq("id", stock.id);

        await supabase.from("stock_movements").insert({
          organization_id: orgId,
          product_id: adjustProduct.id,
          type: addQty >= 0 ? "RESTOCK" : "ADJUSTMENT",
          quantity: Math.abs(addQty),
          reason: adjustReason || "Ré-ajustement manuel du stock",
        });
      }

      setIsAdjustModalOpen(false);
      setAdjustProduct(null);
      await loadProducts();
    } catch (err) {
      console.error("[Adjust Exception]", err);
    } finally {
      setIsSubmittingAdjust(false);
    }
  };

  // Filtered Products List
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = selectedCategory === "ALL" || p.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  // Calculate Aggregates
  let totalPhysical = 0;
  let totalReserved = 0;
  products.forEach((p) => {
    const st = p.product_stock?.[0];
    if (st) {
      totalPhysical += Number(st.physical_stock || 0);
      totalReserved += Number(st.reserved_stock || 0);
    }
  });
  const totalAvailable = totalPhysical - totalReserved;

  const categories = ["ALL", "SANTÉ & BEAUTÉ", "MODE & HABILLEMENT", "ÉLECTRONIQUE", "ALIMENTATION", "SERVICES"];

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">
              Catalogue Produits & Stock
            </h1>
            <Badge variant="success">STOCK SSOT ACTIVE</Badge>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Gérez vos références, tarifs de vente/achat, stock physique et réservations (Anti-Oversell)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <DataSourceBadge type={products.length > 0 ? "DATABASE" : "EMPTY_STATE"} label="SUPABASE SSOT" />
          <Button variant="primary" size="sm" onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            + Nouveau Produit
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase">Total Références</span>
            <Package className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-slate-100 mt-2 font-mono">{products.length}</p>
          <p className="text-[11px] text-slate-400 mt-1 font-mono">Produits au catalogue</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase">Stock Physique Total</span>
            <TrendingUp className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-bold text-slate-100 mt-2 font-mono">{totalPhysical} Unités</p>
          <p className="text-[11px] text-slate-400 mt-1 font-mono">Présent en entrepôt</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase">Stock Réservé</span>
            <Tag className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-400 mt-2 font-mono">{totalReserved} Unités</p>
          <p className="text-[11px] text-slate-400 mt-1 font-mono">Commandes en cours</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase">Stock Disponible</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400 mt-2 font-mono">{totalAvailable} Unités</p>
          <p className="text-[11px] text-slate-400 mt-1 font-mono">Physical - Reserved</p>
        </Card>
      </div>

      {/* Filter & Search Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par nom ou SKU..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-primary"
          />
        </div>

        {/* Categories */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium font-mono whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? "bg-primary text-white font-semibold"
                  : "bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Main Products List Table */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="font-semibold text-slate-100 text-sm">Produits Enregistrés</h2>
          <span className="text-xs font-mono text-slate-400">{filteredProducts.length} référence(s)</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" /> Chargement du catalogue depuis Supabase...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <Inbox className="w-10 h-10 mx-auto text-slate-600" />
            <p className="text-sm font-semibold text-slate-300">Aucun produit enregistré</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Commencez par ajouter votre premier produit pour pouvoir gérer votre stock et créer des commandes.
            </p>
            <Button variant="primary" size="sm" onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> + Ajouter mon premier produit
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3">IMAGE</th>
                  <th className="p-3">PRODUIT & SKU</th>
                  <th className="p-3">CATÉGORIE</th>
                  <th className="p-3">PRIX ACHAT</th>
                  <th className="p-3">PRIX VENTE</th>
                  <th className="p-3">MARGE UNITAIRE</th>
                  <th className="p-3 text-center">PHYS.</th>
                  <th className="p-3 text-center">RÉS.</th>
                  <th className="p-3 text-center">DISP.</th>
                  <th className="p-3">STATUT</th>
                  <th className="p-3 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {filteredProducts.map((p) => {
                  const stock = p.product_stock?.[0];
                  const phys = Number(stock?.physical_stock || 0);
                  const res = Number(stock?.reserved_stock || 0);
                  const avail = phys - res;
                  const margin = (p.selling_price || 0) - (p.purchase_price || 0);

                  const primaryImg = p.product_images?.find((i: any) => i.is_primary)?.url || p.product_images?.[0]?.url;

                  return (
                    <tr key={p.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="p-3">
                        {primaryImg ? (
                          <img
                            src={primaryImg}
                            alt={p.name}
                            className="w-10 h-10 object-cover rounded-xl border border-slate-800 bg-slate-950"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-slate-950 rounded-xl flex flex-col items-center justify-center text-slate-500 border border-slate-800/80">
                            <Package className="w-4 h-4 text-slate-600" />
                            <span className="text-[8px] font-mono text-slate-600">Sans img</span>
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <Link href={`/operations/products/${p.id}`} className="font-bold text-slate-100 hover:text-primary">
                          {p.name}
                        </Link>
                        <p className="text-[10px] text-slate-400 font-mono">{p.sku || "Sans SKU"}</p>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                          {p.category}
                        </span>
                      </td>
                      <td className="p-3 text-slate-400">{Number(p.purchase_price || 0).toLocaleString()} XOF</td>
                      <td className="p-3 font-semibold text-slate-100">{Number(p.selling_price || 0).toLocaleString()} XOF</td>
                      <td className="p-3 font-semibold text-emerald-400">+{margin.toLocaleString()} XOF</td>
                      <td className="p-3 text-center font-bold">{phys}</td>
                      <td className="p-3 text-center text-amber-400">{res}</td>
                      <td className="p-3 text-center font-bold text-emerald-400">{avail}</td>
                      <td className="p-3">
                        <button
                          onClick={() => handleToggleProductStatus(p)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${
                            p.status === "ACTIVE"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                              : "bg-gray-500/10 text-gray-400 border-gray-500/30 hover:bg-gray-500/20"
                          }`}
                          title="Cliquer pour changer le statut"
                        >
                          {p.status === "ACTIVE" ? "🟢 Actif" : "⚪ Inactif"}
                        </button>
                      </td>
                      <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="inline-flex items-center px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-blue-400 text-[11px]"
                          title="Modifier le produit & images"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => {
                            setAdjustProduct(p);
                            setIsAdjustModalOpen(true);
                          }}
                          className="inline-flex items-center px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-400 text-[11px]"
                          title="Ré-ajuster stock"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleOpenDeleteConfirm(p)}
                          className="inline-flex items-center px-2 py-1 rounded bg-slate-800 hover:bg-rose-500/20 text-rose-400 text-[11px]"
                          title="Supprimer / Archiver"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal 1: + Nouveau Produit */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" /> + Nouveau Produit au Catalogue
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-100 p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateProduct} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Nom du produit *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Thé Minceur Bio Premium"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-200 focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300">SKU / Référence</label>
                  <input
                    type="text"
                    placeholder="WS-PROD-01"
                    value={createForm.sku}
                    onChange={(e) => setCreateForm({ ...createForm, sku: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-200 focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-300">Catégorie</label>
                  <select
                    value={createForm.category}
                    onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-200 focus:outline-none focus:border-primary"
                  >
                    <option value="SANTÉ & BEAUTÉ">Santé & Beauté</option>
                    <option value="MODE & HABILLEMENT">Mode & Habillement</option>
                    <option value="ÉLECTRONIQUE">Électronique</option>
                    <option value="ALIMENTATION">Alimentation</option>
                    <option value="SERVICES">Services</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300">Prix d'Achat (XOF) *</label>
                  <input
                    type="number"
                    required
                    value={createForm.purchasePrice}
                    onChange={(e) => setCreateForm({ ...createForm, purchasePrice: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-200 focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-300">Prix de Vente (XOF) *</label>
                  <input
                    type="number"
                    required
                    value={createForm.sellingPrice}
                    onChange={(e) => setCreateForm({ ...createForm, sellingPrice: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-200 focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300">Stock Physique Initial *</label>
                  <input
                    type="number"
                    required
                    value={createForm.initialStock}
                    onChange={(e) => setCreateForm({ ...createForm, initialStock: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-200 focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-300">Seuil d'Alerte Stock</label>
                  <input
                    type="number"
                    value={createForm.minimumStock}
                    onChange={(e) => setCreateForm({ ...createForm, minimumStock: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-200 focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Description / Détails</label>
                <textarea
                  rows={2}
                  placeholder="Informations utiles pour les commerciaux et clients..."
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-200 focus:outline-none focus:border-primary"
                />
              </div>

              {/* 📸 Images du produit */}
              <div className="space-y-2 border-t border-slate-800 pt-3">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-primary" /> 📸 Images du produit ({selectedCreateImages.length}/5)
                  </label>
                  <span className="text-[10px] text-slate-400">JPG, PNG, WEBP (&lt; 5 Mo)</span>
                </div>

                <div className="border-2 border-dashed border-slate-800 hover:border-primary/50 rounded-2xl p-4 text-center bg-slate-950/60 transition-colors">
                  <input
                    type="file"
                    id="create-image-input"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label
                    htmlFor="create-image-input"
                    className="cursor-pointer flex flex-col items-center justify-center space-y-1.5"
                  >
                    <Upload className="w-6 h-6 text-primary" />
                    <span className="text-xs font-semibold text-slate-300">
                      + Ajouter des images
                    </span>
                  </label>
                </div>

                {selectedCreateImages.length > 0 && (
                  <div className="grid grid-cols-5 gap-2 pt-1">
                    {selectedCreateImages.map((img) => (
                      <div
                        key={img.id}
                        className={`relative group rounded-xl overflow-hidden border transition-all aspect-square ${
                          img.isPrimary
                            ? "border-amber-400 ring-2 ring-amber-400/30"
                            : "border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        <img
                          src={img.previewUrl}
                          alt="Aperçu"
                          className="w-full h-full object-cover"
                        />
                        {img.isPrimary && (
                          <span className="absolute top-1 left-1 bg-amber-500 text-black text-[8px] font-bold px-1 rounded flex items-center gap-0.5">
                            <Star className="w-2.5 h-2.5 fill-black" />
                          </span>
                        )}
                        <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                          {!img.isPrimary && (
                            <button
                              type="button"
                              onClick={() => setPrimaryCreateImage(img.id)}
                              className="p-1 rounded bg-amber-500 text-black hover:bg-amber-400"
                              title="Définir comme principale"
                            >
                              <Star className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => removeCreateImage(img.id)}
                            className="p-1 rounded bg-rose-500 text-white hover:bg-rose-600"
                            title="Supprimer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmittingCreate}
                className="w-full py-3 rounded-xl bg-primary text-white font-semibold text-xs hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
              >
                {isSubmittingCreate ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Création en base Supabase...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> Enregistrer le Produit et le Stock Initial
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Modifier Produit & Images */}
      {isEditModalOpen && editingProduct && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <Edit className="w-5 h-5 text-blue-400" /> Modifier le Produit & Images
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-100 p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateProduct} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Nom du produit *</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-200 focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300">SKU / Référence</label>
                  <input
                    type="text"
                    value={editForm.sku}
                    onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-200 focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-300">Statut</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-200 focus:outline-none focus:border-primary"
                  >
                    <option value="ACTIVE">Actif</option>
                    <option value="INACTIVE">Inactif (Archivé)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300">Prix d'Achat (XOF)</label>
                  <input
                    type="number"
                    value={editForm.purchasePrice}
                    onChange={(e) => setEditForm({ ...editForm, purchasePrice: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-200 focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-300">Prix de Vente (XOF)</label>
                  <input
                    type="number"
                    value={editForm.sellingPrice}
                    onChange={(e) => setEditForm({ ...editForm, sellingPrice: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-200 focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* 📸 Gestion des Images du Produit */}
              <div className="space-y-2 border-t border-slate-800 pt-3">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-[#7B61FF]" /> Images du Produit ({editImages.length})
                  </label>
                  <label
                    htmlFor="edit-image-upload"
                    className="cursor-pointer text-[11px] text-primary hover:underline flex items-center gap-1 font-semibold"
                  >
                    {isUploadingEditImage ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <>
                        <Upload className="w-3 h-3" /> + Ajouter une image
                      </>
                    )}
                  </label>
                  <input
                    type="file"
                    id="edit-image-upload"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleAddEditImage}
                    className="hidden"
                  />
                </div>

                {editImages.length === 0 ? (
                  <p className="text-[11px] text-slate-500 italic">Aucune image rattachée à ce produit.</p>
                ) : (
                  <div className="grid grid-cols-4 gap-2 pt-1">
                    {editImages.map((img) => (
                      <div
                        key={img.id}
                        className={`relative group rounded-xl overflow-hidden border aspect-square ${
                          img.is_primary
                            ? "border-amber-400 ring-2 ring-amber-400/30"
                            : "border-slate-800"
                        }`}
                      >
                        <img src={img.url} alt="Produit" className="w-full h-full object-cover" />
                        {img.is_primary && (
                          <span className="absolute top-1 left-1 bg-amber-500 text-black text-[8px] font-bold px-1 rounded flex items-center gap-0.5">
                            <Star className="w-2.5 h-2.5 fill-black" /> Principale
                          </span>
                        )}
                        <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                          {!img.is_primary && (
                            <button
                              type="button"
                              onClick={() => handleSetPrimaryEditImage(img.id)}
                              className="p-1.5 rounded bg-amber-500 text-black hover:bg-amber-400"
                              title="Définir comme principale"
                            >
                              <Star className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteEditImage(img)}
                            className="p-1.5 rounded bg-rose-500 text-white hover:bg-rose-600"
                            title="Supprimer l'image"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmittingEdit}
                className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
              >
                {isSubmittingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : "Mettre à jour le Produit"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Confirmation de Suppression / Archivage Sécurisé */}
      {deleteModalProduct && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-400" /> Confirmation Produit — {deleteModalProduct.name}
              </h3>
              <button
                onClick={() => setDeleteModalProduct(null)}
                className="text-slate-400 hover:text-slate-100 p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isCheckingDelete ? (
              <div className="py-6 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" /> Vérification de l'historique des commandes...
              </div>
            ) : deleteCheckOrdersCount && deleteCheckOrdersCount > 0 ? (
              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-amber-400">
                    <AlertTriangle className="w-4 h-4" /> Produit déjà utilisé dans des commandes ({deleteCheckOrdersCount})
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Ce produit est référencé dans <strong>{deleteCheckOrdersCount} commande(s)</strong> de votre historique commercial. Pour préserver l'intégrité de vos rapports de vente, nous vous recommandons fortement de l'<strong>ARCHIVER</strong> (rendre inactif) plutôt que de le supprimer.
                  </p>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    onClick={() => handleConfirmDeleteOrArchive("ARCHIVE")}
                    disabled={isSubmittingDelete}
                    className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold transition-all flex items-center justify-center gap-2"
                  >
                    <Archive className="w-4 h-4" /> Archiver le Produit (Recommandé)
                  </button>
                  <button
                    onClick={() => setDeleteModalProduct(null)}
                    className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <p className="text-slate-300">
                  Ce produit n'a aucune commande associée. Voulez-vous le supprimer définitivement ou simplement l'archiver ?
                </p>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setDeleteModalProduct(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold hover:bg-slate-700"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => handleConfirmDeleteOrArchive("ARCHIVE")}
                    disabled={isSubmittingDelete}
                    className="px-4 py-2 rounded-xl bg-amber-600 text-white font-semibold hover:bg-amber-500"
                  >
                    Archiver
                  </button>
                  <button
                    onClick={() => handleConfirmDeleteOrArchive("DELETE")}
                    disabled={isSubmittingDelete}
                    className="px-4 py-2 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-500"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal 4: Ré-ajuster Stock */}
      {isAdjustModalOpen && adjustProduct && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-amber-400" /> Ré-ajustement Stock — {adjustProduct.name}
              </h3>
              <button
                onClick={() => setIsAdjustModalOpen(false)}
                className="text-slate-400 hover:text-slate-100 p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdjustStockSubmit} className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Stock Physique Actuel :</span>
                  <span className="font-bold text-slate-100">{adjustProduct.product_stock?.[0]?.physical_stock || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Stock Réservé :</span>
                  <span className="font-bold text-amber-400">{adjustProduct.product_stock?.[0]?.reserved_stock || 0}</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Quantité à ajouter (ou soustraire avec -)</label>
                <input
                  type="number"
                  required
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-200 focus:outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Motif de l'ajustement</label>
                <input
                  type="text"
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-200 focus:outline-none focus:border-primary"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingAdjust}
                className="w-full py-3 rounded-xl bg-amber-600 text-white font-semibold text-xs hover:bg-amber-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
              >
                {isSubmittingAdjust ? <Loader2 className="w-4 h-4 animate-spin" /> : "Valider l'Ajustement SSOT"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
