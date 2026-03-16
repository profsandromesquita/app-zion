import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { FullAdminRoute } from "@/components/admin/RoleRoute";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertTriangle, ArrowUpRight, ArrowDownRight, Settings2, Circle, Eye, Calendar, Users, CheckCircle2, Clock, Activity } from "lucide-react";
import { format, subDays, isAfter, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

type TransitionType = "advance" | "regression" | "manual_override" | "initial_placement";

const transitionBadge: Record<string, { label: string; variant: "default" | "destructive" | "secondary" | "outline"; icon: React.ReactNode }> = {
  advance: { label: "Avanço", variant: "default", icon: <ArrowUpRight className="h-3 w-3" /> },
  regression: { label: "Regressão", variant: "destructive", icon: <ArrowDownRight className="h-3 w-3" /> },
  manual_override: { label: "Override Manual", variant: "secondary", icon: <Settings2 className="h-3 w-3" /> },
  initial_placement: { label: "Posição Inicial", variant: "outline", icon: <Circle className="h-3 w-3" /> },
};

const IOAudit = () => {
  // --- Transitions state ---
  const [transTypeFilter, setTransTypeFilter] = useState<string>("all");
  const [transUserSearch, setTransUserSearch] = useState("");
  const [transPeriod, setTransPeriod] = useState<string>("all");
  const [selectedTransition, setSelectedTransition] = useState<any>(null);

  // --- Sessions state ---
  const [sessUserSearch, setSessUserSearch] = useState("");
  const [sessPhaseFilter, setSessPhaseFilter] = useState<string>("all");
  const [sessStatusFilter, setSessStatusFilter] = useState<string>("all");
  const [sessPeriod, setSessPeriod] = useState<string>("all");
  const [selectedSession, setSelectedSession] = useState<any>(null);

  // --- Queries ---
  const { data: transitions, isLoading: loadingTrans } = useQuery({
    queryKey: ["io-transitions-audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("io_phase_transitions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: dailySessions, isLoading: loadingSessions } = useQuery({
    queryKey: ["io-daily-sessions-audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("io_daily_sessions")
        .select("*")
        .order("session_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: missions } = useQuery({
    queryKey: ["io-missions-lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("io_missions").select("id, title, description");
      return data || [];
    },
  });

  // Collect unique user_ids from both datasets
  const allUserIds = useMemo(() => {
    const ids = new Set<string>();
    transitions?.forEach((t) => ids.add(t.user_id));
    dailySessions?.forEach((s) => ids.add(s.user_id));
    return Array.from(ids);
  }, [transitions, dailySessions]);

  const { data: profiles } = useQuery({
    queryKey: ["profiles-audit", allUserIds],
    enabled: allUserIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .in("id", allUserIds);
      return data || [];
    },
  });

  const profileMap = useMemo(() => {
    const map: Record<string, { nome: string | null; email: string | null }> = {};
    profiles?.forEach((p) => (map[p.id] = { nome: p.nome, email: p.email }));
    return map;
  }, [profiles]);

  const missionMap = useMemo(() => {
    const map: Record<string, { title: string; description: string }> = {};
    missions?.forEach((m) => (map[m.id] = { title: m.title, description: m.description }));
    return map;
  }, [missions]);

  // --- Filter helpers ---
  const periodCutoff = (period: string) => {
    if (period === "7d") return subDays(new Date(), 7);
    if (period === "30d") return subDays(new Date(), 30);
    if (period === "90d") return subDays(new Date(), 90);
    return null;
  };

  const matchesUser = (userId: string, search: string) => {
    if (!search) return true;
    const p = profileMap[userId];
    const lower = search.toLowerCase();
    return (
      (p?.nome?.toLowerCase().includes(lower) ?? false) ||
      (p?.email?.toLowerCase().includes(lower) ?? false) ||
      userId.toLowerCase().includes(lower)
    );
  };

  // --- Filtered transitions ---
  const filteredTransitions = useMemo(() => {
    if (!transitions) return [];
    return transitions.filter((t) => {
      if (transTypeFilter !== "all" && t.transition_type !== transTypeFilter) return false;
      if (!matchesUser(t.user_id, transUserSearch)) return false;
      const cutoff = periodCutoff(transPeriod);
      if (cutoff && !isAfter(parseISO(t.created_at), cutoff)) return false;
      return true;
    });
  }, [transitions, transTypeFilter, transUserSearch, transPeriod, profileMap]);

  // Regressions last 7 days
  const recentRegressions = useMemo(() => {
    if (!transitions) return [];
    const cutoff = subDays(new Date(), 7);
    return transitions.filter(
      (t) => t.transition_type === "regression" && isAfter(parseISO(t.created_at), cutoff)
    );
  }, [transitions]);

  // --- Filtered sessions ---
  const filteredSessions = useMemo(() => {
    if (!dailySessions) return [];
    return dailySessions.filter((s) => {
      if (!matchesUser(s.user_id, sessUserSearch)) return false;
      if (sessPhaseFilter !== "all" && s.phase_at_session !== Number(sessPhaseFilter)) return false;
      if (sessStatusFilter === "complete" && !s.completed) return false;
      if (sessStatusFilter === "incomplete" && s.completed) return false;
      const cutoff = periodCutoff(sessPeriod);
      if (cutoff && !isAfter(parseISO(s.created_at), cutoff)) return false;
      return true;
    });
  }, [dailySessions, sessUserSearch, sessPhaseFilter, sessStatusFilter, sessPeriod, profileMap]);

  // --- Session metrics ---
  const sessionMetrics = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    const todayCount = filteredSessions.filter((s) => s.session_date === today).length;
    const completed = filteredSessions.filter((s) => s.completed).length;
    const completionRate = filteredSessions.length > 0 ? Math.round((completed / filteredSessions.length) * 100) : 0;
    const durations = filteredSessions.filter((s) => s.duration_seconds).map((s) => s.duration_seconds!);
    const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 60) : 0;
    return { todayCount, total: filteredSessions.length, completionRate, avgDuration };
  }, [filteredSessions]);

  const userName = (uid: string) => profileMap[uid]?.nome || profileMap[uid]?.email || uid.slice(0, 8);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Auditoria IO</h1>
          <p className="text-muted-foreground">Transições de fase e monitor de sessões diárias</p>
        </div>

        <Tabs defaultValue="transitions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="transitions">Transições de Fase</TabsTrigger>
            <TabsTrigger value="sessions">Monitor de Sessões</TabsTrigger>
          </TabsList>

          {/* ========== TAB 1: TRANSITIONS ========== */}
          <TabsContent value="transitions" className="space-y-4">
            {/* Regression alert */}
            {recentRegressions.length > 0 && (
              <Card className="border-destructive bg-destructive/5">
                <CardContent className="flex items-center gap-3 py-4">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <div>
                    <p className="font-semibold text-destructive">
                      {recentRegressions.length} regressão(ões) nos últimos 7 dias
                    </p>
                    <div className="mt-1 space-y-1">
                      {recentRegressions.slice(0, 3).map((r) => (
                        <p key={r.id} className="text-sm text-muted-foreground">
                          {userName(r.user_id)}: Fase {r.from_phase} → {r.to_phase} em{" "}
                          {format(parseISO(r.created_at), "dd/MM HH:mm")}
                        </p>
                      ))}
                      {recentRegressions.length > 3 && (
                        <p className="text-sm text-muted-foreground">
                          +{recentRegressions.length - 3} mais...
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <Select value={transTypeFilter} onValueChange={setTransTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="advance">Avanço</SelectItem>
                  <SelectItem value="regression">Regressão</SelectItem>
                  <SelectItem value="manual_override">Override Manual</SelectItem>
                  <SelectItem value="initial_placement">Posição Inicial</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Buscar usuário..."
                value={transUserSearch}
                onChange={(e) => setTransUserSearch(e.target.value)}
                className="w-[200px]"
              />
              <Select value={transPeriod} onValueChange={setTransPeriod}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todo período</SelectItem>
                  <SelectItem value="7d">Últimos 7 dias</SelectItem>
                  <SelectItem value="30d">Últimos 30 dias</SelectItem>
                  <SelectItem value="90d">Últimos 90 dias</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground self-center">
                {filteredTransitions.length} transição(ões)
              </span>
            </div>

            {/* Table */}
            {loadingTrans ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>De</TableHead>
                      <TableHead>Para</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Disparado por</TableHead>
                      <TableHead>Notas</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransitions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          Nenhuma transição encontrada
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTransitions.map((t) => {
                        const badge = transitionBadge[t.transition_type] || transitionBadge.initial_placement;
                        return (
                          <TableRow key={t.id}>
                            <TableCell className="whitespace-nowrap text-sm">
                              {format(parseISO(t.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm">{profileMap[t.user_id]?.nome || "—"}</p>
                                <p className="text-xs text-muted-foreground">{profileMap[t.user_id]?.email || t.user_id.slice(0, 8)}</p>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono">Fase {t.from_phase}</TableCell>
                            <TableCell className="font-mono">Fase {t.to_phase}</TableCell>
                            <TableCell>
                              <Badge variant={badge.variant} className="gap-1">
                                {badge.icon}
                                {badge.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">{t.triggered_by}</TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                              {t.notes || "—"}
                            </TableCell>
                            <TableCell>
                              <Button size="sm" variant="ghost" onClick={() => setSelectedTransition(t)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          {/* ========== TAB 2: SESSIONS ========== */}
          <TabsContent value="sessions" className="space-y-4">
            {/* Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4 pb-3 flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{sessionMetrics.todayCount}</p>
                    <p className="text-xs text-muted-foreground">Sessões hoje</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3 flex items-center gap-3">
                  <Users className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{sessionMetrics.total}</p>
                    <p className="text-xs text-muted-foreground">Total no período</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3 flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{sessionMetrics.completionRate}%</p>
                    <p className="text-xs text-muted-foreground">Taxa completude</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3 flex items-center gap-3">
                  <Clock className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{sessionMetrics.avgDuration}min</p>
                    <p className="text-xs text-muted-foreground">Duração média</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <Input
                placeholder="Buscar usuário..."
                value={sessUserSearch}
                onChange={(e) => setSessUserSearch(e.target.value)}
                className="w-[200px]"
              />
              <Select value={sessPhaseFilter} onValueChange={setSessPhaseFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Fase" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas fases</SelectItem>
                  {[1, 2, 3, 4, 5, 6, 7].map((p) => (
                    <SelectItem key={p} value={String(p)}>Fase {p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sessStatusFilter} onValueChange={setSessStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="complete">Completas</SelectItem>
                  <SelectItem value="incomplete">Incompletas</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sessPeriod} onValueChange={setSessPeriod}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todo período</SelectItem>
                  <SelectItem value="7d">Últimos 7 dias</SelectItem>
                  <SelectItem value="30d">Últimos 30 dias</SelectItem>
                  <SelectItem value="90d">Últimos 90 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            {loadingSessions ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Fase</TableHead>
                      <TableHead>Mood</TableHead>
                      <TableHead>Missão</TableHead>
                      <TableHead>Escalas</TableHead>
                      <TableHead>IGI</TableHead>
                      <TableHead>Duração</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSessions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                          Nenhuma sessão encontrada
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredSessions.map((s) => {
                        const scales = [s.escala_clareza, s.escala_regulacao, s.escala_identidade, s.escala_constancia, s.escala_vitalidade, s.escala_autonomia, s.escala_agencia];
                        const filledScales = scales.filter((v) => v != null).length;
                        const mission = s.mission_id ? missionMap[s.mission_id] : null;
                        return (
                          <TableRow key={s.id}>
                            <TableCell className="whitespace-nowrap text-sm">{s.session_date}</TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm">{profileMap[s.user_id]?.nome || "—"}</p>
                                <p className="text-xs text-muted-foreground">{profileMap[s.user_id]?.email || s.user_id.slice(0, 8)}</p>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono">{s.phase_at_session}</TableCell>
                            <TableCell className="text-sm">{s.check_in_mood || "—"}</TableCell>
                            <TableCell className="text-sm max-w-[150px] truncate">
                              {mission?.title || (s.mission_id ? "..." : "—")}
                            </TableCell>
                            <TableCell className="text-sm">{filledScales}/7</TableCell>
                            <TableCell className="font-mono text-sm">{s.igi_at_session ?? "—"}</TableCell>
                            <TableCell className="text-sm">
                              {s.duration_seconds ? `${Math.round(s.duration_seconds / 60)}min` : "—"}
                            </TableCell>
                            <TableCell>
                              <Badge variant={s.completed ? "default" : "secondary"}>
                                {s.completed ? "Completa" : "Incompleta"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button size="sm" variant="ghost" onClick={() => setSelectedSession(s)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* ========== TRANSITION DETAIL DIALOG ========== */}
        <Dialog open={!!selectedTransition} onOpenChange={(o) => !o && setSelectedTransition(null)}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalhe da Transição</DialogTitle>
            </DialogHeader>
            {selectedTransition && (() => {
              const t = selectedTransition;
              const badge = transitionBadge[t.transition_type] || transitionBadge.initial_placement;
              const snapshot = t.criteria_snapshot as Record<string, any> | null;
              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Usuário</p>
                      <p className="font-medium">{userName(t.user_id)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Data</p>
                      <p className="font-medium">{format(parseISO(t.created_at), "dd/MM/yyyy HH:mm:ss")}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">De → Para</p>
                      <p className="font-medium">Fase {t.from_phase} → Fase {t.to_phase}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Tipo</p>
                      <Badge variant={badge.variant} className="gap-1">{badge.icon}{badge.label}</Badge>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Disparado por</p>
                      <p className="font-medium">{t.triggered_by}</p>
                    </div>
                  </div>

                  {t.notes && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Notas</p>
                      <p className="text-sm bg-muted rounded p-2">{t.notes}</p>
                    </div>
                  )}

                  {snapshot && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Criteria Snapshot</p>
                      <div className="space-y-2">
                        {snapshot.igi_current != null && (
                          <div className="flex justify-between text-sm">
                            <span>IGI</span>
                            <span className="font-mono">{snapshot.igi_current}</span>
                          </div>
                        )}
                        {snapshot.streak_current != null && (
                          <div className="flex justify-between text-sm">
                            <span>Streak</span>
                            <span className="font-mono">{snapshot.streak_current}</span>
                          </div>
                        )}
                        {snapshot.total_sessions != null && (
                          <div className="flex justify-between text-sm">
                            <span>Total sessões</span>
                            <span className="font-mono">{snapshot.total_sessions}</span>
                          </div>
                        )}
                      </div>
                      <pre className="text-xs bg-muted rounded p-3 mt-2 overflow-x-auto max-h-[200px]">
                        {JSON.stringify(snapshot, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>

        {/* ========== SESSION DETAIL DIALOG ========== */}
        <Dialog open={!!selectedSession} onOpenChange={(o) => !o && setSelectedSession(null)}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalhe da Sessão</DialogTitle>
            </DialogHeader>
            {selectedSession && (() => {
              const s = selectedSession;
              const mission = s.mission_id ? missionMap[s.mission_id] : null;
              const scales = [
                { label: "Clareza", value: s.escala_clareza },
                { label: "Regulação", value: s.escala_regulacao },
                { label: "Identidade", value: s.escala_identidade },
                { label: "Constância", value: s.escala_constancia },
                { label: "Vitalidade", value: s.escala_vitalidade },
                { label: "Autonomia", value: s.escala_autonomia },
                { label: "Agência", value: s.escala_agencia },
              ];
              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Usuário</p>
                      <p className="font-medium">{userName(s.user_id)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Data</p>
                      <p className="font-medium">{s.session_date}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Fase</p>
                      <p className="font-medium">Fase {s.phase_at_session}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Mood</p>
                      <p className="font-medium">{s.check_in_mood || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">IGI</p>
                      <p className="font-mono font-medium">{s.igi_at_session ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Duração</p>
                      <p className="font-medium">{s.duration_seconds ? `${Math.round(s.duration_seconds / 60)} min` : "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Status</p>
                      <Badge variant={s.completed ? "default" : "secondary"}>
                        {s.completed ? "Completa" : "Incompleta"}
                      </Badge>
                    </div>
                  </div>

                  {/* Scales */}
                  <div>
                    <p className="text-sm font-semibold mb-2">Escalas (7 dimensões)</p>
                    <div className="grid grid-cols-2 gap-2">
                      {scales.map((sc) => (
                        <div key={sc.label} className="flex justify-between text-sm bg-muted rounded px-3 py-1.5">
                          <span>{sc.label}</span>
                          <span className="font-mono font-medium">{sc.value ?? "—"}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Mission */}
                  {mission && (
                    <div>
                      <p className="text-sm font-semibold mb-1">Missão atribuída</p>
                      <div className="bg-muted rounded p-3">
                        <p className="font-medium text-sm">{mission.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">{mission.description}</p>
                        <Badge variant={s.mission_completed ? "default" : "secondary"} className="mt-2">
                          {s.mission_completed ? "Missão completada" : "Não completada"}
                        </Badge>
                      </div>
                    </div>
                  )}

                  {/* Text fields */}
                  {s.registro_text && (
                    <div>
                      <p className="text-sm font-semibold mb-1">Registro</p>
                      <p className="text-sm bg-muted rounded p-2">{s.registro_text}</p>
                    </div>
                  )}
                  {s.feedback_generated && (
                    <div>
                      <p className="text-sm font-semibold mb-1">Feedback gerado</p>
                      <p className="text-sm bg-muted rounded p-2">{s.feedback_generated}</p>
                    </div>
                  )}
                  {s.reforco_identitario && (
                    <div>
                      <p className="text-sm font-semibold mb-1">Reforço identitário</p>
                      <p className="text-sm bg-muted rounded p-2">{s.reforco_identitario}</p>
                    </div>
                  )}
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default IOAudit;
