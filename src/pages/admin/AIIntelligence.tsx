import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AdminLayout from "@/components/admin/AdminLayout";
import AdminRoute from "@/components/admin/AdminRoute";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Edit, Lock, ShieldAlert } from "lucide-react";

interface PromptBlock {
  id: string;
  key: string;
  category: string;
  name: string;
  content: string;
  description: string | null;
  is_active: boolean;
  is_locked: boolean;
  version: number;
  updated_at: string;
  created_at: string;
  updated_by: string | null;
}

const CATEGORIES = [
  { value: "core", label: "Core", help: "Identidade e respostas-base." },
  { value: "crisis", label: "Crise", help: "Keywords e respostas sensíveis." },
  { value: "observer", label: "Observer", help: "Extração e avaliação de jornada." },
  { value: "validator", label: "Validador", help: "Regras de reescrita e guardrails." },
  { value: "testimony", label: "Testemunho", help: "Transcrição e análise." },
  { value: "router", label: "Router", help: "Intenção e guias por intenção." },
  { value: "personalization", label: "Personalização", help: "Avatares e sinônimos." },
] as const;

const AIIntelligence = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [blocks, setBlocks] = useState<PromptBlock[]>([]);

  const [activeCategory, setActiveCategory] = useState<(typeof CATEGORIES)[number]["value"]>(
    "core",
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PromptBlock | null>(null);
  const [allowLockedEdit, setAllowLockedEdit] = useState(false);

  const [form, setForm] = useState({
    name: "",
    description: "",
    content: "",
  });

  const fetchBlocks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("ai_prompt_blocks")
      .select("*")
      .order("category", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.error(error);
      toast.error("Erro ao carregar blocos de inteligência");
      setBlocks([]);
      setLoading(false);
      return;
    }

    setBlocks((data || []) as PromptBlock[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchBlocks();
  }, []);

  const categoryBlocks = useMemo(
    () => blocks.filter((b) => b.category === activeCategory),
    [blocks, activeCategory],
  );

  const openEdit = (block: PromptBlock) => {
    setEditing(block);
    setAllowLockedEdit(false);
    setForm({
      name: block.name,
      description: block.description || "",
      content: block.content,
    });
    setDialogOpen(true);
  };

  const toggleActive = async (block: PromptBlock) => {
    if (block.is_locked) {
      toast.error("Bloco bloqueado: não é possível ativar/desativar aqui");
      return;
    }

    const { error } = await supabase
      .from("ai_prompt_blocks")
      .update({
        is_active: !block.is_active,
        version: block.version + 1,
        updated_by: user?.id ?? null,
      })
      .eq("id", block.id);

    if (error) {
      console.error(error);
      toast.error("Erro ao atualizar status");
      return;
    }

    await fetchBlocks();
  };

  const save = async () => {
    if (!editing) return;

    if (!form.name.trim() || !form.content.trim()) {
      toast.error("Preencha nome e conteúdo");
      return;
    }

    if (editing.is_locked && !allowLockedEdit) {
      toast.error("Este bloco está bloqueado. Desbloqueie a edição para prosseguir.");
      return;
    }

    const { error } = await supabase
      .from("ai_prompt_blocks")
      .update({
        name: form.name.trim(),
        description: form.description.trim() || null,
        content: form.content,
        version: editing.version + 1,
        updated_by: user?.id ?? null,
      })
      .eq("id", editing.id);

    if (error) {
      console.error(error);
      toast.error("Erro ao salvar alterações");
      return;
    }

    toast.success("Bloco atualizado");
    setDialogOpen(false);
    setEditing(null);
    await fetchBlocks();
  };

  const unlockLockedEdit = () => {
    const ok = confirm(
      "Este bloco é sensível e pode afetar segurança e compliance. Deseja liberar a edição agora?",
    );
    if (ok) setAllowLockedEdit(true);
  };

  return (
    <AdminRoute>
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Inteligência ZION</h2>
            <p className="text-muted-foreground">
              Edite os blocos de texto que compõem as regras e prompts do sistema.
            </p>
          </div>

          <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as any)}>
            <TabsList className="w-full justify-start flex-wrap h-auto">
              {CATEGORIES.map((c) => (
                <TabsTrigger key={c.value} value={c.value}>
                  {c.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {CATEGORIES.map((c) => (
              <TabsContent key={c.value} value={c.value} className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{c.label}</CardTitle>
                    <p className="text-sm text-muted-foreground">{c.help}</p>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="h-12 animate-pulse rounded bg-muted" />
                        ))}
                      </div>
                    ) : categoryBlocks.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum bloco nesta categoria.</p>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2">
                        {categoryBlocks.map((b) => (
                          <Card key={b.id} className={!b.is_active ? "opacity-60" : ""}>
                            <CardHeader className="pb-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <CardTitle className="text-base truncate">{b.name}</CardTitle>
                                  <p className="text-xs text-muted-foreground truncate">{b.key}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {b.is_locked && (
                                    <Badge variant="secondary" className="gap-1">
                                      <Lock className="h-3 w-3" />
                                      Bloqueado
                                    </Badge>
                                  )}
                                  <Badge variant={b.is_active ? "default" : "secondary"}>
                                    v{b.version}
                                  </Badge>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              {b.description ? (
                                <p className="text-sm text-muted-foreground line-clamp-2">{b.description}</p>
                              ) : (
                                <p className="text-sm text-muted-foreground">—</p>
                              )}

                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Switch checked={b.is_active} onCheckedChange={() => toggleActive(b)} disabled={b.is_locked} />
                                  <span className="text-sm text-muted-foreground">Ativo</span>
                                </div>

                                <Button variant="outline" size="sm" onClick={() => openEdit(b)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Editar
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Editar bloco</DialogTitle>
                <DialogDescription>
                  Mudanças aqui afetam como o sistema interpreta e responde.
                </DialogDescription>
              </DialogHeader>

              {editing && editing.is_locked && !allowLockedEdit && (
                <Card className="border-destructive/40">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-destructive" />
                      Bloco sensível
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    Este bloco está marcado como bloqueado. Para editar, é necessário confirmar o desbloqueio.
                    <div className="mt-3">
                      <Button variant="outline" onClick={unlockLockedEdit}>
                        Desbloquear edição
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="name">Nome</Label>
                    <Input
                      id="name"
                      value={form.name}
                      onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                      disabled={!!(editing?.is_locked && !allowLockedEdit)}
                    />
                  </div>
                  <div>
                    <Label>Chave</Label>
                    <Input value={editing?.key || ""} disabled />
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Descrição</Label>
                  <Input
                    id="description"
                    value={form.description}
                    onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
                    disabled={!!(editing?.is_locked && !allowLockedEdit)}
                  />
                </div>

                <div>
                  <Label htmlFor="content">Conteúdo</Label>
                  <Textarea
                    id="content"
                    value={form.content}
                    onChange={(e) => setForm((s) => ({ ...s, content: e.target.value }))}
                    className="min-h-[360px] font-mono text-sm"
                    disabled={!!(editing?.is_locked && !allowLockedEdit)}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={save}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </AdminLayout>
    </AdminRoute>
  );
};

export default AIIntelligence;
