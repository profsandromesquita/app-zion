import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import RoleRoute from "@/components/admin/RoleRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Users, CalendarCheck, Percent, TrendingUp, Flame, GitCompareArrows,
  AlertTriangle, AlertCircle, ArrowUpRight, ArrowDownRight, Minus,
  ExternalLink,
} from "lucide-react";
import { Link } from "react-router-dom";

type PeriodDays = 7 | 30 | 90 | null;

const PHASE_NAMES: Record<number, string> = {
  1: "Consciência", 2: "Regulação", 3: "Identidade", 4: "Constância",
  5: "Vitalidade", 6: "Agência", 7: "Autonomia",
};

const PERIOD_OPTIONS: { label: string; value: PeriodDays }[] = [
  { label: "7 dias", value: 7 },
  { label: "30 dias", value: 30 },
  { label: "90 dias", value: 90 },
  { label: "Todo período", value: null },
];

function cutoffDate(days: number | null): string | null {
  if (!days) return null;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

function prevCutoffDate(days: number | null): string | null {
  if (!days) return null;
  const d = new Date();
  d.setDate(d.getDate() - days * 2);
  return d.toISOString().split("T")[0];
}

const IODashboard = () => {
  const [periodDays, setPeriodDays] = useState<PeriodDays>(30);
  const cutoff = cutoffDate(periodDays);
  const prevCutoff = prevCutoffDate(periodDays);

  // ─── Queries ───────────────────────────────────────────
  const { data: userPhases, isLoading: loadingPhases } = useQuery({
    queryKey: ["io-dash-phases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("io_user_phase")
        .select("user_id, current_phase, igi_current, streak_current, total_sessions, last_session_date");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: sessions, isLoading: loadingSessions } = useQuery({
    queryKey: ["io-dash-sessions", cutoff, prevCutoff],
    queryFn: async () => {
      let q = supabase
        .from("io_daily_sessions")
        .select("id, user_id, session_date, completed, mission_id, mission_completed");
      if (prevCutoff) q = q.gte("session_date", prevCutoff);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: transitions, isLoading: loadingTransitions } = useQuery({
    queryKey: ["io-dash-transitions", cutoff, prevCutoff],
    queryFn: async () => {
      let q = supabase
        .from("io_phase_transitions")
        .select("id, from_phase, to_phase, transition_type, created_at");
      if (prevCutoff) q = q.gte("created_at", prevCutoff ? new Date(prevCutoff).toISOString() : "");
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: missions, isLoading: loadingMissions } = useQuery({
    queryKey: ["io-dash-missions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("io_missions")
        .select("id, title, phase, type");
      if (error) throw error;
      return data || [];
    },
  });

  const isLoading = loadingPhases || loadingSessions || loadingTransitions || loadingMissions;

  // ─── Computed metrics ──────────────────────────────────
  const metrics = useMemo(() => {
    if (!sessions || !userPhases || !transitions) return null;

    const now = cutoff;
    const prev = prevCutoff;

    const currentSessions = now
      ? sessions.filter((s) => s.session_date >= now)
      : sessions;
    const prevSessions = now && prev
      ? sessions.filter((s) => s.session_date >= prev && s.session_date < now)
      : [];

    const currentTransitions = now
      ? transitions.filter((t) => t.created_at >= new Date(now).toISOString())
      : transitions;
    const prevTransitions = now && prev
      ? transitions.filter((t) => t.created_at >= new Date(prev).toISOString() && t.created_at < new Date(now).toISOString())
      : [];

    // Active users
    const activeUsers = new Set(currentSessions.map((s) => s.user_id)).size;
    const prevActiveUsers = new Set(prevSessions.map((s) => s.user_id)).size;

    // Sessions completed
    const completed = currentSessions.filter((s) => s.completed);
    const prevCompleted = prevSessions.filter((s) => s.completed);
    const daysInPeriod = periodDays || Math.max(1, Math.ceil((Date.now() - new Date(sessions[0]?.session_date || Date.now()).getTime()) / 86400000));
    const avgPerDay = completed.length / Math.max(1, periodDays || daysInPeriod);

    // Completion rate
    const completionRate = currentSessions.length > 0 ? (completed.length / currentSessions.length) * 100 : 0;
    const prevCompletionRate = prevSessions.length > 0 ? (prevCompleted.length / prevSessions.length) * 100 : 0;

    // IGI & Streak
    const igiValues = userPhases.map((u) => Number(u.igi_current));
    const avgIgi = igiValues.length > 0 ? igiValues.reduce((a, b) => a + b, 0) / igiValues.length : 0;
    const streakValues = userPhases.map((u) => u.streak_current);
    const avgStreak = streakValues.length > 0 ? streakValues.reduce((a, b) => a + b, 0) / streakValues.length : 0;

    // Transitions
    const advances = currentTransitions.filter((t) => t.transition_type === "advance" || (t.to_phase > t.from_phase && t.transition_type !== "override"));
    const regressions = currentTransitions.filter((t) => t.transition_type === "regression" || (t.to_phase < t.from_phase && t.transition_type !== "override"));
    const overrides = currentTransitions.filter((t) => t.transition_type === "override");

    // Phase distribution
    const phaseDist = Array.from({ length: 7 }, (_, i) => {
      const phase = i + 1;
      const count = userPhases.filter((u) => u.current_phase === phase).length;
      return { phase, count, pct: userPhases.length > 0 ? (count / userPhases.length) * 100 : 0 };
    });

    // IGI by phase
    const igiByPhase = Array.from({ length: 7 }, (_, i) => {
      const phase = i + 1;
      const vals = userPhases.filter((u) => u.current_phase === phase).map((u) => Number(u.igi_current));
      return { phase, avg: vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0, count: vals.length };
    });

    // Sessions per day (last N days chart)
    const chartDays = Math.min(periodDays || 30, 30);
    const dailyCounts: { date: string; count: number }[] = [];
    for (let i = chartDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split("T")[0];
      dailyCounts.push({ date: ds, count: completed.filter((s) => s.session_date === ds).length });
    }

    // Alerts
    const zeroStreakUsers = userPhases.filter((u) => u.streak_current === 0 && u.total_sessions > 0).length;
    const recentRegressions = currentTransitions.filter((t) => t.transition_type === "regression" || (t.to_phase < t.from_phase && t.transition_type !== "override")).length;
    const today = new Date().toISOString().split("T")[0];
    const todayStarted = sessions.filter((s) => s.session_date === today).length;
    const todayIncomplete = sessions.filter((s) => s.session_date === today && !s.completed).length;

    // Top missions
    const missionMap = new Map(missions?.map((m) => [m.id, m]) || []);
    const missionCounts: Record<string, { assigned: number; completed: number }> = {};
    currentSessions.forEach((s) => {
      if (s.mission_id) {
        if (!missionCounts[s.mission_id]) missionCounts[s.mission_id] = { assigned: 0, completed: 0 };
        missionCounts[s.mission_id].assigned++;
        if (s.mission_completed) missionCounts[s.mission_id].completed++;
      }
    });
    const topMissions = Object.entries(missionCounts)
      .map(([id, counts]) => ({ ...missionMap.get(id), id, ...counts }))
      .sort((a, b) => b.assigned - a.assigned)
      .slice(0, 10);

    return {
      activeUsers, prevActiveUsers,
      completedCount: completed.length, prevCompletedCount: prevCompleted.length, avgPerDay,
      completionRate, prevCompletionRate,
      avgIgi, avgStreak,
      advances: advances.length, regressions: regressions.length, overrides: overrides.length,
      totalTransitions: currentTransitions.length, prevTotalTransitions: prevTransitions.length,
      phaseDist, igiByPhase, dailyCounts,
      zeroStreakUsers, recentRegressions, todayIncomplete, completionRateLow: completionRate < 60,
      topMissions,
    };
  }, [sessions, userPhases, transitions, missions, cutoff, prevCutoff, periodDays]);

  // ─── Helpers ───────────────────────────────────────────
  const Variation = ({ current, previous, suffix = "" }: { current: number; previous: number; suffix?: string }) => {
    const diff = current - previous;
    if (diff > 0) return <span className="text-green-500 flex items-center gap-0.5 text-xs"><ArrowUpRight className="h-3 w-3" />+{diff.toFixed(suffix === "%" ? 1 : 0)}{suffix}</span>;
    if (diff < 0) return <span className="text-red-500 flex items-center gap-0.5 text-xs"><ArrowDownRight className="h-3 w-3" />{diff.toFixed(suffix === "%" ? 1 : 0)}{suffix}</span>;
    return <span className="text-muted-foreground flex items-center gap-0.5 text-xs"><Minus className="h-3 w-3" />0{suffix}</span>;
  };

  return (
    <RoleRoute allowedRoles={["admin", "desenvolvedor"]}>
      <AdminLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Dashboard IO — Operação do Método</h1>
              <p className="text-sm text-muted-foreground">Métricas agregadas do método IO</p>
            </div>
            <div className="flex gap-1 bg-muted rounded-lg p-1">
              {PERIOD_OPTIONS.map((opt) => (
                <Button
                  key={String(opt.value)}
                  variant={periodDays === opt.value ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setPeriodDays(opt.value)}
                  className="text-xs"
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}><CardContent className="p-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
              ))}
            </div>
          ) : metrics ? (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <KPICard
                  icon={Users} title="Usuários IO ativos" value={metrics.activeUsers}
                  subtitle={periodDays ? <Variation current={metrics.activeUsers} previous={metrics.prevActiveUsers} /> : undefined}
                />
                <KPICard
                  icon={CalendarCheck} title="Sessões completadas" value={metrics.completedCount}
                  subtitle={<span className="text-xs text-muted-foreground">{metrics.avgPerDay.toFixed(1)}/dia</span>}
                  extra={periodDays ? <Variation current={metrics.completedCount} previous={metrics.prevCompletedCount} /> : undefined}
                />
                <KPICard
                  icon={Percent} title="Taxa de completude" value={`${metrics.completionRate.toFixed(1)}%`}
                  subtitle={periodDays ? <Variation current={metrics.completionRate} previous={metrics.prevCompletionRate} suffix="%" /> : undefined}
                  alert={metrics.completionRateLow}
                />
                <KPICard
                  icon={TrendingUp} title="IGI médio" value={metrics.avgIgi.toFixed(2)}
                />
                <KPICard
                  icon={Flame} title="Streak médio" value={metrics.avgStreak.toFixed(1)}
                  highlight={metrics.avgStreak > 5}
                />
                <KPICard
                  icon={GitCompareArrows} title="Transições de fase"
                  value={metrics.totalTransitions}
                  subtitle={
                    <div className="flex gap-2 text-xs">
                      <span className="text-primary">↑{metrics.advances}</span>
                      <span className="text-destructive">↓{metrics.regressions}</span>
                      <span className="text-muted-foreground">⚙{metrics.overrides}</span>
                    </div>
                  }
                />
              </div>

              {/* Sessions per day chart */}
              <Card>
                <CardHeader><CardTitle className="text-base">Sessões completadas por dia</CardTitle></CardHeader>
                <CardContent>
                  <SessionsChart data={metrics.dailyCounts} />
                </CardContent>
              </Card>

              {/* Phase distribution + IGI by phase */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader><CardTitle className="text-base">Distribuição por fase</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {metrics.phaseDist.map((p) => (
                      <PhaseBar key={p.phase} phase={p.phase} count={p.count} pct={p.pct} maxCount={Math.max(...metrics.phaseDist.map((d) => d.count), 1)} />
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-base">IGI médio por fase</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {metrics.igiByPhase.map((p) => (
                        <div key={p.phase} className="rounded-lg border border-border p-3 text-center">
                          <p className="text-xs text-muted-foreground">Fase {p.phase}</p>
                          <p className="text-lg font-bold text-foreground">{p.count > 0 ? p.avg.toFixed(2) : "—"}</p>
                          <p className="text-[10px] text-muted-foreground">{p.count} user{p.count !== 1 ? "s" : ""}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Alerts */}
              <Card className={metrics.completionRateLow || metrics.recentRegressions > 0 ? "border-destructive/50" : ""}>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Alertas operacionais</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {metrics.zeroStreakUsers > 0 && (
                    <AlertItem level="warning">{metrics.zeroStreakUsers} usuário(s) com streak = 0 (sem sessão recente)</AlertItem>
                  )}
                  {metrics.recentRegressions > 0 && (
                    <AlertItem level="critical">{metrics.recentRegressions} regressão(ões) no período</AlertItem>
                  )}
                  {metrics.todayIncomplete > 0 && (
                    <AlertItem level="warning">{metrics.todayIncomplete} sessão(ões) iniciada(s) mas não concluída(s) hoje</AlertItem>
                  )}
                  {metrics.completionRateLow && (
                    <AlertItem level="critical">Taxa de completude abaixo de 60% ({metrics.completionRate.toFixed(1)}%)</AlertItem>
                  )}
                  {metrics.zeroStreakUsers === 0 && metrics.recentRegressions === 0 && metrics.todayIncomplete === 0 && !metrics.completionRateLow && (
                    <p className="text-sm text-muted-foreground">Nenhum alerta ativo ✓</p>
                  )}
                </CardContent>
              </Card>

              {/* Top missions */}
              {metrics.topMissions.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Top missões atribuídas</CardTitle></CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Missão</TableHead>
                          <TableHead>Fase</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead className="text-right">Atribuídas</TableHead>
                          <TableHead className="text-right">Completadas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {metrics.topMissions.map((m: any) => (
                          <TableRow key={m.id}>
                            <TableCell className="font-medium">{m.title || m.id}</TableCell>
                            <TableCell><Badge variant="outline">{m.phase ?? "—"}</Badge></TableCell>
                            <TableCell className="text-muted-foreground">{m.type || "—"}</TableCell>
                            <TableCell className="text-right">{m.assigned}</TableCell>
                            <TableCell className="text-right">{m.completed}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Quick links */}
              <div className="flex flex-wrap gap-2">
                <Link to="/admin/io-overview"><Button variant="outline" size="sm"><ExternalLink className="mr-1 h-3 w-3" />IO Overview</Button></Link>
                <Link to="/admin/cohorts"><Button variant="outline" size="sm"><ExternalLink className="mr-1 h-3 w-3" />Cohorts</Button></Link>
                <Link to="/admin/feature-flags"><Button variant="outline" size="sm"><ExternalLink className="mr-1 h-3 w-3" />Feature Flags</Button></Link>
              </div>
            </>
          ) : null}
        </div>
      </AdminLayout>
    </RoleRoute>
  );
};

// ─── Sub-components ────────────────────────────────────

function KPICard({ icon: Icon, title, value, subtitle, extra, alert, highlight }: {
  icon: any; title: string; value: string | number;
  subtitle?: React.ReactNode; extra?: React.ReactNode;
  alert?: boolean; highlight?: boolean;
}) {
  return (
    <Card className={alert ? "border-destructive/50 bg-destructive/5" : highlight ? "border-green-500/50 bg-green-500/5" : ""}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <div className="flex items-center gap-2">{subtitle}{extra}</div>
          </div>
          <div className="rounded-lg bg-muted p-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SessionsChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-1 h-40">
      {data.map((d) => {
        const h = (d.count / max) * 100;
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group">
            <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
              {d.count}
            </span>
            <div
              className="w-full bg-primary/80 rounded-t-sm transition-all hover:bg-primary min-h-[2px]"
              style={{ height: `${Math.max(h, 2)}%` }}
            />
            <span className="text-[9px] text-muted-foreground hidden sm:block">
              {d.date.slice(5)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function PhaseBar({ phase, count, pct, maxCount }: { phase: number; count: number; pct: number; maxCount: number }) {
  const w = (count / maxCount) * 100;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-24 shrink-0">Fase {phase} — {PHASE_NAMES[phase]}</span>
      <div className="flex-1 bg-muted rounded-full h-5 overflow-hidden">
        <div className="bg-primary/70 h-full rounded-full transition-all flex items-center justify-end pr-2" style={{ width: `${Math.max(w, 2)}%` }}>
          {count > 0 && <span className="text-[10px] font-medium text-primary-foreground">{count}</span>}
        </div>
      </div>
      <span className="text-xs text-muted-foreground w-12 text-right">{pct.toFixed(0)}%</span>
    </div>
  );
}

function AlertItem({ level, children }: { level: "critical" | "warning"; children: React.ReactNode }) {
  return (
    <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
      level === "critical" ? "bg-destructive/10 text-destructive" : "bg-accent text-accent-foreground"
    }`}>
      <AlertCircle className="h-4 w-4 shrink-0" />
      {children}
    </div>
  );
}

export default IODashboard;
