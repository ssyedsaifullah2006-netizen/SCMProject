import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];
export type Status = Database["public"]["Enums"]["complaint_status"];
export type Priority = Database["public"]["Enums"]["complaint_priority"];

export const STATUSES: Status[] = ["registered", "assigned", "in_progress", "resolved", "closed"];
export const STATUS_LABEL: Record<Status, string> = {
  registered: "Registered",
  assigned: "Assigned",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};
export const ROLE_LABEL: Record<AppRole, string> = {
  student: "Student",
  faculty: "Faculty",
  technician: "Technician",
  estate_manager: "Estate Manager",
  admin: "Admin",
};
export const PRIORITIES: Priority[] = ["low", "medium", "high", "urgent"];

export function isStaff(role?: AppRole | null) {
  return role === "estate_manager" || role === "admin";
}

export function errMsg(e: unknown) {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return "Something went wrong";
}

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", u.user.id),
    ]);
    const order: AppRole[] = ["admin", "estate_manager", "technician", "faculty", "student"];
    const role = order.find((r) => roles?.some((x) => x.role === r)) ?? "student";
    return { id: u.user.id, email: u.user.email ?? "", profile, role };
  },
});

export const lookupsQuery = queryOptions({
  queryKey: ["lookups"],
  queryFn: async () => {
    const [c, l] = await Promise.all([
      supabase.from("categories").select("*").order("name"),
      supabase.from("locations").select("*").order("building"),
    ]);
    if (c.error) throw c.error;
    if (l.error) throw l.error;
    return { categories: c.data, locations: l.data };
  },
});

export const COMPLAINT_SELECT =
  "*, category:categories(name, sla_hours), location:locations(building, block), reporter:profiles!complaints_reporter_id_fkey(full_name, email, department), technician:profiles!complaints_assigned_technician_id_fkey(full_name)";

export type ComplaintRow = Awaited<ReturnType<typeof fetchComplaints>>[number];

export async function fetchComplaints(filter?: { reporter?: string; technician?: string }) {
  let q = supabase.from("complaints").select(COMPLAINT_SELECT).order("created_at", { ascending: false });
  if (filter?.reporter) q = q.eq("reporter_id", filter.reporter);
  if (filter?.technician) q = q.eq("assigned_technician_id", filter.technician);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export const complaintsQuery = (key: string, filter?: { reporter?: string; technician?: string }) =>
  queryOptions({ queryKey: ["complaints", key, filter], queryFn: () => fetchComplaints(filter) });

export const unreadCountQuery = (uid?: string) =>
  queryOptions({
    queryKey: ["notifications", "unread", uid],
    enabled: !!uid,
    refetchInterval: 30000,
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("is_read", false);
      return count ?? 0;
    },
  });

export function locationLabel(l?: { building: string; block: string | null } | null) {
  if (!l) return "—";
  return l.block ? `${l.building} · ${l.block}` : l.building;
}
