import { invoke } from "@tauri-apps/api/core";

export interface ProfileInfo {
  name: string;
}

export interface AppConfig {
  riot_client_exe: string;
  reference_profile: string;
}

export const api = {
  listProfiles: () => invoke<ProfileInfo[]>("list_profiles"),
  saveProfile: (name: string) => invoke<string>("save_profile", { name }),
  deleteProfile: (name: string) => invoke<string>("delete_profile", { name }),
  launchProfile: (name: string) => invoke<string>("launch_profile", { name }),
  closeRiot: () => invoke<string>("close_riot"),
  prepareAdd: () => invoke<string>("prepare_add"),
  getConfig: () => invoke<AppConfig>("get_config"),
  setRiotPath: (path: string) => invoke<string>("set_riot_path", { path }),
  setReferenceProfile: (name: string) =>
    invoke<string>("set_reference_profile", { name }),
  autoDetectRiot: () => invoke<string>("auto_detect_riot"),

};
