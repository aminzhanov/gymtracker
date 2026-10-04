export function bodyweightDomain(values: number[]): [number, number] {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return [0, 1];
  const low = Math.min(...finite),
    high = Math.max(...finite);
  const padding = Math.max((high - low) * 0.25, high * 0.015, 0.5);
  return [Math.max(0.01, low - padding), high + padding];
}

export function readExerciseSelection(
  storage: Pick<Storage, "getItem">,
  key: string,
): string[] {
  try {
    const raw = storage.getItem(key);
    if (raw === null) return ["default-0"];
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((v) => typeof v === "string"))
      return [...new Set(parsed)];
  } catch {
    /* Keep the chart usable when storage is unavailable. */
  }
  return ["default-0"];
}
