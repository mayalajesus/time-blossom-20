import { describe, expect, it } from "vitest";
import {
  isValidAccount,
  makeSeedAccount,
  migrateAccountSnapshot,
  repairDuplicateEntryIds,
  type PersistedAccount,
} from "../../src/lib/store";

describe("local account persistence", () => {
  it("accepts the current snapshot after changing one user's theme", () => {
    const account = makeSeedAccount();
    account.preferencesByUserId.u1 = {
      ...account.preferencesByUserId.u1,
      theme: "dark",
    };

    expect(isValidAccount(JSON.parse(JSON.stringify(account)))).toBe(true);
  });

  it("migrates version 10 preferences without deleting entries", () => {
    const current = makeSeedAccount();
    const firstEntry = current.workspaces[0]?.entries[0];
    const legacy = {
      ...structuredClone(current),
      version: 10,
      preferencesByUserId: Object.fromEntries(
        Object.entries(current.preferencesByUserId).map(([userId, preferences]) => {
          const { hourlyRate: _hourlyRate, currency: _currency, ...oldPreferences } = preferences;
          return [userId, oldPreferences];
        }),
      ),
    };

    const migrated = migrateAccountSnapshot(legacy);

    expect(migrated?.version).toBe(11);
    expect(migrated?.workspaces[0]?.entries).toEqual(current.workspaces[0]?.entries);
    expect(migrated?.workspaces[0]?.entries[0]).toEqual(firstEntry);
    expect(migrated?.preferencesByUserId.u1?.hourlyRate).toBe(0);
    expect(migrated?.preferencesByUserId.u1?.currency).toBe("USD");
  });

  it("repairs duplicate entry IDs without changing the original records", () => {
    const account = JSON.parse(JSON.stringify(makeSeedAccount())) as PersistedAccount;
    const firstEntry = account.workspaces[0]?.entries[0];
    if (!firstEntry) throw new Error("The seed account must include a time entry.");

    account.workspaces[0]?.entries.push({ ...firstEntry });

    expect(isValidAccount(account)).toBe(false);

    const repaired = repairDuplicateEntryIds(account) as PersistedAccount;
    const repairedEntries = repaired.workspaces[0]?.entries ?? [];

    expect(isValidAccount(repaired)).toBe(true);
    expect(repairedEntries[0]?.id).toBe(firstEntry.id);
    expect(repairedEntries[1]?.id).not.toBe(firstEntry.id);
    expect(new Set(repairedEntries.map((entry) => entry.id)).size).toBe(repairedEntries.length);
  });
});
