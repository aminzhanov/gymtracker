/** Only embed canonical Google Drive file URLs, never arbitrary user HTML/URLs. */
export function driveVideoLink(value: string) {
  const fail = () => {
    throw new Error(
      "Paste a Google Drive video file link (https://drive.google.com/file/d/…).",
    );
  };
  if (typeof value !== "string" || value.length > 2000) return fail();
  let input: URL;
  try {
    input = new URL(value.trim());
  } catch {
    return fail();
  }
  if (
    input.protocol !== "https:" ||
    input.hostname !== "drive.google.com" ||
    input.port ||
    input.username ||
    input.password
  )
    return fail();
  const match = input.pathname.match(
    /^\/file\/d\/([^/]+)(?:\/(?:view|preview))?\/?$/,
  );
  const fileId =
    match?.[1] ||
    (/^\/(?:open|uc)\/?$/.test(input.pathname)
      ? input.searchParams.get("id")
      : null);
  const resourceKey = input.searchParams.get("resourcekey") || "";
  if (
    !fileId ||
    !/^[A-Za-z0-9_-]{10,200}$/.test(fileId) ||
    (resourceKey && !/^[A-Za-z0-9_-]{1,200}$/.test(resourceKey))
  )
    return fail();
  const suffix = resourceKey ? `?resourcekey=${resourceKey}` : "";
  return {
    fileId,
    resourceKey,
    url: `https://drive.google.com/file/d/${fileId}/view${suffix}`,
    embedUrl: `https://drive.google.com/file/d/${fileId}/preview${suffix}`,
  };
}

export function normalizeTechniqueVideos(
  value: unknown,
): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid technique videos.");
  return Object.fromEntries(
    Object.entries(value).map(([id, url]) => {
      if (!id || typeof url !== "string")
        throw new Error("Invalid technique videos.");
      return [id, driveVideoLink(url).url];
    }),
  );
}
