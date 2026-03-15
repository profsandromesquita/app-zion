import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useFeatureFlag = (flagName: string): { enabled: boolean; loading: boolean } => {
  const { data, isLoading } = useQuery({
    queryKey: ["feature-flag", flagName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feature_flags")
        .select("flag_value")
        .eq("flag_name", flagName)
        .eq("scope", "global")
        .single();

      if (error) return false;
      return (data as any)?.flag_value ?? false;
    },
    staleTime: 30 * 1000,
    gcTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  return { enabled: !!data, loading: isLoading };
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
  });
};
