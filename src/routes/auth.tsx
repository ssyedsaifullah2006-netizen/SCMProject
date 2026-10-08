import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — CCMS" },
      { name: "description", content: "Sign in or create your CCMS account to report and track campus maintenance." },
      { property: "og:title", content: "Sign in — CCMS" },
      { property: "og:description", content: "Access the Campus Complaint & Maintenance System." },
    ],
  }),
  component: AuthPage,
});

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});
const signupSchema = loginSchema.extend({
  full_name: z.string().trim().min(2, "Enter your full name").max(80),
  department: z.string().trim().max(80).optional(),
  phone: z.string().trim().regex(/^[0-9+\-\s]{0,15}$/, "Enter a valid phone").optional(),
  role: z.enum(["student", "faculty"]),
});

function AuthPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [role, setRole] = useState<"student" | "faculty">("student");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  function collect(form: HTMLFormElement) {
    return Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
  }
  function fieldErrors(e: z.ZodError) {
    const out: Record<string, string> = {};
    e.issues.forEach((i) => (out[String(i.path[0])] = i.message));
    setErrors(out);
  }

  async function onLogin(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const parsed = loginSchema.safeParse(collect(ev.currentTarget));
    if (!parsed.success) return fieldErrors(parsed.error);
    setErrors({});
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setBusy(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/dashboard" });
  }

  async function onSignup(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const parsed = signupSchema.safeParse({ ...collect(ev.currentTarget), role });
    if (!parsed.success) return fieldErrors(parsed.error);
    setErrors({});
    setBusy(true);
    const { email, password, ...meta } = parsed.data;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin + "/dashboard", data: meta },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    if (data.session) navigate({ to: "/dashboard" });
    else toast.success("Check your inbox to confirm your email, then sign in.");
  }

  const err = (k: string) => errors[k] && <p className="text-xs text-destructive">{errors[k]}</p>;

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-ink p-12 text-ink-foreground lg:flex">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-md bg-accent font-display text-sm font-extrabold text-accent-foreground">CC</span>
          <span className="font-display text-lg font-bold">CCMS</span>
        </Link>
        <div>
          <h2 className="text-5xl font-extrabold leading-tight">Every repair,<br />accounted for.</h2>
          <p className="mt-4 max-w-sm opacity-70">From hostel taps to lab projectors — one desk, one ticket, one clear status.</p>
        </div>
        <p className="font-mono text-xs opacity-50">Estate & Maintenance Office</p>
      </div>

      <div className="flex items-center justify-center p-6 grid-paper">
        <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-sm">
          <h1 className="text-2xl font-bold">Welcome</h1>
          <p className="mb-6 text-sm text-muted-foreground">Sign in with your campus email.</p>
          <Tabs defaultValue="login" onValueChange={() => setErrors({})}>
            <TabsList className="mb-6 grid w-full grid-cols-2">
              <TabsTrigger value="login">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <form onSubmit={onLogin} className="space-y-4" noValidate>
                <div className="space-y-1.5"><Label htmlFor="l-email">Email</Label><Input id="l-email" name="email" type="email" autoComplete="email" />{err("email")}</div>
                <div className="space-y-1.5"><Label htmlFor="l-pw">Password</Label><Input id="l-pw" name="password" type="password" autoComplete="current-password" />{err("password")}</div>
                <Button className="w-full" disabled={busy}>{busy && <Loader2 className="animate-spin" />}Sign in</Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={onSignup} className="space-y-4" noValidate>
                <div className="space-y-1.5"><Label htmlFor="s-name">Full name</Label><Input id="s-name" name="full_name" />{err("full_name")}</div>
                <div className="space-y-1.5"><Label htmlFor="s-email">Email</Label><Input id="s-email" name="email" type="email" />{err("email")}</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>I am a</Label>
                    <Select value={role} onValueChange={(v) => setRole(v as "student" | "faculty")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="student">Student</SelectItem><SelectItem value="faculty">Faculty</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5"><Label htmlFor="s-dept">Department</Label><Input id="s-dept" name="department" placeholder="e.g. CSE" />{err("department")}</div>
                </div>
                <div className="space-y-1.5"><Label htmlFor="s-phone">Phone (optional)</Label><Input id="s-phone" name="phone" />{err("phone")}</div>
                <div className="space-y-1.5"><Label htmlFor="s-pw">Password</Label><Input id="s-pw" name="password" type="password" autoComplete="new-password" />{err("password")}</div>
                <Button className="w-full" disabled={busy}>{busy && <Loader2 className="animate-spin" />}Create account</Button>
                <p className="text-xs text-muted-foreground">Technician and Estate Manager accounts are granted by an admin.</p>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
