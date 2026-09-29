"use client";

import React, { useState, useEffect } from "react";
import { PageTransition } from "@/components/animations/PageTransition";
import Link from "next/link";
import { createClient } from "@/src/infrastructure/supabase/client";
import { Card } from "@/components/ui/card";
import {
  Bot,
  BrainCircuit,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Play,
  Save,
  Plus,
  Trash2,
  Edit3,
  Clock,
  Globe,
  MessageSquare,
  Package,
  Users,
  Search,
  Filter,
  CheckSquare,
  Lock,
  RefreshCw,
  Loader2,
  X,
  Sliders,
  Radio,
  FileText,
  DollarSign,
  UserCheck,
  Send,
  Zap,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  MapPin,
  CreditCard,
  HelpCircle,
  FileCheck,
  Archive,
  Building2,
  Truck,
  FileCode,
  MessageCircle,
  Star,
  Camera,
} from "lucide-react";

export interface CompanyInfo {
  name: string;
  sector: string;
  country: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  hours: string;
  description: string;
  additionalInfo: string;
}

export interface DeliveryZone {
  id: string;
  name: string;
  districts: string[];
  fee: number;
  delay: string;
  status: "ACTIVE" | "ARCHIVED";
  notes?: string;
}

export interface PaymentMethodConfig {
  id: string;
  name: string;
  identifier: string;
  instructions: string;
  status: "ACTIVE" | "ARCHIVED";
  notes?: string;
}

export interface FAQEntry {
  id: string;
  question: string;
  answer: string;
  category: string;
  status: "ACTIVE" | "ARCHIVED";
}

export interface PolicyEntry {
  id: string;
  title: string;
  content: string;
  status: "ACTIVE" | "ARCHIVED";
  updatedAt: string;
}

export interface TestimonialEntry {
  id: string;
  clientName: string;
  text: string;
  productId?: string;
  date: string;
  source: string;
  status: "ACTIVE" | "ARCHIVED";
  mediaUrl?: string;
  storagePath?: string;
  consentStatus?: "UNKNOWN" | "AUTHORIZED" | "NOT_AUTHORIZED";
  isPublic?: boolean;
  notes?: string;
}

export interface KnowledgeEntry {
  id: string;
  title: string;
  category: "ENTREPRISE" | "LIVRAISON" | "PAIEMENT" | "FAQ" | "POLITIQUES" | "AUTRES";
  content: string;
  status: "ACTIVE" | "ARCHIVED";
  createdAt: string;
}

export default function AIAgentsConfigPage() {
  const [organizationId, setOrganizationId] = useState<string>("");
  const [organizationName, setOrganizationName] = useState<string>("WILLShop OS");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Real Metrics from Database
  const [metrics, setMetrics] = useState({
    activeConversations: 0,
    customersCount: 0,
    escalationsCount: 0,
    productsCount: 0,
  });

  // Global AI Status
  const [aiEnabled, setAiEnabled] = useState<boolean>(true);

  // Section 1: Agent Identity Config State
  const [identityConfig, setIdentityConfig] = useState({
    name: "Sales AI",
    presentation: "Assistant commercial virtuel disponible 24/7 pour conseiller et accompagner vos clients.",
    tone: "Professionnel & Chaleureux",
    language: "Français",
    style: "Concis (1-2 phrases)",
    customInstructions: "Accueillir chaleureusement les clients. Être poli et donner des informations précises sur nos produits.",
    auto_send_images: true,
    handoff_keywords: "humain, agent, conseiller, remboursement, responsable, parler à quelqu'un, problème",
  });

  // Section 2: Structured Knowledge Base States
  const [activeKnowledgeTab, setActiveKnowledgeTab] = useState<
    "ENTREPRISE" | "LIVRAISON" | "PAIEMENT" | "FAQ" | "POLITIQUES" | "TÉMOIGNAGES"
  >("ENTREPRISE");

  // 1. Company Info State
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({
    name: "",
    sector: "",
    country: "",
    city: "",
    address: "",
    phone: "",
    email: "",
    hours: "",
    description: "",
    additionalInfo: "",
  });

  // 2. Delivery Zones State
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [showZoneModal, setShowZoneModal] = useState<boolean>(false);
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
  const [zoneForm, setZoneForm] = useState<{
    name: string;
    districtsRaw: string;
    fee: number;
    delay: string;
    status: "ACTIVE" | "ARCHIVED";
    notes: string;
  }>({
    name: "",
    districtsRaw: "",
    fee: 1000,
    delay: "24h",
    status: "ACTIVE",
    notes: "",
  });

  // 3. Payment Methods State
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodConfig[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [editingPayment, setEditingPayment] = useState<PaymentMethodConfig | null>(null);
  const [paymentForm, setPaymentForm] = useState<{
    name: string;
    identifier: string;
    instructions: string;
    status: "ACTIVE" | "ARCHIVED";
    notes: string;
  }>({
    name: "",
    identifier: "",
    instructions: "",
    status: "ACTIVE",
    notes: "",
  });

  // 4. FAQs State
  const [faqs, setFaqs] = useState<FAQEntry[]>([]);
  const [showFaqModal, setShowFaqModal] = useState<boolean>(false);
  const [editingFaq, setEditingFaq] = useState<FAQEntry | null>(null);
  const [faqForm, setFaqForm] = useState<{
    question: string;
    answer: string;
    category: string;
    status: "ACTIVE" | "ARCHIVED";
  }>({
    question: "",
    answer: "",
    category: "Général",
    status: "ACTIVE",
  });

  // 5. Policies State
  const [policies, setPolicies] = useState<PolicyEntry[]>([]);
  const [showPolicyModal, setShowPolicyModal] = useState<boolean>(false);
  const [editingPolicy, setEditingPolicy] = useState<PolicyEntry | null>(null);
  const [policyForm, setPolicyForm] = useState<{
    title: string;
    content: string;
    status: "ACTIVE" | "ARCHIVED";
  }>({
    title: "",
    content: "",
    status: "ACTIVE",
  });

  // 6. Testimonials State
  const [testimonials, setTestimonials] = useState<TestimonialEntry[]>([]);
  const [showTestimonialModal, setShowTestimonialModal] = useState<boolean>(false);
  const [editingTestimonial, setEditingTestimonial] = useState<TestimonialEntry | null>(null);
  const [testimonialForm, setTestimonialForm] = useState<{
    clientName: string;
    text: string;
    productId: string;
    date: string;
    source: string;
    status: "ACTIVE" | "ARCHIVED";
    mediaUrl: string;
    storagePath: string;
    consentStatus: "UNKNOWN" | "AUTHORIZED" | "NOT_AUTHORIZED";
    isPublic: boolean;
    notes: string;
  }>({
    clientName: "",
    text: "",
    productId: "",
    date: new Date().toISOString().split("T")[0],
    source: "WhatsApp",
    status: "ACTIVE",
    mediaUrl: "",
    storagePath: "",
    consentStatus: "AUTHORIZED",
    isPublic: true,
    notes: "",
  });

  // Selected file & preview state for testimonial image upload
  const [testimonialFile, setTestimonialFile] = useState<File | null>(null);
  const [testimonialPreviewUrl, setTestimonialPreviewUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Real Products List for Selection
  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);

  // Knowledge Base Articles
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeEntry[]>([]);

  // Section 3: Tools & Capabilities State
  const [toolsConfig, setToolsConfig] = useState<Record<string, boolean>>({
    search_products: true,
    check_price: true,
    check_stock: true,
    check_zones: true,
    lookup_customer: true,
    lookup_orders: true,
    lookup_delivery: true,
    send_product_card: true,
    send_product_image: true,
    search_testimonials: true,
    send_testimonial: true,
    create_order: true,
    update_crm: true,
    escalate_human: true,
  });

  // Section 6: Schedule & Availability State
  const [scheduleConfig, setScheduleConfig] = useState({
    active: false,
    mode: "24/7",
    startTime: "08:00",
    endTime: "20:00",
    timezone: "Africa/Ouagadougou",
  });

  // Test Modal State
  const [showTestModal, setShowTestModal] = useState<boolean>(false);
  const [testInputMessage, setTestInputMessage] = useState<string>(
    "Bonjour, quel est le tarif de livraison pour Kossodo ?"
  );
  const [isExecutingTest, setIsExecutingTest] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    responseText?: string;
    triggerHandoff?: boolean;
    confidence?: number;
    error?: string;
    latencyMs?: number;
  } | null>(null);

  // Accordions open states
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    identity: true,
    knowledge: true,
    catalog: true,
    tools: true,
    guardrails: true,
    human: true,
    schedule: true,
  });

  const toggleSection = (sectionKey: string) => {
    setOpenSections((prev) => ({ ...prev, [sectionKey]: !prev[sectionKey] }));
  };

  // Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Load Real Data from Supabase
  const loadConfigData = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: userRoles } = await supabase
        .from("user_organization_roles")
        .select("organization_id")
        .eq("user_id", user.id)
        .is("deleted_at", null)
      .order("created_at", { ascending: true });

      const targetOrgId = userRoles?.[0]?.organization_id;
      if (!targetOrgId) return;

      setOrganizationId(targetOrgId);

      // Fetch Organization details & settings
      const { data: org } = await supabase
        .from("organizations")
        .select("name, settings")
        .eq("id", targetOrgId)
        .single();

      if (org) {
        setOrganizationName(org.name);
        const settings = org.settings || {};
        setAiEnabled(settings.ai_agent_enabled ?? true);

        const aiConfig = settings.ai_agent_config || {};
        setIdentityConfig({
          name: aiConfig.name || "Sales AI",
          presentation: aiConfig.presentation || "",
          tone: aiConfig.tone || "Professionnel & Chaleureux",
          language: aiConfig.language || "Français",
          style: aiConfig.style || "Concis (1-2 phrases)",
          customInstructions: aiConfig.custom_instructions || "",
          auto_send_images: aiConfig.auto_send_images ?? true,
          handoff_keywords: Array.isArray(aiConfig.handoff_keywords)
            ? aiConfig.handoff_keywords.join(", ")
            : typeof aiConfig.handoff_keywords === "string"
            ? aiConfig.handoff_keywords
            : "humain, agent, conseiller, remboursement, responsable, parler à quelqu'un, problème",
        });

        // 1. Company Info Sync
        if (aiConfig.company_info) {
          setCompanyInfo({
            name: aiConfig.company_info.name || org.name || "",
            sector: aiConfig.company_info.sector || "",
            country: aiConfig.company_info.country || "",
            city: aiConfig.company_info.city || "",
            address: aiConfig.company_info.address || "",
            phone: aiConfig.company_info.phone || "",
            email: aiConfig.company_info.email || "",
            hours: aiConfig.company_info.hours || "",
            description: aiConfig.company_info.description || "",
            additionalInfo: aiConfig.company_info.additionalInfo || "",
          });
        } else {
          setCompanyInfo((prev) => ({ ...prev, name: org.name || prev.name }));
        }

        // 2. Delivery Zones
        if (aiConfig.delivery_zones && Array.isArray(aiConfig.delivery_zones)) {
          setDeliveryZones(aiConfig.delivery_zones);
        }

        // 3. Payment Methods
        if (aiConfig.payment_methods && Array.isArray(aiConfig.payment_methods)) {
          setPaymentMethods(aiConfig.payment_methods);
        }

        // 4. FAQs
        if (aiConfig.faqs && Array.isArray(aiConfig.faqs)) {
          setFaqs(aiConfig.faqs);
        }

        // 5. Policies
        if (aiConfig.policies && Array.isArray(aiConfig.policies)) {
          setPolicies(aiConfig.policies);
        }

        // 6. Testimonials
        if (aiConfig.testimonials && Array.isArray(aiConfig.testimonials)) {
          setTestimonials(aiConfig.testimonials);
        }

        if (aiConfig.knowledge_base && Array.isArray(aiConfig.knowledge_base)) {
          setKnowledgeBase(aiConfig.knowledge_base);
        }

        if (aiConfig.tools) {
          setToolsConfig((prev) => ({ ...prev, ...aiConfig.tools }));
        }

        if (aiConfig.schedule) {
          setScheduleConfig((prev) => ({ ...prev, ...aiConfig.schedule }));
        }
      }

      // Fetch Real Catalog Products & Metrics
      const [{ count: convCount }, { count: custCount }, { count: handoffCount }, { data: prodsList, count: prodCount }] =
        await Promise.all([
          supabase
            .from("conversations")
            .select("*", { count: "exact", head: true })
            .eq("organization_id", targetOrgId)
            .neq("status", "ARCHIVED"),
          supabase
            .from("customers")
            .select("*", { count: "exact", head: true })
            .eq("organization_id", targetOrgId),
          supabase
            .from("human_handoffs")
            .select("*", { count: "exact", head: true })
            .eq("organization_id", targetOrgId)
            .eq("status", "PENDING"),
          supabase
            .from("products")
            .select("id, name, sku, selling_price")
            .eq("organization_id", targetOrgId)
            .eq("status", "ACTIVE"),
        ]);

      if (prodsList) {
        setCatalogProducts(prodsList);
      }

      setMetrics({
        activeConversations: convCount || 0,
        customersCount: custCount || 0,
        escalationsCount: handoffCount || 0,
        productsCount: prodCount || 0,
      });
    } catch (err) {
      console.error("Erreur chargement config Agent IA:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConfigData();
  }, []);

  // Save Settings to Supabase Database
  const handleSaveConfig = async () => {
    if (!organizationId) return;
    setIsSaving(true);
    try {
      const supabase = createClient();

      const { data: currentOrg } = await supabase
        .from("organizations")
        .select("settings")
        .eq("id", organizationId)
        .single();

      const existingSettings = currentOrg?.settings || {};

      const updatedSettings = {
        ...existingSettings,
        ai_agent_enabled: aiEnabled,
        ai_agent_config: {
          ...(existingSettings.ai_agent_config || {}),
          name: identityConfig.name,
          presentation: identityConfig.presentation,
          tone: identityConfig.tone,
          language: identityConfig.language,
          style: identityConfig.style,
          custom_instructions: identityConfig.customInstructions,
          auto_send_images: identityConfig.auto_send_images,
          handoff_keywords: identityConfig.handoff_keywords
            ? identityConfig.handoff_keywords.split(",").map((k) => k.trim()).filter(Boolean)
            : ["humain", "agent", "conseiller", "remboursement", "responsable"],
          enabled: aiEnabled,
          company_info: companyInfo,
          delivery_zones: deliveryZones,
          payment_methods: paymentMethods,
          faqs: faqs,
          policies: policies,
          testimonials: testimonials,
          knowledge_base: knowledgeBase,
          tools: toolsConfig,
          schedule: scheduleConfig,
          updated_at: new Date().toISOString(),
        },
      };

      const { error } = await supabase
        .from("organizations")
        .update({
          name: companyInfo.name,
          settings: updatedSettings,
          updated_at: new Date().toISOString(),
        })
        .eq("id", organizationId);

      if (error) throw error;

      setOrganizationName(companyInfo.name);
      showToast("✓ Configuration enregistrée et synchronisée avec succès !");
    } catch (err: any) {
      alert(`Erreur enregistrement : ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // --- DELIVERY ZONES CRUD HANDLERS ---
  const handleSaveZone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!zoneForm.name.trim()) return;

    const districts = zoneForm.districtsRaw
      .split(/,|\n/)
      .map((d) => d.trim())
      .filter(Boolean);

    if (editingZone) {
      setDeliveryZones((prev) =>
        prev.map((z) =>
          z.id === editingZone.id
            ? {
                ...z,
                name: zoneForm.name.trim(),
                districts,
                fee: Number(zoneForm.fee),
                delay: zoneForm.delay.trim(),
                status: zoneForm.status,
                notes: zoneForm.notes.trim(),
              }
            : z
        )
      );
      showToast("✓ Zone de livraison modifiée");
    } else {
      const newZone: DeliveryZone = {
        id: `zone-${Date.now()}`,
        name: zoneForm.name.trim(),
        districts,
        fee: Number(zoneForm.fee),
        delay: zoneForm.delay.trim(),
        status: zoneForm.status,
        notes: zoneForm.notes.trim(),
      };
      setDeliveryZones((prev) => [newZone, ...prev]);
      showToast("✓ Nouvelle zone de livraison ajoutée");
    }

    setShowZoneModal(false);
    setEditingZone(null);
    setZoneForm({ name: "", districtsRaw: "", fee: 1000, delay: "24h", status: "ACTIVE", notes: "" });
  };

  const handleToggleZoneStatus = (id: string) => {
    setDeliveryZones((prev) =>
      prev.map((z) => (z.id === id ? { ...z, status: z.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE" } : z))
    );
    showToast("✓ Statut de la zone mis à jour");
  };

  const handleDeleteZone = (id: string) => {
    if (!confirm("Voulez-vous vraiment supprimer cette zone de livraison ?")) return;
    setDeliveryZones((prev) => prev.filter((z) => z.id !== id));
    showToast("🗑️ Zone supprimée");
  };

  // --- PAYMENT METHODS CRUD HANDLERS ---
  const handleSavePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentForm.name.trim() || !paymentForm.identifier.trim()) return;

    if (editingPayment) {
      setPaymentMethods((prev) =>
        prev.map((p) =>
          p.id === editingPayment.id
            ? {
                ...p,
                name: paymentForm.name.trim(),
                identifier: paymentForm.identifier.trim(),
                instructions: paymentForm.instructions.trim(),
                status: paymentForm.status,
                notes: paymentForm.notes.trim(),
              }
            : p
        )
      );
      showToast("✓ Moyen de paiement modifié");
    } else {
      const newPayment: PaymentMethodConfig = {
        id: `pay-${Date.now()}`,
        name: paymentForm.name.trim(),
        identifier: paymentForm.identifier.trim(),
        instructions: paymentForm.instructions.trim(),
        status: paymentForm.status,
        notes: paymentForm.notes.trim(),
      };
      setPaymentMethods((prev) => [newPayment, ...prev]);
      showToast("✓ Moyen de paiement ajouté");
    }

    setShowPaymentModal(false);
    setEditingPayment(null);
    setPaymentForm({ name: "", identifier: "", instructions: "", status: "ACTIVE", notes: "" });
  };

  const handleTogglePaymentStatus = (id: string) => {
    setPaymentMethods((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, status: p.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE" } : p
      )
    );
    showToast("✓ Statut mis à jour");
  };

  const handleDeletePayment = (id: string) => {
    if (!confirm("Voulez-vous vraiment supprimer ce moyen de paiement ?")) return;
    setPaymentMethods((prev) => prev.filter((p) => p.id !== id));
    showToast("🗑️ Moyen de paiement supprimé");
  };

  // --- FAQ CRUD HANDLERS ---
  const handleSaveFaq = (e: React.FormEvent) => {
    e.preventDefault();
    if (!faqForm.question.trim() || !faqForm.answer.trim()) return;

    if (editingFaq) {
      setFaqs((prev) =>
        prev.map((f) =>
          f.id === editingFaq.id
            ? {
                ...f,
                question: faqForm.question.trim(),
                answer: faqForm.answer.trim(),
                category: faqForm.category.trim(),
                status: faqForm.status,
              }
            : f
        )
      );
      showToast("✓ FAQ modifiée");
    } else {
      const newFaq: FAQEntry = {
        id: `faq-${Date.now()}`,
        question: faqForm.question.trim(),
        answer: faqForm.answer.trim(),
        category: faqForm.category.trim(),
        status: faqForm.status,
      };
      setFaqs((prev) => [newFaq, ...prev]);
      showToast("✓ Nouvelle FAQ ajoutée");
    }

    setShowFaqModal(false);
    setEditingFaq(null);
    setFaqForm({ question: "", answer: "", category: "Général", status: "ACTIVE" });
  };

  const handleToggleFaqStatus = (id: string) => {
    setFaqs((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, status: f.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE" } : f
      )
    );
    showToast("✓ Statut FAQ mis à jour");
  };

  const handleDeleteFaq = (id: string) => {
    if (!confirm("Voulez-vous vraiment supprimer cette FAQ ?")) return;
    setFaqs((prev) => prev.filter((f) => f.id !== id));
    showToast("🗑️ FAQ supprimée");
  };

  // --- POLICY CRUD HANDLERS ---
  const handleSavePolicy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!policyForm.title.trim() || !policyForm.content.trim()) return;

    if (editingPolicy) {
      setPolicies((prev) =>
        prev.map((p) =>
          p.id === editingPolicy.id
            ? {
                ...p,
                title: policyForm.title.trim(),
                content: policyForm.content.trim(),
                status: policyForm.status,
                updatedAt: new Date().toISOString(),
              }
            : p
        )
      );
      showToast("✓ Politique modifiée");
    } else {
      const newPolicy: PolicyEntry = {
        id: `pol-${Date.now()}`,
        title: policyForm.title.trim(),
        content: policyForm.content.trim(),
        status: policyForm.status,
        updatedAt: new Date().toISOString(),
      };
      setPolicies((prev) => [newPolicy, ...prev]);
      showToast("✓ Nouvelle politique ajoutée");
    }

    setShowPolicyModal(false);
    setEditingPolicy(null);
    setPolicyForm({ title: "", content: "", status: "ACTIVE" });
  };

  const handleDeletePolicy = (id: string) => {
    if (!confirm("Voulez-vous vraiment supprimer cette politique ?")) return;
    setPolicies((prev) => prev.filter((p) => p.id !== id));
    showToast("🗑️ Politique supprimée");
  };

  // --- TESTIMONIAL CRUD & UPLOAD HANDLERS ---
  const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
  const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

  const handleTestimonialFileSelect = (file: File) => {
    setImageUploadError(null);
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImageUploadError("Format d'image invalide. Formats acceptés : JPG, PNG, WEBP.");
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setImageUploadError(`Taille de fichier trop grande (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum autorisé : 5 MB.`);
      return;
    }

    setTestimonialFile(file);
    const localUrl = URL.createObjectURL(file);
    setTestimonialPreviewUrl(localUrl);
  };

  const handleRemoveTestimonialImage = () => {
    setTestimonialFile(null);
    setTestimonialPreviewUrl(null);
    setImageUploadError(null);
    setTestimonialForm((prev) => ({ ...prev, mediaUrl: "", storagePath: "" }));
  };

  const handleSaveTestimonial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testimonialForm.clientName.trim() || !testimonialForm.text.trim()) {
      showToast("Veuillez remplir les champs obligatoires (*)");
      return;
    }

    try {
      if (!organizationId) {
        showToast("Organisation non disponible. Veuillez recharger votre session.");
        setIsUploadingImage(false);
        return;
      }
      const supabase = createClient();
      const targetOrgId = organizationId;
      const testimonialId = editingTestimonial ? editingTestimonial.id : `testim-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      let finalMediaUrl = testimonialForm.mediaUrl;
      let finalStoragePath = testimonialForm.storagePath;

      // 1. Upload file if selected
      if (testimonialFile) {
        const cleanFileName = `${Date.now()}_${testimonialFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const storagePath = `${targetOrgId}/${testimonialId}/${cleanFileName}`;

        let bucketName = "testimonial-images";
        let uploadResult = await supabase.storage
          .from(bucketName)
          .upload(storagePath, testimonialFile, { contentType: testimonialFile.type, upsert: true });

        if (uploadResult.error) {
          console.warn("Upload to testimonial-images failed, trying product-images fallback:", uploadResult.error);
          bucketName = "product-images";
          uploadResult = await supabase.storage
            .from(bucketName)
            .upload(storagePath, testimonialFile, { contentType: testimonialFile.type, upsert: true });
        }

        if (uploadResult.error) {
          setImageUploadError(`Échec de l'upload de l'image: ${uploadResult.error.message}`);
          setIsUploadingImage(false);
          return;
        }

        const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(storagePath);
        finalMediaUrl = urlData?.publicUrl || "";

        // Remove old storage file if replaced
        if (testimonialForm.storagePath && testimonialForm.storagePath !== storagePath) {
          try {
            await supabase.storage.from("testimonial-images").remove([testimonialForm.storagePath]);
            await supabase.storage.from("product-images").remove([testimonialForm.storagePath]);
          } catch (cleanErr) {
            console.warn("Error cleaning old image:", cleanErr);
          }
        }

        finalStoragePath = storagePath;
      } else if (!testimonialForm.mediaUrl && testimonialForm.storagePath) {
        // Image was removed by user
        try {
          await supabase.storage.from("testimonial-images").remove([testimonialForm.storagePath]);
          await supabase.storage.from("product-images").remove([testimonialForm.storagePath]);
        } catch (cleanErr) {
          console.warn("Error cleaning removed image:", cleanErr);
        }
        finalMediaUrl = "";
        finalStoragePath = "";
      }

      const updatedEntry: TestimonialEntry = {
        id: testimonialId,
        clientName: testimonialForm.clientName.trim(),
        text: testimonialForm.text.trim(),
        productId: testimonialForm.productId || undefined,
        date: testimonialForm.date,
        source: testimonialForm.source,
        status: testimonialForm.status,
        mediaUrl: finalMediaUrl.trim() || undefined,
        storagePath: finalStoragePath.trim() || undefined,
        consentStatus: testimonialForm.consentStatus,
        isPublic: testimonialForm.isPublic,
        notes: testimonialForm.notes.trim() || undefined,
      };

      let newTestimonialsList: TestimonialEntry[];
      if (editingTestimonial) {
        newTestimonialsList = testimonials.map((t) => (t.id === editingTestimonial.id ? updatedEntry : t));
        showToast("✓ Témoignage modifié avec succès");
      } else {
        newTestimonialsList = [updatedEntry, ...testimonials];
        showToast("✓ Nouveau témoignage ajouté avec succès");
      }

      setTestimonials(newTestimonialsList);

      // Persist directly to DB
      if (targetOrgId) {
        const { data: currentOrg } = await supabase
          .from("organizations")
          .select("settings")
          .eq("id", targetOrgId)
          .single();

        const existingSettings = currentOrg?.settings || {};
        const updatedConfig = {
          ...(existingSettings.ai_agent_config || {}),
          testimonials: newTestimonialsList,
        };

        await supabase
          .from("organizations")
          .update({
            settings: {
              ...existingSettings,
              ai_agent_config: updatedConfig,
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", targetOrgId);
      }

      // Close modal & reset form
      setShowTestimonialModal(false);
      setEditingTestimonial(null);
      setTestimonialFile(null);
      setTestimonialPreviewUrl(null);
      setTestimonialForm({
        clientName: "",
        text: "",
        productId: "",
        date: new Date().toISOString().split("T")[0],
        source: "WhatsApp",
        status: "ACTIVE",
        mediaUrl: "",
        storagePath: "",
        consentStatus: "AUTHORIZED",
        isPublic: true,
        notes: "",
      });
    } catch (err: any) {
      console.error("Save testimonial error:", err);
      setImageUploadError(err.message || "Erreur lors de la sauvegarde");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleDeleteTestimonial = async (id: string) => {
    if (!confirm("Voulez-vous vraiment supprimer ce témoignage ?")) return;

    const target = testimonials.find((t) => t.id === id);
    if (target?.storagePath) {
      try {
        const supabase = createClient();
        await supabase.storage.from("testimonial-images").remove([target.storagePath]);
        await supabase.storage.from("product-images").remove([target.storagePath]);
      } catch (cleanErr) {
        console.warn("Error cleaning storage image on delete:", cleanErr);
      }
    }

    const updatedList = testimonials.filter((t) => t.id !== id);
    setTestimonials(updatedList);
    showToast("🗑️ Témoignage supprimé");

    if (organizationId) {
      try {
        const supabase = createClient();
        const { data: currentOrg } = await supabase
          .from("organizations")
          .select("settings")
          .eq("id", organizationId)
          .single();

        const existingSettings = currentOrg?.settings || {};
        const updatedConfig = {
          ...(existingSettings.ai_agent_config || {}),
          testimonials: updatedList,
        };

        await supabase
          .from("organizations")
          .update({
            settings: {
              ...existingSettings,
              ai_agent_config: updatedConfig,
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", organizationId);
      } catch (err) {
        console.error("Error updating DB after testimonial deletion:", err);
      }
    }
  };

  // Run Real Anthropic Agent Test
  const handleRunAgentTest = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!testInputMessage.trim()) return;

    setIsExecutingTest(true);
    setTestResult(null);
    const startTime = Date.now();

    try {
      const res = await fetch("/api/whatsapp/agent/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageText: testInputMessage.trim() }),
      });

      const data = await res.json();
      const latencyMs = Date.now() - startTime;

      if (!res.ok || data.error) {
        setTestResult({
          success: false,
          error: data.error || "Échec de l'exécution du test IA",
          latencyMs,
        });
        return;
      }

      setTestResult({
        success: true,
        responseText: data.responseText,
        triggerHandoff: data.triggerHandoff,
        confidence: data.confidence,
        latencyMs,
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        error: err.message || "Erreur réseau lors du test IA",
        latencyMs: Date.now() - startTime,
      });
    } finally {
      setIsExecutingTest(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up pb-12">
      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-[#7B61FF] text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/20 animate-slide-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-300" />
          <span className="font-medium text-sm">{toastMessage}</span>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-[#181824] pb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#7B61FF]/10 rounded-2xl border border-[#7B61FF]/20 text-[#7B61FF]">
            <Bot className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-white">
                🤖 Agent IA Commercial
              </h1>
              <span
                className={`text-xs px-3 py-1 rounded-full font-mono font-bold border ${
                  aiEnabled
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : "bg-red-500/10 text-red-400 border-red-500/30"
                }`}
              >
                {aiEnabled ? "🟢 Actif (Global)" : "🔴 Inactif (Global)"}
              </span>
            </div>
            <p className="text-sm text-gray-400 mt-1">
              Centre de configuration du comportement, des connaissances métiers et des outils temps réel de votre assistant.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowTestModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#181824] hover:bg-[#222232] text-white border border-[#282838] rounded-xl font-medium transition-all text-sm shadow-md"
          >
            <Play className="w-4 h-4 text-[#7B61FF]" />
            🧪 Tester l'Agent IA
          </button>

          <button
            onClick={() => setAiEnabled(!aiEnabled)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-md ${
              aiEnabled
                ? "bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20"
                : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20"
            }`}
          >
            <Zap className="w-4 h-4" />
            {aiEnabled ? "Désactiver l'IA" : "Activer l'IA"}
          </button>

          <button
            onClick={handleSaveConfig}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#7B61FF] hover:bg-[#684DFE] disabled:opacity-50 text-white font-semibold rounded-xl transition-all shadow-lg text-sm"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4" />
                Enregistrer la Config
              </>
            )}
          </button>
        </div>
      </div>

      {/* METRICS BAR (Real Database Metrics) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-xs">
        <div className="bg-[#12121A] border border-[#181824] p-4 rounded-xl space-y-1">
          <span className="text-gray-400 block">DISCUSSIONS ACTIVES</span>
          <span className="font-bold text-white text-base">{metrics.activeConversations}</span>
        </div>
        <div className="bg-[#12121A] border border-[#181824] p-4 rounded-xl space-y-1">
          <span className="text-gray-400 block">CLIENTS ENREGISTRÉS</span>
          <span className="font-bold text-emerald-400 text-base">{metrics.customersCount}</span>
        </div>
        <div className="bg-[#12121A] border border-[#181824] p-4 rounded-xl space-y-1">
          <span className="text-gray-400 block">ESCALADES HUMAINES</span>
          <span className="font-bold text-amber-400 text-base">{metrics.escalationsCount}</span>
        </div>
        <div className="bg-[#12121A] border border-[#181824] p-4 rounded-xl space-y-1">
          <span className="text-gray-400 block">PRODUITS CATALOGUE</span>
          <span className="font-bold text-blue-400 text-base">{metrics.productsCount} accessibles</span>
        </div>
      </div>

      {/* CONFIGURATION SECTIONS */}
      <div className="space-y-4">
        {/* SECTION 1: IDENTITÉ & COMPORTEMENT */}
        <div className="bg-[#12121A] border border-[#181824] rounded-2xl overflow-hidden">
          <button
            onClick={() => toggleSection("identity")}
            className="w-full p-5 flex items-center justify-between bg-[#14141E] border-b border-[#181824] hover:bg-[#181828] transition-all text-left"
          >
            <div className="flex items-center gap-3">
              <Bot className="w-5 h-5 text-[#7B61FF]" />
              <div>
                <h3 className="font-bold text-white text-base">1. Identité & Comportement de l'Agent</h3>
                <p className="text-xs text-gray-400">Nom, ton de voix, style de réponse et instructions personnalisées</p>
              </div>
            </div>
            {openSections.identity ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
          </button>

          {openSections.identity && (
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1.5">Nom de l'Agent IA</label>
                  <input
                    type="text"
                    value={identityConfig.name}
                    onChange={(e) => setIdentityConfig({ ...identityConfig, name: e.target.value })}
                    className="w-full bg-[#181824] border border-[#282838] rounded-xl p-3 text-white text-sm focus:border-[#7B61FF] outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1.5">Ton de Voix</label>
                  <select
                    value={identityConfig.tone}
                    onChange={(e) => setIdentityConfig({ ...identityConfig, tone: e.target.value })}
                    className="w-full bg-[#181824] border border-[#282838] rounded-xl p-3 text-white text-sm focus:border-[#7B61FF] outline-none"
                  >
                    <option value="Professionnel & Chaleureux">Professionnel & Chaleureux (Recommandé)</option>
                    <option value="Enthousiaste & Dynamique">Enthousiaste & Dynamique</option>
                    <option value="Formel & Courtois">Formel & Courtois</option>
                    <option value="Direct & Concis">Direct & Concis</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1.5">Présentation courte</label>
                <input
                  type="text"
                  value={identityConfig.presentation}
                  onChange={(e) => setIdentityConfig({ ...identityConfig, presentation: e.target.value })}
                  className="w-full bg-[#181824] border border-[#282838] rounded-xl p-3 text-white text-sm focus:border-[#7B61FF] outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1.5">Langue Principale</label>
                  <select
                    value={identityConfig.language}
                    onChange={(e) => setIdentityConfig({ ...identityConfig, language: e.target.value })}
                    className="w-full bg-[#181824] border border-[#282838] rounded-xl p-3 text-white text-sm focus:border-[#7B61FF] outline-none"
                  >
                    <option value="Français">Français</option>
                    <option value="Anglais">Anglais</option>
                    <option value="Mooré">Mooré (Burkina Faso)</option>
                    <option value="Dioula">Dioula</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1.5">Style de Réponse</label>
                  <select
                    value={identityConfig.style}
                    onChange={(e) => setIdentityConfig({ ...identityConfig, style: e.target.value })}
                    className="w-full bg-[#181824] border border-[#282838] rounded-xl p-3 text-white text-sm focus:border-[#7B61FF] outline-none"
                  >
                    <option value="Concis (1-2 phrases)">Concis (1-2 phrases pour WhatsApp)</option>
                    <option value="Détaillé & Explicatif">Détaillé & Explicatif</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1.5">
                  Instructions Personnalisées (Directives Métier)
                </label>
                <textarea
                  rows={3}
                  value={identityConfig.customInstructions}
                  onChange={(e) => setIdentityConfig({ ...identityConfig, customInstructions: e.target.value })}
                  placeholder="Ex: Toujours accueillir les clients chaleureusement..."
                  className="w-full bg-[#181824] border border-[#282838] rounded-xl p-3 text-white text-sm focus:border-[#7B61FF] outline-none font-sans"
                />
              </div>

              <div className="bg-[#181824] border border-[#282838] p-4 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-semibold text-white text-sm block">Envoi Automatique d'Images Produit (auto_send_images)</span>
                  <span className="text-xs text-gray-400 block mt-0.5">
                    Dès qu'un produit est identifié avec son prix et stock, l'agent envoie l'image réelle sans demander la permission au client.
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={identityConfig.auto_send_images}
                    onChange={(e) => setIdentityConfig({ ...identityConfig, auto_send_images: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#7B61FF]"></div>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 2: BASE DE CONNAISSANCES MÉTIER (6 CATÉGORIES INTERACTIVES & STRUCTURÉES) */}
        <div className="bg-[#12121A] border border-[#181824] rounded-2xl overflow-hidden">
          <button
            onClick={() => toggleSection("knowledge")}
            className="w-full p-5 flex items-center justify-between bg-[#14141E] border-b border-[#181824] hover:bg-[#181828] transition-all text-left"
          >
            <div className="flex items-center gap-3">
              <BrainCircuit className="w-5 h-5 text-blue-400" />
              <div>
                <h3 className="font-bold text-white text-base">2. Base de Connaissances Métier (CRUD)</h3>
                <p className="text-xs text-gray-400">
                  Entreprise, Zones de livraison, Moyens de paiement, FAQ, Politiques et Témoignages clients
                </p>
              </div>
            </div>
            {openSections.knowledge ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
          </button>

          {openSections.knowledge && (
            <div className="p-6 space-y-6">
              {/* CATEGORY TABS NAVIGATION */}
              <div className="flex items-center gap-2 border-b border-[#181824] pb-3 overflow-x-auto">
                {[
                  { id: "ENTREPRISE", label: "ENTREPRISE", icon: Building2 },
                  { id: "LIVRAISON", label: "LIVRAISON", icon: Truck },
                  { id: "PAIEMENT", label: "PAIEMENT", icon: CreditCard },
                  { id: "FAQ", label: "FAQ", icon: HelpCircle },
                  { id: "POLITIQUES", label: "POLITIQUES", icon: FileCheck },
                  { id: "TÉMOIGNAGES", label: "TÉMOIGNAGES", icon: Star },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeKnowledgeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveKnowledgeTab(tab.id as any)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-xs font-bold transition-all whitespace-nowrap ${
                        isActive
                          ? "bg-[#7B61FF] text-white shadow-lg shadow-[#7B61FF]/20"
                          : "bg-[#181824] text-gray-400 hover:text-white hover:bg-[#202030]"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* TAB 1: ENTREPRISE */}
              {activeKnowledgeTab === "ENTREPRISE" && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-[#181824] pb-3">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-[#7B61FF]" />
                        Identité Métier de l'Entreprise
                      </h4>
                      <p className="text-xs text-gray-400">
                        Synchronisé en temps réel avec les paramètres de l'organisation
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-300 block mb-1">Nom de l'entreprise</label>
                      <input
                        type="text"
                        value={companyInfo.name}
                        onChange={(e) => setCompanyInfo({ ...companyInfo, name: e.target.value })}
                        className="w-full bg-[#181824] border border-[#282838] rounded-xl p-3 text-white text-sm focus:border-[#7B61FF] outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-300 block mb-1">Secteur d'activité</label>
                      <input
                        type="text"
                        value={companyInfo.sector}
                        onChange={(e) => setCompanyInfo({ ...companyInfo, sector: e.target.value })}
                        placeholder="Ex: E-Commerce / Cosmetique / Beauté"
                        className="w-full bg-[#181824] border border-[#282838] rounded-xl p-3 text-white text-sm focus:border-[#7B61FF] outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-300 block mb-1">Pays</label>
                      <input
                        type="text"
                        value={companyInfo.country}
                        onChange={(e) => setCompanyInfo({ ...companyInfo, country: e.target.value })}
                        className="w-full bg-[#181824] border border-[#282838] rounded-xl p-3 text-white text-sm focus:border-[#7B61FF] outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-300 block mb-1">Ville siège</label>
                      <input
                        type="text"
                        value={companyInfo.city}
                        onChange={(e) => setCompanyInfo({ ...companyInfo, city: e.target.value })}
                        className="w-full bg-[#181824] border border-[#282838] rounded-xl p-3 text-white text-sm focus:border-[#7B61FF] outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-300 block mb-1">Adresse physique</label>
                      <input
                        type="text"
                        value={companyInfo.address}
                        onChange={(e) => setCompanyInfo({ ...companyInfo, address: e.target.value })}
                        placeholder="Ex: Secteur 13, Zogona"
                        className="w-full bg-[#181824] border border-[#282838] rounded-xl p-3 text-white text-sm focus:border-[#7B61FF] outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-300 block mb-1">Téléphone de contact</label>
                      <input
                        type="text"
                        value={companyInfo.phone}
                        onChange={(e) => setCompanyInfo({ ...companyInfo, phone: e.target.value })}
                        placeholder="+226 70 00 00 00"
                        className="w-full bg-[#181824] border border-[#282838] rounded-xl p-3 text-white text-sm focus:border-[#7B61FF] outline-none font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-300 block mb-1">Email professionnel</label>
                      <input
                        type="email"
                        value={companyInfo.email}
                        onChange={(e) => setCompanyInfo({ ...companyInfo, email: e.target.value })}
                        placeholder="contact@entreprise.com"
                        className="w-full bg-[#181824] border border-[#282838] rounded-xl p-3 text-white text-sm focus:border-[#7B61FF] outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-300 block mb-1">Horaires d'ouverture</label>
                      <input
                        type="text"
                        value={companyInfo.hours}
                        onChange={(e) => setCompanyInfo({ ...companyInfo, hours: e.target.value })}
                        placeholder="Lun - Sam : 08h00 - 20h00"
                        className="w-full bg-[#181824] border border-[#282838] rounded-xl p-3 text-white text-sm focus:border-[#7B61FF] outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-300 block mb-1">Description de l'entreprise</label>
                    <textarea
                      rows={3}
                      value={companyInfo.description}
                      onChange={(e) => setCompanyInfo({ ...companyInfo, description: e.target.value })}
                      placeholder="Résumez l'activité et l'engagement de votre entreprise..."
                      className="w-full bg-[#181824] border border-[#282838] rounded-xl p-3 text-white text-sm focus:border-[#7B61FF] outline-none"
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: LIVRAISON */}
              {activeKnowledgeTab === "LIVRAISON" && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#181824] pb-3">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <Truck className="w-4 h-4 text-emerald-400" />
                        Configuration Structurée des Zones de Livraison
                      </h4>
                      <p className="text-xs text-gray-400">
                        Source de vérité métier utilisée directement par le tool <code className="text-emerald-400 font-mono">check_delivery_zone</code>
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setEditingZone(null);
                        setZoneForm({ name: "", districtsRaw: "", fee: 1000, delay: "24h", status: "ACTIVE", notes: "" });
                        setShowZoneModal(true);
                      }}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-md"
                    >
                      <Plus className="w-4 h-4" />
                      Nouvelle Zone
                    </button>
                  </div>

                  {deliveryZones.length === 0 ? (
                    <div className="p-8 text-center bg-[#181824] border border-dashed border-[#282838] rounded-2xl space-y-3">
                      <Truck className="w-10 h-10 text-gray-500 mx-auto" />
                      <h5 className="text-white font-bold text-sm">Aucune zone de livraison configurée</h5>
                      <button
                        onClick={() => {
                          setEditingZone(null);
                          setZoneForm({ name: "", districtsRaw: "", fee: 1000, delay: "24h", status: "ACTIVE", notes: "" });
                          setShowZoneModal(true);
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#7B61FF] hover:bg-[#684DFE] text-white text-xs font-semibold rounded-xl transition-all"
                      >
                        <Plus className="w-4 h-4" />
                        Ajouter une zone
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-[#282838] rounded-2xl">
                      <table className="w-full text-left text-xs font-sans min-w-[800px]">
                        <thead className="bg-[#14141E] text-gray-400 uppercase font-mono text-[11px] border-b border-[#282838]">
                          <tr>
                            <th className="p-3.5">Zone</th>
                            <th className="p-3.5">Quartiers Inclus</th>
                            <th className="p-3.5">Frais (XOF)</th>
                            <th className="p-3.5">Délai</th>
                            <th className="p-3.5">Statut</th>
                            <th className="p-3.5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#282838] bg-[#181824]">
                          {deliveryZones.map((zone) => (
                            <tr key={zone.id} className="hover:bg-[#202030] transition-all">
                              <td className="p-3.5 font-bold text-white whitespace-nowrap">{zone.name}</td>
                              <td className="p-3.5 max-w-xs">
                                <div className="flex flex-wrap gap-1">
                                  {zone.districts.map((d, i) => (
                                    <span key={i} className="px-2 py-0.5 bg-[#252535] text-gray-300 rounded-md font-mono text-[11px]">
                                      {d}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="p-3.5 font-mono font-bold text-emerald-400 whitespace-nowrap">
                                {zone.fee === 0 ? "0 XOF (Gratuit)" : `${zone.fee.toLocaleString("fr-FR")} XOF`}
                              </td>
                              <td className="p-3.5 font-mono text-gray-300 whitespace-nowrap">{zone.delay}</td>
                              <td className="p-3.5 whitespace-nowrap">
                                <button
                                  onClick={() => handleToggleZoneStatus(zone.id)}
                                  className={`px-2.5 py-1 rounded-full font-mono text-[10px] font-bold border transition-all ${
                                    zone.status === "ACTIVE"
                                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                      : "bg-gray-500/10 text-gray-400 border-gray-500/30"
                                  }`}
                                >
                                  {zone.status === "ACTIVE" ? "🟢 Actif" : "⚪ Archivé"}
                                </button>
                              </td>
                              <td className="p-3.5 text-right whitespace-nowrap space-x-2">
                                <button
                                  onClick={() => {
                                    setEditingZone(zone);
                                    setZoneForm({
                                      name: zone.name,
                                      districtsRaw: zone.districts.join(", "),
                                      fee: zone.fee,
                                      delay: zone.delay,
                                      status: zone.status,
                                      notes: zone.notes || "",
                                    });
                                    setShowZoneModal(true);
                                  }}
                                  className="p-1.5 bg-[#252535] hover:bg-[#303045] text-gray-300 rounded-lg transition-all"
                                  title="Modifier"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteZone(zone.id)}
                                  className="p-1.5 bg-[#252535] hover:bg-red-500/20 text-red-400 rounded-lg transition-all"
                                  title="Supprimer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: PAIEMENT */}
              {activeKnowledgeTab === "PAIEMENT" && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#181824] pb-3">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-purple-400" />
                        Moyens de Paiement Acceptés
                      </h4>
                      <p className="text-xs text-gray-400">
                        Transmis au client par l'Agent IA lorsqu'il demande comment régler
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setEditingPayment(null);
                        setPaymentForm({ name: "", identifier: "", instructions: "", status: "ACTIVE", notes: "" });
                        setShowPaymentModal(true);
                      }}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-[#7B61FF] hover:bg-[#684DFE] text-white text-xs font-bold rounded-xl transition-all shadow-md"
                    >
                      <Plus className="w-4 h-4" />
                      Ajouter un moyen de paiement
                    </button>
                  </div>

                  {paymentMethods.length === 0 ? (
                    <div className="bg-[#181824] border border-[#282838] p-8 rounded-2xl text-center space-y-3">
                      <div className="p-3 bg-purple-500/10 text-purple-400 rounded-full w-12 h-12 mx-auto flex items-center justify-center">
                        <CreditCard className="w-6 h-6" />
                      </div>
                      <h5 className="text-white font-bold text-sm">Aucun moyen de paiement configuré</h5>
                      <p className="text-xs text-gray-400 max-w-md mx-auto">
                        Ajoutez les moyens de paiement acceptés par votre entreprise (ex: Mobile Money, Virement bancaire, Paiement à la livraison) pour permettre à l'Agent IA de guider vos clients.
                      </p>
                      <button
                        onClick={() => {
                          setEditingPayment(null);
                          setPaymentForm({ name: "", identifier: "", instructions: "", status: "ACTIVE", notes: "" });
                          setShowPaymentModal(true);
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#7B61FF] hover:bg-[#684DFE] text-white text-xs font-semibold rounded-xl transition-all shadow-md mt-2"
                      >
                        <Plus className="w-4 h-4" />
                        Ajouter un moyen de paiement
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {paymentMethods.map((pm) => (
                        <div key={pm.id} className="bg-[#181824] border border-[#282838] p-4 rounded-2xl space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white text-sm flex items-center gap-2">
                              <CreditCard className="w-4 h-4 text-purple-400" />
                              {pm.name}
                            </span>
                            <button
                              onClick={() => handleTogglePaymentStatus(pm.id)}
                              className={`text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold border transition-all ${
                                pm.status === "ACTIVE"
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                                  : "bg-gray-500/10 text-gray-400 border-gray-500/30 hover:bg-gray-500/20"
                              }`}
                            >
                              {pm.status === "ACTIVE" ? "🟢 Actif" : "⚪ Archivé"}
                            </button>
                          </div>
                          <div className="bg-[#12121A] p-3 rounded-xl border border-white/5 font-mono text-xs">
                            <span className="text-gray-400 text-[11px] block">Identifiant / Compte :</span>
                            <strong className="text-white text-sm">{pm.identifier}</strong>
                          </div>
                          {pm.instructions && (
                            <p className="text-xs text-gray-300 bg-[#14141E] p-2.5 rounded-xl border border-white/5 whitespace-pre-wrap">
                              {pm.instructions}
                            </p>
                          )}
                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              onClick={() => {
                                setEditingPayment(pm);
                                setPaymentForm({
                                  name: pm.name,
                                  identifier: pm.identifier,
                                  instructions: pm.instructions,
                                  status: pm.status,
                                  notes: pm.notes || "",
                                });
                                setShowPaymentModal(true);
                              }}
                              className="p-1.5 bg-[#252535] hover:bg-[#303045] text-gray-300 rounded-lg transition-all"
                              title="Modifier"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeletePayment(pm.id)}
                              className="p-1.5 bg-[#252535] hover:bg-red-500/20 text-red-400 rounded-lg transition-all"
                              title="Supprimer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: FAQ */}
              {activeKnowledgeTab === "FAQ" && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#181824] pb-3">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <HelpCircle className="w-4 h-4 text-cyan-400" />
                        Foire Aux Questions (FAQ)
                      </h4>
                    </div>
                    <button
                      onClick={() => {
                        setEditingFaq(null);
                        setFaqForm({ question: "", answer: "", category: "Général", status: "ACTIVE" });
                        setShowFaqModal(true);
                      }}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-[#7B61FF] hover:bg-[#684DFE] text-white text-xs font-bold rounded-xl"
                    >
                      <Plus className="w-4 h-4" />
                      Ajouter une FAQ
                    </button>
                  </div>

                  {faqs.length === 0 ? (
                    <div className="bg-[#181824] border border-[#282838] p-8 rounded-2xl text-center space-y-3">
                      <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-full w-12 h-12 mx-auto flex items-center justify-center">
                        <HelpCircle className="w-6 h-6" />
                      </div>
                      <h5 className="text-white font-bold text-sm">Aucune FAQ configurée</h5>
                      <p className="text-xs text-gray-400 max-w-md mx-auto">
                        Ajoutez les questions fréquentes de vos clients (ex: authenticité, garantie, retour, délai de livraison) pour permettre à l'Agent IA d'y répondre avec vos propres réponses officielles.
                      </p>
                      <button
                        onClick={() => {
                          setEditingFaq(null);
                          setFaqForm({ question: "", answer: "", category: "Général", status: "ACTIVE" });
                          setShowFaqModal(true);
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#7B61FF] hover:bg-[#684DFE] text-white text-xs font-semibold rounded-xl transition-all shadow-md mt-2"
                      >
                        <Plus className="w-4 h-4" />
                        Ajouter une FAQ
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {faqs.map((faq) => (
                        <div key={faq.id} className="bg-[#181824] border border-[#282838] p-4 rounded-2xl space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white text-sm">❓ {faq.question}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-[#7B61FF]/20 text-[#7B61FF]">
                                {faq.category}
                              </span>
                              <button
                                onClick={() => handleToggleFaqStatus(faq.id)}
                                className={`text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold border transition-all ${
                                  faq.status === "ACTIVE"
                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                                    : "bg-gray-500/10 text-gray-400 border-gray-500/30 hover:bg-gray-500/20"
                                }`}
                              >
                                {faq.status === "ACTIVE" ? "🟢 Actif" : "⚪ Archivé"}
                              </button>
                            </div>
                          </div>
                          <p className="text-xs text-gray-300 bg-[#12121A] p-3 rounded-xl border border-white/5 whitespace-pre-wrap">
                            💬 {faq.answer}
                          </p>
                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              onClick={() => {
                                setEditingFaq(faq);
                                setFaqForm({ question: faq.question, answer: faq.answer, category: faq.category, status: faq.status });
                                setShowFaqModal(true);
                              }}
                              className="p-1.5 bg-[#252535] hover:bg-[#303045] text-gray-300 rounded-lg transition-all"
                              title="Modifier"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteFaq(faq.id)}
                              className="p-1.5 bg-[#252535] hover:bg-red-500/20 text-red-400 rounded-lg transition-all"
                              title="Supprimer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: POLITIQUES */}
              {activeKnowledgeTab === "POLITIQUES" && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#181824] pb-3">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <FileCheck className="w-4 h-4 text-amber-400" />
                        Politiques Commerciales & Conditions
                      </h4>
                    </div>
                    <button
                      onClick={() => {
                        setEditingPolicy(null);
                        setPolicyForm({ title: "", content: "", status: "ACTIVE" });
                        setShowPolicyModal(true);
                      }}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-[#7B61FF] hover:bg-[#684DFE] text-white text-xs font-bold rounded-xl"
                    >
                      <Plus className="w-4 h-4" />
                      Ajouter une politique
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {policies.map((pol) => (
                      <div key={pol.id} className="bg-[#181824] border border-[#282838] p-4 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white text-sm">📋 {pol.title}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-emerald-500/10 text-emerald-400">
                            Actif
                          </span>
                        </div>
                        <p className="text-xs text-gray-300 bg-[#12121A] p-3 rounded-xl border border-white/5 whitespace-pre-wrap">
                          {pol.content}
                        </p>
                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            onClick={() => {
                              setEditingPolicy(pol);
                              setPolicyForm({ title: pol.title, content: pol.content, status: pol.status });
                              setShowPolicyModal(true);
                            }}
                            className="p-1.5 bg-[#252535] text-gray-300 rounded-lg"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDeletePolicy(pol.id)} className="p-1.5 bg-[#252535] text-red-400 rounded-lg">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 6: TÉMOIGNAGES CLIENTS RÉELS */}
              {activeKnowledgeTab === "TÉMOIGNAGES" && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#181824] pb-3">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                        📣 Témoignages & Preuves Sociales Réelles
                      </h4>
                      <p className="text-xs text-gray-400">
                        Avis clients authentiques transmis aux prospects pour lever les doutes (via <code className="text-amber-400 font-mono">search_testimonials</code> et <code className="text-amber-400 font-mono">send_testimonial</code>)
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setEditingTestimonial(null);
                        setTestimonialFile(null);
                        setTestimonialPreviewUrl(null);
                        setImageUploadError(null);
                        setTestimonialForm({
                          clientName: "",
                          text: "",
                          productId: "",
                          date: new Date().toISOString().split("T")[0],
                          source: "WhatsApp",
                          status: "ACTIVE",
                          mediaUrl: "",
                          storagePath: "",
                          consentStatus: "AUTHORIZED",
                          isPublic: true,
                          notes: "",
                        });
                        setShowTestimonialModal(true);
                      }}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-xl transition-all shadow-md"
                    >
                      <Plus className="w-4 h-4" />
                      Nouveau Témoignage
                    </button>
                  </div>

                  {testimonials.length === 0 ? (
                    <div className="p-8 text-center bg-[#181824] border border-dashed border-[#282838] rounded-2xl space-y-3">
                      <Star className="w-10 h-10 text-gray-500 mx-auto" />
                      <h5 className="text-white font-bold text-sm">Aucun témoignage client enregistré</h5>
                      <p className="text-xs text-gray-400 max-w-md mx-auto">
                        Ajoutez des retours réels de vos clientes (WhatsApp, photos de résultats) pour que l'Agent IA puisse rassurer les prospects indécis.
                      </p>
                      <button
                        onClick={() => {
                          setEditingTestimonial(null);
                          setTestimonialFile(null);
                          setTestimonialPreviewUrl(null);
                          setImageUploadError(null);
                          setTestimonialForm({
                            clientName: "",
                            text: "",
                            productId: "",
                            date: new Date().toISOString().split("T")[0],
                            source: "WhatsApp",
                            status: "ACTIVE",
                            mediaUrl: "",
                            storagePath: "",
                            consentStatus: "AUTHORIZED",
                            isPublic: true,
                            notes: "",
                          });
                          setShowTestimonialModal(true);
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-xl transition-all"
                      >
                        <Plus className="w-4 h-4" />
                        Ajouter un témoignage
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {testimonials.map((t) => {
                        const matchedProd = catalogProducts.find((p) => p.id === t.productId);
                        return (
                          <div key={t.id} className="bg-[#181824] border border-[#282838] p-4 rounded-2xl space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                                <span className="font-bold text-white text-sm">{t.clientName}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                {t.consentStatus === "AUTHORIZED" && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                    ✓ Autorisé
                                  </span>
                                )}
                                <span
                                  className={`text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold border ${
                                    t.status === "ACTIVE"
                                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                      : "bg-gray-500/10 text-gray-400 border-gray-500/30"
                                  }`}
                                >
                                  {t.status === "ACTIVE" ? "🟢 Actif" : "⚪ Archivé"}
                                </span>
                              </div>
                            </div>

                            <p className="text-xs text-gray-200 bg-[#12121A] p-3 rounded-xl border border-white/5 italic">
                              "{t.text}"
                            </p>

                            {t.mediaUrl && (
                              <div className="rounded-xl overflow-hidden border border-slate-800 max-h-40 bg-black/40 flex items-center justify-center">
                                <img src={t.mediaUrl} alt="Capture témoignage" className="w-full max-h-40 object-contain rounded-xl" />
                              </div>
                            )}

                            <div className="flex items-center justify-between pt-1 font-mono text-[10px] text-gray-400">
                              <span>
                                {matchedProd ? `Produit: ${matchedProd.name}` : "Témoignage Général"} • Source: {t.source}
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    setEditingTestimonial(t);
                                    setTestimonialFile(null);
                                    setTestimonialPreviewUrl(null);
                                    setImageUploadError(null);
                                    setTestimonialForm({
                                      clientName: t.clientName,
                                      text: t.text,
                                      productId: t.productId || "",
                                      date: t.date || new Date().toISOString().split("T")[0],
                                      source: t.source || "WhatsApp",
                                      status: t.status,
                                      mediaUrl: t.mediaUrl || "",
                                      storagePath: t.storagePath || "",
                                      consentStatus: t.consentStatus || "AUTHORIZED",
                                      isPublic: t.isPublic !== undefined ? t.isPublic : true,
                                      notes: t.notes || "",
                                    });
                                    setShowTestimonialModal(true);
                                  }}
                                  className="p-1.5 bg-[#252535] hover:bg-[#303045] text-gray-300 rounded-lg"
                                  title="Modifier"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteTestimonial(t.id)}
                                  className="p-1.5 bg-[#252535] hover:bg-red-500/20 text-red-400 rounded-lg"
                                  title="Supprimer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* SECTION 3: CATALOGUE (DONNÉES TEMPS RÉEL) */}
        <div className="bg-[#12121A] border border-[#181824] rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">📦 Catalogue Produits & Stock SSOT</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                <span className="font-bold text-emerald-400">{metrics.productsCount} produits</span> accessibles automatiquement par l'Agent avec gestion des photos et statut actif/archivé.
              </p>
            </div>
          </div>

          <Link
            href="/operations/products"
            className="px-4 py-2 bg-[#181824] hover:bg-[#222232] text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-semibold transition-all flex items-center gap-2"
          >
            Gérer le Catalogue Produits
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* SECTION 4: CAPACITÉS & OUTILS (TOOLS RÉELS) */}
        <div className="bg-[#12121A] border border-[#181824] rounded-2xl overflow-hidden">
          <button
            onClick={() => toggleSection("tools")}
            className="w-full p-5 flex items-center justify-between bg-[#14141E] border-b border-[#181824] hover:bg-[#181828] transition-all text-left"
          >
            <div className="flex items-center gap-3">
              <Sliders className="w-5 h-5 text-amber-400" />
              <div>
                <h3 className="font-bold text-white text-base">3. Capacités & Outils Temps Réel (Tools)</h3>
                <p className="text-xs text-gray-400">Activez ou désactivez les outils autorisés pour l'Agent IA</p>
              </div>
            </div>
            {openSections.tools ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
          </button>

          {openSections.tools && (
            <div className="p-6 space-y-5">
              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-3 font-mono">
                  CONSULTER (Lecture Temps Réel)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  {[
                    { key: "search_products", label: "Rechercher des produits", desc: "Consultation catalogue SSOT" },
                    { key: "check_price", label: "Vérifier prix & promotions", desc: "Consultation tarifs" },
                    { key: "check_stock", label: "Vérifier le stock disponible", desc: "Vérification inventaire" },
                    { key: "check_zones", label: "Vérifier zones de livraison", desc: "Frais & zones structurées" },
                    { key: "search_testimonials", label: "Consulter témoignages réels", desc: "Base d'avis clients" },
                    { key: "lookup_customer", label: "Consulter profil client CRM", desc: "Historique & préférences" },
                    { key: "lookup_orders", label: "Consulter les commandes", desc: "Statut des commandes" },
                  ].map((t) => (
                    <label key={t.key} className="bg-[#181824] border border-[#282838] p-3 rounded-xl flex items-start gap-3 cursor-pointer hover:border-[#7B61FF]/40 transition-all">
                      <input
                        type="checkbox"
                        checked={toolsConfig[t.key] ?? true}
                        onChange={(e) => setToolsConfig({ ...toolsConfig, [t.key]: e.target.checked })}
                        className="mt-0.5 accent-[#7B61FF]"
                      />
                      <div>
                        <span className="font-semibold text-white block">{t.label}</span>
                        <span className="text-[10px] text-gray-400 font-mono">{t.desc}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-3 font-mono">
                  AGIR & EXPÉDIER SUR WHATSAPP (Actions Réelles)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  {[
                    { key: "send_product_image", label: "Envoyer photo produit WhatsApp", desc: "Envoi média via Evolution API" },
                    { key: "send_testimonial", label: "Envoyer témoignage WhatsApp", desc: "Preuve sociale média/texte" },
                    { key: "create_order", label: "Créer une commande client", desc: "Réservation stock atomique" },
                    { key: "update_crm", label: "Mettre à jour le profil CRM", desc: "Mise à jour coordonnées" },
                    { key: "escalate_human", label: "Escalader vers un humain", desc: "Transfert conseiller commercial" },
                  ].map((t) => (
                    <label key={t.key} className="bg-[#181824] border border-[#282838] p-3 rounded-xl flex items-start gap-3 cursor-pointer hover:border-[#7B61FF]/40 transition-all">
                      <input
                        type="checkbox"
                        checked={toolsConfig[t.key] ?? true}
                        onChange={(e) => setToolsConfig({ ...toolsConfig, [t.key]: e.target.checked })}
                        className="mt-0.5 accent-[#7B61FF]"
                      />
                      <div>
                        <span className="font-semibold text-white block">{t.label}</span>
                        <span className="text-[10px] text-gray-400 font-mono">{t.desc}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 5: GARDE-FOUS & SÉCURITÉ */}
        <div className="bg-[#12121A] border border-[#181824] rounded-2xl overflow-hidden">
          <button
            onClick={() => toggleSection("guardrails")}
            className="w-full p-5 flex items-center justify-between bg-[#14141E] border-b border-[#181824] hover:bg-[#181828] transition-all text-left"
          >
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 className="font-bold text-white text-base">4. Garde-fous & Sécurité (🔒 Toujours Actif)</h3>
                <p className="text-xs text-gray-400">Règles fondamentales non désactivables assurant l'intégrité de l'Agent</p>
              </div>
            </div>
            {openSections.guardrails ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
          </button>

          {openSections.guardrails && (
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {[
                "Ne jamais inventer de tarif de livraison (utiliser strictement les zones configurées)",
                "Ne jamais inventer de témoignage ni de résultat client fictif",
                "Ne jamais envoyer d'image produit ou témoignage non présent en base",
                "Escalader immédiatement vers un humain si l'audio vocal est inaudible",
                "Ne jamais inventer de prix non présent dans le catalogue SSOT",
                "Ne jamais inventer de stock disponible",
                "Ne jamais inventer de mode de paiement non configuré",
                "Respecter les limites strictes de l'organisation multi-tenant",
              ].map((rule, idx) => (
                <div key={idx} className="bg-[#181824] border border-emerald-500/20 p-3.5 rounded-xl flex items-center gap-3">
                  <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-gray-200 font-medium">{rule}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SECTION 6: INTERVENTION HUMAINE */}
        <div className="bg-[#12121A] border border-[#181824] rounded-2xl overflow-hidden">
          <button
            onClick={() => toggleSection("human")}
            className="w-full p-5 flex items-center justify-between bg-[#14141E] border-b border-[#181824] hover:bg-[#181828] transition-all text-left"
          >
            <div className="flex items-center gap-3">
              <UserCheck className="w-5 h-5 text-purple-400" />
              <div>
                <h3 className="font-bold text-white text-base">5. Intervention Humaine & Détection Smartphone</h3>
                <p className="text-xs text-gray-400">Prise en main automatique dès qu'un commercial répond depuis WhatsApp</p>
              </div>
            </div>
            {openSections.human ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
          </button>

          {openSections.human && (
            <div className="p-6 space-y-4 text-xs text-gray-300">
              <div className="flex items-center justify-between bg-[#181824] p-4 rounded-xl border border-purple-500/20">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                  <div>
                    <span className="font-bold text-white text-sm block">Détection Réponse Smartphone (fromMe = true)</span>
                    <span className="text-gray-400 text-xs">Passe automatiquement la discussion en mode HUMAN_ACTIVE</span>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30">
                  🟢 ACTIVÉE
                </span>
              </div>

              <div className="bg-[#181824] p-4 rounded-xl border border-[#282838] space-y-2">
                <label className="text-xs font-bold text-white block">
                  Mots-clés de Transfert Humain Configurables (handoff_keywords)
                </label>
                <p className="text-xs text-gray-400">
                  Saisissez les mots-clés (séparés par des virgules) qui déclenchent le transfert immédiat vers un conseiller humain quand le client les mentionne.
                </p>
                <input
                  type="text"
                  value={identityConfig.handoff_keywords}
                  onChange={(e) => setIdentityConfig({ ...identityConfig, handoff_keywords: e.target.value })}
                  placeholder="humain, agent, conseiller, remboursement, responsable, problème"
                  className="w-full bg-[#12121A] border border-[#282838] rounded-xl p-3 text-white text-sm font-mono focus:border-purple-400 outline-none"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: DELIVERY ZONE ADD / EDIT */}
      {showZoneModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#12121A] border border-[#181824] w-full max-w-lg p-6 rounded-2xl space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Truck className="w-5 h-5 text-emerald-400" />
              {editingZone ? "Modifier la Zone de Livraison" : "Nouvelle Zone de Livraison"}
            </h3>

            <form onSubmit={handleSaveZone} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">Nom de la Zone</label>
                <input
                  type="text"
                  placeholder="Ex: Ouaga Centre, Kossodo, Bobo-Dioulasso"
                  value={zoneForm.name}
                  onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })}
                  className="w-full bg-[#181824] border border-[#282838] rounded-xl p-3 text-white text-sm focus:border-[#7B61FF] outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">Quartiers Inclus</label>
                <textarea
                  rows={3}
                  placeholder="Ex: Koulouba, Paspanga, Gounghin, Zogona..."
                  value={zoneForm.districtsRaw}
                  onChange={(e) => setZoneForm({ ...zoneForm, districtsRaw: e.target.value })}
                  className="w-full bg-[#181824] border border-[#282838] rounded-xl p-3 text-white text-sm focus:border-[#7B61FF] outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">Frais de livraison (XOF)</label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={zoneForm.fee}
                    onChange={(e) => setZoneForm({ ...zoneForm, fee: Number(e.target.value) })}
                    className="w-full bg-[#181824] border border-[#282838] rounded-xl p-3 text-white text-sm font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">Délai indicatif</label>
                  <input
                    type="text"
                    value={zoneForm.delay}
                    onChange={(e) => setZoneForm({ ...zoneForm, delay: e.target.value })}
                    className="w-full bg-[#181824] border border-[#282838] rounded-xl p-3 text-white text-sm font-mono"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowZoneModal(false)}
                  className="px-4 py-2 bg-gray-800 text-gray-300 rounded-xl text-xs font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 1B: PAYMENT METHOD ADD / EDIT */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#12121A] border border-[#181824] w-full max-w-lg p-6 rounded-2xl space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-purple-400" />
              {editingPayment ? "Modifier le Moyen de Paiement" : "Nouveau Moyen de Paiement"}
            </h3>

            <form onSubmit={handleSavePayment} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">
                  Nom du Moyen de Paiement *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Orange Money, Moov Money, Wave, Virement Bancaire, Cash"
                  value={paymentForm.name}
                  onChange={(e) => setPaymentForm({ ...paymentForm, name: e.target.value })}
                  className="w-full bg-[#181824] border border-[#282838] rounded-xl p-3 text-white text-sm focus:border-[#7B61FF] outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">
                  Identifiant / Numéro / Compte *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Numéro de dépôt, RIB bancaire, ou En espèces"
                  value={paymentForm.identifier}
                  onChange={(e) => setPaymentForm({ ...paymentForm, identifier: e.target.value })}
                  className="w-full bg-[#181824] border border-[#282838] rounded-xl p-3 text-white text-sm font-mono focus:border-[#7B61FF] outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">
                  Instructions pour le client
                </label>
                <textarea
                  rows={3}
                  placeholder="Ex: Effectuer le dépôt au numéro indiqué puis envoyer la preuve de paiement."
                  value={paymentForm.instructions}
                  onChange={(e) => setPaymentForm({ ...paymentForm, instructions: e.target.value })}
                  className="w-full bg-[#181824] border border-[#282838] rounded-xl p-3 text-white text-sm focus:border-[#7B61FF] outline-none font-sans"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">Statut</label>
                <select
                  value={paymentForm.status}
                  onChange={(e) => setPaymentForm({ ...paymentForm, status: e.target.value as any })}
                  className="w-full bg-[#181824] border border-[#282838] rounded-xl p-3 text-white text-sm focus:border-[#7B61FF] outline-none"
                >
                  <option value="ACTIVE">Actif (Proposé au client)</option>
                  <option value="ARCHIVED">Inactif / Archivé (Masqué de l'Agent)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 bg-gray-800 text-gray-300 rounded-xl text-xs font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#7B61FF] hover:bg-[#684DFE] text-white rounded-xl text-xs font-bold"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 1C: FAQ ADD / EDIT */}
      {showFaqModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#12121A] border border-[#181824] w-full max-w-lg p-6 rounded-2xl space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-cyan-400" />
              {editingFaq ? "Modifier la FAQ" : "Nouvelle Question Fréquente (FAQ)"}
            </h3>

            <form onSubmit={handleSaveFaq} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">
                  Question posée par les clients *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Vos produits sont-ils authentiques ? Quels sont les délais de livraison ?"
                  value={faqForm.question}
                  onChange={(e) => setFaqForm({ ...faqForm, question: e.target.value })}
                  className="w-full bg-[#181824] border border-[#282838] rounded-xl p-3 text-white text-sm focus:border-[#7B61FF] outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">
                  Réponse officielle de l'entreprise *
                </label>
                <textarea
                  rows={4}
                  placeholder="Ex: Oui, tous nos produits sont 100% officiels avec garantie de satisfaction..."
                  value={faqForm.answer}
                  onChange={(e) => setFaqForm({ ...faqForm, answer: e.target.value })}
                  className="w-full bg-[#181824] border border-[#282838] rounded-xl p-3 text-white text-sm focus:border-[#7B61FF] outline-none font-sans"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">Catégorie</label>
                  <select
                    value={faqForm.category}
                    onChange={(e) => setFaqForm({ ...faqForm, category: e.target.value })}
                    className="w-full bg-[#181824] border border-[#282838] rounded-xl p-3 text-white text-sm focus:border-[#7B61FF] outline-none"
                  >
                    <option value="Général">Général</option>
                    <option value="Produit & Authenticité">Produit & Authenticité</option>
                    <option value="Livraison">Livraison</option>
                    <option value="Paiement & Facturation">Paiement & Facturation</option>
                    <option value="Garantie & Retour">Garantie & Retour</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">Statut</label>
                  <select
                    value={faqForm.status}
                    onChange={(e) => setFaqForm({ ...faqForm, status: e.target.value as any })}
                    className="w-full bg-[#181824] border border-[#282838] rounded-xl p-3 text-white text-sm focus:border-[#7B61FF] outline-none"
                  >
                    <option value="ACTIVE">Actif (Utilisé par l'Agent IA)</option>
                    <option value="ARCHIVED">Inactif / Archivé (Masqué de l'Agent)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFaqModal(false)}
                  className="px-4 py-2 bg-gray-800 text-gray-300 rounded-xl text-xs font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#7B61FF] hover:bg-[#684DFE] text-white rounded-xl text-xs font-bold"
                >
                  Enregistrer la FAQ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: TESTIMONIAL ADD / EDIT */}
      {showTestimonialModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#12121A] border border-[#181824] w-full max-w-lg p-6 rounded-2xl space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
              {editingTestimonial ? "Modifier le Témoignage" : "Nouveau Témoignage Client Réel"}
            </h3>

            <form onSubmit={handleSaveTestimonial} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">Nom / Prénom du Client *</label>
                <input
                  type="text"
                  placeholder="Ex: Aminata K., Traoré O."
                  value={testimonialForm.clientName}
                  onChange={(e) => setTestimonialForm({ ...testimonialForm, clientName: e.target.value })}
                  className="w-full bg-[#181824] border border-[#282838] rounded-xl p-3 text-white text-sm focus:border-[#7B61FF] outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">Produit Concerné</label>
                <select
                  value={testimonialForm.productId}
                  onChange={(e) => setTestimonialForm({ ...testimonialForm, productId: e.target.value })}
                  className="w-full bg-[#181824] border border-[#282838] rounded-xl p-3 text-white text-sm focus:border-[#7B61FF] outline-none"
                >
                  <option value="">Témoignage Général / Tous produits</option>
                  {catalogProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.selling_price} XOF)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">Texte du Témoignage Client *</label>
                <textarea
                  rows={4}
                  placeholder="Ex: J'ai commencé le kit il y a 2 semaines, j'ai déjà perdu 3kg et je me sens beaucoup plus légère ! Merci WILLShop !"
                  value={testimonialForm.text}
                  onChange={(e) => setTestimonialForm({ ...testimonialForm, text: e.target.value })}
                  className="w-full bg-[#181824] border border-[#282838] rounded-xl p-3 text-white text-sm focus:border-[#7B61FF] outline-none font-sans"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">Source du retour</label>
                  <select
                    value={testimonialForm.source}
                    onChange={(e) => setTestimonialForm({ ...testimonialForm, source: e.target.value })}
                    className="w-full bg-[#181824] border border-[#282838] rounded-xl p-3 text-white text-sm focus:border-[#7B61FF] outline-none"
                  >
                    <option value="WhatsApp">Message WhatsApp</option>
                    <option value="Boutique">Client en Boutique</option>
                    <option value="Facebook">Facebook / Instagram</option>
                    <option value="Appel">Appel Téléphonique</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">Date</label>
                  <input
                    type="date"
                    value={testimonialForm.date}
                    onChange={(e) => setTestimonialForm({ ...testimonialForm, date: e.target.value })}
                    className="w-full bg-[#181824] border border-[#282838] rounded-xl p-3 text-white text-sm focus:border-[#7B61FF] outline-none font-mono"
                  />
                </div>
              </div>

              {/* IMAGE UPLOAD DROPZONE & PREVIEW */}
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">
                  📸 Image du témoignage / Capture d'écran (optionnel)
                </label>

                {imageUploadError && (
                  <div className="mb-2 p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{imageUploadError}</span>
                  </div>
                )}

                {testimonialPreviewUrl || testimonialForm.mediaUrl ? (
                  <div className="bg-[#181824] border border-[#282838] p-3 rounded-2xl space-y-3">
                    <div className="relative rounded-xl overflow-hidden border border-[#282838] max-h-48 bg-black/40 flex items-center justify-center">
                      <img
                        src={testimonialPreviewUrl || testimonialForm.mediaUrl}
                        alt="Aperçu témoignage"
                        className="max-h-48 w-full object-contain rounded-xl"
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-300">
                      <div className="truncate max-w-[200px] font-mono">
                        {testimonialFile ? (
                          <span>{testimonialFile.name} ({(testimonialFile.size / (1024 * 1024)).toFixed(2)} MB)</span>
                        ) : (
                          <span>Image sauvegardée</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="cursor-pointer px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-amber-400 rounded-lg text-xs font-semibold flex items-center gap-1">
                          <Camera className="w-3.5 h-3.5" />
                          Remplacer
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                handleTestimonialFileSelect(e.target.files[0]);
                              }
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={handleRemoveTestimonialImage}
                          className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-xs font-semibold flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Supprimer
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragOver(true);
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragOver(false);
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        handleTestimonialFileSelect(e.dataTransfer.files[0]);
                      }
                    }}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${
                      isDragOver
                        ? "border-amber-400 bg-amber-500/10"
                        : "border-[#282838] bg-[#181824] hover:border-amber-400/50 hover:bg-[#1f1f2e]"
                    }`}
                  >
                    <label className="cursor-pointer block space-y-2">
                      <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto">
                        <Camera className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">📷 Ajouter une image</p>
                        <p className="text-xs text-gray-400 mt-1">Cliquez ou glissez-déposez une capture ou photo</p>
                        <p className="text-[10px] text-gray-500 mt-1 font-mono">JPG, JPEG, PNG, WEBP — Max 5 MB</p>
                      </div>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleTestimonialFileSelect(e.target.files[0]);
                          }
                        }}
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* CONSENT & AI VISIBILITY */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">Autorisation Client (Consentement)</label>
                  <select
                    value={testimonialForm.consentStatus}
                    onChange={(e) => setTestimonialForm({ ...testimonialForm, consentStatus: e.target.value as any })}
                    className="w-full bg-[#181824] border border-[#282838] rounded-xl p-3 text-white text-sm focus:border-[#7B61FF] outline-none"
                  >
                    <option value="AUTHORIZED">🟢 Autorisé par le client</option>
                    <option value="UNKNOWN">🟡 Non spécifié / Interne</option>
                    <option value="NOT_AUTHORIZED">🔴 Non autorisé / Usage interne</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">Visibilité Agent IA</label>
                  <select
                    value={testimonialForm.isPublic ? "public" : "private"}
                    onChange={(e) => setTestimonialForm({ ...testimonialForm, isPublic: e.target.value === "public" })}
                    className="w-full bg-[#181824] border border-[#282838] rounded-xl p-3 text-white text-sm focus:border-[#7B61FF] outline-none"
                  >
                    <option value="public">🌐 Actif pour l'Agent IA</option>
                    <option value="private">🔒 Inactif / Masqué</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTestimonialModal(false)}
                  className="px-4 py-2 bg-gray-800 text-gray-300 rounded-xl text-xs font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isUploadingImage}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black rounded-xl text-xs font-bold disabled:opacity-50 flex items-center gap-2"
                >
                  {isUploadingImage ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Upload & Sauvegarde...
                    </>
                  ) : (
                    "Enregistrer le témoignage"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REAL AGENT TESTER MODAL */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#12121A] border border-[#181824] w-full max-w-2xl p-6 rounded-3xl space-y-5 relative">
            <button
              onClick={() => setShowTestModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-full bg-[#181824]"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 bg-[#7B61FF]/10 border border-[#7B61FF]/20 rounded-2xl text-[#7B61FF]">
                <Play className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">🧪 Tester l'Agent IA (Vrai Backend)</h3>
                <p className="text-xs text-gray-400">Exécution en direct via l'API Anthropic Messages (`claude-sonnet-5`)</p>
              </div>
            </div>

            <form onSubmit={handleRunAgentTest} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">Message Test du Client</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={testInputMessage}
                    onChange={(e) => setTestInputMessage(e.target.value)}
                    className="flex-1 bg-[#181824] border border-[#282838] rounded-xl p-3 text-white text-sm focus:border-[#7B61FF] outline-none"
                    placeholder="Écrivez une question pour tester l'Agent..."
                    required
                  />
                  <button
                    type="submit"
                    disabled={isExecutingTest}
                    className="px-5 py-3 bg-[#7B61FF] hover:bg-[#684DFE] disabled:opacity-50 text-white rounded-xl font-semibold text-xs flex items-center gap-2"
                  >
                    {isExecutingTest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </form>

            {testResult && (
              <div className="bg-[#0B0B10] border border-[#181824] p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between font-mono text-xs border-b border-white/5 pb-2">
                  <span className="text-gray-400">Résultat Anthropic API :</span>
                  <span className={testResult.success ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>
                    {testResult.success ? `HTTP 200 OK (${testResult.latencyMs}ms)` : `ERREUR (${testResult.latencyMs}ms)`}
                  </span>
                </div>
                {testResult.success ? (
                  <div className="bg-[#181824] p-3.5 rounded-xl border border-white/5 text-sm text-gray-200">
                    <p className="whitespace-pre-wrap">{testResult.responseText}</p>
                  </div>
                ) : (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300">
                    <p>{testResult.error}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
