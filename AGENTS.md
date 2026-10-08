<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# AGENTS.md

- Data access uses the browser backend client with row-level security; every status change and technician assignment goes through security-definer database functions (`update_complaint_status`, `assign_technician`, `set_user_role`) — keeps transition and role rules enforced server-side in one place.
- Notifications and complaint history rows are written only by database triggers/functions, never by the client — keeps the audit trail trustworthy.
- Roles live in `user_roles`; signup can only self-assign student/faculty, the first user becomes admin, other roles are granted by admins — prevents privilege escalation.
- Complaint photos are stored in a private bucket under `<user_id>/...` and shown via signed URLs — workspace blocks public buckets.
- Signed-in pages live under `src/routes/_authenticated/` and share `AppShell` — single gate and navigation.
