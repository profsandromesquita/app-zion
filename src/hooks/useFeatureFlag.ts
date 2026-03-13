import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useFeatureFlag = (key: string): { enabled: boolean; loading: boolean } => {
  const { data, isLoading } = useQuery({
    queryKey: ["feature-flag", key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feature_flags" as any)
        .select("enabled")
        .eq("key", key)
        .single();

      if (error) return false;
      return (data as any)?.enabled ?? false;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
  });

  return { enabled: !!data, loading: isLoading };
};

export const useAllFeatureFlags = () => {
  return useQuery({
    queryKey: ["feature-flags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feature_flags" as any)
        .select("*")
        .order("key");

      if (error) throw error;
      return data as any[];
    },
    staleTime: 30 * 1000,
  });
};
