import { pageHead } from "@/lib/page-head";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ImagePlus, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { meQuery, lookupsQuery, PRIORITIES, errMsg, locationLabel, type Priority } from "@/lib/ccms";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export const Route = createFileRoute("/_authenticated/complaints/new")({
  head: () => pageHead("Register Complaint — CCMS", "Report a new campus maintenance issue."),
  component: NewComplaint,
});

const schema = z.object({
  title: z.string().trim().min(5, "At least 5 characters").max(120),
  description: z.string().trim().min(10, "Describe the issue in at least 10 characters").max(2000),
  category_id: z.string().uuid("Choose a category"),
  location_id: z.string().uuid("Choose a location"),
  room: z.string().trim().max(40).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
});

function NewComplaint() {
  const { data: me } = useQuery(meQuery);
  const { data: lk, isLoading, error: lookupError, refetch } = useQuery(lookupsQuery);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [cat, setCat] = useState("");
  const [loc, setLoc] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string>();

  useEffect(() => {
    if (!file) { setPreview(undefined); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pickFile(f?: File) {
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast.error("Please choose an image file"); return; }
    if (f.size > 5 * 1024 * 1024) { toast.error("Image must be under 5 MB"); return; }
    setFile(f);
  }

  async function submit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!me) return;
    const fd = Object.fromEntries(new FormData(ev.currentTarget).entries());
    const parsed = schema.safeParse({ ...fd, category_id: cat, location_id: loc, priority });
    if (!parsed.success) {
      const out: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (out[String(i.path[0])] = i.message));
      return setErrors(out);
    }
    setErrors({});
    setBusy(true);
    try {
      let photo_url: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${me.id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("complaint-photos").upload(path, file, { contentType: file.type });
        if (error) throw error;
        photo_url = path;
      }
      const { data, error } = await supabase
        .from("complaints")
        .insert({ ...parsed.data, room: parsed.data.room || null, reporter_id: me.id, photo_url })
        .select("id, ticket_no")
        .single();
      if (error) throw error;
      toast.success(`Complaint ${data.ticket_no} registered`);
      qc.invalidateQueries();
      navigate({ to: "/complaints/$id", params: { id: data.id } });
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  const err = (k: string) => errors[k] && <p role="alert" className="text-xs text-destructive">{errors[k]}</p>;
  const selectedCat = lk?.categories.find((c) => c.id === cat);

  if (lookupError) return <div role="alert" className="space-y-3"><p>Unable to load categories and locations.</p><Button variant="outline" onClick={() => refetch()}>Try again</Button></div>;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New complaint" />
      <form onSubmit={submit} noValidate className="space-y-6">
        <div className="space-y-1.5">
          <Label htmlFor="title">Complaint title</Label>
          <Input id="title" name="title" maxLength={120} required placeholder="Ceiling fan not working in Room 204" />
          {err("title")}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="category">Category</Label>
            <Select value={cat} onValueChange={setCat}>
              <SelectTrigger id="category" disabled={isLoading}><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>{lk?.categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            {selectedCat && <p className="text-xs text-muted-foreground">Response target: {selectedCat.sla_hours} hours</p>}
            {err("category_id")}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="location">Location</Label>
            <Select value={loc} onValueChange={setLoc}>
              <SelectTrigger id="location" disabled={isLoading}><SelectValue placeholder="Select building" /></SelectTrigger>
              <SelectContent>{lk?.locations.map((l) => <SelectItem key={l.id} value={l.id}>{locationLabel(l)}</SelectItem>)}</SelectContent>
            </Select>
            {err("location_id")}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="room">Room / spot (optional)</Label>
            <Input id="room" name="room" placeholder="e.g. Room 204, 2nd floor washroom" />
          </div>
          <div className="space-y-1.5">
            <Label id="priority-label">Priority</Label>
            <RadioGroup aria-labelledby="priority-label" value={priority} onValueChange={(v) => setPriority(v as Priority)} className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4">
              {PRIORITIES.map((p) => (
                <div key={p} className="flex items-center gap-2"><RadioGroupItem id={`priority-${p}`} value={p} /><Label htmlFor={`priority-${p}`} className="capitalize">{p}</Label></div>
              ))}
            </RadioGroup>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" name="description" rows={5} maxLength={2000} required placeholder="Describe the issue" />
          {err("description")}
        </div>

        <div className="space-y-1.5">
          <Label>Photo (optional)</Label>
          {file ? (
            <div className="relative w-fit">
              <img src={preview} alt="Complaint photo preview" className="h-40 rounded-md border object-cover" />
              <Button type="button" size="icon" variant="secondary" onClick={() => setFile(null)} className="absolute right-1 top-1" aria-label="Remove photo"><X /></Button>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed p-8 text-sm text-muted-foreground hover:bg-muted/50">
              <ImagePlus className="size-6" />
              Click to attach an image (max 5 MB)
              <input type="file" aria-label="Attach complaint photo" accept="image/*" className="sr-only" onChange={(e) => pickFile(e.target.files?.[0])} />
            </label>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => navigate({ to: "/complaints" })}>Cancel</Button>
          <Button disabled={busy || isLoading}>{busy && <Loader2 className="animate-spin" />}Submit complaint</Button>
        </div>
      </form>
    </div>
  );
}
