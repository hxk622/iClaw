#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use base64::Engine;
use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use flate2::Compression;
use keyring::Entry;
use rand::rngs::OsRng;
use rand::RngCore;
use reqwest::{blocking::Client, Url};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::env;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::net::TcpListener;
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::process::{Child, Command};
use std::sync::Mutex;
use std::time::Duration;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, State, WindowEvent};
use tauri_plugin_updater::UpdaterExt;
use zip::ZipArchive;

use rfd::FileDialog;

struct SidecarState {
    child: Mutex<Option<Child>>,
}

struct DesktopUpdateState {
    pending: Mutex<Option<tauri_plugin_updater::Update>>,
}

const AUTH_SERVICE: &str = match option_env!("ICLAW_AUTH_SERVICE") {
    Some(value) => value,
    None => "ai.iclaw.desktop",
};
const DESKTOP_BRAND_ID: &str = match option_env!("ICLAW_BRAND_ID") {
    Some(value) => value,
    None => "iclaw",
};
const DESKTOP_AUTH_BASE_URL: &str = match option_env!("ICLAW_AUTH_BASE_URL") {
    Some(value) => value,
    None => "",
};
const DESKTOP_SIDE_CAR_ARGS: &str = match option_env!("VITE_SIDE_CAR_ARGS") {
    Some(value) => value,
    None => "--port 2126",
};
const LOCAL_CONTROL_PLANE_URL: &str = "http://127.0.0.1:2130";
const AUTH_ACCESS_KEY: &str = "access_token";
const AUTH_REFRESH_KEY: &str = "refresh_token";
const AUTH_GATEWAY_TOKEN_KEY: &str = "gateway_token";
const SHARED_GATEWAY_TOKEN_DIR: &str = ".openclaw";
const SHARED_GATEWAY_TOKEN_FILE: &str = "gateway-token";
const DESKTOP_UPDATER_PUBLIC_KEY: Option<&str> = option_env!("TAURI_UPDATER_PUBLIC_KEY");

#[derive(Serialize, Deserialize, Clone)]
struct RuntimeConfig {
    openai_api_key: Option<String>,
    openai_base_url: Option<String>,
    openai_model: Option<String>,
    anthropic_api_key: Option<String>,
    clawhub_url: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
struct OemRuntimeSnapshot {
    brand_id: String,
    published_version: u64,
    config: serde_json::Value,
}

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
struct DesktopWindowStateSnapshot {
    width: u32,
    height: u32,
    position_x: i32,
    position_y: i32,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PublicBrandConfigEnvelope {
    success: bool,
    data: Option<PublicBrandConfigData>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PublicBrandConfigData {
    brand: Option<PublicBrandRef>,
    app: Option<PublicBrandAppRef>,
    published_version: Option<u64>,
    config: Option<serde_json::Value>,
}

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
struct RuntimeSkillSyncState {
    brand_id: String,
    published_version: u64,
    skill_slugs: Vec<String>,
    synced_at: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PublicBrandRef {
    brand_id: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PublicBrandAppRef {
    app_name: Option<String>,
}

fn openclaw_main_agent_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = openclaw_state_dir(app)?.join("agents").join("main").join("agent");
    fs::create_dir_all(&dir)
        .map_err(|e| format!("failed to create OpenClaw main agent dir {}: {e}", dir.to_string_lossy()))?;
    Ok(dir)
}

fn openclaw_auth_profiles_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(openclaw_main_agent_dir(app)?.join("auth-profiles.json"))
}

fn read_json_file_if_exists(target: &Path) -> Result<Option<serde_json::Value>, String> {
    if !target.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(target)
        .map_err(|e| format!("failed to read json file {}: {e}", target.to_string_lossy()))?;
    let parsed = serde_json::from_str::<serde_json::Value>(&raw)
        .map_err(|e| format!("failed to parse json file {}: {e}", target.to_string_lossy()))?;
    Ok(Some(parsed))
}

fn write_locked_json_file(target: &Path, value: &serde_json::Value) -> Result<(), String> {
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("failed to create parent dir {}: {e}", parent.to_string_lossy()))?;
    }
    let raw = serde_json::to_string_pretty(value)
        .map_err(|e| format!("failed to serialize json file {}: {e}", target.to_string_lossy()))?;
    fs::write(target, format!("{raw}\n"))
        .map_err(|e| format!("failed to write json file {}: {e}", target.to_string_lossy()))?;
    #[cfg(unix)]
    {
        fs::set_permissions(target, fs::Permissions::from_mode(0o600))
            .map_err(|e| format!("failed to set json file permissions {}: {e}", target.to_string_lossy()))?;
    }
    Ok(())
}

fn read_private_runtime_config(
    access_token: &str,
    auth_base_url: &str,
    brand_id: &str,
) -> Result<PublicBrandConfigData, String> {
    let trimmed_auth_base_url = auth_base_url.trim().trim_end_matches('/');
    let trimmed_brand_id = brand_id.trim();
    if trimmed_auth_base_url.is_empty() {
        return Err(String::from("auth_base_url is required"));
    }
    if trimmed_brand_id.is_empty() {
        return Err(String::from("brand_id is required"));
    }
    if access_token.trim().is_empty() {
        return Err(String::from("access token is required"));
    }

    let mut private_url = Url::parse(&format!("{trimmed_auth_base_url}/portal/runtime/private-config"))
        .map_err(|e| format!("failed to parse OEM private runtime config url: {e}"))?;
    private_url
        .query_pairs_mut()
        .append_pair("app_name", trimmed_brand_id);

    let client = Client::builder()
        .connect_timeout(Duration::from_secs(8))
        .timeout(Duration::from_secs(8))
        .build()
        .map_err(|e| format!("failed to build OEM runtime config client: {e}"))?;
    let response = client
        .get(private_url)
        .bearer_auth(access_token)
        .send()
        .map_err(|e| format!("failed to fetch OEM private runtime config: {e}"))?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!("OEM private runtime config request failed ({status})"));
    }
    let envelope = response
        .json::<PublicBrandConfigEnvelope>()
        .map_err(|e| format!("failed to parse OEM runtime config response: {e}"))?;
    if !envelope.success {
        return Err(format!(
            "OEM private runtime config returned unsuccessful response ({status})"
        ));
    }
    envelope
        .data
        .ok_or_else(|| format!("OEM private runtime config missing data payload ({status})"))
}

fn extract_config_api_key(config: &serde_json::Value, path: &[&str]) -> Option<(String, String)> {
    let mut current = config;
    for segment in path {
        current = current.get(*segment)?;
    }
    let provider = current
        .get("provider_key")
        .and_then(|value| value.as_str())
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())?;
    let api_key = current
        .get("api_key")
        .and_then(|value| value.as_str())
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())?;
    Some((provider, api_key))
}

fn upsert_portal_provider_auth_profiles(
    app: &AppHandle,
    config: &serde_json::Value,
) -> Result<bool, String> {
    let auth_path = openclaw_auth_profiles_path(app)?;
    let mut store = read_json_file_if_exists(&auth_path)?
        .and_then(|value| value.as_object().cloned())
        .unwrap_or_default();
    let mut profiles = store
        .remove("profiles")
        .and_then(|value| value.as_object().cloned())
        .unwrap_or_default();

    let mut changed = false;
    let mut matched_profiles = 0_u8;
    for path in [
        ["model_provider", "profile"],
        ["memory_embedding", "profile"],
    ] {
        if let Some((provider, api_key)) = extract_config_api_key(config, &path) {
            matched_profiles = matched_profiles.saturating_add(1);
            let profile_id = format!("{provider}:default");
            let next_value = json!({
                "type": "api_key",
                "provider": provider,
                "key": api_key,
            });
            if profiles.get(&profile_id) != Some(&next_value) {
                profiles.insert(profile_id, next_value);
                changed = true;
            }
        }
    }

    if matched_profiles == 0 {
        return Err(String::from(
            "private runtime config did not contain any provider api_key values",
        ));
    }

    store.insert(String::from("version"), serde_json::Value::from(1));
    store.insert(String::from("profiles"), serde_json::Value::Object(profiles));
    if changed || !auth_path.exists() {
        write_locked_json_file(&auth_path, &serde_json::Value::Object(store))?;
    }
    Ok(changed)
}

fn clear_portal_provider_auth_profiles(app: &AppHandle) -> Result<bool, String> {
    let auth_path = openclaw_auth_profiles_path(app)?;
    if !auth_path.exists() {
        return Ok(true);
    }
    let snapshot = load_oem_runtime_snapshot_internal(app)?;
    let Some(snapshot) = snapshot else {
        return Ok(true);
    };
    let mut store = read_json_file_if_exists(&auth_path)?
        .and_then(|value| value.as_object().cloned())
        .unwrap_or_default();
    let mut profiles = store
        .remove("profiles")
        .and_then(|value| value.as_object().cloned())
        .unwrap_or_default();

    let mut changed = false;
    for path in [
        ["model_provider", "profile"],
        ["memory_embedding", "profile"],
    ] {
        let Some(provider) = snapshot
            .config
            .get(path[0])
            .and_then(|value| value.get(path[1]))
            .and_then(|value| value.get("provider_key"))
            .and_then(|value| value.as_str())
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
        else {
            continue;
        };
        let profile_id = format!("{provider}:default");
        if profiles.remove(&profile_id).is_some() {
            changed = true;
        }
    }

    if !changed {
        return Ok(true);
    }
    store.insert(String::from("version"), serde_json::Value::from(1));
    store.insert(String::from("profiles"), serde_json::Value::Object(profiles));
    write_locked_json_file(&auth_path, &serde_json::Value::Object(store))?;
    Ok(true)
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct DesktopMemoryEntry {
    id: String,
    title: String,
    summary: String,
    content: String,
    domain: String,
    r#type: String,
    importance: String,
    source_type: String,
    source_label: String,
    tags: Vec<String>,
    created_at: String,
    updated_at: String,
    last_recalled_at: Option<String>,
    recall_count: u64,
    capture_confidence: f64,
    index_health: String,
    status: String,
    active: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopMemoryRuntimeStatus {
    backend: Option<String>,
    files: u64,
    chunks: u64,
    dirty: bool,
    workspace_dir: Option<String>,
    memory_dir: String,
    db_path: Option<String>,
    provider: Option<String>,
    model: Option<String>,
    source_counts: Vec<serde_json::Value>,
    scan_total_files: Option<u64>,
    scan_issues: Vec<String>,
    fts_available: Option<bool>,
    fts_error: Option<String>,
    vector_available: Option<bool>,
    vector_error: Option<String>,
    embedding_configured: bool,
    configured_scope: Option<String>,
    configured_provider: Option<String>,
    configured_model: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopMemorySnapshot {
    entries: Vec<DesktopMemoryEntry>,
    runtime_status: Option<DesktopMemoryRuntimeStatus>,
    runtime_error: Option<String>,
    memory_dir: String,
    archive_dir: String,
}

#[derive(Serialize)]
struct IclawWorkspaceFiles {
    workspace_dir: String,
    identity_md: String,
    user_md: String,
    soul_md: String,
    agents_md: String,
    finance_decision_framework_md: String,
}

#[derive(Serialize, Deserialize)]
struct IclawWorkspaceBackupPayload {
    identity_md: String,
    user_md: String,
    soul_md: String,
    agents_md: String,
}

#[derive(Serialize, Deserialize, Clone, Default)]
struct RuntimeBootstrapConfig {
    version: Option<String>,
    artifact_url: Option<String>,
    artifact_sha256: Option<String>,
    artifact_format: Option<String>,
    launcher_relative_path: Option<String>,
    dev_source_dir: Option<String>,
    dev_node_path: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Default)]
struct RuntimeInstallReceipt {
    version: Option<String>,
    artifact_url: Option<String>,
    artifact_sha256: Option<String>,
}

#[derive(Serialize)]
struct DesktopUpdateCheckResult {
    supported: bool,
    available: bool,
    version: Option<String>,
    notes: Option<String>,
    pub_date: Option<String>,
    mandatory: bool,
    external_download_url: Option<String>,
}

#[derive(Serialize, Clone)]
struct DesktopUpdateProgress {
    phase: String,
    progress: u8,
    version: Option<String>,
    downloaded_bytes: Option<u64>,
    total_bytes: Option<u64>,
    detail: String,
}

#[derive(Deserialize)]
struct DesktopUpdateCommandInput {
    auth_base_url: String,
    app_name: Option<String>,
    channel: Option<String>,
}

#[derive(Serialize)]
struct RuntimeDiagnosis {
    runtime_found: bool,
    runtime_installable: bool,
    runtime_source: Option<String>,
    runtime_path: Option<String>,
    runtime_version: Option<String>,
    runtime_download_url: Option<String>,
    skills_dir_ready: bool,
    mcp_config_ready: bool,
    api_key_configured: bool,
    skills_dir: String,
    mcp_config: String,
    work_dir: String,
    log_dir: String,
    cache_dir: String,
}

#[derive(Serialize)]
struct BundledSkillCatalogItem {
    slug: String,
    name: String,
    description: String,
    tags: Vec<String>,
    license: Option<String>,
    homepage: Option<String>,
    market: Option<String>,
    category: Option<String>,
    skill_type: Option<String>,
    publisher: Option<String>,
    distribution: Option<String>,
    path: String,
    source: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BundledMcpCatalogItem {
    mcp_key: String,
    transport: String,
    enabled: bool,
    command: Option<String>,
    args: Vec<String>,
    http_url: Option<String>,
    config: serde_json::Value,
}

#[derive(Serialize, Deserialize)]
struct ManagedSkillInstallInput {
    slug: String,
    version: String,
    artifact_url: String,
    artifact_sha256: Option<String>,
    artifact_format: Option<String>,
    source: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
struct ManagedSkillInstallReceipt {
    slug: String,
    version: String,
    source: String,
    installed_at: String,
    artifact_url: Option<String>,
    artifact_sha256: Option<String>,
}

#[derive(Serialize)]
struct ManagedSkillInstallRecord {
    slug: String,
    version: String,
    source: String,
    installed_at: String,
    path: String,
}

#[derive(Serialize, Deserialize)]
struct ImportGithubSkillInput {
    auth_base_url: String,
    access_token: String,
    repo_url: String,
}

#[derive(Serialize, Deserialize)]
struct ImportLocalSkillInput {
    auth_base_url: String,
    access_token: String,
}

#[derive(Serialize)]
struct ImportedSkillRecord {
    slug: String,
    version: String,
    name: String,
    source: String,
}

#[derive(Serialize, Deserialize)]
struct ImportableSkillMetadata {
    slug: String,
    name: String,
    description: String,
    market: Option<String>,
    category: Option<String>,
    skill_type: Option<String>,
    publisher: String,
    tags: Vec<String>,
    version: String,
}

#[derive(Serialize)]
struct PrivateSkillImportRequest {
    slug: String,
    name: String,
    description: String,
    market: Option<String>,
    category: Option<String>,
    skill_type: Option<String>,
    publisher: String,
    tags: Vec<String>,
    source_kind: String,
    source_url: Option<String>,
    version: String,
    artifact_format: String,
    artifact_sha256: Option<String>,
    artifact_base64: String,
}

#[derive(Deserialize)]
struct ControlPlaneEnvelope<T> {
    data: T,
}

#[derive(Deserialize)]
struct ImportedSkillCatalogEntry {
    slug: String,
    name: String,
    version: String,
    artifact_url: Option<String>,
    artifact_format: String,
    artifact_sha256: Option<String>,
}

#[derive(Serialize, Clone)]
struct RuntimeInstallProgress {
    phase: String,
    progress: u8,
    label: String,
    detail: String,
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

#[derive(Serialize, Deserialize)]
struct StoredGatewayAuth {
    token: Option<String>,
    password: Option<String>,
}

#[derive(Serialize)]
struct PortConflictStatus {
    occupied_ports: Vec<u16>,
}

#[derive(Clone)]
struct ListeningProcess {
    pid: u32,
    command: String,
    details: String,
}

#[derive(Clone)]
struct ResolvedRuntimeCommand {
    program: PathBuf,
    args_prefix: Vec<String>,
    working_dir: Option<PathBuf>,
    source: String,
    display_path: PathBuf,
    version: Option<String>,
}

fn clean_optional(value: Option<String>) -> Option<String> {
    value.and_then(|v| {
        let trimmed = v.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

fn timestamp_string() -> String {
    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_secs())
        .unwrap_or(0);
    seconds.to_string()
}

fn default_runtime_launcher_name() -> &'static str {
    #[cfg(target_os = "windows")]
    {
        "openclaw-runtime.cmd"
    }
    #[cfg(not(target_os = "windows"))]
    {
        "openclaw-runtime"
    }
}

fn runtime_bootstrap_config_path(app: &AppHandle) -> PathBuf {
    if let Ok(resource_dir) = app.path().resource_dir() {
        let p = resource_dir
            .join("resources")
            .join("config")
            .join("openclaw-runtime.json");
        if p.exists() {
            return p;
        }
    }

    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("resources")
        .join("config")
        .join("openclaw-runtime.json")
}

fn expand_tilde(app: &AppHandle, raw: &str) -> PathBuf {
    if raw == "~" {
        if let Ok(home) = app.path().home_dir() {
            return home;
        }
    }

    if let Some(rest) = raw.strip_prefix("~/") {
        if let Ok(home) = app.path().home_dir() {
            return home.join(rest);
        }
    }

    PathBuf::from(raw)
}

fn env_override(name: &str) -> Option<String> {
    clean_optional(env::var(name).ok())
}

fn load_runtime_bootstrap_config(app: &AppHandle) -> Result<RuntimeBootstrapConfig, String> {
    let path = runtime_bootstrap_config_path(app);
    let mut config = if path.exists() {
        let raw = fs::read_to_string(&path)
            .map_err(|e| format!("failed to read runtime bootstrap config: {e}"))?;
        serde_json::from_str::<RuntimeBootstrapConfig>(&raw)
            .map_err(|e| format!("failed to parse runtime bootstrap config: {e}"))?
    } else {
        RuntimeBootstrapConfig::default()
    };

    if let Some(value) = env_override("ICLAW_OPENCLAW_RUNTIME_VERSION") {
        config.version = Some(value);
    }
    if let Some(value) = env_override("ICLAW_OPENCLAW_RUNTIME_URL") {
        config.artifact_url = Some(value);
    }
    if let Some(value) = env_override("ICLAW_OPENCLAW_RUNTIME_SHA256") {
        config.artifact_sha256 = Some(value);
    }
    if let Some(value) = env_override("ICLAW_OPENCLAW_RUNTIME_FORMAT") {
        config.artifact_format = Some(value);
    }
    if let Some(value) = env_override("ICLAW_OPENCLAW_RUNTIME_LAUNCHER") {
        config.launcher_relative_path = Some(value);
    }
    if let Some(value) = env_override("ICLAW_OPENCLAW_SOURCE_DIR") {
        config.dev_source_dir = Some(value);
    }
    if let Some(value) = env_override("ICLAW_OPENCLAW_NODE_PATH") {
        config.dev_node_path = Some(value);
    }

    Ok(config)
}

fn runtime_version_label(config: &RuntimeBootstrapConfig) -> String {
    clean_optional(config.version.clone()).unwrap_or_else(|| String::from("current"))
}

fn runtime_launcher_relative_path(config: &RuntimeBootstrapConfig) -> PathBuf {
    PathBuf::from(
        clean_optional(config.launcher_relative_path.clone())
            .unwrap_or_else(|| String::from(default_runtime_launcher_name())),
    )
}

fn runtime_install_root(app: &AppHandle) -> Result<PathBuf, String> {
    let root = app_data_base_dir(app)?.join("runtime");
    fs::create_dir_all(root.join("versions"))
        .map_err(|e| format!("failed to create runtime versions dir: {e}"))?;
    Ok(root)
}

fn installed_runtime_dir(
    app: &AppHandle,
    config: &RuntimeBootstrapConfig,
) -> Result<PathBuf, String> {
    Ok(runtime_install_root(app)?
        .join("versions")
        .join(runtime_version_label(config)))
}

fn resource_runtime_dir(app: &AppHandle) -> PathBuf {
    if let Ok(resource_dir) = app.path().resource_dir() {
        let p = resource_dir.join("resources").join("openclaw-runtime");
        if p.exists() {
            return p;
        }
    }

    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("resources")
        .join("openclaw-runtime")
}

fn find_runtime_launcher(root: &Path, config: &RuntimeBootstrapConfig) -> Option<PathBuf> {
    let launcher = root.join(runtime_launcher_relative_path(config));
    if launcher.exists() {
        Some(launcher)
    } else {
        None
    }
}

fn runtime_install_receipt_path(root: &Path) -> PathBuf {
    root.join(".iclaw-runtime-install.json")
}

fn load_runtime_install_receipt(root: &Path) -> Option<RuntimeInstallReceipt> {
    let path = runtime_install_receipt_path(root);
    let raw = fs::read_to_string(path).ok()?;
    serde_json::from_str::<RuntimeInstallReceipt>(&raw).ok()
}

fn write_runtime_install_receipt(
    root: &Path,
    config: &RuntimeBootstrapConfig,
) -> Result<(), String> {
    let receipt = RuntimeInstallReceipt {
        version: clean_optional(config.version.clone()),
        artifact_url: clean_optional(config.artifact_url.clone()),
        artifact_sha256: clean_optional(config.artifact_sha256.clone())
            .map(|value| value.to_ascii_lowercase()),
    };
    let raw = serde_json::to_string_pretty(&receipt)
        .map_err(|e| format!("failed to serialize runtime install receipt: {e}"))?;
    fs::write(runtime_install_receipt_path(root), format!("{raw}\n"))
        .map_err(|e| format!("failed to write runtime install receipt: {e}"))
}

fn expected_runtime_sha256(config: &RuntimeBootstrapConfig) -> Option<String> {
    clean_optional(config.artifact_sha256.clone()).map(|value| value.to_ascii_lowercase())
}

fn runtime_layout_complete(root: &Path, config: &RuntimeBootstrapConfig) -> bool {
    let launcher_ok = find_runtime_launcher(root, config).is_some();
    let node_ok =
        root.join("bin").join("node").exists() || root.join("bin").join("node.exe").exists();
    let openclaw_root = root.join("openclaw");
    let openclaw_ok =
        openclaw_root.join("openclaw.mjs").exists() && openclaw_root.join("package.json").exists();
    let deps_ok = openclaw_root
        .join("node_modules")
        .join("chalk")
        .join("package.json")
        .exists();

    launcher_ok && node_ok && openclaw_ok && deps_ok
}

fn installed_runtime_matches(root: &Path, config: &RuntimeBootstrapConfig) -> bool {
    if !runtime_layout_complete(root, config) {
        return false;
    }

    let Some(expected_sha256) = expected_runtime_sha256(config) else {
        return true;
    };

    let Some(receipt) = load_runtime_install_receipt(root) else {
        return false;
    };

    clean_optional(receipt.artifact_sha256).map(|value| value.to_ascii_lowercase())
        == Some(expected_sha256)
}

fn resolve_runtime_command(app: &AppHandle) -> Result<ResolvedRuntimeCommand, String> {
    let config = load_runtime_bootstrap_config(app)?;

    if let Some(dir) = env_override("ICLAW_OPENCLAW_RUNTIME_DIR") {
        let runtime_dir = expand_tilde(app, &dir);
        if runtime_layout_complete(&runtime_dir, &config) {
            let launcher = runtime_dir.join(runtime_launcher_relative_path(&config));
            return Ok(ResolvedRuntimeCommand {
                program: launcher.clone(),
                args_prefix: Vec::new(),
                working_dir: launcher.parent().map(|path| path.to_path_buf()),
                source: String::from("runtime_dir"),
                display_path: launcher,
                version: clean_optional(config.version.clone()),
            });
        }
    }

    let installed_dir = installed_runtime_dir(app, &config)?;
    if installed_runtime_matches(&installed_dir, &config) {
        let launcher = installed_dir.join(runtime_launcher_relative_path(&config));
        return Ok(ResolvedRuntimeCommand {
            program: launcher.clone(),
            args_prefix: Vec::new(),
            working_dir: launcher.parent().map(|path| path.to_path_buf()),
            source: String::from("installed"),
            display_path: launcher,
            version: clean_optional(config.version.clone()),
        });
    }

    let bundled_dir = resource_runtime_dir(app);
    if runtime_layout_complete(&bundled_dir, &config) {
        let launcher = bundled_dir.join(runtime_launcher_relative_path(&config));
        return Ok(ResolvedRuntimeCommand {
            program: launcher.clone(),
            args_prefix: Vec::new(),
            working_dir: launcher.parent().map(|path| path.to_path_buf()),
            source: String::from("bundled"),
            display_path: launcher,
            version: clean_optional(config.version.clone()),
        });
    }

    Err(String::from(
        "openclaw runtime not found; install the configured runtime artifact or provide ICLAW_OPENCLAW_RUNTIME_DIR",
    ))
}

fn resolved_runtime_root(runtime: &ResolvedRuntimeCommand) -> Result<PathBuf, String> {
    if let Some(working_dir) = runtime.working_dir.as_ref() {
        return Ok(working_dir.clone());
    }
    runtime
        .display_path
        .parent()
        .map(|path| path.to_path_buf())
        .ok_or_else(|| {
            format!(
                "failed to resolve runtime root from {}",
                runtime.display_path.to_string_lossy()
            )
        })
}

fn resolved_runtime_node_path(runtime_root: &Path) -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        runtime_root.join("bin").join("node.exe")
    }
    #[cfg(not(target_os = "windows"))]
    {
        runtime_root.join("bin").join("node")
    }
}

fn openclaw_cli_wrapper_path(app: &AppHandle) -> Result<PathBuf, String> {
    let wrapper_dir = app_data_base_dir(app)?.join("bin");
    fs::create_dir_all(&wrapper_dir)
        .map_err(|e| format!("failed to create openclaw cli wrapper dir: {e}"))?;
    #[cfg(target_os = "windows")]
    {
        Ok(wrapper_dir.join("openclaw.cmd"))
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(wrapper_dir.join("openclaw"))
    }
}

fn runtime_bin_openclaw_cli_path(runtime_root: &Path) -> Result<PathBuf, String> {
    let bin_dir = runtime_root.join("bin");
    fs::create_dir_all(&bin_dir)
        .map_err(|e| format!("failed to create runtime bin dir {}: {e}", bin_dir.to_string_lossy()))?;
    #[cfg(target_os = "windows")]
    {
        Ok(bin_dir.join("openclaw.cmd"))
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(bin_dir.join("openclaw"))
    }
}

fn shell_quote(path: &Path) -> String {
    format!("'{}'", path.to_string_lossy().replace('\'', "'\"'\"'"))
}

fn write_text_if_changed(path: &Path, content: &str) -> Result<(), String> {
    if fs::read_to_string(path).ok().as_deref() == Some(content) {
        return Ok(());
    }
    fs::write(path, content)
        .map_err(|e| format!("failed to write {}: {e}", path.to_string_lossy()))?;
    Ok(())
}

#[cfg(unix)]
fn ensure_executable(path: &Path) -> Result<(), String> {
    let mut permissions = fs::metadata(path)
        .map_err(|e| format!("failed to read metadata for {}: {e}", path.to_string_lossy()))?
        .permissions();
    permissions.set_mode(0o755);
    fs::set_permissions(path, permissions)
        .map_err(|e| format!("failed to set executable permissions on {}: {e}", path.to_string_lossy()))
}

#[cfg(not(unix))]
fn ensure_executable(_path: &Path) -> Result<(), String> {
    Ok(())
}

fn ensure_openclaw_cli_wrapper(
    app: &AppHandle,
    runtime: &ResolvedRuntimeCommand,
) -> Result<PathBuf, String> {
    let runtime_root = resolved_runtime_root(runtime)?;
    let node_path = resolved_runtime_node_path(&runtime_root);
    let node_dir = node_path.parent().ok_or_else(|| {
        format!(
            "failed to resolve node dir from {}",
            node_path.to_string_lossy()
        )
    })?;
    let cli_path = runtime_root.join("openclaw").join("openclaw.mjs");
    if !node_path.exists() {
        return Err(format!(
            "runtime node binary not found: {}",
            node_path.to_string_lossy()
        ));
    }
    if !cli_path.exists() {
        return Err(format!(
            "runtime openclaw cli entry not found: {}",
            cli_path.to_string_lossy()
        ));
    }

    let python_path = node_dir.join(if cfg!(target_os = "windows") {
        "python3.exe"
    } else {
        "python3"
    });
    #[cfg(target_os = "windows")]
    let wrapper_body = format!(
        "@echo off\r\n\
setlocal\r\n\
set \"NODE_BIN={node_bin}\"\r\n\
set \"RUNTIME_ROOT={runtime_root}\"\r\n\
set \"PATH={node_dir};%PATH%\"\r\n\
if \"%OPENCLAW_BUNDLED_PLUGINS_DIR%\"==\"\" set \"OPENCLAW_BUNDLED_PLUGINS_DIR=%RUNTIME_ROOT%\\extensions\"\r\n\
if exist \"{python_path}\" if \"%UV_PYTHON%\"==\"\" set \"UV_PYTHON={python_path}\"\r\n\
\"%NODE_BIN%\" \"{cli_path}\" %*\r\n",
        node_bin = node_path.to_string_lossy(),
        runtime_root = runtime_root.to_string_lossy(),
        node_dir = node_dir.to_string_lossy(),
        python_path = python_path.to_string_lossy(),
        cli_path = cli_path.to_string_lossy(),
    );

    #[cfg(not(target_os = "windows"))]
    let wrapper_body = format!(
        "#!/usr/bin/env bash\n\
set -euo pipefail\n\
NODE_BIN={node_bin}\n\
RUNTIME_ROOT={runtime_root}\n\
export PATH={node_dir}${{PATH:+:$PATH}}\n\
export OPENCLAW_BUNDLED_PLUGINS_DIR=\"${{OPENCLAW_BUNDLED_PLUGINS_DIR:-$RUNTIME_ROOT/extensions}}\"\n\
if [[ -x {python_path} && -z \"${{UV_PYTHON:-}}\" ]]; then\n\
  export UV_PYTHON={python_path}\n\
fi\n\
exec \"$NODE_BIN\" {cli_path} \"$@\"\n",
        node_bin = shell_quote(&node_path),
        runtime_root = shell_quote(&runtime_root),
        node_dir = shell_quote(node_dir),
        python_path = shell_quote(&python_path),
        cli_path = shell_quote(&cli_path),
    );

    let runtime_wrapper_path = runtime_bin_openclaw_cli_path(&runtime_root)?;
    write_text_if_changed(&runtime_wrapper_path, &wrapper_body)?;
    ensure_executable(&runtime_wrapper_path)?;

    let wrapper_path = openclaw_cli_wrapper_path(app)?;
    write_text_if_changed(&wrapper_path, &wrapper_body)?;
    ensure_executable(&wrapper_path)?;
    Ok(wrapper_path)
}

#[tauri::command]
fn ensure_openclaw_cli_available(app: AppHandle) -> Result<bool, String> {
    let runtime = resolve_runtime_command(&app)?;
    let _ = ensure_openclaw_cli_wrapper(&app, &runtime)?;
    Ok(true)
}

fn prepend_openclaw_cli_to_path(
    command: &mut Command,
    wrapper_path: &Path,
    runtime: &ResolvedRuntimeCommand,
) -> Result<(), String> {
    let wrapper_dir = wrapper_path.parent().ok_or_else(|| {
        format!(
            "failed to resolve openclaw wrapper dir from {}",
            wrapper_path.to_string_lossy()
        )
    })?;
    let runtime_root = resolved_runtime_root(runtime)?;
    let node_path = resolved_runtime_node_path(&runtime_root);
    let node_dir = node_path.parent().ok_or_else(|| {
        format!(
            "failed to resolve node dir from {}",
            node_path.to_string_lossy()
        )
    })?;

    let existing_path = env::var_os("PATH").or_else(|| env::var_os("Path"));
    let mut entries = vec![wrapper_dir.to_path_buf(), node_dir.to_path_buf()];
    if let Some(current) = existing_path {
        entries.extend(env::split_paths(&current));
    }
    let joined = env::join_paths(entries)
        .map_err(|e| format!("failed to join PATH for openclaw cli wrapper: {e}"))?;
    command.env("PATH", &joined);
    #[cfg(target_os = "windows")]
    command.env("Path", &joined);
    command.env("ICLAW_OPENCLAW_CLI_PATH", wrapper_path);
    Ok(())
}

fn runtime_skills_dir(app: &AppHandle) -> PathBuf {
    openclaw_workspace_dir(app).join("skills")
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

fn resource_servers_dir(app: &AppHandle) -> PathBuf {
    if let Ok(resource_dir) = app.path().resource_dir() {
        let p = resource_dir.join("resources").join("servers");
        if p.exists() {
            return p;
        }
    }
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("resources")
        .join("servers")
}

fn runtime_skills_manifest_path(app: &AppHandle) -> PathBuf {
    runtime_skills_dir(app).join("skills-manifest.json")
}

fn runtime_skill_sync_state_path(app: &AppHandle) -> Result<PathBuf, String> {
    let path = app_data_base_dir(app)?
        .join("config")
        .join("runtime-skill-sync-state.json");
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("failed to create runtime skill sync state dir: {e}"))?;
    }
    Ok(path)
}

fn replace_iclaw_servers_dir_placeholders(value: &mut serde_json::Value, servers_dir: &str) {
    match value {
        serde_json::Value::String(raw) => {
            if raw.contains("__ICLAW_SERVERS_DIR__") {
                *raw = raw.replace("__ICLAW_SERVERS_DIR__", servers_dir);
            }
        }
        serde_json::Value::Array(items) => {
            for item in items {
                replace_iclaw_servers_dir_placeholders(item, servers_dir);
            }
        }
        serde_json::Value::Object(map) => {
            for item in map.values_mut() {
                replace_iclaw_servers_dir_placeholders(item, servers_dir);
            }
        }
        _ => {}
    }
}

fn expand_env_placeholders(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len());
    let mut cursor = 0usize;

    while let Some(relative_start) = raw[cursor..].find("${") {
        let start = cursor + relative_start;
        out.push_str(&raw[cursor..start]);
        let key_start = start + 2;
        let Some(relative_end) = raw[key_start..].find('}') else {
            out.push_str(&raw[start..]);
            return out;
        };
        let end = key_start + relative_end;
        let key = &raw[key_start..end];
        match env::var(key) {
            Ok(value) => out.push_str(&value),
            Err(_) => out.push_str(&raw[start..=end]),
        }
        cursor = end + 1;
    }

    out.push_str(&raw[cursor..]);
    out
}

fn replace_env_placeholders(value: &mut serde_json::Value) {
    match value {
        serde_json::Value::String(raw) => {
            if raw.contains("${") {
                *raw = expand_env_placeholders(raw);
            }
        }
        serde_json::Value::Array(items) => {
            for item in items {
                replace_env_placeholders(item);
            }
        }
        serde_json::Value::Object(map) => {
            for item in map.values_mut() {
                replace_env_placeholders(item);
            }
        }
        _ => {}
    }
}

fn prepare_runtime_mcp_config(app: &AppHandle, cache_dir: &str) -> Result<PathBuf, String> {
    let source_path = resource_mcp_config_path(app);
    let raw =
        fs::read_to_string(&source_path).map_err(|e| format!("failed to read mcp config: {e}"))?;
    let mut parsed = serde_json::from_str::<serde_json::Value>(&raw)
        .map_err(|e| format!("failed to parse mcp config: {e}"))?;

    let servers_dir = resource_servers_dir(app);
    let servers_dir_str = servers_dir.to_string_lossy().to_string();
    replace_iclaw_servers_dir_placeholders(&mut parsed, &servers_dir_str);
    replace_env_placeholders(&mut parsed);

    let resolved = serde_json::to_string_pretty(&parsed)
        .map_err(|e| format!("failed to serialize resolved mcp config: {e}"))?;
    let resolved_path = Path::new(cache_dir).join("resolved-mcp.json");
    fs::write(&resolved_path, format!("{resolved}\n"))
        .map_err(|e| format!("failed to write resolved mcp config: {e}"))?;
    Ok(resolved_path)
}

fn runtime_skill_bindings_from_snapshot(snapshot: &OemRuntimeSnapshot) -> Vec<(String, i64)> {
    let bindings = snapshot
        .config
        .get("skill_bindings")
        .and_then(|value| value.as_array())
        .cloned()
        .unwrap_or_default();
    let mut parsed = bindings
        .into_iter()
        .filter_map(|value| {
            let object = value.as_object()?;
            let slug = object
                .get("skill_slug")
                .and_then(|value| value.as_str())
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty())?;
            let sort_order = object
                .get("sort_order")
                .and_then(|value| value.as_i64())
                .unwrap_or(0);
            Some((slug, sort_order))
        })
        .collect::<Vec<_>>();
    parsed.sort_by(|left, right| left.1.cmp(&right.1).then_with(|| left.0.cmp(&right.0)));
    parsed
}

fn load_runtime_skill_sync_state(app: &AppHandle) -> Result<Option<RuntimeSkillSyncState>, String> {
    let path = runtime_skill_sync_state_path(app)?;
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(&path).map_err(|e| {
        format!(
            "failed to read runtime skill sync state {}: {e}",
            path.to_string_lossy()
        )
    })?;
    let parsed = serde_json::from_str::<RuntimeSkillSyncState>(&raw).map_err(|e| {
        format!(
            "failed to parse runtime skill sync state {}: {e}",
            path.to_string_lossy()
        )
    })?;
    Ok(Some(parsed))
}

fn save_runtime_skill_sync_state(
    app: &AppHandle,
    state: &RuntimeSkillSyncState,
) -> Result<(), String> {
    let path = runtime_skill_sync_state_path(app)?;
    let value = serde_json::to_value(state)
        .map_err(|e| format!("failed to serialize runtime skill sync state: {e}"))?;
    write_locked_json_file(&path, &value)
}

fn runtime_skills_cache_is_fresh(app: &AppHandle, snapshot: &OemRuntimeSnapshot) -> Result<bool, String> {
    let expected_skill_slugs = runtime_skill_bindings_from_snapshot(snapshot)
        .into_iter()
        .map(|(slug, _)| slug)
        .collect::<Vec<_>>();
    let Some(state) = load_runtime_skill_sync_state(app)? else {
        return Ok(false);
    };
    if state.brand_id.trim() != snapshot.brand_id.trim() {
        return Ok(false);
    }
    if state.published_version != snapshot.published_version {
        return Ok(false);
    }
    if state.skill_slugs != expected_skill_slugs {
        return Ok(false);
    }
    Ok(runtime_skills_manifest_path(app).exists())
}

fn copy_dir_recursive(source: &Path, destination: &Path) -> Result<(), String> {
    fs::create_dir_all(destination).map_err(|e| {
        format!(
            "failed to create skill destination dir {}: {e}",
            destination.to_string_lossy()
        )
    })?;
    for entry in fs::read_dir(source).map_err(|e| {
        format!(
            "failed to read skill source dir {}: {e}",
            source.to_string_lossy()
        )
    })? {
        let entry = entry.map_err(|e| format!("failed to read skill source entry: {e}"))?;
        let source_path = entry.path();
        let destination_path = destination.join(entry.file_name());
        let metadata = entry.metadata().map_err(|e| {
            format!(
                "failed to read skill source metadata {}: {e}",
                source_path.to_string_lossy()
            )
        })?;
        if metadata.is_dir() {
            copy_dir_recursive(&source_path, &destination_path)?;
            continue;
        }
        if let Some(parent) = destination_path.parent() {
            fs::create_dir_all(parent).map_err(|e| {
                format!(
                    "failed to create skill destination parent {}: {e}",
                    parent.to_string_lossy()
                )
            })?;
        }
        fs::copy(&source_path, &destination_path).map_err(|e| {
            format!(
                "failed to copy skill file {} -> {}: {e}",
                source_path.to_string_lossy(),
                destination_path.to_string_lossy()
            )
        })?;
        #[cfg(unix)]
        {
            fs::set_permissions(
                &destination_path,
                fs::Permissions::from_mode(metadata.permissions().mode()),
            )
            .map_err(|e| {
                format!(
                    "failed to preserve skill file permissions {}: {e}",
                    destination_path.to_string_lossy()
                )
            })?;
        }
    }
    Ok(())
}

fn find_skill_root(dir: &Path) -> Result<Option<PathBuf>, String> {
    if dir.join("SKILL.md").exists() {
        return Ok(Some(dir.to_path_buf()));
    }
    let entries = fs::read_dir(dir)
        .map_err(|e| format!("failed to scan extracted skill dir {}: {e}", dir.to_string_lossy()))?;
    for entry in entries {
        let entry = entry.map_err(|e| format!("failed to read extracted skill dir entry: {e}"))?;
        let path = entry.path();
        let metadata = entry.metadata().map_err(|e| {
            format!(
                "failed to read extracted skill metadata {}: {e}",
                path.to_string_lossy()
            )
        })?;
        if !metadata.is_dir() {
            continue;
        }
        if path.join("SKILL.md").exists() {
            return Ok(Some(path));
        }
    }
    let entries = fs::read_dir(dir)
        .map_err(|e| format!("failed to rescan extracted skill dir {}: {e}", dir.to_string_lossy()))?;
    for entry in entries {
        let entry = entry.map_err(|e| format!("failed to read extracted skill dir entry: {e}"))?;
        let path = entry.path();
        let metadata = entry.metadata().map_err(|e| {
            format!(
                "failed to read extracted skill metadata {}: {e}",
                path.to_string_lossy()
            )
        })?;
        if !metadata.is_dir() {
            continue;
        }
        if let Some(found) = find_skill_root(&path)? {
            return Ok(Some(found));
        }
    }
    Ok(None)
}

fn current_unix_timestamp_string() -> String {
    match SystemTime::now().duration_since(UNIX_EPOCH) {
        Ok(duration) => duration.as_secs().to_string(),
        Err(_) => String::from("0"),
    }
}

fn sync_current_brand_runtime_skills(app: &AppHandle, auth_base_url: &str) -> Result<bool, String> {
    let snapshot = load_oem_runtime_snapshot_internal(app)?
        .ok_or_else(|| String::from("OEM runtime snapshot is missing; cannot sync runtime skills"))?;
    if runtime_skills_cache_is_fresh(app, &snapshot)? {
        return Ok(false);
    }

    let workspace_dir = openclaw_workspace_dir(app);
    fs::create_dir_all(&workspace_dir)
        .map_err(|e| format!("failed to create openclaw workspace dir: {e}"))?;
    let skills_root = runtime_skills_dir(app);
    let temp_sync_root = workspace_dir.join(format!(
        ".skills-sync-{}",
        current_unix_timestamp_string()
    ));
    let staged_skills_root = temp_sync_root.join("skills");
    if temp_sync_root.exists() {
        fs::remove_dir_all(&temp_sync_root).map_err(|e| {
            format!(
                "failed to clear temporary runtime skills dir {}: {e}",
                temp_sync_root.to_string_lossy()
            )
        })?;
    }
    fs::create_dir_all(&staged_skills_root).map_err(|e| {
        format!(
            "failed to create temporary runtime skills dir {}: {e}",
            staged_skills_root.to_string_lossy()
        )
    })?;

    let client = Client::builder()
        .connect_timeout(Duration::from_secs(8))
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|e| format!("failed to build runtime skill sync client: {e}"))?;

    let skill_bindings = runtime_skill_bindings_from_snapshot(&snapshot);
    let mut copied_skill_dirs = Vec::new();

    for (slug, _) in &skill_bindings {
        let mut artifact_url = Url::parse(&format!(
            "{}/skills/artifact",
            auth_base_url.trim().trim_end_matches('/')
        ))
        .map_err(|e| format!("failed to build runtime skill artifact url: {e}"))?;
        artifact_url.query_pairs_mut().append_pair("slug", slug);

        let archive_path = temp_sync_root.join(format!("{slug}.tar.gz"));
        let mut response = client
            .get(artifact_url)
            .send()
            .and_then(|resp| resp.error_for_status())
            .map_err(|e| format!("failed to download runtime skill artifact for {slug}: {e}"))?;
        let mut archive_file = File::create(&archive_path).map_err(|e| {
            format!(
                "failed to create runtime skill archive file {}: {e}",
                archive_path.to_string_lossy()
            )
        })?;
        std::io::copy(&mut response, &mut archive_file)
            .map_err(|e| format!("failed to write runtime skill archive for {slug}: {e}"))?;

        let extracted_root = temp_sync_root.join(format!("{slug}.extract"));
        fs::create_dir_all(&extracted_root).map_err(|e| {
            format!(
                "failed to create runtime skill extract dir {}: {e}",
                extracted_root.to_string_lossy()
            )
        })?;
        extract_tar_gz_archive(&archive_path, &extracted_root)?;
        let skill_root = find_skill_root(&extracted_root)?
            .ok_or_else(|| format!("runtime skill artifact {slug} does not contain SKILL.md"))?;
        let dir_name = skill_root
            .file_name()
            .and_then(|value| value.to_str())
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty() && value != "extract")
            .unwrap_or_else(|| slug.to_string());
        let destination = staged_skills_root.join(&dir_name);
        copy_dir_recursive(&skill_root, &destination)?;
        copied_skill_dirs.push(dir_name);
    }

    let manifest_path = staged_skills_root.join("skills-manifest.json");
    let manifest = json!({
        "version": "0.1.0",
        "preset": snapshot.brand_id,
        "publishedVersion": snapshot.published_version,
        "skills": copied_skill_dirs,
    });
    write_locked_json_file(&manifest_path, &manifest)?;

    if skills_root.exists() {
        fs::remove_dir_all(&skills_root).map_err(|e| {
            format!(
                "failed to clear existing runtime skills dir {}: {e}",
                skills_root.to_string_lossy()
            )
        })?;
    }
    fs::rename(&staged_skills_root, &skills_root).map_err(|e| {
        format!(
            "failed to activate runtime skills dir {}: {e}",
            skills_root.to_string_lossy()
        )
    })?;
    if temp_sync_root.exists() {
        let _ = fs::remove_dir_all(&temp_sync_root);
    }

    let sync_state = RuntimeSkillSyncState {
        brand_id: snapshot.brand_id,
        published_version: snapshot.published_version,
        skill_slugs: skill_bindings.into_iter().map(|(slug, _)| slug).collect(),
        synced_at: current_unix_timestamp_string(),
    };
    save_runtime_skill_sync_state(app, &sync_state)?;
    Ok(true)
}

fn parse_skill_frontmatter(raw: &str) -> Vec<(String, String)> {
    let mut lines = raw.lines();
    if lines.next() != Some("---") {
        return Vec::new();
    }

    let mut entries = Vec::new();
    let mut block_key: Option<String> = None;
    let mut block_lines: Vec<String> = Vec::new();

    for line in lines {
        let trimmed = line.trim_end();
        if trimmed == "---" {
            if let Some(key) = block_key.take() {
                entries.push((key, block_lines.join("\n").trim().to_string()));
            }
            break;
        }

        if let Some(key) = block_key.clone() {
            if line.starts_with(' ') || line.starts_with('\t') || trimmed.is_empty() {
                block_lines.push(line.trim_start().to_string());
                continue;
            }
            entries.push((key, block_lines.join("\n").trim().to_string()));
            block_key = None;
            block_lines.clear();
        }

        let simple = line.trim();
        if simple.is_empty() || simple.starts_with('#') {
            continue;
        }
        let Some((key, value)) = simple.split_once(':') else {
            continue;
        };
        let normalized_key = key.trim().to_string();
        let normalized_value = value.trim();
        if normalized_value == "|" || normalized_value == ">" {
            block_key = Some(normalized_key);
            block_lines.clear();
            continue;
        }
        entries.push((
            normalized_key,
            normalized_value
                .trim_matches('"')
                .trim_matches('\'')
                .to_string(),
        ));
    }

    if let Some(key) = block_key.take() {
        entries.push((key, block_lines.join("\n").trim().to_string()));
    }

    entries
}

fn frontmatter_value(entries: &[(String, String)], key: &str) -> Option<String> {
    entries
        .iter()
        .find(|(entry_key, _)| entry_key == key)
        .map(|(_, value)| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn parse_skill_tags(value: Option<String>) -> Vec<String> {
    let Some(raw) = value else {
        return Vec::new();
    };

    raw.trim_matches('[')
        .trim_matches(']')
        .split(',')
        .map(|tag| tag.trim().trim_matches('"').trim_matches('\'').to_string())
        .filter(|tag| !tag.is_empty())
        .collect()
}

fn generated_import_version() -> String {
    match SystemTime::now().duration_since(UNIX_EPOCH) {
        Ok(duration) => format!("import-{}", duration.as_secs()),
        Err(_) => String::from("import-current"),
    }
}

fn discover_skill_root(root: &Path) -> Result<PathBuf, String> {
    if root.join("SKILL.md").exists() {
        return Ok(root.to_path_buf());
    }

    let mut direct_children = Vec::new();
    for entry in
        fs::read_dir(root).map_err(|e| format!("failed to scan selected directory: {e}"))?
    {
        let entry = entry.map_err(|e| format!("failed to read selected directory entry: {e}"))?;
        let path = entry.path();
        if path.is_dir() {
            if path.join("SKILL.md").exists() {
                direct_children.push(path);
            } else {
                for nested in fs::read_dir(&path)
                    .map_err(|e| format!("failed to scan nested skill directory: {e}"))?
                {
                    let nested = nested
                        .map_err(|e| format!("failed to read nested skill directory entry: {e}"))?;
                    let nested_path = nested.path();
                    if nested_path.is_dir() && nested_path.join("SKILL.md").exists() {
                        direct_children.push(nested_path);
                    }
                }
            }
        }
    }

    if direct_children.len() == 1 {
        return Ok(direct_children.remove(0));
    }

    Err(String::from(
        "没有找到唯一的技能目录，请选择包含 SKILL.md 的技能目录",
    ))
}

fn load_importable_skill_metadata(
    skill_root: &Path,
    publisher_fallback: Option<String>,
) -> Result<ImportableSkillMetadata, String> {
    let skill_md_path = skill_root.join("SKILL.md");
    let raw = fs::read_to_string(&skill_md_path)
        .map_err(|e| format!("failed to read {}: {e}", skill_md_path.to_string_lossy()))?;
    let frontmatter = parse_skill_frontmatter(&raw);
    let fallback_slug = skill_root
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("imported-skill")
        .to_string();
    let slug = frontmatter_value(&frontmatter, "slug").unwrap_or(fallback_slug);
    let name = frontmatter_value(&frontmatter, "name").unwrap_or_else(|| slug.clone());
    let description = frontmatter_value(&frontmatter, "description")
        .unwrap_or_else(|| String::from("用户导入的技能"));
    let publisher = frontmatter_value(&frontmatter, "publisher")
        .or(publisher_fallback)
        .unwrap_or_else(|| String::from("个人导入"));
    let version =
        frontmatter_value(&frontmatter, "version").unwrap_or_else(generated_import_version);

    Ok(ImportableSkillMetadata {
        slug,
        name,
        description,
        market: frontmatter_value(&frontmatter, "market"),
        category: frontmatter_value(&frontmatter, "category"),
        skill_type: frontmatter_value(&frontmatter, "skill_type"),
        publisher,
        tags: parse_skill_tags(frontmatter_value(&frontmatter, "tags")),
        version,
    })
}

fn append_directory_to_tar(
    builder: &mut tar::Builder<GzEncoder<Vec<u8>>>,
    source_dir: &Path,
    archive_root: &Path,
) -> Result<(), String> {
    for entry in
        fs::read_dir(source_dir).map_err(|e| format!("failed to read skill directory: {e}"))?
    {
        let entry = entry.map_err(|e| format!("failed to read skill directory entry: {e}"))?;
        let path = entry.path();
        let name = archive_root.join(entry.file_name());
        if path.is_dir() {
            builder
                .append_dir(&name, &path)
                .map_err(|e| format!("failed to append skill directory: {e}"))?;
            append_directory_to_tar(builder, &path, &name)?;
            continue;
        }
        let mut file = File::open(&path)
            .map_err(|e| format!("failed to open skill file {}: {e}", path.to_string_lossy()))?;
        builder.append_file(&name, &mut file).map_err(|e| {
            format!(
                "failed to append skill file {}: {e}",
                path.to_string_lossy()
            )
        })?;
    }
    Ok(())
}

fn package_skill_directory(skill_root: &Path, slug: &str) -> Result<Vec<u8>, String> {
    let encoder = GzEncoder::new(Vec::new(), Compression::default());
    let mut builder = tar::Builder::new(encoder);
    append_directory_to_tar(&mut builder, skill_root, Path::new(slug))?;
    let encoder = builder
        .into_inner()
        .map_err(|e| format!("failed to finalize skill archive: {e}"))?;
    encoder
        .finish()
        .map_err(|e| format!("failed to compress skill archive: {e}"))
}

fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("{:x}", hasher.finalize())
}

fn extract_github_owner(repo_url: &str) -> Option<String> {
    let trimmed = repo_url.trim().trim_end_matches('/');
    let without_scheme = trimmed
        .strip_prefix("https://")
        .or_else(|| trimmed.strip_prefix("http://"))
        .unwrap_or(trimmed);
    let parts: Vec<&str> = without_scheme.split('/').collect();
    if parts.len() >= 3 && parts[0].eq_ignore_ascii_case("github.com") {
        Some(parts[1].to_string())
    } else {
        None
    }
}

fn github_zipball_url(repo_url: &str) -> Result<String, String> {
    let trimmed = repo_url.trim().trim_end_matches('/');
    let without_scheme = trimmed
        .strip_prefix("https://")
        .or_else(|| trimmed.strip_prefix("http://"))
        .unwrap_or(trimmed);
    let parts: Vec<&str> = without_scheme.split('/').collect();
    if parts.len() < 3 || !parts[0].eq_ignore_ascii_case("github.com") {
        return Err(String::from("请提供公开 GitHub 仓库链接"));
    }
    let owner = parts[1].trim();
    let repo = parts[2].trim();
    if owner.is_empty() || repo.is_empty() {
        return Err(String::from("GitHub 仓库链接不完整"));
    }
    Ok(format!(
        "https://api.github.com/repos/{owner}/{repo}/zipball"
    ))
}

fn load_bundled_skills_catalog_internal(
    app: &AppHandle,
) -> Result<Vec<BundledSkillCatalogItem>, String> {
    let skills_dir = runtime_skills_dir(app);
    if !skills_dir.exists() {
        return Ok(Vec::new());
    }

    let mut items: Vec<BundledSkillCatalogItem> = Vec::new();
    let entries =
        fs::read_dir(&skills_dir).map_err(|e| format!("failed to read skills dir: {e}"))?;
    for entry in entries {
        let entry = entry.map_err(|e| format!("failed to read skills entry: {e}"))?;
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let skill_md_path = path.join("SKILL.md");
        if !skill_md_path.exists() {
            continue;
        }

        let raw = fs::read_to_string(&skill_md_path)
            .map_err(|e| format!("failed to read {}: {e}", skill_md_path.display()))?;
        let frontmatter = parse_skill_frontmatter(&raw);
        let Some(name) = frontmatter_value(&frontmatter, "name") else {
            continue;
        };
        let Some(description) = frontmatter_value(&frontmatter, "description") else {
            continue;
        };

        let directory_name = path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("skill")
            .to_string();

        items.push(BundledSkillCatalogItem {
            slug: frontmatter_value(&frontmatter, "slug").unwrap_or(directory_name),
            name,
            description,
            tags: parse_skill_tags(frontmatter_value(&frontmatter, "tags")),
            license: frontmatter_value(&frontmatter, "license"),
            homepage: frontmatter_value(&frontmatter, "homepage"),
            market: frontmatter_value(&frontmatter, "market"),
            category: frontmatter_value(&frontmatter, "category"),
            skill_type: frontmatter_value(&frontmatter, "skill_type"),
            publisher: frontmatter_value(&frontmatter, "publisher"),
            distribution: frontmatter_value(&frontmatter, "distribution"),
            path: skill_md_path.to_string_lossy().to_string(),
            source: String::from("bundled"),
        });
    }

    items.sort_by(|left, right| left.name.cmp(&right.name));
    Ok(items)
}

fn infer_bundled_mcp_transport(config: &serde_json::Value) -> String {
    let explicit = config
        .get("type")
        .and_then(|value| value.as_str())
        .map(|value| value.trim().to_lowercase())
        .filter(|value| !value.is_empty());
    if let Some(value) = explicit {
        return value;
    }
    if config.get("httpUrl").and_then(|value| value.as_str()).is_some()
        || config.get("url").and_then(|value| value.as_str()).is_some()
    {
        return String::from("http");
    }
    String::from("stdio")
}

fn load_bundled_mcp_catalog_internal(
    app: &AppHandle,
) -> Result<Vec<BundledMcpCatalogItem>, String> {
    let source_path = resource_mcp_config_path(app);
    if !source_path.exists() {
        return Ok(Vec::new());
    }

    let raw =
        fs::read_to_string(&source_path).map_err(|e| format!("failed to read mcp config: {e}"))?;
    let mut parsed = serde_json::from_str::<serde_json::Value>(&raw)
        .map_err(|e| format!("failed to parse mcp config: {e}"))?;

    let servers_dir = resource_servers_dir(app);
    let servers_dir_str = servers_dir.to_string_lossy().to_string();
    replace_iclaw_servers_dir_placeholders(&mut parsed, &servers_dir_str);
    replace_env_placeholders(&mut parsed);

    let Some(servers) = parsed.get("mcpServers").and_then(|value| value.as_object()) else {
        return Ok(Vec::new());
    };

    let mut items = Vec::with_capacity(servers.len());
    for (mcp_key, config) in servers {
        let transport = infer_bundled_mcp_transport(config);
        let enabled = config
            .get("enabled")
            .and_then(|value| value.as_bool())
            .unwrap_or(true);
        let command = config
            .get("command")
            .and_then(|value| value.as_str())
            .map(|value| value.to_string());
        let args = config
            .get("args")
            .and_then(|value| value.as_array())
            .map(|values| {
                values
                    .iter()
                    .filter_map(|value| value.as_str().map(|item| item.to_string()))
                    .collect::<Vec<String>>()
            })
            .unwrap_or_default();
        let http_url = config
            .get("httpUrl")
            .and_then(|value| value.as_str())
            .or_else(|| config.get("url").and_then(|value| value.as_str()))
            .map(|value| value.to_string());

        items.push(BundledMcpCatalogItem {
            mcp_key: mcp_key.clone(),
            transport,
            enabled,
            command,
            args,
            http_url,
            config: config.clone(),
        });
    }

    items.sort_by(|left, right| left.mcp_key.cmp(&right.mcp_key));
    Ok(items)
}

fn openclaw_managed_skills_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let home = app
        .path()
        .home_dir()
        .map_err(|e| format!("failed to resolve home dir: {e}"))?;
    let dir = home.join(".openclaw").join("skills");
    fs::create_dir_all(&dir).map_err(|e| format!("failed to create managed skills dir: {e}"))?;
    Ok(dir)
}

fn managed_skill_receipt_path(skill_dir: &Path) -> PathBuf {
    skill_dir.join(".iclaw-install.json")
}

fn load_managed_skill_receipt(skill_dir: &Path) -> Option<ManagedSkillInstallReceipt> {
    let raw = fs::read_to_string(managed_skill_receipt_path(skill_dir)).ok()?;
    serde_json::from_str::<ManagedSkillInstallReceipt>(&raw).ok()
}

fn write_managed_skill_receipt(
    skill_dir: &Path,
    receipt: &ManagedSkillInstallReceipt,
) -> Result<(), String> {
    let raw = serde_json::to_string_pretty(receipt)
        .map_err(|e| format!("failed to serialize managed skill receipt: {e}"))?;
    fs::write(managed_skill_receipt_path(skill_dir), format!("{raw}\n"))
        .map_err(|e| format!("failed to write managed skill receipt: {e}"))
}

fn managed_skill_archive_format(input: &ManagedSkillInstallInput) -> Result<String, String> {
    if let Some(format) = clean_optional(input.artifact_format.clone()) {
        return match format.as_str() {
            "tar.gz" | "tgz" => Ok(String::from("tar.gz")),
            "zip" => Ok(String::from("zip")),
            _ => Err(format!(
                "unsupported managed skill archive format: {format}"
            )),
        };
    }

    if input.artifact_url.ends_with(".zip") {
        Ok(String::from("zip"))
    } else if input.artifact_url.ends_with(".tar.gz") || input.artifact_url.ends_with(".tgz") {
        Ok(String::from("tar.gz"))
    } else {
        Ok(String::from("tar.gz"))
    }
}

fn download_file_with_optional_sha256(
    app: &AppHandle,
    url: &str,
    archive_path: &Path,
    expected_sha256: Option<String>,
) -> Result<(), String> {
    if let Some(local_path) = local_artifact_path(app, url) {
        let mut input = File::open(&local_path).map_err(|e| {
            format!(
                "failed to open local skill archive {}: {e}",
                local_path.to_string_lossy()
            )
        })?;
        let mut output = File::create(archive_path)
            .map_err(|e| format!("failed to create skill archive file: {e}"))?;
        let mut hasher = Sha256::new();
        let mut buffer = [0_u8; 16 * 1024];

        loop {
            let read = input
                .read(&mut buffer)
                .map_err(|e| format!("failed to read local skill archive: {e}"))?;
            if read == 0 {
                break;
            }
            hasher.update(&buffer[..read]);
            output
                .write_all(&buffer[..read])
                .map_err(|e| format!("failed to write skill archive file: {e}"))?;
        }

        if let Some(expected) = clean_optional(expected_sha256) {
            let actual = format!("{:x}", hasher.finalize());
            if actual != expected.to_ascii_lowercase() {
                return Err(format!(
                    "skill archive sha256 mismatch: expected {expected}, got {actual}"
                ));
            }
        }

        return Ok(());
    }

    let client = Client::builder()
        .connect_timeout(Duration::from_secs(20))
        .timeout(Duration::from_secs(1800))
        .user_agent("iClaw Desktop Downloader")
        .build()
        .map_err(|e| format!("failed to build skill downloader: {e}"))?;
    let mut response = client
        .get(url)
        .send()
        .and_then(|resp| resp.error_for_status())
        .map_err(|e| format!("failed to download skill archive: {e}"))?;
    let mut file = File::create(archive_path)
        .map_err(|e| format!("failed to create skill archive file: {e}"))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 16 * 1024];

    loop {
        let read = response
            .read(&mut buffer)
            .map_err(|e| format!("failed to read skill archive response: {e}"))?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
        file.write_all(&buffer[..read])
            .map_err(|e| format!("failed to write skill archive file: {e}"))?;
    }

    if let Some(expected) = clean_optional(expected_sha256) {
        let actual = format!("{:x}", hasher.finalize());
        if actual != expected.to_ascii_lowercase() {
            return Err(format!(
                "skill archive sha256 mismatch: expected {expected}, got {actual}"
            ));
        }
    }

    Ok(())
}

fn normalize_skill_root(extracted_dir: &Path) -> Result<PathBuf, String> {
    if extracted_dir.join("SKILL.md").exists() {
        return Ok(extracted_dir.to_path_buf());
    }

    let mut child_dirs = Vec::new();
    for entry in
        fs::read_dir(extracted_dir).map_err(|e| format!("failed to scan skill dir: {e}"))?
    {
        let entry = entry.map_err(|e| format!("failed to scan skill dir entry: {e}"))?;
        let path = entry.path();
        if path.is_dir() {
            child_dirs.push(path);
        }
    }

    if child_dirs.len() == 1 && child_dirs[0].join("SKILL.md").exists() {
        return Ok(child_dirs.remove(0));
    }

    Err(String::from(
        "skill artifact extracted successfully but SKILL.md was not found",
    ))
}

fn list_managed_skills_internal(app: &AppHandle) -> Result<Vec<ManagedSkillInstallRecord>, String> {
    let skills_dir = openclaw_managed_skills_dir(app)?;
    let mut items = Vec::new();
    for entry in
        fs::read_dir(&skills_dir).map_err(|e| format!("failed to read managed skills dir: {e}"))?
    {
        let entry = entry.map_err(|e| format!("failed to read managed skill entry: {e}"))?;
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let Some(receipt) = load_managed_skill_receipt(&path) else {
            continue;
        };
        items.push(ManagedSkillInstallRecord {
            slug: receipt.slug,
            version: receipt.version,
            source: receipt.source,
            installed_at: receipt.installed_at,
            path: path.to_string_lossy().to_string(),
        });
    }
    items.sort_by(|left, right| left.slug.cmp(&right.slug));
    Ok(items)
}

fn install_managed_skill_internal(
    app: &AppHandle,
    input: ManagedSkillInstallInput,
) -> Result<ManagedSkillInstallRecord, String> {
    let slug = input.slug.trim().to_string();
    if slug.is_empty() {
        return Err(String::from("skill slug is required"));
    }
    let version = input.version.trim().to_string();
    if version.is_empty() {
        return Err(String::from("skill version is required"));
    }
    let artifact_url = input.artifact_url.trim().to_string();
    if artifact_url.is_empty() {
        return Err(String::from("skill artifact_url is required"));
    }

    let archive_format = managed_skill_archive_format(&input)?;
    let skills_dir = openclaw_managed_skills_dir(app)?;
    let downloads_dir = app_data_base_dir(app)?.join("skill-downloads");
    fs::create_dir_all(&downloads_dir)
        .map_err(|e| format!("failed to create skill downloads dir: {e}"))?;
    let archive_ext = if archive_format == "zip" {
        "zip"
    } else {
        "tar.gz"
    };
    let archive_path = downloads_dir.join(format!("{}-{}.{}", slug, version, archive_ext));
    let staging_dir = skills_dir.join(format!("{}.partial", slug));
    let final_dir = skills_dir.join(&slug);

    if archive_path.exists() {
        fs::remove_file(&archive_path)
            .map_err(|e| format!("failed to clear previous skill archive: {e}"))?;
    }
    if staging_dir.exists() {
        fs::remove_dir_all(&staging_dir)
            .map_err(|e| format!("failed to clear previous skill staging dir: {e}"))?;
    }
    if final_dir.exists() {
        fs::remove_dir_all(&final_dir)
            .map_err(|e| format!("failed to clear previous managed skill dir: {e}"))?;
    }

    fs::create_dir_all(&staging_dir)
        .map_err(|e| format!("failed to create skill staging dir: {e}"))?;
    download_file_with_optional_sha256(
        app,
        &artifact_url,
        &archive_path,
        input.artifact_sha256.clone(),
    )?;

    if archive_format == "zip" {
        extract_zip_archive(&archive_path, &staging_dir)?;
    } else {
        extract_tar_gz_archive(&archive_path, &staging_dir)?;
    }

    let normalized_root = normalize_skill_root(&staging_dir)?;
    if normalized_root == staging_dir {
        fs::rename(&staging_dir, &final_dir)
            .map_err(|e| format!("failed to activate managed skill: {e}"))?;
    } else {
        fs::rename(&normalized_root, &final_dir)
            .map_err(|e| format!("failed to activate managed skill: {e}"))?;
        if staging_dir.exists() {
            let _ = fs::remove_dir_all(&staging_dir);
        }
    }

    let receipt = ManagedSkillInstallReceipt {
        slug: slug.clone(),
        version: version.clone(),
        source: input
            .source
            .clone()
            .unwrap_or_else(|| String::from("cloud")),
        installed_at: timestamp_string(),
        artifact_url: Some(artifact_url),
        artifact_sha256: input.artifact_sha256.clone(),
    };
    write_managed_skill_receipt(&final_dir, &receipt)?;

    Ok(ManagedSkillInstallRecord {
        slug,
        version,
        source: receipt.source,
        installed_at: receipt.installed_at,
        path: final_dir.to_string_lossy().to_string(),
    })
}

fn remove_managed_skill_internal(app: &AppHandle, slug: &str) -> Result<bool, String> {
    let normalized = slug.trim();
    if normalized.is_empty() {
        return Err(String::from("skill slug is required"));
    }
    let target = openclaw_managed_skills_dir(app)?.join(normalized);
    if !target.exists() {
        return Ok(false);
    }
    fs::remove_dir_all(&target).map_err(|e| format!("failed to remove managed skill: {e}"))?;
    Ok(true)
}

fn import_client() -> Result<Client, String> {
    Client::builder()
        .connect_timeout(Duration::from_secs(20))
        .timeout(Duration::from_secs(1800))
        .user_agent("iClaw Desktop Skill Importer")
        .build()
        .map_err(|e| format!("failed to build import http client: {e}"))
}

fn upload_private_skill(
    auth_base_url: &str,
    access_token: &str,
    metadata: &ImportableSkillMetadata,
    source_kind: &str,
    source_url: Option<String>,
    archive_bytes: Vec<u8>,
) -> Result<ImportedSkillCatalogEntry, String> {
    let client = import_client()?;
    let endpoint = format!(
        "{}/skills/library/import",
        auth_base_url.trim_end_matches('/')
    );
    let sha256 = sha256_hex(&archive_bytes);
    let payload = PrivateSkillImportRequest {
        slug: metadata.slug.clone(),
        name: metadata.name.clone(),
        description: metadata.description.clone(),
        market: metadata.market.clone(),
        category: metadata.category.clone(),
        skill_type: metadata.skill_type.clone(),
        publisher: metadata.publisher.clone(),
        tags: metadata.tags.clone(),
        source_kind: source_kind.to_string(),
        source_url,
        version: metadata.version.clone(),
        artifact_format: String::from("tar.gz"),
        artifact_sha256: Some(sha256),
        artifact_base64: base64::engine::general_purpose::STANDARD.encode(archive_bytes),
    };
    let response = client
        .post(endpoint)
        .bearer_auth(access_token.trim())
        .json(&payload)
        .send()
        .and_then(|resp| resp.error_for_status())
        .map_err(|e| format!("failed to upload imported skill: {e}"))?;
    response
        .json::<ControlPlaneEnvelope<ImportedSkillCatalogEntry>>()
        .map(|value| value.data)
        .map_err(|e| format!("failed to parse imported skill response: {e}"))
}

fn install_imported_skill_from_catalog(
    app: &AppHandle,
    entry: ImportedSkillCatalogEntry,
) -> Result<ImportedSkillRecord, String> {
    let artifact_url = entry
        .artifact_url
        .ok_or_else(|| String::from("control-plane did not return imported skill artifact url"))?;
    install_managed_skill_internal(
        app,
        ManagedSkillInstallInput {
            slug: entry.slug.clone(),
            version: entry.version.clone(),
            artifact_url,
            artifact_sha256: entry.artifact_sha256,
            artifact_format: Some(entry.artifact_format),
            source: Some(String::from("private")),
        },
    )?;
    Ok(ImportedSkillRecord {
        slug: entry.slug,
        version: entry.version,
        name: entry.name,
        source: String::from("private"),
    })
}

fn import_skill_from_directory(
    app: &AppHandle,
    skill_root: &Path,
    auth_base_url: &str,
    access_token: &str,
    source_kind: &str,
    source_url: Option<String>,
    publisher_fallback: Option<String>,
) -> Result<ImportedSkillRecord, String> {
    let metadata = load_importable_skill_metadata(skill_root, publisher_fallback)?;
    let archive = package_skill_directory(skill_root, &metadata.slug)?;
    let entry = upload_private_skill(
        auth_base_url,
        access_token,
        &metadata,
        source_kind,
        source_url,
        archive,
    )?;
    install_imported_skill_from_catalog(app, entry)
}

fn import_github_skill_internal(
    app: &AppHandle,
    input: ImportGithubSkillInput,
) -> Result<ImportedSkillRecord, String> {
    let repo_url = input.repo_url.trim();
    if repo_url.is_empty() {
        return Err(String::from("GitHub 仓库链接不能为空"));
    }
    let zipball_url = github_zipball_url(repo_url)?;
    let downloads_dir = app_data_base_dir(app)?.join("skill-imports");
    fs::create_dir_all(&downloads_dir)
        .map_err(|e| format!("failed to create skill imports dir: {e}"))?;
    let archive_path = downloads_dir.join(format!("github-import-{}.zip", timestamp_string()));
    let staging_dir = downloads_dir.join(format!("github-import-{}.partial", timestamp_string()));
    if archive_path.exists() {
        let _ = fs::remove_file(&archive_path);
    }
    if staging_dir.exists() {
        let _ = fs::remove_dir_all(&staging_dir);
    }
    fs::create_dir_all(&staging_dir)
        .map_err(|e| format!("failed to create github import staging dir: {e}"))?;
    download_file_with_optional_sha256(app, &zipball_url, &archive_path, None)?;
    extract_zip_archive(&archive_path, &staging_dir)?;
    let skill_root = discover_skill_root(&staging_dir)?;
    let result = import_skill_from_directory(
        app,
        &skill_root,
        &input.auth_base_url,
        &input.access_token,
        "github",
        Some(repo_url.to_string()),
        extract_github_owner(repo_url),
    );
    let _ = fs::remove_file(&archive_path);
    let _ = fs::remove_dir_all(&staging_dir);
    result
}

fn import_local_skill_internal(
    app: &AppHandle,
    input: ImportLocalSkillInput,
) -> Result<Option<ImportedSkillRecord>, String> {
    let selected = FileDialog::new().set_title("选择技能目录").pick_folder();
    let Some(selected_dir) = selected else {
        return Ok(None);
    };
    let skill_root = discover_skill_root(&selected_dir)?;
    let result = import_skill_from_directory(
        app,
        &skill_root,
        &input.auth_base_url,
        &input.access_token,
        "local",
        Some(selected_dir.to_string_lossy().to_string()),
        None,
    )?;
    Ok(Some(result))
}

fn resource_extra_ca_certs_path(app: &AppHandle) -> PathBuf {
    if let Ok(resource_dir) = app.path().resource_dir() {
        let p = resource_dir
            .join("resources")
            .join("certs")
            .join("isrg-root-x1.pem");
        if p.exists() {
            return p;
        }
    }
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("resources")
        .join("certs")
        .join("isrg-root-x1.pem")
}

fn resource_node_fetch_user_agent_hook_path(app: &AppHandle) -> PathBuf {
    if let Ok(resource_dir) = app.path().resource_dir() {
        let p = resource_dir
            .join("resources")
            .join("runtime")
            .join("node-fetch-user-agent.cjs");
        if p.exists() {
            return p;
        }
    }

    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("resources")
        .join("runtime")
        .join("node-fetch-user-agent.cjs")
}

fn resource_runtime_config_generator_path(app: &AppHandle) -> PathBuf {
    if let Ok(resource_dir) = app.path().resource_dir() {
        let p = resource_dir
            .join("resources")
            .join("runtime")
            .join("generate-openclaw-config.mjs");
        if p.exists() {
            return p;
        }
    }

    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("resources")
        .join("runtime")
        .join("generate-openclaw-config.mjs")
}

fn resolve_runtime_node_path(app: &AppHandle) -> Result<PathBuf, String> {
    let runtime = resolve_runtime_command(app)?;
    let runtime_dir = runtime
        .display_path
        .parent()
        .ok_or_else(|| String::from("failed to resolve runtime launcher dir"))?;
    let node_name = if cfg!(target_os = "windows") {
        "node.exe"
    } else {
        "node"
    };
    let node_path = runtime_dir.join("bin").join(node_name);
    if node_path.exists() {
        Ok(node_path)
    } else {
        Err(format!(
            "failed to resolve bundled runtime node at {}",
            node_path.to_string_lossy()
        ))
    }
}

fn append_node_options_arg(existing: Option<String>, arg: &str) -> String {
    let trimmed_arg = arg.trim();
    let current = existing.unwrap_or_default();
    if trimmed_arg.is_empty() || current.contains(trimmed_arg) {
        return current;
    }
    if current.trim().is_empty() {
        trimmed_arg.to_string()
    } else {
        format!("{current} {trimmed_arg}")
    }
}

fn configure_runtime_network_env(command: &mut Command, app: &AppHandle) {
    let hook_path = resource_node_fetch_user_agent_hook_path(app);
    if hook_path.exists() {
        let require_arg = format!("--require={}", hook_path.to_string_lossy());
        let next_node_options = append_node_options_arg(env::var("NODE_OPTIONS").ok(), &require_arg);
        if !next_node_options.trim().is_empty() {
            command.env("NODE_OPTIONS", next_node_options);
        }
    }
}

fn app_data_base_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let p = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("failed to resolve app_data_dir: {e}"))?;
    Ok(p.join("openclaw"))
}

fn runtime_download_configured(config: &RuntimeBootstrapConfig) -> bool {
    clean_optional(config.artifact_url.clone()).is_some()
}

fn runtime_archive_format(config: &RuntimeBootstrapConfig, url: &str) -> Result<String, String> {
    if let Some(format) = clean_optional(config.artifact_format.clone()) {
        return match format.as_str() {
            "tar.gz" | "tgz" => Ok(String::from("tar.gz")),
            "zip" => Ok(String::from("zip")),
            _ => Err(format!("unsupported runtime artifact format: {format}")),
        };
    }

    if url.ends_with(".zip") {
        Ok(String::from("zip"))
    } else if url.ends_with(".tar.gz") || url.ends_with(".tgz") {
        Ok(String::from("tar.gz"))
    } else {
        Err(String::from(
            "cannot infer runtime artifact format from URL; set artifact_format to zip or tar.gz",
        ))
    }
}

fn runtime_downloads_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = runtime_install_root(app)?.join("downloads");
    fs::create_dir_all(&dir).map_err(|e| format!("failed to create runtime downloads dir: {e}"))?;
    Ok(dir)
}

fn emit_runtime_install_progress(
    app: &AppHandle,
    phase: &str,
    progress: u8,
    label: &str,
    detail: &str,
) {
    let payload = RuntimeInstallProgress {
        phase: String::from(phase),
        progress,
        label: String::from(label),
        detail: String::from(detail),
    };
    let _ = app.emit("runtime-install-progress", payload);
}

fn desktop_update_pubkey() -> Option<String> {
    if let Ok(value) = env::var("TAURI_UPDATER_PUBLIC_KEY") {
        let trimmed = value.trim();
        if !trimmed.is_empty() {
            return Some(String::from(trimmed));
        }
    }
    DESKTOP_UPDATER_PUBLIC_KEY
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(String::from)
}

fn normalize_desktop_update_channel(value: Option<String>) -> String {
    let normalized = value.unwrap_or_else(|| String::from("prod"));
    let trimmed = normalized.trim().to_lowercase();
    if trimmed == "dev" {
        String::from("dev")
    } else {
        String::from("prod")
    }
}

fn desktop_update_endpoint(input: &DesktopUpdateCommandInput) -> Result<String, String> {
    let base_url = input.auth_base_url.trim().trim_end_matches('/');
    if base_url.is_empty() {
        return Err(String::from("desktop updater auth base url is required"));
    }
    if !base_url.starts_with("https://") {
        return Err(String::from(
            "desktop updater requires an https auth base url",
        ));
    }
    let channel = normalize_desktop_update_channel(input.channel.clone());
    let app_name = input
        .app_name
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .unwrap_or("");
    let app_name_query = if app_name.is_empty() {
        String::new()
    } else {
        format!("&app_name={app_name}")
    };
    Ok(format!(
        "{base_url}/desktop/update?current_version={{{{current_version}}}}&target={{{{target}}}}&arch={{{{arch}}}}&channel={channel}{app_name_query}"
    ))
}

fn parse_raw_update_flag(raw_json: &serde_json::Value, key: &str) -> bool {
    raw_json
        .get(key)
        .and_then(|value| value.as_bool())
        .unwrap_or(false)
}

fn parse_raw_update_string(raw_json: &serde_json::Value, key: &str) -> Option<String> {
    raw_json
        .get(key)
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(String::from)
}

fn emit_desktop_update_progress(
    app: &AppHandle,
    phase: &str,
    progress: u8,
    version: Option<String>,
    downloaded_bytes: Option<u64>,
    total_bytes: Option<u64>,
    detail: &str,
) {
    let payload = DesktopUpdateProgress {
        phase: String::from(phase),
        progress,
        version,
        downloaded_bytes,
        total_bytes,
        detail: String::from(detail),
    };
    let _ = app.emit("desktop-update-progress", payload);
}

fn map_download_progress(completed: u64, total: u64) -> u8 {
    if total == 0 {
        return 10;
    }
    let ratio = (completed as f64 / total as f64).clamp(0.0, 1.0);
    let progress = 10.0 + ratio * 48.0;
    progress.round() as u8
}

fn local_artifact_path(app: &AppHandle, value: &str) -> Option<PathBuf> {
    if let Some(rest) = value.strip_prefix("file://") {
        return Some(PathBuf::from(rest));
    }

    let candidate = expand_tilde(app, value);
    if candidate.is_absolute() || candidate.exists() {
        return Some(candidate);
    }

    None
}

fn download_runtime_archive(
    app: &AppHandle,
    url: &str,
    archive_path: &Path,
    expected_sha256: Option<String>,
) -> Result<(), String> {
    emit_runtime_install_progress(
        app,
        "download",
        10,
        "正在下载核心组件",
        "拉取首次启动所需的本地运行时组件。",
    );
    if let Some(local_path) = local_artifact_path(app, url) {
        let mut input = File::open(&local_path).map_err(|e| {
            format!(
                "failed to open local runtime archive {}: {e}",
                local_path.to_string_lossy()
            )
        })?;
        let mut output = File::create(archive_path)
            .map_err(|e| format!("failed to create runtime archive file: {e}"))?;
        let mut hasher = Sha256::new();
        let mut buffer = [0_u8; 16 * 1024];
        let total_bytes = input.metadata().ok().map(|meta| meta.len()).unwrap_or(0);
        let mut copied_bytes = 0_u64;
        let mut last_progress = 10_u8;

        loop {
            let read = input
                .read(&mut buffer)
                .map_err(|e| format!("failed to read local runtime archive: {e}"))?;
            if read == 0 {
                break;
            }
            copied_bytes += read as u64;
            hasher.update(&buffer[..read]);
            output
                .write_all(&buffer[..read])
                .map_err(|e| format!("failed to write runtime archive file: {e}"))?;
            let progress = map_download_progress(copied_bytes, total_bytes);
            if progress > last_progress {
                last_progress = progress;
                emit_runtime_install_progress(
                    app,
                    "download",
                    progress,
                    "正在下载核心组件",
                    "正在复制本地运行时包并同步安装进度。",
                );
            }
        }

        emit_runtime_install_progress(
            app,
            "verify",
            62,
            "正在校验文件完整性",
            "核对运行时包摘要并检查文件完整性。",
        );
        if let Some(expected) = clean_optional(expected_sha256) {
            let actual = format!("{:x}", hasher.finalize());
            if actual != expected.to_ascii_lowercase() {
                return Err(format!(
                    "runtime archive sha256 mismatch: expected {expected}, got {actual}"
                ));
            }
        }

        return Ok(());
    }

    let client = Client::builder()
        .connect_timeout(Duration::from_secs(20))
        .timeout(Duration::from_secs(1800))
        .build()
        .map_err(|e| format!("failed to build runtime downloader: {e}"))?;
    let mut response = client
        .get(url)
        .send()
        .and_then(|resp| resp.error_for_status())
        .map_err(|e| format!("failed to download openclaw runtime: {e}"))?;
    let mut file = File::create(archive_path)
        .map_err(|e| format!("failed to create runtime archive file: {e}"))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 16 * 1024];
    let total_bytes = response.content_length().unwrap_or(0);
    let mut downloaded_bytes = 0_u64;
    let mut last_progress = 10_u8;

    loop {
        let read = response
            .read(&mut buffer)
            .map_err(|e| format!("failed to read runtime archive response: {e}"))?;
        if read == 0 {
            break;
        }
        downloaded_bytes += read as u64;
        hasher.update(&buffer[..read]);
        file.write_all(&buffer[..read])
            .map_err(|e| format!("failed to write runtime archive file: {e}"))?;
        let progress = map_download_progress(downloaded_bytes, total_bytes);
        if progress > last_progress {
            last_progress = progress;
            emit_runtime_install_progress(
                app,
                "download",
                progress,
                "正在下载核心组件",
                "正在获取运行时组件并写入本地缓存。",
            );
        }
    }

    emit_runtime_install_progress(
        app,
        "verify",
        62,
        "正在校验文件完整性",
        "核对运行时包摘要并检查文件完整性。",
    );
    if let Some(expected) = clean_optional(expected_sha256) {
        let actual = format!("{:x}", hasher.finalize());
        if actual != expected.to_ascii_lowercase() {
            return Err(format!(
                "runtime archive sha256 mismatch: expected {expected}, got {actual}"
            ));
        }
    }

    Ok(())
}

fn extract_tar_gz_archive(archive_path: &Path, dest_dir: &Path) -> Result<(), String> {
    let archive_file =
        File::open(archive_path).map_err(|e| format!("failed to open runtime tarball: {e}"))?;
    let decoder = GzDecoder::new(archive_file);
    let mut archive = tar::Archive::new(decoder);
    archive
        .unpack(dest_dir)
        .map_err(|e| format!("failed to extract runtime tarball: {e}"))
}

fn extract_zip_archive(archive_path: &Path, dest_dir: &Path) -> Result<(), String> {
    let archive_file =
        File::open(archive_path).map_err(|e| format!("failed to open runtime zip: {e}"))?;
    let mut archive =
        ZipArchive::new(archive_file).map_err(|e| format!("failed to read runtime zip: {e}"))?;

    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|e| format!("failed to read runtime zip entry: {e}"))?;
        let relative = entry
            .enclosed_name()
            .ok_or_else(|| String::from("runtime zip contains invalid path"))?;
        let output_path = dest_dir.join(relative);

        if entry.is_dir() {
            fs::create_dir_all(&output_path)
                .map_err(|e| format!("failed to create runtime zip dir: {e}"))?;
            continue;
        }

        if let Some(parent) = output_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("failed to create runtime zip parent dir: {e}"))?;
        }

        let mut output = File::create(&output_path)
            .map_err(|e| format!("failed to create runtime file: {e}"))?;
        std::io::copy(&mut entry, &mut output)
            .map_err(|e| format!("failed to extract runtime file: {e}"))?;
    }

    Ok(())
}

fn normalize_runtime_root(
    extracted_dir: &Path,
    config: &RuntimeBootstrapConfig,
) -> Result<PathBuf, String> {
    if find_runtime_launcher(extracted_dir, config).is_some() {
        return Ok(extracted_dir.to_path_buf());
    }

    let mut child_dirs = Vec::new();
    for entry in
        fs::read_dir(extracted_dir).map_err(|e| format!("failed to scan runtime dir: {e}"))?
    {
        let entry = entry.map_err(|e| format!("failed to scan runtime dir entry: {e}"))?;
        let path = entry.path();
        if path.is_dir() {
            child_dirs.push(path);
        }
    }

    if child_dirs.len() == 1 && find_runtime_launcher(&child_dirs[0], config).is_some() {
        return Ok(child_dirs.remove(0));
    }

    Err(String::from(
        "runtime artifact extracted successfully but launcher was not found",
    ))
}

#[cfg(unix)]
fn set_executable_if_exists(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Ok(());
    }
    let mut perms = fs::metadata(path)
        .map_err(|e| format!("failed to read runtime file metadata: {e}"))?
        .permissions();
    perms.set_mode(0o755);
    fs::set_permissions(path, perms).map_err(|e| format!("failed to set runtime permissions: {e}"))
}

#[cfg(not(unix))]
fn set_executable_if_exists(path: &Path) -> Result<(), String> {
    let _ = path;
    Ok(())
}

fn ensure_runtime_permissions(root: &Path, config: &RuntimeBootstrapConfig) -> Result<(), String> {
    set_executable_if_exists(&root.join(runtime_launcher_relative_path(config)))?;
    set_executable_if_exists(&root.join("bin").join("node"))?;
    set_executable_if_exists(&root.join("bin").join("node.exe"))?;
    Ok(())
}

fn install_runtime_internal(app: &AppHandle) -> Result<PathBuf, String> {
    emit_runtime_install_progress(
        app,
        "prepare",
        4,
        "正在准备安装组件",
        "检查运行时版本、清理旧的临时目录并准备安装路径。",
    );
    let config = load_runtime_bootstrap_config(app)?;
    let artifact_url = clean_optional(config.artifact_url.clone())
        .ok_or_else(|| String::from("openclaw runtime download URL is not configured"))?;
    let artifact_format = runtime_archive_format(&config, &artifact_url)?;
    let version_label = runtime_version_label(&config);
    let final_dir = installed_runtime_dir(app, &config)?;

    if installed_runtime_matches(&final_dir, &config) {
        emit_runtime_install_progress(
            app,
            "complete",
            100,
            "iClaw 已就绪",
            "运行环境已存在，无需重复安装。",
        );
        return Ok(final_dir);
    }

    let archive_ext = if artifact_format == "zip" {
        "zip"
    } else {
        "tar.gz"
    };
    let archive_path =
        runtime_downloads_dir(app)?.join(format!("openclaw-runtime-{version_label}.{archive_ext}"));
    let staging_dir = runtime_install_root(app)?
        .join("versions")
        .join(format!("{version_label}.partial"));

    if archive_path.exists() {
        fs::remove_file(&archive_path)
            .map_err(|e| format!("failed to clear previous runtime archive: {e}"))?;
    }
    if staging_dir.exists() {
        fs::remove_dir_all(&staging_dir)
            .map_err(|e| format!("failed to clear previous runtime staging dir: {e}"))?;
    }
    if final_dir.exists() {
        fs::remove_dir_all(&final_dir)
            .map_err(|e| format!("failed to clear previous runtime install dir: {e}"))?;
    }

    fs::create_dir_all(&staging_dir)
        .map_err(|e| format!("failed to create runtime staging dir: {e}"))?;
    download_runtime_archive(
        app,
        &artifact_url,
        &archive_path,
        config.artifact_sha256.clone(),
    )?;

    emit_runtime_install_progress(
        app,
        "extract",
        74,
        "正在部署本地运行环境",
        "展开运行时文件并准备写入最终目录。",
    );
    if artifact_format == "zip" {
        extract_zip_archive(&archive_path, &staging_dir)?;
    } else {
        extract_tar_gz_archive(&archive_path, &staging_dir)?;
    }

    emit_runtime_install_progress(
        app,
        "finalize",
        88,
        "正在整理本地运行环境",
        "校准目录结构、清理临时文件并设置运行权限。",
    );
    let normalized_root = normalize_runtime_root(&staging_dir, &config)?;
    if normalized_root == staging_dir {
        fs::rename(&staging_dir, &final_dir)
            .map_err(|e| format!("failed to activate installed runtime: {e}"))?;
    } else {
        fs::rename(&normalized_root, &final_dir)
            .map_err(|e| format!("failed to activate installed runtime: {e}"))?;
        if staging_dir.exists() {
            let _ = fs::remove_dir_all(&staging_dir);
        }
    }

    ensure_runtime_permissions(&final_dir, &config)?;

    if find_runtime_launcher(&final_dir, &config).is_none() {
        return Err(String::from(
            "runtime install completed but launcher is still missing",
        ));
    }

    emit_runtime_install_progress(
        app,
        "finalize",
        96,
        "正在完成最后配置",
        "写入安装回执并校验启动器是否可用。",
    );
    write_runtime_install_receipt(&final_dir, &config)?;

    emit_runtime_install_progress(
        app,
        "complete",
        100,
        "iClaw 已就绪",
        "本地运行环境部署完成，准备启动服务。",
    );

    Ok(final_dir)
}

fn generate_gateway_token() -> String {
    let mut bytes = [0_u8; 32];
    OsRng.fill_bytes(&mut bytes);
    bytes
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<Vec<_>>()
        .join("")
}

fn shared_gateway_token_path(app: &AppHandle) -> Result<PathBuf, String> {
    let home = app
        .path()
        .home_dir()
        .map_err(|e| format!("failed to resolve home dir: {e}"))?;
    let dir = home.join(SHARED_GATEWAY_TOKEN_DIR);
    fs::create_dir_all(&dir).map_err(|e| {
        format!(
            "failed to create shared gateway token dir {}: {e}",
            dir.to_string_lossy()
        )
    })?;
    Ok(dir.join(SHARED_GATEWAY_TOKEN_FILE))
}

fn read_gateway_token_file(path: &Path) -> Result<Option<String>, String> {
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(path).map_err(|e| {
        format!(
            "failed to read shared gateway token {}: {e}",
            path.to_string_lossy()
        )
    })?;
    let token = raw.trim();
    if token.is_empty() {
        return Ok(None);
    }
    Ok(Some(token.to_string()))
}

fn write_gateway_token_file(path: &Path, token: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| {
            format!(
                "failed to create shared gateway token parent {}: {e}",
                parent.to_string_lossy()
            )
        })?;
    }
    fs::write(path, format!("{}\n", token.trim())).map_err(|e| {
        format!(
            "failed to write shared gateway token {}: {e}",
            path.to_string_lossy()
        )
    })?;
    #[cfg(unix)]
    {
        fs::set_permissions(path, fs::Permissions::from_mode(0o600)).map_err(|e| {
            format!(
                "failed to lock shared gateway token permissions {}: {e}",
                path.to_string_lossy()
            )
        })?;
    }
    Ok(())
}

fn sync_gateway_token_keyring(token: &str) -> Result<(), String> {
    let entry = Entry::new(AUTH_SERVICE, AUTH_GATEWAY_TOKEN_KEY).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(current) if current.trim() == token.trim() => Ok(()),
        Ok(_) | Err(keyring::Error::NoEntry) => {
            entry
                .set_password(token.trim())
                .map_err(|e| format!("failed to sync gateway token keyring: {e}"))
        }
        Err(e) => Err(e.to_string()),
    }
}

fn load_or_create_gateway_token(app: &AppHandle) -> Result<String, String> {
    let shared_path = shared_gateway_token_path(app)?;

    let explicit_env = env::var("ICLAW_GATEWAY_TOKEN")
        .ok()
        .or_else(|| env::var("OPENCLAW_GATEWAY_TOKEN").ok())
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    if let Some(token) = explicit_env {
        write_gateway_token_file(&shared_path, &token)?;
        sync_gateway_token_keyring(&token)?;
        return Ok(token);
    }

    if let Some(token) = read_gateway_token_file(&shared_path)? {
        sync_gateway_token_keyring(&token)?;
        return Ok(token);
    }

    let entry = Entry::new(AUTH_SERVICE, AUTH_GATEWAY_TOKEN_KEY).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(token) if !token.trim().is_empty() => {
            let normalized = token.trim().to_string();
            write_gateway_token_file(&shared_path, &normalized)?;
            Ok(normalized)
        }
        Ok(_) | Err(keyring::Error::NoEntry) => {
            let token = generate_gateway_token();
            write_gateway_token_file(&shared_path, &token)?;
            sync_gateway_token_keyring(&token)?;
            Ok(token)
        }
        Err(e) => Err(e.to_string()),
    }
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

fn is_loopback_port_occupied(port: u16) -> bool {
    TcpListener::bind(("127.0.0.1", port)).is_err()
}

fn configured_sidecar_port() -> u16 {
    let mut saw_port_flag = false;
    for token in DESKTOP_SIDE_CAR_ARGS.split_whitespace() {
        if saw_port_flag {
            if let Ok(port) = token.parse::<u16>() {
                return port;
            }
            saw_port_flag = false;
            continue;
        }
        if token == "--port" {
            saw_port_flag = true;
            continue;
        }
        if let Some(value) = token.strip_prefix("--port=") {
            if let Ok(port) = value.parse::<u16>() {
                return port;
            }
        }
    }
    2126
}

fn detect_local_service_port_conflicts() -> Vec<u16> {
    let mut ports = vec![configured_sidecar_port()];
    ports.sort_unstable();
    ports.dedup();
    ports.into_iter()
        .filter(|port| is_loopback_port_occupied(*port))
        .collect()
}

fn should_reuse_existing_local_sidecar(occupied_ports: &[u16]) -> bool {
    occupied_ports.len() == 1 && occupied_ports[0] == configured_sidecar_port()
}

fn listen_port_targets() -> Vec<u16> {
    let mut ports = vec![configured_sidecar_port()];
    ports.sort_unstable();
    ports.dedup();
    ports
}

fn port_listener_pids(port: u16) -> Vec<u32> {
    let output = match Command::new("lsof")
        .args(["-nP", &format!("-iTCP:{port}"), "-sTCP:LISTEN", "-t"])
        .output()
    {
        Ok(output) if output.status.success() => output,
        _ => return Vec::new(),
    };

    String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter_map(|line| line.trim().parse::<u32>().ok())
        .collect()
}

fn inspect_process(pid: u32) -> Option<ListeningProcess> {
    let command_output = Command::new("ps")
        .args(["-p", &pid.to_string(), "-o", "command="])
        .output()
        .ok()?;
    if !command_output.status.success() {
        return None;
    }

    let command = String::from_utf8_lossy(&command_output.stdout)
        .trim()
        .to_string();
    if command.is_empty() {
        return None;
    }

    let details_output = Command::new("lsof")
        .args(["-p", &pid.to_string()])
        .output()
        .ok()?;
    let details = if details_output.status.success() {
        String::from_utf8_lossy(&details_output.stdout).to_string()
    } else {
        String::new()
    };

    Some(ListeningProcess {
        pid,
        command,
        details,
    })
}

fn process_is_managed_local_service(process: &ListeningProcess, app: &AppHandle) -> bool {
    let runtime_root = match app_data_base_dir(app) {
        Ok(base) => base.join("runtime"),
        Err(_) => return false,
    };
    let runtime_root_text = runtime_root.to_string_lossy();

    process.command.contains("openclaw-gateway")
        || process.command.contains("openclaw-runtime")
        || process.details.contains(runtime_root_text.as_ref())
}

fn terminate_pid(pid: u32) -> bool {
    Command::new("kill")
        .args(["-TERM", &pid.to_string()])
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

fn reclaim_managed_local_service_ports(app: &AppHandle) {
    let mut pids = Vec::new();

    for port in listen_port_targets() {
        for pid in port_listener_pids(port) {
            if pids.contains(&pid) {
                continue;
            }
            if let Some(process) = inspect_process(pid) {
                if process_is_managed_local_service(&process, app) {
                    pids.push(process.pid);
                }
            }
        }
    }

    if pids.is_empty() {
        return;
    }

    for pid in pids {
        let _ = terminate_pid(pid);
    }

    for _ in 0..20 {
        if detect_local_service_port_conflicts().is_empty() {
            break;
        }
        std::thread::sleep(Duration::from_millis(150));
    }
}

fn runtime_config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app_data_base_dir(app)?;
    fs::create_dir_all(&base).map_err(|e| format!("failed to create app_data base dir: {e}"))?;
    Ok(base.join("config.json"))
}

fn oem_runtime_snapshot_path(app: &AppHandle) -> Result<PathBuf, String> {
    let path = app_data_base_dir(app)?
        .join("config")
        .join("oem-runtime-snapshot.json");
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("failed to create OEM runtime snapshot dir: {e}"))?;
    }
    Ok(path)
}

fn openclaw_state_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app_data_base_dir(app)?.join("state");
    fs::create_dir_all(&dir).map_err(|e| format!("failed to create openclaw state dir: {e}"))?;
    Ok(dir)
}

fn openclaw_config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let path = app_data_base_dir(app)?.join("config").join("openclaw.json");
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("failed to create openclaw config dir: {e}"))?;
    }
    Ok(path)
}

fn desktop_window_state_path(app: &AppHandle) -> Result<PathBuf, String> {
    let path = app_data_base_dir(app)?.join("config").join("window-state.json");
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("failed to create window state dir: {e}"))?;
    }
    Ok(path)
}

fn desktop_client_config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let path = app_data_base_dir(app)?
        .join("config")
        .join("desktop-client-config.json");
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("failed to create desktop client config dir: {e}"))?;
    }
    Ok(path)
}

fn load_desktop_window_state(app: &AppHandle) -> Result<Option<DesktopWindowStateSnapshot>, String> {
    let path = desktop_window_state_path(app)?;
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(&path)
        .map_err(|e| format!("failed to read window state {}: {e}", path.to_string_lossy()))?;
    let parsed = serde_json::from_str::<DesktopWindowStateSnapshot>(&raw)
        .map_err(|e| format!("failed to parse window state {}: {e}", path.to_string_lossy()))?;
    if parsed.width == 0 || parsed.height == 0 {
        return Ok(None);
    }
    Ok(Some(parsed))
}

fn save_desktop_window_state(
    app: &AppHandle,
    snapshot: &DesktopWindowStateSnapshot,
) -> Result<(), String> {
    let path = desktop_window_state_path(app)?;
    let raw = serde_json::to_string_pretty(snapshot)
        .map_err(|e| format!("failed to serialize window state: {e}"))?;
    fs::write(&path, format!("{raw}\n"))
        .map_err(|e| format!("failed to write window state {}: {e}", path.to_string_lossy()))
}

fn persist_window_state_from_metrics(
    app: &AppHandle,
    size: PhysicalSize<u32>,
    position: PhysicalPosition<i32>,
) {
    let snapshot = DesktopWindowStateSnapshot {
        width: size.width,
        height: size.height,
        position_x: position.x,
        position_y: position.y,
    };
    let _ = save_desktop_window_state(app, &snapshot);
}

fn persist_desktop_window_state(window: &tauri::Window) {
    let Ok(size) = window.inner_size() else {
        return;
    };
    let Ok(position) = window.outer_position() else {
        return;
    };
    persist_window_state_from_metrics(&window.app_handle(), size, position);
}

fn persist_desktop_webview_window_state(window: &tauri::WebviewWindow) {
    let Ok(size) = window.inner_size() else {
        return;
    };
    let Ok(position) = window.outer_position() else {
        return;
    };
    persist_window_state_from_metrics(&window.app_handle(), size, position);
}

fn resolve_desktop_auth_base_url() -> String {
    let configured = DESKTOP_AUTH_BASE_URL.trim().trim_end_matches('/');
    if configured.is_empty() {
        String::from(LOCAL_CONTROL_PLANE_URL)
    } else {
        configured.to_string()
    }
}

fn resolve_active_oem_brand_id(app: &AppHandle) -> String {
    if let Ok(Some(snapshot)) = load_oem_runtime_snapshot_internal(app) {
        let brand_id = snapshot.brand_id.trim();
        if !brand_id.is_empty() {
            return String::from(brand_id);
        }
    }
    String::from(DESKTOP_BRAND_ID.trim())
}

fn sync_current_brand_runtime_snapshot(app: &AppHandle) -> Result<bool, String> {
    let brand_id = resolve_active_oem_brand_id(app);
    if brand_id.is_empty() {
        return Ok(false);
    }
    sync_oem_runtime_snapshot(
        app.clone(),
        resolve_desktop_auth_base_url(),
        brand_id,
    )
}

fn ensure_current_brand_runtime_skills(app: &AppHandle, context: &str) -> Result<bool, String> {
    match sync_current_brand_runtime_skills(app, &resolve_desktop_auth_base_url()) {
        Ok(changed) => Ok(changed),
        Err(error) => {
            if runtime_skills_manifest_path(app).exists() {
                eprintln!(
                    "failed to sync runtime skills before {context}; reusing last cached runtime skills: {error}"
                );
                Ok(false)
            } else {
                Err(format!(
                    "failed to sync runtime skills before {context}: {error}"
                ))
            }
        }
    }
}

fn load_oem_runtime_snapshot_internal(app: &AppHandle) -> Result<Option<OemRuntimeSnapshot>, String> {
    let snapshot_path = oem_runtime_snapshot_path(app)?;
    if !snapshot_path.exists() {
        return Ok(None);
    }

    let raw = fs::read_to_string(&snapshot_path).map_err(|e| {
        format!(
            "failed to read OEM runtime snapshot {}: {e}",
            snapshot_path.to_string_lossy()
        )
    })?;
    let snapshot = serde_json::from_str::<OemRuntimeSnapshot>(&raw).map_err(|e| {
        format!(
            "failed to parse OEM runtime snapshot {}: {e}",
            snapshot_path.to_string_lossy()
        )
    })?;
    Ok(Some(snapshot))
}

fn ensure_openclaw_runtime_config(app: &AppHandle, gateway_token: &str) -> Result<PathBuf, String> {
    let config_path = openclaw_config_path(app)?;
    let runtime_config_path = runtime_config_path(app)?;
    let generator_path = resource_runtime_config_generator_path(app);
    let node_path = resolve_runtime_node_path(app)?;
    let workspace_dir = openclaw_workspace_dir(app);
    let snapshot_path = oem_runtime_snapshot_path(app)?;
    let mut command = Command::new(&node_path);
    command.arg(&generator_path);
    command.env("ICLAW_OPENCLAW_CONFIG_PATH", &config_path);
    command.env("ICLAW_OPENCLAW_RUNTIME_CONFIG_PATH", &runtime_config_path);
    command.env("ICLAW_OPENCLAW_GATEWAY_TOKEN", gateway_token);
    command.env("ICLAW_OPENCLAW_WORKSPACE_DIR", workspace_dir);
    command.env("ICLAW_OPENCLAW_RUNTIME_MODE", "prod");
    command.env(
        "ICLAW_OPENCLAW_ALLOWED_ORIGINS",
        "tauri://localhost,http://tauri.localhost,https://tauri.localhost",
    );
    if snapshot_path.exists() {
        command.env("ICLAW_OPENCLAW_OEM_RUNTIME_SNAPSHOT_PATH", snapshot_path);
    }
    configure_runtime_network_env(&mut command, app);
    let output = command.output().map_err(|e| {
        format!(
            "failed to run openclaw config generator {}: {e}",
            generator_path.to_string_lossy()
        )
    })?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        return Err(format!(
            "openclaw config generator failed (status {}): {}{}",
            output
                .status
                .code()
                .map(|code| code.to_string())
                .unwrap_or_else(|| String::from("unknown")),
            stderr,
            if stdout.is_empty() {
                String::new()
            } else if stderr.is_empty() {
                stdout
            } else {
                format!(" | {stdout}")
            }
        ));
    }
    Ok(config_path)
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
        let raw =
            fs::read_to_string(&config_path).map_err(|e| format!("failed to read config: {e}"))?;
        return serde_json::from_str::<RuntimeConfig>(&raw)
            .map_err(|e| format!("failed to parse config: {e}"));
    }

    let default_path = resource_runtime_config_path(app);
    if default_path.exists() {
        let raw = fs::read_to_string(&default_path)
            .map_err(|e| format!("failed to read default config: {e}"))?;
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

    reclaim_managed_local_service_ports(&app);
    let occupied_ports = detect_local_service_port_conflicts();
    if !occupied_ports.is_empty() {
        if should_reuse_existing_local_sidecar(&occupied_ports) {
            return Ok(true);
        }

        let ports = occupied_ports
            .iter()
            .map(|port| port.to_string())
            .collect::<Vec<_>>()
            .join("/");
        return Err(format!(
            "检测到本地 OpenClaw API 正在运行，占用了 {ports}。请先关闭 `pnpm dev:api` 或释放该端口后再启动应用。"
        ));
    }

    let runtime = resolve_runtime_command(&app)?;
    if let Err(error) = sync_current_brand_runtime_snapshot(&app) {
        eprintln!("failed to sync OEM runtime snapshot before sidecar start: {error}");
    }
    let gateway_token = load_or_create_gateway_token(&app)?;
    ensure_openclaw_workspace_seed(&app)?;
    ensure_current_brand_runtime_skills(&app, "sidecar start")?;
    let openclaw_state_dir = openclaw_state_dir(&app)?;
    let openclaw_config_path = ensure_openclaw_runtime_config(&app, &gateway_token)?;
    let config = load_runtime_config_internal(&app)?;
    let paths = ensure_runtime_dirs(&app)?;
    let skills_dir = runtime_skills_dir(&app);
    let mcp_config = prepare_runtime_mcp_config(&app, &paths.cache_dir)?;
    let extra_ca_certs = resource_extra_ca_certs_path(&app);

    let runtime_root = resolved_runtime_root(&runtime)?;
    let mut command = Command::new(&runtime.program);
    if let Some(working_dir) = runtime.working_dir.as_ref() {
        command.current_dir(working_dir);
    }
    command.env(
        "ICLAW_OPENCLAW_RUNTIME_ROOT",
        runtime_root.to_string_lossy().to_string(),
    );
    command.args(&runtime.args_prefix);
    command.args(args);
    command.env("OPENCLAW_STATE_DIR", openclaw_state_dir);
    command.env("OPENCLAW_CONFIG_PATH", openclaw_config_path);
    command.env("OPENCLAW_WORK_DIR", paths.work_dir);
    command.env("OPENCLAW_LOG_DIR", paths.log_dir);
    command.env("OPENCLAW_SKILLS_CACHE_DIR", paths.cache_dir);
    command.env("OPENCLAW_SKILLS_DIR", skills_dir);
    command.env("OPENCLAW_MCP_CONFIG", mcp_config);
    command.env("OPENCLAW_GATEWAY_TOKEN", gateway_token);
    if extra_ca_certs.exists() {
        command.env("NODE_EXTRA_CA_CERTS", extra_ca_certs);
    }
    let wrapper_path = ensure_openclaw_cli_wrapper(&app, &runtime)?;
    prepend_openclaw_cli_to_path(&mut command, &wrapper_path, &runtime)?;
    configure_runtime_network_env(&mut command, &app);

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
        .map_err(|e| format!("failed to start openclaw runtime ({}): {e}", runtime.source))?;
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
    access
        .set_password(&access_token)
        .map_err(|e| e.to_string())?;
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
fn load_gateway_auth(app: AppHandle) -> Result<StoredGatewayAuth, String> {
    Ok(StoredGatewayAuth {
        token: Some(load_or_create_gateway_token(&app)?),
        password: None,
    })
}

#[tauri::command]
fn detect_port_conflicts() -> Result<PortConflictStatus, String> {
    Ok(PortConflictStatus {
        occupied_ports: detect_local_service_port_conflicts(),
    })
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
fn save_oem_runtime_snapshot(app: AppHandle, snapshot: OemRuntimeSnapshot) -> Result<bool, String> {
    let snapshot_path = oem_runtime_snapshot_path(&app)?;
    let raw = serde_json::to_string_pretty(&snapshot)
        .map_err(|e| format!("failed to serialize OEM runtime snapshot: {e}"))?;
    fs::write(&snapshot_path, raw)
        .map_err(|e| format!("failed to write OEM runtime snapshot: {e}"))?;
    let gateway_token = load_or_create_gateway_token(&app)?;
    ensure_openclaw_runtime_config(&app, &gateway_token)?;
    Ok(true)
}

#[tauri::command]
fn load_oem_runtime_snapshot(app: AppHandle) -> Result<Option<OemRuntimeSnapshot>, String> {
    load_oem_runtime_snapshot_internal(&app)
}

#[tauri::command]
fn sync_portal_provider_auth(
    app: AppHandle,
    auth_base_url: String,
    brand_id: String,
) -> Result<bool, String> {
    let tokens = load_auth_tokens()?
        .ok_or_else(|| String::from("missing access token for provider auth sync"))?;
    let data = read_private_runtime_config(&tokens.access_token, &auth_base_url, &brand_id)?;
    let config = data
        .config
        .ok_or_else(|| String::from("private runtime config missing config payload"))?;
    upsert_portal_provider_auth_profiles(&app, &config)?;
    Ok(true)
}

#[tauri::command]
fn clear_portal_provider_auth(app: AppHandle) -> Result<bool, String> {
    clear_portal_provider_auth_profiles(&app)
}

#[tauri::command]
fn sync_oem_runtime_snapshot(
    app: AppHandle,
    auth_base_url: String,
    brand_id: String,
) -> Result<bool, String> {
    let trimmed_brand_id = brand_id.trim();
    let trimmed_auth_base_url = auth_base_url.trim().trim_end_matches('/');
    if trimmed_brand_id.is_empty() {
        return Err(String::from("brand_id is required"));
    }
    if trimmed_auth_base_url.is_empty() {
        return Err(String::from("auth_base_url is required"));
    }

    let mut private_url = Url::parse(&format!("{trimmed_auth_base_url}/portal/runtime/private-config"))
        .map_err(|e| format!("failed to parse OEM private runtime config url: {e}"))?;
    private_url
        .query_pairs_mut()
        .append_pair("app_name", trimmed_brand_id);
    let mut public_url = Url::parse(&format!("{trimmed_auth_base_url}/portal/public-config"))
        .map_err(|e| format!("failed to parse OEM runtime config url: {e}"))?;
    public_url
        .query_pairs_mut()
        .append_pair("app_name", trimmed_brand_id);

    let client = Client::builder()
        .connect_timeout(Duration::from_secs(8))
        .timeout(Duration::from_secs(8))
        .build()
        .map_err(|e| format!("failed to build OEM runtime config client: {e}"))?;

    let private_response = match load_auth_tokens() {
        Ok(Some(tokens)) if !tokens.access_token.trim().is_empty() => client
            .get(private_url)
            .bearer_auth(tokens.access_token)
            .send()
            .ok(),
        Ok(_) => None,
        Err(_) => None,
    };
    let response = if let Some(resp) = private_response {
        if resp.status().is_success() { resp } else {
            client
                .get(public_url)
                .send()
                .map_err(|e| format!("failed to fetch OEM runtime config: {e}"))?
        }
    } else {
        client
            .get(public_url)
            .send()
            .map_err(|e| format!("failed to fetch OEM runtime config: {e}"))?
    };
    let status = response.status();
    let envelope = response
        .json::<PublicBrandConfigEnvelope>()
        .map_err(|e| format!("failed to parse OEM runtime config response: {e}"))?;
    let data = envelope
        .data
        .ok_or_else(|| format!("OEM runtime config missing data payload ({status})"))?;
    let config = data
        .config
        .ok_or_else(|| format!("OEM runtime config missing config payload ({status})"))?;
    if !envelope.success {
        return Err(format!("OEM runtime config returned unsuccessful response ({status})"));
    }

    let snapshot = OemRuntimeSnapshot {
        brand_id: data
            .brand
            .and_then(|value| value.brand_id)
            .or_else(|| data.app.and_then(|value| value.app_name))
            .unwrap_or_else(|| String::from(trimmed_brand_id)),
        published_version: data.published_version.unwrap_or(0),
        config,
    };
    save_oem_runtime_snapshot(app, snapshot)
}

#[tauri::command]
fn install_runtime(app: AppHandle) -> Result<bool, String> {
    install_runtime_internal(&app)?;
    Ok(true)
}

#[tauri::command]
fn diagnose_runtime(app: AppHandle) -> Result<RuntimeDiagnosis, String> {
    let runtime = resolve_runtime_command(&app).ok();
    let bootstrap_config = load_runtime_bootstrap_config(&app)?;
    let skills_dir = runtime_skills_dir(&app);
    let mcp_config = resource_mcp_config_path(&app);
    let paths = ensure_runtime_dirs(&app)?;
    let config = load_runtime_config_internal(&app)?;
    let snapshot = load_oem_runtime_snapshot_internal(&app).ok().flatten();
    let provider_api_key_configured = snapshot
        .as_ref()
        .and_then(|value| value.config.as_object())
        .and_then(|config| config.get("model_provider"))
        .and_then(|value| value.as_object())
        .and_then(|model_provider| model_provider.get("profile"))
        .and_then(|value| value.as_object())
        .and_then(|profile| profile.get("api_key"))
        .and_then(|value| value.as_str())
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false);
    let api_key_configured = provider_api_key_configured
        || config
            .anthropic_api_key
            .as_deref()
            .map(|value| !value.trim().is_empty())
            .unwrap_or(false);

    Ok(RuntimeDiagnosis {
        runtime_found: runtime.is_some(),
        runtime_installable: runtime_download_configured(&bootstrap_config),
        runtime_source: runtime.as_ref().map(|value| value.source.clone()),
        runtime_path: runtime
            .as_ref()
            .map(|value| value.display_path.to_string_lossy().to_string()),
        runtime_version: runtime
            .as_ref()
            .and_then(|value| value.version.clone())
            .or_else(|| clean_optional(bootstrap_config.version.clone())),
        runtime_download_url: clean_optional(bootstrap_config.artifact_url.clone()),
        skills_dir_ready: skills_dir.exists() && skills_dir.is_dir(),
        mcp_config_ready: mcp_config.exists() && mcp_config.is_file(),
        api_key_configured,
        skills_dir: skills_dir.to_string_lossy().to_string(),
        mcp_config: mcp_config.to_string_lossy().to_string(),
        work_dir: paths.work_dir,
        log_dir: paths.log_dir,
        cache_dir: paths.cache_dir,
    })
}

#[tauri::command]
fn load_bundled_skills_catalog(app: AppHandle) -> Result<Vec<BundledSkillCatalogItem>, String> {
    load_bundled_skills_catalog_internal(&app)
}

#[tauri::command]
fn load_bundled_mcp_catalog(app: AppHandle) -> Result<Vec<BundledMcpCatalogItem>, String> {
    load_bundled_mcp_catalog_internal(&app)
}

#[tauri::command]
fn list_managed_skills(app: AppHandle) -> Result<Vec<ManagedSkillInstallRecord>, String> {
    list_managed_skills_internal(&app)
}

#[tauri::command]
fn install_managed_skill(
    app: AppHandle,
    input: ManagedSkillInstallInput,
) -> Result<ManagedSkillInstallRecord, String> {
    install_managed_skill_internal(&app, input)
}

#[tauri::command]
fn remove_managed_skill(app: AppHandle, slug: String) -> Result<bool, String> {
    remove_managed_skill_internal(&app, &slug)
}

#[tauri::command]
fn import_github_skill(
    app: AppHandle,
    input: ImportGithubSkillInput,
) -> Result<ImportedSkillRecord, String> {
    import_github_skill_internal(&app, input)
}

#[tauri::command]
fn import_local_skill(
    app: AppHandle,
    input: ImportLocalSkillInput,
) -> Result<Option<ImportedSkillRecord>, String> {
    import_local_skill_internal(&app, input)
}

fn openclaw_workspace_dir(app: &AppHandle) -> PathBuf {
    if let Ok(home) = app.path().home_dir() {
        return home.join(".openclaw").join("workspace");
    }
    PathBuf::from(".openclaw/workspace")
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

fn current_memory_timestamp() -> String {
    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_secs())
        .unwrap_or(0);
    format!("{seconds}")
}

fn desktop_memory_dir(app: &AppHandle) -> PathBuf {
    openclaw_workspace_dir(app).join("memory")
}

fn desktop_memory_archive_dir(app: &AppHandle) -> PathBuf {
    openclaw_workspace_dir(app).join(".iclaw-memory-archive")
}

fn ensure_desktop_memory_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = desktop_memory_dir(app);
    fs::create_dir_all(&dir).map_err(|e| format!("failed to create memory dir: {e}"))?;
    Ok(dir)
}

fn ensure_desktop_memory_archive_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = desktop_memory_archive_dir(app);
    fs::create_dir_all(&dir).map_err(|e| format!("failed to create memory archive dir: {e}"))?;
    Ok(dir)
}

fn memory_entry_path(app: &AppHandle, id: &str) -> PathBuf {
    desktop_memory_dir(app).join(format!("{id}.md"))
}

fn memory_archive_path(app: &AppHandle, id: &str) -> PathBuf {
    desktop_memory_archive_dir(app).join(format!("{id}.md"))
}

fn sanitize_memory_scalar(value: &str) -> String {
    value
        .replace('\n', " ")
        .replace('\r', " ")
        .trim()
        .to_string()
}

fn serialize_memory_entry_markdown(entry: &DesktopMemoryEntry) -> String {
    let tags = entry.tags.join(", ");
    let last_recalled_at = entry.last_recalled_at.clone().unwrap_or_default();
    format!(
        "---\nid: {}\ntitle: {}\ndomain: {}\ntype: {}\nimportance: {}\nsourceType: {}\nsourceLabel: {}\ntags: {}\nstatus: {}\ncreatedAt: {}\nupdatedAt: {}\nlastRecalledAt: {}\nrecallCount: {}\ncaptureConfidence: {}\nindexHealth: {}\nactive: {}\n---\n{}\n",
        sanitize_memory_scalar(&entry.id),
        sanitize_memory_scalar(&entry.title),
        sanitize_memory_scalar(&entry.domain),
        sanitize_memory_scalar(&entry.r#type),
        sanitize_memory_scalar(&entry.importance),
        sanitize_memory_scalar(&entry.source_type),
        sanitize_memory_scalar(&entry.source_label),
        sanitize_memory_scalar(&tags),
        sanitize_memory_scalar(&entry.status),
        sanitize_memory_scalar(&entry.created_at),
        sanitize_memory_scalar(&entry.updated_at),
        sanitize_memory_scalar(&last_recalled_at),
        entry.recall_count,
        entry.capture_confidence,
        sanitize_memory_scalar(&entry.index_health),
        if entry.active { "true" } else { "false" },
        entry.content.trim()
    )
}

fn parse_memory_meta_map(raw: &str) -> std::collections::BTreeMap<String, String> {
    let mut map = std::collections::BTreeMap::new();
    for line in raw.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        if let Some((key, value)) = trimmed.split_once(':') {
            map.insert(key.trim().to_string(), value.trim().to_string());
        }
    }
    map
}

fn derive_memory_title(path: &Path, content: &str) -> String {
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        if let Some(value) = trimmed.strip_prefix("# ") {
            return value.trim().to_string();
        }
        return trimmed.to_string();
    }
    path.file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("未命名记忆")
        .to_string()
}

fn derive_memory_summary(content: &str, fallback: &str) -> String {
    let normalized = content.split_whitespace().collect::<Vec<_>>().join(" ");
    if normalized.is_empty() {
        fallback.to_string()
    } else {
        normalized.chars().take(58).collect()
    }
}

fn parse_memory_entry_from_file(path: &Path) -> Result<DesktopMemoryEntry, String> {
    let raw = fs::read_to_string(path)
        .map_err(|e| format!("failed to read memory file {}: {e}", path.to_string_lossy()))?;

    let (meta, content) = if raw.starts_with("---\n") {
        if let Some(end) = raw[4..].find("\n---\n") {
            let meta_raw = &raw[4..4 + end];
            let content_raw = &raw[4 + end + 5..];
            (
                parse_memory_meta_map(meta_raw),
                content_raw.trim().to_string(),
            )
        } else {
            (std::collections::BTreeMap::new(), raw.trim().to_string())
        }
    } else {
        (std::collections::BTreeMap::new(), raw.trim().to_string())
    };

    let metadata = fs::metadata(path)
        .map_err(|e| format!("failed to stat memory file {}: {e}", path.to_string_lossy()))?;
    let modified_secs = metadata
        .modified()
        .ok()
        .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
        .map(|value| value.as_secs().to_string())
        .unwrap_or_else(current_memory_timestamp);

    let title = meta
        .get("title")
        .cloned()
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| derive_memory_title(path, &content));
    let summary = derive_memory_summary(&content, &title);
    let id = meta
        .get("id")
        .cloned()
        .filter(|value| !value.is_empty())
        .or_else(|| {
            path.file_stem()
                .and_then(|value| value.to_str())
                .map(String::from)
        })
        .unwrap_or_else(|| format!("memory-{}", current_memory_timestamp()));

    let tags = meta
        .get("tags")
        .map(|value| {
            value
                .split(',')
                .map(|item| item.trim())
                .filter(|item| !item.is_empty())
                .map(String::from)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    let parse_u64 = |key: &str| -> u64 {
        meta.get(key)
            .and_then(|value| value.parse::<u64>().ok())
            .unwrap_or(0)
    };
    let parse_f64 = |key: &str, fallback: f64| -> f64 {
        meta.get(key)
            .and_then(|value| value.parse::<f64>().ok())
            .unwrap_or(fallback)
    };
    let parse_bool = |key: &str, fallback: bool| -> bool {
        meta.get(key)
            .map(|value| matches!(value.as_str(), "true" | "1" | "yes"))
            .unwrap_or(fallback)
    };

    Ok(DesktopMemoryEntry {
        id,
        title,
        summary,
        content,
        domain: meta
            .get("domain")
            .cloned()
            .unwrap_or_else(|| String::from("其他")),
        r#type: meta
            .get("type")
            .cloned()
            .unwrap_or_else(|| String::from("事实")),
        importance: meta
            .get("importance")
            .cloned()
            .unwrap_or_else(|| String::from("中")),
        source_type: meta
            .get("sourceType")
            .cloned()
            .unwrap_or_else(|| String::from("手动创建")),
        source_label: meta
            .get("sourceLabel")
            .cloned()
            .unwrap_or_else(|| path.to_string_lossy().to_string()),
        tags,
        created_at: meta
            .get("createdAt")
            .cloned()
            .unwrap_or_else(|| modified_secs.clone()),
        updated_at: meta
            .get("updatedAt")
            .cloned()
            .unwrap_or_else(|| modified_secs.clone()),
        last_recalled_at: meta
            .get("lastRecalledAt")
            .cloned()
            .filter(|value| !value.is_empty()),
        recall_count: parse_u64("recallCount"),
        capture_confidence: parse_f64("captureConfidence", 1.0),
        index_health: meta
            .get("indexHealth")
            .cloned()
            .unwrap_or_else(|| String::from("待刷新")),
        status: meta
            .get("status")
            .cloned()
            .unwrap_or_else(|| String::from("已确认")),
        active: parse_bool("active", true),
    })
}

fn collect_memory_markdown_files(dir: &Path, files: &mut Vec<PathBuf>) -> Result<(), String> {
    if !dir.exists() {
        return Ok(());
    }
    for entry in fs::read_dir(dir)
        .map_err(|e| format!("failed to read dir {}: {e}", dir.to_string_lossy()))?
    {
        let entry = entry.map_err(|e| format!("failed to read dir entry: {e}"))?;
        let path = entry.path();
        let metadata = entry.metadata().map_err(|e| {
            format!(
                "failed to read entry metadata {}: {e}",
                path.to_string_lossy()
            )
        })?;
        if metadata.is_dir() {
            collect_memory_markdown_files(&path, files)?;
            continue;
        }
        if path.extension().and_then(|value| value.to_str()) == Some("md") {
            files.push(path);
        }
    }
    Ok(())
}

fn load_desktop_memory_entries(app: &AppHandle) -> Result<Vec<DesktopMemoryEntry>, String> {
    let dir = desktop_memory_dir(app);
    let mut files = Vec::new();
    collect_memory_markdown_files(&dir, &mut files)?;
    let mut entries = files
        .iter()
        .filter_map(|path| parse_memory_entry_from_file(path).ok())
        .filter(|entry| entry.active)
        .collect::<Vec<_>>();
    entries.sort_by(|left, right| right.updated_at.cmp(&left.updated_at));
    Ok(entries)
}

fn configure_memory_runtime_command(command: &mut Command, app: &AppHandle) -> Result<(), String> {
    if let Err(error) = sync_current_brand_runtime_snapshot(app) {
        eprintln!("failed to sync OEM runtime snapshot before memory runtime command: {error}");
    }
    let runtime = resolve_runtime_command(app)?;
    let gateway_token = load_or_create_gateway_token(app)?;
    ensure_openclaw_workspace_seed(app)?;
    ensure_current_brand_runtime_skills(app, "memory runtime command")?;
    let openclaw_state_dir = openclaw_state_dir(app)?;
    let openclaw_config_path = ensure_openclaw_runtime_config(app, &gateway_token)?;
    let config = load_runtime_config_internal(app)?;
    let paths = ensure_runtime_dirs(app)?;
    let skills_dir = runtime_skills_dir(app);
    let mcp_config = prepare_runtime_mcp_config(app, &paths.cache_dir)?;
    let extra_ca_certs = resource_extra_ca_certs_path(app);

    command.env("OPENCLAW_STATE_DIR", openclaw_state_dir);
    command.env("OPENCLAW_CONFIG_PATH", openclaw_config_path);
    command.env("OPENCLAW_WORK_DIR", paths.work_dir);
    command.env("OPENCLAW_LOG_DIR", paths.log_dir);
    command.env("OPENCLAW_SKILLS_CACHE_DIR", paths.cache_dir);
    command.env("OPENCLAW_SKILLS_DIR", skills_dir);
    command.env("OPENCLAW_MCP_CONFIG", mcp_config);
    command.env("OPENCLAW_GATEWAY_TOKEN", gateway_token);

    if extra_ca_certs.exists() {
        command.env("NODE_EXTRA_CA_CERTS", extra_ca_certs);
    }
    let wrapper_path = ensure_openclaw_cli_wrapper(app, &runtime)?;
    prepend_openclaw_cli_to_path(command, &wrapper_path, &runtime)?;
    configure_runtime_network_env(command, app);
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

    Ok(())
}

fn run_memory_cli_json(app: &AppHandle, args: &[&str]) -> Result<serde_json::Value, String> {
    let output = run_memory_cli(app, args)?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    serde_json::from_str(&stdout).map_err(|e| format!("failed to parse memory cli json: {e}"))
}

fn run_memory_cli(app: &AppHandle, args: &[&str]) -> Result<std::process::Output, String> {
    let runtime = resolve_runtime_command(app)?;
    let runtime_root = runtime
        .display_path
        .parent()
        .ok_or_else(|| String::from("failed to resolve runtime root"))?;
    let node_path = runtime_root.join("bin").join("node");
    let cli_path = runtime_root.join("openclaw").join("openclaw.mjs");

    let mut command = Command::new(&node_path);
    command.arg(&cli_path);
    command.args(args);
    configure_memory_runtime_command(&mut command, app)?;

    let output = command
        .output()
        .map_err(|e| format!("failed to run memory cli: {e}"))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let detail = if !stderr.is_empty() { stderr } else { stdout };
        return Err(if detail.is_empty() {
            String::from("memory cli failed")
        } else {
            detail
        });
    }
    Ok(output)
}

fn load_desktop_memory_runtime_status(
    app: &AppHandle,
) -> Result<DesktopMemoryRuntimeStatus, String> {
    let value = run_memory_cli_json(app, &["memory", "status", "--json"])?;
    let first = value
        .as_array()
        .and_then(|items| items.first())
        .ok_or_else(|| String::from("memory status returned empty payload"))?;
    let status = first.get("status").cloned().unwrap_or_else(|| json!({}));
    let scan = first.get("scan").cloned().unwrap_or_else(|| json!({}));
    let custom = status.get("custom").cloned().unwrap_or_else(|| json!({}));
    let provider = status
        .get("provider")
        .and_then(|value| value.as_str())
        .map(String::from);
    let model = status
        .get("model")
        .and_then(|value| value.as_str())
        .map(String::from);
    let provider_configured = provider
        .as_ref()
        .map(|value| !value.trim().is_empty() && value != "none")
        .unwrap_or(false);
    let fallback_vector_error = custom
        .get("providerUnavailableReason")
        .and_then(|value| value.as_str())
        .map(String::from);

    Ok(DesktopMemoryRuntimeStatus {
        backend: status
            .get("backend")
            .and_then(|value| value.as_str())
            .map(String::from),
        files: status
            .get("files")
            .and_then(|value| value.as_u64())
            .unwrap_or(0),
        chunks: status
            .get("chunks")
            .and_then(|value| value.as_u64())
            .unwrap_or(0),
        dirty: status
            .get("dirty")
            .and_then(|value| value.as_bool())
            .unwrap_or(false),
        workspace_dir: status
            .get("workspaceDir")
            .and_then(|value| value.as_str())
            .map(String::from),
        memory_dir: desktop_memory_dir(app).to_string_lossy().to_string(),
        db_path: status
            .get("dbPath")
            .and_then(|value| value.as_str())
            .map(String::from),
        provider: provider.clone(),
        model: model.clone(),
        source_counts: status
            .get("sourceCounts")
            .and_then(|value| value.as_array())
            .cloned()
            .unwrap_or_default(),
        scan_total_files: scan.get("totalFiles").and_then(|value| value.as_u64()),
        scan_issues: scan
            .get("issues")
            .and_then(|value| value.as_array())
            .map(|items| {
                items
                    .iter()
                    .filter_map(|item| item.as_str().map(String::from))
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default(),
        fts_available: status
            .get("fts")
            .and_then(|value| value.get("available"))
            .and_then(|value| value.as_bool()),
        fts_error: status
            .get("fts")
            .and_then(|value| value.get("error"))
            .and_then(|value| value.as_str())
            .map(String::from),
        vector_available: status
            .get("vector")
            .and_then(|value| value.get("available"))
            .and_then(|value| value.as_bool()),
        vector_error: status
            .get("vector")
            .and_then(|value| value.get("error"))
            .and_then(|value| value.as_str())
            .map(String::from)
            .or(fallback_vector_error),
        embedding_configured: provider_configured,
        configured_scope: None,
        configured_provider: provider,
        configured_model: model,
    })
}

fn write_workspace_files(
    workspace_dir: &Path,
    identity_md: &str,
    user_md: &str,
    soul_md: &str,
    agents_md: &str,
) -> Result<(), String> {
    fs::create_dir_all(workspace_dir)
        .map_err(|e| format!("failed to create workspace dir: {e}"))?;
    write_text(&workspace_dir.join("IDENTITY.md"), identity_md)?;
    write_text(&workspace_dir.join("USER.md"), user_md)?;
    write_text(&workspace_dir.join("SOUL.md"), soul_md)?;
    write_text(&workspace_dir.join("AGENTS.md"), agents_md)?;
    write_text(
        &workspace_dir.join("FINANCE_DECISION_FRAMEWORK.md"),
        DEFAULT_FINANCE_DECISION_FRAMEWORK_MD,
    )?;
    let bootstrap_path = workspace_dir.join("BOOTSTRAP.md");
    if bootstrap_path.exists() {
        let _ = fs::remove_file(bootstrap_path);
    }
    Ok(())
}

const DEFAULT_IDENTITY_MD: &str =
    include_str!("../../../../services/openclaw/resources/IDENTITY.md");
const DEFAULT_USER_MD: &str = include_str!("../../../../services/openclaw/resources/USER.md");
const DEFAULT_SOUL_MD: &str = include_str!("../../../../services/openclaw/resources/SOUL.md");
const DEFAULT_AGENTS_MD: &str = include_str!("../../../../services/openclaw/resources/AGENTS.md");
const DEFAULT_FINANCE_DECISION_FRAMEWORK_MD: &str =
    include_str!("../../../../services/openclaw/resources/FINANCE_DECISION_FRAMEWORK.md");

fn ensure_openclaw_workspace_seed(app: &AppHandle) -> Result<(), String> {
    let workspace_dir = openclaw_workspace_dir(app);
    fs::create_dir_all(&workspace_dir)
        .map_err(|e| format!("failed to create workspace dir: {e}"))?;
    fs::create_dir_all(workspace_dir.join("skills"))
        .map_err(|e| format!("failed to create workspace skills dir: {e}"))?;

    let identity_path = workspace_dir.join("IDENTITY.md");
    let user_path = workspace_dir.join("USER.md");
    let soul_path = workspace_dir.join("SOUL.md");
    let agents_path = workspace_dir.join("AGENTS.md");
    let finance_framework_path = workspace_dir.join("FINANCE_DECISION_FRAMEWORK.md");

    if !identity_path.exists() {
        write_text(&identity_path, DEFAULT_IDENTITY_MD)?;
    }
    if !user_path.exists() {
        write_text(&user_path, DEFAULT_USER_MD)?;
    }
    if !soul_path.exists() {
        write_text(&soul_path, DEFAULT_SOUL_MD)?;
    }
    if !agents_path.exists() {
        write_text(&agents_path, DEFAULT_AGENTS_MD)?;
    }
    if !finance_framework_path.exists() {
        write_text(
            &finance_framework_path,
            DEFAULT_FINANCE_DECISION_FRAMEWORK_MD,
        )?;
    }

    let bootstrap_path = workspace_dir.join("BOOTSTRAP.md");
    if bootstrap_path.exists() {
        let _ = fs::remove_file(bootstrap_path);
    }

    Ok(())
}

#[tauri::command]
fn reset_iclaw_workspace_to_defaults(app: AppHandle) -> Result<bool, String> {
    let workspace_dir = openclaw_workspace_dir(&app);
    write_workspace_files(
        &workspace_dir,
        DEFAULT_IDENTITY_MD,
        DEFAULT_USER_MD,
        DEFAULT_SOUL_MD,
        DEFAULT_AGENTS_MD,
    )?;
    Ok(true)
}

#[tauri::command]
fn apply_iclaw_workspace_backup(
    app: AppHandle,
    backup: IclawWorkspaceBackupPayload,
) -> Result<bool, String> {
    let workspace_dir = openclaw_workspace_dir(&app);
    write_workspace_files(
        &workspace_dir,
        &backup.identity_md,
        &backup.user_md,
        &backup.soul_md,
        &backup.agents_md,
    )?;
    Ok(true)
}

fn read_workspace_text(path: &Path, default: &str) -> Result<String, String> {
    if !path.exists() {
        return Ok(default.to_string());
    }
    fs::read_to_string(path).map_err(|e| format!("failed to read {}: {e}", path.to_string_lossy()))
}

#[tauri::command]
fn load_iclaw_workspace_files(app: AppHandle) -> Result<IclawWorkspaceFiles, String> {
    ensure_openclaw_workspace_seed(&app)?;
    let workspace_dir = openclaw_workspace_dir(&app);

    Ok(IclawWorkspaceFiles {
        workspace_dir: workspace_dir.to_string_lossy().to_string(),
        identity_md: read_workspace_text(&workspace_dir.join("IDENTITY.md"), DEFAULT_IDENTITY_MD)?,
        user_md: read_workspace_text(&workspace_dir.join("USER.md"), DEFAULT_USER_MD)?,
        soul_md: read_workspace_text(&workspace_dir.join("SOUL.md"), DEFAULT_SOUL_MD)?,
        agents_md: read_workspace_text(&workspace_dir.join("AGENTS.md"), DEFAULT_AGENTS_MD)?,
        finance_decision_framework_md: read_workspace_text(
            &workspace_dir.join("FINANCE_DECISION_FRAMEWORK.md"),
            DEFAULT_FINANCE_DECISION_FRAMEWORK_MD,
        )?,
    })
}

fn apply_iclaw_settings_files(app: &AppHandle, settings: &serde_json::Value) -> Result<(), String> {
    let workspace_dir = openclaw_workspace_dir(app);

    let identity_md = value_str(
        settings,
        &["identity", "markdownContent"],
        DEFAULT_IDENTITY_MD,
    );
    let user_md = value_str(
        settings,
        &["userProfile", "markdownContent"],
        DEFAULT_USER_MD,
    );
    let soul_md = value_str(
        settings,
        &["soulPersona", "markdownContent"],
        DEFAULT_SOUL_MD,
    );
    let agents_md = String::from(DEFAULT_AGENTS_MD);
    let finance_framework_md = String::from(DEFAULT_FINANCE_DECISION_FRAMEWORK_MD);
    let channel = value_str(settings, &["channelPreference", "defaultChannel"], "web");
    let sync_to_im = value_bool(settings, &["channelPreference", "syncToIM"], false);
    let safety_mode = value_str(settings, &["safetyDefaults", "systemRunMode"], "ask");
    let settings_json = serde_json::to_string_pretty(settings)
        .map_err(|e| format!("failed to serialize settings json: {e}"))?;
    let summary_md = format!(
        "# ICLAW_SETTINGS.md\n- channel.default: {}\n- channel.sync_to_im: {}\n- safety.system_run_mode: {}\n",
        channel, sync_to_im, safety_mode
    );

    write_workspace_files(&workspace_dir, &identity_md, &user_md, &soul_md, &agents_md)?;
    write_text(&workspace_dir.join("ICLAW_SETTINGS.md"), &summary_md)?;
    write_text(&workspace_dir.join("ICLAW_SETTINGS.json"), &settings_json)?;
    write_text(
        &workspace_dir.join("FINANCE_DECISION_FRAMEWORK.md"),
        &finance_framework_md,
    )?;

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

#[tauri::command]
fn save_iclaw_workspace_section(
    app: AppHandle,
    section: String,
    content: String,
) -> Result<bool, String> {
    ensure_openclaw_workspace_seed(&app)?;
    let workspace_dir = openclaw_workspace_dir(&app);
    let target_path = match section.as_str() {
        "identity" => workspace_dir.join("IDENTITY.md"),
        "user-profile" => workspace_dir.join("USER.md"),
        "soul-persona" => workspace_dir.join("SOUL.md"),
        _ => return Err(format!("unsupported workspace section: {}", section)),
    };
    write_text(&target_path, &content)?;
    Ok(true)
}

#[tauri::command]
fn load_desktop_client_config(app: AppHandle) -> Result<Option<serde_json::Value>, String> {
    let path = desktop_client_config_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(&path)
        .map_err(|e| format!("failed to read desktop client config {}: {e}", path.to_string_lossy()))?;
    let parsed = serde_json::from_str::<serde_json::Value>(&raw)
        .map_err(|e| format!("failed to parse desktop client config {}: {e}", path.to_string_lossy()))?;
    Ok(Some(parsed))
}

#[tauri::command]
fn save_desktop_client_config(app: AppHandle, config: serde_json::Value) -> Result<bool, String> {
    let path = desktop_client_config_path(&app)?;
    let raw = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("failed to serialize desktop client config: {e}"))?;
    write_text(&path, &format!("{raw}\n"))?;
    Ok(true)
}

#[tauri::command]
fn load_memory_snapshot(app: AppHandle) -> Result<DesktopMemorySnapshot, String> {
    ensure_openclaw_workspace_seed(&app)?;
    let entries = load_desktop_memory_entries(&app)?;
    let memory_dir = desktop_memory_dir(&app).to_string_lossy().to_string();
    let archive_dir = desktop_memory_archive_dir(&app)
        .to_string_lossy()
        .to_string();
    match load_desktop_memory_runtime_status(&app) {
        Ok(runtime_status) => Ok(DesktopMemorySnapshot {
            entries,
            runtime_status: Some(runtime_status),
            runtime_error: None,
            memory_dir,
            archive_dir,
        }),
        Err(error) => Ok(DesktopMemorySnapshot {
            entries,
            runtime_status: None,
            runtime_error: Some(error),
            memory_dir,
            archive_dir,
        }),
    }
}

#[tauri::command]
fn save_memory_entry(
    app: AppHandle,
    entry: DesktopMemoryEntry,
) -> Result<DesktopMemoryEntry, String> {
    ensure_openclaw_workspace_seed(&app)?;
    ensure_desktop_memory_dir(&app)?;
    let mut normalized = entry.clone();
    if normalized.id.trim().is_empty() {
        normalized.id = format!("memory-{}", current_memory_timestamp());
    }
    if normalized.created_at.trim().is_empty() {
        normalized.created_at = current_memory_timestamp();
    }
    if normalized.updated_at.trim().is_empty() {
        normalized.updated_at = normalized.created_at.clone();
    }
    normalized.title = sanitize_memory_scalar(&normalized.title);
    normalized.summary = derive_memory_summary(&normalized.content, &normalized.title);

    let content = serialize_memory_entry_markdown(&normalized);
    write_text(&memory_entry_path(&app, &normalized.id), &content)?;
    Ok(normalized)
}

#[tauri::command]
fn delete_memory_entry(app: AppHandle, id: String) -> Result<bool, String> {
    let active_path = memory_entry_path(&app, &id);
    let archive_path = memory_archive_path(&app, &id);
    if active_path.exists() {
        fs::remove_file(&active_path).map_err(|e| {
            format!(
                "failed to delete memory file {}: {e}",
                active_path.to_string_lossy()
            )
        })?;
    }
    if archive_path.exists() {
        fs::remove_file(&archive_path).map_err(|e| {
            format!(
                "failed to delete archived memory file {}: {e}",
                archive_path.to_string_lossy()
            )
        })?;
    }
    Ok(true)
}

#[tauri::command]
fn archive_memory_entry(app: AppHandle, id: String) -> Result<bool, String> {
    ensure_desktop_memory_archive_dir(&app)?;
    let source_path = memory_entry_path(&app, &id);
    if !source_path.exists() {
        return Ok(true);
    }
    let target_path = memory_archive_path(&app, &id);
    fs::rename(&source_path, &target_path).map_err(|e| {
        format!(
            "failed to archive memory file {} -> {}: {e}",
            source_path.to_string_lossy(),
            target_path.to_string_lossy()
        )
    })?;
    Ok(true)
}

#[tauri::command]
fn reindex_memory(app: AppHandle, force: Option<bool>) -> Result<bool, String> {
    run_memory_cli(
        &app,
        if force.unwrap_or(false) {
            &["memory", "index", "--force"][..]
        } else {
            &["memory", "index"][..]
        },
    )?;
    Ok(true)
}

#[tauri::command]
async fn check_desktop_update(
    app: AppHandle,
    state: State<'_, DesktopUpdateState>,
    input: DesktopUpdateCommandInput,
) -> Result<DesktopUpdateCheckResult, String> {
    let Some(pubkey) = desktop_update_pubkey() else {
        return Ok(DesktopUpdateCheckResult {
            supported: false,
            available: false,
            version: None,
            notes: None,
            pub_date: None,
            mandatory: false,
            external_download_url: None,
        });
    };

    let endpoint = match desktop_update_endpoint(&input) {
        Ok(value) => value,
        Err(_) => {
            return Ok(DesktopUpdateCheckResult {
                supported: false,
                available: false,
                version: None,
                notes: None,
                pub_date: None,
                mandatory: false,
                external_download_url: None,
            })
        }
    };

    let updater = app
        .updater_builder()
        .endpoints(vec![Url::parse(&endpoint).map_err(|e| {
            format!("failed to parse desktop updater endpoint: {e}")
        })?])
        .map_err(|e| format!("failed to configure desktop updater endpoint: {e}"))?
        .pubkey(pubkey)
        .build()
        .map_err(|e| format!("failed to build desktop updater: {e}"))?;

    let update = updater
        .check()
        .await
        .map_err(|e| format!("failed to check desktop update: {e}"))?;

    let mut pending = state
        .pending
        .lock()
        .map_err(|_| String::from("failed to lock desktop update state"))?;
    if let Some(update) = update {
        let raw_json = update.raw_json.clone();
        let result = DesktopUpdateCheckResult {
            supported: true,
            available: true,
            version: Some(update.version.clone()),
            notes: update.body.clone(),
            pub_date: update.date.map(|value| value.to_string()),
            mandatory: parse_raw_update_flag(&raw_json, "mandatory"),
            external_download_url: parse_raw_update_string(&raw_json, "external_download_url"),
        };
        *pending = Some(update);
        Ok(result)
    } else {
        *pending = None;
        Ok(DesktopUpdateCheckResult {
            supported: true,
            available: false,
            version: None,
            notes: None,
            pub_date: None,
            mandatory: false,
            external_download_url: None,
        })
    }
}

#[tauri::command]
async fn download_and_install_desktop_update(
    app: AppHandle,
    state: State<'_, DesktopUpdateState>,
) -> Result<bool, String> {
    let update = {
        let mut pending = state
            .pending
            .lock()
            .map_err(|_| String::from("failed to lock desktop update state"))?;
        pending
            .take()
            .ok_or_else(|| String::from("no pending desktop update is available"))?
    };
    let version = Some(update.version.clone());

    emit_desktop_update_progress(
        &app,
        "download-started",
        4,
        version.clone(),
        Some(0),
        None,
        "正在下载新版本。",
    );

    update
        .download_and_install(
            |downloaded, total| {
                let downloaded = downloaded as u64;
                let progress = if let Some(total) = total.filter(|value| *value > 0) {
                    let ratio = (downloaded as f64 / total as f64).clamp(0.0, 1.0);
                    (6.0 + ratio * 82.0).round() as u8
                } else {
                    12
                };
                emit_desktop_update_progress(
                    &app,
                    "downloading",
                    progress,
                    version.clone(),
                    Some(downloaded),
                    total.filter(|value| *value > 0),
                    "正在下载更新包。",
                );
            },
            || {
                emit_desktop_update_progress(
                    &app,
                    "installing",
                    94,
                    version.clone(),
                    None,
                    None,
                    "更新包已下载完成，正在安装。",
                );
            },
        )
        .await
        .map_err(|e| format!("failed to download and install desktop update: {e}"))?;

    emit_desktop_update_progress(
        &app,
        "ready-to-restart",
        100,
        version,
        None,
        None,
        "更新已安装，重启应用后生效。",
    );

    Ok(true)
}

#[tauri::command]
fn restart_desktop_app(app: AppHandle) {
    app.restart();
}

fn apply_initial_window_layout(app: &AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };

    if let Ok(Some(snapshot)) = load_desktop_window_state(app) {
        let _ = window.set_size(PhysicalSize::new(snapshot.width, snapshot.height));
        let _ = window.set_position(PhysicalPosition::new(
            snapshot.position_x,
            snapshot.position_y,
        ));
        return;
    }

    let Ok(Some(monitor)) = window.current_monitor() else {
        return;
    };

    let monitor_size = monitor.size();
    let monitor_position = monitor.position();
    let target_width = ((monitor_size.width as f64) * 1.0).round() as u32;
    let target_height = ((monitor_size.height as f64) * 1.0).round() as u32;
    let width = target_width.max(980);
    let height = target_height.max(680);
    let pos_x = monitor_position.x + ((monitor_size.width.saturating_sub(width)) / 2) as i32;
    let pos_y = monitor_position.y + ((monitor_size.height.saturating_sub(height)) / 2) as i32;

    let _ = window.set_size(PhysicalSize::new(width, height));
    let _ = window.set_position(PhysicalPosition::new(pos_x, pos_y));
    persist_desktop_webview_window_state(&window);
}

fn main() {
    let builder = tauri::Builder::default()
        .manage(SidecarState {
            child: Mutex::new(None),
        })
        .manage(DesktopUpdateState {
            pending: Mutex::new(None),
        });
    let builder = if desktop_update_pubkey().is_some() {
        builder.plugin(tauri_plugin_updater::Builder::new().build())
    } else {
        builder
    };
    builder
        .setup(|app| {
            apply_initial_window_layout(app.handle());
            Ok(())
        })
        .on_window_event(|window, event| {
            match event {
                WindowEvent::CloseRequested { api, .. } => {
                    persist_desktop_window_state(window);
                    api.prevent_close();
                    let _ = window.minimize();
                }
                WindowEvent::Resized(_) | WindowEvent::Moved(_) => {
                    persist_desktop_window_state(window);
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            start_sidecar,
            stop_sidecar,
            ensure_openclaw_cli_available,
            save_auth_tokens,
            load_auth_tokens,
            clear_auth_tokens,
            load_gateway_auth,
            detect_port_conflicts,
            load_runtime_config,
            save_runtime_config,
            save_oem_runtime_snapshot,
            load_oem_runtime_snapshot,
            sync_portal_provider_auth,
            clear_portal_provider_auth,
            sync_oem_runtime_snapshot,
            install_runtime,
            diagnose_runtime,
            load_bundled_skills_catalog,
            load_bundled_mcp_catalog,
            list_managed_skills,
            install_managed_skill,
            remove_managed_skill,
            import_github_skill,
            import_local_skill,
            load_iclaw_workspace_files,
            reset_iclaw_workspace_to_defaults,
            apply_iclaw_workspace_backup,
            save_iclaw_settings_and_apply,
            save_iclaw_workspace_section,
            load_desktop_client_config,
            save_desktop_client_config,
            load_memory_snapshot,
            save_memory_entry,
            delete_memory_entry,
            archive_memory_entry,
            reindex_memory,
            check_desktop_update,
            download_and_install_desktop_update,
            restart_desktop_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
