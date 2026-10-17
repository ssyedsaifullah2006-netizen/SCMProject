import { supabase } from "@/integrations/supabase/client";

export const techniciansQuery = {
  queryKey: ["technicians"],
  refetchInterval: 15000,
  queryFn: async () => {
    const { data, error } = await supabase
      .from("technicians")
      .select("*, profile:profiles!technicians_user_id_fkey(full_name, email, phone), category:categories(name)");
    if (error) throw error;
    return data;
  },
};