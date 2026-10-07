import type { ProfileIllustrations, ProfileIllustration } from "./types.ts";

export const DEFAULT_ILLUSTRATIONS: ProfileIllustrations = {
  dashboard: {
    image: null,
    desktop: { scale: 100, x: 0, y: 0 },
    phone: { scale: 100, x: 0, y: 0 },
  },
  menu: {
    image: null,
    desktop: { scale: 100, x: 0, y: 0 },
    phone: { scale: 100, x: 0, y: 0 },
  },
};
export function validateIllustrations(value: unknown): ProfileIllustrations {
  if (!value || typeof value !== "object")
    throw new Error("Invalid illustration settings.");
  const source = value as ProfileIllustrations;
  const result = {} as ProfileIllustrations;
  for (const target of ["dashboard", "menu"] as const) {
    const item = source[target];
    if (
      !item ||
      (item.image !== null &&
        (typeof item.image !== "string" ||
          item.image.length > 250000 ||
          !/^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/.test(item.image)))
    )
      throw new Error(
        "Choose a PNG, JPEG or WebP image within the size limit.",
      );
    result[target] = {
      image: item.image,
      desktop: { ...item.desktop },
      phone: { ...item.phone },
    };
    for (const mode of ["desktop", "phone"] as const) {
      const p = item[mode];
      if (
        !p ||
        !Number.isFinite(p.scale) ||
        p.scale < 60 ||
        p.scale > 150 ||
        !Number.isFinite(p.x) ||
        Math.abs(p.x) > 100 ||
        !Number.isFinite(p.y) ||
        Math.abs(p.y) > 100
      )
        throw new Error("Illustration position is outside the allowed range.");
    }
  }
  return result;
}
export function illustrationVariables(item: ProfileIllustration) {
  return {
    "--art-scale": item.desktop.scale / 100,
    "--art-x": `${item.desktop.x}px`,
    "--art-y": `${item.desktop.y}px`,
    "--art-phone-scale": item.phone.scale / 100,
    "--art-phone-x": `${item.phone.x}px`,
    "--art-phone-y": `${item.phone.y}px`,
  };
}

// Small, private, profile-scoped images; never included in workout backups.
export async function prepareIllustration(file: File): Promise<string> {
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > 5 * 1024 * 1024
  )
    throw new Error("Choose a PNG, JPEG or WebP image up to 5 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not read this image."));
      image.src = url;
    });
    const ratio = Math.min(
      1,
      512 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not prepare this image.");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.88, 0.75, 0.6]) {
      const encoded = canvas.toDataURL("image/webp", quality);
      if (
        encoded.startsWith("data:image/webp;base64,") &&
        encoded.length <= 250000
      )
        return encoded;
    }
    throw new Error("This image is too large. Try a simpler image.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
