import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import RoleRoute from "@/components/admin/RoleRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Activity, Users, TrendingUp, Flame, Play, Eye, Settings2, AlertTriangle, GitCompareArrows } from "lucide-react";

const OBSERVER_TO_IO_RANGE: Record<string, number[]> = {
  ACOLHIMENTO: [1],
  CLARIFICACAO: [1, 2],
  PADROES: [3],
  RAIZ: [3],
  TROCA: [4, 5],
  CONSOLIDACAO: [6, 7],
};

const PHASE_NAMES: Record<number, string> = {
  1: "Consciência",
  2: "Regulação",
  3: "Identidade",
  4: "Constância",
  5: "Vitalidade",
  6: "Agência",
  7: "Autonomia",
};

const IOOverview = () => {
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [pmResult, setPmResult] = useState<any>(null);
  const [pmLoading, setPmLoading] = useState(false);
  const [overridePhase, setOverridePhase] = useState(1);
  const [showOnlyDivergent, setShowOnlyDivergent] = useState(false);

  // Main query: io_user_phase + profiles + cohorts
  const { data: users, isLoading } = useQuery({
    queryKey: ["io-overview-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("io_user_phase")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      if (!data || data.length === 0) return [];

      const userIds = data.map((u: any) => u.user_id);

      const [profilesRes, cohortsRes] = await Promise.all([
        supabase.from("profiles").select("id, nome, email").in("id", userIds),
        supabase.from("user_cohorts").select("user_id, cohort_name").in("user_id", userIds),
      ]);

      const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.id, p]));
      const cohortMap = new Map((cohortsRes.data || []).map((c: any) => [c.user_id, c.cohort_name]));

      return data.map((u: any) => ({
        ...u,
        profile: profileMap.get(u.user_id) || null,
        cohort: cohortMap.get(u.user_id) || null,
      }));
    },
  });

  // PM flag status query
  const { data: pmFlags } = useQuery({
    queryKey: ["pm-flags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feature_flags")
        .select("flag_value, scope, scope_id")
        .eq("flag_name", "io_phase_manager_enabled");
      if (error) throw error;
      return data || [];
    },
    staleTime: 30 * 1000,
  });

  const getPmStatus = (userId: string): boolean => {
    if (!pmFlags) return false;
    // User scope takes priority
    const userFlag = pmFlags.find((f: any) => f.scope === "user" && f.scope_id === userId);
    if (userFlag) return userFlag.flag_value;
    // Then global
    const globalFlag = pmFlags.find((f: any) => f.scope === "global");
    return globalFlag?.flag_value ?? false;
  };

  // Observer phases query for shadow mode comparison
  const { data: observerPhases } = useQuery({
    queryKey: ["observer-phases", users?.map((u: any) => u.user_id)],
    enabled: !!users && users.length > 0,
    queryFn: async () => {
      const userIds = users!.map((u: any) => u.user_id);

      // Get all chat_sessions for these users
      const { data: chatSessions, error: csErr } = await supabase
        .from("chat_sessions")
        .select("id, user_id")
        .in("user_id", userIds);
      if (csErr) throw csErr;
      if (!chatSessions || chatSessions.length === 0) return new Map<string, string>();

      const sessionIds = chatSessions.map((cs: any) => cs.id);
      const sessionToUser = new Map(chatSessions.map((cs: any) => [cs.id, cs.user_id]));

      // Get turn_insights with completed extraction
      const { data: insights, error: tiErr } = await supabase
        .from("turn_insights")
        .select("chat_session_id, phase, created_at")
        .in("chat_session_id", sessionIds)
        .eq("extraction_status", "completed")
        .not("phase", "is", null)
        .order("created_at", { ascending: false });
      if (tiErr) throw tiErr;

      // Map: user_id -> most recent observer phase
      const result = new Map<string, string>();
      for (const insight of insights || []) {
        const userId = sessionToUser.get(insight.chat_session_id);
        if (userId && !result.has(userId)) {
          result.set(userId, insight.phase as string);
        }
      }
      return result;
    },
    staleTime: 60 * 1000,
  });

  // Detail queries
  const { data: transitions } = useQuery({
    queryKey: ["io-transitions", selectedUser?.user_id],
    enabled: !!selectedUser,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("io_phase_transitions")
        .select("*")
        .eq("user_id", selectedUser.user_id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: sessions } = useQuery({
    queryKey: ["io-sessions", selectedUser?.user_id],
    enabled: !!selectedUser,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("io_daily_sessions")
        .select("*")
        .eq("user_id", selectedUser.user_id)
        .order("session_date", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
  });

  // PM handlers
  const callPhaseManager = async (body: Record<string, any>) => {
    setPmLoading(true);
    setPmResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("io-phase-manager", { body });
      if (error) {
        setPmResult({ error: error.message });
      } else {
        setPmResult(data);
      }
    } catch (e: any) {
      setPmResult({ error: e.message });
    } finally {
      setPmLoading(false);
    }
  };

  const handleGetStatus = () => {
    if (!selectedUser) return;
    callPhaseManager({ user_id: selectedUser.user_id, action: "get_status" });
  };

  const handleEvaluate = () => {
    if (!selectedUser) return;
    callPhaseManager({ user_id: selectedUser.user_id, action: "evaluate" });
  };

  const handleManualOverride = () => {
    if (!selectedUser) return;
    callPhaseManager({
      user_id: selectedUser.user_id,
      action: "manual_override",
      override_phase: overridePhase,
      override_notes: "Manual override via IO Overview admin panel",
    });
  };

  // Computed stats
  const totalUsers = users?.length || 0;
  const avgIgi = totalUsers > 0
    ? (users!.reduce((sum: number, u: any) => sum + Number(u.igi_current || 0), 0) / totalUsers).toFixed(2)
    : "0.00";
  const avgStreak = totalUsers > 0
    ? Math.round(users!.reduce((sum: number, u: any) => sum + (u.streak_current || 0), 0) / totalUsers)
    : 0;

  const phaseDistribution = Array.from({ length: 7 }, (_, i) => {
    const phase = i + 1;
    return {
      phase,
      name: PHASE_NAMES[phase],
      count: users?.filter((u: any) => u.current_phase === phase).length || 0,
    };
  });
  const maxPhaseCount = Math.max(1, ...phaseDistribution.map((p) => p.count));

  // IGI history chart from selected user
  const igiHistory: { date: string; value: number }[] = selectedUser?.igi_history
    ? (Array.isArray(selectedUser.igi_history) ? selectedUser.igi_history : [])
    : [];
  const maxIgi = Math.max(10, ...igiHistory.map((h: any) => Number(h.value || 0)));

  return (
    <RoleRoute allowedRoles={["admin", "desenvolvedor"]}>
      <AdminLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Activity className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">IO Overview</h1>
              <p className="text-muted-foreground">
                Visão geral do Método IO — fases, IGI e progresso dos usuários.
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Overview Cards */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Usuários IO</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-2xl font-bold">{totalUsers}</span>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">IGI Médio</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <span className="text-2xl font-bold">{avgIgi}</span>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Streak Médio</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Flame className="h-4 w-4 text-muted-foreground" />
                      <span className="text-2xl font-bold">{avgStreak}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Phase Distribution */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Distribuição por Fase</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-7 gap-3">
                    {phaseDistribution.map((p) => (
                      <div key={p.phase} className="flex flex-col items-center gap-2">
                        <div className="w-full flex flex-col items-center">
                          <span className="text-lg font-bold text-foreground">{p.count}</span>
                          <div className="w-full bg-secondary rounded-full h-2 mt-1">
                            <div
                              className="bg-primary rounded-full h-2 transition-all"
                              style={{ width: `${(p.count / maxPhaseCount) * 100}%` }}
                            />
                          </div>
                        </div>
                        <div className="text-center">
                          <p className="text-xs font-medium text-foreground">{p.phase}</p>
                          <p className="text-[10px] text-muted-foreground leading-tight">{p.name}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* User Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Usuários ({totalUsers})</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Fase</TableHead>
                        <TableHead>IGI</TableHead>
                        <TableHead>Streak</TableHead>
                        <TableHead>Sessões</TableHead>
                        <TableHead>Última Sessão</TableHead>
                        <TableHead>Cohort</TableHead>
                        <TableHead>PM Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users?.map((u: any) => (
                        <TableRow
                          key={u.id}
                          className="cursor-pointer"
                          onClick={() => {
                            setSelectedUser(u);
                            setPmResult(null);
                            setOverridePhase(u.current_phase || 1);
                          }}
                        >
                          <TableCell className="font-medium">
                            {u.profile?.nome || "Sem nome"}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {u.profile?.email || u.user_id.slice(0, 8)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {u.current_phase} — {PHASE_NAMES[u.current_phase] || "?"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono">
                            {Number(u.igi_current || 0).toFixed(2)}
                          </TableCell>
                          <TableCell>{u.streak_current || 0}</TableCell>
                          <TableCell>{u.total_sessions || 0}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {u.last_session_date
                              ? new Date(u.last_session_date).toLocaleDateString("pt-BR")
                              : "—"}
                          </TableCell>
                          <TableCell>
                            {u.cohort ? (
                              <Badge variant="secondary">{u.cohort}</Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {getPmStatus(u.user_id) ? (
                              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-transparent">ON</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-muted-foreground">OFF</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!users || users.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                            Nenhum usuário com registro IO encontrado.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}

          {/* User Detail Dialog */}
          <Dialog open={!!selectedUser} onOpenChange={(open) => { if (!open) { setSelectedUser(null); setPmResult(null); } }}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {selectedUser?.profile?.nome || "Usuário"} — Fase {selectedUser?.current_phase}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6">
                {/* IGI Chart */}
                {igiHistory.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-foreground mb-3">Evolução IGI</h3>
                    <div className="flex items-end gap-1 h-32 border border-border rounded-lg p-3 bg-muted/20">
                      {igiHistory.map((h: any, i: number) => (
                        <div
                          key={i}
                          className="flex-1 flex flex-col items-center justify-end gap-1"
                        >
                          <span className="text-[9px] text-muted-foreground font-mono">
                            {Number(h.value || 0).toFixed(1)}
                          </span>
                          <div
                            className="w-full bg-primary rounded-sm min-h-[2px] transition-all"
                            style={{ height: `${(Number(h.value || 0) / maxIgi) * 80}%` }}
                          />
                          <span className="text-[8px] text-muted-foreground truncate w-full text-center">
                            {h.date ? new Date(h.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Phase Transitions */}
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-3">Transições de Fase</h3>
                  {transitions && transitions.length > 0 ? (
                    <div className="space-y-2">
                      {transitions.map((t: any) => (
                        <div key={t.id} className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm">
                          <Badge variant="outline">{t.from_phase} → {t.to_phase}</Badge>
                          <span className="text-muted-foreground">
                            {t.transition_type}
                          </span>
                          <span className="ml-auto text-xs text-muted-foreground">
                            {new Date(t.created_at).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhuma transição registrada.</p>
                  )}
                </div>

                {/* Recent Sessions */}
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-3">Últimas Sessões</h3>
                  {sessions && sessions.length > 0 ? (
                    <div className="space-y-2">
                      {sessions.map((s: any) => (
                        <div key={s.id} className="rounded-lg border border-border p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-foreground">
                              {new Date(s.session_date).toLocaleDateString("pt-BR")}
                            </span>
                            <Badge variant={s.completed ? "default" : "secondary"}>
                              {s.completed ? "Completa" : "Incompleta"}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-7 gap-1 text-[10px]">
                            {[
                              { key: "clareza", label: "CLA" },
                              { key: "regulacao", label: "REG" },
                              { key: "identidade", label: "IDE" },
                              { key: "constancia", label: "CON" },
                              { key: "vitalidade", label: "VIT" },
                              { key: "agencia", label: "AGE" },
                              { key: "autonomia", label: "AUT" },
                            ].map((dim) => {
                              const val = s[`escala_${dim.key}`];
                              return (
                                <div key={dim.key} className="flex flex-col items-center gap-0.5">
                                  <span className="text-muted-foreground">{dim.label}</span>
                                  <span className="font-mono font-medium text-foreground">
                                    {val != null ? val : "—"}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhuma sessão registrada.</p>
                  )}
                </div>

                <Separator />

                {/* Phase Manager Test Section */}
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                    <Settings2 className="h-4 w-4" />
                    Phase Manager
                    {selectedUser && (
                      getPmStatus(selectedUser.user_id) ? (
                        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-transparent text-[10px]">ON</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-muted-foreground text-[10px]">OFF</Badge>
                      )
                    )}
                  </h3>

                  <div className="space-y-3">
                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleGetStatus}
                        disabled={pmLoading}
                      >
                        {pmLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                        Verificar Status
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleEvaluate}
                        disabled={pmLoading}
                      >
                        {pmLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Play className="h-3 w-3 mr-1" />}
                        Avaliar Fase
                      </Button>
                    </div>

                    {/* Manual Override */}
                    <div className="flex items-center gap-2">
                      <select
                        value={overridePhase}
                        onChange={(e) => setOverridePhase(Number(e.target.value))}
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                      >
                        {[1, 2, 3, 4, 5, 6, 7].map((p) => (
                          <option key={p} value={p}>
                            Fase {p} — {PHASE_NAMES[p]}
                          </option>
                        ))}
                      </select>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleManualOverride}
                        disabled={pmLoading}
                      >
                        {pmLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Settings2 className="h-3 w-3 mr-1" />}
                        Override Manual
                      </Button>
                    </div>

                    {/* Result Area */}
                    {pmResult && (
                      <div className="space-y-2">
                        {pmResult.skipped && (
                          <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                            <AlertDescription className="text-amber-800 dark:text-amber-300">
                              Phase Manager desabilitado para este usuário (flag off)
                            </AlertDescription>
                          </Alert>
                        )}
                        <pre className="rounded-lg border border-border bg-muted/30 p-3 text-xs font-mono overflow-x-auto max-h-64 overflow-y-auto text-foreground">
                          {JSON.stringify(pmResult, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </AdminLayout>
    </RoleRoute>
  );
};

export default IOOverview;
