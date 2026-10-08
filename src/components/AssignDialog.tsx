import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { errMsg } from "@/lib/ccms";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export const techniciansQuery = {
  queryKey: ["technicians"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("technicians")
      .select("*, profile:profiles!technicians_user_id_fkey(full_name, email, phone), category:categories(name)");
    if (error) throw error;
    return data;
  },
};

export function AssignDialog({ complaintId, categoryId, current, label = "Assign" }: { complaintId: string; categoryId: string; current?: string | null; label?: string }) {
  const { data: techs = [] } = useQuery(techniciansQuery);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tech, setTech] = useState(current ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const sorted = [...techs].sort((a, b) => Number(b.category_id === categoryId) - Number(a.category_id === categoryId) || Number(b.is_available) - Number(a.is_available));

  async function go() {
    if (!tech) { toast.error("Pick a technician"); return; }
    setBusy(true);
    const { error } = await supabase.rpc("assign_technician", { _complaint: complaintId, _technician: tech, ...(note.trim() ? { _note: note.trim() } : {}) });
    setBusy(false);
    if (error) { toast.error(errMsg(error)); return; }
    toast.success("Technician assigned");
    setOpen(false);
    qc.invalidateQueries();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><UserPlus /> {label}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Assign technician</DialogTitle></DialogHeader>
        {techs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No technicians yet. An admin can promote users to Technician in the Admin Panel.</p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Technician</Label>
              <Select value={tech} onValueChange={setTech}>
                <SelectTrigger><SelectValue placeholder="Choose technician" /></SelectTrigger>
                <SelectContent>
                  {sorted.map((t) => (
                    <SelectItem key={t.user_id} value={t.user_id}>
                      {t.profile?.full_name} · {t.category?.name ?? "General"} {t.category_id === categoryId ? "★" : ""} {t.is_available ? "" : "(busy)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">★ matches this complaint's category</p>
            </div>
            <div className="space-y-1.5">
              <Label>Instructions (optional)</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button onClick={go} disabled={busy || techs.length === 0}>{busy && <Loader2 className="animate-spin" />}Assign</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
