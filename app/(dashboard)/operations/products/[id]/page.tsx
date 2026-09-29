"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Card, Badge, Button } from "@/components/ui/card";
import { DataSourceBadge } from "@/components/ui/data-source-badge";
import { createClient } from "@/src/infrastructure/supabase/client";
import {
  Package,
  ArrowLeft,
  RefreshCw,
  TrendingUp,
  DollarSign,
  Tag,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Clock,
  ShoppingCart,
  Inbox,
  ShieldCheck,
  Building2,
  Camera,
  Star,
  Upload,
  Trash2,
  Image as ImageIcon
} from "lucide-react";

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<any | null>(null);
  const [stock, setStock] = useState<any | null>(null);
  const [movements, setMovements] = useState<any[]>([]);
  const [orderItems, setOrderItems] = useState<any[]>([]);

  // Images state
  const [images, setImages] = useState<any[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  useEffect(() => {
    if (productId) {
      loadProductDetail();
    }
  }, [productId]);

  async function loadProductDetail() {
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: roles } = await supabase
        .from("user_organization_roles")
        .select("organization_id")
        .eq("user_id", user.id)
        .is("deleted_at", null)
      .order("created_at", { ascending: true });

      if (!roles || roles.length === 0) return;
      const orgId = roles[0].organization_id;

      // 1. Load Product
      const { data: prod, error: pErr } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .eq("organization_id", orgId)
        .single();

      if (pErr || !prod) {
        console.error("[Product Detail Error]", pErr?.message);
        setLoading(false);
        return;
      }
      setProduct(prod);

      // 2. Load Stock
      const { data: st } = await supabase
        .from("product_stock")
        .select("*")
        .eq("product_id", productId)
        .eq("organization_id", orgId)
        .single();

      if (st) setStock(st);

      // 3. Load Stock Movements Audit History
      const { data: mvts } = await supabase
        .from("stock_movements")
        .select("*")
        .eq("product_id", productId)
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });

      if (mvts) setMovements(mvts);

      // 4. Load Order Items & Orders
      const { data: oItems } = await supabase
        .from("order_items")
        .select("*, orders(*)")
        .eq("product_id", productId)
        .order("created_at", { ascending: false });

      if (oItems) setOrderItems(oItems);

      // 5. Load Product Images
      const { data: imgs } = await supabase
        .from("product_images")
        .select("*")
        .eq("product_id", productId)
        .eq("organization_id", orgId)
        .order("is_primary", { ascending: false })
        .order("sort_order", { ascending: true });

      if (imgs && imgs.length > 0) {
        setImages(imgs);
        const primary = imgs.find((i: any) => i.is_primary) || imgs[0];
        setSelectedImage(primary.url);
      } else {
        setImages([]);
        setSelectedImage(null);
      }
    } catch (err) {
      console.error("[Product Detail Exception]", err);
    } finally {
      setLoading(false);
    }
  }

  // Handle Set Primary Image
  const handleSetPrimaryImage = async (imageId: string) => {
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
      const orgId = roles[0].organization_id;

      // Reset all images for this product
      await supabase
        .from("product_images")
        .update({ is_primary: false })
        .eq("product_id", productId)
        .eq("organization_id", orgId);

      // Set target image to primary
      await supabase
        .from("product_images")
        .update({ is_primary: true })
        .eq("id", imageId)
        .eq("organization_id", orgId);

      await loadProductDetail();
    } catch (err) {
      console.error("[Set Primary Image Error]", err);
    }
  };

  // Handle Delete Image
  const handleDeleteImage = async (img: any) => {
    if (!confirm("Voulez-vous vraiment supprimer cette image ?")) return;
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
      const orgId = roles[0].organization_id;

      // Delete record from DB
      await supabase
        .from("product_images")
        .delete()
        .eq("id", img.id)
        .eq("organization_id", orgId);

      // Delete file from Storage if storage_path present
      if (img.storage_path) {
        await supabase.storage.from("product-images").remove([img.storage_path]);
      }

      await loadProductDetail();
    } catch (err) {
      console.error("[Delete Image Error]", err);
    }
  };

  // Handle Upload Image from Detail Page
  const handleUploadDetailImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);

    if (images.length + files.length > 5) {
      alert("Maximum 5 images autorisées par produit.");
      return;
    }

    setIsUploadingImage(true);
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
      const orgId = roles[0].organization_id;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
          alert("Formats autorisés : JPG, PNG, WEBP");
          continue;
        }
        if (file.size > 5 * 1024 * 1024) {
          alert("Chaque image doit faire moins de 5 Mo.");
          continue;
        }

        const ext = file.name.split(".").pop() || "jpg";
        const cleanFileName = `img_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}.${ext}`;
        const storagePath = `${orgId}/${productId}/${cleanFileName}`;

        const { error: uploadErr } = await supabase.storage
          .from("product-images")
          .upload(storagePath, file, { contentType: file.type, upsert: true });

        if (uploadErr) {
          console.error("[Storage Upload Error]", uploadErr.message);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from("product-images")
          .getPublicUrl(storagePath);

        const isFirst = images.length === 0 && i === 0;

        await supabase.from("product_images").insert({
          organization_id: orgId,
          product_id: productId,
          storage_path: storagePath,
          url: urlData.publicUrl,
          is_primary: isFirst,
          sort_order: images.length + i,
        });
      }

      await loadProductDetail();
    } catch (err) {
      console.error("[Upload Detail Images Exception]", err);
    } finally {
      setIsUploadingImage(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-xs text-slate-400 gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-primary" /> Chargement de la fiche produit...
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-8 text-center space-y-4 max-w-md mx-auto">
        <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-100">Produit non trouvé</h2>
        <p className="text-xs text-slate-400">Ce produit n'existe pas ou n'appartient pas à votre organisation.</p>
        <Link href="/operations/products">
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" /> Retour au catalogue
          </Button>
        </Link>
      </div>
    );
  }

  const phys = Number(stock?.physical_stock || 0);
  const res = Number(stock?.reserved_stock || 0);
  const avail = phys - res;
  const unitMargin = (product.selling_price || 0) - (product.purchase_price || 0);
  const marginPercent =
    product.selling_price > 0 ? Math.round((unitMargin / product.selling_price) * 100) : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up">
      {/* Back Link & Header */}
      <div className="space-y-3">
        <Link
          href="/operations/products"
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-slate-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Retour aux Produits
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-100">{product.name}</h1>
              <Badge variant={product.status === "ACTIVE" ? "success" : "outline"}>
                {product.status === "ACTIVE" ? "Actif" : "Inactif"}
              </Badge>
            </div>
            <p className="text-xs font-mono text-slate-400 mt-1">
              SKU: <span className="text-blue-400">{product.sku || "N/A"}</span> • Catégorie: {product.category}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <DataSourceBadge type="DATABASE" label="Fiche Produit SSOT" />
          </div>
        </div>
      </div>

      {/* Product Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase">Prix de Vente</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-slate-100 mt-2 font-mono">
            {Number(product.selling_price || 0).toLocaleString()} XOF
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Prix unitaire client</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase">Prix d'Achat</span>
            <Tag className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-300 mt-2 font-mono">
            {Number(product.purchase_price || 0).toLocaleString()} XOF
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Coût d'acquisition unitaire</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase">Marge Unitaire</span>
            <TrendingUp className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-blue-400 mt-2 font-mono">
            +{unitMargin.toLocaleString()} XOF
          </p>
          <p className="text-[11px] text-emerald-400 mt-1 font-mono">Marge brute: {marginPercent}%</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase">Stock Disponible</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400 mt-2 font-mono">{avail} Unités</p>
          <p className="text-[11px] text-slate-400 mt-1 font-mono">Physique: {phys} | Réservé: {res}</p>
        </Card>
      </div>

      {/* Main Grid: Galerie, Description & Stock Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Galerie des Images */}
        <Card className="p-6 space-y-4 lg:col-span-1">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h2 className="font-semibold text-slate-100 text-sm flex items-center gap-2">
              <Camera className="w-4 h-4 text-primary" /> Galerie Produit ({images.length}/5)
            </h2>
            <label className="cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary text-xs font-semibold transition-colors">
              <Upload className="w-3.5 h-3.5" />
              <span>+ Image</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleUploadDetailImages}
                disabled={isUploadingImage}
                className="hidden"
              />
            </label>
          </div>

          {isUploadingImage ? (
            <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" /> Upload des images en cours...
            </div>
          ) : images.length === 0 ? (
            <div className="border-2 border-dashed border-slate-800 rounded-2xl p-6 text-center space-y-2 bg-slate-950/40">
              <ImageIcon className="w-8 h-8 mx-auto text-slate-600" />
              <p className="text-xs font-semibold text-slate-400">Aucune image enregistrée</p>
              <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                Ajoutez des images pour valoriser ce produit dans le catalogue et sur WhatsApp.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Image Principale Display */}
              <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 aspect-4/3 group">
                <img
                  src={selectedImage || images[0]?.url}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
                {images.find((i) => i.url === selectedImage)?.is_primary && (
                  <span className="absolute top-2 left-2 bg-amber-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md">
                    <Star className="w-3 h-3 fill-black" /> Image Principale
                  </span>
                )}
                {/* Image Overlay Controls */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  {images.find((i) => i.url === selectedImage) && (
                    <>
                      {!images.find((i) => i.url === selectedImage)?.is_primary && (
                        <button
                          onClick={() => handleSetPrimaryImage(images.find((i) => i.url === selectedImage).id)}
                          className="px-3 py-1.5 rounded-xl bg-amber-500 text-black font-semibold text-xs flex items-center gap-1 hover:bg-amber-400"
                        >
                          <Star className="w-3.5 h-3.5 fill-black" /> Définir Principale
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteImage(images.find((i) => i.url === selectedImage))}
                        className="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-semibold text-xs flex items-center gap-1 hover:bg-rose-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Supprimer
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Thumbnails list */}
              <div className="grid grid-cols-5 gap-2">
                {images.map((img) => (
                  <button
                    key={img.id}
                    onClick={() => setSelectedImage(img.url)}
                    className={`relative rounded-xl overflow-hidden border aspect-square transition-all ${
                      selectedImage === img.url
                        ? "border-primary ring-2 ring-primary/40"
                        : "border-slate-800 hover:border-slate-700 opacity-70 hover:opacity-100"
                    }`}
                  >
                    <img src={img.url} alt="Miniature" className="w-full h-full object-cover" />
                    {img.is_primary && (
                      <span className="absolute top-0.5 left-0.5 bg-amber-500 rounded-full p-0.5">
                        <Star className="w-2 h-2 fill-black text-black" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Description & Attributes */}
        <Card className="p-6 space-y-4 lg:col-span-1">
          <h2 className="font-semibold text-slate-100 text-sm border-b border-slate-800 pb-2">
            Description & Détails
          </h2>
          <div className="text-xs text-slate-300 leading-relaxed">
            {product.description || "Aucune description renseignée pour ce produit."}
          </div>

          <div className="space-y-2 pt-2 text-xs font-mono border-t border-slate-800">
            <div className="flex justify-between">
              <span className="text-slate-400">Seuil d'Alerte :</span>
              <span className="font-bold text-amber-400">{product.minimum_stock || 5} Unités</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Devise :</span>
              <span className="text-slate-200">{product.currency || "XOF"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Créé le :</span>
              <span className="text-slate-200">{new Date(product.created_at).toLocaleDateString("fr-FR")}</span>
            </div>
          </div>
        </Card>

        {/* Stock Movements Audit Trail */}
        <Card className="p-6 space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h2 className="font-semibold text-slate-100 text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-400" /> Historique des Mouvements de Stock
            </h2>
            <span className="text-xs font-mono text-slate-400">{movements.length} événement(s)</span>
          </div>

          {movements.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">
              Aucun mouvement de stock enregistré pour ce produit.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-2.5">TYPE</th>
                    <th className="p-2.5">QUANTITÉ</th>
                    <th className="p-2.5">MOTIF / RÉFÉRENCE</th>
                    <th className="p-2.5">DATE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {movements.map((mvt) => (
                    <tr key={mvt.id}>
                      <td className="p-2.5">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-bold border border-slate-700">
                          {mvt.type}
                        </span>
                      </td>
                      <td className="p-2.5 font-bold text-emerald-400">+{mvt.quantity}</td>
                      <td className="p-2.5 text-slate-300">{mvt.reason || "Ajustement de stock"}</td>
                      <td className="p-2.5 text-slate-400">
                        {new Date(mvt.created_at).toLocaleString("fr-FR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Orders Containing This Product */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <h2 className="font-semibold text-slate-100 text-sm flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-blue-400" /> Commandes Associées à ce Produit
          </h2>
          <span className="text-xs font-mono text-slate-400">{orderItems.length} commande(s)</span>
        </div>

        {orderItems.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500">
            Aucune commande n'a encore été enregistrée pour ce produit.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-2.5">N° COMMANDE</th>
                  <th className="p-2.5">QUANTITÉ</th>
                  <th className="p-2.5">PRIX TOTAL</th>
                  <th className="p-2.5">STATUT</th>
                  <th className="p-2.5">DATE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {orderItems.map((item) => (
                  <tr key={item.id}>
                    <td className="p-2.5 font-bold text-blue-400">
                      {item.orders?.order_number || item.order_id.substring(0, 8)}
                    </td>
                    <td className="p-2.5 font-bold">{item.quantity} Boîte(s)</td>
                    <td className="p-2.5 font-semibold text-emerald-400">
                      {Number(item.total_price || 0).toLocaleString()} XOF
                    </td>
                    <td className="p-2.5">
                      <Badge variant="success">{item.orders?.status || "CONFIRMED"}</Badge>
                    </td>
                    <td className="p-2.5 text-slate-400">
                      {new Date(item.created_at).toLocaleDateString("fr-FR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
