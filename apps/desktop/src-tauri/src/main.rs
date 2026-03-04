#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use keyring::Entry;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

struct SidecarState {
    child: Mutex<Option<Child>>,
}

const AUTH_SERVICE: &str = "ai.openalpha.iclaw";
const AUTH_ACCESS_KEY: &str = "access_token";
const AUTH_REFRESH_KEY: &str = "refresh_token";

#[derive(Serialize, Deserialize, Clone)]
struct RuntimeConfig {
    openai_api_key: Option<String>,
    openai_base_url: Option<String>,
    openai_model: Option<String>,
    anthropic_api_key: Option<String>,
    clawhub_url: Option<String>,
}

#[derive(Serialize)]
struct RuntimeDiagnosis {
    sidecar_binary_found: bool,
    skills_dir_ready: bool,
    mcp_config_ready: bool,
    api_key_configured: bool,
    sidecar_path: Option<String>,
    skills_dir: String,
    mcp_config: String,
    work_dir: String,
    log_dir: String,
    cache_dir: String,
}

#[derive(Serialize)]
struct RuntimePaths {
    work_dir: String,
    log_dir: String,
    cache_dir: String,
}

#[derive(Serialize, Deserialize)]
struct StoredAuthTokens {
    access_token: String,
    refresh_token: String,
}

fn sidecar_binary_name() -> String {
    let arch = if cfg!(target_arch = "aarch64") {
        "aarch64"
    } else {
        "x86_64"
    };

    #[cfg(target_os = "macos")]
    let target = format!("{arch}-apple-darwin");
    #[cfg(target_os = "linux")]
    let target = format!("{arch}-unknown-linux-gnu");
    #[cfg(target_os = "windows")]
    let target = format!("{arch}-pc-windows-msvc");

    #[cfg(target_os = "windows")]
    {
        format!("openclaw-{target}.exe")
    }
    #[cfg(not(target_os = "windows"))]
    {
        format!("openclaw-{target}")
    }
}

fn find_sidecar_path(app: &AppHandle) -> Result<PathBuf, String> {
    let binary_name = sidecar_binary_name();

    let mut candidates: Vec<PathBuf> = Vec::new();
    candidates.push(Path::new(env!("CARGO_MANIFEST_DIR")).join("binaries").join(&binary_name));

    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.join("binaries").join(&binary_name));
        candidates.push(resource_dir.join(&binary_name));
    }

    for candidate in candidates {
        if candidate.exists() {
            return Ok(candidate);
        }
    }

    Err(format!("sidecar binary not found: {binary_name}"))
}

fn resource_skills_dir(app: &AppHandle) -> PathBuf {
    if let Ok(resource_dir) = app.path().resource_dir() {
        let p = resource_dir.join("resources").join("skills");
        if p.exists() {
            return p;
        }
    }
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("resources")
        .join("skills")
}

fn resource_mcp_config_path(app: &AppHandle) -> PathBuf {
    if let Ok(resource_dir) = app.path().resource_dir() {
        let p = resource_dir.join("resources").join("mcp").join("mcp.json");
        if p.exists() {
            return p;
        }
    }
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("resources")
        .join("mcp")
        .join("mcp.json")
}

fn app_data_base_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let p = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("failed to resolve app_data_dir: {e}"))?;
    Ok(p.join("openclaw"))
}

fn runtime_paths(app: &AppHandle) -> Result<RuntimePaths, String> {
    let base = app_data_base_dir(app)?;
    Ok(RuntimePaths {
        work_dir: base.join("work").to_string_lossy().to_string(),
        log_dir: base.join("logs").to_string_lossy().to_string(),
        cache_dir: base.join("skills-cache").to_string_lossy().to_string(),
    })
}

fn ensure_runtime_dirs(app: &AppHandle) -> Result<RuntimePaths, String> {
    let paths = runtime_paths(app)?;
    fs::create_dir_all(&paths.work_dir).map_err(|e| format!("failed to create work_dir: {e}"))?;
    fs::create_dir_all(&paths.log_dir).map_err(|e| format!("failed to create log_dir: {e}"))?;
    fs::create_dir_all(&paths.cache_dir).map_err(|e| format!("failed to create cache_dir: {e}"))?;
    Ok(paths)
}

fn runtime_config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app_data_base_dir(app)?;
    fs::create_dir_all(&base).map_err(|e| format!("failed to create app_data base dir: {e}"))?;
    Ok(base.join("config.json"))
}

fn resource_runtime_config_path(app: &AppHandle) -> PathBuf {
    if let Ok(resource_dir) = app.path().resource_dir() {
        let p = resource_dir
            .join("resources")
            .join("config")
            .join("runtime-config.json");
        if p.exists() {
            return p;
        }
    }

    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("resources")
        .join("config")
        .join("runtime-config.json")
}

fn load_runtime_config_internal(app: &AppHandle) -> Result<RuntimeConfig, String> {
    let config_path = runtime_config_path(app)?;
    if config_path.exists() {
        let raw = fs::read_to_string(&config_path).map_err(|e| format!("failed to read config: {e}"))?;
        return serde_json::from_str::<RuntimeConfig>(&raw)
            .map_err(|e| format!("failed to parse config: {e}"));
    }

    let default_path = resource_runtime_config_path(app);
    if default_path.exists() {
        let raw =
            fs::read_to_string(&default_path).map_err(|e| format!("failed to read default config: {e}"))?;
        return serde_json::from_str::<RuntimeConfig>(&raw)
            .map_err(|e| format!("failed to parse default config: {e}"));
    }

    Ok(RuntimeConfig {
        openai_api_key: None,
        openai_base_url: None,
        openai_model: None,
        anthropic_api_key: None,
        clawhub_url: None,
    })
}

#[tauri::command]
fn start_sidecar(
    app: AppHandle,
    state: State<'_, SidecarState>,
    args: Vec<String>,
) -> Result<bool, String> {
    let mut child_guard = state
        .child
        .lock()
        .map_err(|_| String::from("failed to lock sidecar state"))?;

    if child_guard.is_some() {
        return Ok(true);
    }

    let sidecar_path = find_sidecar_path(&app)?;
    let config = load_runtime_config_internal(&app)?;
    let paths = ensure_runtime_dirs(&app)?;
    let skills_dir = resource_skills_dir(&app);
    let mcp_config = resource_mcp_config_path(&app);

    let mut command = Command::new(sidecar_path);
    command.args(args);
    command.env("OPENCLAW_WORK_DIR", paths.work_dir);
    command.env("OPENCLAW_LOG_DIR", paths.log_dir);
    command.env("OPENCLAW_SKILLS_CACHE_DIR", paths.cache_dir);
    command.env("OPENCLAW_SKILLS_DIR", skills_dir);
    command.env("OPENCLAW_MCP_CONFIG", mcp_config);

    if let Some(v) = config.openai_api_key {
        if !v.trim().is_empty() {
            command.env("OPENAI_API_KEY", v);
        }
    }
    if let Some(v) = config.openai_base_url {
        if !v.trim().is_empty() {
            command.env("OPENAI_BASE_URL", &v);
            command.env("OPENAI_API_BASE", v);
        }
    }
    if let Some(v) = config.openai_model {
        if !v.trim().is_empty() {
            command.env("OPENAI_MODEL", v);
        }
    }
    if let Some(v) = config.anthropic_api_key {
        if !v.trim().is_empty() {
            command.env("ANTHROPIC_API_KEY", v);
        }
    }
    if let Some(v) = config.clawhub_url {
        if !v.trim().is_empty() {
            command.env("CLAWHUB_BASE_URL", v);
        }
    }

    let child = command
        .spawn()
        .map_err(|e| format!("failed to start sidecar: {e}"))?;
    *child_guard = Some(child);
    Ok(true)
}

#[tauri::command]
fn stop_sidecar(state: State<'_, SidecarState>) -> Result<bool, String> {
    let mut child_guard = state
        .child
        .lock()
        .map_err(|_| String::from("failed to lock sidecar state"))?;

    if let Some(mut child) = child_guard.take() {
        let _ = child.kill();
    }

    Ok(true)
}

#[tauri::command]
fn save_auth_tokens(access_token: String, refresh_token: String) -> Result<bool, String> {
    let access = Entry::new(AUTH_SERVICE, AUTH_ACCESS_KEY).map_err(|e| e.to_string())?;
    let refresh = Entry::new(AUTH_SERVICE, AUTH_REFRESH_KEY).map_err(|e| e.to_string())?;
    access.set_password(&access_token).map_err(|e| e.to_string())?;
    refresh
        .set_password(&refresh_token)
        .map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
fn load_auth_tokens() -> Result<Option<StoredAuthTokens>, String> {
    let access = Entry::new(AUTH_SERVICE, AUTH_ACCESS_KEY).map_err(|e| e.to_string())?;
    let refresh = Entry::new(AUTH_SERVICE, AUTH_REFRESH_KEY).map_err(|e| e.to_string())?;

    let access_token = match access.get_password() {
        Ok(v) => v,
        Err(keyring::Error::NoEntry) => return Ok(None),
        Err(e) => return Err(e.to_string()),
    };

    let refresh_token = match refresh.get_password() {
        Ok(v) => v,
        Err(keyring::Error::NoEntry) => return Ok(None),
        Err(e) => return Err(e.to_string()),
    };

    Ok(Some(StoredAuthTokens {
        access_token,
        refresh_token,
    }))
}

#[tauri::command]
fn clear_auth_tokens() -> Result<bool, String> {
    let access = Entry::new(AUTH_SERVICE, AUTH_ACCESS_KEY).map_err(|e| e.to_string())?;
    let refresh = Entry::new(AUTH_SERVICE, AUTH_REFRESH_KEY).map_err(|e| e.to_string())?;

    if let Err(e) = access.delete_password() {
        if !matches!(e, keyring::Error::NoEntry) {
            return Err(e.to_string());
        }
    }

    if let Err(e) = refresh.delete_password() {
        if !matches!(e, keyring::Error::NoEntry) {
            return Err(e.to_string());
        }
    }

    Ok(true)
}

#[tauri::command]
fn load_runtime_config(app: AppHandle) -> Result<RuntimeConfig, String> {
    load_runtime_config_internal(&app)
}

#[tauri::command]
fn save_runtime_config(app: AppHandle, config: RuntimeConfig) -> Result<bool, String> {
    let config_path = runtime_config_path(&app)?;
    let raw = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("failed to serialize config: {e}"))?;
    fs::write(&config_path, raw).map_err(|e| format!("failed to write config: {e}"))?;
    Ok(true)
}

#[tauri::command]
fn diagnose_runtime(app: AppHandle) -> Result<RuntimeDiagnosis, String> {
    let sidecar_path = find_sidecar_path(&app).ok();
    let skills_dir = resource_skills_dir(&app);
    let mcp_config = resource_mcp_config_path(&app);
    let paths = ensure_runtime_dirs(&app)?;
    let config = load_runtime_config_internal(&app)?;
    let api_key_configured = config
        .openai_api_key
        .as_deref()
        .map(|v| !v.trim().is_empty())
        .unwrap_or(false)
        || config
            .anthropic_api_key
            .as_deref()
            .map(|v| !v.trim().is_empty())
            .unwrap_or(false);

    Ok(RuntimeDiagnosis {
        sidecar_binary_found: sidecar_path.is_some(),
        skills_dir_ready: skills_dir.exists() && skills_dir.is_dir(),
        mcp_config_ready: mcp_config.exists() && mcp_config.is_file(),
        api_key_configured,
        sidecar_path: sidecar_path.map(|p| p.to_string_lossy().to_string()),
        skills_dir: skills_dir.to_string_lossy().to_string(),
        mcp_config: mcp_config.to_string_lossy().to_string(),
        work_dir: paths.work_dir,
        log_dir: paths.log_dir,
        cache_dir: paths.cache_dir,
    })
}

fn iclaw_settings_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app_data_base_dir(app)?;
    let dir = base.join("iclaw-settings");
    fs::create_dir_all(&dir).map_err(|e| format!("failed to create iclaw settings dir: {e}"))?;
    Ok(dir)
}

fn openclaw_workspace_dir(app: &AppHandle) -> PathBuf {
    if let Ok(home) = app.path().home_dir() {
        return home.join(".openclaw").join("openclaw-workspace");
    }
    PathBuf::from(".openclaw/openclaw-workspace")
}

fn value_str(settings: &serde_json::Value, path: &[&str], default: &str) -> String {
    let mut current = settings;
    for key in path {
        match current.get(*key) {
            Some(v) => current = v,
            None => return default.to_string(),
        }
    }
    current
        .as_str()
        .map(|s| s.to_string())
        .unwrap_or_else(|| default.to_string())
}

fn value_bool(settings: &serde_json::Value, path: &[&str], default: bool) -> bool {
    let mut current = settings;
    for key in path {
        match current.get(*key) {
            Some(v) => current = v,
            None => return default,
        }
    }
    current.as_bool().unwrap_or(default)
}

fn write_text(path: &Path, content: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("failed to create parent dir: {e}"))?;
    }
    fs::write(path, content).map_err(|e| format!("failed to write {}: {e}", path.to_string_lossy()))
}

fn apply_iclaw_settings_files(app: &AppHandle, settings: &serde_json::Value) -> Result<(), String> {
    let settings_dir = iclaw_settings_dir(app)?;
    let workspace_dir = openclaw_workspace_dir(app);
    fs::create_dir_all(&workspace_dir).map_err(|e| format!("failed to create workspace dir: {e}"))?;

    let identity_name = value_str(settings, &["identity", "assistantName"], "iClaw 助手");
    let identity_theme = value_str(settings, &["identity", "theme"], "专业");
    let identity_emoji = value_str(settings, &["identity", "emoji"], "🐾");
    let preferred_name = value_str(settings, &["userProfile", "preferredName"], "");
    let language = value_str(settings, &["userProfile", "language"], "中文");
    let timezone = value_str(settings, &["userProfile", "timezone"], "Asia/Shanghai");
    let work_role = value_str(settings, &["userProfile", "workRole"], "");
    let use_case = value_str(settings, &["userProfile", "primaryUseCase"], "");
    let response_length = value_str(settings, &["userProfile", "responseLengthPreference"], "中等");
    let tone = value_str(settings, &["soulPersona", "tone"], "平衡");
    let clarification = value_str(
        settings,
        &["soulPersona", "clarificationPolicy"],
        "不清楚时询问",
    );
    let risk = value_str(settings, &["soulPersona", "riskPolicy"], "保守");
    let decision = value_str(settings, &["soulPersona", "decisionStyle"], "协作式");
    let markdown = value_str(settings, &["soulPersona", "markdownContent"], "");
    let soul_md = if markdown.trim().is_empty() {
        format!(
            "# SOUL.md - Persona & Boundaries\n- Tone: {}\n- Clarification: {}\n- Risk policy: {}\n- Decision style: {}\n- Keep replies concise and direct.\n",
            tone, clarification, risk, decision
        )
    } else {
        markdown
    };

    let identity_md = format!(
        "# IDENTITY.md - Agent Identity\n- Name: {}\n- Theme: {}\n- Emoji: {}\n",
        identity_name, identity_theme, identity_emoji
    );
    let user_md = format!(
        "# USER.md - User Profile\n- Preferred name: {}\n- Language: {}\n- Timezone: {}\n- Work role: {}\n- Primary use case: {}\n- Response length preference: {}\n",
        preferred_name, language, timezone, work_role, use_case, response_length
    );
    let agents_md = format!(
        "# AGENTS.md - OpenClaw Workspace\nThis workspace is managed by iClaw settings.\n- Identity source: {}/IDENTITY.md\n- User source: {}/USER.md\n- Soul source: {}/SOUL.md\n",
        settings_dir.to_string_lossy(),
        settings_dir.to_string_lossy(),
        settings_dir.to_string_lossy()
    );
    let channel = value_str(settings, &["channelPreference", "defaultChannel"], "web");
    let sync_to_im = value_bool(settings, &["channelPreference", "syncToIM"], false);
    let safety_mode = value_str(settings, &["safetyDefaults", "systemRunMode"], "ask");
    let settings_json = serde_json::to_string_pretty(settings)
        .map_err(|e| format!("failed to serialize settings json: {e}"))?;
    let summary_md = format!(
        "# ICLAW_SETTINGS.md\n- channel.default: {}\n- channel.sync_to_im: {}\n- safety.system_run_mode: {}\n",
        channel, sync_to_im, safety_mode
    );

    for base in [&settings_dir, &workspace_dir] {
        write_text(&base.join("SOUL.md"), &soul_md)?;
        write_text(&base.join("IDENTITY.md"), &identity_md)?;
        write_text(&base.join("USER.md"), &user_md)?;
        write_text(&base.join("AGENTS.md"), &agents_md)?;
        write_text(&base.join("ICLAW_SETTINGS.md"), &summary_md)?;
    }
    write_text(&settings_dir.join("settings.json"), &settings_json)?;

    let bootstrap_path = workspace_dir.join("BOOTSTRAP.md");
    if bootstrap_path.exists() {
        let _ = fs::remove_file(bootstrap_path);
    }

    Ok(())
}

#[tauri::command]
fn save_iclaw_settings_and_apply(
    app: AppHandle,
    settings: serde_json::Value,
) -> Result<bool, String> {
    apply_iclaw_settings_files(&app, &settings)?;
    Ok(true)
}

fn main() {
    tauri::Builder::default()
        .manage(SidecarState {
            child: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            start_sidecar,
            stop_sidecar,
            save_auth_tokens,
            load_auth_tokens,
            clear_auth_tokens,
            load_runtime_config,
            save_runtime_config,
            diagnose_runtime,
            save_iclaw_settings_and_apply
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
