import { useState } from "react";
import { ChevronDown, ChevronUp, Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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
          </div>

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

          {/* Chunks */}
          {debugData.chunk_ids && debugData.chunk_ids.length > 0 && (
            <div className="mb-3">
              <p className="mb-1 font-medium text-muted-foreground">
                Chunks ({debugData.chunk_ids.length})
              </p>
              <div className="flex flex-wrap gap-1">
                {debugData.chunk_ids.slice(0, 5).map((id, index) => (
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
