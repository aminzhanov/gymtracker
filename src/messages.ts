import type { CoachMessages } from "./types.ts";
export const DEFAULT_MESSAGES: CoachMessages = {
  appName: "LiftLog",
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
  const appName = messages.appName === undefined ? "LiftLog" : messages.appName;
  if (
    typeof appName !== "string" ||
    !appName.trim() ||
    appName.trim().length > 40 ||
    /[\r\n]/.test(appName)
  )
    throw new Error("Enter an app name of 1–40 characters on one line.");
  return {
    appName: appName.trim(),
    dashboard: messages.dashboard.trim(),
    sidebar: messages.sidebar.trim(),
  };
}
