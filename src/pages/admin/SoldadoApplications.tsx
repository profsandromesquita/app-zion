import { useState, useEffect } from "react";
import { Plus, RefreshCw, Shield } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import RoleRoute from "@/components/admin/RoleRoute";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserRole, type AppRole } from "@/hooks/useUserRole";
import NewApplicationForm from "@/components/soldado/NewApplicationForm";
import ApplicationApprovalCard from "@/components/soldado/ApplicationApprovalCard";
import type { Database } from "@/integrations/supabase/types";

type SoldadoApplicationStatus = Database["public"]["Enums"]["soldado_application_status"];

interface ApprovalStatus {
  admin: "pending" | "approved" | "rejected";
  profissional: "pending" | "approved" | "rejected";
  pastor: "pending" | "approved" | "rejected";
}

interface ApplicationWithDetails {
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

const SoldadoApplications = () => {
  const { toast } = useToast();
  const { roles } = useUserRole();
  const [applications, setApplications] = useState<ApplicationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("all");

  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = async () => {
    setLoading(true);

    try {
      // Fetch applications
      const { data: apps, error: appsError } = await supabase
        .from("soldado_applications")
        .select(
          "id, status, created_at, updated_at, rejection_reason, user_id, sponsored_by, sponsor_role"
        )
        .order("created_at", { ascending: false });

      if (appsError) throw appsError;

      if (!apps || apps.length === 0) {
        setApplications([]);
        setLoading(false);
        return;
      }

      // Collect all user IDs for profiles
      const userIds = [
        ...new Set([
          ...apps.map((a) => a.user_id),
          ...apps.map((a) => a.sponsored_by),
        ]),
      ];

      // Fetch profiles and approvals in parallel
      const [profilesRes, approvalsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, nome, email, avatar_url")
          .in("id", userIds),
        supabase
          .from("soldado_application_approvals")
          .select("application_id, approver_role, approved")
          .in(
            "application_id",
            apps.map((a) => a.id)
          ),
      ]);

      const profiles = profilesRes.data || [];
      const approvals = approvalsRes.data || [];

      // Build enriched applications
      const enrichedApps: ApplicationWithDetails[] = apps.map((app) => {
        const candidate = profiles.find((p) => p.id === app.user_id);
        const sponsor = profiles.find((p) => p.id === app.sponsored_by);

        // Build approval status
        const appApprovals = approvals.filter(
          (a) => a.application_id === app.id
        );

        const getApprovalStatus = (
          role: "admin" | "profissional" | "pastor"
        ): "pending" | "approved" | "rejected" => {
          const approval = appApprovals.find((a) => a.approver_role === role);
          if (!approval) return "pending";
          return approval.approved ? "approved" : "rejected";
        };

        return {
          id: app.id,
          status: app.status,
          created_at: app.created_at,
          rejection_reason: app.rejection_reason,
          candidate: {
            id: app.user_id,
            nome: candidate?.nome || null,
            email: candidate?.email || null,
            avatar_url: candidate?.avatar_url || null,
          },
          sponsor: {
            id: app.sponsored_by,
            nome: sponsor?.nome || null,
            role: app.sponsor_role as AppRole,
          },
          approvals: {
            admin: getApprovalStatus("admin"),
            profissional: getApprovalStatus("profissional"),
            pastor: getApprovalStatus("pastor"),
          },
        };
      });

      setApplications(enrichedApps);
    } catch (error: any) {
      console.error("Error loading applications:", error);
      toast({
        title: "Erro ao carregar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Determine sponsor role for creating new applications
  const getSponsorRole = (): AppRole => {
    if (roles.includes("admin") || roles.includes("desenvolvedor")) return "admin";
    if (roles.includes("igreja")) return "igreja";
    if (roles.includes("profissional")) return "profissional";
    return "admin"; // fallback
  };

  // Check if user can create applications
  const canCreate =
    roles.includes("admin") ||
    roles.includes("desenvolvedor") ||
    roles.includes("igreja") ||
    roles.includes("profissional");

  // Filter applications by tab
  const filteredApplications = applications.filter((app) => {
    if (activeTab === "all") return true;
    if (activeTab === "pending")
      return ["pending", "testimony_required"].includes(app.status);
    if (activeTab === "under_review") return app.status === "under_review";
    if (activeTab === "approved") return app.status === "approved";
    if (activeTab === "rejected") return app.status === "rejected";
    return true;
  });

  const tabCounts = {
    all: applications.length,
    pending: applications.filter((a) =>
      ["pending", "testimony_required"].includes(a.status)
    ).length,
    under_review: applications.filter((a) => a.status === "under_review").length,
    approved: applications.filter((a) => a.status === "approved").length,
    rejected: applications.filter((a) => a.status === "rejected").length,
  };

  return (
    <RoleRoute
      allowedRoles={[
        "admin",
        "desenvolvedor",
        "igreja",
        "profissional",
        "pastor",
      ]}
    >
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Shield className="h-6 w-6" />
                Candidatos a Soldado
              </h2>
              <p className="text-muted-foreground">
                Gerencie candidaturas e aprovações para a role de Soldado
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={loadApplications} disabled={loading}>
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
                Atualizar
              </Button>
              {canCreate && (
                <Button onClick={() => setFormOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Candidatura
                </Button>
              )}
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">
                Todas ({tabCounts.all})
              </TabsTrigger>
              <TabsTrigger value="pending">
                Pendentes ({tabCounts.pending})
              </TabsTrigger>
              <TabsTrigger value="under_review">
                Em Revisão ({tabCounts.under_review})
              </TabsTrigger>
              <TabsTrigger value="approved">
                Aprovadas ({tabCounts.approved})
              </TabsTrigger>
              <TabsTrigger value="rejected">
                Rejeitadas ({tabCounts.rejected})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-4">
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Card key={i}>
                      <CardContent className="p-6">
                        <div className="h-24 animate-pulse rounded bg-muted" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : filteredApplications.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Shield className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium text-foreground">
                      Nenhuma candidatura encontrada
                    </p>
                    <p className="text-muted-foreground text-center">
                      {activeTab === "all"
                        ? "Ainda não há candidaturas registradas."
                        : "Não há candidaturas com este status."}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {filteredApplications.map((app) => (
                    <ApplicationApprovalCard
                      key={app.id}
                      application={app}
                      currentUserRoles={roles}
                      onUpdate={loadApplications}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <NewApplicationForm
          open={formOpen}
          onOpenChange={setFormOpen}
          onSuccess={loadApplications}
          sponsorRole={getSponsorRole()}
        />
      </AdminLayout>
    </RoleRoute>
  );
};

export default SoldadoApplications;
