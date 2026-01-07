import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Map as MapIcon,
  TrendingUp,
  AlertTriangle,
  Download,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  XCircle,
  Sparkles,
  Eye,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

// Types
interface TurnInsight {
  id: string;
  created_at: string;
  chat_session_id: string;
  message_user_id: string;
  message_assistant_id: string;
  turn_number: number;
  phase: string | null;
  phase_confidence: number | null;
  primary_emotions: string[] | null;
  emotion_intensity: number | null;
  emotion_stability: string | null;
  zion_cycle: Record<string, any> | null;
  lie_active: Record<string, any> | null;
  truth_target: Record<string, any> | null;
  shift_detected: boolean | null;
  shift_description: string | null;
  shift_evidence: string[] | null;
  primary_virtue: Record<string, any> | null;
  next_best_question_type: string | null;
  quality_metrics: Record<string, any> | null;
  rubric_scores: Record<string, any> | null;
  overall_score: number | null;
  issues_detected: string[] | null;
  quality_rationale: string | null;
  admin_confirmed: boolean | null;
  admin_notes: string | null;
  include_in_training: boolean | null;
  exclude_from_training: boolean | null;
  extraction_status: string | null;
}

interface SessionSummary {
  session_id: string;
  turn_count: number;
  latest_phase: string | null;
  avg_score: number;
  shift_count: number;
  latest_created_at: string;
  has_alerts: boolean;
}

// Phase colors
const PHASE_COLORS: Record<string, string> = {
  ACOLHIMENTO: "bg-blue-500",
  CLARIFICACAO: "bg-cyan-500",
  PADROES: "bg-yellow-500",
  RAIZ: "bg-red-500",
  TROCA: "bg-green-500",
  CONSOLIDACAO: "bg-purple-500",
};

const PHASE_LABELS: Record<string, string> = {
  ACOLHIMENTO: "Acolhimento",
  CLARIFICACAO: "Clarificação",
  PADROES: "Padrões",
  RAIZ: "Raiz",
  TROCA: "Troca",
  CONSOLIDACAO: "Consolidação",
};

// Score color helper
function getScoreColor(score: number): string {
  if (score >= 4) return "text-green-600";
  if (score >= 3) return "text-yellow-600";
  return "text-red-600";
}

function getScoreBarColor(score: number): string {
  if (score >= 4) return "bg-green-500";
  if (score >= 3) return "bg-yellow-500";
  return "bg-red-500";
}

const JourneyMap = () => {
  const queryClient = useQueryClient();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedInsight, setSelectedInsight] = useState<TurnInsight | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportFormat, setExportFormat] = useState<"jsonl" | "csv">("jsonl");
  const [exportMode, setExportMode] = useState<"turn-level" | "trajectory-level">("turn-level");
  const [exportAnonymize, setExportAnonymize] = useState(true);
  const [exportIncludeMeta, setExportIncludeMeta] = useState(false);
  const [filterPhase, setFilterPhase] = useState<string>("all");
  const [curatorNotes, setCuratorNotes] = useState("");

  // Fetch session summaries
  const { data: sessions, isLoading: loadingSessions, refetch: refetchSessions } = useQuery({
    queryKey: ["journey-sessions"],
    queryFn: async () => {
      // Get all completed insights grouped by session
      const { data, error } = await supabase
        .from("turn_insights")
        .select("*")
        .eq("extraction_status", "completed")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Group by session
      const sessionMap: Map<string, TurnInsight[]> = new Map();
      for (const insight of data || []) {
        const sessionId = insight.chat_session_id;
        if (!sessionMap.has(sessionId)) {
          sessionMap.set(sessionId, []);
        }
        sessionMap.get(sessionId)!.push(insight as TurnInsight);
      }

      // Build summaries
      const summaries: SessionSummary[] = [];
      for (const [sessionId, insights] of sessionMap.entries()) {
        const sortedInsights = insights.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        const latestInsight = sortedInsights[0];
        const avgScore = insights.reduce((sum, i) => sum + (i.overall_score || 0), 0) / insights.length;
        const shiftCount = insights.filter(i => i.shift_detected).length;
        const hasAlerts = insights.some(i => 
          (i.issues_detected?.length || 0) > 2 || 
          (i.quality_metrics as any)?.low_confidence_retrieval
        );

        summaries.push({
          session_id: sessionId,
          turn_count: insights.length,
          latest_phase: latestInsight.phase,
          avg_score: Math.round(avgScore * 100) / 100,
          shift_count: shiftCount,
          latest_created_at: latestInsight.created_at,
          has_alerts: hasAlerts,
        });
      }

      return summaries.sort((a, b) => 
        new Date(b.latest_created_at).getTime() - new Date(a.latest_created_at).getTime()
      );
    },
  });

  // Fetch timeline for selected session
  const { data: timeline, isLoading: loadingTimeline } = useQuery({
    queryKey: ["journey-timeline", selectedSessionId],
    queryFn: async () => {
      if (!selectedSessionId) return [];
      
      const { data, error } = await supabase
        .from("turn_insights")
        .select("*")
        .eq("chat_session_id", selectedSessionId)
        .eq("extraction_status", "completed")
        .order("turn_number", { ascending: true });

      if (error) throw error;
      return (data || []) as TurnInsight[];
    },
    enabled: !!selectedSessionId,
  });

  // Fetch messages for the timeline
  const { data: messages } = useQuery({
    queryKey: ["journey-messages", selectedSessionId],
    queryFn: async () => {
      if (!selectedSessionId) return [];
      
      const { data, error } = await supabase
        .from("chat_messages")
        .select("id, content, sender, created_at")
        .eq("session_id", selectedSessionId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedSessionId,
  });

  // Stats
  const { data: stats } = useQuery({
    queryKey: ["journey-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("turn_insights")
        .select("phase, shift_detected, overall_score, include_in_training")
        .eq("extraction_status", "completed");

      if (error) throw error;

      const total = data?.length || 0;
      const shifts = data?.filter(d => d.shift_detected).length || 0;
      const avgScore = total > 0 
        ? data!.reduce((sum, d) => sum + (d.overall_score || 0), 0) / total 
        : 0;
      const markedForTraining = data?.filter(d => d.include_in_training).length || 0;

      return { total, shifts, avgScore: Math.round(avgScore * 100) / 100, markedForTraining };
    },
  });

  // Update insight mutation
  const updateInsight = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { error } = await supabase
        .from("turn_insights")
        .update({
          ...updates,
          curated_at: new Date().toISOString(),
        })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journey-timeline"] });
      queryClient.invalidateQueries({ queryKey: ["journey-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["journey-stats"] });
      toast.success("Insight atualizado");
    },
    onError: (err) => {
      toast.error("Erro ao atualizar: " + (err as Error).message);
    },
  });

  // Export handler
  const handleExport = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Sessão expirada");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/journey-export`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            format: exportFormat,
            mode: exportMode,
            anonymize: exportAnonymize,
            include_meta: exportIncludeMeta,
            filters: filterPhase !== "all" ? { phase: filterPhase } : {},
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Export failed");
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `journey-export-${exportMode}-${new Date().toISOString().split("T")[0]}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Export concluído!");
      setShowExportDialog(false);
    } catch (err) {
      toast.error("Erro no export: " + (err as Error).message);
    }
  };

  // Find message content by ID
  const getMessageContent = (messageId: string) => {
    const msg = messages?.find(m => m.id === messageId);
    return msg?.content || "";
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <MapIcon className="h-6 w-6" />
              Mapa de Jornada (Metanoia)
            </h1>
            <p className="text-muted-foreground">
              Telemetria de evolução do modelo na conversa
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refetchSessions()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
            <Button onClick={() => setShowExportDialog(true)}>
              <Download className="mr-2 h-4 w-4" />
              Exportar Dataset
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Turnos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Shifts Detectados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-green-500" />
                {stats?.shifts || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Score Médio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getScoreColor(stats?.avgScore || 0)}`}>
                {stats?.avgScore?.toFixed(2) || "0.00"}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Marcados p/ Treino
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {stats?.markedForTraining || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content: Session List + Timeline */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Session List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Conversas</span>
                <Select value={filterPhase} onValueChange={setFilterPhase}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filtrar fase" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as fases</SelectItem>
                    {Object.entries(PHASE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingSessions ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sessão</TableHead>
                        <TableHead>Fase</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Shifts</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessions
                        ?.filter(s => filterPhase === "all" || s.latest_phase === filterPhase)
                        .map((session) => (
                          <TableRow 
                            key={session.session_id}
                            className={selectedSessionId === session.session_id ? "bg-accent" : ""}
                          >
                            <TableCell className="font-mono text-xs">
                              {session.session_id.substring(0, 8)}...
                              {session.has_alerts && (
                                <AlertTriangle className="inline ml-1 h-3 w-3 text-yellow-500" />
                              )}
                            </TableCell>
                            <TableCell>
                              {session.latest_phase && (
                                <Badge className={`${PHASE_COLORS[session.latest_phase]} text-white text-xs`}>
                                  {PHASE_LABELS[session.latest_phase] || session.latest_phase}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className={getScoreColor(session.avg_score)}>
                              {session.avg_score.toFixed(1)}
                            </TableCell>
                            <TableCell>
                              {session.shift_count > 0 && (
                                <Badge variant="outline" className="gap-1">
                                  <Sparkles className="h-3 w-3" />
                                  {session.shift_count}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedSessionId(session.session_id)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedSessionId 
                  ? `Timeline - ${timeline?.length || 0} turnos`
                  : "Selecione uma conversa"
                }
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedSessionId ? (
                <div className="text-center py-16 text-muted-foreground">
                  <MapIcon className="mx-auto h-12 w-12 opacity-50 mb-4" />
                  <p>Selecione uma conversa para ver a timeline</p>
                </div>
              ) : loadingTimeline ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : (
                <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-4">
                    {timeline?.map((insight, index) => (
                      <Collapsible key={insight.id}>
                        <CollapsibleTrigger asChild>
                          <div className="border rounded-lg p-4 cursor-pointer hover:bg-accent/50 transition-colors">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="flex flex-col items-center">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${PHASE_COLORS[insight.phase || ""] || "bg-gray-400"}`}>
                                    {insight.turn_number}
                                  </div>
                                  {index < (timeline?.length || 0) - 1 && (
                                    <div className="w-0.5 h-4 bg-border mt-1" />
                                  )}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <Badge className={`${PHASE_COLORS[insight.phase || ""] || "bg-gray-400"} text-white text-xs`}>
                                      {PHASE_LABELS[insight.phase || ""] || "?"}
                                    </Badge>
                                    <span className={`text-sm font-medium ${getScoreColor(insight.overall_score || 0)}`}>
                                      {(insight.overall_score || 0).toFixed(1)}
                                    </span>
                                    {insight.shift_detected && (
                                      <Badge variant="outline" className="text-green-600 border-green-600 gap-1">
                                        <Sparkles className="h-3 w-3" />
                                        Shift
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {insight.primary_emotions?.slice(0, 3).join(", ") || "Sem emoções detectadas"}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {insight.include_in_training && (
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                )}
                                {insight.exclude_from_training && (
                                  <XCircle className="h-4 w-4 text-red-500" />
                                )}
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="ml-11 mt-2 space-y-3 border-l-2 border-border pl-4 pb-4">
                            {/* User prompt */}
                            <div className="bg-muted/50 rounded p-3">
                              <p className="text-xs font-medium text-muted-foreground mb-1">Usuário:</p>
                              <p className="text-sm">
                                {getMessageContent(insight.message_user_id).substring(0, 200)}
                                {getMessageContent(insight.message_user_id).length > 200 && "..."}
                              </p>
                            </div>

                            {/* Assistant response */}
                            <div className="bg-primary/5 rounded p-3">
                              <p className="text-xs font-medium text-muted-foreground mb-1">Zyon:</p>
                              <p className="text-sm">
                                {getMessageContent(insight.message_assistant_id).substring(0, 200)}
                                {getMessageContent(insight.message_assistant_id).length > 200 && "..."}
                              </p>
                            </div>

                            {/* Snapshot details */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              {/* ZION Cycle */}
                              {insight.zion_cycle && Object.keys(insight.zion_cycle).length > 0 && (
                                <div className="col-span-2 bg-yellow-50 dark:bg-yellow-950/20 rounded p-3">
                                  <p className="font-medium text-xs text-yellow-700 dark:text-yellow-300 mb-2">
                                    Ciclo ZION
                                  </p>
                                  <div className="space-y-1 text-xs">
                                    {(insight.zion_cycle as any).loss?.text && (
                                      <p><strong>Perda:</strong> {(insight.zion_cycle as any).loss.text}</p>
                                    )}
                                    {(insight.zion_cycle as any).fear_root?.text && (
                                      <p><strong>Medo:</strong> {(insight.zion_cycle as any).fear_root.text}</p>
                                    )}
                                    {(insight.zion_cycle as any).defense_mechanism?.text && (
                                      <p><strong>Defesa:</strong> {(insight.zion_cycle as any).defense_mechanism.text}</p>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Lie & Truth */}
                              {((insight.lie_active as any)?.text || (insight.truth_target as any)?.text) && (
                                <div className="col-span-2 grid grid-cols-2 gap-2">
                                  {(insight.lie_active as any)?.text && (
                                    <div className="bg-red-50 dark:bg-red-950/20 rounded p-2">
                                      <p className="font-medium text-xs text-red-700 dark:text-red-300">Mentira</p>
                                      <p className="text-xs">{(insight.lie_active as any).text}</p>
                                    </div>
                                  )}
                                  {(insight.truth_target as any)?.text && (
                                    <div className="bg-green-50 dark:bg-green-950/20 rounded p-2">
                                      <p className="font-medium text-xs text-green-700 dark:text-green-300">Verdade</p>
                                      <p className="text-xs">{(insight.truth_target as any).text}</p>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Quality Scores */}
                              <div className="col-span-2 bg-muted/30 rounded p-3">
                                <p className="font-medium text-xs text-muted-foreground mb-2">Qualidade do Agente</p>
                                <div className="grid grid-cols-3 gap-2">
                                  {insight.rubric_scores && Object.entries(insight.rubric_scores as Record<string, number>).map(([key, value]) => (
                                    <div key={key} className="space-y-1">
                                      <div className="flex justify-between text-xs">
                                        <span className="truncate">{key.replace(/_/g, " ")}</span>
                                        <span className={getScoreColor(value)}>{value}</span>
                                      </div>
                                      <Progress value={value * 20} className="h-1" />
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Issues */}
                              {insight.issues_detected && insight.issues_detected.length > 0 && (
                                <div className="col-span-2">
                                  <p className="font-medium text-xs text-muted-foreground mb-1">Issues</p>
                                  <div className="flex flex-wrap gap-1">
                                    {insight.issues_detected.map((issue, i) => (
                                      <Badge key={i} variant="destructive" className="text-xs">
                                        {issue}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Rationale */}
                              {insight.quality_rationale && (
                                <div className="col-span-2">
                                  <p className="font-medium text-xs text-muted-foreground mb-1">Justificativa</p>
                                  <p className="text-xs text-muted-foreground">{insight.quality_rationale}</p>
                                </div>
                              )}
                            </div>

                            <Separator />

                            {/* Admin Actions */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <Button
                                variant={insight.include_in_training ? "default" : "outline"}
                                size="sm"
                                onClick={() => updateInsight.mutate({
                                  id: insight.id,
                                  updates: { 
                                    include_in_training: !insight.include_in_training,
                                    exclude_from_training: false,
                                  }
                                })}
                              >
                                <CheckCircle className="mr-1 h-3 w-3" />
                                Bom p/ treino
                              </Button>
                              <Button
                                variant={insight.exclude_from_training ? "destructive" : "outline"}
                                size="sm"
                                onClick={() => updateInsight.mutate({
                                  id: insight.id,
                                  updates: { 
                                    exclude_from_training: !insight.exclude_from_training,
                                    include_in_training: false,
                                  }
                                })}
                              >
                                <XCircle className="mr-1 h-3 w-3" />
                                Evitar treino
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedInsight(insight);
                                  setCuratorNotes(insight.admin_notes || "");
                                }}
                              >
                                Editar nota
                              </Button>
                            </div>

                            {/* Curator notes */}
                            {insight.admin_notes && (
                              <div className="bg-primary/10 rounded p-2">
                                <p className="text-xs font-medium">Nota do curador:</p>
                                <p className="text-xs">{insight.admin_notes}</p>
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Export Dialog */}
        <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Exportar Dataset de Jornada</DialogTitle>
              <DialogDescription>
                Configure as opções de export para treinamento
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Formato</label>
                  <Select value={exportFormat} onValueChange={(v: "jsonl" | "csv") => setExportFormat(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="jsonl">JSONL</SelectItem>
                      <SelectItem value="csv">CSV</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Modo</label>
                  <Select value={exportMode} onValueChange={(v: "turn-level" | "trajectory-level") => setExportMode(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="turn-level">Por turno</SelectItem>
                      <SelectItem value="trajectory-level">Por trajetória</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="anonymize" 
                    checked={exportAnonymize} 
                    onCheckedChange={(c) => setExportAnonymize(!!c)} 
                  />
                  <label htmlFor="anonymize" className="text-sm">Anonimizar (remover IDs)</label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="includeMeta" 
                    checked={exportIncludeMeta} 
                    onCheckedChange={(c) => setExportIncludeMeta(!!c)} 
                  />
                  <label htmlFor="includeMeta" className="text-sm">Incluir metadados completos</label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowExportDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                Exportar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Notes Dialog */}
        <Dialog open={!!selectedInsight} onOpenChange={() => setSelectedInsight(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nota de Curadoria</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Textarea
                value={curatorNotes}
                onChange={(e) => setCuratorNotes(e.target.value)}
                placeholder="Adicione observações sobre este turno..."
                rows={4}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedInsight(null)}>
                Cancelar
              </Button>
              <Button onClick={() => {
                if (selectedInsight) {
                  updateInsight.mutate({
                    id: selectedInsight.id,
                    updates: { 
                      admin_notes: curatorNotes,
                      admin_confirmed: true,
                    }
                  });
                  setSelectedInsight(null);
                }
              }}>
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default JourneyMap;
