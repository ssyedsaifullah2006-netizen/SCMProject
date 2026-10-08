import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import {
  Bell, ClipboardList, LayoutDashboard, LogOut, Menu, PlusCircle, Shield, Wrench, Building2, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { meQuery, unreadCountQuery, ROLE_LABEL, type AppRole } from "@/lib/ccms";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: typeof Bell; roles?: AppRole[] };
const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/complaints/new", label: "Register Complaint", icon: PlusCircle, roles: ["student", "faculty", "estate_manager", "admin"] },
  { to: "/complaints", label: "My Complaints", icon: ClipboardList, roles: ["student", "faculty", "estate_manager", "admin"] },
  { to: "/technician", label: "My Jobs", icon: Wrench, roles: ["technician"] },
  { to: "/manager", label: "Estate Desk", icon: Building2, roles: ["estate_manager", "admin"] },
  { to: "/admin", label: "Admin Panel", icon: Shield, roles: ["admin"] },
  { to: "/notifications", label: "Notifications", icon: Bell },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { data: me } = useQuery(meQuery);
  const { data: unread = 0 } = useQuery(unreadCountQuery(me?.id));
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const items = NAV.filter((n) => !n.roles || (me && n.roles.includes(me.role)));

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const nav = (
    <nav className="flex flex-1 flex-col gap-1">
      {items.map((n) => (
        <Link
          key={n.to}
          to={n.to}
          onClick={() => setOpen(false)}
          activeOptions={{ exact: true }}
          className="group flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          activeProps={{ className: "bg-sidebar-accent !text-sidebar-primary font-medium" }}
        >
          <n.icon className="size-4" />
          <span className="flex-1">{n.label}</span>
          {n.to === "/notifications" && unread > 0 && (
            <span className="rounded-full bg-sidebar-primary px-1.5 text-[10px] font-semibold text-sidebar-primary-foreground">
              {unread}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );

  const brand = (
    <Link to="/dashboard" className="flex items-center gap-2.5 px-2">
      <span className="grid size-9 place-items-center rounded-md bg-sidebar-primary font-display text-sm font-extrabold text-sidebar-primary-foreground">
        CC
      </span>
      <span className="leading-tight">
        <span className="block font-display text-base font-bold text-sidebar-accent-foreground">CCMS</span>
        <span className="block text-[11px] text-sidebar-foreground/60">Campus Maintenance</span>
      </span>
    </Link>
  );

  const footer = me && (
    <div className="border-t border-sidebar-border pt-4">
      <p className="truncate px-2 text-sm font-medium text-sidebar-accent-foreground">{me.profile?.full_name}</p>
      <p className="px-2 text-xs text-sidebar-primary">{ROLE_LABEL[me.role]}</p>
      <button
        onClick={signOut}
        className="mt-3 flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        <LogOut className="size-4" /> Sign out
      </button>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[256px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col gap-8 bg-sidebar p-4 lg:flex">
        {brand}
        {nav}
        {footer}
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between bg-sidebar px-4 py-3 lg:hidden">
        {brand}
        <div className="flex items-center gap-2">
          <Link to="/notifications" className="relative p-2 text-sidebar-foreground">
            <Bell className="size-5" />
            {unread > 0 && <span className="absolute right-1 top-1 size-2 rounded-full bg-sidebar-primary" />}
          </Link>
          <button onClick={() => setOpen(true)} className="p-2 text-sidebar-foreground" aria-label="Open menu">
            <Menu className="size-5" />
          </button>
        </div>
      </header>
      <div className={cn("fixed inset-0 z-40 flex-col gap-6 bg-sidebar p-4 lg:hidden", open ? "flex" : "hidden")}>
        <div className="flex items-center justify-between">
          {brand}
          <button onClick={() => setOpen(false)} className="p-2 text-sidebar-foreground" aria-label="Close menu">
            <X className="size-5" />
          </button>
        </div>
        {nav}
        {footer}
      </div>

      <main className="min-w-0 px-4 py-6 sm:px-8 lg:py-10">{children}</main>
    </div>
  );
}

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="mb-1 font-mono text-xs uppercase tracking-widest text-primary">{eyebrow}</p>}
        <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
      </div>
      {children}
    </div>
  );
}

export function NoAccess() {
  return (
    <div className="rounded-lg border border-dashed p-12 text-center">
      <Shield className="mx-auto mb-3 size-8 text-muted-foreground" />
      <h2 className="text-xl font-bold">Restricted area</h2>
      <p className="mt-1 text-sm text-muted-foreground">Your role doesn't have access to this page.</p>
    </div>
  );
}

export function StatCard({ label, value, hint, tone = "default" }: { label: string; value: number | string; hint?: string; tone?: "default" | "accent" | "ink" }) {
  return (
    <div
      className={cn(
        "rounded-lg border p-5",
        tone === "default" && "bg-card",
        tone === "accent" && "border-accent bg-accent text-accent-foreground",
        tone === "ink" && "border-ink bg-ink text-ink-foreground",
      )}
    >
      <p className={cn("text-xs font-medium uppercase tracking-wider", tone === "default" ? "text-muted-foreground" : "opacity-80")}>{label}</p>
      <p className="mt-2 font-display text-4xl font-bold">{value}</p>
      {hint && <p className={cn("mt-1 text-xs", tone === "default" ? "text-muted-foreground" : "opacity-75")}>{hint}</p>}
    </div>
  );
}
