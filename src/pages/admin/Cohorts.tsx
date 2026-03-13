import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import RoleRoute from "@/components/admin/RoleRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, FlaskConical } from "lucide-react";
import { toast } from "sonner";

const COHORT_OPTIONS = ["control", "io_shadow", "io_active"] as const;

const cohortColors: Record<string, string> = {
  control: "secondary",
  io_shadow: "outline",
  io_active: "default",
};

const Cohorts = () => {
  const queryClient = useQueryClient();

  const { data: cohorts, isLoading } = useQuery({
    queryKey: ["user-cohorts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_cohorts")
        .select("*")
        .order("assigned_at", { ascending: false });
      if (error) throw error;

      // Fetch profiles for names/emails
      const userIds = (data || []).map((c: any) => c.user_id);
      if (userIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .in("id", userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      return (data || []).map((c: any) => ({
        ...c,
        profile: profileMap.get(c.user_id) || null,
      }));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, cohort_name }: { id: string; cohort_name: string }) => {
      const { error } = await supabase
        .from("user_cohorts")
        .update({ cohort_name, assigned_at: new Date().toISOString(), assigned_by: "admin_manual" } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-cohorts"] });
      toast.success("Cohort atualizado");
    },
    onError: () => {
      toast.error("Erro ao atualizar cohort");
    },
  });

  const counts = cohorts?.reduce(
    (acc: Record<string, number>, c: any) => {
      acc[c.cohort_name] = (acc[c.cohort_name] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  ) || {};

  return (
    <RoleRoute allowedRoles={["admin", "desenvolvedor"]}>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <FlaskConical className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Cohorts</h1>
              <p className="text-muted-foreground">
                Alocação de usuários em grupos de controle e teste para migração IO.
              </p>
            </div>
          </div>

          {/* Counters */}
          <div className="grid grid-cols-3 gap-4">
            {COHORT_OPTIONS.map((name) => (
              <Card key={name}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground capitalize">{name.replace("_", " ")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-2xl font-bold">{counts[name] || 0}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Usuários ({cohorts?.length || 0})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {cohorts?.map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">
                          {c.profile?.nome || "Sem nome"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {c.profile?.email || c.user_id}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={cohortColors[c.cohort_name] as any || "secondary"}>
                          {c.cohort_name}
                        </Badge>
                        <Select
                          value={c.cohort_name}
                          onValueChange={(value) =>
                            updateMutation.mutate({ id: c.id, cohort_name: value })
                          }
                          disabled={updateMutation.isPending}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {COHORT_OPTIONS.map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {opt.replace("_", " ")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                  {(!cohorts || cohorts.length === 0) && (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhum usuário encontrado.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </AdminLayout>
    </RoleRoute>
  );
};

export default Cohorts;
