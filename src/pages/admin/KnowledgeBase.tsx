import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Upload, Trash2, Edit, FileText } from "lucide-react";

interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  file_name: string | null;
  category: string;
  is_active: boolean;
  created_at: string;
}

const CATEGORIES = [
  { value: "general", label: "Geral" },
  { value: "metodologia", label: "Metodologia ZION" },
  { value: "devocional", label: "Devocional" },
  { value: "aconselhamento", label: "Aconselhamento" },
  { value: "estudos", label: "Estudos Bíblicos" },
];

const KnowledgeBase = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<KnowledgeItem | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    category: "general",
  });

  const fetchItems = async () => {
    const { data, error } = await supabase
      .from("knowledge_base")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar documentos");
      console.error(error);
    } else {
      setItems(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".md")) {
      toast.error("Apenas arquivos .md são permitidos");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setFormData({
        title: file.name.replace(".md", ""),
        content,
        category: formData.category,
      });
    };
    reader.readAsText(file);
  };

  const handleSubmit = async () => {
    if (!formData.title || !formData.content) {
      toast.error("Preencha título e conteúdo");
      return;
    }

    if (editingItem) {
      const { error } = await supabase
        .from("knowledge_base")
        .update({
          title: formData.title,
          content: formData.content,
          category: formData.category,
        })
        .eq("id", editingItem.id);

      if (error) {
        toast.error("Erro ao atualizar documento");
      } else {
        toast.success("Documento atualizado");
        fetchItems();
      }
    } else {
      const { error } = await supabase.from("knowledge_base").insert({
        title: formData.title,
        content: formData.content,
        category: formData.category,
        file_name: formData.title + ".md",
        created_by: user?.id,
      });

      if (error) {
        toast.error("Erro ao criar documento");
      } else {
        toast.success("Documento criado");
        fetchItems();
      }
    }

    setIsDialogOpen(false);
    setEditingItem(null);
    setFormData({ title: "", content: "", category: "general" });
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from("knowledge_base")
      .update({ is_active: !isActive })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao atualizar status");
    } else {
      fetchItems();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este documento?")) return;

    const { error } = await supabase
      .from("knowledge_base")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Erro ao excluir documento");
    } else {
      toast.success("Documento excluído");
      fetchItems();
    }
  };

  const openEdit = (item: KnowledgeItem) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      content: item.content,
      category: item.category,
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
                Base de Conhecimento
              </h2>
              <p className="text-muted-foreground">
                Documentos .md que a IA usará como contexto
              </p>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    setEditingItem(null);
                    setFormData({ title: "", content: "", category: "general" });
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Documento
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingItem ? "Editar Documento" : "Novo Documento"}
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <Label htmlFor="title">Título</Label>
                      <Input
                        id="title"
                        value={formData.title}
                        onChange={(e) =>
                          setFormData({ ...formData, title: e.target.value })
                        }
                        placeholder="Nome do documento"
                      />
                    </div>
                    <div>
                      <Label htmlFor="category">Categoria</Label>
                      <Select
                        value={formData.category}
                        onValueChange={(value) =>
                          setFormData({ ...formData, category: value })
                        }
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {!editingItem && (
                    <div>
                      <Label>Upload de Arquivo .md</Label>
                      <div className="mt-1">
                        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-4 transition-colors hover:border-primary">
                          <Upload className="h-5 w-5 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            Clique para fazer upload de um arquivo .md
                          </span>
                          <input
                            type="file"
                            accept=".md"
                            className="hidden"
                            onChange={handleFileUpload}
                          />
                        </label>
                      </div>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="content">Conteúdo</Label>
                    <Textarea
                      id="content"
                      value={formData.content}
                      onChange={(e) =>
                        setFormData({ ...formData, content: e.target.value })
                      }
                      placeholder="Conteúdo do documento em Markdown..."
                      className="min-h-[300px] font-mono text-sm"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button onClick={handleSubmit}>
                      {editingItem ? "Salvar Alterações" : "Criar Documento"}
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
                <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-lg font-medium text-foreground">
                  Nenhum documento cadastrado
                </p>
                <p className="text-sm text-muted-foreground">
                  Faça upload de arquivos .md para começar
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {items.map((item) => (
                <Card key={item.id}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-primary" />
                      <div>
                        <CardTitle className="text-base">{item.title}</CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {CATEGORIES.find((c) => c.value === item.category)?.label || item.category}
                          {" • "}
                          {new Date(item.created_at).toLocaleDateString("pt-BR")}
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
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {item.content.substring(0, 200)}...
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </AdminLayout>
    </AdminRoute>
  );
};

export default KnowledgeBase;
