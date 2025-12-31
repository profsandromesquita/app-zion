import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import AdminRoute from "@/components/admin/AdminRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, FileText, Users } from "lucide-react";

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    knowledgeCount: 0,
    instructionsCount: 0,
    usersCount: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      const [knowledgeRes, instructionsRes, usersRes] = await Promise.all([
        supabase.from("knowledge_base").select("id", { count: "exact", head: true }),
        supabase.from("system_instructions").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
      ]);

      setStats({
        knowledgeCount: knowledgeRes.count || 0,
        instructionsCount: instructionsRes.count || 0,
        usersCount: usersRes.count || 0,
      });
    };

    fetchStats();
  }, []);

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

          <div className="grid gap-4 md:grid-cols-3">
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
          </div>
        </div>
      </AdminLayout>
    </AdminRoute>
  );
};

export default AdminDashboard;
