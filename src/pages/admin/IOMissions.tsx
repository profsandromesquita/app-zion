import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { FullAdminRoute } from "@/components/admin/RoleRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, BarChart3, Target } from "lucide-react";

type Mission = {
  id: string;
  phase: number;
  week_range: string;
  title: string;
  description: string;
  type: string;
  difficulty: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type MissionForm = {
  phase: number;
  week_range: string;
  title: string;
  description: string;
  type: string;
  difficulty: string;
  is_active: boolean;
};

const emptyForm: MissionForm = {
  phase: 1,
  week_range: "1-2",
  title: "",
  description: "",
  type: "reflexão",
  difficulty: "simples",
  is_active: true,
};

const TYPES = ["reflexão", "prática", "observação", "registro", "ação"];
const DIFFICULTIES = ["simples", "moderada", "profunda"];
const WEEK_RANGES = ["1-2", "3-4", "5-6", "7-9"];

const typeBadgeColor: Record<string, string> = {
  reflexão: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  prática: "bg-green-500/20 text-green-400 border-green-500/30",
  observação: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  registro: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  ação: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

const diffBadgeColor: Record<string, string> = {
  simples: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  moderada: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  profunda: "bg-red-500/20 text-red-400 border-red-500/30",
};

const IOMissions = () => {
  const queryClient = useQueryClient();
  const [filterPhase, setFilterPhase] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterActive, setFilterActive] = useState<string>("all");
  const [editDialog, setEditDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MissionForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [statsDialog, setStatsDialog] = useState(false);
  const [statsMission, setStatsMission] = useState<Mission | null>(null);

  const { data: missions, isLoading } = useQuery({
    queryKey: ["io-missions-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("io_missions")
        .select("*")
        .order("phase")
        .order("week_range");
      if (error) throw error;
      return data as Mission[];
    },
  });

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["io-mission-stats", statsMission?.id],
    enabled: !!statsMission,
    queryFn: async () => {
      if (!statsMission) return null;
      const { data, error } = await supabase
        .from("io_daily_sessions")
        .select("id, mission_completed, session_date, user_id")
        .eq("mission_id", statsMission.id)
        .order("session_date", { ascending: false });
      if (error) throw error;
      const total = data.length;
      const completed = data.filter((s) => s.mission_completed).length;
      const rate = total > 0 ? ((completed / total) * 100).toFixed(1) : "0";
      const recent = data.slice(0, 5);
      return { total, completed, rate, recent };
    },
  });

  const filtered = (missions || []).filter((m) => {
    if (filterPhase !== "all" && m.phase !== Number(filterPhase)) return false;
    if (filterType !== "all" && m.type !== filterType) return false;
    if (filterActive === "active" && !m.is_active) return false;
    if (filterActive === "inactive" && m.is_active) return false;
    return true;
  });

  const phaseCounts = (missions || []).reduce<Record<number, number>>((acc, m) => {
    acc[m.phase] = (acc[m.phase] || 0) + 1;
    return acc;
  }, {});

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setEditDialog(true);
  };

  const openEdit = (m: Mission) => {
    setEditingId(m.id);
    setForm({
      phase: m.phase,
      week_range: m.week_range,
      title: m.title,
      description: m.description,
      type: m.type,
      difficulty: m.difficulty,
      is_active: m.is_active,
    });
    setEditDialog(true);
  };

  const openStats = (m: Mission) => {
    setStatsMission(m);
    setStatsDialog(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.description.trim()) {
      toast({ title: "Preencha título e descrição", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from("io_missions")
          .update({
            phase: form.phase,
            week_range: form.week_range,
            title: form.title.slice(0, 100),
            description: form.description.slice(0, 500),
            type: form.type,
            difficulty: form.difficulty,
            is_active: form.is_active,
          })
          .eq("id", editingId);
        if (error) throw error;
        toast({ title: "Missão atualizada" });
      } else {
        const { error } = await supabase.from("io_missions").insert({
          phase: form.phase,
          week_range: form.week_range,
          title: form.title.slice(0, 100),
          description: form.description.slice(0, 500),
          type: form.type,
          difficulty: form.difficulty,
          is_active: form.is_active,
        });
        if (error) throw error;
        toast({ title: "Missão criada" });
      }
      queryClient.invalidateQueries({ queryKey: ["io-missions-admin"] });
      setEditDialog(false);
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (m: Mission) => {
    const { error } = await supabase
      .from("io_missions")
      .update({ is_active: !m.is_active })
      .eq("id", m.id);
    if (error) {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["io-missions-admin"] });
  };

  return (
    <FullAdminRoute>
      <AdminLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Target className="h-6 w-6 text-primary" />
                Missões IO
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {missions?.length ?? 0} missões total
                {Object.entries(phaseCounts).map(([p, c]) => (
                  <span key={p} className="ml-2">· F{p}: {c}</span>
                ))}
              </p>
            </div>
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" /> Nova Missão
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <Select value={filterPhase} onValueChange={setFilterPhase}>
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
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos tipos</SelectItem>
                {TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterActive} onValueChange={setFilterActive}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="active">Ativas</SelectItem>
                <SelectItem value="inactive">Inativas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Fase</TableHead>
                      <TableHead className="w-20">Semanas</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead className="w-28">Tipo</TableHead>
                      <TableHead className="w-28">Dificuldade</TableHead>
                      <TableHead className="w-20">Ativa</TableHead>
                      <TableHead className="w-24">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          Nenhuma missão encontrada
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell className="font-medium">{m.phase}</TableCell>
                          <TableCell>{m.week_range}</TableCell>
                          <TableCell className="max-w-[240px] truncate">{m.title}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={typeBadgeColor[m.type] || ""}>
                              {m.type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={diffBadgeColor[m.difficulty] || ""}>
                              {m.difficulty}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Switch checked={m.is_active} onCheckedChange={() => toggleActive(m)} />
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" onClick={() => openEdit(m)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => openStats(m)}>
                                <BarChart3 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Create/Edit Dialog */}
        <Dialog open={editDialog} onOpenChange={setEditDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Missão" : "Nova Missão"}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fase *</Label>
                <Select value={String(form.phase)} onValueChange={(v) => setForm({ ...form, phase: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7].map((p) => (
                      <SelectItem key={p} value={String(p)}>Fase {p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Semanas *</Label>
                <Select value={form.week_range} onValueChange={(v) => setForm({ ...form, week_range: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WEEK_RANGES.map((w) => (
                      <SelectItem key={w} value={w}>{w}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Título * <span className="text-muted-foreground text-xs">({form.title.length}/100)</span></Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value.slice(0, 100) })}
                  placeholder="Título da missão"
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Descrição * <span className="text-muted-foreground text-xs">({form.description.length}/500)</span></Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value.slice(0, 500) })}
                  placeholder="Descrição da missão"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Dificuldade</Label>
                <Select value={form.difficulty} onValueChange={(v) => setForm({ ...form, difficulty: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DIFFICULTIES.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3 col-span-2">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <Label>Ativa</Label>
              </div>

              {/* Preview */}
              {form.title && (
                <div className="col-span-2 border border-border rounded-lg p-4 bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-2">Preview da sessão diária</p>
                  <div className="rounded-lg border border-primary/20 bg-card p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-foreground text-sm">Missão do Dia</span>
                    </div>
                    <p className="text-foreground font-medium">{form.title}</p>
                    <p className="text-sm text-muted-foreground">{form.description}</p>
                    <div className="flex gap-2">
                      <Badge variant="outline" className={typeBadgeColor[form.type] || ""}>{form.type}</Badge>
                      <Badge variant="outline" className={diffBadgeColor[form.difficulty] || ""}>{form.difficulty}</Badge>
                      <Badge variant="outline">Fase {form.phase}</Badge>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditDialog(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Criar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Stats Dialog */}
        <Dialog open={statsDialog} onOpenChange={(v) => { setStatsDialog(v); if (!v) setStatsMission(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Estatísticas: {statsMission?.title}</DialogTitle>
            </DialogHeader>
            {statsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : statsData ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold text-foreground">{statsData.total}</p>
                      <p className="text-xs text-muted-foreground">Atribuídas</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold text-foreground">{statsData.completed}</p>
                      <p className="text-xs text-muted-foreground">Completadas</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold text-foreground">{statsData.rate}%</p>
                      <p className="text-xs text-muted-foreground">Taxa</p>
                    </CardContent>
                  </Card>
                </div>
                {statsData.recent.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-foreground mb-2">Últimas atribuições</p>
                    <div className="space-y-1">
                      {statsData.recent.map((r) => (
                        <div key={r.id} className="flex justify-between text-sm text-muted-foreground border-b border-border py-1">
                          <span className="font-mono text-xs">{r.user_id.slice(0, 8)}…</span>
                          <span>{r.session_date}</span>
                          <Badge variant="outline" className={r.mission_completed ? "text-green-400" : "text-muted-foreground"}>
                            {r.mission_completed ? "✓" : "—"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Sem dados disponíveis</p>
            )}
          </DialogContent>
        </Dialog>
      </AdminLayout>
    </FullAdminRoute>
  );
};

export default IOMissions;
