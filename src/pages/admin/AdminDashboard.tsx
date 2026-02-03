import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import AdminRoute from "@/components/admin/AdminRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, FileText, Users, Eye, UserCheck, Shield } from "lucide-react";
import { UserDetailsModal } from "@/components/admin/UserDetailsModal";
import { useNavigate } from "react-router-dom";
import type { AppRole } from "@/hooks/useUserRole";

interface UserWithRoles {
  id: string;
  nome: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  avatar_url: string | null;
  roles: AppRole[];
  fase_jornada?: string | null;
  active_themes_count?: number | null;
  global_avg_score?: number | null;
  spiritual_maturity?: string | null;
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

const roleColors: Record<AppRole, string> = {
  buscador: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  soldado: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  pastor: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  igreja: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  profissional: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300",
  auditor: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-300",
  desenvolvedor: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300",
  admin: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    knowledgeCount: 0,
    instructionsCount: 0,
    usersCount: 0,
    pendingCredentials: 0,
    pendingSoldadoApplications: 0,
  });
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);

    const [knowledgeRes, instructionsRes, profilesRes, rolesRes, journeysRes, credentialsRes, soldadoAppsRes] = await Promise.all([
      supabase.from("knowledge_base").select("id", { count: "exact", head: true }),
      supabase.from("system_instructions").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id, nome, email, phone, created_at, avatar_url").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("user_profiles").select("id, fase_jornada, active_themes_count, global_avg_score, spiritual_maturity"),
      supabase.from("professional_credentials").select("id", { count: "exact", head: true }).eq("verified", false),
      supabase.from("soldado_applications").select("id", { count: "exact", head: true }).in("status", ["pending", "testimony_required", "under_review"]),
    ]);

    // Build users with roles
    const profiles = profilesRes.data || [];
    const roles = rolesRes.data || [];
    const journeys = journeysRes.data || [];

    const usersWithRoles: UserWithRoles[] = profiles.map((profile) => {
      const userRoles = roles
        .filter((r) => r.user_id === profile.id)
        .map((r) => r.role as AppRole);
      const journey = journeys.find((j) => j.id === profile.id);

      return {
        ...profile,
        roles: userRoles,
        fase_jornada: journey?.fase_jornada,
        active_themes_count: journey?.active_themes_count,
        global_avg_score: journey?.global_avg_score,
        spiritual_maturity: journey?.spiritual_maturity,
      };
    });

    setStats({
      knowledgeCount: knowledgeRes.count || 0,
      instructionsCount: instructionsRes.count || 0,
      usersCount: profiles.length,
      pendingCredentials: credentialsRes.count || 0,
      pendingSoldadoApplications: soldadoAppsRes.count || 0,
    });

    setUsers(usersWithRoles);
    setLoading(false);
  };

  const handleViewUser = (user: UserWithRoles) => {
    setSelectedUser(user);
    setModalOpen(true);
  };

  return (
    <AdminRoute>
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
            <p className="text-muted-foreground">
              Visão geral do sistema ZION
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Base de Conhecimento
                </CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.knowledgeCount}</div>
                <p className="text-xs text-muted-foreground">
                  documentos ativos
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  System Instructions
                </CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.instructionsCount}</div>
                <p className="text-xs text-muted-foreground">
                  instruções configuradas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Usuários
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.usersCount}</div>
                <p className="text-xs text-muted-foreground">
                  cadastrados
                </p>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => navigate("/admin/pending-credentials")}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Credenciais Pendentes
                </CardTitle>
                <UserCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.pendingCredentials}</div>
                <p className="text-xs text-muted-foreground">
                  aguardando verificação
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card 
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => navigate("/admin/soldado-applications")}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Candidatos a Soldado
                </CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.pendingSoldadoApplications}</div>
                <p className="text-xs text-muted-foreground">
                  aguardando aprovação
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Usuários Cadastrados ({stats.usersCount})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 animate-pulse rounded bg-muted" />
                  ))}
                </div>
              ) : users.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Nenhum usuário cadastrado
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Roles</TableHead>
                      <TableHead>Cadastrado em</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.nome || "—"}
                        </TableCell>
                        <TableCell>{user.email || "—"}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {user.roles.length === 0 ? (
                              <span className="text-muted-foreground text-sm">—</span>
                            ) : (
                              user.roles.map((role) => (
                                <Badge
                                  key={role}
                                  variant="secondary"
                                  className={`text-xs ${roleColors[role]}`}
                                >
                                  {roleLabels[role]}
                                </Badge>
                              ))
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {new Date(user.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewUser(user)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <UserDetailsModal
          user={selectedUser}
          open={modalOpen}
          onOpenChange={setModalOpen}
          onUpdate={fetchData}
        />
      </AdminLayout>
    </AdminRoute>
  );
};

export default AdminDashboard;
