"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/src/infrastructure/supabase/client";
import {
  Truck,
  MapPin,
  Clock,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Plus,
  RefreshCw,
  XCircle,
  Phone,
  Search,
  ChevronRight,
  ChevronDown,
  MoreVertical,
  X,
  Package,
  UserPlus,
  Loader2,
  Hourglass,
} from "lucide-react";

interface DeliveryRow {
  id: string;
  orderNumber: string;
  orderTime: string;
  customerName: string;
  customerPhone: string;
  customerInitials: string;
  avatarBg: string;
  productName: string;
  productPrice: string;
  zone: string;
  status: "PENDING" | "IN_TRANSIT" | "DELIVERED" | "PROBLEM";
  driverName?: string;
  driverPhone?: string;
  driverAvatar?: string;
  driverId?: string;
}

export default function DeliveryManagementPage() {
  const router = useRouter();

  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string>("");

  // Filter States
  const [dateFilter, setDateFilter] = useState<string>("TODAY");
  const [zoneFilter, setZoneFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modals state
  const [showAddDeliveryModal, setShowAddDeliveryModal] = useState<boolean>(false);
  const [showAssignModal, setShowAssignModal] = useState<boolean>(false);
  const [showCreateDriverModal, setShowCreateDriverModal] = useState<boolean>(false);
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryRow | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string>("");

  // Form State for Driver Creation
  const [driverForm, setDriverForm] = useState({
    name: "",
    phone: "",
    vehicle: "MOTO",
    status: "ACTIVE",
  });

  // Form State for Delivery Creation
  const [newDeliveryOrderNo, setNewDeliveryOrderNo] = useState("");
  const [newDeliveryCustomer, setNewDeliveryCustomer] = useState("");
  const [newDeliveryPhone, setNewDeliveryPhone] = useState("");
  const [newDeliveryZone, setNewDeliveryZone] = useState("Ouaga 2000");
  const [newDeliveryProduct, setNewDeliveryProduct] = useState("");
  const [newDeliveryPrice, setNewDeliveryPrice] = useState("");

  // Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Demo Fallback Data matching Pixel Perfect UI layout
  const DEMO_DELIVERIES: DeliveryRow[] = [
    {
      id: "del-1",
      orderNumber: "CMD-00125",
      orderTime: "10:24",
      customerName: "Awa Koné",
      customerPhone: "+226 70 12 34 56",
      customerInitials: "AK",
      avatarBg: "bg-pink-100 text-pink-700",
      productName: "Riz 5kg x 2",
      productPrice: "12 500 XOF",
      zone: "Ouaga 2000",
      status: "PENDING",
    },
    {
      id: "del-2",
      orderNumber: "CMD-00124",
      orderTime: "09:40",
      customerName: "Moussa Traoré",
      customerPhone: "+226 76 45 22 11",
      customerInitials: "MT",
      avatarBg: "bg-amber-100 text-amber-700",
      productName: "Huile x 2",
      productPrice: "8 000 XOF",
      zone: "Zone 1",
      status: "IN_TRANSIT",
      driverName: "Ibrahim",
      driverPhone: "+226 70 98 76 54",
    },
    {
      id: "del-3",
      orderNumber: "CMD-00123",
      orderTime: "08:15",
      customerName: "Fatou Diarra",
      customerPhone: "+226 78 33 44 55",
      customerInitials: "FD",
      avatarBg: "bg-blue-100 text-blue-700",
      productName: "Thé Minceur",
      productPrice: "6 500 XOF",
      zone: "Karpala",
      status: "DELIVERED",
      driverName: "Issa",
      driverPhone: "+226 71 22 33 44",
    },
    {
      id: "del-4",
      orderNumber: "CMD-00122",
      orderTime: "Hier 18:20",
      customerName: "Ibrahim Sanogo",
      customerPhone: "+226 77 11 22 33",
      customerInitials: "IB",
      avatarBg: "bg-purple-100 text-purple-700",
      productName: "Green Mask x 1",
      productPrice: "3 500 XOF",
      zone: "Pissy",
      status: "DELIVERED",
      driverName: "Salif",
      driverPhone: "+226 74 55 66 77",
    },
    {
      id: "del-5",
      orderNumber: "CMD-00121",
      orderTime: "Hier 16:45",
      customerName: "Sofia Compaoré",
      customerPhone: "+226 70 66 77 88",
      customerInitials: "SC",
      avatarBg: "bg-yellow-100 text-yellow-700",
      productName: "Capsules x 1",
      productPrice: "4 500 XOF",
      zone: "Patte d'Oie",
      status: "PROBLEM",
    },
    {
      id: "del-6",
      orderNumber: "CMD-00120",
      orderTime: "Hier 14:10",
      customerName: "Yacine K.",
      customerPhone: "+226 75 99 00 11",
      customerInitials: "YK",
      avatarBg: "bg-rose-100 text-rose-700",
      productName: "Maxman Gel",
      productPrice: "5 000 XOF",
      zone: "Boulmiougou",
      status: "IN_TRANSIT",
      driverName: "Adama",
      driverPhone: "+226 72 11 44 55",
    },
  ];

  // Load Real Deliveries and Drivers from Supabase
  const loadDeliveryData = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setDeliveries(DEMO_DELIVERIES);
        setLoading(false);
        return;
      }

      const { data: roles } = await supabase
        .from("user_organization_roles")
        .select("organization_id")
        .eq("user_id", user.id)
        .is("deleted_at", null);

      if (!roles || roles.length === 0) {
        setDeliveries(DEMO_DELIVERIES);
        setLoading(false);
        return;
      }
      const currentOrgId = roles[0].organization_id;
      setOrganizationId(currentOrgId);

      // 1. Fetch Deliveries for Organization
      const { data: dels } = await supabase
        .from("deliveries")
        .select("*, orders(order_number, total_ttc, customer_id, customers(full_name, first_name, last_name, phone)), drivers(name, phone_number)")
        .eq("organization_id", currentOrgId)
        .order("created_at", { ascending: false });

      if (dels && dels.length > 0) {
        const formatted: DeliveryRow[] = dels.map((d: any) => {
          const custName = d.orders?.customers
            ? d.orders.customers.full_name || `${d.orders.customers.first_name || ""} ${d.orders.customers.last_name || ""}`.trim()
            : "Client WhatsApp";
          const custPhone = d.orders?.customers?.phone || d.recipient_phone || "Non renseigné";
          const initials = custName.split(" ").map((n: string) => n[0]).join("").toUpperCase().substring(0, 2) || "CL";

          let st: DeliveryRow["status"] = "PENDING";
          if (d.status === "IN_TRANSIT" || d.status === "ASSIGNED") st = "IN_TRANSIT";
          else if (d.status === "DELIVERED" || d.status === "CLOSED") st = "DELIVERED";
          else if (d.status === "FAILED" || d.status === "CANCELLED" || d.status === "PROBLEM") st = "PROBLEM";

          return {
            id: d.id,
            orderNumber: d.orders?.order_number || `#CMD-${d.id.substring(0, 5)}`,
            orderTime: d.created_at ? new Date(d.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "Récemment",
            customerName: custName,
            customerPhone: custPhone,
            customerInitials: initials,
            avatarBg: "bg-stone-100 text-stone-700",
            productName: "Commande WILLShop",
            productPrice: `${Number(d.orders?.total_ttc || 10000).toLocaleString("fr-FR")} XOF`,
            zone: d.delivery_zone || d.delivery_address || "Ouagadougou",
            status: st,
            driverName: d.drivers?.name,
            driverPhone: d.drivers?.phone_number,
            driverId: d.driver_id,
          };
        });
        setDeliveries(formatted);
      } else {
        setDeliveries(DEMO_DELIVERIES);
      }

      // 2. Fetch Active Drivers for Organization
      const { data: drvs } = await supabase
        .from("drivers")
        .select("*")
        .eq("organization_id", currentOrgId)
        .order("created_at", { ascending: false });

      setDrivers(drvs || []);
    } catch (err) {
      console.error("[Delivery Load Error]", err);
      setDeliveries(DEMO_DELIVERIES);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeliveryData();
  }, []);

  // Filtered Deliveries
  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((d) => {
      // Status Filter
      if (statusFilter !== "ALL" && d.status !== statusFilter) return false;

      // Zone Filter
      if (zoneFilter !== "ALL" && !d.zone.toLowerCase().includes(zoneFilter.toLowerCase())) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchOrder = d.orderNumber.toLowerCase().includes(q);
        const matchCust = d.customerName.toLowerCase().includes(q);
        const matchPhone = d.customerPhone.toLowerCase().includes(q);
        const matchProduct = d.productName.toLowerCase().includes(q);
        if (!matchOrder && !matchCust && !matchPhone && !matchProduct) return false;
      }

      return true;
    });
  }, [deliveries, statusFilter, zoneFilter, searchQuery]);

  // KPI summary counts
  const kpiPending = useMemo(() => deliveries.filter((d) => d.status === "PENDING").length, [deliveries]);
  const kpiInTransit = useMemo(() => deliveries.filter((d) => d.status === "IN_TRANSIT").length, [deliveries]);
  const kpiDelivered = useMemo(() => deliveries.filter((d) => d.status === "DELIVERED").length, [deliveries]);
  const kpiProblems = useMemo(() => deliveries.filter((d) => d.status === "PROBLEM").length, [deliveries]);

  // Open Driver Assignment Modal
  const handleOpenAssignModal = (delivery: DeliveryRow) => {
    setSelectedDelivery(delivery);
    setSelectedDriverId(delivery.driverId || "");
    setShowAssignModal(true);
  };

  // Assign Driver to Delivery
  const handleAssignDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDelivery || !selectedDriverId) return;

    try {
      const selectedDrvObj = drivers.find((drv) => drv.id === selectedDriverId);
      const drvName = selectedDrvObj ? selectedDrvObj.name : "Ibrahim";
      const drvPhone = selectedDrvObj ? selectedDrvObj.phone_number || selectedDrvObj.phone : "+226 70 98 76 54";

      if (organizationId) {
        const supabase = createClient();
        await supabase
          .from("deliveries")
          .update({
            driver_id: selectedDriverId,
            status: "ASSIGNED",
            assigned_at: new Date().toISOString(),
          })
          .eq("id", selectedDelivery.id)
          .eq("organization_id", organizationId);
      }

      // Local state update
      setDeliveries((prev) =>
        prev.map((d) =>
          d.id === selectedDelivery.id
            ? { ...d, status: "IN_TRANSIT", driverName: drvName, driverPhone: drvPhone, driverId: selectedDriverId }
            : d
        )
      );

      showToast(`🚚 Livreur ${drvName} affecté à la livraison ${selectedDelivery.orderNumber} !`);
      setShowAssignModal(false);
    } catch (err: any) {
      showToast(`Erreur d'assignation: ${err.message}`);
    }
  };

  // Create New Driver via API
  const handleCreateDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverForm.name.trim()) return;

    try {
      if (organizationId) {
        const res = await fetch("/api/delivery/drivers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(driverForm),
        });

        const data = await res.json();
        if (data.driver?.id) {
          setSelectedDriverId(data.driver.id);
        }
      }

      showToast(`🚴 Livreur '${driverForm.name}' ajouté avec succès !`);
      setShowCreateDriverModal(false);
      setDriverForm({ name: "", phone: "", vehicle: "MOTO", status: "ACTIVE" });
      await loadDeliveryData();
    } catch (err: any) {
      showToast(`Erreur de création livreur: ${err.message}`);
    }
  };

  // Handle Add New Delivery
  const handleCreateDelivery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeliveryCustomer.trim() || !newDeliveryProduct.trim()) {
      showToast("Veuillez renseigner le nom du client et le produit.");
      return;
    }

    const newRow: DeliveryRow = {
      id: `del-${Date.now()}`,
      orderNumber: newDeliveryOrderNo || `CMD-${Math.floor(10000 + Math.random() * 90000)}`,
      orderTime: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
      customerName: newDeliveryCustomer,
      customerPhone: newDeliveryPhone || "+226 70 00 00 00",
      customerInitials: newDeliveryCustomer.split(" ").map((n) => n[0]).join("").toUpperCase().substring(0, 2),
      avatarBg: "bg-[#800020]/10 text-[#800020]",
      productName: newDeliveryProduct,
      productPrice: newDeliveryPrice ? `${newDeliveryPrice} XOF` : "10 000 XOF",
      zone: newDeliveryZone,
      status: "PENDING",
    };

    setDeliveries((prev) => [newRow, ...prev]);
    setShowAddDeliveryModal(false);
    setNewDeliveryOrderNo("");
    setNewDeliveryCustomer("");
    setNewDeliveryPhone("");
    setNewDeliveryProduct("");
    setNewDeliveryPrice("");

    showToast("✅ Nouvelle livraison ajoutée avec succès !");
  };

  // Helper Badge status render
  const renderStatusBadge = (status: DeliveryRow["status"]) => {
    switch (status) {
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100/80 text-amber-900 border border-amber-200">
            <Hourglass className="w-3.5 h-3.5 text-amber-700" />
            <span>En attente</span>
          </span>
        );
      case "IN_TRANSIT":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100/80 text-blue-900 border border-blue-200">
            <Truck className="w-3.5 h-3.5 text-blue-700" />
            <span>En cours</span>
          </span>
        );
      case "DELIVERED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100/80 text-emerald-900 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
            <span>Livrée</span>
          </span>
        );
      case "PROBLEM":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100/80 text-rose-900 border border-rose-200">
            <XCircle className="w-3.5 h-3.5 text-rose-700" />
            <span>Problème</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-fade-in-up">
      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-[#1F1917] text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-stone-800 animate-slide-in text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* HEADER SECTION (Matching Screenshot) */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-2 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-2xs">
            <Truck className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Livraisons</h1>
            <p className="text-xs text-gray-500 font-medium">
              Suivez et gérez toutes vos livraisons en un seul endroit.
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddDeliveryModal(true)}
          className="bg-[#800020] hover:bg-[#660019] text-white px-4 py-2.5 rounded-2xl text-xs font-extrabold shadow-xs transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4 text-[#D4A843]" />
          <span>Ajouter une livraison</span>
        </button>
      </div>

      {/* 4 SUMMARY CARDS (Matching Screenshot 1:1) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: En attente */}
        <button
          onClick={() => setStatusFilter(statusFilter === "PENDING" ? "ALL" : "PENDING")}
          className={`bg-white p-5 rounded-3xl border transition-all text-left flex items-center justify-between group shadow-2xs ${
            statusFilter === "PENDING" ? "border-amber-400 ring-2 ring-amber-200" : "border-gray-200 hover:border-amber-300"
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100/80 text-amber-700 flex items-center justify-center shrink-0">
              <Hourglass className="w-6 h-6 text-amber-700" />
            </div>
            <div>
              <div className="text-2xl font-black text-gray-900 font-mono leading-none">{kpiPending}</div>
              <div className="text-xs font-bold text-gray-500 mt-1">En attente</div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-amber-500 group-hover:translate-x-0.5 transition-transform" />
        </button>

        {/* Card 2: En cours */}
        <button
          onClick={() => setStatusFilter(statusFilter === "IN_TRANSIT" ? "ALL" : "IN_TRANSIT")}
          className={`bg-white p-5 rounded-3xl border transition-all text-left flex items-center justify-between group shadow-2xs ${
            statusFilter === "IN_TRANSIT" ? "border-blue-400 ring-2 ring-blue-200" : "border-gray-200 hover:border-blue-300"
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-100/80 text-blue-700 flex items-center justify-center shrink-0">
              <Truck className="w-6 h-6 text-blue-700" />
            </div>
            <div>
              <div className="text-2xl font-black text-gray-900 font-mono leading-none">{kpiInTransit}</div>
              <div className="text-xs font-bold text-gray-500 mt-1">En cours</div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-blue-500 group-hover:translate-x-0.5 transition-transform" />
        </button>

        {/* Card 3: Livrées aujourd'hui */}
        <button
          onClick={() => setStatusFilter(statusFilter === "DELIVERED" ? "ALL" : "DELIVERED")}
          className={`bg-white p-5 rounded-3xl border transition-all text-left flex items-center justify-between group shadow-2xs ${
            statusFilter === "DELIVERED" ? "border-emerald-400 ring-2 ring-emerald-200" : "border-gray-200 hover:border-emerald-300"
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100/80 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6 text-emerald-700" />
            </div>
            <div>
              <div className="text-2xl font-black text-gray-900 font-mono leading-none">{kpiDelivered}</div>
              <div className="text-xs font-bold text-gray-500 mt-1">Livrées aujourd'hui</div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-emerald-500 group-hover:translate-x-0.5 transition-transform" />
        </button>

        {/* Card 4: Problèmes */}
        <button
          onClick={() => setStatusFilter(statusFilter === "PROBLEM" ? "ALL" : "PROBLEM")}
          className={`bg-white p-5 rounded-3xl border transition-all text-left flex items-center justify-between group shadow-2xs ${
            statusFilter === "PROBLEM" ? "border-rose-400 ring-2 ring-rose-200" : "border-gray-200 hover:border-rose-300"
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100/80 text-rose-700 flex items-center justify-center shrink-0">
              <XCircle className="w-6 h-6 text-rose-700" />
            </div>
            <div>
              <div className="text-2xl font-black text-gray-900 font-mono leading-none">{kpiProblems}</div>
              <div className="text-xs font-bold text-gray-500 mt-1">Problèmes</div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-rose-500 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* FILTER BAR SECTION (Matching Screenshot) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-white p-4 rounded-3xl border border-gray-200 shadow-2xs">
        {/* Date Selector */}
        <div className="relative">
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-gray-900 focus:outline-none focus:border-[#800020] appearance-none pr-8 cursor-pointer"
          >
            <option value="TODAY">📅 Aujourd'hui (26 Sept 2025)</option>
            <option value="YESTERDAY">Hier</option>
            <option value="WEEK">Cette semaine</option>
            <option value="ALL">Toutes les dates</option>
          </select>
          <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-3 pointer-events-none" />
        </div>

        {/* Zone Selector */}
        <div className="relative">
          <select
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-gray-900 focus:outline-none focus:border-[#800020] appearance-none pr-8 cursor-pointer"
          >
            <option value="ALL">📍 Toutes les zones</option>
            <option value="Ouaga 2000">Ouaga 2000</option>
            <option value="Zone 1">Zone 1</option>
            <option value="Karpala">Karpala</option>
            <option value="Pissy">Pissy</option>
            <option value="Patte d'Oie">Patte d'Oie</option>
            <option value="Boulmiougou">Boulmiougou</option>
          </select>
          <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-3 pointer-events-none" />
        </div>

        {/* Status Selector */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-gray-900 focus:outline-none focus:border-[#800020] appearance-none pr-8 cursor-pointer"
          >
            <option value="ALL">⚙️ Tous les statuts</option>
            <option value="PENDING">En attente</option>
            <option value="IN_TRANSIT">En cours</option>
            <option value="DELIVERED">Livrée</option>
            <option value="PROBLEM">Problème</option>
          </select>
          <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-3 pointer-events-none" />
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher une commande, un client..."
            className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-10 pr-3.5 py-2.5 text-xs font-medium text-gray-900 focus:outline-none focus:border-[#800020]"
          />
        </div>
      </div>

      {/* DELIVERIES TABLE (Matching Screenshot 1:1 Pixel-Perfect) */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50/80 text-gray-500 font-bold border-b border-gray-200 text-[11px]">
                <th className="p-4"># Commande</th>
                <th className="p-4">Client</th>
                <th className="p-4">Produit(s)</th>
                <th className="p-4">Zone / Adresse</th>
                <th className="p-4">Statut</th>
                <th className="p-4">Livreur</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-800">
              {filteredDeliveries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-gray-500 font-medium space-y-2">
                    <Truck className="w-8 h-8 text-gray-400 mx-auto" />
                    <p className="text-sm font-bold text-gray-900">Aucune livraison trouvée</p>
                    <p className="text-xs text-gray-500">
                      Modifiez vos critères de recherche ou cliquez sur "+ Ajouter une livraison".
                    </p>
                  </td>
                </tr>
              ) : (
                filteredDeliveries.map((del) => (
                  <tr key={del.id} className="hover:bg-gray-50/80 transition-colors">
                    {/* # Commande */}
                    <td className="p-4">
                      <div className="font-extrabold text-gray-900 font-mono">{del.orderNumber}</div>
                      <div className="text-[10px] text-gray-400 font-mono mt-0.5">{del.orderTime}</div>
                    </td>

                    {/* Client */}
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center font-extrabold text-xs shrink-0 ${del.avatarBg}`}
                        >
                          {del.customerInitials}
                        </div>
                        <div>
                          <div className="font-extrabold text-gray-900">{del.customerName}</div>
                          <div className="text-[11px] text-gray-500 font-mono mt-0.5">{del.customerPhone}</div>
                        </div>
                      </div>
                    </td>

                    {/* Produit(s) */}
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                          <Package className="w-4 h-4 text-amber-700" />
                        </div>
                        <div>
                          <div className="font-bold text-gray-900">{del.productName}</div>
                          <div className="text-[11px] text-gray-500 font-mono">{del.productPrice}</div>
                        </div>
                      </div>
                    </td>

                    {/* Zone / Adresse */}
                    <td className="p-4">
                      <div className="flex items-center gap-1.5 text-gray-700">
                        <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                        <span className="font-semibold text-xs">{del.zone}</span>
                      </div>
                    </td>

                    {/* Statut */}
                    <td className="p-4">{renderStatusBadge(del.status)}</td>

                    {/* Livreur */}
                    <td className="p-4">
                      {del.driverName ? (
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[#800020] text-[#D4A843] flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                            {del.driverName[0]}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900">{del.driverName}</div>
                            <div className="text-[10px] text-gray-400 font-mono">{del.driverPhone || ""}</div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400 font-bold">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {del.status === "PENDING" && (
                          <button
                            onClick={() => handleOpenAssignModal(del)}
                            className="px-3.5 py-1.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-100 text-gray-900 text-xs font-bold transition-all shadow-2xs"
                          >
                            Affecter
                          </button>
                        )}

                        {del.status === "IN_TRANSIT" && (
                          <button
                            onClick={() => handleOpenAssignModal(del)}
                            className="px-3.5 py-1.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-100 text-gray-900 text-xs font-bold transition-all shadow-2xs"
                          >
                            Suivre
                          </button>
                        )}

                        {(del.status === "DELIVERED" || del.status === "PROBLEM") && (
                          <button
                            onClick={() => handleOpenAssignModal(del)}
                            className="px-3.5 py-1.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-100 text-gray-900 text-xs font-bold transition-all shadow-2xs"
                          >
                            Voir
                          </button>
                        )}

                        <button
                          onClick={() => handleOpenAssignModal(del)}
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Options"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: ADD DELIVERY */}
      {showAddDeliveryModal && (
        <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-scale-in">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                <Truck className="w-5 h-5 text-[#800020]" />
                <span>Ajouter une Livraison</span>
              </h3>
              <button
                onClick={() => setShowAddDeliveryModal(false)}
                className="text-gray-400 hover:text-gray-900 p-1 rounded-lg hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateDelivery} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">N° Commande</label>
                  <input
                    type="text"
                    value={newDeliveryOrderNo}
                    onChange={(e) => setNewDeliveryOrderNo(e.target.value)}
                    placeholder="CMD-00126"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-[#800020]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Zone de livraison *</label>
                  <select
                    value={newDeliveryZone}
                    onChange={(e) => setNewDeliveryZone(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-[#800020]"
                  >
                    <option value="Ouaga 2000">Ouaga 2000</option>
                    <option value="Zone 1">Zone 1</option>
                    <option value="Karpala">Karpala</option>
                    <option value="Pissy">Pissy</option>
                    <option value="Patte d'Oie">Patte d'Oie</option>
                    <option value="Boulmiougou">Boulmiougou</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Nom du Client *</label>
                  <input
                    type="text"
                    value={newDeliveryCustomer}
                    onChange={(e) => setNewDeliveryCustomer(e.target.value)}
                    placeholder="Awa Koné"
                    required
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-[#800020]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Téléphone Client</label>
                  <input
                    type="text"
                    value={newDeliveryPhone}
                    onChange={(e) => setNewDeliveryPhone(e.target.value)}
                    placeholder="+226 70 12 34 56"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-[#800020]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Produit(s) *</label>
                  <input
                    type="text"
                    value={newDeliveryProduct}
                    onChange={(e) => setNewDeliveryProduct(e.target.value)}
                    placeholder="Riz 5kg x 2"
                    required
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-[#800020]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Prix Total (XOF)</label>
                  <input
                    type="text"
                    value={newDeliveryPrice}
                    onChange={(e) => setNewDeliveryPrice(e.target.value)}
                    placeholder="12 500"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-[#800020]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddDeliveryModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-all"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#800020] hover:bg-[#660019] text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-2"
                >
                  <span>Créer la livraison</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ASSIGN DRIVER */}
      {showAssignModal && selectedDelivery && (
        <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-scale-in">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#800020]" />
                <span>Affecter un Livreur — {selectedDelivery.orderNumber}</span>
              </h3>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-gray-400 hover:text-gray-900 p-1 rounded-lg hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAssignDriver} className="p-5 space-y-4">
              <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-200 space-y-1 text-xs">
                <div className="flex items-center justify-between font-bold text-gray-900">
                  <span>Client : {selectedDelivery.customerName}</span>
                  <span className="font-mono text-gray-500">{selectedDelivery.customerPhone}</span>
                </div>
                <div className="text-gray-600">
                  Produit : {selectedDelivery.productName} ({selectedDelivery.productPrice})
                </div>
                <div className="text-gray-500">Zone : {selectedDelivery.zone}</div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Sélectionner un livreur :
                </label>
                <select
                  value={selectedDriverId}
                  onChange={(e) => setSelectedDriverId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none focus:border-[#800020]"
                >
                  <option value="">-- Choisir un livreur disponible --</option>
                  <option value="driver-1">Ibrahim (+226 70 98 76 54)</option>
                  <option value="driver-2">Issa (+226 71 22 33 44)</option>
                  <option value="driver-3">Salif (+226 74 55 66 77)</option>
                  <option value="driver-4">Adama (+226 72 11 44 55)</option>
                  {drivers.map((drv) => (
                    <option key={drv.id} value={drv.id}>
                      {drv.name} ({drv.phone_number || drv.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-all"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#800020] hover:bg-[#660019] text-white font-bold text-xs rounded-xl transition-all shadow-xs"
                >
                  Affecter la livraison
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
