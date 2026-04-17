use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::thread;
use std::time::Duration;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use serde::{Deserialize, Serialize};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, WindowEvent,
};

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

fn running_riot_processes() -> Vec<&'static str> {
    let mut cmd = Command::new("tasklist");
    cmd.args(["/FO", "CSV", "/NH"]);
    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    let output = match cmd.output() {
        Ok(o) => o,
        // If tasklist fails, fall back to the conservative "assume all running"
        Err(_) => return RIOT_PROCESSES.to_vec(),
    };
    let stdout = String::from_utf8_lossy(&output.stdout);
    RIOT_PROCESSES
        .iter()
        .copied()
        .filter(|name| {
            let needle = format!("\"{}.exe\"", name);
            stdout.contains(&needle)
        })
        .collect()
}

fn stop_riot_processes() {
    let running = running_riot_processes();
    if running.is_empty() {
        return;
    }
    // Single taskkill invocation with one /IM per running process
    let mut cmd = Command::new("taskkill");
    cmd.arg("/F");
    for name in &running {
        cmd.args(["/IM", &format!("{}.exe", name)]);
    }
    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000);
    cmd.output().ok();
    // Poll until processes are gone or timeout. taskkill /F frees file locks
    // almost immediately after the process dies, so 500ms is plenty in practice.
    let deadline = std::time::Instant::now() + Duration::from_millis(500);
    while std::time::Instant::now() < deadline {
        if running_riot_processes().is_empty() {
            return;
        }
        thread::sleep(Duration::from_millis(50));
    }
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
    Ok(format!("Profile '{}' saved", name))
}

#[tauri::command]
fn delete_profile(name: String) -> Result<String, String> {
    let dest = profiles_dir().join(&name);
    if dest.exists() {
        fs::remove_dir_all(&dest).map_err(|e| e.to_string())?;
    }
    Ok(format!("Profile '{}' deleted", name))
}

#[tauri::command]
fn launch_profile(name: String) -> Result<String, String> {
    let config = load_config();
    if config.riot_client_exe.is_empty() {
        return Err("Riot Client path not configured".to_string());
    }
    let src = profiles_dir().join(&name);
    if !src.exists() {
        return Err(format!("Profile '{}' does not exist", name));
    }
    stop_riot_processes();
    copy_session_files(&src, &riot_root())?;
    Command::new(&config.riot_client_exe)
        .args(["--launch-product=league_of_legends", "--launch-patchline=live"])
        .spawn()
        .map_err(|e| format!("Error launching Riot Client: {}", e))?;
    Ok(format!("Launched LoL with '{}'", name))
}

#[tauri::command]
fn close_riot() -> Result<String, String> {
    stop_riot_processes();
    Ok("Closed".to_string())
}

#[tauri::command]
fn prepare_add() -> Result<String, String> {
    let config = load_config();
    if config.riot_client_exe.is_empty() {
        return Err("Riot Client path not configured".to_string());
    }
    stop_riot_processes();
    clear_session_files();
    Command::new(&config.riot_client_exe)
        .spawn()
        .map_err(|e| format!("Error opening Riot Client: {}", e))?;
    Ok("Riot Client opened. Log in with Stay signed in.".to_string())
}

#[tauri::command]
fn get_config() -> AppConfig {
    load_config()
}

#[tauri::command]
fn set_riot_path(path: String) -> Result<String, String> {
    let exe = PathBuf::from(&path).join("RiotClientServices.exe");
    if !exe.exists() {
        return Err(format!("RiotClientServices.exe not found at {}", path));
    }
    let mut config = load_config();
    config.riot_client_exe = exe.to_string_lossy().to_string();
    save_config(&config)?;
    Ok("Path saved".to_string())
}

#[tauri::command]
fn auto_detect_riot() -> Result<String, String> {
    let candidates = vec![
        "C:\\Riot Games\\Riot Client",
        "D:\\Riot Games\\Riot Client",
        "C:\\Program Files\\Riot Games\\Riot Client",
        "C:\\Program Files (x86)\\Riot Games\\Riot Client",
        "D:\\Program Files\\Riot Games\\Riot Client",
    ];
    for path in candidates {
        let exe = std::path::PathBuf::from(path).join("RiotClientServices.exe");
        if exe.exists() {
            let mut config = load_config();
            config.riot_client_exe = exe.to_string_lossy().to_string();
            save_config(&config).ok();
            return Ok(path.to_string());
        }
    }
    Err("No se encontró el Riot Client automáticamente".to_string())
}

#[tauri::command]
fn set_reference_profile(name: String) -> Result<String, String> {
    let mut config = load_config();
    config.reference_profile = name.clone();
    save_config(&config)?;
    Ok(format!("Reference profile: {}", name))
}

// --- System Tray ---

fn profile_names() -> Vec<String> {
    list_profiles().into_iter().map(|p| p.name).collect()
}

fn build_tray_menu(app: &AppHandle, profiles: &[String]) -> tauri::Result<Menu<tauri::Wry>> {
    let menu = Menu::new(app)?;
    if profiles.is_empty() {
        let empty = MenuItem::with_id(app, "noop", "(No profiles)", false, None::<&str>)?;
        menu.append(&empty)?;
    } else {
        for name in profiles {
            let item = MenuItem::with_id(
                app,
                format!("launch:{}", name),
                format!("Launch  {}", name),
                true,
                None::<&str>,
            )?;
            menu.append(&item)?;
        }
    }
    menu.append(&PredefinedMenuItem::separator(app)?)?;
    let kill = MenuItem::with_id(app, "kill", "Kill all", true, None::<&str>)?;
    menu.append(&kill)?;
    menu.append(&PredefinedMenuItem::separator(app)?)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    menu.append(&quit)?;
    Ok(menu)
}

#[tauri::command]
fn rebuild_tray(app: AppHandle) -> Result<(), String> {
    let names = profile_names();
    let menu = build_tray_menu(&app, &names).map_err(|e| e.to_string())?;
    if let Some(tray) = app.tray_by_id("main") {
        tray.set_menu(Some(menu)).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn show_main_window(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

fn handle_tray_menu(app: &AppHandle, id: &str) {
    match id {
        "kill" => {
            let _ = close_riot();
            let _ = app.emit("tray:closed-all", ());
        }
        "show" => show_main_window(app),
        "quit" => app.exit(0),
        other => {
            if let Some(name) = other.strip_prefix("launch:") {
                let name = name.to_string();
                let app_handle = app.clone();
                // Launch off the main thread — stop_riot_processes sleeps 1.2s
                thread::spawn(move || {
                    match launch_profile(name.clone()) {
                        Ok(_) => {
                            let _ = app_handle.emit("tray:launched", name);
                        }
                        Err(e) => {
                            let _ = app_handle.emit("tray:error", e);
                        }
                    }
                });
            }
        }
    }
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
            auto_detect_riot,
            rebuild_tray,
        ])
        .setup(|app| {
            let menu = build_tray_menu(app.handle(), &profile_names())?;
            let icon = app
                .default_window_icon()
                .cloned()
                .expect("default window icon missing");
            TrayIconBuilder::with_id("main")
                .icon(icon)
                .tooltip("LoL Account Switcher")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| {
                    handle_tray_menu(app, event.id.as_ref());
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                })
                .build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
