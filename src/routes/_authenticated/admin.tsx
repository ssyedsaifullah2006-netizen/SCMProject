import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { meQuery, lookupsQuery, ROLE_LABEL, errMsg, type AppRole } from "@/lib/ccms";
import { PageHeader, NoAccess, StatCard } from "@/components/AppShell";
import { techniciansQuery } from "@/components/AssignDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin Panel — CCMS" }, { name: "description", content: "Manage users, roles, categories and locations." }] }),
  component: Admin,
});

const ROLES: AppRole[] = ["student", "faculty", "technician", "estate_manager", "admin"];

function Admin() {
  const { data: me } = useQuery(meQuery);
  const isAdmin = me?.role === "admin";
  const qc = useQueryClient();
  const { data: lk } = useQuery(lookupsQuery);
  const { data: techs = [] } = useQuery({ ...techniciansQuery, enabled: isAdmin });
  const { data: users = [] } = useQuery({
    queryKey: ["admin-users"],
    enabled: isAdmin,
    queryFn: async () => {
      const [p, r] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (p.error) throw p.error;
      return p.data.map((u) => ({ ...u, role: (r.data?.find((x) => x.user_id === u.id)?.role ?? "student") as AppRole }));
    },
  });
  const [q, setQ] = useState("");

  if (!me) return null;
  if (!isAdmin) return <NoAccess />;

  async function setRole(userId: string, role: AppRole, category?: string) {
    const { error } = await supabase.rpc("set_user_role", { _user: userId, _role: role, _category: category });
    if (error) return toast.error(errMsg(error));
    toast.success("Role updated");
    qc.invalidateQueries();
  }
  async function setTechCategory(userId: string, category: string) {
    const { error } = await supabase.from("technicians").update({ category_id: category }).eq("user_id", userId);
    if (error) return toast.error(errMsg(error));
    qc.invalidateQueries();
  }

  const shown = users.filter((u) => `${u.full_name} ${u.email}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Administration" title="Admin Panel" />
      <div className="mb-8 grid gap-4 sm:grid-cols-4">
        <StatCard tone="ink" label="Users" value={users.length} />
        <StatCard label="Technicians" value={techs.length} />
        <StatCard label="Categories" value={lk?.categories.length ?? 0} />
        <StatCard label="Locations" value={lk?.locations.length ?? 0} />
      </div>
      <Tabs defaultValue="users">
        <TabsList><TabsTrigger value="users">Users & roles</TabsTrigger><TabsTrigger value="categories">Categories</TabsTrigger><TabsTrigger value="locations">Locations</TabsTrigger></TabsList>

        <TabsContent value="users" className="mt-4">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users" className="mb-3 max-w-xs bg-card" />
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr><th className="p-3">Name</th><th className="p-3">Department</th><th className="p-3">Role</th><th className="p-3">Trade (technicians)</th></tr>
              </thead>
              <tbody className="divide-y">
                {shown.map((u) => {
                  const t = techs.find((x) => x.user_id === u.id);
                  return (
                    <tr key={u.id}>
                      <td className="p-3"><p className="font-medium">{u.full_name}</p><p className="text-xs text-muted-foreground">{u.email}</p></td>
                      <td className="p-3 text-muted-foreground">{u.department ?? "—"}</td>
                      <td className="p-3">
                        <Select value={u.role} onValueChange={(v) => setRole(u.id, v as AppRole)} disabled={u.id === me.id}>
                          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                          <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                      <td className="p-3">
                        {u.role === "technician" ? (
                          <Select value={t?.category_id ?? ""} onValueChange={(v) => setTechCategory(u.id, v)}>
                            <SelectTrigger className="w-40"><SelectValue placeholder="General" /></SelectTrigger>
                            <SelectContent>{lk?.categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                          </Select>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="categories" className="mt-4">
          <CrudList
            items={(lk?.categories ?? []).map((c) => ({ id: c.id, primary: c.name, secondary: `${c.sla_hours}h target · ${c.description ?? ""}` }))}
            fields={[{ name: "name", placeholder: "Category name" }, { name: "sla_hours", placeholder: "Target hours", type: "number" }, { name: "description", placeholder: "Description" }]}
            onAdd={async (v) => {
              const sla = Number(v.sla_hours || 48);
              if (v.name.trim().length < 2 || !(sla > 0 && sla <= 720)) throw new Error("Enter a name and target hours (1–720)");
              const { error } = await supabase.from("categories").insert({ name: v.name.trim(), sla_hours: sla, description: v.description || null });
              if (error) throw error;
            }}
            onDelete={async (id) => { const { error } = await supabase.from("categories").delete().eq("id", id); if (error) throw error; }}
          />
        </TabsContent>

        <TabsContent value="locations" className="mt-4">
          <CrudList
            items={(lk?.locations ?? []).map((l) => ({ id: l.id, primary: l.building, secondary: `${l.block ?? ""} · ${l.zone ?? ""}` }))}
            fields={[{ name: "building", placeholder: "Building" }, { name: "block", placeholder: "Block / wing" }, { name: "zone", placeholder: "Zone" }]}
            onAdd={async (v) => {
              if (v.building.trim().length < 2) throw new Error("Enter a building name");
              const { error } = await supabase.from("locations").insert({ building: v.building.trim(), block: v.block || null, zone: v.zone || null });
              if (error) throw error;
            }}
            onDelete={async (id) => { const { error } = await supabase.from("locations").delete().eq("id", id); if (error) throw error; }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CrudList({ items, fields, onAdd, onDelete }: {
  items: { id: string; primary: string; secondary: string }[];
  fields: { name: string; placeholder: string; type?: string }[];
  onAdd: (v: Record<string, string>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const qc = useQueryClient();
  async function add(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = ev.currentTarget;
    try {
      await onAdd(Object.fromEntries(new FormData(form).entries()) as Record<string, string>);
      form.reset();
      toast.success("Added");
      qc.invalidateQueries({ queryKey: ["lookups"] });
    } catch (e) { toast.error(errMsg(e)); }
  }
  async function del(id: string) {
    try { await onDelete(id); toast.success("Removed"); qc.invalidateQueries({ queryKey: ["lookups"] }); }
    catch (e) { toast.error(errMsg(e).includes("foreign key") ? "In use by existing complaints — can't delete" : errMsg(e)); }
  }
  return (
    <div className="space-y-4">
      <form onSubmit={add} className="flex flex-wrap gap-2 rounded-lg border bg-card p-3">
        {fields.map((f) => <Input key={f.name} name={f.name} placeholder={f.placeholder} type={f.type} className="w-auto flex-1 min-w-36" />)}
        <Button><Plus /> Add</Button>
      </form>
      <ul className="divide-y rounded-lg border bg-card">
        {items.map((i) => (
          <li key={i.id} className="flex items-center justify-between gap-3 p-3 text-sm">
            <div><p className="font-medium">{i.primary}</p><p className="text-xs text-muted-foreground">{i.secondary}</p></div>
            <Button size="icon" variant="ghost" onClick={() => del(i.id)} aria-label="Delete"><Trash2 className="size-4" /></Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
