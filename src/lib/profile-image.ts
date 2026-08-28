export const MAX_AVATAR_FILE_SIZE = 1_000_000;
const MAX_AVATAR_DIMENSION = 256;
const SUPPORTED_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export type AvatarImageError = "type" | "size" | "read";

export async function prepareAvatarImage(file: File): Promise<string> {
  if (!SUPPORTED_AVATAR_TYPES.has(file.type)) {
    throw new Error("type" satisfies AvatarImageError);
  }
  if (file.size > MAX_AVATAR_FILE_SIZE) {
    throw new Error("size" satisfies AvatarImageError);
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("read" satisfies AvatarImageError));
      element.src = objectUrl;
    });

    const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
    if (!longestSide) throw new Error("read" satisfies AvatarImageError);
    const scale = Math.min(1, MAX_AVATAR_DIMENSION / longestSide);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("read" satisfies AvatarImageError);

    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.84);
    if (!dataUrl.startsWith("data:image/jpeg;base64,")) {
      throw new Error("read" satisfies AvatarImageError);
    }
    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
