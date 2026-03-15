import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const useFeatureFlag = (flagName: string): { enabled: boolean; loading: boolean } => {
  const { user, loading: authLoading } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["feature-flag", flagName, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_feature_flag", {
        p_flag_name: flagName,
        p_user_id: user?.id || null,
        p_cohort_id: null,
      });

      if (error) {
        console.error("Feature flag error:", error);
        return false;
      }
      return data === true;
    },
    staleTime: 30 * 1000,
    gcTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  return { enabled: !!data, loading: isLoading || authLoading };
};

export const useAllFeatureFlags = () => {
  return useQuery({
    queryKey: ["feature-flags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feature_flags")
        .select("*")
        .order("flag_name");

      if (error) throw error;
      return data as any[];
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
};
