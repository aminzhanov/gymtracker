import { readLanguage } from "./i18n";
import { createClient } from "@supabase/supabase-js";
import type { AppData, Profile, CoachMessages, TechniqueVideos } from "./types";
import { DEFAULT_MESSAGES, validateMessages } from "./messages";
import { driveVideoLink, normalizeTechniqueVideos } from "./technique";
import { emptyData, validateBackup } from "./model";
import {
  mergeLocalLibraries,
  exerciseNameKey,
  type SharedLibrary,
} from "./library";
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
  const [messageResult, nameResult, videoResult, library] = await Promise.all([
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
    loadSharedLibrary(owner),
  ]);
  const { data: messages, error: messagesError } = messageResult;
  const validated = validateBackup(data.data);
  return {
    data: {
      ...validated,
      settings: {
        ...validated.settings,
        language:
          data.data?.settings?.language ??
          readLanguage(`liftlog-language:${owner}`),
      },
      ...(library ? { exercises: library.exercises } : {}),
    },
    languageReady: data.languageReady === true,
    sharedLibraryReady: Boolean(library),
    revision: Number(data.revision),
    programPreferenceReady:
      typeof data.data?.settings?.useABSplit === "boolean",
    trainingWeeksReady: data.trainingWeeksReady === true,
    messages: messages
      ? {
          appName: nameResult.data?.app_name || DEFAULT_MESSAGES.appName,
          dashboard: messages.dashboard_message,
          sidebar: messages.sidebar_message,
        }
      : DEFAULT_MESSAGES,
    messagesReady: !messagesError,
    appNameReady: !nameResult.error,
    techniqueVideos:
      library?.techniqueVideos ??
      (Object.fromEntries(
        (videoResult.data || []).map((video) => [
          video.exercise_id,
          driveVideoLink(
            `https://drive.google.com/file/d/${video.drive_file_id}/view${video.resource_key ? `?resourcekey=${video.resource_key}` : ""}`,
          ).url,
        ]),
      ) as TechniqueVideos),
    techniqueVideosReady: Boolean(library) || !videoResult.error,
  };
}
export async function loadSharedLibrary(
  owner: string,
): Promise<SharedLibrary | null> {
  const { data, error } = await supabase!.rpc("load_exercise_library", {
    target_owner: owner,
  });
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") return null;
    throw error;
  }
  return {
    exercises: data.exercises,
    techniqueVideos: Object.fromEntries(
      data.videos.map(
        (video: {
          exercise_id: string;
          drive_file_id: string;
          resource_key: string | null;
        }) => [
          video.exercise_id,
          driveVideoLink(
            `https://drive.google.com/file/d/${video.drive_file_id}/view${video.resource_key ? `?resourcekey=${video.resource_key}` : ""}`,
          ).url,
        ],
      ),
    ),
  };
}
export async function addSharedExercise(
  owner: string,
  name: string,
  id: string,
) {
  const { data, error } = await supabase!.rpc("add_shared_exercise", {
    target_owner: owner,
    exercise_name: name,
    client_id: id,
  });
  if (error) throw error;
  return data as string;
}
export async function archiveSharedExercise(owner: string, exerciseId: string) {
  const { error } = await supabase!.rpc("archive_shared_exercise", {
    target_owner: owner,
    target_exercise: exerciseId,
    is_archived: true,
  });
  if (error) throw error;
}
function demoLibraryState() {
  return JSON.parse(
    localStorage.getItem("liftlog-demo-shared-library") ||
      '{"videos":{},"archived":[]}',
  ) as { videos: Record<string, string>; archived: string[] };
}
export function loadLocalSharedLibrary(owner: string) {
  const state = demoLibraryState();
  return mergeLocalLibraries(
    DEMO_PROFILES.map((p) => ({
      owner: p.id,
      data: loadLocal(p.id, p.name),
      videos: loadLocalTechniqueVideos(p.id),
    })),
    owner,
    state.videos,
    state.archived,
  );
}
export function saveLocalSharedVideo(
  owner: string,
  exerciseId: string,
  url: string,
) {
  const state = demoLibraryState();
  const member = DEMO_PROFILES.find((p) => p.id === owner)!;
  const data = loadLocal(owner, member.name);
  const shared = loadLocalSharedLibrary(owner);
  const name =
    shared.exercises.find((e) => e.id === exerciseId)?.name ??
    data.sessions
      .flatMap((s) => s.exercises)
      .find((e) => e.exerciseId === exerciseId)?.name;
  if (name) state.videos[exerciseNameKey(name)] = url;
  else {
    const videos = loadLocalTechniqueVideos(owner);
    if (url) videos[exerciseId] = url;
    else delete videos[exerciseId];
    localStorage.setItem(
      `liftlog-technique-videos-${owner}`,
      JSON.stringify(videos),
    );
  }
  localStorage.setItem("liftlog-demo-shared-library", JSON.stringify(state));
}
export function setLocalLibraryArchive(name: string, archived: boolean) {
  const state = demoLibraryState();
  const key = exerciseNameKey(name);
  state.archived = state.archived.filter((old) => old !== key);
  if (archived) state.archived.push(key);
  localStorage.setItem("liftlog-demo-shared-library", JSON.stringify(state));
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
