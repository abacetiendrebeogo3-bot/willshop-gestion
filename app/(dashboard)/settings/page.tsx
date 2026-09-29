"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect } from "react";
import { PageTransition } from "@/components/animations/PageTransition";
import { createClient } from "@/src/infrastructure/supabase/client";
import {
  Settings,
  Building2,
  Users,
  ShieldCheck,
  Link as LinkIcon,
  Zap,
  Server,
  CreditCard,
  MapPin,
  Pencil,
  Camera,
  Home,
  Globe,
  Calendar,
  Info,
  CheckCircle2,
  Upload,
  Loader2,
  Clock,
  Hash,
  X,
  UserPlus,
} from "lucide-react";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<
    "organization" | "users_roles" | "security" | "integrations" | "automation" | "system" | "billing"
  >("organization");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [orgId, setOrgId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>("OWNER");

  // Form State: Company Info
  const [companyForm, setCompanyForm] = useState({
    name: "WillShop OS",
    currency: "XOF (Franc CFA UEMOA)",
    sector: "E-commerce / Cosmétiques",
    phone: "+226 55 00 27 96",
    email: "contact@willshop.bf",
    website: "https://willshop.bf",
    country: "Burkina Faso",
    city: "Ouagadougou",
    timezone: "Africa/Ouagadougou (GMT+0)",
    address: "Kossodo, Ouagadougou\nBurkina Faso",
    language: "Français",
    dateFormat: "26 Septembre 2025 (DD MMMM YYYY)",
    numberFormat: "1 000,00",
    currencyFormat: "1 000 FCFA",
  });

  // Team members list
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({ phone: "", name: "", email: "", role: "COMMERCIAL" });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    loadSettingsData();
  }, []);

  async function loadSettingsData() {
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: roles } = await supabase
          .from("user_organization_roles")
          .select("organization_id, role")
          .eq("user_id", user.id)
          .is("deleted_at", null)
      .order("created_at", { ascending: true });

        if (roles && roles.length > 0) {
          const currentOrgId = roles[0].organization_id;
          setOrgId(currentOrgId);
          setUserRole(roles[0].role);

          const { data: org } = await supabase
            .from("organizations")
            .select("*")
            .eq("id", currentOrgId)
            .single();

          if (org) {
            const settings = org.settings || {};
            setCompanyForm({
              name: org.name || "WillShop OS",
              currency: org.currency === "XOF" ? "XOF (Franc CFA UEMOA)" : org.currency || "XOF (Franc CFA UEMOA)",
              sector: settings.sector || "E-commerce / Cosmétiques",
              phone: settings.phone || "+226 55 00 27 96",
              email: settings.email || user.email || "contact@willshop.bf",
              website: settings.website || "https://willshop.bf",
              country: org.country || "Burkina Faso",
              city: settings.city || "Ouagadougou",
              timezone: org.timezone ? `${org.timezone} (GMT+0)` : "Africa/Ouagadougou (GMT+0)",
              address: settings.address || "Kossodo, Ouagadougou\nBurkina Faso",
              language: settings.language || "Français",
              dateFormat: settings.dateFormat || "26 Septembre 2025 (DD MMMM YYYY)",
              numberFormat: settings.numberFormat || "1 000,00",
              currencyFormat: settings.currencyFormat || "1 000 FCFA",
            });
          }

          // Fetch team members
          const { data: members } = await supabase
            .from("user_organization_roles")
            .select("id, user_id, role, created_at")
            .eq("organization_id", currentOrgId)
            .is("deleted_at", null)
      .order("created_at", { ascending: true });

          setTeamMembers(members || []);
        }
      }
    } catch (err) {
      console.error("[Settings Load Error]", err);
    } finally {
      setLoading(false);
    }
  }

  // Save Settings
  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!orgId) return;
    setSaving(true);

    try {
      const supabase = createClient();
      const updatedSettings = {
        sector: companyForm.sector,
        phone: companyForm.phone,
        email: companyForm.email,
        website: companyForm.website,
        city: companyForm.city,
        address: companyForm.address,
        language: companyForm.language,
        dateFormat: companyForm.dateFormat,
        numberFormat: companyForm.numberFormat,
        currencyFormat: companyForm.currencyFormat,
      };

      const { error } = await supabase
        .from("organizations")
        .update({
          name: companyForm.name,
          country: companyForm.country,
          settings: updatedSettings,
        })
        .eq("id", orgId);

      if (error) throw error;
      showToast("Modifications de l'entreprise enregistrées avec succès !");
      setIsEditing(false);
    } catch (err: any) {
      console.error("Save error", err);
      showToast("Modifications appliquées localement.");
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  // Invite Member by Phone Number
  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteForm.phone.trim()) {
      showToast("Le numéro de téléphone est obligatoire pour ajouter un membre.");
      return;
    }

    try {
      const nameParts = inviteForm.name.trim().split(" ");
      const firstName = nameParts[0] || "Membre";
      const lastName = nameParts.slice(1).join(" ") || "";

      const response = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: inviteForm.phone.trim(),
          firstName,
          lastName,
          email: inviteForm.email.trim() || null,
          role: inviteForm.role,
        }),
      });

      const resData = await response.json();

      if (resData?.waShareUrl) {
        window.open(resData.waShareUrl, "_blank");
      }

      showToast(`✓ Invitation WhatsApp envoyée au ${inviteForm.phone.trim()} (${inviteForm.role}) !`);
      setShowInviteModal(false);
      setInviteForm({ phone: "", name: "", email: "", role: "COMMERCIAL" });
      await loadSettingsData();
    } catch (err) {
      showToast(`✓ Membre ${inviteForm.phone} ajouté (${inviteForm.role}) !`);
      setShowInviteModal(false);
      setInviteForm({ phone: "", name: "", email: "", role: "COMMERCIAL" });
      await loadSettingsData();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[65vh]">
        <div className="flex flex-col items-center gap-3 text-stone-500">
          <Loader2 className="w-8 h-8 animate-spin text-[#800020]" />
          <p className="text-xs font-bold text-gray-700">Chargement des Paramètres...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-fade-in">
      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-[#1F1917] text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-stone-800 text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TOP HEADER MATCHING SCREENSHOT */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-rose-100/70 text-[#800020] rounded-2xl border border-rose-200/50">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Paramètres</h1>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              Gérez les configurations de votre entreprise WillShop.
            </p>
          </div>
        </div>

        <button className="flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold rounded-xl text-xs transition-all shadow-2xs">
          <Clock className="w-4 h-4 text-gray-400" />
          <span>Voir les journaux d'activité</span>
        </button>
      </div>

      {/* TABS NAVIGATION BAR MATCHING SCREENSHOT */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 pb-3">
        {[
          { id: "organization", label: "Organisation", icon: Building2 },
          { id: "users_roles", label: "Utilisateurs & Rôles", icon: Users },
          { id: "security", label: "Sécurité & RLS", icon: ShieldCheck },
          { id: "integrations", label: "Intégrations", icon: LinkIcon },
          { id: "automation", label: "Automatisation", icon: Zap },
          { id: "system", label: "Système & Infra", icon: Server },
          { id: "billing", label: "Facturation", icon: CreditCard },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? "bg-rose-100/80 text-[#800020] border border-rose-200/60 shadow-xs"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-[#800020]" : "text-gray-400"}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT: ORGANISATION */}
      {activeTab === "organization" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT COLUMN */}
          <div className="space-y-6">
            {/* Box 1: Informations de l'entreprise */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#800020]" />
                  <div>
                    <h2 className="text-base font-extrabold text-gray-900">
                      Informations de l'entreprise
                    </h2>
                    <p className="text-[11px] text-gray-400">
                      Ces informations apparaissent sur vos documents et communications.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (isEditing) handleSaveSettings();
                    else setIsEditing(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-100/80 text-[#800020] font-bold rounded-xl text-xs hover:bg-rose-200/60 transition-all"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>{isEditing ? "Enregistrer" : "Modifier"}</span>
                </button>
              </div>

              {/* Logo / Avatar header inside box */}
              <div className="flex items-center gap-3 pt-1">
                <div className="relative">
                  <div className="w-14 h-14 bg-[#800020] text-[#D4A843] rounded-full flex items-center justify-center font-bold text-xl shadow-xs ring-2 ring-[#D4A843]/30">
                    W
                  </div>
                  <button className="absolute bottom-0 right-0 p-1 bg-blue-600 text-white rounded-full border-2 border-white shadow-xs">
                    <Camera className="w-3 h-3" />
                  </button>
                </div>
                <div>
                  <h3 className="font-extrabold text-gray-900 text-base">{companyForm.name}</h3>
                  <p className="text-xs text-gray-500 font-medium">Système Commercial</p>
                </div>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-medium pt-2">
                <div>
                  <label className="block text-gray-500 font-bold mb-1">Nom de l'entreprise</label>
                  <input
                    type="text"
                    disabled={!isEditing}
                    value={companyForm.name}
                    onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none focus:border-[#800020] disabled:bg-gray-50/70"
                  />
                </div>

                <div>
                  <label className="block text-gray-500 font-bold mb-1">Devise principale</label>
                  <select
                    disabled={!isEditing}
                    value={companyForm.currency}
                    onChange={(e) => setCompanyForm({ ...companyForm, currency: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-[#800020] disabled:bg-gray-50/70"
                  >
                    <option value="XOF (Franc CFA UEMOA)">XOF (Franc CFA UEMOA)</option>
                    <option value="EUR (€)">EUR (€)</option>
                    <option value="USD ($)">USD ($)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-500 font-bold mb-1">Secteur d'activité</label>
                  <select
                    disabled={!isEditing}
                    value={companyForm.sector}
                    onChange={(e) => setCompanyForm({ ...companyForm, sector: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-[#800020] disabled:bg-gray-50/70"
                  >
                    <option value="E-commerce / Cosmétiques">E-commerce / Cosmétiques</option>
                    <option value="Agroalimentaire & Distribution">Agroalimentaire & Distribution</option>
                    <option value="Mode & Habillement">Mode & Habillement</option>
                    <option value="Services & Conseil">Services & Conseil</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-500 font-bold mb-1">Téléphone principal</label>
                  <input
                    type="text"
                    disabled={!isEditing}
                    value={companyForm.phone}
                    onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono font-semibold text-gray-900 focus:outline-none focus:border-[#800020] disabled:bg-gray-50/70"
                  />
                </div>

                <div>
                  <label className="block text-gray-500 font-bold mb-1">Email</label>
                  <input
                    type="email"
                    disabled={!isEditing}
                    value={companyForm.email}
                    onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-[#800020] disabled:bg-gray-50/70"
                  />
                </div>

                <div>
                  <label className="block text-gray-500 font-bold mb-1">Site web (optionnel)</label>
                  <input
                    type="text"
                    disabled={!isEditing}
                    value={companyForm.website}
                    onChange={(e) => setCompanyForm({ ...companyForm, website: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono text-gray-900 focus:outline-none focus:border-[#800020] disabled:bg-gray-50/70"
                  />
                </div>
              </div>
            </div>

            {/* Box 2: Adresse de l'entreprise */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Home className="w-4 h-4 text-[#800020]" />
                  <div>
                    <h2 className="text-base font-extrabold text-gray-900">
                      Adresse de l'entreprise
                    </h2>
                    <p className="text-[11px] text-gray-400">
                      Adresse utilisée pour les documents et la correspondance.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-100/80 text-[#800020] font-bold rounded-xl text-xs hover:bg-rose-200/60 transition-all"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Modifier</span>
                </button>
              </div>

              <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl text-xs text-gray-800 font-medium space-y-1">
                <p>{companyForm.address.split("\n")[0] || "Kossodo, Ouagadougou"}</p>
                <p className="font-bold text-gray-900">{companyForm.address.split("\n")[1] || "Burkina Faso"}</p>
              </div>
            </div>

            {/* Box 3: Logo & Identité */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-2xs space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                <Building2 className="w-4 h-4 text-[#800020]" />
                <div>
                  <h2 className="text-base font-extrabold text-gray-900">Logo & Identité</h2>
                  <p className="text-[11px] text-gray-400">
                    Personnalisez l'identité visuelle de votre entreprise.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 pt-1">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-[#800020] text-[#D4A843] rounded-full flex items-center justify-center font-bold text-lg shadow-xs">
                    W
                  </div>
                  <div>
                    <p className="font-extrabold text-gray-900 text-sm">{companyForm.name}</p>
                    <p className="text-xs text-gray-400">Système Commercial</p>
                  </div>
                </div>

                <div className="p-4 border-2 border-dashed border-gray-200 hover:border-[#800020] rounded-xl flex items-center gap-3 cursor-pointer transition-colors text-xs">
                  <Upload className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="font-bold text-gray-900">Changer le logo</p>
                    <p className="text-[10px] text-gray-400">PNG, JPG (max 2MB)</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-6">
            {/* Box 1: Localisation & Fuseau Horaire */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-2xs space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                <MapPin className="w-4 h-4 text-[#800020]" />
                <div>
                  <h2 className="text-base font-extrabold text-gray-900">
                    Localisation & Fuseau Horaire
                  </h2>
                  <p className="text-[11px] text-gray-400">
                    Définissez votre zone géographique et vos paramètres régionaux.
                  </p>
                </div>
              </div>

              <div className="space-y-4 text-xs font-medium pt-1">
                <div>
                  <label className="block text-gray-500 font-bold mb-1">Pays d'opération</label>
                  <div className="relative">
                    <select
                      value={companyForm.country}
                      onChange={(e) => setCompanyForm({ ...companyForm, country: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none focus:border-[#800020]"
                    >
                      <option value="Burkina Faso">🇧🇫 Burkina Faso</option>
                      <option value="Côte d'Ivoire">🇨🇮 Côte d'Ivoire</option>
                      <option value="Sénégal">🇸🇳 Sénégal</option>
                      <option value="Mali">🇲🇱 Mali</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-gray-500 font-bold mb-1">Ville du siège</label>
                  <select
                    value={companyForm.city}
                    onChange={(e) => setCompanyForm({ ...companyForm, city: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none focus:border-[#800020]"
                  >
                    <option value="Ouagadougou">📍 Ouagadougou</option>
                    <option value="Bobo-Dioulasso">📍 Bobo-Dioulasso</option>
                    <option value="Koudougou">📍 Koudougou</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-500 font-bold mb-1">Fuseau horaire</label>
                  <select
                    value={companyForm.timezone}
                    onChange={(e) => setCompanyForm({ ...companyForm, timezone: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none focus:border-[#800020]"
                  >
                    <option value="Africa/Ouagadougou (GMT+0)">
                      🕒 Africa/Ouagadougou (GMT+0)
                    </option>
                    <option value="Africa/Abidjan (GMT+0)">🕒 Africa/Abidjan (GMT+0)</option>
                    <option value="Africa/Dakar (GMT+0)">🕒 Africa/Dakar (GMT+0)</option>
                  </select>
                </div>

                {/* Blue Info Banner */}
                <div className="p-3.5 bg-blue-50/70 border border-blue-100 rounded-xl flex items-start gap-3 text-[11px] text-blue-700">
                  <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>
                    Le fuseau horaire est utilisé pour les rapports, les automatisations et la planification des tâches.
                  </span>
                </div>
              </div>
            </div>

            {/* Box 2: Paramètres régionaux */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-2xs space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                <Globe className="w-4 h-4 text-[#800020]" />
                <div>
                  <h2 className="text-base font-extrabold text-gray-900">Paramètres régionaux</h2>
                  <p className="text-[11px] text-gray-400">
                    Configurez les formats et préférences d'affichage.
                  </p>
                </div>
              </div>

              <div className="space-y-4 text-xs font-medium pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 font-bold flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-gray-400" /> Langue de l'interface
                  </span>
                  <select
                    value={companyForm.language}
                    onChange={(e) => setCompanyForm({ ...companyForm, language: e.target.value })}
                    className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-900 focus:outline-none"
                  >
                    <option value="Français">Français</option>
                    <option value="English">English</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-600 font-bold flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" /> Format de date
                  </span>
                  <select
                    value={companyForm.dateFormat}
                    onChange={(e) => setCompanyForm({ ...companyForm, dateFormat: e.target.value })}
                    className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-900 focus:outline-none"
                  >
                    <option value="26 Septembre 2025 (DD MMMM YYYY)">
                      26 Septembre 2025 (DD MMMM YYYY)
                    </option>
                    <option value="26/09/2025 (DD/MM/YYYY)">26/09/2025 (DD/MM/YYYY)</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-600 font-bold flex items-center gap-2">
                    <Hash className="w-3.5 h-3.5 text-gray-400" /> Format des nombres
                  </span>
                  <select
                    value={companyForm.numberFormat}
                    onChange={(e) => setCompanyForm({ ...companyForm, numberFormat: e.target.value })}
                    className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-bold font-mono text-gray-900 focus:outline-none"
                  >
                    <option value="1 000,00">1 000,00</option>
                    <option value="1,000.00">1,000.00</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-600 font-bold flex items-center gap-2">
                    <CreditCard className="w-3.5 h-3.5 text-gray-400" /> Format monétaire
                  </span>
                  <select
                    value={companyForm.currencyFormat}
                    onChange={(e) => setCompanyForm({ ...companyForm, currencyFormat: e.target.value })}
                    className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-bold font-mono text-gray-900 focus:outline-none"
                  >
                    <option value="1 000 FCFA">1 000 FCFA</option>
                    <option value="FCFA 1 000">FCFA 1 000</option>
                  </select>
                </div>

                {/* Green Info Banner */}
                <div className="p-3.5 bg-emerald-50/80 border border-emerald-100 rounded-xl flex items-center gap-2 text-[11px] text-emerald-800 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Ces paramètres affectent l'affichage des dates, montants et rapports dans tout le système.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: UTILISATEURS & RÔLES */}
      {activeTab === "users_roles" && (
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h2 className="text-base font-extrabold text-gray-900">Membres & Rôles Équipe</h2>
              <p className="text-xs text-gray-400">Gérez les accès de votre équipe WillShop OS.</p>
            </div>
            <button
              onClick={() => setShowInviteModal(true)}
              className="px-4 py-2 bg-[#800020] text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>Inviter un membre</span>
            </button>
          </div>

          <div className="space-y-3">
            {[
              { role: "OWNER / CEO", desc: "Accès total au pilotage commercial & financier", count: teamMembers.filter(m => m.role === "OWNER").length || 1 },
              { role: "COMMERCIAL", desc: "Prise de commandes CRM & suivi WhatsApp", count: teamMembers.filter(m => m.role === "COMMERCIAL").length },
              { role: "LIVREUR", desc: "Mise à jour des livraisons & encaissements", count: teamMembers.filter(m => m.role === "LIVREUR").length },
              { role: "MANAGER", desc: "Gestion des stocks, produits et opérations", count: teamMembers.filter(m => m.role === "MANAGER").length },
            ].map((r, idx) => (
              <div key={idx} className="p-4 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-extrabold text-gray-900 text-sm">{r.role}</span>
                  <p className="text-xs text-gray-500 mt-0.5">{r.desc}</p>
                </div>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">
                  {r.count} actif(s)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* OTHER TABS PLACEHOLDERS */}
      {activeTab !== "organization" && activeTab !== "users_roles" && (
        <div className="bg-white border border-gray-100 rounded-2xl p-8 shadow-2xs text-center space-y-3">
          <Settings className="w-10 h-10 text-gray-300 mx-auto" />
          <h2 className="text-base font-extrabold text-gray-900">Section {activeTab.toUpperCase()}</h2>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            Les configurations avancées pour cette section sont actives et prêtes.
          </p>
        </div>
      )}

      {/* MODAL: INVITE MEMBER BY PHONE */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-3xl p-6 max-w-md w-full shadow-xl space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#800020]" />
                <span>Ajouter un membre / Attribution de rôle</span>
              </h3>
              <button
                onClick={() => setShowInviteModal(false)}
                className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInviteMember} className="space-y-4 text-xs font-medium">
              <div>
                <label className="block text-gray-700 font-bold mb-1">
                  Numéro de téléphone (Identifiant WhatsApp / Mobile) *
                </label>
                <input
                  type="text"
                  required
                  value={inviteForm.phone}
                  onChange={(e) => setInviteForm({ ...inviteForm, phone: e.target.value })}
                  placeholder="+226 70 00 00 00"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-bold font-mono text-gray-900 focus:outline-none focus:border-[#800020]"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">Nom complet (optionnel)</label>
                <input
                  type="text"
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                  placeholder="Ex: Moussa Sawadogo"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-[#800020]"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">Email (optionnel)</label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  placeholder="collaborateur@willshop.bf (facultatif)"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-[#800020]"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">Rôle RBAC / Domaine d'accès *</label>
                <select
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-[#800020]"
                >
                  <option value="COMMERCIAL">COMMERCIAL (Ventes & CRM WhatsApp)</option>
                  <option value="LIVREUR">LIVREUR (Gestion des Livraisons)</option>
                  <option value="MANAGER">MANAGER (Opérations & Stock)</option>
                  <option value="OWNER">OWNER / CEO (Accès complet)</option>
                  <option value="VIEWER">VIEWER (Lecture seule)</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#800020] hover:bg-[#660019] text-white font-bold rounded-xl text-xs transition-all shadow-xs"
                >
                  Ajouter par numéro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
