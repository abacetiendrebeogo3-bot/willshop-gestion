"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Bot,
  X,
  Send,
  Loader2,
  Sparkles,
  Check,
  Copy,
  AlertTriangle,
  ShieldAlert,
  User,
  Crown,
  Truck,
  Briefcase,
  ChevronRight,
} from "lucide-react";
import { createClient } from "@/src/infrastructure/supabase/client";

interface Message {
  role: "user" | "assistant";
  content: string;
  permissionLevel?: "GREEN" | "YELLOW" | "RED";
  requiresHumanConfirmation?: boolean;
  proposedAction?: any;
  recommendations?: any[];
  evidence?: string[];
}

export function FloatingAIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [userRole, setUserRole] = useState<string>("COMMERCIAL");
  const [userName, setUserName] = useState<string>("");
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Bonjour ! Je suis votre assistant WILLShop. Que puis-je faire pour vous aujourd'hui ?",
      permissionLevel: "GREEN",
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load User Role on mount
  useEffect(() => {
    loadUserContext();
  }, []);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  async function loadUserContext() {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: roleData } = await supabase
        .from("user_organization_roles")
        .select("role, profiles(first_name, last_name)")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .limit(1);

      if (roleData && roleData.length > 0) {
        const r = roleData[0].role;
        setUserRole(r || "COMMERCIAL");
        const prof = (roleData[0] as any).profiles;
        if (prof?.first_name) {
          setUserName(prof.first_name);
        }
      }
    } catch (_e) {
      // Default to COMMERCIAL
    }
  }

  const handleSend = async (textToSend?: string) => {
    const activeQuery = textToSend || query;
    if (!activeQuery.trim() || isLoading) return;

    const userText = activeQuery.trim();
    setQuery("");

    // Add user message
    setMessages((prev) => [...prev, { role: "user", content: userText }]);
    setIsLoading(true);

    try {
      const res = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userText }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `⚠️ ${data.error || "Impossible d'obtenir une réponse d'assistance."}`,
            permissionLevel: "RED",
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.response || "Aucune réponse retournée.",
            permissionLevel: data.permissionLevel || "GREEN",
            requiresHumanConfirmation: data.requiresHumanConfirmation,
            proposedAction: data.proposedAction,
            recommendations: data.recommendations,
            evidence: data.evidence,
          },
        ]);
      }
    } catch (_err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Erreur de connexion avec le service assistant.",
          permissionLevel: "RED",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2500);
  };

  const isCeoRole = userRole === "CEO" || userRole === "OWNER" || userRole === "ADMIN";
  const isDriverRole = userRole === "DRIVER";

  const suggestionChips = isCeoRole
    ? ["• Synthèse d'hier", "• Alertes prioritaires", "• Commandes en attente", "• Livraisons en difficulté"]
    : isDriverRole
    ? ["• Mes livraisons", "• Prochaine livraison", "• Échecs de livraison"]
    : ["• Mes actions", "• Mes clients", "• Mes commandes", "• Mes relances", "• Prépare-moi une réponse"];

  return (
    <>
      {/* ── FLOATING BUTTON ───────────────────────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative w-14 h-14 rounded-full bg-[#800020] text-white shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-200 flex items-center justify-center border-2 border-amber-300 group"
          title="Assistant Commercial WILLShop IA"
        >
          <Bot className="w-7 h-7 text-white group-hover:rotate-12 transition-transform" />
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 border-2 border-white animate-pulse" />
        </button>
      </div>

      {/* ── ASSISTANT MODAL / DRAWER ──────────────────────────────────────── */}
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center sm:items-center p-3 sm:p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-[#EBE5DA] overflow-hidden flex flex-col max-h-[85vh] h-[600px]">

            {/* Modal Header */}
            <div className="px-5 py-4 bg-[#800020] text-white flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-white/10 flex items-center justify-center text-amber-300">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm tracking-tight flex items-center gap-1.5">
                    <span>Assistant WILLShop IA</span>
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  </h3>
                  <div className="flex items-center gap-1.5 text-[11px] text-white/80 font-medium">
                    {isCeoRole ? (
                      <span className="flex items-center gap-1 text-amber-200">
                        <Crown className="w-3 h-3" /> CEO / Direction
                      </span>
                    ) : isDriverRole ? (
                      <span className="flex items-center gap-1 text-emerald-200">
                        <Truck className="w-3 h-3" /> Mode Livreur
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-blue-200">
                        <Briefcase className="w-3 h-3" /> Mode Commercial
                      </span>
                    )}
                    {userName && <span>• {userName}</span>}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conversation Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FAF8F5]">
              {messages.map((m, idx) => (
                <div key={idx} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[88%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                    m.role === "user"
                      ? "bg-[#1F1917] text-white font-medium rounded-br-none"
                      : "bg-white text-[#1F1917] border border-[#EBE5DA] shadow-2xs rounded-bl-none font-medium"
                  }`}>
                    {/* Header Tag for Assistant Response */}
                    {m.role === "assistant" && (
                      <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-stone-100">
                        <span className="text-[10px] font-black text-[#800020] uppercase tracking-wider flex items-center gap-1">
                          <Bot className="w-3 h-3 text-[#800020]" />
                          Assistant WILLShop
                        </span>

                        {m.permissionLevel && (
                          <span className={`px-2 py-0.5 rounded-md font-extrabold text-[9px] uppercase ${
                            m.permissionLevel === "GREEN"
                              ? "bg-emerald-100 text-emerald-800"
                              : m.permissionLevel === "YELLOW"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                          }`}>
                            {m.permissionLevel === "GREEN" ? "Lecture & Analyse" : m.permissionLevel === "YELLOW" ? "Confirmation Humaine" : "Action Bloquée"}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Main Content */}
                    <div className="whitespace-pre-wrap">{m.content}</div>

                    {/* Proposed Action Payload (YELLOW confirmation) */}
                    {m.proposedAction?.type === "PREPARE_MESSAGE" && (
                      <div className="mt-3 p-3 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-bold text-amber-900">
                          <span>Message recommandé à envoyer</span>
                          <button
                            onClick={() => copyToClipboard(m.proposedAction.payload.text, idx)}
                            className="flex items-center gap-1 text-[#800020] hover:underline"
                          >
                            {copiedIndex === idx ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedIndex === idx ? "Copié !" : "Copier"}</span>
                          </button>
                        </div>
                        <p className="text-xs text-stone-800 italic bg-white p-2.5 rounded-lg border border-amber-100">
                          {m.proposedAction.payload.text}
                        </p>
                      </div>
                    )}

                    {/* Recommendations List */}
                    {m.recommendations && m.recommendations.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-stone-100 space-y-1.5">
                        <p className="text-[10px] font-black uppercase text-[#800020]">Recommandations structurées :</p>
                        {m.recommendations.map((rec: any, rIdx: number) => (
                          <div key={rIdx} className="p-2 bg-stone-50 rounded-lg text-[11px] space-y-1">
                            <span className="font-bold text-[#1F1917] capitalize">• {rec.category} :</span>
                            <p className="text-stone-600">{rec.reason}</p>
                            <p className="font-semibold text-emerald-700">👉 {rec.proposedAction}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Evidence Provenance Points */}
                    {m.evidence && m.evidence.length > 0 && (
                      <div className="mt-2 text-[10px] text-stone-400 font-mono">
                        Source : {m.evidence.slice(0, 2).join(" | ")}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex items-center gap-2 p-3 bg-white rounded-2xl border border-[#EBE5DA] w-48 shadow-2xs">
                  <Loader2 className="w-4 h-4 animate-spin text-[#800020]" />
                  <span className="text-xs font-bold text-stone-500">Analyse en cours...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Suggestion Chips */}
            <div className="p-3 bg-white border-t border-[#EBE5DA] space-y-2.5">
              <div className="flex flex-wrap gap-1.5">
                {suggestionChips.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => handleSend(chip.replace(/^•\s*/, ""))}
                    disabled={isLoading}
                    className="px-2.5 py-1 bg-[#FAF8F5] border border-[#EBE5DA] hover:border-[#800020]/40 hover:bg-[#800020]/5 rounded-xl text-[11px] font-bold text-[#1F1917] transition-all shadow-2xs"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Input Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  placeholder="Posez votre question à l'assistant..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  disabled={isLoading}
                  className="flex-1 bg-[#FAF8F5] border border-[#EBE5DA] rounded-2xl px-4 py-2.5 text-xs text-[#1F1917] placeholder:text-stone-400 outline-none focus:border-[#800020]/50 transition-colors shadow-2xs"
                />
                <button
                  type="submit"
                  disabled={isLoading || !query.trim()}
                  className="w-10 h-10 rounded-2xl bg-[#800020] text-white flex items-center justify-center disabled:opacity-40 hover:bg-[#660019] transition-colors shadow-2xs shrink-0"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
