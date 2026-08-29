import { describe, expect, it } from "vitest";
import {
  isValidAccount,
  makeSeedAccount,
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
