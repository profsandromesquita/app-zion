import { useState } from "react";
import { Check, X, User, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import ApplicationStatusBadge from "./ApplicationStatusBadge";
import type { Database } from "@/integrations/supabase/types";
import type { AppRole } from "@/hooks/useUserRole";

type SoldadoApplicationStatus = Database["public"]["Enums"]["soldado_application_status"];

interface ApprovalStatus {
  admin: "pending" | "approved" | "rejected";
  profissional: "pending" | "approved" | "rejected";
  pastor: "pending" | "approved" | "rejected";
}

interface ApplicationData {
  id: string;
  status: SoldadoApplicationStatus;
  created_at: string;
  rejection_reason: string | null;
  candidate: {
    id: string;
    nome: string | null;
    email: string | null;
    avatar_url: string | null;
  };
  sponsor: {
    id: string;
    nome: string | null;
    role: AppRole;
  };
  approvals: ApprovalStatus;
}

interface ApplicationApprovalCardProps {
  application: ApplicationData;
  currentUserRoles: AppRole[];
  onUpdate: () => void;
}

const roleLabels: Record<AppRole, string> = {
  buscador: "Buscador",
  soldado: "Soldado",
  pastor: "Pastor",
  igreja: "Igreja",
  profissional: "Profissional",
  auditor: "Auditor",
  desenvolvedor: "Dev",
  admin: "Admin",
};

const getApproverRole = (roles: AppRole[]): AppRole | null => {
  // Priority: admin > profissional > pastor
  if (roles.includes("admin") || roles.includes("desenvolvedor")) return "admin";
  if (roles.includes("profissional")) return "profissional";
  if (roles.includes("pastor")) return "pastor";
  return null;
};

const canUserApprove = (
  roles: AppRole[],
  approvals: ApprovalStatus,
  status: SoldadoApplicationStatus
): boolean => {
  if (!["testimony_required", "under_review"].includes(status)) return false;

  if (roles.includes("admin") || roles.includes("desenvolvedor")) {
    return approvals.admin === "pending";
  }
  if (roles.includes("profissional")) {
    return approvals.profissional === "pending";
  }
  if (roles.includes("pastor")) {
    return approvals.pastor === "pending";
  }
  return false;
};

const ApplicationApprovalCard = ({
  application,
  currentUserRoles,
  onUpdate,
}: ApplicationApprovalCardProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: "approve" | "reject";
  }>({ open: false, type: "approve" });

  const canApprove = canUserApprove(
    currentUserRoles,
    application.approvals,
    application.status
  );
  const approverRole = getApproverRole(currentUserRoles);

  const handleApprove = async () => {
    if (!user || !approverRole) return;
    setLoading(true);

    try {
      const { error } = await supabase
        .from("soldado_application_approvals")
        .insert({
          application_id: application.id,
          approver_id: user.id,
          approver_role: approverRole,
          approved: true,
          notes: notes || null,
        });

      if (error) throw error;

      toast({
        title: "Aprovação registrada",
        description: "Sua aprovação foi registrada com sucesso.",
      });

      setNotes("");
      setConfirmDialog({ open: false, type: "approve" });
      onUpdate();
    } catch (error: any) {
      console.error("Error approving:", error);
      toast({
        title: "Erro ao aprovar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!user || !approverRole) return;
    setLoading(true);

    try {
      // Insert rejection
      const { error: approvalError } = await supabase
        .from("soldado_application_approvals")
        .insert({
          application_id: application.id,
          approver_id: user.id,
          approver_role: approverRole,
          approved: false,
          notes: notes || null,
        });

      if (approvalError) throw approvalError;

      // Update application status to rejected
      const { error: updateError } = await supabase
        .from("soldado_applications")
        .update({
          status: "rejected",
          rejection_reason: notes || "Rejeitado sem justificativa",
        })
        .eq("id", application.id);

      if (updateError) throw updateError;

      toast({
        title: "Candidatura rejeitada",
        description: "A candidatura foi rejeitada.",
      });

      setNotes("");
      setConfirmDialog({ open: false, type: "reject" });
      onUpdate();
    } catch (error: any) {
      console.error("Error rejecting:", error);
      toast({
        title: "Erro ao rejeitar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const ApprovalBadge = ({
    label,
    status,
  }: {
    label: string;
    status: "pending" | "approved" | "rejected";
  }) => {
    const config = {
      pending: {
        className: "border-muted-foreground/30 text-muted-foreground",
        icon: "○",
      },
      approved: {
        className: "border-green-500 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
        icon: "✓",
      },
      rejected: {
        className: "border-red-500 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
        icon: "✗",
      },
    };

    return (
      <Badge variant="outline" className={config[status].className}>
        {config[status].icon} {label}
      </Badge>
    );
  };

  return (
    <>
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 flex-1">
              <Avatar className="h-12 w-12">
                <AvatarImage src={application.candidate.avatar_url || undefined} />
                <AvatarFallback className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300">
                  {application.candidate.nome?.charAt(0) || (
                    <User className="h-6 w-6" />
                  )}
                </AvatarFallback>
              </Avatar>

              <div className="space-y-2 flex-1">
                <div>
                  <h3 className="font-semibold text-foreground">
                    {application.candidate.nome || "Nome não informado"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {application.candidate.email || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Indicado por:{" "}
                    <span className="font-medium">
                      {application.sponsor.nome || "—"}
                    </span>{" "}
                    ({roleLabels[application.sponsor.role]})
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Criado em:{" "}
                    {new Date(application.created_at).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <ApplicationStatusBadge status={application.status} />
                </div>

                <div className="flex items-center gap-2 flex-wrap pt-2">
                  <span className="text-xs text-muted-foreground">Aprovações:</span>
                  <ApprovalBadge label="Admin" status={application.approvals.admin} />
                  <ApprovalBadge
                    label="Profissional"
                    status={application.approvals.profissional}
                  />
                  <ApprovalBadge label="Pastor" status={application.approvals.pastor} />
                </div>

                {application.rejection_reason && (
                  <div className="mt-2 p-2 rounded bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
                    <p className="text-xs text-red-800 dark:text-red-300">
                      <strong>Motivo da rejeição:</strong>{" "}
                      {application.rejection_reason}
                    </p>
                  </div>
                )}

                {canApprove && (
                  <div className="pt-3 space-y-3">
                    <Textarea
                      placeholder="Notas/observações (opcional)..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="min-h-[60px] text-sm"
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setConfirmDialog({ open: true, type: "reject" })
                        }
                        disabled={loading}
                      >
                        <X className="mr-1 h-4 w-4" />
                        Rejeitar
                      </Button>
                      <Button
                        size="sm"
                        onClick={() =>
                          setConfirmDialog({ open: true, type: "approve" })
                        }
                        disabled={loading}
                      >
                        <Check className="mr-1 h-4 w-4" />
                        Aprovar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.type === "approve"
                ? "Confirmar Aprovação"
                : "Confirmar Rejeição"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.type === "approve" ? (
                <>
                  Tem certeza que deseja aprovar a candidatura de{" "}
                  <strong>{application.candidate.nome}</strong>?
                  {application.approvals.admin === "approved" &&
                    application.approvals.profissional === "approved" && (
                      <>
                        <br />
                        <br />
                        <strong>Atenção:</strong> Esta será a terceira aprovação e
                        o usuário será promovido a Soldado automaticamente.
                      </>
                    )}
                </>
              ) : (
                <>
                  Tem certeza que deseja rejeitar a candidatura de{" "}
                  <strong>{application.candidate.nome}</strong>?
                  <br />
                  Esta ação encerrará o processo de candidatura.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDialog.type === "approve") {
                  handleApprove();
                } else {
                  handleReject();
                }
              }}
              disabled={loading}
              className={
                confirmDialog.type === "reject"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : ""
              }
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {confirmDialog.type === "approve" ? "Aprovar" : "Rejeitar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ApplicationApprovalCard;
