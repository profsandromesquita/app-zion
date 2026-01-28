import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, User, Shield, Heart, Save, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { AppRole } from "@/hooks/useUserRole";

interface UserWithRoles {
  id: string;
  nome: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  roles: AppRole[];
  fase_jornada?: string | null;
  active_themes_count?: number | null;
  global_avg_score?: number | null;
  spiritual_maturity?: string | null;
}

interface UserDetailsModalProps {
  user: UserWithRoles | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

const ALL_ROLES: AppRole[] = [
  "buscador",
  "soldado",
  "pastor",
  "igreja",
  "profissional",
  "auditor",
  "desenvolvedor",
  "admin",
];

const roleLabels: Record<AppRole, string> = {
  buscador: "Buscador",
  soldado: "Soldado",
  pastor: "Pastor",
  igreja: "Igreja",
  profissional: "Profissional",
  auditor: "Auditor",
  desenvolvedor: "Desenvolvedor",
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

export function UserDetailsModal({
  user,
  open,
  onOpenChange,
  onUpdate,
}: UserDetailsModalProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setSelectedRoles(user.roles);
    }
  }, [user]);

  const handleRoleToggle = (role: AppRole) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);

    try {
      // Get current roles from DB
      const { data: currentRoles, error: fetchError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (fetchError) throw fetchError;

      const currentRoleList = currentRoles?.map((r) => r.role as AppRole) || [];

      // Roles to add
      const rolesToAdd = selectedRoles.filter((r) => !currentRoleList.includes(r));
      // Roles to remove
      const rolesToRemove = currentRoleList.filter((r) => !selectedRoles.includes(r));

      // Add new roles
      if (rolesToAdd.length > 0) {
        const { error: insertError } = await supabase.from("user_roles").insert(
          rolesToAdd.map((role) => ({ user_id: user.id, role }))
        );
        if (insertError) throw insertError;
      }

      // Remove roles
      if (rolesToRemove.length > 0) {
        for (const role of rolesToRemove) {
          const { error: deleteError } = await supabase
            .from("user_roles")
            .delete()
            .eq("user_id", user.id)
            .eq("role", role);
          if (deleteError) throw deleteError;
        }
      }

      toast({
        title: "Alterações salvas",
        description: "As roles do usuário foram atualizadas.",
      });

      onUpdate();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving roles:", error);
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleViewJourney = () => {
    if (user) {
      navigate(`/admin/journey-map?userId=${user.id}`);
      onOpenChange(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Detalhes do Usuário
          </DialogTitle>
          <DialogDescription>
            Visualize e edite as informações e permissões do usuário
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* User Info */}
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary/10 text-primary text-xl">
                <User className="h-8 w-8" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground">
                {user.nome || "Sem nome"}
              </h3>
              <p className="text-muted-foreground">{user.email || "—"}</p>
              <p className="text-sm text-muted-foreground">
                Telefone: {user.phone || "Não informado"}
              </p>
              <p className="text-sm text-muted-foreground">
                Cadastrado:{" "}
                {new Date(user.created_at).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>

          <Separator />

          {/* Roles */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <Label className="text-base font-medium">Roles</Label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {ALL_ROLES.map((role) => (
                <div
                  key={role}
                  className="flex items-center space-x-2 rounded-md border p-2"
                >
                  <Checkbox
                    id={`role-${role}`}
                    checked={selectedRoles.includes(role)}
                    onCheckedChange={() => handleRoleToggle(role)}
                  />
                  <Label
                    htmlFor={`role-${role}`}
                    className="flex-1 cursor-pointer text-sm"
                  >
                    <Badge variant="secondary" className={roleColors[role]}>
                      {roleLabels[role]}
                    </Badge>
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Journey Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-muted-foreground" />
              <Label className="text-base font-medium">Jornada Espiritual</Label>
            </div>
            <div className="grid grid-cols-2 gap-4 rounded-lg border p-4">
              <div>
                <p className="text-sm text-muted-foreground">Fase</p>
                <p className="font-medium">{user.fase_jornada || "Início"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Maturidade</p>
                <p className="font-medium">{user.spiritual_maturity || "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Temas Ativos</p>
                <p className="font-medium">{user.active_themes_count ?? 0}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Score Médio</p>
                <p className="font-medium">
                  {user.global_avg_score?.toFixed(1) ?? "—"}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleViewJourney}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Ver Mapa de Jornada
            </Button>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
