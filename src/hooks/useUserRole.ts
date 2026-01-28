import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

// Tipos de roles disponíveis na plataforma
export type AppRole = 
  | 'buscador' 
  | 'soldado' 
  | 'pastor' 
  | 'igreja' 
  | 'profissional' 
  | 'auditor' 
  | 'desenvolvedor' 
  | 'admin';

export interface UserRoleState {
  // Roles individuais
  isAdmin: boolean;
  isDesenvolvedor: boolean;
  isSoldado: boolean;
  isBuscador: boolean;
  isPastor: boolean;
  isIgreja: boolean;
  isProfissional: boolean;
  isAuditor: boolean;
  
  // Permissões derivadas
  canAccessChat: boolean;
  canViewJourneyMap: boolean;
  canViewFeedbackDataset: boolean;
  canManageMembers: boolean;
  canAccessFullAdmin: boolean;
  canManageRoles: boolean;
  
  // Estado
  loading: boolean;
  roles: AppRole[];
}

export const useUserRole = (): UserRoleState => {
  const { user, loading: authLoading } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkRoles = async () => {
      if (!user) {
        setRoles([]);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        if (error) {
          console.error("Error fetching user roles:", error);
          setLoading(false);
          return;
        }

        const roleList = (data?.map((r) => r.role) || []) as AppRole[];
        setRoles(roleList);
      } catch (err) {
        console.error("Error checking roles:", err);
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      checkRoles();
    }
  }, [user, authLoading]);

  // Memoizar as flags de roles para evitar recálculos desnecessários
  const roleFlags = useMemo(() => {
    const isAdmin = roles.includes("admin");
    const isDesenvolvedor = roles.includes("desenvolvedor");
    const isSoldado = roles.includes("soldado");
    const isBuscador = roles.includes("buscador");
    const isPastor = roles.includes("pastor");
    const isIgreja = roles.includes("igreja");
    const isProfissional = roles.includes("profissional");
    const isAuditor = roles.includes("auditor");

    // Permissões derivadas baseadas na matriz de acesso
    const canAccessChat = 
      isAdmin || isDesenvolvedor || isSoldado || isPastor || 
      isBuscador || isProfissional;
    
    const canViewJourneyMap = 
      isAdmin || isDesenvolvedor || isSoldado || isPastor || 
      isProfissional || isAuditor;
    
    const canViewFeedbackDataset = 
      isAdmin || isDesenvolvedor || isProfissional || isAuditor;
    
    const canManageMembers = 
      isAdmin || isDesenvolvedor || isIgreja;
    
    const canAccessFullAdmin = 
      isAdmin || isDesenvolvedor;
    
    const canManageRoles = 
      isAdmin || isDesenvolvedor;

    return {
      isAdmin,
      isDesenvolvedor,
      isSoldado,
      isBuscador,
      isPastor,
      isIgreja,
      isProfissional,
      isAuditor,
      canAccessChat,
      canViewJourneyMap,
      canViewFeedbackDataset,
      canManageMembers,
      canAccessFullAdmin,
      canManageRoles,
    };
  }, [roles]);

  return {
    ...roleFlags,
    loading: loading || authLoading,
    roles,
  };
};

// Hook auxiliar para verificar se o usuário tem uma role específica
export const useHasRole = (role: AppRole): boolean => {
  const { roles, loading } = useUserRole();
  
  if (loading) return false;
  return roles.includes(role);
};

// Hook auxiliar para verificar se o usuário tem qualquer uma das roles especificadas
export const useHasAnyRole = (allowedRoles: AppRole[]): boolean => {
  const { roles, loading } = useUserRole();
  
  if (loading) return false;
  return allowedRoles.some(role => roles.includes(role));
};
