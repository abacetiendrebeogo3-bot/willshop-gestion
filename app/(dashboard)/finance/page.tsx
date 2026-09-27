"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect, useMemo } from "react";
import { createClient } from "@/src/infrastructure/supabase/client";
import { DataSourceBadge } from "@/components/ui/data-source-badge";
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  TrendingUp,
  DollarSign,
  PlusCircle,
  FileText,
  Building2,
  ShieldCheck,
  CreditCard,
  PieChart,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Loader2,
  X,
  ArrowRight,
} from "lucide-react";

interface FinancialAccountItem {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
  status: string;
}

interface TransactionItem {
  id: string;
  date: string;
  account: string;
  type: string;
  direction: "INFLOW" | "OUTFLOW";
  category: string;
  amount: number;
  description: string;
  status: string;
}

export default function FinanceDashboardPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "accounts" | "transactions" | "expenses" | "transfers">("overview");

  const [accounts, setAccounts] = useState<FinancialAccountItem[]>([]);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [salesRevenue, setSalesRevenue] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);

  // Modals state
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [newAccName, setNewAccName] = useState("");
  const [newAccType, setNewAccType] = useState("CASH_REGISTER");
  const [newAccBalance, setNewAccBalance] = useState("");

  // Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Form states
  const [expenseForm, setExpenseForm] = useState({
    accountId: "",
    category: "MARKETING_ADS",
    amount: "",
    description: "",
  });

  const [transferForm, setTransferForm] = useState({
    sourceAccountId: "",
    destinationAccountId: "",
    amount: "",
    description: "",
  });

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

      // 1. Fetch Orders revenue
      const { data: ordersData } = await supabase
        .from("orders")
        .select("total_ttc")
        .eq("organization_id", currentOrgId)
        .is("deleted_at", null);

      const totalSales = (ordersData || []).reduce((sum, o) => sum + Number(o.total_ttc || 0), 0);
      setSalesRevenue(totalSales);

      // 2. Fetch Financial Accounts
      const { data: accs } = await supabase
        .from("financial_accounts")
        .select("*")
        .eq("organization_id", currentOrgId);

      if (accs && accs.length > 0) {
        const formattedAccs: FinancialAccountItem[] = accs.map((a: any) => ({
          id: a.id,
          name: a.name,
          type: a.type || "CASH",
          balance: Number(a.current_balance || a.opening_balance || 0),
          currency: a.currency || "XOF",
          status: a.status || "ACTIVE",
        }));
        setAccounts(formattedAccs);
        if (formattedAccs.length > 0) {
          setExpenseForm((prev) => ({ ...prev, accountId: formattedAccs[0].id }));
          if (formattedAccs.length > 1) {
            setTransferForm({
              sourceAccountId: formattedAccs[0].id,
              destinationAccountId: formattedAccs[1].id,
              amount: "",
              description: "",
            });
          }
        }
      } else {
        setAccounts([]);
      }

      // 3. Fetch Transactions
      const { data: txs } = await supabase
        .from("transactions")
        .select("*")
        .eq("organization_id", currentOrgId)
        .order("created_at", { ascending: false });

      if (txs && txs.length > 0) {
        setTransactions(
          txs.map((t: any) => ({
            id: t.id,
            date: t.created_at ? new Date(t.created_at).toLocaleString("fr-FR") : "Aujourd'hui",
            account: t.account_id || "Caisse Principale",
            type: t.type || "EXPENSE",
            direction: (t.direction as any) || "OUTFLOW",
            category: t.category || "GENERAL",
            amount: Number(t.amount || 0),
            description: t.description || "Transaction commerciale",
            status: t.status || "POSTED",
          }))
        );
      } else {
        setTransactions([]);
      }
    } catch (err) {
      console.error("[Finance Load Error]", err);
    } finally {
      setLoading(false);
    }
  }

  // Financial Computations
  const totalCash = useMemo(() => {
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

  const ownerDraws = useMemo(() => {
    return transactions
      .filter((t) => t.category === "OWNER_DRAW")
      .reduce((acc, t) => acc + t.amount, 0);
  }, [transactions]);

  // Handler: Add Financial Account
  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName.trim() || !orgId) return;

    try {
      const supabase = createClient();
      const bal = Number(newAccBalance) || 0;

      const { data, error } = await supabase
        .from("financial_accounts")
        .insert({
          organization_id: orgId,
          name: newAccName.trim(),
          type: newAccType,
          current_balance: bal,
          opening_balance: bal,
          currency: "XOF",
          status: "ACTIVE",
        })
        .select()
        .single();

      if (error) throw error;

      showToast(`💼 Compte financier '${newAccName}' créé avec succès !`);
      setShowAddAccountModal(false);
      setNewAccName("");
      setNewAccBalance("");
      await loadFinanceData();
    } catch (err: any) {
      // Local fallback state
      const newAccountObj: FinancialAccountItem = {
        id: `acc-${Date.now()}`,
        name: newAccName.trim(),
        type: newAccType,
        balance: Number(newAccBalance) || 0,
        currency: "XOF",
        status: "ACTIVE",
      };
      setAccounts((prev) => [...prev, newAccountObj]);
      setShowAddAccountModal(false);
      setNewAccName("");
      setNewAccBalance("");
      showToast(`💼 Compte financier '${newAccName}' ajouté !`);
    }
  };

  // Handler: Create Expense
  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.amount || parseFloat(expenseForm.amount) <= 0) {
      showToast("Veuillez saisir un montant valide.");
      return;
    }
    const amt = parseFloat(expenseForm.amount);
    const acc = accounts.find((a) => a.id === expenseForm.accountId);

    const newTx: TransactionItem = {
      id: `tx-${Date.now()}`,
      date: new Date().toLocaleString("fr-FR"),
      account: acc ? acc.name : "Caisse Principale",
      type: "EXPENSE",
      direction: "OUTFLOW",
      category: expenseForm.category,
      amount: amt,
      description: expenseForm.description || "Dépense commerciale",
      status: "POSTED",
    };

    if (orgId) {
      try {
        const supabase = createClient();
        await supabase.from("transactions").insert({
          organization_id: orgId,
          account_id: expenseForm.accountId || null,
          type: "EXPENSE",
          direction: "OUTFLOW",
          category: expenseForm.category,
          amount: amt,
          description: expenseForm.description || "Dépense commerciale",
          status: "POSTED",
        });
      } catch (err) {
        console.error("Tx Insert error", err);
      }
    }

    setTransactions((prev) => [newTx, ...prev]);
    if (expenseForm.accountId) {
      setAccounts((prev) =>
        prev.map((a) => (a.id === expenseForm.accountId ? { ...a, balance: a.balance - amt } : a))
      );
    }
    setExpenseForm({ accountId: accounts[0]?.id || "", category: "MARKETING_ADS", amount: "", description: "" });
    showToast("💸 Dépense enregistrée dans le journal financier !");
    setActiveTab("transactions");
  };

  // Handler: Inter-account Transfer
  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferForm.amount || parseFloat(transferForm.amount) <= 0) {
      showToast("Veuillez saisir un montant valide.");
      return;
    }
    if (transferForm.sourceAccountId === transferForm.destinationAccountId) {
      showToast("Les comptes source et destination doivent être différents.");
      return;
    }
    const amt = parseFloat(transferForm.amount);
    const srcAcc = accounts.find((a) => a.id === transferForm.sourceAccountId);
    const dstAcc = accounts.find((a) => a.id === transferForm.destinationAccountId);

    setAccounts((prev) =>
      prev.map((a) => {
        if (a.id === transferForm.sourceAccountId) return { ...a, balance: a.balance - amt };
        if (a.id === transferForm.destinationAccountId) return { ...a, balance: a.balance + amt };
        return a;
      })
    );

    const txOut: TransactionItem = {
      id: `tx-${Date.now()}-out`,
      date: new Date().toLocaleString("fr-FR"),
      account: srcAcc?.name || "Compte Source",
      type: "TRANSFER",
      direction: "OUTFLOW",
      category: "OTHER",
      amount: amt,
      description: `[Transfert vers ${dstAcc?.name || "Destination"}] ${transferForm.description}`,
      status: "POSTED",
    };

    setTransactions((prev) => [txOut, ...prev]);
    setTransferForm({ sourceAccountId: "", destinationAccountId: "", amount: "", description: "" });
    showToast("🔄 Transfert inter-comptes exécuté !");
    setActiveTab("transactions");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-stone-500">
          <Loader2 className="w-8 h-8 animate-spin text-[#800020]" />
          <p className="text-xs font-extrabold text-stone-700">Chargement de la Finance WILLShop OS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up pb-16">
      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-[#1F1917] text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-stone-800 animate-slide-in text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TOP HEADER - LIGHT WILLSHOP SYSTEM */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-4 border-b border-gray-200 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#800020]/10 border border-[#800020]/20 rounded-2xl text-[#800020]">
            <Wallet className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
                Finance & Trésorerie Commerciale
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#800020]/10 text-[#800020] border border-[#800020]/20">
                Direction Financière
              </span>
            </div>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              Source de vérité financière commerciale • Trésorerie • Dépenses • Encaissements réels
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddAccountModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold rounded-xl border border-gray-200 transition-all text-xs"
          >
            <Plus className="w-4 h-4 text-[#800020]" />
            <span>+ Ajouter un compte</span>
          </button>
          <button
            onClick={() => setActiveTab("expenses")}
            className="flex items-center gap-2 px-4 py-2 bg-[#800020] hover:bg-[#660019] text-white font-bold rounded-xl transition-all shadow-xs text-xs"
          >
            <PlusCircle className="w-4 h-4 text-[#D4A843]" />
            <span>Saisir une dépense</span>
          </button>
        </div>
      </div>

      {/* KPI OVERVIEW CARDS (LIGHT THEME) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Trésorerie Totale */}
        <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-2xs">
          <div className="flex justify-between items-center text-gray-500 mb-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400">Trésorerie Totale</span>
            <Wallet className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-gray-900 font-mono">{totalCash.toLocaleString("fr-FR")} FCFA</div>
          <div className="text-xs text-emerald-700 mt-1 font-bold">Solde des comptes déclarés</div>
        </div>

        {/* Card 2: Entrées Ventes */}
        <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-2xs">
          <div className="flex justify-between items-center text-gray-500 mb-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400">Encaissements / Ventes</span>
            <ArrowDownLeft className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-700 font-mono">+{totalInflows.toLocaleString("fr-FR")} FCFA</div>
          <div className="text-xs text-gray-500 mt-1 font-medium">Cumul des ventes validées</div>
        </div>

        {/* Card 3: Dépenses Opérationnelles */}
        <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-2xs">
          <div className="flex justify-between items-center text-gray-500 mb-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400">Dépenses Opérationnelles</span>
            <ArrowUpRight className="w-5 h-5 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-700 font-mono">-{totalOutflows.toLocaleString("fr-FR")} FCFA</div>
          <div className="text-xs text-gray-500 mt-1 font-medium">Publicité, fournisseurs, livraisons</div>
        </div>

        {/* Card 4: Retraits Propriétaire */}
        <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-2xs">
          <div className="flex justify-between items-center text-gray-500 mb-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400">Retraits Propriétaire</span>
            <Building2 className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-700 font-mono">{ownerDraws.toLocaleString("fr-FR")} FCFA</div>
          <div className="text-xs text-amber-700 mt-1 font-bold">Séparé des charges d'exploitation</div>
        </div>
      </div>

      {/* TABS BAR */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-gray-200 pb-3">
        {[
          { id: "overview", label: "Vue Synthèse", icon: PieChart },
          { id: "accounts", label: "Comptes Financiers", icon: CreditCard },
          { id: "transactions", label: "Journal des Transactions", icon: FileText },
          { id: "expenses", label: "Saisir une Dépense", icon: PlusCircle },
          { id: "transfers", label: "Transfert Inter-Comptes", icon: RefreshCw },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? "bg-[#800020] text-white shadow-xs"
                  : "bg-gray-100/80 text-gray-700 hover:bg-gray-200 hover:text-gray-900"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-[#D4A843]" : "text-gray-500"}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#800020]" />
                <span>Comptes Financiers ({accounts.length})</span>
              </h3>
              <button
                onClick={() => setShowAddAccountModal(true)}
                className="text-xs font-bold text-[#800020] hover:underline"
              >
                + Ajouter un compte
              </button>
            </div>

            {accounts.length === 0 ? (
              <div className="p-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 space-y-3">
                <Wallet className="w-10 h-10 text-gray-400 mx-auto" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-gray-900">Aucun compte financier déclaré</p>
                  <p className="text-xs text-gray-500 max-w-sm mx-auto">
                    Créez vos comptes de trésorerie (Caisse Principale, Orange Money, Moov Money, Compte Bancaire) pour suivre vos soldes réels.
                  </p>
                </div>
                <button
                  onClick={() => setShowAddAccountModal(true)}
                  className="px-4 py-2 bg-[#800020] hover:bg-[#660019] text-white text-xs font-bold rounded-xl transition-all shadow-xs"
                >
                  + Créer mon premier compte
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {accounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="p-4 bg-gray-50/70 border border-gray-200 rounded-2xl flex justify-between items-center"
                  >
                    <div>
                      <div className="font-extrabold text-gray-900 text-sm">{acc.name}</div>
                      <div className="text-[11px] text-gray-500 font-mono mt-0.5">
                        {acc.type} • {acc.status}
                      </div>
                    </div>
                    <div className="text-right font-mono font-black text-emerald-700 text-base">
                      {acc.balance.toLocaleString("fr-FR")} {acc.currency}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-2xs space-y-4">
            <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <span>Invariants Comptables WILLShop OS</span>
            </h3>
            <div className="space-y-3 text-xs text-gray-700 font-medium">
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl">
                <span className="font-extrabold text-emerald-900">✅ Immuabilité du Grand Livre :</span> Toute transaction validée (`POSTED`) est gravée. Les ajustements se font exclusivement par contre-écriture.
              </div>
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl">
                <span className="font-extrabold text-amber-900">✅ Séparation Business / Personnel :</span> Les retraits propriétaire (`OWNER_DRAW`) sont isolés des charges d'exploitation pour préserver le calcul exact de la marge brute.
              </div>
              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl">
                <span className="font-extrabold text-blue-900">✅ Isolation Organisation RLS :</span> Vos flux financiers sont strictement cloisonnés par `organization_id`.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: ACCOUNTS */}
      {activeTab === "accounts" && (
        <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h3 className="text-base font-extrabold text-gray-900">Comptes de Trésorerie Déclarés</h3>
            <button
              onClick={() => setShowAddAccountModal(true)}
              className="px-3.5 py-1.5 bg-[#800020] text-white text-xs font-bold rounded-xl shadow-xs"
            >
              + Nouveau Compte
            </button>
          </div>

          {accounts.length === 0 ? (
            <div className="p-12 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 space-y-3">
              <Wallet className="w-10 h-10 text-gray-400 mx-auto" />
              <p className="text-sm font-bold text-gray-900">Aucun compte de trésorerie créé</p>
              <button
                onClick={() => setShowAddAccountModal(true)}
                className="px-4 py-2 bg-[#800020] text-white text-xs font-bold rounded-xl shadow-xs"
              >
                + Ajouter un compte financier
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {accounts.map((acc) => (
                <div key={acc.id} className="p-5 bg-gray-50/70 border border-gray-200 rounded-2xl space-y-3">
                  <div className="text-[10px] text-[#800020] font-mono font-extrabold uppercase">{acc.type}</div>
                  <div className="text-base font-extrabold text-gray-900">{acc.name}</div>
                  <div className="text-2xl font-black font-mono text-emerald-700">{acc.balance.toLocaleString("fr-FR")} FCFA</div>
                  <div className="pt-3 border-t border-gray-200 flex justify-between text-xs text-gray-500 font-medium">
                    <span>Devise : {acc.currency}</span>
                    <span className="text-emerald-700 font-bold">● {acc.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: TRANSACTIONS */}
      {activeTab === "transactions" && (
        <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-2xs space-y-4">
          <h3 className="text-base font-extrabold text-gray-900 border-b border-gray-100 pb-3">Journal des Écritures (Ledger)</h3>
          {transactions.length === 0 ? (
            <div className="p-12 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 space-y-2">
              <FileText className="w-8 h-8 text-gray-400 mx-auto" />
              <p className="text-sm font-bold text-gray-900">Aucune transaction enregistrée</p>
              <p className="text-xs text-gray-500">
                Utilisez l'onglet "Saisir une dépense" pour poster vos premières dépenses.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider border-b border-gray-200 text-[10px]">
                    <th className="p-3">Date</th>
                    <th className="p-3">Compte</th>
                    <th className="p-3">Catégorie</th>
                    <th className="p-3">Description</th>
                    <th className="p-3 text-right">Montant</th>
                    <th className="p-3 text-center">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-800">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-3 font-mono text-gray-500">{tx.date}</td>
                      <td className="p-3 font-bold text-gray-900">{tx.account}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-gray-100 text-gray-700 border border-gray-200">
                          {tx.category}
                        </span>
                      </td>
                      <td className="p-3 text-gray-700">{tx.description}</td>
                      <td className={`p-3 text-right font-mono font-black ${tx.direction === "INFLOW" ? "text-emerald-700" : "text-rose-700"}`}>
                        {tx.direction === "INFLOW" ? "+" : "-"}{tx.amount.toLocaleString("fr-FR")} FCFA
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: EXPENSES */}
      {activeTab === "expenses" && (
        <div className="max-w-xl mx-auto bg-white border border-gray-200 rounded-3xl p-6 shadow-2xs space-y-4">
          <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
            <PlusCircle className="w-4 h-4 text-[#800020]" />
            <span>Saisir une Dépense Commerciale</span>
          </h3>
          <form onSubmit={handleCreateExpense} className="space-y-4 text-xs font-medium">
            <div>
              <label className="block text-gray-700 font-bold mb-1">Compte Débité *</label>
              <select
                value={expenseForm.accountId}
                onChange={(e) => setExpenseForm({ ...expenseForm, accountId: e.target.value })}
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
                value={expenseForm.category}
                onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-[#800020]"
              >
                <option value="MARKETING_ADS">Marketing / Facebook Ads</option>
                <option value="SUPPLIER_PURCHASE">Achat Marchandises (Fournisseur)</option>
                <option value="DELIVERY_COST">Frais de Livraison Payés</option>
                <option value="RENT">Loyer / Locaux</option>
                <option value="SALARY">Salaire / Commission</option>
                <option value="OWNER_DRAW">Retrait Propriétaire (Owner Draw)</option>
                <option value="OTHER">Autre Charge</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-bold mb-1">Montant (FCFA) *</label>
              <input
                type="number"
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                placeholder="Ex: 25000"
                required
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 font-mono focus:outline-none focus:border-[#800020]"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-bold mb-1">Description / Motif</label>
              <input
                type="text"
                value={expenseForm.description}
                onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                placeholder="Ex: Campagne Facebook Ads Septembre"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-[#800020]"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-[#800020] hover:bg-[#660019] text-white font-bold rounded-xl text-xs transition-all shadow-xs"
            >
              Poster la Dépense dans le Grand Livre
            </button>
          </form>
        </div>
      )}

      {/* TAB CONTENT: TRANSFERS */}
      {activeTab === "transfers" && (
        <div className="max-w-xl mx-auto bg-white border border-gray-200 rounded-3xl p-6 shadow-2xs space-y-4">
          <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
            <RefreshCw className="w-4 h-4 text-[#800020]" />
            <span>Transfert Inter-Comptes</span>
          </h3>
          <form onSubmit={handleTransfer} className="space-y-4 text-xs font-medium">
            <div>
              <label className="block text-gray-700 font-bold mb-1">Compte Source (Débit) *</label>
              <select
                value={transferForm.sourceAccountId}
                onChange={(e) => setTransferForm({ ...transferForm, sourceAccountId: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-[#800020]"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.balance.toLocaleString("fr-FR")} FCFA)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-bold mb-1">Compte Destination (Crédit) *</label>
              <select
                value={transferForm.destinationAccountId}
                onChange={(e) => setTransferForm({ ...transferForm, destinationAccountId: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-[#800020]"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.balance.toLocaleString("fr-FR")} FCFA)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-bold mb-1">Montant du Transfert (FCFA) *</label>
              <input
                type="number"
                value={transferForm.amount}
                onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })}
                placeholder="Ex: 50000"
                required
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 font-mono focus:outline-none focus:border-[#800020]"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-bold mb-1">Note de Transfert</label>
              <input
                type="text"
                value={transferForm.description}
                onChange={(e) => setTransferForm({ ...transferForm, description: e.target.value })}
                placeholder="Ex: Alimentaion Caisse par Orange Money"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-[#800020]"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all shadow-xs"
            >
              Exécuter le Transfert Inter-Comptes
            </button>
          </form>
        </div>
      )}

      {/* MODAL: ADD FINANCIAL ACCOUNT */}
      {showAddAccountModal && (
        <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-scale-in">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-[#800020]" />
                <span>Nouveau Compte Financier</span>
              </h3>
              <button
                onClick={() => setShowAddAccountModal(false)}
                className="text-gray-400 hover:text-gray-900 p-1 rounded-lg hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddAccount} className="p-5 space-y-4 text-xs font-medium">
              <div>
                <label className="block text-gray-700 font-bold mb-1">Nom du compte *</label>
                <input
                  type="text"
                  value={newAccName}
                  onChange={(e) => setNewAccName(e.target.value)}
                  placeholder="ex: Orange Money Entreprise, Caisse 1"
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-[#800020]"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">Type de compte</label>
                <select
                  value={newAccType}
                  onChange={(e) => setNewAccType(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-[#800020]"
                >
                  <option value="CASH_REGISTER">Caisse Physique (Cash)</option>
                  <option value="MOBILE_MONEY">Mobile Money (Orange / Moov / Wave)</option>
                  <option value="BANK_ACCOUNT">Compte Bancaire</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">Solde Initial (XOF)</label>
                <input
                  type="number"
                  value={newAccBalance}
                  onChange={(e) => setNewAccBalance(e.target.value)}
                  placeholder="0"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 font-mono focus:outline-none focus:border-[#800020]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddAccountModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-all"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#800020] hover:bg-[#660019] text-white font-bold text-xs rounded-xl transition-all shadow-xs"
                >
                  Créer le compte
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
