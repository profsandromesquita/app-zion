import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Heart, 
  Brain, 
  Target, 
  Tag, 
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Frown
} from "lucide-react";

interface TestimonyAnalysis {
  repentance_classification?: "true_repentance" | "remorse" | "unclear";
  repentance_confidence?: number;
  repentance_evidence?: string[];
  entities?: {
    traumas?: string[];
    addictions?: string[];
    victories?: string[];
  };
  lie_matrix?: {
    security_lost?: string;
    false_security?: string;
    lie_believed?: string;
  };
  transformation_pattern?: string[];
  suggested_tags?: string[];
  scenario?: string;
  center?: string;
  security_matrix?: string;
  safe_for_publication?: boolean;
  curator_required_reason?: string | null;
  anonymized_transcript?: string;
}

interface TestimonyAnalysisPanelProps {
  analysis: TestimonyAnalysis | null;
  className?: string;
}

const repentanceConfig = {
  true_repentance: {
    label: "Arrependimento Verdadeiro",
    icon: CheckCircle2,
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
  },
  remorse: {
    label: "Remorso",
    icon: Frown,
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  },
  unclear: {
    label: "Inconclusivo",
    icon: HelpCircle,
    className: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
  },
};

const centerLabels: Record<string, string> = {
  INSTINTIVO: "Instintivo (Raiva/Controle)",
  EMOCIONAL: "Emocional (Mágoa/Vergonha)",
  MENTAL: "Mental (Ansiedade/Paralisia)",
};

const securityMatrixLabels: Record<string, string> = {
  SOBREVIVENCIA: "Sobrevivência (Eu estou seguro?)",
  IDENTIDADE: "Identidade (Eu sou amado?)",
  CAPACIDADE: "Capacidade (Eu sou capaz?)",
};

const TestimonyAnalysisPanel = ({ analysis, className = "" }: TestimonyAnalysisPanelProps) => {
  if (!analysis) {
    return (
      <div className={`text-muted-foreground text-sm p-4 bg-muted/50 rounded-lg ${className}`}>
        Análise não disponível. O testemunho ainda está sendo processado.
      </div>
    );
  }

  const repentanceType = analysis.repentance_classification || "unclear";
  const repentance = repentanceConfig[repentanceType];
  const RepentanceIcon = repentance.icon;
  const confidence = Math.round((analysis.repentance_confidence || 0) * 100);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Curator Warning */}
      {analysis.safe_for_publication === false && analysis.curator_required_reason && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Atenção do Curador</AlertTitle>
          <AlertDescription>{analysis.curator_required_reason}</AlertDescription>
        </Alert>
      )}

      {/* Repentance Classification */}
      <div className="p-4 rounded-lg border bg-card">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-medium flex items-center gap-2">
            <Heart className="h-4 w-4 text-primary" />
            Classificação de Arrependimento
          </h4>
          <Badge className={`gap-1 ${repentance.className}`}>
            <RepentanceIcon className="h-3 w-3" />
            {repentance.label}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Confiança:</span>
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all"
              style={{ width: `${confidence}%` }}
            />
          </div>
          <span className="font-mono">{confidence}%</span>
        </div>
        {analysis.repentance_evidence && analysis.repentance_evidence.length > 0 && (
          <div className="mt-3 text-sm">
            <p className="text-muted-foreground mb-1">Evidências:</p>
            <ul className="list-disc list-inside space-y-1 text-foreground">
              {analysis.repentance_evidence.map((evidence, i) => (
                <li key={i} className="italic">"{evidence}"</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <Accordion type="multiple" className="w-full">
        {/* ZION Taxonomy */}
        <AccordionItem value="taxonomy">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Taxonomia ZION
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Cenário:</span>
                <Badge variant="outline">{analysis.scenario || "—"}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Centro:</span>
                <Badge variant="outline">
                  {analysis.center ? centerLabels[analysis.center] || analysis.center : "—"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Matriz de Segurança:</span>
                <Badge variant="outline">
                  {analysis.security_matrix 
                    ? securityMatrixLabels[analysis.security_matrix] || analysis.security_matrix 
                    : "—"}
                </Badge>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Lie Matrix */}
        {analysis.lie_matrix && (
          <AccordionItem value="lie-matrix">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" />
                Matriz da Mentira
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3 text-sm">
                {analysis.lie_matrix.security_lost && (
                  <div>
                    <span className="text-muted-foreground">Segurança Perdida:</span>
                    <p className="mt-1">{analysis.lie_matrix.security_lost}</p>
                  </div>
                )}
                {analysis.lie_matrix.false_security && (
                  <div>
                    <span className="text-muted-foreground">Falsa Segurança:</span>
                    <p className="mt-1">{analysis.lie_matrix.false_security}</p>
                  </div>
                )}
                {analysis.lie_matrix.lie_believed && (
                  <div>
                    <span className="text-muted-foreground">Mentira Acreditada:</span>
                    <p className="mt-1 font-medium">"{analysis.lie_matrix.lie_believed}"</p>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Entities */}
        {analysis.entities && (
          <AccordionItem value="entities">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-primary" />
                Entidades Extraídas
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3">
                {analysis.entities.traumas && analysis.entities.traumas.length > 0 && (
                  <div>
                    <span className="text-sm text-muted-foreground">Traumas:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {analysis.entities.traumas.map((trauma, i) => (
                        <Badge key={i} variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                          {trauma}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {analysis.entities.addictions && analysis.entities.addictions.length > 0 && (
                  <div>
                    <span className="text-sm text-muted-foreground">Vícios:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {analysis.entities.addictions.map((addiction, i) => (
                        <Badge key={i} variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300">
                          {addiction}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {analysis.entities.victories && analysis.entities.victories.length > 0 && (
                  <div>
                    <span className="text-sm text-muted-foreground">Vitórias:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {analysis.entities.victories.map((victory, i) => (
                        <Badge key={i} variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300">
                          {victory}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Transformation Pattern */}
        {analysis.transformation_pattern && analysis.transformation_pattern.length > 0 && (
          <AccordionItem value="transformation">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Padrão de Transformação
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-wrap gap-1">
                {analysis.transformation_pattern.map((pattern, i) => (
                  <Badge key={i} variant="outline">
                    {pattern}
                  </Badge>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>

      {/* Suggested Tags */}
      {analysis.suggested_tags && analysis.suggested_tags.length > 0 && (
        <div className="p-3 rounded-lg border bg-muted/30">
          <span className="text-sm text-muted-foreground">Tags Sugeridas:</span>
          <div className="flex flex-wrap gap-1 mt-2">
            {analysis.suggested_tags.map((tag, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TestimonyAnalysisPanel;
