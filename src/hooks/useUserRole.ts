import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export const useUserRole = () => {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSoldado, setIsSoldado] = useState(false);
  const [isBuscador, setIsBuscador] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkRoles = async () => {
      if (!user) {
        setIsAdmin(false);
        setIsSoldado(false);
        setIsBuscador(false);
        setLoading(false);
        return;
      }

      try {
        const { data: roles, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        if (error) {
          console.error("Error fetching user roles:", error);
          setLoading(false);
          return;
        }

        const roleList = roles?.map((r) => r.role) || [];
        setIsAdmin(roleList.includes("admin"));
        setIsSoldado(roleList.includes("soldado"));
        setIsBuscador(roleList.includes("buscador"));
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

  return { isAdmin, isSoldado, isBuscador, loading: loading || authLoading };
};
