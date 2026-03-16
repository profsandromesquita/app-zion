import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, ArrowLeft, Trash2, Calendar, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { useQuery } from "@tanstack/react-query";
import SafetyExit from "@/components/SafetyExit";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import zionLogo from "@/assets/zion-logo.png";

// --- IO Constants ---

const PHASE_NAMES: Record<number, string> = {
  1: "Consciência",
  2: "Limites",
  3: "Identidade",
  4: "Ritmo",
  5: "Vitalidade",
  6: "Governo",
  7: "Plenitude",
};

const PHASE_INSPIRATIONS: Record<number, string> = {
  1: "O diário é onde você começa a ouvir o que sente de verdade.",
  2: "Escrever ajuda a separar o que é seu do que carrega dos outros.",
  3: "Quando um padrão aparece no papel, ele perde o poder de se esconder.",
  4: "Cada entrada é um passo no ritmo que você está construindo.",
  5: "Às vezes perdoar começa com uma frase escrita só para você.",
  6: "Governar a própria vida começa com clareza sobre o que importa.",
  7: "Registrar é preservar. O que você viveu merece ser lembrado.",
};

const PHASE_PLACEHOLDERS: Record<number, string> = {
  1: "O que você está sentindo agora? Não precisa ser perfeito — só verdadeiro.",
  2: "Aconteceu algo hoje que te incomodou? Tente separar o fato do que sentiu.",
  3: "Você notou algum padrão se repetindo? O que ele te lembra?",
  4: "Como foi manter seu ritmo hoje? O que ajudou ou atrapalhou?",
  5: "Algum relacionamento te tocou hoje? O que gostaria de dizer a essa pessoa?",
  6: "Qual área da sua vida precisa de atenção? O que pode fazer esta semana?",
  7: "O que você aprendeu sobre si mesmo que gostaria de lembrar?",
};

const DEPTH_MAP: Record<string, { color: string; label: string }> = {
  deep: { color: "bg-emerald-500", label: "profundo" },
  moderate: { color: "bg-yellow-500", label: "moderado" },
  superficial: { color: "bg-muted-foreground/50", label: "breve" },
};

const TONE_MAP: Record<string, { variant: string; label: string }> = {
  positive: { variant: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300", label: "positivo" },
  neutral: { variant: "bg-muted text-muted-foreground", label: "neutro" },
  negative: { variant: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300", label: "sensível" },
  mixed: { variant: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300", label: "misto" },
};

// --- Types ---

interface IOAnalysis {
  genuineness_score?: number;
  depth_level?: string;
  key_themes?: string[];
  emotional_tone?: string;
  analysis_summary?: string;
}

interface DiaryEntry {
  id: string;
  content: string;
  created_at: string;
  updated_at: string;
  title?: string | null;
  io_analysis?: IOAnalysis | null;
  io_phase_at_entry?: number | null;
}

// --- Sub-components ---

function SidebarCounter({ entries }: { entries: DiaryEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="px-4 py-2 text-xs text-muted-foreground">
        📖 Comece sua primeira reflexão
      </div>
    );
  }
  const daysSince = differenceInDays(new Date(), new Date(entries[0].created_at));
  const daysText = daysSince === 0 ? "hoje" : daysSince === 1 ? "há 1 dia" : `há ${daysSince} dias`;
  return (
    <div className="px-4 py-2 text-xs text-muted-foreground">
      📖 {entries.length} reflexões · última {daysText}
    </div>
  );
}

function EntryIOBadges({ entry, isDiaryIOEnabled }: { entry: DiaryEntry; isDiaryIOEnabled: boolean }) {
  if (!isDiaryIOEnabled || !entry.io_analysis) return null;
  const analysis = entry.io_analysis as IOAnalysis;
  const depth = analysis.depth_level ? DEPTH_MAP[analysis.depth_level] : null;
  const themes = analysis.key_themes?.slice(0, 2);

  if (!depth && (!themes || themes.length === 0)) return null;

  return (
    <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
      {depth && (
        <>
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${depth.color}`} />
          <span>{depth.label}</span>
        </>
      )}
      {depth && themes && themes.length > 0 && <span>·</span>}
      {themes && themes.length > 0 && <span>{themes.join(", ")}</span>}
    </div>
  );
}

function AnalysisCard({ entry, isDiaryIOEnabled }: { entry: DiaryEntry; isDiaryIOEnabled: boolean }) {
  if (!isDiaryIOEnabled || !entry.io_analysis) return null;
  const analysis = entry.io_analysis as IOAnalysis;
  const tone = analysis.emotional_tone ? TONE_MAP[analysis.emotional_tone] : null;
  const depth = analysis.depth_level ? DEPTH_MAP[analysis.depth_level] : null;
  const depthLabel = analysis.depth_level === "superficial" ? "breve" : depth?.label;

  return (
    <div className="mt-4 rounded-lg border border-border/50 bg-muted/30 p-4">
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Sobre esta reflexão
      </h3>
      <div className="flex flex-wrap items-center gap-2">
        {tone && (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tone.variant}`}>
            {tone.label}
          </span>
        )}
        {depthLabel && (
          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {depthLabel}
          </span>
        )}
      </div>

      {analysis.key_themes && analysis.key_themes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {analysis.key_themes.map((theme, i) => (
            <span key={i} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {theme}
            </span>
          ))}
        </div>
      )}

      {entry.io_phase_at_entry != null && (
        <p className="mt-3 text-xs text-muted-foreground">
          Escrito na Fase {entry.io_phase_at_entry} — {PHASE_NAMES[entry.io_phase_at_entry] || ""}
        </p>
      )}

      {analysis.analysis_summary && (
        <p className="mt-2 text-sm italic text-muted-foreground">
          {analysis.analysis_summary}
        </p>
      )}
    </div>
  );
}

// --- Main Component ---

const Diary = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const { enabled: isDiaryIOEnabled } = useFeatureFlag("io_diary_integration_enabled");

  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<DiaryEntry | null>(null);
  const [content, setContent] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // IO phase query (only when enabled)
  const { data: ioPhaseData } = useQuery({
    queryKey: ["io-user-phase-diary", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("io_user_phase")
        .select("current_phase")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user && isDiaryIOEnabled,
    staleTime: 30_000,
  });

  const currentPhase = ioPhaseData?.current_phase ?? null;

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      loadEntries();
    }
  }, [user]);

  const loadEntries = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("diary_entries")
      .select("id, content, created_at, updated_at, title, io_analysis, io_phase_at_entry")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setEntries(data as DiaryEntry[]);
    }
  };

  const handleNewEntry = () => {
    setSelectedEntry(null);
    setContent("");
    setIsCreating(true);
  };

  const handleSelectEntry = (entry: DiaryEntry) => {
    setSelectedEntry(entry);
    setContent(entry.content);
    setIsCreating(false);
  };

  const triggerIOAnalysis = async (entryId: string, entryContent: string) => {
    if (!isDiaryIOEnabled || !user) return;

    try {
      const { data: phaseData } = await supabase
        .from("io_user_phase")
        .select("current_phase")
        .eq("user_id", user.id)
        .maybeSingle();

      if (phaseData?.current_phase != null) {
        await supabase
          .from("diary_entries")
          .update({ io_phase_at_entry: phaseData.current_phase } as any)
          .eq("id", entryId);
      }

      supabase.functions.invoke("analyze-diary", {
        body: { user_id: user.id, diary_entry_id: entryId, content: entryContent },
      });
    } catch (err) {
      console.error("IO diary integration error (non-blocking):", err);
    }
  };

  const handleSave = async () => {
    if (!content.trim() || !user) return;

    setIsSaving(true);

    try {
      if (isCreating) {
        const { data, error } = await supabase
          .from("diary_entries")
          .insert({
            user_id: user.id,
            content: content.trim(),
          })
          .select()
          .single();

        if (error) throw error;

        setEntries((prev) => [data as DiaryEntry, ...prev]);
        setSelectedEntry(data as DiaryEntry);
        setIsCreating(false);

        toast({
          title: "Entrada salva",
          description: "Sua reflexão foi registrada com sucesso.",
        });

        // Always generate title (independent of IO flag)
        supabase.functions.invoke("generate-diary-title", {
          body: { diary_entry_id: data.id, content: content.trim() },
        }).catch((err) => console.warn("Diary title gen failed:", err));

        setTimeout(() => loadEntries(), 3000);

        triggerIOAnalysis(data.id, content.trim());
      } else if (selectedEntry) {
        const { error } = await supabase
          .from("diary_entries")
          .update({ content: content.trim() })
          .eq("id", selectedEntry.id);

        if (error) throw error;

        setEntries((prev) =>
          prev.map((e) =>
            e.id === selectedEntry.id ? { ...e, content: content.trim() } : e
          )
        );

        toast({
          title: "Entrada atualizada",
          description: "Suas alterações foram salvas.",
        });

        // Always generate title (independent of IO flag)
        supabase.functions.invoke("generate-diary-title", {
          body: { diary_entry_id: selectedEntry.id, content: content.trim() },
        }).catch((err) => console.warn("Diary title gen failed:", err));

        setTimeout(() => loadEntries(), 3000);

        triggerIOAnalysis(selectedEntry.id, content.trim());
      }
    } catch (error) {
      console.error("Error saving entry:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar sua entrada. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (entryId: string) => {
    try {
      const { error } = await supabase
        .from("diary_entries")
        .delete()
        .eq("id", entryId);

      if (error) throw error;

      setEntries((prev) => prev.filter((e) => e.id !== entryId));

      if (selectedEntry?.id === entryId) {
        setSelectedEntry(null);
        setContent("");
        setIsCreating(false);
      }

      toast({
        title: "Entrada removida",
        description: "A entrada foi excluída do seu diário.",
      });
    } catch (error) {
      console.error("Error deleting entry:", error);
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir a entrada.",
        variant: "destructive",
      });
    }
  };

  // Placeholder contextual
  const getPlaceholder = () => {
    if (isDiaryIOEnabled && currentPhase && PHASE_PLACEHOLDERS[currentPhase]) {
      return PHASE_PLACEHOLDERS[currentPhase];
    }
    return "Escreva suas reflexões, orações e pensamentos aqui...";
  };

  // Inspiration text
  const getInspiration = () => {
    if (isDiaryIOEnabled && currentPhase && PHASE_INSPIRATIONS[currentPhase]) {
      return PHASE_INSPIRATIONS[currentPhase];
    }
    return "Um espaço privado para registrar suas reflexões, orações e momentos de conexão com Deus.";
  };

  // Stats for empty state
  const getStatsText = () => {
    if (entries.length === 0) return "Nenhuma reflexão ainda";
    const daysSince = differenceInDays(new Date(), new Date(entries[0].created_at));
    const daysText = daysSince === 0 ? "hoje" : daysSince === 1 ? "há 1 dia" : `há ${daysSince} dias`;
    return `${entries.length} reflexões · última ${daysText}`;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--gradient-peace)" }}>
        <div className="animate-pulse-soft">
          <img src={zionLogo} alt="Zion" className="h-16 w-16" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background md:flex-row">
      <SafetyExit />

      {/* Sidebar */}
      <aside className="w-full border-b border-border md:w-80 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("/chat")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="font-medium text-foreground">Diário Espiritual</h1>
          </div>
          <Button size="icon" variant="outline" onClick={handleNewEntry}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Mini counter */}
        <SidebarCounter entries={entries} />

        <ScrollArea className="h-40 md:h-[calc(100vh-105px)]">
          <div className="p-2">
            {entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Calendar className="mb-2 h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma entrada ainda
                </p>
                <Button
                  variant="link"
                  size="sm"
                  className="mt-2"
                  onClick={handleNewEntry}
                >
                  Criar primeira entrada
                </Button>
              </div>
            ) : (
              entries.map((entry) => (
                <Card
                  key={entry.id}
                  className={`mb-2 cursor-pointer transition-colors hover:bg-muted/50 ${
                    selectedEntry?.id === entry.id ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30" : ""
                  }`}
                  onClick={() => handleSelectEntry(entry)}
                >
                  <CardHeader className="p-3">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <CardTitle className="text-sm font-medium">
                            {format(new Date(entry.created_at), "d 'de' MMMM", {
                              locale: ptBR,
                            })}
                          </CardTitle>
                          {isDiaryIOEnabled && entry.io_phase_at_entry != null && (
                            <span className="rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">
                              Fase {entry.io_phase_at_entry}
                            </span>
                          )}
                        </div>
                        {entry.title ? (
                          <>
                            <p className="mt-1 truncate text-sm font-medium text-foreground">
                              {entry.title}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {entry.content.substring(0, 50)}
                              {entry.content.length > 50 ? "..." : ""}
                            </p>
                          </>
                        ) : (
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {entry.content.substring(0, 50)}
                            {entry.content.length > 50 ? "..." : ""}
                          </p>
                        )}
                        <EntryIOBadges entry={entry} isDiaryIOEnabled={isDiaryIOEnabled} />
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir entrada?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita. A entrada será removida permanentemente do seu diário.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(entry.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardHeader>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </aside>

      {/* Main Content */}
      <main className="flex flex-1 flex-col">
        {(selectedEntry || isCreating) ? (
          <>
            <div className="flex items-center justify-between border-b border-border p-4">
              <div>
                {isCreating ? (
                  <h2 className="font-medium text-foreground">Nova Entrada</h2>
                ) : (
                  <>
                    {selectedEntry?.title && (
                      <h2 className="text-lg font-semibold text-foreground">{selectedEntry.title}</h2>
                    )}
                    <p className={`text-sm text-muted-foreground ${selectedEntry?.title ? '' : 'font-medium text-foreground'}`}>
                      {format(new Date(selectedEntry!.created_at), "EEEE, d 'de' MMMM 'de' yyyy", {
                        locale: ptBR,
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Última edição:{" "}
                      {format(new Date(selectedEntry!.updated_at), "HH:mm", {
                        locale: ptBR,
                      })}
                    </p>
                  </>
                )}
              </div>
              <Button onClick={handleSave} disabled={!content.trim() || isSaving} className="bg-gradient-to-r from-emerald-500 to-lime-500 text-white shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 transition-all duration-300">
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Salvando..." : "Salvar"}
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={isCreating ? getPlaceholder() : "Escreva suas reflexões, orações e pensamentos aqui..."}
                className="min-h-[300px] resize-none border-0 text-base focus-visible:ring-0 md:min-h-[400px]"
              />
              {/* Analysis card for selected entries */}
              {selectedEntry && !isCreating && (
                <AnalysisCard entry={selectedEntry} isDiaryIOEnabled={isDiaryIOEnabled} />
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <div className="mb-4">
              <img src={zionLogo} alt="Zion" className="mx-auto h-12 w-12" />
            </div>
            <p className="mb-4 max-w-md text-lg italic text-muted-foreground">
              {getInspiration()}
            </p>
            <p className="mb-6 text-sm text-muted-foreground">
              {getStatsText()}
            </p>
            <Button onClick={handleNewEntry} className="bg-gradient-to-r from-emerald-500 to-lime-500 text-white shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 transition-all duration-300">
              <Plus className="mr-2 h-4 w-4" />
              Nova Entrada
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

export default Diary;
