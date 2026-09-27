"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/src/infrastructure/supabase/client";
import { DataSourceBadge } from "@/components/ui/data-source-badge";
import {
  Users,
  CheckSquare,
  AlertTriangle,
  Clock,
  Briefcase,
  Target,
  Flame,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Plus,
  Filter,
  Layers,
  ArrowRight,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  X,
  Loader2,
  UserPlus,
  Award,
  ChevronRight,
  Ban,
  Play,
  RotateCcw
} from "lucide-react";

export default function TeamCockpitPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "workload" | "kanban" | "scorecards" | "escalations">("overview");

  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Database SSOT Data
  const [employees, setEmployees] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [escalations, setEscalations] = useState<any[]>([]);

  // Modals state
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [isSubmittingEmployee, setIsSubmittingEmployee] = useState(false);
  const [employeeError, setEmployeeError] = useState("");

  // Employee Form State
  const [empFirstName, setEmpFirstName] = useState("");
  const [empLastName, setEmpLastName] = useState("");
  const [empPhone, setEmpPhone] = useState("");
  const [empEmail, setEmpEmail] = useState("");
  const [empJobTitle, setEmpJobTitle] = useState("");
  const [empRole, setEmpRole] = useState<"OWNER" | "MANAGER" | "COMMERCIAL" | "LIVREUR" | "VIEWER">("COMMERCIAL");
  const [empStatus, setEmpStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");

  // Task Modal State
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);
  const [taskError, setTaskError] = useState("");

  // Task Form State
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskAssignedTo, setTaskAssignedTo] = useState("");
  const [taskPriority, setTaskPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
  const [taskDueAt, setTaskDueAt] = useState("");

  // Blocker Modal State
  const [isBlockerModalOpen, setIsBlockerModalOpen] = useState(false);
  const [selectedTaskToBlock, setSelectedTaskToBlock] = useState<any>(null);
  const [blockerReasonInput, setBlockerReasonInput] = useState("");

  useEffect(() => {
    loadTeamData();
  }, []);

  async function loadTeamData() {
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
      setCurrentUserId(user.id);

      // Resolve OrgId
      const { data: roleData } = await supabase
        .from("user_organization_roles")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (!roleData?.organization_id) {
        setLoading(false);
        return;
      }

      const activeOrgId = roleData.organization_id;
      setOrgId(activeOrgId);

      // Fetch team_employees
      const { data: empData } = await supabase
        .from("team_employees")
        .select("*")
        .eq("organization_id", activeOrgId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      setEmployees(empData || []);

      // Fetch team_tasks
      const { data: taskData } = await supabase
        .from("team_tasks")
        .select("*")
        .eq("organization_id", activeOrgId)
        .order("created_at", { ascending: false });

      setTasks(taskData || []);

      // Fetch task_escalations
      const { data: escData } = await supabase
        .from("task_escalations")
        .select("*")
        .eq("organization_id", activeOrgId)
        .order("triggered_at", { ascending: false });

      setEscalations(escData || []);
    } catch (err) {
      console.error("Erreur lors du chargement des données de l'équipe:", err);
    } finally {
      setLoading(false);
    }
  }

  // --- HANDLER: CREATE EMPLOYEE ---
  async function handleCreateEmployee(e: React.FormEvent) {
    e.preventDefault();
    if (!empFirstName.trim() || !empLastName.trim() || !empPhone.trim()) {
      setEmployeeError("Le prénom, le nom et le téléphone sont obligatoires.");
      return;
    }

    if (!orgId) {
      setEmployeeError("Organisation introuvable.");
      return;
    }

    setIsSubmittingEmployee(true);
    setEmployeeError("");

    try {
      const supabase = createClient();

      const newEmpPayload = {
        organization_id: orgId,
        first_name: empFirstName.trim(),
        last_name: empLastName.trim(),
        phone: empPhone.trim(),
        email: empEmail.trim() || null,
        role: empRole,
        employment_status: empStatus,
        responsibilities: empJobTitle.trim() ? [empJobTitle.trim()] : [],
        activity_status: "ONLINE",
      };

      const { data, error } = await supabase
        .from("team_employees")
        .insert(newEmpPayload)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      // Reset form & reload
      setEmpFirstName("");
      setEmpLastName("");
      setEmpPhone("");
      setEmpEmail("");
      setEmpJobTitle("");
      setEmpRole("COMMERCIAL");
      setEmpStatus("ACTIVE");
      setIsEmployeeModalOpen(false);

      await loadTeamData();
    } catch (err: any) {
      setEmployeeError(err?.message || "Erreur lors de la création de l'employé.");
    } finally {
      setIsSubmittingEmployee(false);
    }
  }

  // --- HANDLER: CREATE TASK ---
  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!taskTitle.trim()) {
      setTaskError("Le titre de la tâche est obligatoire.");
      return;
    }

    if (!orgId || !currentUserId) {
      setTaskError("Session ou organisation introuvable.");
      return;
    }

    setIsSubmittingTask(true);
    setTaskError("");

    try {
      const supabase = createClient();

      const newTaskPayload = {
        organization_id: orgId,
        title: taskTitle.trim(),
        description: taskDescription.trim() || null,
        priority: taskPriority,
        status: "TODO",
        source: "MANUAL",
        created_by: currentUserId,
        assigned_to: taskAssignedTo || null,
        due_at: taskDueAt ? new Date(taskDueAt).toISOString() : null,
      };

      const { error } = await supabase.from("team_tasks").insert(newTaskPayload);

      if (error) {
        throw new Error(error.message);
      }

      // Reset form & reload
      setTaskTitle("");
      setTaskDescription("");
      setTaskAssignedTo("");
      setTaskPriority("MEDIUM");
      setTaskDueAt("");
      setIsTaskModalOpen(false);

      await loadTeamData();
    } catch (err: any) {
      setTaskError(err?.message || "Erreur lors de la création de la tâche.");
    } finally {
      setIsSubmittingTask(false);
    }
  }

  // --- HANDLER: TASK STATUS CHANGE ---
  async function handleUpdateTaskStatus(taskId: string, newStatus: string, blockerReason?: string) {
    if (!orgId) return;

    try {
      const supabase = createClient();
      const updates: any = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (newStatus === "IN_PROGRESS") {
        updates.started_at = new Date().toISOString();
      } else if (newStatus === "DONE") {
        updates.completed_at = new Date().toISOString();
      } else if (newStatus === "BLOCKED") {
        updates.blocker_reason = blockerReason || "Blocage non précisé";
        updates.blocked_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("team_tasks")
        .update(updates)
        .eq("organization_id", orgId)
        .eq("id", taskId);

      if (error) {
        console.error("Erreur mise à jour statut tâche:", error.message);
      } else {
        await loadTeamData();
      }
    } catch (err) {
      console.error("Erreur lors de la mise à jour de la tâche:", err);
    }
  }

  // KPI Computations
  const overdueTasks = tasks.filter(
    (t) =>
      t.status !== "DONE" &&
      t.due_at &&
      new Date(t.due_at).getTime() < Date.now()
  ).length;

  const blockedTasks = tasks.filter((t) => t.status === "BLOCKED").length;
  const openTasks = tasks.filter((t) => t.status === "TODO" || t.status === "IN_PROGRESS").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-stone-500">
          <Loader2 className="w-8 h-8 animate-spin text-[#800020]" />
          <p className="text-xs font-extrabold text-stone-700">Chargement de la Gestion d'Équipe WILLShop OS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up pb-16">
      {/* HEADER SECTION - WILLSHOP LIGHT STYLE */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#800020]/10 rounded-2xl border border-[#800020]/20 text-[#800020]">
            <Users className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
                Cockpit Équipe & Productivité
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#800020]/10 text-[#800020] border border-[#800020]/20">
                Direction & RH
              </span>
            </div>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              Gestion centralisée de vos employés, charge de travail et fiches de performance
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEmployeeError("");
              setIsEmployeeModalOpen(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold rounded-xl border border-gray-200 transition-all text-xs"
          >
            <UserPlus className="w-4 h-4 text-[#800020]" />
            <span>+ Ajouter un employé</span>
          </button>

          <button
            onClick={() => {
              setTaskError("");
              setIsTaskModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-[#800020] hover:bg-[#660019] text-white font-bold rounded-xl transition-all shadow-xs text-xs"
          >
            <Plus className="w-4 h-4 text-[#D4A843]" />
            <span>Nouvelle Tâche</span>
          </button>
        </div>
      </div>

      {/* KPI METRICS OVERVIEW - CLEAN LIGHT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-2xs hover:border-[#800020]/40 transition-all">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-[11px] uppercase tracking-wider font-extrabold text-gray-400">Membres Actifs</span>
            <DataSourceBadge type={employees.length > 0 ? "DATABASE" : "EMPTY_STATE"} />
          </div>
          <div className="text-3xl font-extrabold text-gray-900 font-mono">{employees.length}</div>
          <div className="text-xs text-gray-500 mt-1 flex items-center gap-1 font-medium">
            <UserCheck className="w-3.5 h-3.5 text-[#800020]" /> Employés en base
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-2xs hover:border-[#800020]/40 transition-all">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-[11px] uppercase tracking-wider font-extrabold text-gray-400">Tâches Ouvertes</span>
            <DataSourceBadge type={openTasks > 0 ? "DATABASE" : "EMPTY_STATE"} />
          </div>
          <div className="text-3xl font-extrabold text-gray-900 font-mono">{openTasks}</div>
          <div className="text-xs text-gray-500 mt-1 font-medium">En cours / À faire</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-2xs hover:border-[#800020]/40 transition-all">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-[11px] uppercase tracking-wider font-extrabold text-gray-400">En Retard</span>
            <DataSourceBadge type={overdueTasks > 0 ? "DATABASE" : "EMPTY_STATE"} />
          </div>
          <div className="text-3xl font-extrabold text-amber-600 font-mono">{overdueTasks}</div>
          <div className="text-xs text-gray-500 mt-1 font-medium flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Hors délai
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-2xs hover:border-[#800020]/40 transition-all">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-[11px] uppercase tracking-wider font-extrabold text-gray-400">Tâches Bloquées</span>
            <DataSourceBadge type={blockedTasks > 0 ? "DATABASE" : "EMPTY_STATE"} />
          </div>
          <div className="text-3xl font-extrabold text-rose-600 font-mono">{blockedTasks}</div>
          <div className="text-xs text-gray-500 mt-1 font-medium">Blocages actifs</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-2xs hover:border-[#800020]/40 transition-all">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-[11px] uppercase tracking-wider font-extrabold text-gray-400">Escalades</span>
            <DataSourceBadge type={escalations.length > 0 ? "DATABASE" : "EMPTY_STATE"} />
          </div>
          <div className="text-3xl font-extrabold text-[#800020] font-mono">{escalations.length}</div>
          <div className="text-xs text-gray-500 mt-1 font-medium flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-[#D4A843]" /> Suivi automatique
          </div>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-gray-200 pb-3">
        {[
          { id: "overview", label: "Vue d'Ensemble Équipe", icon: Layers },
          { id: "workload", label: "Charge de Travail (Workload)", icon: Briefcase },
          { id: "kanban", label: "Tableau Kanban", icon: CheckSquare },
          { id: "scorecards", label: "Performance & Scorecards", icon: TrendingUp },
          { id: "escalations", label: "Escalades & Blocages", icon: AlertTriangle },
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
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <h2 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-[#800020]" />
                <span>Membres de l'Équipe WillShop ({employees.length})</span>
              </h2>
              <button
                onClick={() => setIsEmployeeModalOpen(true)}
                className="text-xs font-bold text-[#800020] hover:underline flex items-center gap-1"
              >
                + Enregistrer un membre
              </button>
            </div>

            {employees.length === 0 ? (
              <div className="p-12 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 space-y-4">
                <UserCheck className="w-12 h-12 text-gray-400 mx-auto" />
                <div className="space-y-1">
                  <h3 className="text-sm font-extrabold text-gray-900">Aucun employé enregistré en base</h3>
                  <p className="text-xs text-gray-500 max-w-md mx-auto">
                    Vous n'avez pas encore d'employés dans votre organisation. Cliquez ci-dessous pour ajouter un commercial, livreur ou manager.
                  </p>
                </div>
                <button
                  onClick={() => setIsEmployeeModalOpen(true)}
                  className="px-4 py-2 bg-[#800020] hover:bg-[#660019] text-white font-bold text-xs rounded-xl transition-all inline-flex items-center gap-2 shadow-xs"
                >
                  <UserPlus className="w-4 h-4 text-[#D4A843]" />
                  <span>+ Ajouter un employé</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {employees.map((emp) => {
                  const empTasks = tasks.filter((t) => t.assigned_to === emp.id);
                  const empOpenTasks = empTasks.filter(
                    (t) => t.status === "TODO" || t.status === "IN_PROGRESS"
                  ).length;
                  const empUrgentTasks = empTasks.filter(
                    (t) => t.priority === "URGENT" || t.priority === "HIGH"
                  ).length;

                  return (
                    <div
                      key={emp.id}
                      className="bg-gray-50/60 border border-gray-200 rounded-2xl p-5 hover:border-[#800020]/30 transition-all space-y-4 flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#800020] text-[#D4A843] flex items-center justify-center font-black text-sm shadow-2xs">
                              {emp.first_name?.[0]}
                              {emp.last_name?.[0]}
                            </div>
                            <div>
                              <h3 className="font-extrabold text-gray-900 text-sm">
                                {emp.first_name} {emp.last_name}
                              </h3>
                              <span className="text-[11px] text-gray-500 font-semibold">{emp.role}</span>
                            </div>
                          </div>
                          <span
                            className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${
                              emp.employment_status === "ACTIVE"
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : "bg-rose-50 text-rose-800 border-rose-200"
                            }`}
                          >
                            {emp.employment_status}
                          </span>
                        </div>

                        <div className="text-xs text-gray-700 space-y-1.5 pt-3 border-t border-gray-200/80 font-medium">
                          <p className="flex justify-between">
                            <span className="text-gray-500">Tâches ouvertes:</span>
                            <span className="font-bold text-gray-900">{empOpenTasks}</span>
                          </p>
                          <p className="flex justify-between">
                            <span className="text-gray-500">Haute priorité:</span>
                            <span className="font-bold text-amber-700">{empUrgentTasks}</span>
                          </p>
                          {emp.phone && (
                            <p className="flex justify-between text-gray-500 font-mono">
                              <span>Tél:</span>
                              <span>{emp.phone}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      <Link
                        href={`/team/${emp.id}`}
                        className="w-full py-2 bg-white hover:bg-gray-100 text-gray-900 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1 border border-gray-200"
                      >
                        <span>Voir la fiche</span>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: WORKLOAD */}
      {activeTab === "workload" && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-2xs space-y-4">
            <h2 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-[#800020]" />
              <span>Charge de Travail par Employé (Workload)</span>
            </h2>

            {employees.length === 0 ? (
              <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-500 text-xs font-medium">
                Aucune charge de travail disponible. Enregistrez des employés et assignez des tâches.
              </div>
            ) : (
              <div className="space-y-3">
                {employees.map((emp) => {
                  const empTasks = tasks.filter((t) => t.assigned_to === emp.id);
                  const activeTasksCount = empTasks.filter(
                    (t) => t.status === "TODO" || t.status === "IN_PROGRESS"
                  ).length;
                  const blockedCount = empTasks.filter((t) => t.status === "BLOCKED").length;

                  return (
                    <div
                      key={emp.id}
                      className="bg-gray-50/60 border border-gray-200 rounded-2xl p-5 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="font-extrabold text-gray-900 text-sm">
                            {emp.first_name} {emp.last_name}
                          </span>
                          <span className="text-xs text-gray-500 font-medium">({emp.role})</span>
                        </div>
                        <div className="text-xs font-medium text-gray-700">
                          <span className="font-bold text-gray-900">{activeTasksCount}</span> tâches en cours
                        </div>
                      </div>

                      {/* WORKLOAD BAR */}
                      <div className="w-full bg-gray-200 h-3 rounded-full overflow-hidden flex">
                        <div
                          className="bg-[#800020] h-full"
                          style={{
                            width: `${Math.min(100, (activeTasksCount / 10) * 100)}%`,
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
                        <span>Statut: {activeTasksCount > 5 ? "Surchargé" : "Normal"}</span>
                        <span>{blockedCount} tâche(s) bloquée(s)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: KANBAN */}
      {activeTab === "kanban" && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {["TODO", "IN_PROGRESS", "BLOCKED", "DONE"].map((statusColumn) => {
            const columnTasks = tasks.filter((t) => t.status === statusColumn);

            return (
              <div key={statusColumn} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <span className="font-extrabold text-xs text-gray-900 uppercase tracking-wider">
                    {statusColumn === "TODO"
                      ? "À FAIRE"
                      : statusColumn === "IN_PROGRESS"
                      ? "EN COURS"
                      : statusColumn === "BLOCKED"
                      ? "BLOQUÉ"
                      : "TERMINÉ"}
                  </span>
                  <span className="px-2 py-0.5 bg-gray-100 text-xs font-bold rounded-lg text-gray-700">
                    {columnTasks.length}
                  </span>
                </div>

                <div className="space-y-3 min-h-[300px]">
                  {columnTasks.length === 0 ? (
                    <div className="p-4 text-center text-xs text-gray-400 font-medium border border-dashed border-gray-200 rounded-xl">
                      Aucune tâche
                    </div>
                  ) : (
                    columnTasks.map((task) => {
                      const assignee = employees.find((e) => e.id === task.assigned_to);

                      return (
                        <div
                          key={task.id}
                          className="bg-gray-50/70 border border-gray-200 rounded-xl p-4 space-y-3 hover:border-[#800020]/30 transition-all shadow-2xs"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span
                              className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                                task.priority === "URGENT"
                                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                                  : task.priority === "HIGH"
                                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                                  : "bg-blue-50 text-blue-700 border border-blue-200"
                              }`}
                            >
                              {task.priority}
                            </span>
                            <span className="text-gray-400 text-[10px] font-mono">{task.source}</span>
                          </div>

                          <h4 className="font-bold text-gray-900 text-xs leading-snug">{task.title}</h4>

                          {task.description && (
                            <p className="text-xs text-gray-500 line-clamp-2">{task.description}</p>
                          )}

                          {task.blocker_reason && (
                            <div className="p-2 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 font-mono">
                              Motif: {task.blocker_reason}
                            </div>
                          )}

                          <div className="flex items-center justify-between text-[11px] text-gray-500 pt-2 border-t border-gray-200 font-medium">
                            <span>
                              {assignee
                                ? `${assignee.first_name} ${assignee.last_name?.[0]}.`
                                : "Non assigné"}
                            </span>
                            {task.due_at && (
                              <span className="font-mono">{new Date(task.due_at).toLocaleDateString("fr-FR")}</span>
                            )}
                          </div>

                          {/* ACTION BUTTONS TO MOVE STATUS */}
                          <div className="flex flex-wrap gap-1 pt-2 border-t border-gray-200">
                            {statusColumn !== "IN_PROGRESS" && (
                              <button
                                onClick={() => handleUpdateTaskStatus(task.id, "IN_PROGRESS")}
                                className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold rounded-lg border border-blue-200 flex items-center gap-1"
                              >
                                <Play className="w-2.5 h-2.5" /> En cours
                              </button>
                            )}
                            {statusColumn !== "DONE" && (
                              <button
                                onClick={() => handleUpdateTaskStatus(task.id, "DONE")}
                                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-lg border border-emerald-200 flex items-center gap-1"
                              >
                                <CheckCircle2 className="w-2.5 h-2.5" /> Terminer
                              </button>
                            )}
                            {statusColumn !== "BLOCKED" && (
                              <button
                                onClick={() => {
                                  setSelectedTaskToBlock(task);
                                  setBlockerReasonInput("");
                                  setIsBlockerModalOpen(true);
                                }}
                                className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold rounded-lg border border-rose-200 flex items-center gap-1"
                              >
                                <Ban className="w-2.5 h-2.5" /> Bloquer
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB CONTENT: SCORECARDS */}
      {activeTab === "scorecards" && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-2xs space-y-4">
            <h2 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
              <Award className="w-4 h-4 text-[#800020]" />
              <span>Fiches de Performance & Scorecards</span>
            </h2>

            {employees.length === 0 ? (
              <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-500 text-xs font-medium">
                Aucune donnée d'employé disponible en base de données.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {employees.map((emp) => {
                  const empTasks = tasks.filter((t) => t.assigned_to === emp.id);
                  const total = empTasks.length;
                  const done = empTasks.filter((t) => t.status === "DONE").length;
                  const overdue = empTasks.filter(
                    (t) =>
                      t.status !== "DONE" &&
                      t.due_at &&
                      new Date(t.due_at).getTime() < Date.now()
                  ).length;

                  let score = 0;
                  let hasEnoughData = total > 0;
                  if (hasEnoughData) {
                    const completionRate = (done / total) * 100;
                    const overdueRate = (overdue / total) * 100;
                    score = Math.max(0, Math.min(100, Math.round(completionRate - overdueRate * 0.5)));
                  }

                  return (
                    <div
                      key={emp.id}
                      className="bg-gray-50/60 border border-gray-200 rounded-2xl p-5 space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-extrabold text-gray-900 text-sm">
                            {emp.first_name} {emp.last_name}
                          </h3>
                          <p className="text-xs text-gray-500 font-semibold">{emp.role}</p>
                        </div>
                        {hasEnoughData ? (
                          <div className="text-right">
                            <span className="text-2xl font-black text-[#800020] font-mono">{score}</span>
                            <span className="text-xs text-gray-400 font-mono"> / 100</span>
                          </div>
                        ) : (
                          <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold rounded-lg">
                            DONNÉES INSUFFISANTES
                          </span>
                        )}
                      </div>

                      {hasEnoughData ? (
                        <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-gray-200 font-medium">
                          <div className="bg-white p-3 rounded-xl border border-gray-200">
                            <p className="text-gray-500">Tâches exécutées</p>
                            <p className="text-sm font-extrabold text-gray-900 font-mono mt-0.5">{done} / {total}</p>
                          </div>
                          <div className="bg-white p-3 rounded-xl border border-gray-200">
                            <p className="text-gray-500">Tâches en retard</p>
                            <p className="text-sm font-extrabold text-amber-700 font-mono mt-0.5">{overdue}</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 pt-2 border-t border-gray-200 font-medium">
                          Aucune tâche attribuée pour évaluer la performance.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: ESCALATIONS & BOTTLENECKS */}
      {activeTab === "escalations" && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-2xs space-y-4">
            <h2 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Escalades & Tâches Bloquées</span>
            </h2>

            {blockedTasks === 0 && overdueTasks === 0 ? (
              <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-500 text-xs font-medium">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                Aucune escalade ni blocage actif. Tout est en ordre dans votre organisation.
              </div>
            ) : (
              <div className="space-y-3">
                {tasks
                  .filter((t) => t.status === "BLOCKED" || (t.status !== "DONE" && t.due_at && new Date(t.due_at).getTime() < Date.now()))
                  .map((task) => {
                    const assignee = employees.find((e) => e.id === task.assigned_to);

                    return (
                      <div
                        key={task.id}
                        className="bg-gray-50/60 border border-amber-200 rounded-2xl p-4 flex items-center justify-between"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-3">
                            <span className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold rounded-lg">
                              {task.status}
                            </span>
                            <h4 className="font-extrabold text-gray-900 text-xs">{task.title}</h4>
                          </div>
                          {task.blocker_reason && (
                            <p className="text-xs text-rose-700 font-mono">Motif: {task.blocker_reason}</p>
                          )}
                        </div>
                        <div className="text-right text-xs text-gray-500 font-medium">
                          <p>Assigné: {assignee ? `${assignee.first_name} ${assignee.last_name}` : "Non assigné"}</p>
                          {task.due_at && <p className="font-mono">Échéance: {new Date(task.due_at).toLocaleDateString("fr-FR")}</p>}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: ADD EMPLOYEE */}
      {isEmployeeModalOpen && (
        <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-xl animate-scale-in">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-[#800020]" />
                <span>Enregistrer un Employé</span>
              </h3>
              <button
                onClick={() => setIsEmployeeModalOpen(false)}
                className="text-gray-400 hover:text-gray-900 p-1 rounded-lg hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateEmployee} className="p-5 space-y-4">
              {employeeError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium">
                  {employeeError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Numéro de Téléphone (Identifiant WhatsApp / Mobile) *
                </label>
                <input
                  type="text"
                  value={empPhone}
                  onChange={(e) => setEmpPhone(e.target.value)}
                  placeholder="+226 70 00 00 00"
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-bold font-mono text-gray-900 focus:outline-none focus:border-[#800020]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Prénom *</label>
                  <input
                    type="text"
                    value={empFirstName}
                    onChange={(e) => setEmpFirstName(e.target.value)}
                    placeholder="Jean"
                    required
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-[#800020]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Nom *</label>
                  <input
                    type="text"
                    value={empLastName}
                    onChange={(e) => setEmpLastName(e.target.value)}
                    placeholder="Kaboré"
                    required
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-[#800020]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Rôle RBAC / Accès *</label>
                  <select
                    value={empRole}
                    onChange={(e: any) => setEmpRole(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none focus:border-[#800020]"
                  >
                    <option value="COMMERCIAL">COMMERCIAL (Ventes & CRM)</option>
                    <option value="MANAGER">MANAGER (Opérations & Stock)</option>
                    <option value="LIVREUR">LIVREUR (Livraisons)</option>
                    <option value="OWNER">OWNER / CEO (Accès complet)</option>
                    <option value="VIEWER">VIEWER (Lecture seule)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Email (optionnel)</label>
                  <input
                    type="email"
                    value={empEmail}
                    onChange={(e) => setEmpEmail(e.target.value)}
                    placeholder="jean@willshop.bf (facultatif)"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-[#800020]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Poste / Fonction (optionnel)</label>
                <input
                  type="text"
                  value={empJobTitle}
                  onChange={(e) => setEmpJobTitle(e.target.value)}
                  placeholder="ex: Commercial Terrain, Responsible Ventes..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-[#800020]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsEmployeeModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-all"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEmployee}
                  className="px-4 py-2 bg-[#800020] hover:bg-[#660019] text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-2"
                >
                  {isSubmittingEmployee && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Enregistrer l'employé</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD TASK */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-xl animate-scale-in">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#800020]" />
                <span>Nouvelle Tâche</span>
              </h3>
              <button
                onClick={() => setIsTaskModalOpen(false)}
                className="text-gray-400 hover:text-gray-900 p-1 rounded-lg hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="p-5 space-y-4">
              {taskError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium">
                  {taskError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Titre de la tâche *</label>
                <input
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Relancer client grands comptes..."
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-[#800020]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Description</label>
                <textarea
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  rows={3}
                  placeholder="Détails complémentaires..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-[#800020]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Assigner à</label>
                  <select
                    value={taskAssignedTo}
                    onChange={(e) => setTaskAssignedTo(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-[#800020]"
                  >
                    <option value="">-- Sélectionner un employé --</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.first_name} {e.last_name} ({e.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Priorité</label>
                  <select
                    value={taskPriority}
                    onChange={(e: any) => setTaskPriority(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-[#800020]"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="URGENT">URGENT</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Date d'échéance</label>
                <input
                  type="date"
                  value={taskDueAt}
                  onChange={(e) => setTaskDueAt(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-[#800020]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsTaskModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-all"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTask}
                  className="px-4 py-2 bg-[#800020] hover:bg-[#660019] text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-2"
                >
                  {isSubmittingTask && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Créer la tâche</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: BLOCK TASK */}
      {isBlockerModalOpen && (
        <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-md overflow-hidden shadow-xl animate-scale-in">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-rose-700 flex items-center gap-2">
                <Ban className="w-4 h-4 text-rose-700" />
                <span>Déclarer un Blocage</span>
              </h3>
              <button
                onClick={() => setIsBlockerModalOpen(false)}
                className="text-gray-400 hover:text-gray-900 p-1 rounded-lg hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-gray-600 font-medium">
                Veuillez indiquer le motif du blocage pour la tâche{" "}
                <strong className="text-gray-900">"{selectedTaskToBlock?.title}"</strong> :
              </p>

              <textarea
                value={blockerReasonInput}
                onChange={(e) => setBlockerReasonInput(e.target.value)}
                rows={3}
                placeholder="ex: En attente de validation du client..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-[#800020]"
              />

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsBlockerModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-all"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedTaskToBlock) {
                      handleUpdateTaskStatus(selectedTaskToBlock.id, "BLOCKED", blockerReasonInput);
                      setIsBlockerModalOpen(false);
                    }
                  }}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs"
                >
                  Confirmer le blocage
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
