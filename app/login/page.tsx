"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingBag, Eye, EyeOff, Lock, Mail, AlertCircle, ArrowRight, CheckCircle2, ArrowLeft, KeyRound } from "lucide-react";
import { createClient } from "@/src/infrastructure/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Password Reset / Recovery States
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isUpdatePasswordMode, setIsUpdatePasswordMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    // Listen for PASSWORD_RECOVERY event when user clicks the reset link in email
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsUpdatePasswordMode(true);
        setErrorMsg(null);
        setSuccessMsg("Vous pouvez maintenant définir votre nouveau mot de passe ci-dessous.");
      }
    });

    // Also check URL parameters and hash fragment (#access_token=...&type=recovery)
    if (typeof window !== "undefined") {
      const hash = window.location.hash;
      const search = window.location.search;
      if (hash.includes("type=recovery") || search.includes("type=recovery") || search.includes("reset=true")) {
        setIsUpdatePasswordMode(true);
      }
    }

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMsg("Veuillez remplir votre email et votre mot de passe.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        let msg = error.message;
        if (msg.includes("Invalid login credentials")) {
          msg = "Mot de passe incorrect ou compte inexistant. Veuillez vérifier vos identifiants.";
        } else if (msg.includes("Email not confirmed")) {
          msg = "Votre adresse email n'est pas encore confirmée. Veuillez vérifier votre boîte de réception.";
        } else if (msg.includes("User not found")) {
          msg = "Aucun compte trouvé avec cette adresse email.";
        } else if (msg.includes("Too many requests") || msg.includes("rate limit")) {
          msg = "Trop de tentatives de connexion. Veuillez patienter un instant avant de réessayer.";
        }
        setErrorMsg(msg);
        setIsLoading(false);
        return;
      }

      if (data?.user?.id) {
        try {
          const { data: roles } = await supabase
            .from("user_organization_roles")
            .select("role")
            .eq("user_id", data.user.id)
            .is("deleted_at", null)
            .limit(1);

          if (roles && roles.length > 0) {
            const userRole = roles[0].role;
            document.cookie = `willshop_role=${userRole}; path=/; max-age=${86400 * 7}; SameSite=Lax`;

            if (userRole === "COMMERCIAL" || userRole === "SALES") {
              window.location.href = "/sales/my-day";
              return;
            } else if (userRole === "LIVREUR" || userRole === "DRIVER") {
              window.location.href = "/delivery/my-deliveries";
              return;
            } else {
              window.location.href = "/ceo";
              return;
            }
          }
        } catch (_e) {
          // Ignore role query error, fall through to workspace-select
        }
      }

      window.location.href = "/workspace-select";
    } catch (_err: any) {
      setErrorMsg(_err?.message || "Erreur de connexion.");
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setErrorMsg("Veuillez saisir votre adresse email professionnelle.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const supabase = createClient();
      const origin = typeof window !== "undefined" ? window.location.origin : "https://willshop-gestion.vercel.app";
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${origin}/login?reset=true`,
      });

      if (error) {
        setErrorMsg(error.message || "Échec de l'envoi du mail de réinitialisation.");
      } else {
        setSuccessMsg(
          "Un lien de réinitialisation du mot de passe a été envoyé à votre adresse email ! Vérifiez votre boîte de réception ou votre dossier spam."
        );
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Erreur lors de la réinitialisation du mot de passe.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setErrorMsg("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        setErrorMsg(error.message || "Impossible de mettre à jour le mot de passe.");
      } else {
        setSuccessMsg("Votre mot de passe a été mis à jour avec succès ! Redirection en cours...");
        setTimeout(() => {
          window.location.href = "/workspace-select";
        }, 1500);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Erreur lors de la mise à jour du mot de passe.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F5EE] text-[#1F1917] flex items-center justify-center p-4 sm:p-6 md:p-8 animate-fade-in-up">
      <div className="max-w-4xl w-full bg-white rounded-3xl border border-[#EBE5DA] shadow-md overflow-hidden grid grid-cols-1 md:grid-cols-2">
        {/* Left Side: Brand Image & Identity */}
        <div className="bg-[#800020] p-8 text-white flex flex-col justify-between relative overflow-hidden hidden md:flex">
          <div className="absolute inset-0 bg-gradient-to-b from-[#800020] via-[#660019] to-[#4D0013] opacity-90" />

          <div className="relative z-10 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-[#D4A843] text-gray-900 flex items-center justify-center font-black text-2xl shadow-lg ring-4 ring-white/20">
              <ShoppingBag className="w-8 h-8 text-[#800020]" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-white">WILLShop OS</h1>
              <p className="text-sm font-semibold text-[#D4A843] mt-1">
                Le système d'exploitation de votre activité commerciale
              </p>
            </div>
          </div>

          <div className="relative z-10 space-y-3 pt-8">
            <div className="space-y-2 text-xs font-semibold text-white/90">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#D4A843]" />
                <span>Ventes • Clients • Commandes</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#D4A843]" />
                <span>Livraisons • Équipe • WhatsApp</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#D4A843]" />
                <span>Tout depuis un seul endroit</span>
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 text-[10px] text-white/60 font-mono">
              WILLShop OS Burkina Faso • v2.0
            </div>
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="p-6 sm:p-10 flex flex-col justify-center space-y-6">
          {isUpdatePasswordMode ? (
            /* Update Password Mode (Recovery) */
            <div className="space-y-5">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-[#800020]/10 text-[#800020] flex items-center justify-center mx-auto shadow-xs">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-black text-[#1F1917]">Nouveau mot de passe</h2>
                <p className="text-xs font-semibold text-stone-500 max-w-xs mx-auto">
                  Définissez un nouveau mot de passe sécurisé pour votre compte.
                </p>
              </div>

              {errorMsg && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-medium flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                  <span>{successMsg}</span>
                </div>
              )}

              <form onSubmit={handleSaveNewPassword} className="space-y-4 text-xs font-medium">
                <div>
                  <label className="block text-stone-700 font-bold mb-1.5">Nouveau mot de passe</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      type={showNewPassword ? "text" : "password"}
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="6 caractères minimum"
                      className="w-full bg-[#F8F5EE] border border-[#EBE5DA] rounded-xl pl-10 pr-10 py-2.5 font-bold text-[#1F1917] focus:outline-none focus:border-[#800020] focus:ring-2 focus:ring-[#800020]/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-[#1F1917]"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-stone-700 font-bold mb-1.5">Confirmer le nouveau mot de passe</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      type={showNewPassword ? "text" : "password"}
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Répétez le mot de passe"
                      className="w-full bg-[#F8F5EE] border border-[#EBE5DA] rounded-xl pl-10 pr-10 py-2.5 font-bold text-[#1F1917] focus:outline-none focus:border-[#800020] focus:ring-2 focus:ring-[#800020]/20"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#800020] hover:bg-[#590C1D] text-white py-3 rounded-xl text-xs font-extrabold shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <span>{isLoading ? "Enregistrement..." : "Mettre à jour le mot de passe"}</span>
                </button>
              </form>
            </div>
          ) : !isForgotPassword ? (
            /* Login View */
            <>
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-[#800020] text-[#D4A843] flex items-center justify-center mx-auto md:hidden shadow-xs">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-black text-[#1F1917]">Bienvenue sur WILLShop OS</h2>
                <p className="text-xs font-semibold text-stone-500">Connectez-vous à votre espace entreprise</p>
              </div>

              {errorMsg && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-medium">
                  <div className="flex items-start gap-2 font-bold">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                    <span>{errorMsg}</span>
                  </div>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4 text-xs font-medium">
                <div>
                  <label className="block text-stone-700 font-bold mb-1.5">Adresse e-mail</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="votre@email.com"
                      className="w-full bg-[#F8F5EE] border border-[#EBE5DA] rounded-xl pl-10 pr-4 py-2.5 font-bold text-[#1F1917] focus:outline-none focus:border-[#800020] focus:ring-2 focus:ring-[#800020]/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-stone-700 font-bold mb-1.5">Mot de passe</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Votre mot de passe"
                      className="w-full bg-[#F8F5EE] border border-[#EBE5DA] rounded-xl pl-10 pr-10 py-2.5 font-bold text-[#1F1917] focus:outline-none focus:border-[#800020] focus:ring-2 focus:ring-[#800020]/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-[#1F1917]"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 text-[#800020] rounded border-stone-300 focus:ring-[#800020]"
                    />
                    <span className="font-semibold text-stone-700">Se souvenir de moi</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(true);
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="font-extrabold text-[#800020] hover:underline cursor-pointer bg-transparent border-0 p-0"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#800020] hover:bg-[#590C1D] text-white py-3 rounded-xl text-xs font-extrabold shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer disabled:opacity-50"
                >
                  <span>{isLoading ? "Connexion..." : "Se connecter"}</span>
                </button>
              </form>

              <div className="text-center text-xs pt-2">
                <span className="text-stone-500 font-medium">Nouvel utilisateur ? </span>
                <Link href="/signup" className="font-extrabold text-[#800020] hover:underline">
                  Créer mon entreprise
                </Link>
              </div>
            </>
          ) : (
            /* Forgot Password Mode */
            <div className="space-y-5">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-[#800020]/10 text-[#800020] flex items-center justify-center mx-auto shadow-xs">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-black text-[#1F1917]">Mot de passe oublié</h2>
                <p className="text-xs font-semibold text-stone-500 max-w-xs mx-auto">
                  Saisissez votre adresse email pour recevoir un lien de réinitialisation sécurisé.
                </p>
              </div>

              {errorMsg && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-medium flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                  <span>{successMsg}</span>
                </div>
              )}

              <form onSubmit={handleResetPassword} className="space-y-4 text-xs font-medium">
                <div>
                  <label className="block text-stone-700 font-bold mb-1.5">Adresse e-mail professionnelle</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="votre@email.com"
                      className="w-full bg-[#F8F5EE] border border-[#EBE5DA] rounded-xl pl-10 pr-4 py-2.5 font-bold text-[#1F1917] focus:outline-none focus:border-[#800020] focus:ring-2 focus:ring-[#800020]/20"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#800020] hover:bg-[#590C1D] text-white py-3 rounded-xl text-xs font-extrabold shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <span>{isLoading ? "Envoi du lien..." : "Envoyer le lien de réinitialisation"}</span>
                </button>
              </form>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(false);
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-extrabold text-stone-600 hover:text-[#1F1917] transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Retour à la connexion
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
