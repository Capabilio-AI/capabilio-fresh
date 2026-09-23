import { createClient } from "@/lib/supabase/client";
import type { Enums } from "@/lib/supabase/types";

export type CollegeType = Enums<"college_type">;

export interface BranchOption {
  id: string;
  name: string;
}

export async function getBranches(collegeType: CollegeType): Promise<BranchOption[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("branches")
    .select("id, name")
    .eq("college_type", collegeType)
    .order("sort_order");

  if (error || !data) return [];
  return data;
}
