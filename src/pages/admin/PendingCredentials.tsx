import { useState, useEffect } from "react";
import { Check, X, FileText, User, RefreshCw } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import AdminRoute from "@/components/admin/AdminRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
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

interface PendingCredential {
  id: string;
  user_id: string;
  profession: string;
  license_number: string;
  license_state: string;
  created_at: string;
  profile: {
    nome: string | null;
    email: string | null;
  } | null;
}

const professionLabels: Record<string, string> = {
  psicologo: "Psicólogo(a)",
  psiquiatra: "Psiquiatra",
  terapeuta: "Terapeuta",
};

const PendingCredentials = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [credentials, setCredentials] = useState<PendingCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: "approve" | "reject";
    credential: PendingCredential | null;
  }>({ open: false, type: "approve", credential: null });

  useEffect(() => {
    loadCredentials();
  }, []);

  const loadCredentials = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from("professional_credentials")
      .select(`
        id,
        user_id,
        profession,
        license_number,
        license_state,
        created_at
      `)
      .eq("verified", false)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading credentials:", error);
      toast({
        title: "Erro ao carregar",
        description: error.message,
        variant: "destructive",
      });
    } else {
      // Fetch profiles separately
      const userIds = data?.map(c => c.user_id) || [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .in("id", userIds);

      const credentialsWithProfiles = data?.map(c => ({
        ...c,
        profile: profiles?.find(p => p.id === c.user_id) || null,
      })) || [];

      setCredentials(credentialsWithProfiles);
    }
    
    setLoading(false);
  };

  const handleApprove = async (credential: PendingCredential) => {
    if (!user) return;
    setActionLoading(credential.id);

    try {
      // 1. Update credential to verified
      const { error: updateError } = await supabase
        .from("professional_credentials")
        .update({
          verified: true,
          verified_at: new Date().toISOString(),
          verified_by: user.id,
        })
        .eq("id", credential.id);

      if (updateError) throw updateError;

      // 2. Add 'profissional' role
      const { error: roleError } = await supabase.from("user_roles").insert({
        user_id: credential.user_id,
        role: "profissional",
      });

      if (roleError && !roleError.message.includes("duplicate")) {
        console.error("Error adding role:", roleError);
      }

      toast({
        title: "Credencial aprovada",
        description: `O profissional foi verificado e agora tem acesso completo.`,
      });

      setCredentials((prev) => prev.filter((c) => c.id !== credential.id));
    } catch (error: any) {
      console.error("Error approving:", error);
      toast({
        title: "Erro ao aprovar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
      setConfirmDialog({ open: false, type: "approve", credential: null });
    }
  };

  const handleReject = async (credential: PendingCredential) => {
    setActionLoading(credential.id);

    try {
      // Delete the credential record
      const { error } = await supabase
        .from("professional_credentials")
        .delete()
        .eq("id", credential.id);

      if (error) throw error;

      toast({
        title: "Credencial rejeitada",
        description: "O registro foi removido.",
      });

      setCredentials((prev) => prev.filter((c) => c.id !== credential.id));
    } catch (error: any) {
      console.error("Error rejecting:", error);
      toast({
        title: "Erro ao rejeitar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
      setConfirmDialog({ open: false, type: "reject", credential: null });
    }
  };

  return (
    <AdminRoute>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                Credenciais Pendentes
              </h2>
              <p className="text-muted-foreground">
                Verifique e aprove profissionais de saúde mental
              </p>
            </div>
            <Button variant="outline" onClick={loadCredentials} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="h-20 animate-pulse rounded bg-muted" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : credentials.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium text-foreground">
                  Nenhuma credencial pendente
                </p>
                <p className="text-muted-foreground">
                  Todas as solicitações foram processadas
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {credentials.map((credential) => (
                <Card key={credential.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300">
                            <User className="h-6 w-6" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="space-y-1">
                          <h3 className="font-semibold text-foreground">
                            {credential.profile?.nome || "Nome não informado"}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {credential.profile?.email || "—"}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <Badge variant="secondary" className="bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300">
                              {professionLabels[credential.profession] || credential.profession}
                            </Badge>
                            <Badge variant="outline">
                              {credential.profession === "psiquiatra" ? "CRM" : "CRP"}: {credential.license_number}
                            </Badge>
                            <Badge variant="outline">
                              {credential.license_state}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            Cadastrado em{" "}
                            {new Date(credential.created_at).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "long",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setConfirmDialog({
                              open: true,
                              type: "reject",
                              credential,
                            })
                          }
                          disabled={actionLoading === credential.id}
                        >
                          <X className="mr-1 h-4 w-4" />
                          Rejeitar
                        </Button>
                        <Button
                          size="sm"
                          onClick={() =>
                            setConfirmDialog({
                              open: true,
                              type: "approve",
                              credential,
                            })
                          }
                          disabled={actionLoading === credential.id}
                        >
                          <Check className="mr-1 h-4 w-4" />
                          Aprovar
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Confirm Dialog */}
        <AlertDialog
          open={confirmDialog.open}
          onOpenChange={(open) =>
            setConfirmDialog({ ...confirmDialog, open })
          }
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmDialog.type === "approve"
                  ? "Aprovar Credencial"
                  : "Rejeitar Credencial"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmDialog.type === "approve" ? (
                  <>
                    Tem certeza que deseja aprovar{" "}
                    <strong>{confirmDialog.credential?.profile?.nome}</strong>?
                    <br />O profissional terá acesso completo aos mapas de jornada e datasets.
                  </>
                ) : (
                  <>
                    Tem certeza que deseja rejeitar a solicitação de{" "}
                    <strong>{confirmDialog.credential?.profile?.nome}</strong>?
                    <br />Esta ação não pode ser desfeita.
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (confirmDialog.credential) {
                    if (confirmDialog.type === "approve") {
                      handleApprove(confirmDialog.credential);
                    } else {
                      handleReject(confirmDialog.credential);
                    }
                  }
                }}
                className={
                  confirmDialog.type === "reject"
                    ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    : ""
                }
              >
                {confirmDialog.type === "approve" ? "Aprovar" : "Rejeitar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </AdminLayout>
    </AdminRoute>
  );
};

export default PendingCredentials;
