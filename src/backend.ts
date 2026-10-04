import { createClient } from "@supabase/supabase-js";
import type { AppData, Profile } from "./types";
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
  return {
    data: validateBackup(data.data),
    revision: Number(data.revision),
    programPreferenceReady:
      typeof data.data?.settings?.useABSplit === "boolean",
  };
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
