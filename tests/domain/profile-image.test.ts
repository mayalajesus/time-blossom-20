import { describe, expect, it } from "vitest";
import { getGoogleProfileAvatarUrl, isUserUploadedAvatarUrl } from "../../src/lib/profile-image";

describe("profile image source", () => {
  it("recognizes profile photos uploaded by the user", () => {
    expect(isUserUploadedAvatarUrl("data:image/jpeg;base64,YXZhdGFy")).toBe(true);
    expect(
      isUserUploadedAvatarUrl(
        "https://example.supabase.co/storage/v1/object/sign/avatars/user/avatar.jpg?token=token",
      ),
    ).toBe(true);
  });

  it("does not treat external or default avatars as user uploads", () => {
    expect(isUserUploadedAvatarUrl("https://lh3.googleusercontent.com/a/profile-photo")).toBe(
      false,
    );
    expect(
      isUserUploadedAvatarUrl(
        "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/blue.jpg",
      ),
    ).toBe(false);
    expect(isUserUploadedAvatarUrl(null)).toBe(false);
  });

  it("finds only trusted Google photos in provider metadata", () => {
    expect(
      getGoogleProfileAvatarUrl({ picture: "https://lh3.googleusercontent.com/a/photo" }),
    ).toBe("https://lh3.googleusercontent.com/a/photo");
    expect(getGoogleProfileAvatarUrl({ image: "https://googleusercontent.com/a/neon-photo" })).toBe(
      "https://googleusercontent.com/a/neon-photo",
    );
    expect(
      getGoogleProfileAvatarUrl({ avatar_url: "https://googleusercontent.com.evil.test/photo" }),
    ).toBeNull();
    expect(
      getGoogleProfileAvatarUrl({ picture: "http://lh3.googleusercontent.com/photo" }),
    ).toBeNull();
  });
});
