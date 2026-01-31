import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, ArrowLeft, Trash2, Calendar, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import SafetyExit from "@/components/SafetyExit";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import zionLogo from "@/assets/zion-logo.png";

interface DiaryEntry {
  id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

const Diary = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();

  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<DiaryEntry | null>(null);
  const [content, setContent] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setEntries(data);
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

        setEntries((prev) => [data, ...prev]);
        setSelectedEntry(data);
        setIsCreating(false);

        toast({
          title: "Entrada salva",
          description: "Sua reflexão foi registrada com sucesso.",
        });
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

      {/* Sidebar - Lista de Entradas */}
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

        <ScrollArea className="h-48 md:h-[calc(100vh-65px)]">
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
                        <CardTitle className="text-sm font-medium">
                          {format(new Date(entry.created_at), "d 'de' MMMM", {
                            locale: ptBR,
                          })}
                        </CardTitle>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {entry.content.substring(0, 50)}...
                        </p>
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

      {/* Main Content - Editor */}
      <main className="flex flex-1 flex-col">
        {(selectedEntry || isCreating) ? (
          <>
            <div className="flex items-center justify-between border-b border-border p-4">
              <div>
                <h2 className="font-medium text-foreground">
                  {isCreating
                    ? "Nova Entrada"
                    : format(new Date(selectedEntry!.created_at), "EEEE, d 'de' MMMM 'de' yyyy", {
                        locale: ptBR,
                      })}
                </h2>
                {!isCreating && (
                  <p className="text-xs text-muted-foreground">
                    Última edição:{" "}
                    {format(new Date(selectedEntry!.updated_at), "HH:mm", {
                      locale: ptBR,
                    })}
                  </p>
                )}
              </div>
              <Button onClick={handleSave} disabled={!content.trim() || isSaving} className="bg-gradient-to-r from-emerald-500 to-lime-500 text-white shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 transition-all duration-300">
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Salvando..." : "Salvar"}
              </Button>
            </div>

            <div className="flex-1 p-4">
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Escreva suas reflexões, orações e pensamentos aqui..."
                className="min-h-[300px] resize-none border-0 text-base focus-visible:ring-0 md:min-h-full"
              />
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <div className="mb-4">
              <img src={zionLogo} alt="Zion" className="h-16 w-16 mx-auto" />
            </div>
            <h2 className="mb-2 text-lg font-medium text-foreground">
              Seu Diário Espiritual
            </h2>
            <p className="mb-6 max-w-sm text-sm text-muted-foreground">
              Um espaço privado para registrar suas reflexões, orações e momentos 
              de conexão com Deus.
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
