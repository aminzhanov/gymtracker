import { createClient } from "@supabase/supabase-js";
import type { AppData, Profile, CoachMessages, TechniqueVideos } from "./types";
import { DEFAULT_MESSAGES, validateMessages } from "./messages";
import { driveVideoLink, normalizeTechniqueVideos } from "./technique";
import { emptyData, validateBackup } from "./model";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = url && key ? createClient(url, key) : null;
export async function loadProfiles(): Promise<Profile[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id,name,role,active")
    .order("name");
  if (error) throw error;
  return data;
}
export async function loadCloud(owner: string) {
  const { data, error } = await supabase!.rpc("load_training_data", {
    target_owner: owner,
  });
  if (error) throw error;
  const [messageResult, nameResult, videoResult] = await Promise.all([
    supabase!
      .from("coach_messages")
      .select("dashboard_message,sidebar_message")
      .eq("owner_user_id", owner)
      .maybeSingle(),
    supabase!
      .from("coach_messages")
      .select("app_name")
      .eq("owner_user_id", owner)
      .maybeSingle(),
    supabase!
      .from("exercise_technique_videos")
      .select("exercise_id,drive_file_id,resource_key")
      .eq("owner_user_id", owner),
  ]);
  const { data: messages, error: messagesError } = messageResult;
  return {
    data: validateBackup(data.data),
    revision: Number(data.revision),
    programPreferenceReady:
      typeof data.data?.settings?.useABSplit === "boolean",
    messages: messages
      ? {
          appName: nameResult.data?.app_name || DEFAULT_MESSAGES.appName,
          dashboard: messages.dashboard_message,
          sidebar: messages.sidebar_message,
        }
      : DEFAULT_MESSAGES,
    messagesReady: !messagesError,
    appNameReady: !nameResult.error,
    techniqueVideos: Object.fromEntries(
      (videoResult.data || []).map((video) => [
        video.exercise_id,
        driveVideoLink(
          `https://drive.google.com/file/d/${video.drive_file_id}/view${video.resource_key ? `?resourcekey=${video.resource_key}` : ""}`,
        ).url,
      ]),
    ) as TechniqueVideos,
    techniqueVideosReady: !videoResult.error,
  };
}
export function loadLocalTechniqueVideos(owner: string): TechniqueVideos {
  try {
    const raw = localStorage.getItem(`liftlog-technique-videos-${owner}`);
    return raw ? normalizeTechniqueVideos(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}
export async function saveTechniqueVideo(
  owner: string,
  exerciseId: string,
  url: string,
) {
  const video = url.trim() ? driveVideoLink(url) : null;
  const { error } = await supabase!.rpc("save_technique_video", {
    target_owner: owner,
    target_exercise: exerciseId,
    drive_file: video?.fileId || null,
    drive_resource_key: video?.resourceKey || null,
  });
  if (error) throw error;
}
export async function saveCoachMessages(
  owner: string,
  messages: CoachMessages,
  appNameReady: boolean,
) {
  const validated = validateMessages(messages);
  const { error } = await supabase!.rpc("save_coach_messages", {
    ...(appNameReady ? { app_name: validated.appName } : {}),
    target_owner: owner,
    dashboard_message: validated.dashboard,
    sidebar_message: validated.sidebar,
  });
  if (error) throw error;
}
export function loadLocalMessages(owner: string): CoachMessages {
  try {
    const raw = localStorage.getItem(`liftlog-messages-${owner}`);
    return raw ? validateMessages(JSON.parse(raw)) : DEFAULT_MESSAGES;
  } catch {
    return DEFAULT_MESSAGES;
  }
}
export async function saveCloud(
  owner: string,
  payload: AppData,
  revision: number,
) {
  const { data, error } = await supabase!.rpc("save_training_data", {
    target_owner: owner,
    payload,
    expected_revision: revision,
  });
  if (error) throw error;
  return Number(data);
}
export const DEMO_PROFILES: Profile[] = [
  { id: "demo-self", name: "Aleksei", role: "coach", active: true },
  { id: "demo-maya", name: "Maya", role: "athlete", active: true },
  { id: "demo-ben", name: "Ben", role: "athlete", active: true },
];
export function loadLocal(owner: string, name: string) {
  const raw = localStorage.getItem(`liftlog-v1-${owner}`);
  return raw ? validateBackup(JSON.parse(raw)) : emptyData(name);
}
