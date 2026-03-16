import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import AdminRoute from "@/components/admin/AdminRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { 
  ArrowLeft, 
  FileText, 
  Tag, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  RefreshCw,
  Save,
  ChevronRight
} from "lucide-react";

type EmbeddingStatus = "pending" | "processing" | "ok" | "failed";

interface Chunk {
  id: string;
  doc_id: string;
  version_id: string;
  version: string;
  layer: string;
  domain: string;
  priority: number;
  retrievable: boolean;
  section_path: string[];
  position: number;
  text: string;
  tags_json: Record<string, any>;
  embedding_status: EmbeddingStatus;
  created_at: string;
}

interface Document {
  id: string;
  title: string;
  layer: string;
  domain: string;
}

const EMBEDDING_STATUS_CONFIG: Record<EmbeddingStatus, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "Pendente", color: "bg-muted text-muted-foreground", icon: Clock },
  processing: { label: "Processando", color: "bg-blue-500/20 text-blue-600", icon: RefreshCw },
  ok: { label: "OK", color: "bg-green-500/20 text-green-600", icon: CheckCircle },
  failed: { label: "Falhou", color: "bg-red-500/20 text-red-600", icon: AlertCircle },
};

const DocumentChunks = () => {
  const { docId } = useParams<{ docId: string }>();
  const navigate = useNavigate();
  const [document, setDocument] = useState<Document | null>(null);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingChunk, setEditingChunk] = useState<Chunk | null>(null);
  const [editedTags, setEditedTags] = useState("");
  const [reprocessing, setReprocessing] = useState(false);

  useEffect(() => {
    if (docId) {
      fetchData();
    }
  }, [docId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch document
      const { data: doc, error: docError } = await supabase
        .from("documents")
        .select("id, title, layer, domain, current_version_id")
        .eq("id", docId)
        .single();

      if (docError) throw docError;
      setDocument(doc as Document);

      // Fetch chunks for current version
      if (doc.current_version_id) {
        const { data: chunkData, error: chunkError } = await supabase
          .from("chunks")
          .select("*")
          .eq("version_id", doc.current_version_id)
          .order("position", { ascending: true });

        if (chunkError) throw chunkError;
        setChunks((chunkData as Chunk[]) || []);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      toast.error("Erro ao carregar chunks");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRetrievable = async (chunkId: string, currentValue: boolean) => {
    try {
      const { error } = await supabase
        .from("chunks")
        .update({ retrievable: !currentValue })
        .eq("id", chunkId);

      if (error) throw error;
      
      setChunks(prev => 
        prev.map(c => c.id === chunkId ? { ...c, retrievable: !currentValue } : c)
      );
      toast.success(currentValue ? "Chunk marcado como não recuperável" : "Chunk habilitado para recuperação");
    } catch (err) {
      toast.error("Erro ao atualizar chunk");
    }
  };

  const openTagEditor = (chunk: Chunk) => {
    setEditingChunk(chunk);
    setEditedTags(JSON.stringify(chunk.tags_json, null, 2));
  };

  const saveTagEdit = async () => {
    if (!editingChunk) return;

    try {
      const parsedTags = JSON.parse(editedTags);
      
      const { error } = await supabase
        .from("chunks")
        .update({ tags_json: parsedTags })
        .eq("id", editingChunk.id);

      if (error) throw error;
      
      setChunks(prev => 
        prev.map(c => c.id === editingChunk.id ? { ...c, tags_json: parsedTags } : c)
      );
      setEditingChunk(null);
      toast.success("Tags atualizadas");
    } catch (err) {
      if (err instanceof SyntaxError) {
        toast.error("JSON inválido");
      } else {
        toast.error("Erro ao salvar tags");
      }
    }
  };

  const reprocessEmbeddings = async () => {
    setReprocessing(true);
    let totalSuccess = 0;
    let totalFailed = 0;
    let continued = true;

    try {
      while (continued) {
        const { data, error } = await supabase.functions.invoke("ingest-document", {
          body: { action: "reprocess_all_embeddings" },
        });

        if (error) throw error;

        totalSuccess += data?.success_count || 0;
        totalFailed += data?.failed_count || 0;
        continued = data?.continued === true;

        if (continued) {
          toast.info(`Progresso: ${totalSuccess} OK, ${totalFailed} falhas — processando mais...`);
        }
      }

      toast.success(`Reprocessamento concluído: ${totalSuccess} OK, ${totalFailed} falhas`);
      fetchData();
    } catch (err) {
      console.error("Erro ao reprocessar embeddings:", err);
      toast.error("Erro ao reprocessar embeddings");
    } finally {
      setReprocessing(false);
    }
  };

  const stats = {
    total: chunks.length,
    ok: chunks.filter(c => c.embedding_status === "ok").length,
    pending: chunks.filter(c => c.embedding_status === "pending").length,
    failed: chunks.filter(c => c.embedding_status === "failed").length,
    retrievable: chunks.filter(c => c.retrievable).length,
  };

  return (
    <AdminRoute>
      <AdminLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin/documents")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
                <FileText className="h-8 w-8" />
                {document?.title || "Chunks do Documento"}
              </h1>
              <p className="text-muted-foreground mt-1">
                Gerencie os chunks e tags deste documento
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{stats.total}</div>
                <p className="text-xs text-muted-foreground">Total Chunks</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-green-600">{stats.ok}</div>
                <p className="text-xs text-muted-foreground">Embeddings OK</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
                <p className="text-xs text-muted-foreground">Falhas</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-primary">{stats.retrievable}</div>
                <p className="text-xs text-muted-foreground">Recuperáveis</p>
              </CardContent>
            </Card>
          </div>

          {/* Actions */}
          <div className="flex justify-end">
            <Button onClick={reprocessEmbeddings}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reprocessar Embeddings
            </Button>
          </div>

          {/* Chunks List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : chunks.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhum chunk encontrado</p>
                <p className="text-sm text-muted-foreground">Processe o documento para gerar chunks</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {chunks.map((chunk) => {
                const statusConfig = EMBEDDING_STATUS_CONFIG[chunk.embedding_status];
                const StatusIcon = statusConfig.icon;
                const tagCount = Object.keys(chunk.tags_json || {}).length;
                
                return (
                  <Card key={chunk.id} className={!chunk.retrievable ? "opacity-60" : ""}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1">
                          <CardTitle className="text-sm font-medium flex items-center gap-1 flex-wrap">
                            <span className="text-muted-foreground">#{chunk.position + 1}</span>
                            {chunk.section_path?.map((section, i) => (
                              <span key={i} className="flex items-center">
                                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                <span>{section}</span>
                              </span>
                            ))}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-2 flex-wrap">
                            <Badge className={statusConfig.color}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {statusConfig.label}
                            </Badge>
                            <Badge variant="outline" className="gap-1" onClick={() => openTagEditor(chunk)} style={{ cursor: "pointer" }}>
                              <Tag className="h-3 w-3" />
                              {tagCount} tags
                            </Badge>
                            <span className="text-xs">{chunk.text.length.toLocaleString()} chars</span>
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Recuperável</span>
                          <Switch
                            checked={chunk.retrievable}
                            onCheckedChange={() => handleToggleRetrievable(chunk.id, chunk.retrievable)}
                          />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                        {chunk.text}
                      </p>
                      {tagCount > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {Object.entries(chunk.tags_json || {}).map(([key, value]) => (
                            <Badge key={key} variant="secondary" className="text-xs">
                              {key} ({((value as any).confidence * 100).toFixed(0)}%)
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Tag Editor Dialog */}
          <Dialog open={!!editingChunk} onOpenChange={(open) => !open && setEditingChunk(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Editar Tags</DialogTitle>
                <DialogDescription>
                  Edite as tags do chunk em formato JSON
                </DialogDescription>
              </DialogHeader>
              <Textarea
                value={editedTags}
                onChange={(e) => setEditedTags(e.target.value)}
                className="min-h-[300px] font-mono text-sm"
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingChunk(null)}>
                  Cancelar
                </Button>
                <Button onClick={saveTagEdit}>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Tags
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </AdminLayout>
    </AdminRoute>
  );
};

export default DocumentChunks;
