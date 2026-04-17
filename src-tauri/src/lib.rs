use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::thread;
use std::time::Duration;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use serde::{Deserialize, Serialize};

// --- Paths ---

fn profiles_dir() -> PathBuf {
    dirs::home_dir()
        .expect("No home dir")
        .join(".lol-profiles")
}

fn config_file() -> PathBuf {
    profiles_dir().join("_config.json")
}

fn riot_root() -> PathBuf {
    dirs::data_local_dir()
        .expect("No local app data")
        .join("Riot Games")
        .join("Riot Client")
}

// Session files to copy (relative to riot root)
const SESSION_FILES: &[&str] = &[
    "Data\\RiotGamesPrivateSettings.yaml",
    "Data\\ShutdownData.yaml",
    "Config\\RiotClientSettings.yaml",
    "Config\\ClientConfiguration.json",
];

// Riot process names to kill
const RIOT_PROCESSES: &[&str] = &[
    "RiotClientServices",
    "RiotClientUx",
    "RiotClientUxRender",
    "LeagueClient",
    "LeagueClientUx",
    "LeagueClientUxRender",
];

// --- Config ---

#[derive(Serialize, Deserialize, Default)]
struct AppConfig {
    riot_client_exe: String,
    reference_profile: String,
}

fn load_config() -> AppConfig {
    let path = config_file();
    if path.exists() {
        let data = fs::read_to_string(&path).unwrap_or_default();
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        AppConfig::default()
    }
}

fn save_config(config: &AppConfig) -> Result<(), String> {
    let path = config_file();
    let data = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(&path, data).map_err(|e| e.to_string())?;
    Ok(())
}

// --- Profile info ---

#[derive(Serialize)]
pub struct ProfileInfo {
    name: String,
}

// --- Helper functions ---

fn ensure_profiles_dir() {
    let dir = profiles_dir();
    if !dir.exists() {
        fs::create_dir_all(&dir).ok();
    }
}

fn copy_session_files(from: &PathBuf, to: &PathBuf) -> Result<(), String> {
    for rel in SESSION_FILES {
        let src = from.join(rel);
        let dst = to.join(rel);
        if src.exists() {
            if let Some(parent) = dst.parent() {
                fs::create_dir_all(parent).map_err(|e| format!("mkdir {}: {}", parent.display(), e))?;
            }
            fs::copy(&src, &dst).map_err(|e| format!("copy {} -> {}: {}", src.display(), dst.display(), e))?;
        }
    }
    Ok(())
}

fn clear_session_files() {
    let root = riot_root();
    for rel in SESSION_FILES {
        let f = root.join(rel);
        if f.exists() {
            fs::remove_file(&f).ok();
        }
    }
}

fn stop_riot_processes() {
    for name in RIOT_PROCESSES {
        let mut cmd = Command::new("taskkill");
        cmd.args(["/F", "/IM", &format!("{}.exe", name)]);
        #[cfg(target_os = "windows")]
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        cmd.output().ok();
    }
    thread::sleep(Duration::from_millis(1200));
}

fn apply_reference_configs(profile_dir: &PathBuf) -> Result<(), String> {
    let config = load_config();
    if config.reference_profile.is_empty() {
        return Ok(());
    }
    let ref_dir = profiles_dir().join(&config.reference_profile);
    if !ref_dir.exists() {
        return Ok(());
    }
    // Copy all session files EXCEPT the auth token
    let config_files = &[
        "Config\\RiotClientSettings.yaml",
        "Config\\ClientConfiguration.json",
        "Data\\ShutdownData.yaml",
    ];
    for rel in config_files {
        let src = ref_dir.join(rel);
        let dst = profile_dir.join(rel);
        if src.exists() {
            if let Some(parent) = dst.parent() {
                fs::create_dir_all(parent).ok();
            }
            fs::copy(&src, &dst).map_err(|e| format!("ref copy: {}", e))?;
        }
    }
    Ok(())
}

// --- Tauri Commands ---

#[tauri::command]
fn list_profiles() -> Vec<ProfileInfo> {
    ensure_profiles_dir();
    let dir = profiles_dir();
    let mut profiles = Vec::new();
    if let Ok(entries) = fs::read_dir(&dir) {
        for entry in entries.flatten() {
            if entry.path().is_dir() {
                let name = entry.file_name().to_string_lossy().to_string();
                if !name.starts_with('_') {
                    profiles.push(ProfileInfo { name });
                }
            }
        }
    }
    profiles.sort_by(|a, b| a.name.cmp(&b.name));
    profiles
}

#[tauri::command]
fn save_profile(name: String) -> Result<String, String> {
    ensure_profiles_dir();
    let dest = profiles_dir().join(&name);
    fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
    copy_session_files(&riot_root(), &dest)?;
    apply_reference_configs(&dest)?;
    Ok(format!("Perfil '{}' guardado", name))
}

#[tauri::command]
fn delete_profile(name: String) -> Result<String, String> {
    let dest = profiles_dir().join(&name);
    if dest.exists() {
        fs::remove_dir_all(&dest).map_err(|e| e.to_string())?;
    }
    Ok(format!("Perfil '{}' eliminado", name))
}

#[tauri::command]
fn launch_profile(name: String) -> Result<String, String> {
    let config = load_config();
    if config.riot_client_exe.is_empty() {
        return Err("Ruta del Riot Client no configurada".to_string());
    }
    let src = profiles_dir().join(&name);
    if !src.exists() {
        return Err(format!("No existe el perfil '{}'", name));
    }
    stop_riot_processes();
    copy_session_files(&src, &riot_root())?;
    Command::new(&config.riot_client_exe)
        .args(["--launch-product=league_of_legends", "--launch-patchline=live"])
        .spawn()
        .map_err(|e| format!("Error lanzando Riot Client: {}", e))?;
    Ok(format!("Lanzado LoL con '{}'", name))
}

#[tauri::command]
fn close_riot() -> Result<String, String> {
    stop_riot_processes();
    Ok("Cerrado".to_string())
}

#[tauri::command]
fn prepare_add() -> Result<String, String> {
    let config = load_config();
    if config.riot_client_exe.is_empty() {
        return Err("Ruta del Riot Client no configurada".to_string());
    }
    stop_riot_processes();
    clear_session_files();
    Command::new(&config.riot_client_exe)
        .spawn()
        .map_err(|e| format!("Error abriendo Riot Client: {}", e))?;
    Ok("Riot Client abierto. Haz login con Stay signed in.".to_string())
}

#[tauri::command]
fn get_config() -> AppConfig {
    load_config()
}

#[tauri::command]
fn set_riot_path(path: String) -> Result<String, String> {
    let exe = PathBuf::from(&path).join("RiotClientServices.exe");
    if !exe.exists() {
        return Err(format!("No se encontro RiotClientServices.exe en {}", path));
    }
    let mut config = load_config();
    config.riot_client_exe = exe.to_string_lossy().to_string();
    save_config(&config)?;
    Ok("Ruta guardada".to_string())
}

#[tauri::command]
fn set_reference_profile(name: String) -> Result<String, String> {
    let mut config = load_config();
    config.reference_profile = name.clone();
    save_config(&config)?;
    Ok(format!("Perfil de referencia: {}", name))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            list_profiles,
            save_profile,
            delete_profile,
            launch_profile,
            close_riot,
            prepare_add,
            get_config,
            set_riot_path,
            set_reference_profile,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
