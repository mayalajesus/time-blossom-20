import { describe, expect, it } from "vitest";
import { isUserUploadedAvatarUrl } from "../../src/lib/profile-image";

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
});
