import type { CoachMessages } from "./types.ts";
export const DEFAULT_MESSAGES: CoachMessages = {
  dashboard: "Ready to move today?",
  sidebar: "Strong friends.\nStronger days.",
};
export function validateMessages(value: unknown): CoachMessages {
  const messages = value as CoachMessages;
  if (
    !messages ||
    typeof messages.dashboard !== "string" ||
    typeof messages.sidebar !== "string" ||
    !messages.dashboard.trim() ||
    !messages.sidebar.trim() ||
    messages.dashboard.length > 180 ||
    messages.sidebar.length > 120
  )
    throw new Error("Enter both messages within their character limits.");
  return {
    dashboard: messages.dashboard.trim(),
    sidebar: messages.sidebar.trim(),
  };
}
