import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const signup = readFileSync(new URL("../../src/routes/signup.tsx", import.meta.url), "utf8");
const login = readFileSync(new URL("../../src/routes/login.tsx", import.meta.url), "utf8");
const auth = readFileSync(new URL("../../src/lib/auth.ts", import.meta.url), "utf8");

describe("account creation requirements", () => {
  it("requires first name, last name, email and password before signup", () => {
    expect(signup).toContain('id="signup-first-name"');
    expect(signup).toContain('id="signup-last-name"');
    expect(signup).toContain('id="signup-email"');
    expect(signup).toContain('id="signup-password"');
    expect(signup).toContain("normalizedFirstName");
    expect(signup).toContain("normalizedLastName");
    expect(signup).toContain("normalizedEmail");
    expect(signup).toContain("GoogleAuthButton");
    expect(login).toContain("GoogleAuthButton");
  });

  it("sends the required full name to the authentication provider", () => {
    expect(auth).toContain("data: { name, displayName: name");
    expect(auth).toContain("firstName: firstName.trim()");
    expect(auth).toContain("lastName: lastName.trim()");
  });

  it("preserves the requested destination during Google OAuth", () => {
    expect(auth).toContain('redirect.searchParams.set("redirect", getAuthReturnPath())');
    expect(auth).toContain('provider: "google"');
  });
});
