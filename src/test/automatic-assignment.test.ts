// @vitest-environment node
import postgres from "postgres";
import { afterAll, beforeEach, afterEach, describe, expect, it } from "vitest";

// Integration tests are isolated in rolled-back transactions; no campus data is retained.
const connection = process.env["SUPABASE_DB_URL"];
const sql = connection ? postgres(connection, { max: 1, prepare: false }) : null;
const suite = connection ? describe : describe.skip;
let category: string;
let otherCategory: string;
let location: string;
let reporter: string;
let first: string;
let second: string;

suite("Automatic technician assignment", () => {
  beforeEach(async () => {
    if (!sql) throw new Error("Test database connection required");
    await sql`BEGIN`;
    const profiles = await sql`SELECT id FROM public.profiles ORDER BY created_at LIMIT 4`;
    if (profiles.length < 3) throw new Error("Three existing profiles required for rolled-back integration tests");
    reporter = profiles[0]?.["id"];
    first = profiles[1]?.["id"];
    second = profiles[2]?.["id"];
    const cats = await sql`INSERT INTO public.categories (name) VALUES ('Assignment integration A'),('Assignment integration B') RETURNING id`;
    category = cats[0]?.["id"];
    otherCategory = cats[1]?.["id"];
    const loc = await sql`SELECT id FROM public.locations LIMIT 1`;
    location = loc[0]?.["id"];
    for (const user of [first, second]) {
      await sql`INSERT INTO public.user_roles (user_id,role) VALUES (${user},'technician') ON CONFLICT DO NOTHING`;
      await sql`INSERT INTO public.technicians (user_id,category_id,is_available) VALUES (${user},${category},false)
        ON CONFLICT (user_id) DO UPDATE SET category_id = EXCLUDED.category_id,is_available = false`;
    }
  });
  afterEach(async () => { if (sql) await sql`ROLLBACK`; });
  afterAll(async () => { if (sql) await sql.end(); });

  async function complaint() {
    if (!sql) throw new Error("Test database connection required");
    const rows = await sql`INSERT INTO public.complaints (reporter_id,category_id,location_id,title,description)
      VALUES (${reporter},${category},${location},'Automatic assignment integration test','Rolled-back test for automatic dispatch') RETURNING id`;
    const id = rows[0]?.["id"];
    const result = await sql`SELECT * FROM public.complaints WHERE id = ${id}`;
    return result[0];
  }

  it("assigns only an available technician in the matching category", async () => {
    if (!sql) throw new Error("Test database connection required");
    await sql`UPDATE public.technicians SET category_id = ${otherCategory},is_available = true WHERE user_id = ${first}`;
    await sql`UPDATE public.technicians SET is_available = true WHERE user_id = ${second}`;
    expect((await complaint())?.["assigned_technician_id"]).toBe(second);
  });

  it("excludes unavailable technicians", async () => {
    expect((await complaint())?.["assigned_technician_id"]).toBeNull();
  });

  it("chooses the technician with the fewest active jobs", async () => {
    if (!sql) throw new Error("Test database connection required");
    await sql`UPDATE public.technicians SET is_available = true WHERE user_id = ${first}`;
    expect((await complaint())?.["assigned_technician_id"]).toBe(first);
    await sql`UPDATE public.technicians SET is_available = true WHERE user_id = ${second}`;
    expect((await complaint())?.["assigned_technician_id"]).toBe(second);
  });

  it("dispatches a queued complaint when a category specialist becomes available", async () => {
    if (!sql) throw new Error("Test database connection required");
    const queued = await complaint();
    expect(queued?.["status"]).toBe("registered");
    await sql`UPDATE public.technicians SET is_available = true WHERE user_id = ${first}`;
    const rows = await sql`SELECT status,assigned_technician_id FROM public.complaints WHERE id = ${queued?.["id"]}`;
    expect(rows[0]?.["status"]).toBe("assigned");
    expect(rows[0]?.["assigned_technician_id"]).toBe(first);
  });

  it("writes a system assignment, status history and alerts for technician and reporter", async () => {
    if (!sql) throw new Error("Test database connection required");
    await sql`UPDATE public.technicians SET is_available = true WHERE user_id = ${first}`;
    const c = await complaint();
    const assignments = await sql`SELECT technician_id,assigned_by FROM public.assignments WHERE complaint_id = ${c?.["id"]}`;
    expect(assignments).toHaveLength(1);
    expect(assignments[0]?.["technician_id"]).toBe(first);
    expect(assignments[0]?.["assigned_by"]).toBeNull();
    const updates = await sql`SELECT old_status,new_status FROM public.complaint_updates WHERE complaint_id = ${c?.["id"]} AND new_status = 'assigned'`;
    expect(updates[0]?.["old_status"]).toBe("registered");
    const alerts = await sql`SELECT user_id FROM public.notifications WHERE complaint_id = ${c?.["id"]}`;
    expect(alerts.map((n) => n["user_id"])).toEqual(expect.arrayContaining([first,reporter]));
  });

  it("does not expose the system dispatcher to signed-in or anonymous callers", async () => {
    if (!sql) throw new Error("Test database connection required");
    const rows = await sql`SELECT has_function_privilege('authenticated','public.dispatch_queued_complaints()','EXECUTE') AS signed_in,
      has_function_privilege('anon','public.dispatch_queued_complaints()','EXECUTE') AS anonymous`;
    expect(rows[0]?.["signed_in"]).toBe(false);
    expect(rows[0]?.["anonymous"]).toBe(false);
  });
});