"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/src/infrastructure/supabase/client";
import { DataSourceBadge } from "@/components/ui/data-source-badge";
import {
  Users,
  ArrowLeft,
  Briefcase,
  CheckSquare,
  Clock,
  AlertTriangle,
  Mail,
  Phone,
  Calendar,
  Shield,
  TrendingUp,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Award
} from "lucide-react";

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const employeeId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [employee, setEmployee] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [performance, setPerformance] = useState<{
    score: number;
    completionRate: number;
    overdueRate: number;
    ratingLabel: string;
    hasEnoughData: boolean;
  }>({
    score: 0,
    completionRate: 0,
    overdueRate: 0,
    ratingLabel: "Données insuffisantes",
    hasEnoughData: false,
  });

  useEffect(() => {
    if (employeeId) {
      loadEmployeeDetails();
    }
  }, [employeeId]);

  async function loadEmployeeDetails() {
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

      // Fetch orgId
      const { data: roleData } = await supabase
        .from("user_organization_roles")
        .select("organization_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true }).limit(1)
        .single();

      if (!roleData?.organization_id) {
        setLoading(false);
        return;
      }

      const activeOrgId = roleData.organization_id;
      setOrgId(activeOrgId);

      // Fetch employee
      const { data: empData, error: empError } = await supabase
        .from("team_employees")
        .select("*")
        .eq("organization_id", activeOrgId)
        .eq("id", employeeId)
        .single();

      if (empError || !empData) {
        setEmployee(null);
        setLoading(false);
        return;
      }

      setEmployee(empData);

      // Fetch employee tasks
      const { data: taskData } = await supabase
        .from("team_tasks")
        .select("*")
        .eq("organization_id", activeOrgId)
        .eq("assigned_to", employeeId)
        .order("created_at", { ascending: false });

      const empTasks = taskData || [];
      setTasks(empTasks);

      // Calculate performance score dynamically
      const totalTasks = empTasks.length;
      const doneTasks = empTasks.filter((t: any) => t.status === "DONE").length;
      const overdueTasks = empTasks.filter(
        (t: any) =>
          t.status !== "DONE" &&
          t.due_at &&
          new Date(t.due_at).getTime() < Date.now()
      ).length;

      if (totalTasks > 0) {
        const completionRate = Math.round((doneTasks / totalTasks) * 100);
        const overdueRate = Math.round((overdueTasks / totalTasks) * 100);
        let score = Math.max(0, completionRate - overdueRate * 0.5);
        score = Math.min(100, Math.round(score));

        let ratingLabel = "Excellent";
        if (score < 50) ratingLabel = "À améliorer";
        else if (score < 75) ratingLabel = "Satisfaisant";

        setPerformance({
          score,
          completionRate,
          overdueRate,
          ratingLabel,
          hasEnoughData: true,
        });
      } else {
        setPerformance({
          score: 0,
          completionRate: 0,
          overdueRate: 0,
          ratingLabel: "INSUFFICIENT DATA (0 tâche)",
          hasEnoughData: false,
        });
      }
    } catch (err) {
      console.error("Erreur lors du chargement de l'employé:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-[#7B61FF]" />
          <p className="text-sm font-mono">Chargement de la fiche employé...</p>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 pt-6">
        <Link
          href="/team"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-all font-mono"
        >
          <ArrowLeft className="w-4 h-4" /> Retour à l&apos;Équipe
        </Link>
        <div className="bg-[#12121A] border border-[#1E1E2C] rounded-2xl p-8 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-400 mx-auto" />
          <h2 className="text-xl font-bold text-white">Employé introuvable</h2>
          <p className="text-sm text-slate-400">
            L&apos;employé demandé n&apos;existe pas ou a été archivé.
          </p>
        </div>
      </div>
    );
  }

  const openTasks = tasks.filter((t) => t.status === "TODO" || t.status === "IN_PROGRESS").length;
  const doneTasks = tasks.filter((t) => t.status === "DONE").length;
  const blockedTasks = tasks.filter((t) => t.status === "BLOCKED").length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in-up pb-12">
      {/* NAVIGATION BACK */}
      <div className="flex items-center justify-between">
        <Link
          href="/team"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-all font-mono"
        >
          <ArrowLeft className="w-4 h-4" /> Retour à l&apos;Équipe
        </Link>
        <DataSourceBadge type="DATABASE" />
      </div>

      {/* HEADER EMPLOYEE PROFILE CARD */}
      <div className="bg-[#12121A] border border-[#1E1E2C] rounded-2xl p-6 md:p-8 space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-6 border-b border-[#181824]">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#7B61FF]/10 border border-[#7B61FF]/30 flex items-center justify-center text-[#7B61FF] font-bold text-2xl font-mono">
              {employee.first_name?.[0]}
              {employee.last_name?.[0]}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                {employee.first_name} {employee.last_name}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-3 py-1 bg-[#181824] text-slate-300 text-xs font-mono font-medium rounded-lg border border-slate-700">
                  {employee.role}
                </span>
                <span
                  className={`px-3 py-1 text-xs font-mono font-bold rounded-lg border ${
                    employee.employment_status === "ACTIVE"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                  }`}
                >
                  {employee.employment_status}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col text-left md:text-right text-xs text-slate-400 space-y-1 font-mono">
            <p className="flex items-center gap-1.5 justify-start md:justify-end">
              <Phone className="w-3.5 h-3.5 text-slate-500" /> {employee.phone}
            </p>
            {employee.email && (
              <p className="flex items-center gap-1.5 justify-start md:justify-end">
                <Mail className="w-3.5 h-3.5 text-slate-500" /> {employee.email}
              </p>
            )}
            <p className="flex items-center gap-1.5 justify-start md:justify-end text-slate-500">
              <Calendar className="w-3.5 h-3.5" /> Rejoint le{" "}
              {new Date(employee.joined_at || employee.created_at).toLocaleDateString("fr-FR")}
            </p>
          </div>
        </div>

        {/* METRICS ROW */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-[#0A0A10] p-4 rounded-xl border border-[#1E1E2C]">
            <p className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">Tâches Assignées</p>
            <p className="text-2xl font-bold text-white font-mono mt-1">{tasks.length}</p>
          </div>

          <div className="bg-[#0A0A10] p-4 rounded-xl border border-[#1E1E2C]">
            <p className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">Tâches Ouvertes</p>
            <p className="text-2xl font-bold text-amber-400 font-mono mt-1">{openTasks}</p>
          </div>

          <div className="bg-[#0A0A10] p-4 rounded-xl border border-[#1E1E2C]">
            <p className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">Terminées</p>
            <p className="text-2xl font-bold text-emerald-400 font-mono mt-1">{doneTasks}</p>
          </div>

          <div className="bg-[#0A0A10] p-4 rounded-xl border border-[#1E1E2C]">
            <p className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">Bloquées</p>
            <p className="text-2xl font-bold text-rose-400 font-mono mt-1">{blockedTasks}</p>
          </div>
        </div>
      </div>

      {/* PERFORMANCE & SCORECARD SECTION */}
      <div className="bg-[#12121A] border border-[#1E1E2C] rounded-2xl p-6 space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Award className="w-5 h-5 text-[#7B61FF]" />
          Fiche de Performance (Scorecard)
        </h2>

        {performance.hasEnoughData ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-[#0A0A10] p-5 rounded-xl border border-[#1E1E2C]">
            <div className="space-y-1">
              <p className="text-xs text-slate-400 font-mono">Score Global de Performance</p>
              <div className="text-3xl font-bold text-[#7B61FF] font-mono">{performance.score} / 100</div>
              <p className="text-xs text-emerald-400 font-mono font-medium">{performance.ratingLabel}</p>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-slate-400 font-mono">Taux d&apos;Achèvement</p>
              <div className="text-2xl font-bold text-white font-mono">{performance.completionRate}%</div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
                <div
                  className="bg-emerald-400 h-full rounded-full"
                  style={{ width: `${performance.completionRate}%` }}
                />
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-slate-400 font-mono">Taux de Retard</p>
              <div className="text-2xl font-bold text-amber-400 font-mono">{performance.overdueRate}%</div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
                <div
                  className="bg-amber-400 h-full rounded-full"
                  style={{ width: `${performance.overdueRate}%` }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 font-mono flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>INSUFFICIENT DATA — Aucune tâche exécutée pour le moment pour calculer un score fiable.</span>
          </div>
        )}
      </div>

      {/* ASSIGNED TASKS LIST */}
      <div className="bg-[#12121A] border border-[#1E1E2C] rounded-2xl p-6 space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-emerald-400" />
          Tâches Assignées ({tasks.length})
        </h2>

        {tasks.length === 0 ? (
          <div className="p-8 text-center bg-[#0A0A10] rounded-xl border border-dashed border-[#1E1E2C] text-slate-400 space-y-2">
            <Briefcase className="w-8 h-8 mx-auto text-slate-600" />
            <p className="text-sm font-mono">Aucune tâche assignée à cet employé.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="bg-[#0A0A10] border border-[#1E1E2C] p-4 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 hover:border-[#7B61FF]/40 transition-all"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded ${
                        task.priority === "URGENT"
                          ? "bg-rose-500/20 text-rose-400"
                          : task.priority === "HIGH"
                          ? "bg-amber-500/20 text-amber-400"
                          : "bg-blue-500/20 text-blue-400"
                      }`}
                    >
                      {task.priority}
                    </span>
                    <h3 className="font-semibold text-white text-sm">{task.title}</h3>
                  </div>
                  {task.description && (
                    <p className="text-xs text-slate-400">{task.description}</p>
                  )}
                  {task.blocker_reason && (
                    <p className="text-xs text-rose-300 font-mono bg-rose-500/10 p-1.5 rounded border border-rose-500/20">
                      Motif du blocage: {task.blocker_reason}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs font-mono shrink-0">
                  <span
                    className={`px-3 py-1 rounded-full font-bold border ${
                      task.status === "DONE"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : task.status === "BLOCKED"
                        ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                        : task.status === "IN_PROGRESS"
                        ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                        : "bg-slate-800 text-slate-300 border-slate-700"
                    }`}
                  >
                    {task.status}
                  </span>
                  {task.due_at && (
                    <span className="text-slate-400">
                      Échéance: {new Date(task.due_at).toLocaleDateString("fr-FR")}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
