import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { Loader2 } from "lucide-react";

interface AdminRouteProps {
  children: React.ReactNode;
}

/**
 * Rota protegida para administradores e desenvolvedores.
 * Usa o hook useUserRole para verificar permissões de acesso total ao admin.
 */
const AdminRoute = ({ children }: AdminRouteProps) => {
  const { canAccessFullAdmin, loading } = useUserRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !canAccessFullAdmin) {
      navigate("/");
    }
  }, [canAccessFullAdmin, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!canAccessFullAdmin) {
    return null;
  }

  return <>{children}</>;
};

export default AdminRoute;
