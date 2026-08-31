import { describe, expect, it } from "vitest";
import { extractAuthIdentity, trustedGoogleAvatarUrl } from "../../server/auth-profile.mjs";

describe("OAuth profile extraction", () => {
  it("extracts Google first name, last name, email and photo", () => {
    expect(
      extractAuthIdentity({
        id: "google-user",
        email: " MAYA@EXAMPLE.COM ",
        metadata: {
          given_name: "Maya",
          family_name: "Silva",
          full_name: "Ignored Fallback",
          picture: "https://lh3.googleusercontent.com/a/profile-photo",
        },
      }),
    ).toEqual({
      id: "google-user",
      email: "maya@example.com",
      name: "Maya Silva",
      firstName: "Maya",
      lastName: "Silva",
      avatarUrl: "https://lh3.googleusercontent.com/a/profile-photo",
    });
  });

  it("accepts only HTTPS Google-hosted profile photos", () => {
    expect(trustedGoogleAvatarUrl("https://lh3.googleusercontent.com/a/photo")).toBe(
      "https://lh3.googleusercontent.com/a/photo",
    );
    expect(trustedGoogleAvatarUrl("http://lh3.googleusercontent.com/a/photo")).toBeNull();
    expect(trustedGoogleAvatarUrl("https://example.com/photo.jpg")).toBeNull();
  });
});
