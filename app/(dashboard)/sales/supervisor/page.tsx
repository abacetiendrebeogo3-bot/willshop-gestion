"use client";

import React, { useCallback, useEffect, useState } from "react";
import { PageTransition } from "@/components/animations/PageTransition";
import {
  Radar,
  RefreshCw,
  MessageCircle,
  Copy,
  Check,
  Clock,
  EyeOff,
  Sparkles,
  Loader2,
  AlertTriangle,
  Flame,
  BellRing,
} from "lucide-react";

type Priority = "URGENT" | "HAUTE" | "NORMALE";

interface Alert {
  conversationId: string;
  customerName: string;
  customerPhone: string;
  type: string;
  priority: Priority;
  title: string;
  reason: string;
  lastClientMessage: string | null;
  sinceMinutes: number;
  suggestedMessage: string;
  whatsappLink: string;
}

interface ApiResponse {
  generatedAt: string;
  conversationsAnalyzed: number;
  summary: { total: number; urgent: number; haute: number; normale: number };
  alerts: Alert[];
  aiAvailable: boolean;
}

const PRIORITY_STYLE: Record<Priority, { label: string; dot: string; ring: string; chip: string }> = {
  URGENT: { label: "Urgent", dot: "bg-red-500", ring: "border-red-200", chip: "bg-red-50 text-red-700" },
  HAUTE: { label: "Important", dot: "bg-orange-400", ring: "border-orange-200", chip: "bg-orange-50 text-orange-700" },
  NORMALE: { label: "À faire", dot: "bg-gold", ring: "border-border", chip: "bg-gold-light text-gold-hover" },
};

function waLink(phone: string, text: string) {
  return `https://wa.me/${(phone || "").replace(/[^\d]/g, "")}?text=${encodeURIComponent(text)}`;
}

export default function SupervisorPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | Priority>("ALL");
  const [drafts, setDrafts] = useState<Record<string, { message: string; summary?: string }>>({});
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/supervisor/alerts", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erreur de chargement");
      setData(json);
      setHidden(new Set());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 2 * 60 * 1000); // rafraîchit toutes les 2 min
    return () => clearInterval(t);
  }, [load]);

  const act = async (conversationId: string, action: "done" | "snooze" | "ignore", hours?: number) => {
    setHidden((h) => new Set(h).add(conversationId));
    await fetch("/api/supervisor/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, action, hours }),
    }).catch(() => {});
  };

  const askAi = async (a: Alert) => {
    setAiLoading(a.conversationId);
    try {
      const res = await fetch("/api/supervisor/ai-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: a.conversationId, alertType: a.type, reason: a.reason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      if (json.message) {
        setDrafts((d) => ({ ...d, [a.conversationId]: { message: json.message, summary: json.summary } }));
      }
    } catch (e: any) {
      alert(`IA indisponible : ${e.message}`);
    } finally {
      setAiLoading(null);
    }
  };

  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch {}
  };

  const alerts = (data?.alerts || []).filter(
    (a) => !hidden.has(a.conversationId) && (filter === "ALL" || a.priority === filter)
  );

  const since = (m: number) => (m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)} j`);

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl px-4 py-6 space-y-5">
        {/* En-tête */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-bordeaux flex items-center justify-center shadow-sm">
              <Radar className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Superviseur</h1>
              <p className="text-sm text-foreground/60">Qui répondre et qui relancer, maintenant.</p>
            </div>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm font-medium hover:bg-background"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Actualiser
          </button>
        </div>

        {/* Compteurs */}
        {data && (
          <div className="grid grid-cols-3 gap-3">
            {([
              ["URGENT", data.summary.urgent, Flame],
              ["HAUTE", data.summary.haute, BellRing],
              ["NORMALE", data.summary.normale, Clock],
            ] as const).map(([p, n, Icon]) => (
              <button
                key={p}
                onClick={() => setFilter(filter === p ? "ALL" : p)}
                className={`rounded-2xl border bg-white p-3 text-left transition ${
                  filter === p ? "border-bordeaux ring-2 ring-bordeaux/15" : "border-border"
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-medium text-foreground/60">
                  <Icon className="h-3.5 w-3.5" /> {PRIORITY_STYLE[p].label}
                </div>
                <div className="mt-1 text-2xl font-bold text-foreground">{n}</div>
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4" /> {error}
          </div>
        )}

        {loading && !data && (
          <div className="flex items-center justify-center py-16 text-foreground/50">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}

        {data && alerts.length === 0 && !loading && (
          <div className="rounded-2xl border border-border bg-white p-10 text-center">
            <Check className="mx-auto h-8 w-8 text-emerald-500" />
            <p className="mt-3 font-semibold">Tout est à jour 👏</p>
            <p className="text-sm text-foreground/60">
              {data.conversationsAnalyzed} conversations analysées, personne n'attend.
            </p>
          </div>
        )}

        {/* Alertes */}
        <div className="space-y-3">
          {alerts.map((a) => {
            const st = PRIORITY_STYLE[a.priority];
            const draft = drafts[a.conversationId];
            const message = draft?.message || a.suggestedMessage;
            return (
              <div key={a.conversationId} className={`rounded-2xl border ${st.ring} bg-white p-4 shadow-sm`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${st.dot}`} />
                      <span className="truncate font-semibold text-foreground">{a.customerName}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-foreground/50">{a.customerPhone}</div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.chip}`}>{a.title}</span>
                    <span className="flex items-center gap-1 text-xs text-foreground/50">
                      <Clock className="h-3 w-3" /> {since(a.sinceMinutes)}
                    </span>
                  </div>
                </div>

                <p className="mt-3 text-sm text-foreground/80">{a.reason}</p>

                {a.lastClientMessage && (
                  <div className="mt-2 rounded-xl bg-background px-3 py-2 text-sm text-foreground/70">
                    <span className="text-xs font-medium text-foreground/50">Dernier message client : </span>
                    « {a.lastClientMessage.slice(0, 160)} »
                  </div>
                )}

                {draft?.summary && (
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-bordeaux">
                    <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {draft.summary}
                  </p>
                )}

                <div className="mt-3 rounded-xl border border-gold/40 bg-gold-light px-3 py-2.5 text-sm text-foreground">
                  {message}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={draft ? waLink(a.customerPhone, message) : a.whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => act(a.conversationId, "done")}
                    className="flex items-center gap-1.5 rounded-xl bg-[#25D366] px-3.5 py-2 text-sm font-semibold text-white hover:opacity-90"
                  >
                    <MessageCircle className="h-4 w-4" /> Écrire
                  </a>
                  <button
                    onClick={() => copy(a.conversationId, message)}
                    className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm hover:bg-background"
                  >
                    {copied === a.conversationId ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    Copier
                  </button>
                  {data?.aiAvailable && (
                    <button
                      onClick={() => askAi(a)}
                      disabled={aiLoading === a.conversationId}
                      className="flex items-center gap-1.5 rounded-xl border border-bordeaux/30 px-3 py-2 text-sm text-bordeaux hover:bg-bordeaux-light disabled:opacity-50"
                    >
                      {aiLoading === a.conversationId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      Rédiger avec l'IA
                    </button>
                  )}
                  <button
                    onClick={() => act(a.conversationId, "snooze", 3)}
                    className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-foreground/60 hover:bg-background"
                  >
                    <Clock className="h-4 w-4" /> Plus tard
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Ce contact n'est pas un client (perso) ? Il ne sera plus jamais signalé.")) {
                        act(a.conversationId, "ignore");
                      }
                    }}
                    className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-foreground/40 hover:bg-background"
                  >
                    <EyeOff className="h-4 w-4" /> Perso
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {data && (
          <p className="pt-2 text-center text-xs text-foreground/40">
            {data.conversationsAnalyzed} conversations analysées · mis à jour à{" "}
            {new Date(data.generatedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>
    </PageTransition>
  );
}
