import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import AdminRoute from "@/components/admin/AdminRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Edit, Settings, GripVertical } from "lucide-react";

interface InstructionItem {
  id: string;
  name: string;
  content: string;
  is_active: boolean;
  priority: number;
  created_at: string;
}

const SystemInstructions = () => {
  const [items, setItems] = useState<InstructionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InstructionItem | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    content: "",
    priority: 0,
  });

  const fetchItems = async () => {
    const { data, error } = await supabase
      .from("system_instructions")
      .select("*")
      .order("priority", { ascending: true });

    if (error) {
      toast.error("Erro ao carregar instruções");
      console.error(error);
    } else {
      setItems(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleSubmit = async () => {
    if (!formData.name || !formData.content) {
      toast.error("Preencha nome e conteúdo");
      return;
    }

    if (editingItem) {
      const { error } = await supabase
        .from("system_instructions")
        .update({
          name: formData.name,
          content: formData.content,
          priority: formData.priority,
        })
        .eq("id", editingItem.id);

      if (error) {
        toast.error("Erro ao atualizar instrução");
      } else {
        toast.success("Instrução atualizada");
        fetchItems();
      }
    } else {
      const { error } = await supabase.from("system_instructions").insert({
        name: formData.name,
        content: formData.content,
        priority: formData.priority,
      });

      if (error) {
        toast.error("Erro ao criar instrução");
      } else {
        toast.success("Instrução criada");
        fetchItems();
      }
    }

    setIsDialogOpen(false);
    setEditingItem(null);
    setFormData({ name: "", content: "", priority: 0 });
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from("system_instructions")
      .update({ is_active: !isActive })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao atualizar status");
    } else {
      fetchItems();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta instrução?")) return;

    const { error } = await supabase
      .from("system_instructions")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Erro ao excluir instrução");
    } else {
      toast.success("Instrução excluída");
      fetchItems();
    }
  };

  const openEdit = (item: InstructionItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      content: item.content,
      priority: item.priority,
    });
    setIsDialogOpen(true);
  };

  return (
    <AdminRoute>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                System Instructions
              </h2>
              <p className="text-muted-foreground">
                Instruções personalizadas que guiam o comportamento da IA
              </p>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    setEditingItem(null);
                    setFormData({ name: "", content: "", priority: items.length });
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Instrução
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingItem ? "Editar Instrução" : "Nova Instrução"}
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <Label htmlFor="name">Nome</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        placeholder="Ex: Tom de Voz"
                      />
                    </div>
                    <div className="w-24">
                      <Label htmlFor="priority">Prioridade</Label>
                      <Input
                        id="priority"
                        type="number"
                        value={formData.priority}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            priority: parseInt(e.target.value) || 0,
                          })
                        }
                        min={0}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="content">Conteúdo da Instrução</Label>
                    <Textarea
                      id="content"
                      value={formData.content}
                      onChange={(e) =>
                        setFormData({ ...formData, content: e.target.value })
                      }
                      placeholder="Escreva as instruções que a IA deve seguir..."
                      className="min-h-[300px]"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Estas instruções serão adicionadas ao prompt do sistema antes de cada resposta.
                    </p>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button onClick={handleSubmit}>
                      {editingItem ? "Salvar Alterações" : "Criar Instrução"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : items.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Settings className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-lg font-medium text-foreground">
                  Nenhuma instrução configurada
                </p>
                <p className="text-sm text-muted-foreground">
                  Adicione instruções para personalizar o comportamento da IA
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <Card key={item.id} className={!item.is_active ? "opacity-50" : ""}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="flex items-center gap-3">
                      <GripVertical className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <CardTitle className="text-base">{item.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">
                          Prioridade: {item.priority}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={item.is_active}
                        onCheckedChange={() =>
                          handleToggleActive(item.id, item.is_active)
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(item)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="line-clamp-3 text-sm text-muted-foreground whitespace-pre-wrap">
                      {item.content}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Preview Section */}
          {items.filter((i) => i.is_active).length > 0 && (
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="text-sm">Preview do Prompt</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg bg-muted p-4 font-mono text-xs">
                  <p className="mb-2 font-bold">[INSTRUÇÕES CUSTOMIZADAS]</p>
                  {items
                    .filter((i) => i.is_active)
                    .map((item) => (
                      <div key={item.id} className="mb-2">
                        <p className="text-primary">## {item.name}</p>
                        <p className="whitespace-pre-wrap text-muted-foreground">
                          {item.content.substring(0, 150)}...
                        </p>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </AdminLayout>
    </AdminRoute>
  );
};

export default SystemInstructions;
