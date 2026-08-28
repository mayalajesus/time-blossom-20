import { describe, expect, it } from "vitest";
import { isValidAccount, makeSeedAccount } from "../../src/lib/store";

describe("local account persistence", () => {
  it("accepts the current snapshot after changing one user's theme", () => {
    const account = makeSeedAccount();
    account.preferencesByUserId.u1 = {
      ...account.preferencesByUserId.u1,
      theme: "dark",
    };

    expect(isValidAccount(JSON.parse(JSON.stringify(account)))).toBe(true);
  });
});
