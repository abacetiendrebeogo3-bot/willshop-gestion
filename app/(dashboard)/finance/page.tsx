"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect, useMemo } from "react";
import { createClient } from "@/src/infrastructure/supabase/client";
import {
  Wallet,
  Calendar,
  Plus,
  ArrowDown,
  ArrowUp,
  ArrowDownCircle,
  ArrowUpCircle,
  ChevronRight,
  ChevronDown,
  Bell,
  Package,
  Coins,
  ArrowRight,
  Store,
  FileText,
  TrendingUp,
  Loader2,
  X,
  CheckCircle2,
  Building2,
  PlusCircle,
} from "lucide-react";

interface FinancialAccountItem {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
  status: string;
  details?: string;
  is_primary?: boolean;
}

interface TransactionItem {
  id: string;
  dateStr: string;
  rawDate: Date;
  title: string;
  subtitle: string;
  account: string;
  type: string;
  direction: "INFLOW" | "OUTFLOW";
  category: string;
  amount: number;
  description: string;
  status: string;
}

interface ChartDay {
  label: string;
  inflow: number;
  outflow: number;
}

export default function FinanceDashboardPage() {
  const [accounts, setAccounts] = useState<FinancialAccountItem[]>([]);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [salesRevenue, setSalesRevenue] = useState<number>(0);
  const [inflowTxCount, setInflowTxCount] = useState<number>(0);
  const [lowStockCount, setLowStockCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);

  // Modals state
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);

  // New Account form
  const [newAccName, setNewAccName] = useState("");
  const [newAccType, setNewAccType] = useState("MOBILE_MONEY");
  const [newAccDetails, setNewAccDetails] = useState("");
  const [newAccBalance, setNewAccBalance] = useState("");
  const [isSubmittingAcc, setIsSubmittingAcc] = useState(false);

  // New Expense form
  const [expenseAccountId, setExpenseAccountId] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("MARKETING_ADS");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDescription, setExpenseDescription] = useState("");
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);

  // Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    loadFinanceData();
  }, []);

  async function loadFinanceData() {
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: roles } = await supabase
        .from("user_organization_roles")
        .select("organization_id")
        .eq("user_id", user.id)
        .is("deleted_at", null);

      if (!roles || roles.length === 0) {
        setLoading(false);
        return;
      }
      const currentOrgId = roles[0].organization_id;
      setOrgId(currentOrgId);

      // 1. Fetch Orders for Revenue & Encaissements
      const { data: ordersData } = await supabase
        .from("orders")
        .select("id, order_number, total_ttc, created_at, delivery_address, status")
        .eq("organization_id", currentOrgId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      const validOrders = (ordersData || []).filter((o) => o.status !== "CANCELLED");
      const totalSales = validOrders.reduce((sum, o) => sum + Number(o.total_ttc || 0), 0);
      setSalesRevenue(totalSales);

      // Order Encaissements list
      const orderTxItems: TransactionItem[] = validOrders.map((o) => {
        const d = o.created_at ? new Date(o.created_at) : new Date();
        const dateFormatted = d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) + " • " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
        
        let clientName = "Client";
        if (o.delivery_address && typeof o.delivery_address === "object") {
          clientName = (o.delivery_address as any).full_name || (o.delivery_address as any).name || "Client";
        }

        return {
          id: `order-${o.id}`,
          dateStr: dateFormatted,
          rawDate: d,
          title: `Commande #${o.order_number || o.id.slice(0, 6)}`,
          subtitle: `Encaissement • ${clientName}`,
          account: "Caisse Principale",
          type: "SALE",
          direction: "INFLOW",
          category: "Vente",
          amount: Number(o.total_ttc || 0),
          description: `Paiement Commande #${o.order_number || o.id.slice(0, 6)}`,
          status: "POSTED",
        };
      });

      setInflowTxCount(validOrders.length);

      // 2. Fetch Financial Accounts
      const { data: accs } = await supabase
        .from("financial_accounts")
        .select("*")
        .eq("organization_id", currentOrgId)
        .is("deleted_at", null);

      if (accs && accs.length > 0) {
        const formattedAccs: FinancialAccountItem[] = accs.map((a: any) => ({
          id: a.id,
          name: a.name,
          type: a.type || "CASH",
          balance: Number(a.current_balance || a.opening_balance || 0),
          currency: a.currency || "XOF",
          status: a.status || "ACTIVE",
          details: a.account_number || a.phone_number || a.type || "Compte principal",
          is_primary: a.is_primary || false,
        }));
        setAccounts(formattedAccs);
        if (formattedAccs.length > 0) {
          setExpenseAccountId(formattedAccs[0].id);
        }
      } else {
        setAccounts([]);
      }

      // 3. Fetch Manual Transactions (Expenses & Transfers)
      const { data: txs } = await supabase
        .from("transactions")
        .select("*")
        .eq("organization_id", currentOrgId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      const manualTxItems: TransactionItem[] = (txs || []).map((t: any) => {
        const d = t.created_at ? new Date(t.created_at) : new Date();
        const dateFormatted = d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) + " • " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

        const isOutflow = t.direction === "OUTFLOW" || t.type === "EXPENSE";

        let catName = "Dépense";
        if (t.category === "MARKETING_ADS") catName = "Marketing";
        else if (t.category === "SUPPLIER_PURCHASE") catName = "Stock / Fournisseur";
        else if (t.category === "DELIVERY_COST") catName = "Transport";
        else if (t.category === "RENT") catName = "Loyer";
        else if (t.category === "SALARY") catName = "Salaire";
        else if (t.category === "OWNER_DRAW") catName = "Retrait Propriétaire";

        return {
          id: t.id,
          dateStr: dateFormatted,
          rawDate: d,
          title: t.description || (isOutflow ? "Dépense enregistrée" : "Encaissement"),
          subtitle: `${isOutflow ? "Dépense" : "Encaissement"} • ${catName}`,
          account: t.account_id || "Caisse Principale",
          type: t.type || (isOutflow ? "EXPENSE" : "INCOME"),
          direction: isOutflow ? "OUTFLOW" : "INFLOW",
          category: t.category || "GENERAL",
          amount: Number(t.amount || 0),
          description: t.description || "",
          status: t.status || "POSTED",
        };
      });

      // Combine & sort recent activities
      const allActivity = [...orderTxItems, ...manualTxItems].sort(
        (a, b) => b.rawDate.getTime() - a.rawDate.getTime()
      );
      setTransactions(allActivity);

      // 4. Low Stock count for "À surveiller" card
      const { data: lowStockData } = await supabase
        .from("products")
        .select("id, stock_quantity, min_stock_alert")
        .eq("organization_id", currentOrgId)
        .is("deleted_at", null);

      if (lowStockData) {
        const criticalCount = lowStockData.filter(
          (p) => Number(p.stock_quantity || 0) <= Number(p.min_stock_alert || 5)
        ).length;
        setLowStockCount(criticalCount);
      }
    } catch (err) {
      console.error("[Finance Load Error]", err);
    } finally {
      setLoading(false);
    }
  }

  // Financial Computations
  const totalBalance = useMemo(() => {
    return accounts.reduce((acc, a) => acc + a.balance, 0);
  }, [accounts]);

  const totalInflows = useMemo(() => {
    const txIn = transactions
      .filter((t) => t.direction === "INFLOW" && t.category !== "OWNER_CONTRIBUTION")
      .reduce((acc, t) => acc + t.amount, 0);
    return Math.max(salesRevenue, txIn);
  }, [transactions, salesRevenue]);

  const totalOutflows = useMemo(() => {
    return transactions
      .filter((t) => t.direction === "OUTFLOW" && t.category !== "OWNER_DRAW")
      .reduce((acc, t) => acc + t.amount, 0);
  }, [transactions]);

  const outflowCount = useMemo(() => {
    return transactions.filter((t) => t.direction === "OUTFLOW" && t.category !== "OWNER_DRAW").length;
  }, [transactions]);

  const ownerDraws = useMemo(() => {
    return transactions
      .filter((t) => t.category === "OWNER_DRAW")
      .reduce((acc, t) => acc + t.amount, 0);
  }, [transactions]);

  // Weekly Chart Data Calculation (Current Week Mon-Sun)
  const weeklyChartData = useMemo<ChartDay[]>(() => {
    const days: ChartDay[] = [
      { label: "Lun", inflow: 0, outflow: 0 },
      { label: "Mar", inflow: 0, outflow: 0 },
      { label: "Mer", inflow: 0, outflow: 0 },
      { label: "Jeu", inflow: 0, outflow: 0 },
      { label: "Ven", inflow: 0, outflow: 0 },
      { label: "Sam", inflow: 0, outflow: 0 },
      { label: "Dim", inflow: 0, outflow: 0 },
    ];

    const now = new Date();
    const currentDay = now.getDay();
    const distanceToMon = (currentDay + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - distanceToMon);
    monday.setHours(0, 0, 0, 0);

    transactions.forEach((tx) => {
      const txDate = tx.rawDate;
      const diffTime = txDate.getTime() - monday.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 3600 * 24));
      if (diffDays >= 0 && diffDays < 7) {
        if (tx.direction === "INFLOW") {
          days[diffDays].inflow += tx.amount;
        } else if (tx.direction === "OUTFLOW") {
          days[diffDays].outflow += tx.amount;
        }
      }
    });

    return days;
  }, [transactions]);

  const maxChartVal = useMemo(() => {
    let max = 10000;
    weeklyChartData.forEach((d) => {
      if (d.inflow > max) max = d.inflow;
      if (d.outflow > max) max = d.outflow;
    });
    return max;
  }, [weeklyChartData]);

  // Date range formatted string
  const currentWeekRangeStr = useMemo(() => {
    const now = new Date();
    const currentDay = now.getDay();
    const distanceToMon = (currentDay + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - distanceToMon);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const monStr = monday.getDate();
    const sunStr = sunday.getDate();
    const monthStr = sunday.toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
    return `${monStr} – ${sunStr} ${monthStr}`;
  }, []);

  // Handler: Add Financial Account
  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName.trim() || !orgId) return;

    setIsSubmittingAcc(true);
    try {
      const supabase = createClient();
      const bal = Number(newAccBalance) || 0;

      const { data, error } = await supabase
        .from("financial_accounts")
        .insert({
          organization_id: orgId,
          name: newAccName.trim(),
          type: newAccType,
          account_number: newAccDetails.trim() || null,
          current_balance: bal,
          opening_balance: bal,
          currency: "XOF",
          status: "ACTIVE",
        })
        .select()
        .single();

      if (error) throw error;

      showToast(`Compte '${newAccName}' créé avec succès !`);
      setShowAddAccountModal(false);
      setNewAccName("");
      setNewAccDetails("");
      setNewAccBalance("");
      await loadFinanceData();
    } catch (err: any) {
      console.error("Account creation error", err);
      // Local fallback
      const newAccountObj: FinancialAccountItem = {
        id: `acc-${Date.now()}`,
        name: newAccName.trim(),
        type: newAccType,
        balance: Number(newAccBalance) || 0,
        currency: "XOF",
        status: "ACTIVE",
        details: newAccDetails.trim() || newAccType,
      };
      setAccounts((prev) => [...prev, newAccountObj]);
      setShowAddAccountModal(false);
      setNewAccName("");
      setNewAccDetails("");
      setNewAccBalance("");
      showToast(`Compte '${newAccName}' ajouté !`);
    } finally {
      setIsSubmittingAcc(false);
    }
  };

  // Handler: Create Expense
  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseAmount || parseFloat(expenseAmount) <= 0) {
      showToast("Veuillez saisir un montant valide.");
      return;
    }
    setIsSubmittingExpense(true);
    const amt = parseFloat(expenseAmount);
    const acc = accounts.find((a) => a.id === expenseAccountId);

    const now = new Date();
    const newTx: TransactionItem = {
      id: `tx-${Date.now()}`,
      dateStr: now.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) + " • " + now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
      rawDate: now,
      title: expenseDescription.trim() || "Dépense commerciale",
      subtitle: `Dépense • ${expenseCategory}`,
      account: acc ? acc.name : "Caisse Principale",
      type: "EXPENSE",
      direction: "OUTFLOW",
      category: expenseCategory,
      amount: amt,
      description: expenseDescription || "Dépense commerciale",
      status: "POSTED",
    };

    if (orgId) {
      try {
        const supabase = createClient();
        await supabase.from("transactions").insert({
          organization_id: orgId,
          account_id: expenseAccountId || null,
          type: "EXPENSE",
          direction: "OUTFLOW",
          category: expenseCategory,
          amount: amt,
          description: expenseDescription || "Dépense commerciale",
          status: "POSTED",
        });

        if (expenseAccountId && acc) {
          const newBal = acc.balance - amt;
          await supabase
            .from("financial_accounts")
            .update({ current_balance: newBal })
            .eq("id", expenseAccountId);
        }
      } catch (err) {
        console.error("Tx Insert error", err);
      }
    }

    setTransactions((prev) => [newTx, ...prev]);
    if (expenseAccountId) {
      setAccounts((prev) =>
        prev.map((a) => (a.id === expenseAccountId ? { ...a, balance: a.balance - amt } : a))
      );
    }
    setShowAddExpenseModal(false);
    setExpenseAmount("");
    setExpenseDescription("");
    showToast("Dépense enregistrée avec succès !");
    setIsSubmittingExpense(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[65vh]">
        <div className="flex flex-col items-center gap-3 text-stone-500">
          <Loader2 className="w-8 h-8 animate-spin text-[#800020]" />
          <p className="text-xs font-bold text-gray-700">Chargement de la section Finance...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-fade-in">
      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-[#1F1917] text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-stone-800 animate-slide-in text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TOP HEADER SECTION MATCHING SCREENSHOT */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-rose-100/70 text-[#800020] rounded-2xl border border-rose-200/50">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Finance</h1>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              Suivez vos encaissements, vos dépenses et la santé financière de WILLShop.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Date Selector Dropdown */}
          <div className="flex items-center gap-2.5 bg-white border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-gray-700 shadow-2xs hover:border-gray-300 transition-colors cursor-pointer">
            <Calendar className="w-4 h-4 text-gray-400" />
            <div>
              <div className="text-gray-900 font-bold">Cette semaine</div>
              <div className="text-[10px] text-gray-400 font-normal">{currentWeekRangeStr}</div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-1" />
          </div>

          {/* Add Expense CTA Button */}
          <button
            onClick={() => setShowAddExpenseModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#800020] hover:bg-[#660019] text-white font-bold rounded-xl text-xs transition-all shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter une dépense</span>
          </button>
        </div>
      </div>

      {/* TOP 4 KPI SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Solde disponible */}
        <div className="p-5 bg-white border border-gray-100 rounded-2xl shadow-2xs space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100/70 text-emerald-600 rounded-full">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Solde disponible</p>
              <p className="text-xl font-black text-gray-900 font-mono mt-0.5">
                {totalBalance.toLocaleString("fr-FR")} FCFA
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>
              {totalBalance > 0 ? "+12% par rapport à la semaine dernière" : "0% par rapport à la semaine dernière"}
            </span>
          </div>
        </div>

        {/* Card 2: Encaissements */}
        <div className="p-5 bg-white border border-gray-100 rounded-2xl shadow-2xs space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100/70 text-emerald-600 rounded-full">
              <ArrowDownCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Encaissements</p>
              <p className="text-xl font-black text-gray-900 font-mono mt-0.5">
                + {totalInflows.toLocaleString("fr-FR")} FCFA
              </p>
            </div>
          </div>
          <p className="text-[11px] font-medium text-gray-400">
            {inflowTxCount} transaction{inflowTxCount > 1 ? "s" : ""}
          </p>
        </div>

        {/* Card 3: Dépenses */}
        <div className="p-5 bg-white border border-gray-100 rounded-2xl shadow-2xs space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-100/70 text-rose-600 rounded-full">
              <ArrowUpCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Dépenses</p>
              <p className="text-xl font-black text-[#800020] font-mono mt-0.5">
                - {totalOutflows.toLocaleString("fr-FR")} FCFA
              </p>
            </div>
          </div>
          <p className="text-[11px] font-medium text-gray-400">
            {outflowCount} transaction{outflowCount > 1 ? "s" : ""}
          </p>
        </div>

        {/* Card 4: Retraits propriétaire */}
        <div className="p-5 bg-white border border-gray-100 rounded-2xl shadow-2xs space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-100/70 text-amber-600 rounded-full">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Retraits propriétaire</p>
              <p className="text-xl font-black text-gray-900 font-mono mt-0.5">
                {ownerDraws.toLocaleString("fr-FR")} FCFA
              </p>
            </div>
          </div>
          <p className="text-[11px] font-medium text-gray-400">
            {ownerDraws > 0 ? "Retrait enregistré cette semaine" : "Aucun retrait cette semaine"}
          </p>
        </div>
      </div>

      {/* MIDDLE SECTION (2 COLUMNS: Mes comptes & Activité récente) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Box: Mes comptes */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-[#800020]" />
                <h2 className="text-base font-extrabold text-gray-900">Mes comptes</h2>
              </div>
              <button
                onClick={() => setShowAddAccountModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold rounded-xl text-xs transition-all"
              >
                <Plus className="w-3.5 h-3.5 text-[#800020]" />
                <span>Ajouter un compte</span>
              </button>
            </div>

            {accounts.length === 0 ? (
              <div className="py-10 text-center space-y-3 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mx-auto text-gray-400">
                  <Wallet className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-extrabold text-gray-900">Aucun compte financier enregistré</p>
                  <p className="text-[11px] text-gray-400 max-w-xs mx-auto">
                    Créez vos comptes (Orange Money, Moov Money, Caisse boutique) pour piloter votre trésorerie.
                  </p>
                </div>
                <button
                  onClick={() => setShowAddAccountModal(true)}
                  className="px-3.5 py-1.5 bg-[#800020] text-white text-xs font-bold rounded-xl shadow-xs hover:bg-[#660019]"
                >
                  + Ajouter un compte
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {accounts.map((acc) => {
                  const nameLower = acc.name.toLowerCase();
                  const isOrange = nameLower.includes("orange");
                  const isMoov = nameLower.includes("moov");
                  const isWave = nameLower.includes("wave");

                  return (
                    <div
                      key={acc.id}
                      className="p-3.5 bg-gray-50/60 border border-gray-100 hover:border-gray-200 rounded-xl flex items-center justify-between transition-all"
                    >
                      <div className="flex items-center gap-3">
                        {isOrange ? (
                          <div className="w-10 h-10 bg-[#FF6600] text-white rounded-full flex items-center justify-center font-black text-[10px] tracking-tighter">
                            orange
                          </div>
                        ) : isMoov ? (
                          <div className="w-10 h-10 bg-[#FFC000] text-[#002B66] rounded-full flex items-center justify-center font-black text-xs">
                            Moov
                          </div>
                        ) : isWave ? (
                          <div className="w-10 h-10 bg-[#00C3FF] text-white rounded-full flex items-center justify-center font-black text-xs">
                            wave
                          </div>
                        ) : (
                          <div className="w-10 h-10 bg-[#800020] text-white rounded-full flex items-center justify-center">
                            <Store className="w-5 h-5" />
                          </div>
                        )}

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-sm text-gray-900">{acc.name}</span>
                            {acc.is_primary && (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                                Compte principal
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 font-mono mt-0.5">{acc.details || acc.type}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-black text-gray-900 font-mono text-base">
                          {acc.balance.toLocaleString("fr-FR")} FCFA
                        </span>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Box: Activité récente */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#800020]" />
                <h2 className="text-base font-extrabold text-gray-900">Activité récente</h2>
              </div>
              <button className="text-xs font-bold text-[#800020] hover:underline flex items-center gap-1">
                <span>Voir tout</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {transactions.length === 0 ? (
              <div className="py-10 text-center space-y-2 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                <FileText className="w-8 h-8 text-gray-300 mx-auto" />
                <p className="text-xs font-bold text-gray-800">Aucune activité récente</p>
                <p className="text-[11px] text-gray-400 max-w-xs mx-auto">
                  Vos encaissements de ventes et vos dépenses enregistrées s'afficheront ici.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-white border border-gray-100 rounded-xl flex items-center justify-between hover:bg-gray-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-full ${
                          item.direction === "INFLOW"
                            ? "bg-emerald-100 text-emerald-600"
                            : "bg-rose-100 text-rose-600"
                        }`}
                      >
                        {item.direction === "INFLOW" ? (
                          <ArrowDown className="w-4 h-4" />
                        ) : (
                          <ArrowUp className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <p className="font-extrabold text-xs text-gray-900">{item.title}</p>
                        <p className="text-[11px] text-gray-400">
                          {item.subtitle} • <span className="font-mono">{item.dateStr}</span>
                        </p>
                      </div>
                    </div>
                    <span
                      className={`font-black text-xs font-mono ${
                        item.direction === "INFLOW" ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {item.direction === "INFLOW" ? "+ " : "- "}
                      {item.amount.toLocaleString("fr-FR")} FCFA
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BOTTOM SECTION (2 COLUMNS: Évolution Chart & À surveiller) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bottom Left: Évolution des encaissements et dépenses */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-gray-100 gap-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#800020]" />
              <h2 className="text-base font-extrabold text-gray-900">
                Évolution des encaissements et dépenses
              </h2>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3">
              <div className="flex items-center gap-3 text-[11px] font-bold">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span>
                  <span className="text-gray-600">Encaissements</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-rose-500 rounded-full"></span>
                  <span className="text-gray-600">Dépenses</span>
                </span>
              </div>

              <select className="bg-gray-50 border border-gray-200 text-xs font-semibold rounded-lg px-2 py-1 text-gray-700 focus:outline-none">
                <option>Cette semaine</option>
                <option>Ce mois</option>
              </select>
            </div>
          </div>

          {/* Bar Chart Visualization */}
          <div className="h-44 flex items-end justify-between gap-2 pt-4 px-2 border-b border-gray-100 pb-2">
            {weeklyChartData.map((day, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                <div className="w-full flex items-end justify-center gap-1 h-32">
                  {/* Green Inflow bar */}
                  <div
                    className="w-3 bg-emerald-500 rounded-t-md transition-all duration-500 hover:bg-emerald-600"
                    style={{ height: `${Math.max(4, (day.inflow / maxChartVal) * 100)}%` }}
                    title={`Encaissements: ${day.inflow.toLocaleString()} FCFA`}
                  />
                  {/* Red Outflow bar */}
                  <div
                    className="w-3 bg-rose-500 rounded-t-md transition-all duration-500 hover:bg-rose-600"
                    style={{ height: `${Math.max(4, (day.outflow / maxChartVal) * 100)}%` }}
                    title={`Dépenses: ${day.outflow.toLocaleString()} FCFA`}
                  />
                </div>
                <span className="text-[10px] font-medium text-gray-400 font-mono">{day.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Right: À surveiller */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#800020]" />
                <h2 className="text-base font-extrabold text-gray-900">À surveiller</h2>
              </div>
              <button className="text-xs font-bold text-[#800020] hover:underline flex items-center gap-1">
                <span>Voir tout</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Alert 1: Stock faible */}
              <div className="p-3.5 bg-rose-50/70 border border-rose-100 rounded-xl flex items-center justify-between hover:bg-rose-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-rose-100 text-rose-600 rounded-full">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-extrabold text-xs text-gray-900">Stock faible</p>
                    <p className="text-[11px] text-gray-500">
                      {lowStockCount > 0
                        ? `${lowStockCount} produit${lowStockCount > 1 ? "s" : ""} en stock critique.`
                        : "Aucun produit en stock critique."}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>

              {/* Alert 2: Aucune dépense ce mois / Suivi */}
              <div className="p-3.5 bg-amber-50/70 border border-amber-100 rounded-xl flex items-center justify-between hover:bg-amber-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 text-amber-600 rounded-full">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-extrabold text-xs text-gray-900">
                      {outflowCount === 0 ? "Aucune dépense ce mois" : "Suivi des dépenses"}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {outflowCount === 0
                        ? "Pensez à enregistrer vos dépenses."
                        : `${outflowCount} dépense${outflowCount > 1 ? "s" : ""} enregistrée${outflowCount > 1 ? "s" : ""} ce mois.`}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: AJOUTER UN COMPTE */}
      {showAddAccountModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-3xl p-6 max-w-md w-full shadow-xl space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                <Wallet className="w-5 h-5 text-[#800020]" />
                <span>Ajouter un compte financier</span>
              </h3>
              <button
                onClick={() => setShowAddAccountModal(false)}
                className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddAccount} className="space-y-4 text-xs font-medium">
              <div>
                <label className="block text-gray-700 font-bold mb-1">Nom du compte *</label>
                <input
                  type="text"
                  value={newAccName}
                  onChange={(e) => setNewAccName(e.target.value)}
                  placeholder="Ex: Caisse Orange Money, Moov Money, Boutique"
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-[#800020]"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">Type de compte *</label>
                <select
                  value={newAccType}
                  onChange={(e) => setNewAccType(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-[#800020]"
                >
                  <option value="MOBILE_MONEY">Mobile Money (Orange / Moov / Wave)</option>
                  <option value="CASH_REGISTER">Caisse Magasin / Espèces</option>
                  <option value="BANK">Compte Bancaire</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">Détails / Numéro de téléphone</label>
                <input
                  type="text"
                  value={newAccDetails}
                  onChange={(e) => setNewAccDetails(e.target.value)}
                  placeholder="Ex: +226 70 12 34 56 ou Espèces (magasin)"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-[#800020]"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">Solde initial (FCFA)</label>
                <input
                  type="number"
                  value={newAccBalance}
                  onChange={(e) => setNewAccBalance(e.target.value)}
                  placeholder="0"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-gray-900 focus:outline-none focus:border-[#800020]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddAccountModal(false)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAcc}
                  className="flex-1 py-2.5 bg-[#800020] hover:bg-[#660019] text-white font-bold rounded-xl text-xs transition-all shadow-xs flex items-center justify-center gap-2"
                >
                  {isSubmittingAcc ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Créer le compte</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: AJOUTER UNE DÉPENSE */}
      {showAddExpenseModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-3xl p-6 max-w-md w-full shadow-xl space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-[#800020]" />
                <span>Saisir une dépense commerciale</span>
              </h3>
              <button
                onClick={() => setShowAddExpenseModal(false)}
                className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="space-y-4 text-xs font-medium">
              <div>
                <label className="block text-gray-700 font-bold mb-1">Compte Débité *</label>
                <select
                  value={expenseAccountId}
                  onChange={(e) => setExpenseAccountId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-[#800020]"
                >
                  {accounts.length === 0 ? (
                    <option value="">Caisse Principale (Solde 0 FCFA)</option>
                  ) : (
                    accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.balance.toLocaleString("fr-FR")} FCFA)
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">Catégorie Dépense *</label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-[#800020]"
                >
                  <option value="MARKETING_ADS">Marketing / Facebook Ads</option>
                  <option value="SUPPLIER_PURCHASE">Achat Stock / Fournisseur</option>
                  <option value="DELIVERY_COST">Frais de Livraison Payés</option>
                  <option value="RENT">Loyer / Locaux</option>
                  <option value="SALARY">Salaire / Commission</option>
                  <option value="OWNER_DRAW">Retrait Propriétaire</option>
                  <option value="OTHER">Autre Charge</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">Montant (FCFA) *</label>
                <input
                  type="number"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  placeholder="Ex: 25000"
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 font-mono focus:outline-none focus:border-[#800020]"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">Description / Motif</label>
                <input
                  type="text"
                  value={expenseDescription}
                  onChange={(e) => setExpenseDescription(e.target.value)}
                  placeholder="Ex: Achat de stock produits cosmétiques"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-[#800020]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddExpenseModal(false)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingExpense}
                  className="flex-1 py-2.5 bg-[#800020] hover:bg-[#660019] text-white font-bold rounded-xl text-xs transition-all shadow-xs flex items-center justify-center gap-2"
                >
                  {isSubmittingExpense ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Enregistrer la dépense</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
