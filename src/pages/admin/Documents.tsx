import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import AdminRoute from "@/components/admin/AdminRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { 
  Plus, 
  FileText, 
  Upload, 
  Trash2, 
  Edit, 
  Play, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Eye,
  Layers
} from "lucide-react";

type DocLayer = "CONSTITUICAO" | "NUCLEO" | "BIBLIOTECA";
type DocStatus = "draft" | "review" | "published";

interface Document {
  id: string;
  title: string;
  layer: DocLayer;
  domain: string;
  language: string;
  retrievable: boolean;
  priority: number;
  status: DocStatus;
  current_version_id: string | null;
  created_at: string;
  updated_at: string;
}

interface DocumentVersion {
  id: string;
  doc_id: string;
  version: string;
  raw_text: string | null;
  normalized_text: string | null;
  status: DocStatus;
  created_at: string;
}

const LAYERS: { value: DocLayer; label: string; description: string }[] = [
  { value: "CONSTITUICAO", label: "Constituição", description: "Textos canônicos (não entram no RAG por padrão)" },
  { value: "NUCLEO", label: "Núcleo", description: "Alta prioridade no RAG" },
  { value: "BIBLIOTECA", label: "Biblioteca", description: "Sob demanda (prioridade média/baixa)" },
];

const DOMAINS = [
  "metodologia_teologia",
  "canonic",
  "produto_metodologia",
  "teologia_antropologia",
  "metodologia",
  "diagnostico_identidade",
  "diagnostico",
  "intervencao",
  "produto_arquitetura",
  "exegese_aplicada",
  "perfis",
  "modelo_humano",
];

const STATUS_CONFIG: Record<DocStatus, { label: string; color: string; icon: typeof Clock }> = {
  draft: { label: "Rascunho", color: "bg-muted text-muted-foreground", icon: Clock },
  review: { label: "Em Revisão", color: "bg-yellow-500/20 text-yellow-600", icon: AlertCircle },
  published: { label: "Publicado", color: "bg-green-500/20 text-green-600", icon: CheckCircle },
};

const Documents = () => {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    title: "",
    layer: "BIBLIOTECA" as DocLayer,
    domain: "geral",
    rawText: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setDocuments((data as Document[]) || []);
    } catch (err) {
      console.error("Error fetching documents:", err);
      toast.error("Erro ao carregar documentos");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = [".md", ".txt"];
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    
    if (!allowedTypes.includes(ext)) {
      toast.error("Tipo de arquivo não suportado. Use .md ou .txt");
      return;
    }

    try {
      const text = await file.text();
      setFormData(prev => ({
        ...prev,
        title: prev.title || file.name.replace(/\.[^.]+$/, ""),
        rawText: text,
      }));
      toast.success("Arquivo carregado");
    } catch (err) {
      toast.error("Erro ao ler arquivo");
    }
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      toast.error("Título é obrigatório");
      return;
    }

    if (!formData.rawText.trim()) {
      toast.error("Conteúdo é obrigatório");
      return;
    }

    try {
      if (editingId) {
        // Atualizar documento existente
        const { error: docError } = await supabase
          .from("documents")
          .update({
            title: formData.title,
            layer: formData.layer,
            domain: formData.domain,
            retrievable: formData.layer !== "CONSTITUICAO",
            priority: formData.layer === "CONSTITUICAO" ? 100 : formData.layer === "NUCLEO" ? 80 : 50,
          })
          .eq("id", editingId);

        if (docError) throw docError;

        // Criar nova versão
        const { data: lastVersion } = await supabase
          .from("document_versions")
          .select("version")
          .eq("doc_id", editingId)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        const nextVersion = incrementVersion(lastVersion?.version || "0.0.0");

        const { data: newVersion, error: verError } = await supabase
          .from("document_versions")
          .insert({
            doc_id: editingId,
            version: nextVersion,
            raw_text: formData.rawText,
            status: "draft",
          })
          .select()
          .single();

        if (verError) throw verError;

        // Atualizar current_version_id
        await supabase
          .from("documents")
          .update({ current_version_id: newVersion.id, status: "draft" })
          .eq("id", editingId);

        toast.success("Documento atualizado");
      } else {
        // Criar novo documento
        const { data: newDoc, error: docError } = await supabase
          .from("documents")
          .insert({
            title: formData.title,
            layer: formData.layer,
            domain: formData.domain,
            language: "pt",
            retrievable: formData.layer !== "CONSTITUICAO",
            priority: formData.layer === "CONSTITUICAO" ? 100 : formData.layer === "NUCLEO" ? 80 : 50,
            status: "draft",
          })
          .select()
          .single();

        if (docError) throw docError;

        // Criar primeira versão
        const { data: newVersion, error: verError } = await supabase
          .from("document_versions")
          .insert({
            doc_id: newDoc.id,
            version: "1.0.0",
            raw_text: formData.rawText,
            status: "draft",
          })
          .select()
          .single();

        if (verError) throw verError;

        // Atualizar current_version_id
        await supabase
          .from("documents")
          .update({ current_version_id: newVersion.id })
          .eq("id", newDoc.id);

        toast.success("Documento criado");
      }

      resetForm();
      setDialogOpen(false);
      fetchDocuments();
    } catch (err) {
      console.error("Error saving document:", err);
      toast.error("Erro ao salvar documento");
    }
  };

  const handleProcess = async (docId: string) => {
    setProcessing(docId);
    try {
      // Buscar current_version_id
      const { data: doc } = await supabase
        .from("documents")
        .select("current_version_id")
        .eq("id", docId)
        .single();

      if (!doc?.current_version_id) {
        toast.error("Nenhuma versão encontrada");
        return;
      }

      const { data, error } = await supabase.functions.invoke("ingest-document", {
        body: {
          doc_id: docId,
          version_id: doc.current_version_id,
          action: "generate_embeddings",
        },
      });

      if (error) throw error;

      toast.success(`Processado: ${data.chunks_created} chunks criados`);
      fetchDocuments();
    } catch (err) {
      console.error("Error processing:", err);
      toast.error("Erro ao processar documento");
    } finally {
      setProcessing(null);
    }
  };

  const handlePublish = async (docId: string) => {
    try {
      const { data: doc } = await supabase
        .from("documents")
        .select("current_version_id")
        .eq("id", docId)
        .single();

      if (!doc?.current_version_id) {
        toast.error("Nenhuma versão encontrada");
        return;
      }

      // Atualizar documento e versão para published
      await supabase
        .from("documents")
        .update({ status: "published" })
        .eq("id", docId);

      await supabase
        .from("document_versions")
        .update({ status: "published" })
        .eq("id", doc.current_version_id);

      toast.success("Documento publicado");
      fetchDocuments();
    } catch (err) {
      console.error("Error publishing:", err);
      toast.error("Erro ao publicar documento");
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm("Tem certeza que deseja excluir este documento?")) return;

    try {
      const { error } = await supabase
        .from("documents")
        .delete()
        .eq("id", docId);

      if (error) throw error;
      toast.success("Documento excluído");
      fetchDocuments();
    } catch (err) {
      console.error("Error deleting:", err);
      toast.error("Erro ao excluir documento");
    }
  };

  const openEdit = async (doc: Document) => {
    try {
      if (doc.current_version_id) {
        const { data: version } = await supabase
          .from("document_versions")
          .select("raw_text")
          .eq("id", doc.current_version_id)
          .single();

        setFormData({
          title: doc.title,
          layer: doc.layer,
          domain: doc.domain,
          rawText: version?.raw_text || "",
        });
      } else {
        setFormData({
          title: doc.title,
          layer: doc.layer,
          domain: doc.domain,
          rawText: "",
        });
      }
      setEditingId(doc.id);
      setDialogOpen(true);
    } catch (err) {
      toast.error("Erro ao carregar documento");
    }
  };

  const resetForm = () => {
    setFormData({ title: "", layer: "BIBLIOTECA", domain: "geral", rawText: "" });
    setEditingId(null);
  };

  const incrementVersion = (version: string): string => {
    const parts = version.split(".").map(Number);
    parts[2] = (parts[2] || 0) + 1;
    return parts.join(".");
  };

  return (
    <AdminRoute>
      <AdminLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Documentos RAG</h1>
              <p className="text-muted-foreground mt-1">
                Gerencie documentos para a Base de Conhecimento com pipeline de ingestão
              </p>
            </div>
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Documento
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingId ? "Editar Documento" : "Novo Documento"}</DialogTitle>
                  <DialogDescription>
                    {editingId ? "Editar cria uma nova versão do documento" : "Adicione um novo documento à base de conhecimento"}
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Título</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Nome do documento"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="layer">Camada</Label>
                      <Select
                        value={formData.layer}
                        onValueChange={(value: DocLayer) => setFormData(prev => ({ ...prev, layer: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LAYERS.map((layer) => (
                            <SelectItem key={layer.value} value={layer.value}>
                              <div>
                                <span className="font-medium">{layer.label}</span>
                                <p className="text-xs text-muted-foreground">{layer.description}</p>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="domain">Domínio</Label>
                      <Select
                        value={formData.domain}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, domain: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DOMAINS.map((domain) => (
                            <SelectItem key={domain} value={domain}>
                              {domain.replace(/_/g, " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Conteúdo</Label>
                    <div className="flex items-center gap-2 mb-2">
                      <Label htmlFor="file-upload" className="cursor-pointer">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                          <Upload className="h-4 w-4" />
                          <span>Upload .md ou .txt</span>
                        </div>
                        <input
                          id="file-upload"
                          type="file"
                          accept=".md,.txt"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </Label>
                    </div>
                    <Textarea
                      value={formData.rawText}
                      onChange={(e) => setFormData(prev => ({ ...prev, rawText: e.target.value }))}
                      placeholder="Cole o conteúdo do documento aqui ou faça upload de um arquivo..."
                      className="min-h-[300px] font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      {formData.rawText.length.toLocaleString()} caracteres
                    </p>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSubmit}>
                    {editingId ? "Salvar Nova Versão" : "Criar Documento"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Documents List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : documents.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhum documento encontrado</p>
                <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Criar primeiro documento
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {documents.map((doc) => {
                const statusConfig = STATUS_CONFIG[doc.status];
                const StatusIcon = statusConfig.icon;
                
                return (
                  <Card key={doc.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            {doc.title}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="gap-1">
                              <Layers className="h-3 w-3" />
                              {LAYERS.find(l => l.value === doc.layer)?.label || doc.layer}
                            </Badge>
                            <Badge variant="secondary">{doc.domain}</Badge>
                            <Badge className={statusConfig.color}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {statusConfig.label}
                            </Badge>
                            {!doc.retrievable && (
                              <Badge variant="destructive">Não Recuperável</Badge>
                            )}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/admin/documents/${doc.id}/chunks`)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Chunks
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleProcess(doc.id)}
                            disabled={processing === doc.id}
                          >
                            {processing === doc.id ? (
                              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                            ) : (
                              <Play className="h-4 w-4 mr-1" />
                            )}
                            Processar
                          </Button>
                          {doc.status === "review" && (
                            <Button
                              size="sm"
                              onClick={() => handlePublish(doc.id)}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Publicar
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(doc)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(doc.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        Prioridade: {doc.priority} • Atualizado: {new Date(doc.updated_at).toLocaleDateString("pt-BR")}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </AdminLayout>
    </AdminRoute>
  );
};

export default Documents;
