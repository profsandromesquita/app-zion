import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Eye, Check, Search, RefreshCw, FileJson, FileSpreadsheet, Plus, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type DatasetLabel = "useful" | "not_useful" | "theology_report";
type CurationStatus = "approved" | "rejected" | "needs_review";

interface Violation {
  code: string;
  description: string;
}

interface Diagnosis {
  symptom?: string;
  distorted_virtue?: string;
  root_fear?: string;
  security_matrix?: string;
}

interface CuratedCorrection {
  id: string;
  feedback_item_id: string;
  status: CurationStatus;
  adherence_score: number | null;
  violations: Violation[];
  corrected_response: string | null;
  diagnosis: Diagnosis;
  notes: string | null;
  include_in_training: boolean;
  curated_at: string;
}

interface DatasetItem {
  id: string;
  created_at: string;
  updated_at: string;
  chat_session_id: string;
  user_id: string | null;
  message_user_id: string;
  message_assistant_id: string;
  user_prompt_text: string;
  assistant_answer_text: string;
  feedback_label: DatasetLabel;
  feedback_note: string | null;
  model_id: string | null;
  intent: string | null;
  risk_level: string | null;
  was_rewritten: boolean;
  rag_used: boolean;
  rag_low_confidence: boolean;
  include_in_export: boolean;
  curation_notes: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

const LABEL_OPTIONS = [
  { value: "__all__", label: "Todos os labels" },
  { value: "useful", label: "Útil" },
  { value: "not_useful", label: "Não útil" },
  { value: "theology_report", label: "Problema teológico" },
];

const LABEL_COLORS: Record<DatasetLabel, string> = {
  useful: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  not_useful: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  theology_report: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const LABEL_TEXT: Record<DatasetLabel, string> = {
  useful: "Útil",
  not_useful: "Não útil",
  theology_report: "Teologia",
};

const STATUS_OPTIONS: { value: CurationStatus; label: string; color: string }[] = [
  { value: "approved", label: "✅ Aprovado", color: "bg-green-100 text-green-800" },
  { value: "rejected", label: "🔴 Reprovado", color: "bg-red-100 text-red-800" },
  { value: "needs_review", label: "🟡 Revisar", color: "bg-yellow-100 text-yellow-800" },
];

const VIOLATION_CODES = [
  { code: "PRESUMPTION", label: "Presunção/Interpretação" },
  { code: "IMPURE_MIRRORING", label: "Espelhamento Impuro" },
  { code: "MASK_VALIDATION", label: "Validação da Máscara" },
  { code: "EXCESS_LENGTH", label: "Resposta Longa Demais" },
  { code: "EXTERNAL_FOCUS", label: "Foco Cognitivo Externo" },
  { code: "WEAK_MAIEUTICS", label: "Maiêutica Fraca" },
  { code: "CAUSALITY_DIAGNOSTIC", label: "Diagnóstico Causal" },
  { code: "MISSING_SENSATION", label: "Sem Pergunta de Sensação" },
  { code: "THEORIZATION", label: "Teorização Excessiva" },
  { code: "BIBLICAL_MISUSE", label: "Uso Indevido de Bíblia" },
  { code: "OTHER", label: "Outro" },
];

const SECURITY_MATRICES = [
  { value: "SOBREVIVENCIA", label: "Sobrevivência" },
  { value: "IDENTIDADE", label: "Identidade" },
  { value: "CAPACIDADE", label: "Capacidade" },
];

const DISTORTED_VIRTUES = [
  "Trabalho/Esperança",
  "Controle/Prudência",
  "Imagem/Autenticidade",
  "Singularidade/Equilíbrio",
  "Conhecimento/Engajamento",
  "Lealdade/Coragem",
  "Liberdade/Moderação",
  "Poder/Vulnerabilidade",
  "Paz/Ação",
];

const ROOT_FEARS = [
  "Abandono",
  "Rejeição",
  "Fracasso",
  "Ser inútil",
  "Invasão",
  "Traição",
  "Ser controlado",
  "Ser fraco",
  "Conflito",
  "Não ser especial",
  "Ser vazio",
];

const FeedbackDataset = () => {
  const queryClient = useQueryClient();
  
  // Filtros
  const [labelFilter, setLabelFilter] = useState("__all__");
  const [searchTerm, setSearchTerm] = useState("");
  const [includeFilter, setIncludeFilter] = useState<string>("__all__");
  const [rewrittenFilter, setRewrittenFilter] = useState<string>("__all__");
  const [ragLowFilter, setRagLowFilter] = useState<string>("__all__");

  // Modal de detalhe
  const [selectedItem, setSelectedItem] = useState<DatasetItem | null>(null);
  
  // Estado de curadoria estruturada
  const [curationStatus, setCurationStatus] = useState<CurationStatus>("needs_review");
  const [adherenceScore, setAdherenceScore] = useState<string>("");
  const [violations, setViolations] = useState<Violation[]>([]);
  const [correctedResponse, setCorrectedResponse] = useState("");
  const [diagnosis, setDiagnosis] = useState<Diagnosis>({});
  const [curationNotes, setCurationNotes] = useState("");
  const [includeInTraining, setIncludeInTraining] = useState(true);
  const [existingCuration, setExistingCuration] = useState<CuratedCorrection | null>(null);

  // Modal de export
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportFormat, setExportFormat] = useState<"jsonl" | "csv">("jsonl");
  const [exportAnonymize, setExportAnonymize] = useState(true);
  const [exportLabel, setExportLabel] = useState("__all__");
  const [exportOnlyIncluded, setExportOnlyIncluded] = useState(true);
  const [exportUseCorrected, setExportUseCorrected] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Buscar dados
  const { data: items = [], isLoading, refetch } = useQuery({
    queryKey: ["feedback-dataset", labelFilter, searchTerm, includeFilter, rewrittenFilter, ragLowFilter],
    queryFn: async () => {
      let query = supabase
        .from("feedback_dataset_items")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (labelFilter !== "__all__") {
        query = query.eq("feedback_label", labelFilter as DatasetLabel);
      }

      if (includeFilter !== "__all__") {
        query = query.eq("include_in_export", includeFilter === "true");
      }

      if (rewrittenFilter !== "__all__") {
        query = query.eq("was_rewritten", rewrittenFilter === "true");
      }

      if (ragLowFilter !== "__all__") {
        query = query.eq("rag_low_confidence", ragLowFilter === "true");
      }

      if (searchTerm) {
        query = query.or(`user_prompt_text.ilike.%${searchTerm}%,assistant_answer_text.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as DatasetItem[];
    },
  });

  // Estatísticas
  const { data: stats } = useQuery({
    queryKey: ["feedback-dataset-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feedback_dataset_items")
        .select("feedback_label, include_in_export");

      if (error) throw error;

      const counts = {
        total: data?.length || 0,
        useful: data?.filter((d) => d.feedback_label === "useful").length || 0,
        not_useful: data?.filter((d) => d.feedback_label === "not_useful").length || 0,
        theology_report: data?.filter((d) => d.feedback_label === "theology_report").length || 0,
        included: data?.filter((d) => d.include_in_export).length || 0,
      };

      return counts;
    },
  });

  // Carregar curadoria existente quando item é selecionado
  useEffect(() => {
    if (selectedItem) {
      loadExistingCuration(selectedItem.id);
    }
  }, [selectedItem?.id]);

  const loadExistingCuration = async (feedbackItemId: string) => {
    const { data, error } = await supabase
      .from("curated_corrections")
      .select("*")
      .eq("feedback_item_id", feedbackItemId)
      .maybeSingle();

    if (error) {
      console.error("Error loading curation:", error);
      return;
    }

    if (data) {
      setExistingCuration(data as unknown as CuratedCorrection);
      setCurationStatus(data.status as CurationStatus);
      setAdherenceScore(data.adherence_score?.toString() || "");
      setViolations((data.violations as unknown as Violation[]) || []);
      setCorrectedResponse(data.corrected_response || "");
      setDiagnosis((data.diagnosis as unknown as Diagnosis) || {});
      setCurationNotes(data.notes || "");
      setIncludeInTraining(data.include_in_training ?? true);
    } else {
      // Reset form para novo item
      setExistingCuration(null);
      setCurationStatus("needs_review");
      setAdherenceScore("");
      setViolations([]);
      setCorrectedResponse("");
      setDiagnosis({});
      setCurationNotes("");
      setIncludeInTraining(true);
    }
  };

  // Mutation para atualizar feedback_dataset_items
  const updateMutation = useMutation({
    mutationFn: async (updates: { id: string; include_in_export?: boolean; curation_notes?: string; reviewed_at?: string; reviewed_by?: string }) => {
      const { error } = await supabase
        .from("feedback_dataset_items")
        .update(updates)
        .eq("id", updates.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feedback-dataset"] });
      queryClient.invalidateQueries({ queryKey: ["feedback-dataset-stats"] });
    },
    onError: (error) => {
      toast.error("Erro ao atualizar: " + error.message);
    },
  });

  // Mutation para salvar curadoria estruturada
  const saveCurationMutation = useMutation({
    mutationFn: async (curationData: {
      feedback_item_id: string;
      status: CurationStatus;
      adherence_score: number | null;
      violations: Violation[];
      corrected_response: string | null;
      diagnosis: Diagnosis;
      notes: string | null;
      include_in_training: boolean;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const payload = {
        feedback_item_id: curationData.feedback_item_id,
        status: curationData.status,
        adherence_score: curationData.adherence_score,
        violations: curationData.violations as unknown as Record<string, unknown>[],
        corrected_response: curationData.corrected_response,
        diagnosis: curationData.diagnosis as unknown as Record<string, unknown>,
        notes: curationData.notes,
        include_in_training: curationData.include_in_training,
        curator_id: userData.user?.id,
        curated_at: new Date().toISOString(),
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase
        .from("curated_corrections")
        .upsert(payload as any, { onConflict: "feedback_item_id" });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feedback-dataset"] });
      toast.success("Curadoria salva com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao salvar curadoria: " + error.message);
    },
  });

  // Toggle incluir no export
  const handleToggleInclude = (item: DatasetItem) => {
    updateMutation.mutate({
      id: item.id,
      include_in_export: !item.include_in_export,
    });
  };

  // Salvar curadoria estruturada
  const handleSaveCuration = async () => {
    if (!selectedItem) return;

    const { data: user } = await supabase.auth.getUser();

    // Atualizar reviewed_at no feedback_dataset_items
    updateMutation.mutate({
      id: selectedItem.id,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.user?.id,
    });

    // Salvar curadoria estruturada
    saveCurationMutation.mutate({
      feedback_item_id: selectedItem.id,
      status: curationStatus,
      adherence_score: adherenceScore ? parseInt(adherenceScore) : null,
      violations,
      corrected_response: correctedResponse || null,
      diagnosis,
      notes: curationNotes || null,
      include_in_training: includeInTraining,
    });

    setSelectedItem(null);
  };

  // Adicionar violação
  const handleAddViolation = () => {
    setViolations([...violations, { code: "", description: "" }]);
  };

  // Remover violação
  const handleRemoveViolation = (index: number) => {
    setViolations(violations.filter((_, i) => i !== index));
  };

  // Atualizar violação
  const handleUpdateViolation = (index: number, field: keyof Violation, value: string) => {
    const updated = [...violations];
    updated[index] = { ...updated[index], [field]: value };
    setViolations(updated);
  };

  // Export
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada");
        return;
      }

      const filters: Record<string, unknown> = {};
      if (exportLabel !== "__all__") {
        filters.label = exportLabel;
      }
      if (exportOnlyIncluded) {
        filters.includeInExport = true;
      }

      const response = await supabase.functions.invoke("dataset-export", {
        body: {
          format: exportFormat,
          filters,
          anonymize: exportAnonymize,
          useCorrectedResponses: exportUseCorrected,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Criar download
      const blob = new Blob([response.data], {
        type: exportFormat === "jsonl" ? "application/x-ndjson" : "text/csv",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `feedback_dataset_${new Date().toISOString().split("T")[0]}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Dataset exportado (${exportFormat.toUpperCase()})`);
      setShowExportDialog(false);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Erro ao exportar: " + (error instanceof Error ? error.message : "Erro desconhecido"));
    } finally {
      setIsExporting(false);
    }
  };

  const truncateText = (text: string, maxLength = 60) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dataset de Feedback</h1>
            <p className="text-muted-foreground">
              Gerenciar pares pergunta/resposta para fine-tuning
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
            <Button onClick={() => setShowExportDialog(true)}>
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-600">Útil</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats?.useful || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-yellow-600">Não útil</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats?.not_useful || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-600">Teologia</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats?.theology_report || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-600">No Export</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats?.included || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-1.5">
            <Label>Buscar</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar no prompt ou resposta..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-64"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Label</Label>
            <Select value={labelFilter} onValueChange={setLabelFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LABEL_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Incluir no Export</Label>
            <Select value={includeFilter} onValueChange={setIncludeFilter}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                <SelectItem value="true">Sim</SelectItem>
                <SelectItem value="false">Não</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Reescrito</Label>
            <Select value={rewrittenFilter} onValueChange={setRewrittenFilter}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                <SelectItem value="true">Sim</SelectItem>
                <SelectItem value="false">Não</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>RAG Baixa Conf.</Label>
            <Select value={ragLowFilter} onValueChange={setRagLowFilter}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                <SelectItem value="true">Sim</SelectItem>
                <SelectItem value="false">Não</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tabela */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">Export</TableHead>
                <TableHead className="w-28">Data</TableHead>
                <TableHead className="w-24">Label</TableHead>
                <TableHead>Prompt</TableHead>
                <TableHead>Resposta</TableHead>
                <TableHead className="w-24">Intent</TableHead>
                <TableHead className="w-20">Reesc.</TableHead>
                <TableHead className="w-20">RAG↓</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Nenhum item encontrado
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Checkbox
                        checked={item.include_in_export}
                        onCheckedChange={() => handleToggleInclude(item)}
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(item.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Badge className={LABEL_COLORS[item.feedback_label]}>
                        {LABEL_TEXT[item.feedback_label]}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <span className="text-sm" title={item.user_prompt_text}>
                        {truncateText(item.user_prompt_text)}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <span className="text-sm" title={item.assistant_answer_text}>
                        {truncateText(item.assistant_answer_text)}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">{item.intent || "-"}</TableCell>
                    <TableCell>
                      {item.was_rewritten ? (
                        <Badge variant="outline" className="text-xs">Sim</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">Não</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.rag_low_confidence ? (
                        <Badge variant="destructive" className="text-xs">Sim</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">Não</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedItem(item)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Modal de Detalhe com Curadoria Estruturada */}
        <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                Detalhes do Feedback
                {selectedItem && (
                  <Badge className={LABEL_COLORS[selectedItem.feedback_label]}>
                    {LABEL_TEXT[selectedItem.feedback_label]}
                  </Badge>
                )}
                {existingCuration && (
                  <Badge className={STATUS_OPTIONS.find(s => s.value === existingCuration.status)?.color}>
                    {STATUS_OPTIONS.find(s => s.value === existingCuration.status)?.label}
                  </Badge>
                )}
              </DialogTitle>
            </DialogHeader>

            {selectedItem && (
              <Tabs defaultValue="content" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="content">Conteúdo</TabsTrigger>
                  <TabsTrigger value="curation">Curadoria</TabsTrigger>
                  <TabsTrigger value="diagnosis">Diagnóstico</TabsTrigger>
                </TabsList>

                {/* Tab: Conteúdo */}
                <TabsContent value="content" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <Label className="text-muted-foreground">Data</Label>
                      <p>{format(new Date(selectedItem.created_at), "PPpp", { locale: ptBR })}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Intent</Label>
                      <p>{selectedItem.intent || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Modelo</Label>
                      <p>{selectedItem.model_id || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Risk Level</Label>
                      <p>{selectedItem.risk_level || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">RAG Usado</Label>
                      <p>{selectedItem.rag_used ? "Sim" : "Não"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Reescrito</Label>
                      <p>{selectedItem.was_rewritten ? "Sim" : "Não"}</p>
                    </div>
                  </div>

                  <div>
                    <Label className="text-muted-foreground">Prompt do Usuário</Label>
                    <div className="mt-1 p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap">
                      {selectedItem.user_prompt_text}
                    </div>
                  </div>

                  <div>
                    <Label className="text-muted-foreground">Resposta do Assistente (Original)</Label>
                    <div className="mt-1 p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap max-h-60 overflow-y-auto">
                      {selectedItem.assistant_answer_text}
                    </div>
                  </div>

                  {selectedItem.feedback_note && (
                    <div>
                      <Label className="text-muted-foreground">Nota do Usuário (Feedback)</Label>
                      <div className="mt-1 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm">
                        {selectedItem.feedback_note}
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* Tab: Curadoria */}
                <TabsContent value="curation" className="space-y-4">
                  {/* Status e Score */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Status da Curadoria</Label>
                      <div className="flex gap-2">
                        {STATUS_OPTIONS.map((opt) => (
                          <Button
                            key={opt.value}
                            variant={curationStatus === opt.value ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurationStatus(opt.value)}
                            className={curationStatus === opt.value ? "" : ""}
                          >
                            {opt.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Nota de Aderência (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={adherenceScore}
                        onChange={(e) => setAdherenceScore(e.target.value)}
                        placeholder="0-100"
                        className="w-32"
                      />
                    </div>
                  </div>

                  {/* Violações */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                        Violações Detectadas
                      </Label>
                      <Button variant="outline" size="sm" onClick={handleAddViolation}>
                        <Plus className="h-4 w-4 mr-1" />
                        Adicionar
                      </Button>
                    </div>
                    
                    {violations.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">Nenhuma violação registrada</p>
                    ) : (
                      <div className="space-y-2">
                        {violations.map((violation, index) => (
                          <div key={index} className="flex gap-2 items-start p-2 bg-muted/50 rounded-lg">
                            <Select
                              value={violation.code}
                              onValueChange={(value) => handleUpdateViolation(index, "code", value)}
                            >
                              <SelectTrigger className="w-48">
                                <SelectValue placeholder="Tipo..." />
                              </SelectTrigger>
                              <SelectContent>
                                {VIOLATION_CODES.map((v) => (
                                  <SelectItem key={v.code} value={v.code}>
                                    {v.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              placeholder="Descrição da violação..."
                              value={violation.description}
                              onChange={(e) => handleUpdateViolation(index, "description", e.target.value)}
                              className="flex-1"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveViolation(index)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Reescrita Corrigida */}
                  <div className="space-y-1.5">
                    <Label>Reescrita Corrigida (ZION PERFECT TONE)</Label>
                    <Textarea
                      value={correctedResponse}
                      onChange={(e) => setCorrectedResponse(e.target.value)}
                      placeholder="Cole aqui a resposta correta que o modelo deveria ter dado..."
                      className="min-h-[120px]"
                    />
                    <p className="text-xs text-muted-foreground">
                      Esta reescrita será usada no fine-tuning no lugar da resposta original
                    </p>
                  </div>

                  {/* Notas Livres */}
                  <div className="space-y-1.5">
                    <Label>Notas Adicionais (Opcional)</Label>
                    <Textarea
                      value={curationNotes}
                      onChange={(e) => setCurationNotes(e.target.value)}
                      placeholder="Observações gerais sobre este item..."
                      className="min-h-[80px]"
                    />
                  </div>

                  {/* Incluir no Training */}
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="includeInTraining"
                      checked={includeInTraining}
                      onCheckedChange={(checked) => setIncludeInTraining(checked as boolean)}
                    />
                    <Label htmlFor="includeInTraining">
                      Incluir esta correção no dataset de fine-tuning
                    </Label>
                  </div>
                </TabsContent>

                {/* Tab: Diagnóstico */}
                <TabsContent value="diagnosis" className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Análise do bastidor: o que a IA deveria ter identificado sobre o usuário
                  </p>

                  <div className="space-y-1.5">
                    <Label>Sintoma Observado</Label>
                    <Input
                      value={diagnosis.symptom || ""}
                      onChange={(e) => setDiagnosis({ ...diagnosis, symptom: e.target.value })}
                      placeholder="Ex: Discussões frequentes, irritação, ameaça de abandono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Virtude Distorcida</Label>
                      <Select
                        value={diagnosis.distorted_virtue || ""}
                        onValueChange={(value) => setDiagnosis({ ...diagnosis, distorted_virtue: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {DISTORTED_VIRTUES.map((v) => (
                            <SelectItem key={v} value={v}>
                              {v}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Medo Raiz</Label>
                      <Select
                        value={diagnosis.root_fear || ""}
                        onValueChange={(value) => setDiagnosis({ ...diagnosis, root_fear: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {ROOT_FEARS.map((f) => (
                            <SelectItem key={f} value={f}>
                              {f}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Matriz de Segurança</Label>
                    <div className="flex gap-2">
                      {SECURITY_MATRICES.map((m) => (
                        <Button
                          key={m.value}
                          variant={diagnosis.security_matrix === m.value ? "default" : "outline"}
                          size="sm"
                          onClick={() => setDiagnosis({ ...diagnosis, security_matrix: m.value })}
                        >
                          {m.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            )}

            <DialogFooter>
              {selectedItem?.reviewed_at && (
                <p className="text-xs text-muted-foreground mr-auto">
                  Revisado em {format(new Date(selectedItem.reviewed_at), "PPpp", { locale: ptBR })}
                </p>
              )}
              <Button variant="outline" onClick={() => setSelectedItem(null)}>
                Fechar
              </Button>
              <Button onClick={handleSaveCuration} disabled={saveCurationMutation.isPending}>
                <Check className="mr-2 h-4 w-4" />
                {saveCurationMutation.isPending ? "Salvando..." : "Salvar Curadoria"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Export */}
        <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Exportar Dataset</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Formato</Label>
                <div className="flex gap-2">
                  <Button
                    variant={exportFormat === "jsonl" ? "default" : "outline"}
                    onClick={() => setExportFormat("jsonl")}
                    className="flex-1"
                  >
                    <FileJson className="mr-2 h-4 w-4" />
                    JSONL
                  </Button>
                  <Button
                    variant={exportFormat === "csv" ? "default" : "outline"}
                    onClick={() => setExportFormat("csv")}
                    className="flex-1"
                  >
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    CSV
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Filtrar por Label</Label>
                <Select value={exportLabel} onValueChange={setExportLabel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos</SelectItem>
                    <SelectItem value="useful">Apenas Útil</SelectItem>
                    <SelectItem value="not_useful">Apenas Não útil</SelectItem>
                    <SelectItem value="theology_report">Apenas Teologia</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="exportOnlyIncluded"
                  checked={exportOnlyIncluded}
                  onCheckedChange={(checked) => setExportOnlyIncluded(checked as boolean)}
                />
                <Label htmlFor="exportOnlyIncluded">
                  Exportar apenas itens marcados para export
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="exportUseCorrected"
                  checked={exportUseCorrected}
                  onCheckedChange={(checked) => setExportUseCorrected(checked as boolean)}
                />
                <Label htmlFor="exportUseCorrected">
                  Usar respostas corrigidas (quando disponíveis)
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="exportAnonymize"
                  checked={exportAnonymize}
                  onCheckedChange={(checked) => setExportAnonymize(checked as boolean)}
                />
                <Label htmlFor="exportAnonymize">
                  Anonimizar dados (remover IDs de usuário/sessão)
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowExportDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleExport} disabled={isExporting}>
                {isExporting ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Exportando...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Exportar
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default FeedbackDataset;
