import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  User, 
  Calendar, 
  Clock, 
  CheckCircle, 
  XCircle, 
  RotateCcw,
  Loader2,
  ChevronDown,
  ChevronUp,
  Wand2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole, type AppRole } from "@/hooks/useUserRole";
import ApplicationStatusBadge from "./ApplicationStatusBadge";
import TestimonyStatusBadge from "./TestimonyStatusBadge";
import TestimonyPlayer from "./TestimonyPlayer";
import TestimonyAnalysisPanel from "./TestimonyAnalysisPanel";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Database } from "@/integrations/supabase/types";

type TestimonyStatus = Database["public"]["Enums"]["testimony_status"];
type ApplicationStatus = Database["public"]["Enums"]["soldado_application_status"];

interface Testimony {
  id: string;
  user_id: string;
  application_id: string | null;
  audio_url: string;
  duration_seconds: number;
  status: TestimonyStatus;
  transcript: string | null;
  analysis: Record<string, unknown> | null;
  curator_notes: string | null;
  curated_by: string | null;
  curated_at: string | null;
  created_at: string;
}

interface Application {
  id: string;
  user_id: string;
  sponsored_by: string;
  sponsor_role: AppRole;
  status: ApplicationStatus;
  sponsor_notes: string | null;
  created_at: string;
}

interface Profile {
  id: string;
  nome: string | null;
  email: string | null;
  avatar_url: string | null;
}

interface TestimonyCurationCardProps {
  testimony: Testimony;
  application: Application | null;
  candidateProfile: Profile | null;
  sponsorProfile: Profile | null;
  onUpdate: () => void;
}

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const TestimonyCurationCard = ({
  testimony,
  application,
  candidateProfile,
  sponsorProfile,
  onUpdate,
}: TestimonyCurationCardProps) => {
  const { user } = useAuth();
  const { roles } = useUserRole();
  const { toast } = useToast();
  const [curatorNotes, setCuratorNotes] = useState(testimony.curator_notes || "");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loadingAudio, setLoadingAudio] = useState(true);
  const [analysisOpen, setAnalysisOpen] = useState(true);
  const [transcriptOpen, setTranscriptOpen] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [actionLoading, setActionLoading] = useState<"approve" | "reject" | "rerecord" | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: "approve" | "reject" | "rerecord";
    title: string;
    description: string;
  }>({ open: false, action: "approve", title: "", description: "" });

  // Determine approver role for this user
  const getApproverRole = (): AppRole | null => {
    if (roles.includes("admin")) return "admin";
    if (roles.includes("profissional")) return "profissional";
    if (roles.includes("pastor")) return "pastor";
    return null;
  };

  const approverRole = getApproverRole();

  useEffect(() => {
    loadSignedUrl();
  }, [testimony.audio_url]);

  const loadSignedUrl = async () => {
    setLoadingAudio(true);
    try {
      // Extract path from audio_url
      const url = new URL(testimony.audio_url);
      const pathMatch = url.pathname.match(/\/testimonies\/(.+)/);
      if (!pathMatch) throw new Error("Invalid audio URL");

      const filePath = pathMatch[1];
      const { data, error } = await supabase.storage
        .from("testimonies")
        .createSignedUrl(filePath, 3600); // 1 hour

      if (error) throw error;
      setAudioUrl(data.signedUrl);
    } catch (error) {
      console.error("Error loading audio URL:", error);
      toast({
        title: "Erro ao carregar áudio",
        description: "Não foi possível gerar URL de acesso ao áudio.",
        variant: "destructive",
      });
    } finally {
      setLoadingAudio(false);
    }
  };

  const handleProcess = async () => {
    setProcessing(true);
    try {
      const { error } = await supabase.functions.invoke("process-testimony", {
        body: { testimony_id: testimony.id },
      });

      if (error) throw error;

      toast({
        title: "Processamento iniciado",
        description: "O testemunho está sendo processado. Aguarde alguns minutos.",
      });
      
      // Poll for update
      setTimeout(onUpdate, 5000);
    } catch (error: unknown) {
      const err = error as Error;
      console.error("Error processing testimony:", err);
      toast({
        title: "Erro no processamento",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const confirmAction = (action: "approve" | "reject" | "rerecord") => {
    const configs = {
      approve: {
        title: "Aprovar Testemunho",
        description: "Tem certeza que deseja aprovar este testemunho? Isso registrará sua aprovação na candidatura.",
      },
      reject: {
        title: "Rejeitar Testemunho",
        description: "Tem certeza que deseja rejeitar este testemunho? A candidatura será encerrada.",
      },
      rerecord: {
        title: "Solicitar Regravação",
        description: "Tem certeza que deseja solicitar regravação? O candidato precisará gravar um novo testemunho.",
      },
    };

    setConfirmDialog({
      open: true,
      action,
      ...configs[action],
    });
  };

  const executeAction = async () => {
    if (!user || !approverRole) return;
    const action = confirmDialog.action;
    setConfirmDialog({ ...confirmDialog, open: false });
    setActionLoading(action);

    try {
      if (action === "approve") {
        // Update testimony status
        const { error: testimonyError } = await supabase
          .from("testimonies")
          .update({
            status: "curated" as TestimonyStatus,
            curator_notes: curatorNotes || null,
            curated_by: user.id,
            curated_at: new Date().toISOString(),
          })
          .eq("id", testimony.id);

        if (testimonyError) throw testimonyError;

        // Register approval (trigger will handle role promotion)
        if (application) {
          const { error: approvalError } = await supabase
            .from("soldado_application_approvals")
            .insert({
              application_id: application.id,
              approver_id: user.id,
              approver_role: approverRole,
              approved: true,
              notes: curatorNotes || null,
            });

          if (approvalError && !approvalError.message.includes("duplicate")) {
            throw approvalError;
          }
        }

        toast({
          title: "Testemunho aprovado",
          description: "Sua aprovação foi registrada com sucesso.",
        });
      } else if (action === "reject") {
        // Update testimony status
        const { error: testimonyError } = await supabase
          .from("testimonies")
          .update({
            status: "rejected" as TestimonyStatus,
            curator_notes: curatorNotes || null,
            curated_by: user.id,
            curated_at: new Date().toISOString(),
          })
          .eq("id", testimony.id);

        if (testimonyError) throw testimonyError;

        // Update application status
        if (application) {
          const { error: appError } = await supabase
            .from("soldado_applications")
            .update({
              status: "rejected" as ApplicationStatus,
              rejection_reason: curatorNotes || "Testemunho rejeitado pelo curador",
            })
            .eq("id", application.id);

          if (appError) throw appError;
        }

        toast({
          title: "Testemunho rejeitado",
          description: "A candidatura foi encerrada.",
        });
      } else if (action === "rerecord") {
        // Reject current testimony
        const { error: testimonyError } = await supabase
          .from("testimonies")
          .update({
            status: "rejected" as TestimonyStatus,
            curator_notes: `Solicitada regravação: ${curatorNotes}`,
            curated_by: user.id,
            curated_at: new Date().toISOString(),
          })
          .eq("id", testimony.id);

        if (testimonyError) throw testimonyError;

        // Reset application to testimony_required
        if (application) {
          const { error: appError } = await supabase
            .from("soldado_applications")
            .update({
              status: "testimony_required" as ApplicationStatus,
              testimony_id: null,
            })
            .eq("id", application.id);

          if (appError) throw appError;
        }

        toast({
          title: "Regravação solicitada",
          description: "O candidato será notificado para gravar novo testemunho.",
        });
      }

      onUpdate();
    } catch (error: unknown) {
      const err = error as Error;
      console.error(`Error ${action} testimony:`, err);
      toast({
        title: "Erro na operação",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const canTakeAction = 
    approverRole !== null && 
    testimony.status === "analyzed";

  return (
    <>
      <Card className="w-full">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={candidateProfile?.avatar_url || undefined} />
                <AvatarFallback className="bg-emerald-100 text-emerald-800">
                  {candidateProfile?.nome?.charAt(0) || <User className="h-5 w-5" />}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-lg">
                  {candidateProfile?.nome || "Candidato"}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {candidateProfile?.email}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {application && <ApplicationStatusBadge status={application.status} />}
              <TestimonyStatusBadge status={testimony.status} />
            </div>
          </div>
          
          {/* Sponsor info */}
          {sponsorProfile && application && (
            <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
              <span>Indicado por:</span>
              <Avatar className="h-5 w-5">
                <AvatarImage src={sponsorProfile.avatar_url || undefined} />
                <AvatarFallback className="text-[10px]">
                  {sponsorProfile.nome?.charAt(0) || "S"}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium text-foreground">
                {sponsorProfile.nome || sponsorProfile.email}
              </span>
              <span className="text-xs">({application.sponsor_role})</span>
            </div>
          )}

          {/* Sponsor notes */}
          {application?.sponsor_notes && (
            <p className="text-sm text-muted-foreground mt-2 italic border-l-2 pl-3">
              "{application.sponsor_notes}"
            </p>
          )}

          {/* Meta info */}
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(testimony.created_at).toLocaleDateString("pt-BR")}
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(testimony.duration_seconds)}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Audio Player */}
          <div>
            <h4 className="text-sm font-medium mb-2">Áudio do Testemunho</h4>
            {loadingAudio ? (
              <div className="h-20 bg-muted rounded-lg animate-pulse" />
            ) : audioUrl ? (
              <TestimonyPlayer audioUrl={audioUrl} />
            ) : (
              <div className="h-20 bg-muted rounded-lg flex items-center justify-center text-sm text-muted-foreground">
                Áudio não disponível
              </div>
            )}
          </div>

          <Separator />

          {/* Transcript */}
          <Collapsible open={transcriptOpen} onOpenChange={setTranscriptOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 hover:bg-muted/50 rounded-md px-2 -mx-2">
              <h4 className="text-sm font-medium">Transcrição</h4>
              {transcriptOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ScrollArea className="h-[200px] mt-2 rounded-md border p-4">
                {testimony.transcript ? (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {testimony.transcript}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    Transcrição não disponível. Clique em "Processar" para gerar.
                  </p>
                )}
              </ScrollArea>
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* AI Analysis */}
          <Collapsible open={analysisOpen} onOpenChange={setAnalysisOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 hover:bg-muted/50 rounded-md px-2 -mx-2">
              <h4 className="text-sm font-medium">Análise da IA</h4>
              {analysisOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2">
                <TestimonyAnalysisPanel 
                  analysis={testimony.analysis as Record<string, unknown> | null} 
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* Curator Notes */}
          <div>
            <h4 className="text-sm font-medium mb-2">Notas do Curador</h4>
            <Textarea
              value={curatorNotes}
              onChange={(e) => setCuratorNotes(e.target.value)}
              placeholder="Adicione observações sobre este testemunho..."
              className="min-h-[80px]"
              disabled={!canTakeAction}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            {/* Process button for pending testimonies */}
            {testimony.status === "processing" && (
              <Button
                variant="outline"
                onClick={handleProcess}
                disabled={processing}
              >
                {processing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4 mr-2" />
                )}
                Processar
              </Button>
            )}

            {canTakeAction && testimony.status === "analyzed" && (
              <div className="flex items-center gap-2 ml-auto">
                <Button
                  variant="outline"
                  onClick={() => confirmAction("rerecord")}
                  disabled={actionLoading !== null}
                >
                  {actionLoading === "rerecord" && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Pedir Regravação
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => confirmAction("reject")}
                  disabled={actionLoading !== null}
                >
                  {actionLoading === "reject" && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  <XCircle className="h-4 w-4 mr-2" />
                  Rejeitar
                </Button>
                <Button
                  onClick={() => confirmAction("approve")}
                  disabled={actionLoading !== null}
                >
                  {actionLoading === "approve" && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Aprovar
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={executeAction}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default TestimonyCurationCard;
