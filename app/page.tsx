"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/src/infrastructure/supabase/client";
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  MessageSquare,
  Package,
  Truck,
  Wallet,
  BrainCircuit,
  BarChart3,
  CheckCircle2,
  Zap
} from "lucide-react";

export default function LandingPage() {
  useEffect(() => {
    async function checkAuthAndRedirect() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: roles } = await supabase
            .from("user_organization_roles")
            .select("role")
            .eq("user_id", user.id)
            .is("deleted_at", null)
            .limit(1);

          const userRole = roles && roles.length > 0 ? roles[0].role : "COMMERCIAL";
          if (userRole === "COMMERCIAL" || userRole === "SALES") {
            window.location.href = "/sales/my-day";
          } else if (userRole === "LIVREUR" || userRole === "DRIVER") {
            window.location.href = "/delivery/my-deliveries";
          } else {
            window.location.href = "/ceo";
          }
        } else {
          // If launched as standalone PWA app on mobile phone
          const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any)?.standalone;
          if (isStandalone) {
            window.location.href = "/login";
          }
        }
      } catch (_e) {}
    }
    checkAuthAndRedirect();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/20 selection:text-primary">
      {/* Top Navigation */}
      <header className="border-b border-border/50 backdrop-blur-xl bg-background/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-purple-500 flex items-center justify-center font-black text-lg text-white shadow-lg shadow-primary/20">
              W
            </div>
            <span className="font-bold text-lg tracking-tight">WILLShop OS</span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
            >
              Se connecter
            </Link>
            <Link
              href="/signup"
              className="text-sm font-medium px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-all shadow-md shadow-primary/20 flex items-center gap-1.5"
            >
              Commencer gratuitement <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative pt-20 pb-16 px-6 max-w-5xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary">
            <Sparkles className="w-3.5 h-3.5" /> Système d'Exploitation Business Tout-en-Un
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight">
            <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              WILLShop OS
            </span>
            <br />
            <span className="bg-gradient-to-r from-primary via-purple-400 to-indigo-400 bg-clip-text text-transparent">
              Le système d'exploitation intelligent de votre business.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Gérez vos ventes, WhatsApp, stock, livraisons, finances et intelligence business depuis un seul espace unifié.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href="/signup"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-primary text-primary-foreground font-semibold text-base shadow-xl shadow-primary/25 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              Commencer gratuitement <ArrowRight className="w-5 h-5" />
            </Link>

            <Link
              href="/login"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-secondary hover:bg-secondary/80 border border-border text-foreground font-semibold text-base transition-all flex items-center justify-center gap-2"
            >
              Se connecter
            </Link>
          </div>

          {/* Key Trust Highlights */}
          <div className="pt-12 grid grid-cols-2 md:grid-cols-4 gap-4 text-left">
            <div className="p-4 rounded-2xl bg-card/60 border border-border/60 backdrop-blur-sm space-y-2">
              <MessageSquare className="w-5 h-5 text-emerald-400" />
              <div className="font-semibold text-sm">WhatsApp Business IA</div>
              <p className="text-xs text-muted-foreground">Ventes automatisées, qualification et CRM autonome.</p>
            </div>

            <div className="p-4 rounded-2xl bg-card/60 border border-border/60 backdrop-blur-sm space-y-2">
              <Package className="w-5 h-5 text-blue-400" />
              <div className="font-semibold text-sm">Gestion des Stocks</div>
              <p className="text-xs text-muted-foreground">Réservation instantanée et prévention du surstockage.</p>
            </div>

            <div className="p-4 rounded-2xl bg-card/60 border border-border/60 backdrop-blur-sm space-y-2">
              <Truck className="w-5 h-5 text-purple-400" />
              <div className="font-semibold text-sm">Livraisons & Zones</div>
              <p className="text-xs text-muted-foreground">Suivi des livreurs et attribution intelligente par zone.</p>
            </div>

            <div className="p-4 rounded-2xl bg-card/60 border border-border/60 backdrop-blur-sm space-y-2">
              <BrainCircuit className="w-5 h-5 text-amber-400" />
              <div className="font-semibold text-sm">CEO AI Copilot</div>
              <p className="text-xs text-muted-foreground">Recommandations stratégiques basées sur des données réelles.</p>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="py-16 px-6 max-w-6xl mx-auto border-t border-border/50 space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-bold tracking-tight">Une plateforme conçue pour la croissance</h2>
            <p className="text-muted-foreground text-sm max-w-xl mx-auto">
              Simplifiez vos opérations quotidiennes et concentrez-vous sur l'essentiel.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-3xl bg-card border border-border space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold">1. Connectez votre WhatsApp</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Associez votre numéro professionnel. L'Agent Commercial IA prend le relais pour répondre à vos clients, présenter vos produits et enregistrer les commandes.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-card border border-border space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold">2. Pilotez vos Operations</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Suivez votre chiffre d'affaires, vos stocks physiques et réservés, ainsi que la progression de vos livreurs en temps réel.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-card border border-border space-y-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                <BrainCircuit className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold">3. Prenez de Meilleures Décisions</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Votre Copilot CEO AI formule des recommandations concrètes calculées directement à partir de vos chiffres de vente.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 px-6 text-center text-xs text-muted-foreground">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>© {new Date().getFullYear()} WILLShop OS. Tous droits réservés.</div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:underline">Se connecter</Link>
            <Link href="/signup" className="hover:underline">Créer un compte</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
