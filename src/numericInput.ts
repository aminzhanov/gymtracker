export function counterValue(
  text: string,
  step: number,
  max: number,
): number | null {
  const trimmed = text.trim().replace(",", ".");
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0 || n > max) return null;
  return step === 1 ? Math.round(n) : n;
}
export function stepCounter(value: number, step: number, max: number) {
  return Math.max(0, Math.min(max, Math.round((value + step) * 100) / 100));
}
