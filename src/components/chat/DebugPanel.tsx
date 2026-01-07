import { useState } from "react";
import { ChevronDown, ChevronUp, Bug, AlertTriangle, CheckCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface TopChunk {
  id: string;
  title: string;
  score: string;
  text_preview: string;
}

interface ValidationIssue {
  code: string;
  severity: 'CRITICAL' | 'HIGH' | 'FORMAT' | 'MEDIUM';
  message: string;
}

interface RetrievalStats {
  max_score: number;
  avg_score: number;
  chunks_above_threshold: number;
  total_chunks: number;
}

interface DebugData {
  intent?: string;
  role?: string;
  risk_level?: string;
  chunk_ids?: string[];
  tags_applied?: string[];
  rag_plan?: {
    layers?: string[];
    topK?: number;
    filters?: Record<string, string>;
  };
  scores?: Record<string, number>;
  latency_ms?: number;
  guardrails?: string[];
  top_chunks?: TopChunk[];
  // New fields (Phase 3-4)
  retrieval_confidence?: 'high' | 'medium' | 'low';
  low_confidence_retrieval?: boolean;
  retrieval_stats?: RetrievalStats;
  validation?: {
    char_count: number;
    line_count: number;
    question_count: number;
    issues: ValidationIssue[];
    was_rewritten: boolean;
  };
}

interface DebugPanelProps {
  visible: boolean;
  debugData: DebugData;
}

const getRiskBadgeVariant = (risk?: string) => {
  switch (risk) {
    case "high":
      return "destructive";
    case "medium":
      return "secondary";
    case "low":
      return "outline";
    default:
      return "outline";
  }
};

const getConfidenceBadgeClass = (confidence?: string) => {
  switch (confidence) {
    case "high":
      return "bg-green-600 text-white";
    case "medium":
      return "bg-yellow-500 text-black";
    case "low":
      return "bg-red-500 text-white";
    default:
      return "";
  }
};

const getSeverityBadgeClass = (severity: string) => {
  switch (severity) {
    case "CRITICAL":
      return "bg-red-600 text-white";
    case "HIGH":
      return "bg-orange-500 text-white";
    case "FORMAT":
      return "bg-yellow-500 text-black";
    case "MEDIUM":
      return "bg-blue-500 text-white";
    default:
      return "";
  }
};

export const DebugPanel = ({ visible, debugData }: DebugPanelProps) => {
  const [isOpen, setIsOpen] = useState(true);

  if (!visible) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-2">
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <Bug className="h-3 w-3" />
          Debug
          {isOpen ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 rounded-lg border border-border bg-muted/50 p-3 text-xs">
          {/* Header badges */}
          <div className="mb-3 flex flex-wrap gap-2">
            {debugData.intent && (
              <Badge variant="secondary" className="text-xs">
                Intent: {debugData.intent}
              </Badge>
            )}
            {debugData.role && (
              <Badge variant="outline" className="text-xs">
                Role: {debugData.role}
              </Badge>
            )}
            {debugData.risk_level && (
              <Badge variant={getRiskBadgeVariant(debugData.risk_level)} className="text-xs">
                Risk: {debugData.risk_level}
              </Badge>
            )}
            {debugData.latency_ms && (
              <Badge variant="outline" className="text-xs">
                {debugData.latency_ms}ms
              </Badge>
            )}
            {/* Retrieval Confidence Badge */}
            {debugData.retrieval_confidence && (
              <Badge className={`text-xs ${getConfidenceBadgeClass(debugData.retrieval_confidence)}`}>
                Retrieval: {debugData.retrieval_confidence}
              </Badge>
            )}
            {/* Low Confidence Indicator */}
            {debugData.low_confidence_retrieval && (
              <Badge variant="destructive" className="text-xs gap-1">
                <AlertTriangle className="h-3 w-3" />
                Low Confidence
              </Badge>
            )}
            {/* Rewritten Indicator */}
            {debugData.validation?.was_rewritten && (
              <Badge className="text-xs bg-purple-600 text-white gap-1">
                <RefreshCw className="h-3 w-3" />
                Reescrito
              </Badge>
            )}
          </div>

          {/* Retrieval Stats */}
          {debugData.retrieval_stats && (
            <div className="mb-3">
              <p className="mb-1 font-medium text-muted-foreground">Retrieval Stats</p>
              <div className="rounded bg-background p-2 grid grid-cols-2 gap-2">
                <p>
                  <span className="text-muted-foreground">Max Score:</span>{" "}
                  <span className="font-mono">{(debugData.retrieval_stats.max_score * 100).toFixed(1)}%</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Avg Score:</span>{" "}
                  <span className="font-mono">{(debugData.retrieval_stats.avg_score * 100).toFixed(1)}%</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Above Threshold:</span>{" "}
                  <span className="font-mono">{debugData.retrieval_stats.chunks_above_threshold}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Total Chunks:</span>{" "}
                  <span className="font-mono">{debugData.retrieval_stats.total_chunks}</span>
                </p>
              </div>
            </div>
          )}

          {/* Validation Section */}
          {debugData.validation && (
            <div className="mb-3">
              <p className="mb-1 font-medium text-muted-foreground">Validation</p>
              <div className="rounded bg-background p-2">
                {/* Counters */}
                <div className="flex gap-4 mb-2">
                  <span>
                    <span className="text-muted-foreground">Chars:</span>{" "}
                    <span className={`font-mono ${debugData.validation.char_count > 900 ? 'text-red-500' : ''}`}>
                      {debugData.validation.char_count}
                    </span>
                  </span>
                  <span>
                    <span className="text-muted-foreground">Lines:</span>{" "}
                    <span className={`font-mono ${debugData.validation.line_count > 7 ? 'text-red-500' : ''}`}>
                      {debugData.validation.line_count}
                    </span>
                  </span>
                  <span>
                    <span className="text-muted-foreground">Questions:</span>{" "}
                    <span className={`font-mono ${debugData.validation.question_count < 2 ? 'text-red-500' : ''}`}>
                      {debugData.validation.question_count}
                    </span>
                  </span>
                </div>
                
                {/* Issues */}
                {debugData.validation.issues.length > 0 ? (
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs">Issues ({debugData.validation.issues.length}):</p>
                    <div className="flex flex-wrap gap-1">
                      {debugData.validation.issues.map((issue, idx) => (
                        <Badge 
                          key={idx} 
                          className={`text-xs ${getSeverityBadgeClass(issue.severity)}`}
                          title={issue.message}
                        >
                          {issue.code}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="h-3 w-3" />
                    <span>Sem issues</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* RAG Plan */}
          {debugData.rag_plan && (
            <div className="mb-3">
              <p className="mb-1 font-medium text-muted-foreground">RAG Plan</p>
              <div className="rounded bg-background p-2">
                <p>
                  <span className="text-muted-foreground">Layers:</span>{" "}
                  {debugData.rag_plan.layers?.join(", ") || "N/A"}
                </p>
                <p>
                  <span className="text-muted-foreground">TopK:</span>{" "}
                  {debugData.rag_plan.topK || "N/A"}
                </p>
                {debugData.rag_plan.filters && Object.keys(debugData.rag_plan.filters).length > 0 && (
                  <p>
                    <span className="text-muted-foreground">Filters:</span>{" "}
                    {JSON.stringify(debugData.rag_plan.filters)}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Top Chunks with Preview */}
          {debugData.top_chunks && debugData.top_chunks.length > 0 && (
            <div className="mb-3">
              <p className="mb-1 font-medium text-muted-foreground">
                Top Chunks ({debugData.top_chunks.length})
              </p>
              <div className="space-y-2">
                {debugData.top_chunks.map((chunk, index) => (
                  <div key={chunk.id} className="rounded bg-background p-2 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-foreground">
                        #{index + 1} {chunk.title}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {chunk.score}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground line-clamp-2">
                      {chunk.text_preview}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fallback: Chunk IDs (if no top_chunks) */}
          {!debugData.top_chunks && debugData.chunk_ids && debugData.chunk_ids.length > 0 && (
            <div className="mb-3">
              <p className="mb-1 font-medium text-muted-foreground">
                Chunks ({debugData.chunk_ids.length})
              </p>
              <div className="flex flex-wrap gap-1">
                {debugData.chunk_ids.slice(0, 5).map((id) => (
                  <code key={id} className="rounded bg-background px-1.5 py-0.5">
                    {id.slice(0, 8)}...
                    {debugData.scores?.[id] && (
                      <span className="ml-1 text-primary">
                        ({(debugData.scores[id] * 100).toFixed(0)}%)
                      </span>
                    )}
                  </code>
                ))}
                {debugData.chunk_ids.length > 5 && (
                  <span className="text-muted-foreground">
                    +{debugData.chunk_ids.length - 5} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Tags */}
          {debugData.tags_applied && debugData.tags_applied.length > 0 && (
            <div className="mb-3">
              <p className="mb-1 font-medium text-muted-foreground">Tags</p>
              <div className="flex flex-wrap gap-1">
                {debugData.tags_applied.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Guardrails */}
          {debugData.guardrails && debugData.guardrails.length > 0 && (
            <div>
              <p className="mb-1 font-medium text-yellow-500">Guardrails</p>
              <ul className="list-inside list-disc text-yellow-600">
                {debugData.guardrails.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
