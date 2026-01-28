import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUserRole, AppRole } from "@/hooks/useUserRole";
import { Loader2 } from "lucide-react";

interface RoleRouteProps {
  children: React.ReactNode;
  allowedRoles: AppRole[];
  redirectTo?: string;
  fallback?: React.ReactNode;
}

/**
 * Componente de rota protegida por roles
 * 
 * @param children - Conteúdo a ser renderizado se o usuário tiver permissão
 * @param allowedRoles - Lista de roles que têm acesso à rota
 * @param redirectTo - URL para redirecionar se não tiver permissão (padrão: "/")
 * @param fallback - Componente alternativo a mostrar durante o carregamento
 */
const RoleRoute = ({ 
  children, 
  allowedRoles, 
  redirectTo = "/",
  fallback 
}: RoleRouteProps) => {
  const { roles, loading } = useUserRole();
  const navigate = useNavigate();

  const hasAccess = allowedRoles.some(role => roles.includes(role));

  useEffect(() => {
    if (!loading && !hasAccess) {
      navigate(redirectTo);
    }
  }, [hasAccess, loading, navigate, redirectTo]);

  if (loading) {
    return fallback || (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasAccess) {
    return null;
  }

  return <>{children}</>;
};

export default RoleRoute;

// Componentes de rota específicos para cada perfil

/**
 * Rota para administradores e desenvolvedores (acesso total)
 */
export const FullAdminRoute = ({ children }: { children: React.ReactNode }) => (
  <RoleRoute allowedRoles={['admin', 'desenvolvedor']}>
    {children}
  </RoleRoute>
);

/**
 * Rota para quem pode ver o mapa de jornada
 */
export const JourneyMapRoute = ({ children }: { children: React.ReactNode }) => (
  <RoleRoute allowedRoles={['admin', 'desenvolvedor', 'soldado', 'pastor', 'profissional', 'auditor']}>
    {children}
  </RoleRoute>
);

/**
 * Rota para quem pode ver o dataset de feedback
 */
export const FeedbackDatasetRoute = ({ children }: { children: React.ReactNode }) => (
  <RoleRoute allowedRoles={['admin', 'desenvolvedor', 'profissional', 'auditor']}>
    {children}
  </RoleRoute>
);

/**
 * Rota para quem pode gerenciar membros (igreja)
 */
export const MemberManagementRoute = ({ children }: { children: React.ReactNode }) => (
  <RoleRoute allowedRoles={['admin', 'desenvolvedor', 'igreja']}>
    {children}
  </RoleRoute>
);

/**
 * Rota para soldados
 */
export const SoldadoRoute = ({ children }: { children: React.ReactNode }) => (
  <RoleRoute allowedRoles={['admin', 'desenvolvedor', 'soldado']}>
    {children}
  </RoleRoute>
);

/**
 * Rota para pastores
 */
export const PastorRoute = ({ children }: { children: React.ReactNode }) => (
  <RoleRoute allowedRoles={['admin', 'desenvolvedor', 'pastor']}>
    {children}
  </RoleRoute>
);

/**
 * Rota para profissionais (psicólogos/psiquiatras)
 */
export const ProfissionalRoute = ({ children }: { children: React.ReactNode }) => (
  <RoleRoute allowedRoles={['admin', 'desenvolvedor', 'profissional']}>
    {children}
  </RoleRoute>
);

/**
 * Rota para auditores (dados anonimizados)
 */
export const AuditorRoute = ({ children }: { children: React.ReactNode }) => (
  <RoleRoute allowedRoles={['admin', 'desenvolvedor', 'auditor']}>
    {children}
  </RoleRoute>
);
