import { describe, expect, it, vi } from "vitest";
import { authenticateDataRequest } from "../../server/authentication.mjs";

describe("data API authentication", () => {
  it("rejects requests without a bearer token", async () => {
    await expect(
      authenticateDataRequest(
        { headers: {} },
        {
          databaseProvider: "neon",
          neonAuthUrl: "https://auth.example.test/api/auth",
          neonAuthIssuer: "https://auth.example.test",
        },
        vi.fn(),
      ),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("resolves a valid Neon session from the database before JWKS verification", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          id: "user-1",
          email: " MAYA@EXAMPLE.COM ",
          name: "Maya Silva",
          image: "https://lh3.googleusercontent.com/a/avatar",
        },
      ],
    });

    const user = await authenticateDataRequest(
      { headers: { authorization: "Bearer session-token" } },
      {
        databaseProvider: "neon",
        neonAuthUrl: "https://auth.example.test/api/auth",
        neonAuthIssuer: "https://auth.example.test",
      },
      () => ({ query }),
    );

    expect(query).toHaveBeenCalledWith(expect.stringContaining("neon_auth.session"), [
      "session-token",
    ]);
    expect(user).toMatchObject({
      id: "user-1",
      email: "maya@example.com",
      name: "Maya Silva",
      avatarUrl: "https://lh3.googleusercontent.com/a/avatar",
    });
  });
});
