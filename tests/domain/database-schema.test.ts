import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../", import.meta.url));
const common = readFileSync(
  new URL("../../db/migrations/20260828180000_core.sql", import.meta.url),
  "utf8",
);
const supabase = readFileSync(
  new URL("../../db/providers/supabase/20260828181000_supabase.sql", import.meta.url),
  "utf8",
);
const qaSeed = readFileSync(new URL("../../db/seeds/qa/001_demo.sql", import.meta.url), "utf8");

describe("portable database schema", () => {
  it("keeps provider authentication out of the common migrations", () => {
    expect(root).toBeTruthy();
    expect(common).not.toMatch(/\bauth\./i);
    expect(common).not.toMatch(/auth\.uid\s*\(/i);
    expect(common).toMatch(
      /create table if not exists public\.profiles\s*\([\s\S]*?id text primary key/i,
    );
    expect(common).toMatch(/Authentication subject \(sub\)/);
  });

  it("contains the complete shared product model", () => {
    for (const table of [
      "profiles",
      "user_preferences",
      "workspaces",
      "workspace_settings",
      "workspace_members",
      "clients",
      "projects",
      "project_members",
      "workspace_invitations",
      "time_entries",
      "active_timers",
    ]) {
      expect(common).toContain(`create table if not exists public.${table}`);
    }
  });

  it("enforces workspace ownership, valid duration, timer task and timer uniqueness", () => {
    expect(common).toContain("foreign key (client_id, workspace_id)");
    expect(common).toContain("foreign key (workspace_id, user_id)");
    expect(common).toContain("foreign key (project_id, workspace_id)");
    expect(common).toContain("duration_seconds integer not null check (duration_seconds > 0)");
    expect(common).toMatch(/active_timers[\s\S]*?task text not null check/i);
    expect(common).toMatch(/active_timers[\s\S]*?primary key \(user_id, workspace_id\)/i);
  });

  it("indexes the main workspace, user, date and project query paths", () => {
    expect(common).toContain("time_entries_workspace_date_idx");
    expect(common).toContain("time_entries_user_date_idx");
    expect(common).toContain("time_entries_workspace_project_date_idx");
    expect(common).toContain("projects_workspace_idx");
  });

  it("maps Supabase users from the verified token subject only in its adapter", () => {
    expect(supabase).toContain("auth.jwt() ->> 'sub'");
    expect(supabase).toContain("new.id::text");
  });

  it("keeps synthetic seeds guarded and exclusive to QA", () => {
    expect(qaSeed).toContain("app.environment");
    expect(qaSeed).toContain("example.test");
    expect(qaSeed).not.toMatch(/@(?:gmail|outlook|hotmail)\./i);
  });
});
