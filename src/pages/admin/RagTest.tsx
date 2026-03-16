import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import AdminRoute from "@/components/admin/AdminRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, XCircle, Search, Layers, Tag, ChevronRight, Cpu } from "lucide-react";

interface SearchResult {
  id: string;
  doc_id: string;
  text: string;
  section_path: string[];
  tags_json: Record<string, any>;
  layer: string;
  domain: string;
  priority: number;
  similarity: number;
  embedding_model_id?: string;
  doc_title?: string;
  doc_status?: string;
  retrievable?: boolean;
}

interface MultiResult {
  threshold: number;
  results: SearchResult[];
  time: number;
}

const LAYERS = [
  { value: "__all__", label: "Todas as camadas" },
  { value: "CONSTITUICAO", label: "Constituição" },
  { value: "NUCLEO", label: "Núcleo" },
  { value: "BIBLIOTECA", label: "Biblioteca" },
];

const DOMAINS = [
  { value: "__all__", label: "Todos os domínios" },
  { value: "geral", label: "Geral" },
  { value: "metodologia", label: "Metodologia" },
  { value: "diagnostico", label: "Diagnóstico" },
  { value: "perfis", label: "Perfis" },
  { value: "exegese_aplicada", label: "Exegese Aplicada" },
  { value: "produto_arquitetura", label: "Produto Arquitetura" },
  { value: "devocional", label: "Devocional" },
  { value: "teologia", label: "Teologia" },
];

const MULTI_THRESHOLDS = [0.30, 0.35, 0.40, 0.45, 0.50];

const RagTest = () => {
  const [query, setQuery] = useState("");
  const [filterLayer, setFilterLayer] = useState("__all__");
  const [filterDomain, setFilterDomain] = useState("__all__");
  const [matchThreshold, setMatchThreshold] = useState([0.40]);
  const [matchCount, setMatchCount] = useState([10]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTime, setSearchTime] = useState<number | null>(null);
  const [multiMode, setMultiMode] = useState(false);
  const [multiResults, setMultiResults] = useState<MultiResult[]>([]);
  const [activeTab, setActiveTab] = useState("0.40");

  const invokeSearch = async (q: string, threshold: number) => {
    const start = performance.now();
    const { data, error } = await supabase.functions.invoke("search-chunks", {
      body: {
        query: q,
        match_threshold: threshold,
        match_count: matchCount[0],
        filter_layer: filterLayer === "__all__" ? null : filterLayer,
        filter_domain: filterDomain === "__all__" ? null : filterDomain,
      },
    });
    if (error) throw error;
    return {
      threshold,
      results: (data.chunks || []) as SearchResult[],
      time: performance.now() - start,
    };
  };

  const handleSearch = async () => {
    if (!query.trim()) {
      toast.error("Digite uma consulta");
      return;
    }

    setLoading(true);
    setSearchTime(null);
    setResults([]);
    setMultiResults([]);

    try {
      if (multiMode) {
        const startTime = performance.now();
        const promises = MULTI_THRESHOLDS.map((t) => invokeSearch(query, t));
        const allResults = await Promise.all(promises);
        setMultiResults(allResults);
        setSearchTime(performance.now() - startTime);
        const totalChunks = allResults.reduce((s, r) => s + r.results.length, 0);
        toast.success(`${totalChunks} resultados em ${MULTI_THRESHOLDS.length} thresholds`);
      } else {
        const res = await invokeSearch(query, matchThreshold[0]);
        setResults(res.results);
        setSearchTime(res.time);
        if (res.results.length === 0) {
          toast.info("Nenhum resultado encontrado");
        } else {
          toast.success(`${res.results.length} resultados encontrados`);
        }
      }
    } catch (err) {
      console.error("Search error:", err);
      toast.error("Erro na busca");
    } finally {
      setLoading(false);
    }
  };

  const renderResultCard = (result: SearchResult, index: number) => (
    <Card key={result.id}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div className="space-y-1">
            <CardTitle className="text-sm font-medium flex items-center gap-1 flex-wrap">
              <span className="text-primary font-bold">#{index + 1}</span>
              <Badge variant="outline" className="ml-2">
                {(result.similarity * 100).toFixed(1)}% similar
              </Badge>
              {result.retrievable !== undefined && (
                result.retrievable ? (
                  <Badge variant="default" className="gap-1 bg-green-600">
                    <CheckCircle className="h-3 w-3" />
                    Recuperável
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="h-3 w-3" />
                    Não Recuperável
                  </Badge>
                )
              )}
              {result.embedding_model_id && (
                <Badge variant="secondary" className="gap-1">
                  <Cpu className="h-3 w-3" />
                  {result.embedding_model_id}
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="flex items-center gap-1 flex-wrap">
              {result.doc_title && (
                <span className="font-medium text-foreground mr-2">
                  [{result.doc_title}]
                </span>
              )}
              {result.section_path?.map((section, i) => (
                <span key={i} className="flex items-center">
                  {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                  <span>{section}</span>
                </span>
              ))}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="gap-1">
              <Layers className="h-3 w-3" />
              {result.layer}
            </Badge>
            <Badge variant="secondary">{result.domain}</Badge>
            <Badge>P: {result.priority}</Badge>
            {result.doc_status && (
              <Badge
                variant={result.doc_status === "published" ? "default" : "outline"}
                className={result.doc_status === "published" ? "bg-green-600" : ""}
              >
                {result.doc_status}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm whitespace-pre-wrap line-clamp-6">{result.text}</p>
        {Object.keys(result.tags_json || {}).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            <Tag className="h-3 w-3 text-muted-foreground" />
            {Object.entries(result.tags_json || {}).map(([key]) => (
              <Badge key={key} variant="secondary" className="text-xs">
                {key}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderResults = (items: SearchResult[]) => (
    <div className="space-y-4">
      {items.map((result, index) => renderResultCard(result, index))}
    </div>
  );

  return (
    <AdminRoute>
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Search className="h-8 w-8" />
              Teste RAG
            </h1>
            <p className="text-muted-foreground mt-1">
              Teste a busca vetorial semântica e visualize os chunks recuperados
            </p>
          </div>

          {/* Search Form */}
          <Card>
            <CardHeader>
              <CardTitle>Consulta</CardTitle>
              <CardDescription>
                Digite uma pergunta ou termo para buscar na base de conhecimento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="query">Pergunta / Termo de busca</Label>
                <div className="flex gap-2">
                  <Input
                    id="query"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ex: Como lidar com o medo da rejeição?"
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSearch}
                    disabled={loading}
                    className="bg-gradient-to-r from-emerald-500 to-lime-500 text-white shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 transition-all duration-300"
                  >
                    {loading ? (
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Filtrar por Camada</Label>
                  <Select value={filterLayer} onValueChange={setFilterLayer}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as camadas" />
                    </SelectTrigger>
                    <SelectContent>
                      {LAYERS.map((layer) => (
                        <SelectItem key={layer.value} value={layer.value}>
                          {layer.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Filtrar por Domínio</Label>
                  <Select value={filterDomain} onValueChange={setFilterDomain}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os domínios" />
                    </SelectTrigger>
                    <SelectContent>
                      {DOMAINS.map((domain) => (
                        <SelectItem key={domain.value} value={domain.value}>
                          {domain.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Multi-threshold toggle */}
              <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted/30">
                <Checkbox
                  id="multi-mode"
                  checked={multiMode}
                  onCheckedChange={(checked) => setMultiMode(checked === true)}
                />
                <Label htmlFor="multi-mode" className="cursor-pointer font-medium">
                  Comparar múltiplos thresholds
                </Label>
                <span className="text-xs text-muted-foreground ml-2">
                  (0.30, 0.35, 0.40, 0.45, 0.50)
                </span>
              </div>

              {!multiMode && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Threshold de Similaridade: {matchThreshold[0].toFixed(2)}</Label>
                    <Slider
                      value={matchThreshold}
                      onValueChange={setMatchThreshold}
                      min={0}
                      max={1}
                      step={0.05}
                    />
                    <p className="text-xs text-muted-foreground">
                      Quanto maior, mais restritivo (só resultados muito similares)
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Máximo de Resultados: {matchCount[0]}</Label>
                    <Slider
                      value={matchCount}
                      onValueChange={setMatchCount}
                      min={1}
                      max={50}
                      step={1}
                    />
                  </div>
                </div>
              )}

              {multiMode && (
                <div className="space-y-2">
                  <Label>Máximo de Resultados por Threshold: {matchCount[0]}</Label>
                  <Slider
                    value={matchCount}
                    onValueChange={setMatchCount}
                    min={1}
                    max={50}
                    step={1}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Results */}
          {searchTime !== null && (
            <p className="text-sm text-muted-foreground">
              Busca concluída em {searchTime.toFixed(0)}ms
              {!multiMode && ` • ${results.length} resultados`}
            </p>
          )}

          {/* Single mode results */}
          {!multiMode && results.length > 0 && renderResults(results)}

          {/* Multi mode results */}
          {multiMode && multiResults.length > 0 && (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full justify-start">
                {multiResults.map((mr) => (
                  <TabsTrigger key={mr.threshold} value={mr.threshold.toFixed(2)}>
                    {mr.threshold.toFixed(2)} ({mr.results.length})
                  </TabsTrigger>
                ))}
              </TabsList>
              {multiResults.map((mr) => (
                <TabsContent key={mr.threshold} value={mr.threshold.toFixed(2)}>
                  <p className="text-sm text-muted-foreground mb-4">
                    Threshold {mr.threshold.toFixed(2)}: {mr.results.length} resultados em{" "}
                    {mr.time.toFixed(0)}ms
                  </p>
                  {mr.results.length > 0 ? (
                    renderResults(mr.results)
                  ) : (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <Search className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">Nenhum resultado neste threshold</p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          )}

          {/* Empty state */}
          {!multiMode && results.length === 0 && searchTime !== null && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Search className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhum resultado encontrado</p>
                <p className="text-sm text-muted-foreground">
                  Tente ajustar o threshold ou os filtros
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </AdminLayout>
    </AdminRoute>
  );
};

export default RagTest;
