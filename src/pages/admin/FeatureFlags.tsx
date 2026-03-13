import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAllFeatureFlags } from "@/hooks/useFeatureFlag";
import AdminLayout from "@/components/admin/AdminLayout";
import RoleRoute from "@/components/admin/RoleRoute";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Flag, Shield } from "lucide-react";
import { toast } from "sonner";

const FeatureFlags = () => {
  const { data: flags, isLoading } = useAllFeatureFlags();
  const queryClient = useQueryClient();

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("feature_flags" as any)
        .update({ enabled } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feature-flags"] });
      queryClient.invalidateQueries({ queryKey: ["feature-flag"] });
      toast.success("Flag atualizada");
    },
    onError: () => {
      toast.error("Erro ao atualizar flag");
    },
  });

  return (
    <RoleRoute allowedRoles={["admin", "desenvolvedor"]}>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Feature Flags</h1>
              <p className="text-muted-foreground">
                Controle de funcionalidades V2 (Método IO). Flags desabilitadas mantêm o comportamento V1.
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid gap-4">
              {flags?.map((flag: any) => (
                <Card key={flag.id} className={flag.enabled ? "border-primary/50 bg-primary/5" : ""}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Flag className={`h-5 w-5 ${flag.enabled ? "text-primary" : "text-muted-foreground"}`} />
                        <div>
                          <CardTitle className="text-base font-mono">{flag.key}</CardTitle>
                          <CardDescription>{flag.description}</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={flag.environment === "all" ? "secondary" : "outline"}>
                          {flag.environment}
                        </Badge>
                        <Switch
                          checked={flag.enabled}
                          onCheckedChange={(checked) =>
                            toggleMutation.mutate({ id: flag.id, enabled: checked })
                          }
                          disabled={toggleMutation.isPending}
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground">
                      Atualizado em {new Date(flag.updated_at).toLocaleString("pt-BR")}
                    </p>
                  </CardContent>
                </Card>
              ))}

              {(!flags || flags.length === 0) && (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma feature flag cadastrada.
                </p>
              )}
            </div>
          )}
        </div>
      </AdminLayout>
    </RoleRoute>
  );
};

export default FeatureFlags;
