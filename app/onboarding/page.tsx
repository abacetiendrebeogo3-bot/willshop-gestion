"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/src/infrastructure/supabase/client";
import {
  Building2,
  MessageSquare,
  Package,
  Truck,
  Wallet,
  BrainCircuit,
  CheckCircle2,
  ArrowRight,
  Loader2,
  AlertCircle,
  Sparkles,
  ShieldCheck
} from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [organization, setOrganization] = useState<any>(null);

  // Step 1: Enterprise Form
  const [companyName, setCompanyName] = useState("");
  const [sector, setSector] = useState("SANTÉ & BEAUTÉ");
  const [country, setCountry] = useState("Burkina Faso");
  const [city, setCity] = useState("Ouagadougou");
  const [currency, setCurrency] = useState("XOF");
  const [companyPhone, setCompanyPhone] = useState("");

  // Step 2: WhatsApp Connection State
  const [waPhoneNumber, setWaPhoneNumber] = useState("+226 70 00 00 01");
  const [isWaConnected, setIsWaConnected] = useState(false);

  // Step 3: Product Form
  const [productName, setProductName] = useState("");
  const [productSku, setProductSku] = useState("");
  const [sellingPrice, setSellingPrice] = useState("10000");
  const [purchasePrice, setPurchasePrice] = useState("4000");
  const [initialStock, setInitialStock] = useState("50");
  const [productSaved, setProductSaved] = useState(false);

  // Step 4: Delivery Form
  const [deliveryZone, setDeliveryZone] = useState("Ouagadougou (Centre)");
  const [deliveryFee, setDeliveryFee] = useState("1000");
  const [deliverySaved, setDeliverySaved] = useState(false);

  // Step 5: Finance Form
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [initialCashBalance, setInitialCashBalance] = useState("50000");
  const [financeSaved, setFinanceSaved] = useState(false);

  // Check authentication & existing organization on load
  useEffect(() => {
    async function checkState() {
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

      if (roles && roles.length > 0) {
        const orgId = roles[0].organization_id;
        const { data: org } = await supabase.from("organizations").select("*").eq("id", orgId).single();

        if (org) {
          setOrganization(org);
          setCompanyName(org.name);
          setCountry(org.country || "Burkina Faso");
          setCurrency(org.currency || "XOF");
          if (org.settings?.company_phone) setCompanyPhone(org.settings.company_phone);
          if (org.settings?.onboarding_step) {
            const stepMap: Record<string, number> = {
              WHATSAPP: 2,
              PRODUCT: 3,
              DELIVERY: 4,
              FINANCE: 5,
              INTELLIGENCE: 6,
              COMPLETE: 6,
            };
            setCurrentStep(stepMap[org.settings.onboarding_step] || 2);
          } else {
            setCurrentStep(2);
          }
        }
      }
    }

    checkState();
  }, [router]);

  // Handle Step 1: Create Organization
  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setErrorMessage("");

    if (!companyName.trim()) {
      setErrorMessage("Veuillez entrer le nom de votre entreprise.");
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();
      let {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        const { data: refreshedData } = await supabase.auth.refreshSession();
        if (refreshedData?.session) {
          session = refreshedData.session;
        }
      }

      const token = session?.access_token;

      const res = await fetch("/api/organization/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: companyName.trim(),
          sector,
          country,
          city,
          currency,
          phone: companyPhone.trim(),
        }),
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch (jsonErr) {
        data = { error: `Réponse serveur invalide (${res.status}): ${text.substring(0, 150)}` };
      }

      if (!res.ok || data.error) {
        let msg = data.error || `Erreur serveur HTTP ${res.status} lors de la création de l'entreprise`;
        if (res.status === 401) {
          msg = data.error || "Votre session d'authentification a expiré ou n'a pas été transmise. Redirection vers la page de connexion...";
          setTimeout(() => router.push("/login"), 2500);
        }
        setErrorMessage(msg);
        setIsLoading(false);
        return;
      }

      setOrganization(data.organization);
      setCurrentStep(2);
    } catch (err: any) {
      let msg = err?.message || "Erreur réseau lors de la création de l'entreprise";
      if (msg.includes("Unexpected end of JSON input") || msg.includes("JSON.parse")) {
        msg = "Erreur de communication avec le serveur (réponse vide). Veuillez réessayer.";
      }
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Step 2: Connect WhatsApp
  const handleConnectWhatsApp = async () => {
    if (!organization) return;
    setIsLoading(true);
    setErrorMessage("");

    try {
      const supabase = createClient();

      // Register test WhatsApp line for the user's organization
      const { error } = await supabase.from("whatsapp_numbers").insert({
        organization_id: organization.id,
        phone_number: waPhoneNumber.replace(/\s+/g, ""),
        display_name: `${companyName} Line`,
        provider: "META_CLOUD_API",
        provider_phone_number_id: `wa-pid-${Date.now()}`,
        status: "ACTIVE",
      });

      if (error && !error.message.includes("unique")) {
        console.warn("[WA Number Register]", error.message);
      }

      // Update Org Onboarding State
      await supabase
        .from("organizations")
        .update({
          settings: { ...organization.settings, onboarding_step: "PRODUCT" },
        })
        .eq("id", organization.id);

      setIsWaConnected(true);
    } catch (err: any) {
      setErrorMessage(err.message || "Erreur de connexion WhatsApp");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Step 3: Add Product
  const handleAddProduct = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!organization) return;

    if (!productName.trim()) {
      setCurrentStep(4);
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();

      const sku = productSku.trim() || `WS-${Math.floor(100 + Math.random() * 900)}`;

      const { data: prod, error: pErr } = await supabase
        .from("products")
        .insert({
          organization_id: organization.id,
          sku,
          name: productName.trim(),
          selling_price: Number(sellingPrice) || 10000,
          purchase_price: Number(purchasePrice) || 4000,
          category: sector || "SANTE",
          minimum_stock: 5,
          status: "ACTIVE",
        })
        .select()
        .single();

      if (pErr) {
        setErrorMessage(`Erreur produit: ${pErr.message}`);
        setIsLoading(false);
        return;
      }

      if (prod) {
        await supabase.from("product_stock").insert({
          organization_id: organization.id,
          product_id: prod.id,
          physical_stock: Number(initialStock) || 50,
          reserved_stock: 0,
          minimum_stock: 5,
        });
      }

      setProductSaved(true);
      setTimeout(() => {
        setCurrentStep(4);
        setIsLoading(false);
      }, 500);
    } catch (err: any) {
      setErrorMessage(err.message || "Erreur lors de l'enregistrement du produit");
      setIsLoading(false);
    }
  };

  // Handle Step 4: Add Delivery Zone
  const handleAddDelivery = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!organization) return;

    setIsLoading(true);
    try {
      const supabase = createClient();
      await supabase.from("zones").insert({
        organization_id: organization.id,
        name: deliveryZone,
        city: city || "Ouagadougou",
        delivery_fee: Number(deliveryFee) || 1000,
        status: "ACTIVE",
      });
      setDeliverySaved(true);
      setTimeout(() => {
        setCurrentStep(5);
        setIsLoading(false);
      }, 500);
    } catch {
      setCurrentStep(5);
      setIsLoading(false);
    }
  };

  // Handle Step 5: Finance
  const handleAddFinance = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!organization) return;

    setIsLoading(true);
    try {
      const supabase = createClient();
      await supabase.from("financial_accounts").insert({
        organization_id: organization.id,
        name: paymentMethod === "ORANGE_MONEY" ? "Caisse Orange Money" : "Caisse Principale",
        type: paymentMethod === "ORANGE_MONEY" ? "MOBILE_MONEY" : "CASH_REGISTER",
        opening_balance: Number(initialCashBalance) || 0,
        current_balance: Number(initialCashBalance) || 0,
        currency: currency || "XOF",
        status: "ACTIVE",
      });
      setFinanceSaved(true);
      setTimeout(() => {
        setCurrentStep(6);
        setIsLoading(false);
      }, 500);
    } catch {
      setCurrentStep(6);
      setIsLoading(false);
    }
  };

  const stepsList = [
    { num: 1, label: "Entreprise", icon: Building2 },
    { num: 2, label: "WhatsApp", icon: MessageSquare },
    { num: 3, label: "Produits", icon: Package },
    { num: 4, label: "Livraison", icon: Truck },
    { num: 5, label: "Finance", icon: Wallet },
    { num: 6, label: "Intelligence", icon: BrainCircuit },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-center items-center p-6 selection:bg-primary/20">
      <div className="w-full max-w-2xl space-y-6">
        {/* Top Header */}
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-purple-500 flex items-center justify-center font-black text-lg text-white shadow-lg shadow-primary/20">
              W
            </div>
            <span className="font-bold text-xl tracking-tight">WILLShop OS</span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Bienvenue dans WILLShop OS 👋</h1>
          <p className="text-xs text-muted-foreground">Créons votre espace professionnel en quelques étapes simples.</p>
        </div>

        {/* Progress Bar */}
        <div className="p-4 rounded-2xl bg-card border border-border shadow-sm flex items-center justify-between gap-2 overflow-x-auto">
          {stepsList.map((st) => {
            const Icon = st.icon;
            const isDone = currentStep > st.num;
            const isCurrent = currentStep === st.num;

            return (
              <div key={st.num} className="flex items-center gap-2 min-w-max">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold transition-all ${
                    isDone
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                      : isCurrent
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                      : "bg-secondary text-muted-foreground border border-border"
                  }`}
                >
                  {isDone ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <span className={`text-xs font-medium ${isCurrent ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                  {st.label}
                </span>
                {st.num < 6 && <div className="w-4 h-[1px] bg-border mx-1" />}
              </div>
            );
          })}
        </div>

        {/* Card Content */}
        <div className="p-6 rounded-3xl bg-card border border-border shadow-xl space-y-6">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* STEP 1: Entreprise */}
          {currentStep === 1 && (
            <form onSubmit={handleCreateOrganization} className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-bold">1. Informations de l'Entreprise</h2>
                <p className="text-xs text-muted-foreground">Définissez l'identité de votre espace professionnel.</p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Nom de l'entreprise *</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Ex: WillShop Boutique"
                    required
                    className="w-full bg-background border border-input rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Secteur d'activité</label>
                    <select
                      value={sector}
                      onChange={(e) => setSector(e.target.value)}
                      className="w-full bg-background border border-input rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="SANTÉ & BEAUTÉ">Santé & Beauté</option>
                      <option value="MODE & HABILLEMENT">Mode & Habillement</option>
                      <option value="ÉLECTRONIQUE">Électronique & High-Tech</option>
                      <option value="ALIMENTATION">Alimentation & Restauration</option>
                      <option value="SERVICES">Services & Conseil</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Téléphone pro</label>
                    <input
                      type="tel"
                      value={companyPhone}
                      onChange={(e) => setCompanyPhone(e.target.value)}
                      placeholder="+226 70 00 00 00"
                      className="w-full bg-background border border-input rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Pays</label>
                    <input
                      type="text"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full bg-background border border-input rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Ville</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full bg-background border border-input rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Devise</label>
                    <input
                      type="text"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full bg-background border border-input rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Création de l'espace...
                  </>
                ) : (
                  <>
                    Créer mon espace <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* STEP 2: WhatsApp Connection */}
          {currentStep === 2 && (
            <div className="space-y-5">
              <div className="space-y-1">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-emerald-400" /> 💬 Connectez votre WhatsApp
                </h2>
                <p className="text-xs text-muted-foreground">
                  Transformez WhatsApp en canal de vente intelligent connecté à votre entreprise.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-secondary/50 border border-border space-y-3">
                <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Votre Agent Commercial IA pourra :</h3>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> Répondre automatiquement aux clients 24/7
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> Présenter vos produits et tarifs exacts sans hallucination
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> Enregistrer les commandes et réserver le stock en temps réel
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> Transmettre les demandes complexes à un conseiller humain
                  </li>
                </ul>
              </div>

              {!isWaConnected ? (
                <div className="space-y-3 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Numéro WhatsApp Business de Test / Pilote</label>
                    <input
                      type="tel"
                      value={waPhoneNumber}
                      onChange={(e) => setWaPhoneNumber(e.target.value)}
                      placeholder="+226 70 00 00 01"
                      className="w-full bg-background border border-input rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleConnectWhatsApp}
                      disabled={isLoading}
                      className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Connexion à l'infrastructure Meta...
                        </>
                      ) : (
                        <>
                          <MessageSquare className="w-4 h-4" /> Connecter mon WhatsApp
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setCurrentStep(3)}
                      className="py-3 px-5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-medium text-sm transition-all"
                    >
                      Passer cette étape
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                      <CheckCircle2 className="w-5 h-5" /> 🟢 WhatsApp connecté
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                      Webhook Actif
                    </span>
                  </div>

                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>Numéro associé : <span className="font-mono text-foreground">{waPhoneNumber}</span></div>
                    <div>Agent commercial : <span className="text-emerald-400 font-medium">Prêt & Opérationnel</span></div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2 mt-2"
                  >
                    Continuer <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Produits */}
          {currentStep === 3 && (
            <form onSubmit={handleAddProduct} className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-400" /> 📦 Ajoutez votre premier produit
                </h2>
                <p className="text-xs text-muted-foreground">
                  Enregistrez un premier produit au catalogue pour permettre la prise de commande.
                </p>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Nom du produit *</label>
                    <input
                      type="text"
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                      placeholder="Ex: Thé Minceur Premium"
                      className="w-full bg-background border border-input rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">SKU / Code Produit</label>
                    <input
                      type="text"
                      value={productSku}
                      onChange={(e) => setProductSku(e.target.value)}
                      placeholder="WS-PROD-01"
                      className="w-full bg-background border border-input rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Prix Vente (XOF)</label>
                    <input
                      type="number"
                      value={sellingPrice}
                      onChange={(e) => setSellingPrice(e.target.value)}
                      className="w-full bg-background border border-input rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Prix Achat/Coût (XOF)</label>
                    <input
                      type="number"
                      value={purchasePrice}
                      onChange={(e) => setPurchasePrice(e.target.value)}
                      className="w-full bg-background border border-input rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Stock Initial</label>
                    <input
                      type="number"
                      value={initialStock}
                      onChange={(e) => setInitialStock(e.target.value)}
                      className="w-full bg-background border border-input rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ajouter le produit"}
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  className="py-3 px-5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-medium text-sm transition-all"
                >
                  Je le ferai plus tard
                </button>
              </div>
            </form>
          )}

          {/* STEP 4: Livraison */}
          {currentStep === 4 && (
            <form onSubmit={handleAddDelivery} className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Truck className="w-5 h-5 text-purple-400" /> 🚚 Configurons vos livraisons
                </h2>
                <p className="text-xs text-muted-foreground">
                  Définissez votre première zone et votre tarif de livraison standard.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Zone de livraison principal</label>
                  <input
                    type="text"
                    value={deliveryZone}
                    onChange={(e) => setDeliveryZone(e.target.value)}
                    placeholder="Ouagadougou (Centre)"
                    className="w-full bg-background border border-input rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Tarif de livraison (XOF)</label>
                  <input
                    type="number"
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(e.target.value)}
                    placeholder="1000"
                    className="w-full bg-background border border-input rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Configurer maintenant"}
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentStep(5)}
                  className="py-3 px-5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-medium text-sm transition-all"
                >
                  Plus tard
                </button>
              </div>
            </form>
          )}

          {/* STEP 5: Finance */}
          {currentStep === 5 && (
            <form onSubmit={handleAddFinance} className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-amber-400" /> 💰 Configurons votre finance
                </h2>
                <p className="text-xs text-muted-foreground">
                  Créez votre premier compte de trésorerie professionnel.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Mode de paiement principal</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full bg-background border border-input rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="CASH">Caisse Espèces / Cash</option>
                    <option value="ORANGE_MONEY">Orange Money Business</option>
                    <option value="WAVE">Wave Business</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Solde de démarrage (XOF)</label>
                  <input
                    type="number"
                    value={initialCashBalance}
                    onChange={(e) => setInitialCashBalance(e.target.value)}
                    placeholder="50000"
                    className="w-full bg-background border border-input rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enregistrer la trésorerie"}
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentStep(6)}
                  className="py-3 px-5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-medium text-sm transition-all"
                >
                  Plus tard
                </button>
              </div>
            </form>
          )}

          {/* STEP 6: Intelligence & Confirmation */}
          {currentStep === 6 && (
            <div className="space-y-5 text-center py-2">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary via-purple-500 to-indigo-500 text-white flex items-center justify-center mx-auto shadow-xl shadow-primary/30">
                <BrainCircuit className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <h2 className="text-xl font-bold">🎉 Votre espace est prêt !</h2>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Entreprise <span className="font-semibold text-foreground">{companyName}</span> configurée. Votre intelligence business analysera vos ventes en temps réel selon la chaîne :
                </p>
                <div className="pt-2 text-xs font-mono font-semibold text-primary">
                  Données → Insight → Recommandation → Action → Vérification
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-secondary/50 border border-border text-left space-y-2 text-xs">
                <div className="font-semibold text-foreground">Récapitulatif de votre espace :</div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Entreprise :</span> <span className="font-medium text-foreground">{companyName}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>WhatsApp :</span> <span className="text-emerald-400 font-medium">{isWaConnected ? "Connecté 🟢" : "En attente"}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Catalogue :</span> <span className="font-medium text-foreground">{productName ? "1 produit créé" : "À ajouter"}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Cockpit CEO AI :</span> <span className="text-emerald-400 font-medium">Opérationnel 🟢</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => router.push("/ceo")}
                className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-semibold text-base shadow-xl shadow-primary/25 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
              >
                Entrer dans mon espace <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
