import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationName =
  "202608110024_ai_distributed_actor_rate_limit.sql";
const migrationsDirectory = path.resolve(process.cwd(), "supabase/migrations");

describe("AI distributed actor rate-limit migration", () => {
  it("is the sole ordered migration after the frozen 001-023 history", async () => {
    const migrations = (await readdir(migrationsDirectory))
      .filter((name) => name.endsWith(".sql"))
      .sort();
    expect(migrations).toHaveLength(24);
    expect(migrations.at(-1)).toBe(migrationName);
    expect(migrations.some((name) => name.includes("0025"))).toBe(false);
  });

  it("keeps a zero-argument identity-derived RPC and explicitly private state", async () => {
    const sql = await readFile(path.join(migrationsDirectory, migrationName), "utf8");
    expect(sql).toMatch(
      /function public\.consume_ai_actor_rate_limit\(\)\s+returns jsonb/iu,
    );
    expect(sql).toContain("authenticated_actor_id uuid := auth.uid()");
    expect(sql).toContain("public.is_active_user()");
    expect(sql).toContain("authoritative_now := pg_catalog.clock_timestamp()");
    expect(sql).toContain(
      "authoritative_now - accepted_timestamp < interval '60 seconds'",
    );
    expect(sql).toContain(
      "authoritative_now - last_accepted_at < interval '5 seconds'",
    );
    expect(sql).toContain("for update");
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain("revoke all on schema ai_rate_limit_private");
    expect(sql).toContain("revoke all on table ai_rate_limit_private.actor_windows");
    expect(sql).toContain("from public, anon, authenticated, service_role");
    expect(sql).toContain("from public, anon, service_role");
    expect(sql).toContain("to authenticated");
    expect(sql).not.toMatch(/alter\s+table\s+public\./iu);
    expect(sql).not.toContain("mutation_audit_events");
  });
});
