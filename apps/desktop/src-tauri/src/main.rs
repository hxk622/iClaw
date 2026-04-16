#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use base64::Engine;
use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use flate2::Compression;
use keyring::Entry;
use rand::rngs::OsRng;
use rand::RngCore;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use reqwest::{blocking::Client, Url};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::env;
use std::fs::{self, File};
use std::io::{Cursor, Read, Write};
use std::net::TcpListener;
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, ExitStatus, Stdio};
use std::sync::{mpsc, Mutex};
use std::thread;
use std::time::Duration;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, RunEvent, State, WindowEvent,
};
use tauri_plugin_updater::UpdaterExt;
use zip::write::SimpleFileOptions;
use zip::ZipArchive;

use rfd::FileDialog;

struct SidecarState {
    child: Mutex<Option<Child>>,
}

struct DesktopUpdateState {
    pending: Mutex<Option<tauri_plugin_updater::Update>>,
    stop_sidecar_on_exit: Mutex<bool>,
}

const AUTH_SERVICE: &str = env!("ICLAW_AUTH_SERVICE");
const DESKTOP_BRAND_ID: &str = env!("ICLAW_BRAND_ID");
const DESKTOP_AUTH_BASE_URL: &str = env!("ICLAW_AUTH_BASE_URL");
const DESKTOP_BUNDLE_IDENTIFIER: &str = env!("ICLAW_BUNDLE_IDENTIFIER");
const DESKTOP_ARTIFACT_BASE_NAME: &str = env!("ICLAW_ARTIFACT_BASE_NAME");
const DESKTOP_BUILD_ID: &str = env!("ICLAW_BUILD_ID");
const DESKTOP_SOURCE_PROFILE_HASH: &str = env!("ICLAW_SOURCE_PROFILE_HASH");
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
const DESKTOP_GATEWAY_ALLOWED_ORIGINS: &str =
    "http://127.0.0.1:1520,http://localhost:1520,tauri://localhost,http://tauri.localhost,https://tauri.localhost";
const DESKTOP_UPDATER_PUBLIC_KEY: Option<&str> = option_env!("TAURI_UPDATER_PUBLIC_KEY");
const MEMORY_RUNTIME_STATUS_TIMEOUT_MS: u64 = 2500;
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

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
struct PersistedSidecarState {
    pid: Option<u32>,
    port: u16,
    brand_id: String,
    app_version: String,
    runtime_published_version: u64,
    runtime_config_sha256: String,
    sidecar_args: String,
    runtime_source: String,
    updated_at: String,
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

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct CustomMcpRuntimeItem {
    mcp_key: String,
    transport: String,
    enabled: bool,
    sort_order: i64,
    config: serde_json::Value,
    metadata: serde_json::Value,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CustomMcpRuntimeEnvelope {
    success: bool,
    data: Option<CustomMcpRuntimeData>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CustomMcpRuntimeData {
    items: Vec<CustomMcpRuntimeItem>,
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

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
struct RuntimeMcpSyncState {
    brand_id: String,
    published_version: u64,
    mcp_keys: Vec<String>,
    synced_at: String,
}

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
struct PackagedRuntimeSkillBaselineManifest {
    brand_id: String,
    published_version: u64,
    skill_slugs: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
struct PackagedRuntimeMcpBaselineManifest {
    brand_id: String,
    published_version: u64,
    mcp_keys: Vec<String>,
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
    let dir = openclaw_state_dir(app)?
        .join("agents")
        .join("main")
        .join("agent");
    fs::create_dir_all(&dir).map_err(|e| {
        format!(
            "failed to create OpenClaw main agent dir {}: {e}",
            dir.to_string_lossy()
        )
    })?;
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
    let parsed = serde_json::from_str::<serde_json::Value>(&raw).map_err(|e| {
        format!(
            "failed to parse json file {}: {e}",
            target.to_string_lossy()
        )
    })?;
    Ok(Some(parsed))
}

fn write_locked_json_file(target: &Path, value: &serde_json::Value) -> Result<(), String> {
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|e| {
            format!(
                "failed to create parent dir {}: {e}",
                parent.to_string_lossy()
            )
        })?;
    }
    let raw = serde_json::to_string_pretty(value).map_err(|e| {
        format!(
            "failed to serialize json file {}: {e}",
            target.to_string_lossy()
        )
    })?;
    fs::write(target, format!("{raw}\n")).map_err(|e| {
        format!(
            "failed to write json file {}: {e}",
            target.to_string_lossy()
        )
    })?;
    #[cfg(unix)]
    {
        fs::set_permissions(target, fs::Permissions::from_mode(0o600)).map_err(|e| {
            format!(
                "failed to set json file permissions {}: {e}",
                target.to_string_lossy()
            )
        })?;
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

    let mut private_url = Url::parse(&format!(
        "{trimmed_auth_base_url}/portal/runtime/private-config"
    ))
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
        return Err(format!(
            "OEM private runtime config request failed ({status})"
        ));
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

fn build_desktop_auth_client() -> Result<Client, String> {
    Client::builder()
        .connect_timeout(Duration::from_secs(8))
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|e| format!("failed to build desktop auth client: {e}"))
}

fn desktop_auth_headers() -> Result<HeaderMap, String> {
    let mut headers = HeaderMap::new();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    headers.insert("origin", HeaderValue::from_static("tauri://localhost"));
    headers.insert(
        "x-iclaw-app-name",
        HeaderValue::from_static(DESKTOP_BRAND_ID),
    );
    headers.insert("x-iclaw-channel", HeaderValue::from_static("prod"));
    if let Some(version) = option_env!("CARGO_PKG_VERSION") {
        let value = HeaderValue::from_str(version)
            .map_err(|e| format!("failed to encode desktop version header: {e}"))?;
        headers.insert("x-iclaw-app-version", value);
    }
    Ok(headers)
}

fn parse_desktop_error_response(response: reqwest::blocking::Response) -> Result<String, String> {
    let status = response.status();
    let text = response.text().map_err(|e| {
        format!("desktop auth request failed ({status}) and error body could not be read: {e}")
    })?;
    if let Ok(payload) = serde_json::from_str::<DesktopErrorEnvelope>(&text) {
        if let Some(error) = payload.error {
            let code = error
                .code
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty())
                .unwrap_or_else(|| String::from("HTTP_ERROR"));
            let message = error
                .message
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty())
                .unwrap_or_else(|| format!("desktop auth request failed ({status})"));
            let request_id = error
                .request_id
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty());
            let payload = DesktopInvokeErrorPayload {
                code,
                message,
                request_id,
            };
            return serde_json::to_string(&payload)
                .map_err(|e| format!("failed to encode desktop auth error payload: {e}"));
        }
    }
    Ok(format!("desktop auth request failed ({status})"))
}

fn desktop_auth_base_url() -> Result<String, String> {
    let trimmed = DESKTOP_AUTH_BASE_URL
        .trim()
        .trim_end_matches('/')
        .to_string();
    if trimmed.is_empty() {
        return Err(String::from("desktop auth base url is required"));
    }
    Ok(trimmed)
}

fn desktop_login_internal(input: DesktopLoginInput) -> Result<DesktopAuthResponse, String> {
    let auth_base_url = desktop_auth_base_url()?;
    let client = build_desktop_auth_client()?;
    let headers = desktop_auth_headers()?;
    let url = format!("{auth_base_url}/auth/login");
    let response = client
        .post(url)
        .headers(headers)
        .json(&json!({
            "identifier": input.identifier.trim(),
            "email": input.identifier.trim(),
            "password": input.password,
        }))
        .send()
        .map_err(|e| format!("desktop login request failed: {e}"))?;
    if !response.status().is_success() {
        return Err(parse_desktop_error_response(response)?);
    }
    let envelope = response
        .json::<ControlPlaneEnvelope<DesktopAuthResponse>>()
        .map_err(|e| format!("failed to parse desktop login response: {e}"))?;
    Ok(envelope.data)
}

fn desktop_me_internal(access_token: Option<String>) -> Result<serde_json::Value, String> {
    let auth_base_url = desktop_auth_base_url()?;
    let client = build_desktop_auth_client()?;
    let mut headers = desktop_auth_headers()?;
    if let Some(token) = access_token
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    {
        let bearer = HeaderValue::from_str(&format!("Bearer {token}"))
            .map_err(|e| format!("failed to encode authorization header: {e}"))?;
        headers.insert(AUTHORIZATION, bearer);
    }
    let response = client
        .get(format!("{auth_base_url}/auth/me"))
        .headers(headers)
        .send()
        .map_err(|e| format!("desktop me request failed: {e}"))?;
    if !response.status().is_success() {
        return Err(parse_desktop_error_response(response)?);
    }
    let envelope = response
        .json::<ControlPlaneEnvelope<serde_json::Value>>()
        .map_err(|e| format!("failed to parse desktop me response: {e}"))?;
    Ok(envelope.data)
}

fn desktop_refresh_internal(input: DesktopRefreshInput) -> Result<DesktopAuthTokens, String> {
    let auth_base_url = desktop_auth_base_url()?;
    let client = build_desktop_auth_client()?;
    let headers = desktop_auth_headers()?;
    let response = client
        .post(format!("{auth_base_url}/auth/refresh"))
        .headers(headers)
        .json(&json!({
            "refresh_token": input.refresh_token.trim(),
        }))
        .send()
        .map_err(|e| format!("desktop refresh request failed: {e}"))?;
    if !response.status().is_success() {
        return Err(parse_desktop_error_response(response)?);
    }
    let envelope = response
        .json::<ControlPlaneEnvelope<DesktopAuthTokens>>()
        .map_err(|e| format!("failed to parse desktop refresh response: {e}"))?;
    Ok(envelope.data)
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
    store.insert(
        String::from("profiles"),
        serde_json::Value::Object(profiles),
    );
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
    store.insert(
        String::from("profiles"),
        serde_json::Value::Object(profiles),
    );
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
struct RuntimeBootstrapArtifact {
    artifact_url: Option<String>,
    artifact_sha256: Option<String>,
    artifact_format: Option<String>,
    launcher_relative_path: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Default)]
struct RuntimeBootstrapConfig {
    version: Option<String>,
    artifact_url: Option<String>,
    artifact_sha256: Option<String>,
    artifact_format: Option<String>,
    launcher_relative_path: Option<String>,
    #[serde(default)]
    artifacts: BTreeMap<String, RuntimeBootstrapArtifact>,
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

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DesktopInstallerCommandInput {
    artifact_url: String,
    version: Option<String>,
    artifact_sha256: Option<String>,
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
#[serde(rename_all = "camelCase")]
struct StartupDiagnosticsSnapshot {
    bootstrap_log_path: String,
    sidecar_stdout_log_path: String,
    sidecar_stderr_log_path: String,
    bootstrap_tail: Option<String>,
    sidecar_stdout_tail: Option<String>,
    sidecar_stderr_tail: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
struct DesktopFaultReportPrepareInput {
    report_id: Option<String>,
    entry: String,
    install_session_id: Option<String>,
    app_name: Option<String>,
    brand_id: Option<String>,
    app_version: Option<String>,
    release_channel: Option<String>,
    failure_stage: String,
    error_title: String,
    error_message: String,
    error_code: Option<String>,
    runtime_found: Option<bool>,
    runtime_installable: Option<bool>,
    runtime_version: Option<String>,
    runtime_path: Option<String>,
    work_dir: Option<String>,
    log_dir: Option<String>,
    runtime_download_url: Option<String>,
    install_progress_phase: Option<String>,
    install_progress_percent: Option<i64>,
    extra_diagnostics: Option<serde_json::Value>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PreparedDesktopFaultReportArchive {
    report_id: String,
    device_id: String,
    platform: String,
    platform_version: Option<String>,
    arch: String,
    file_name: String,
    file_size_bytes: usize,
    file_sha256: String,
    archive_base64: String,
    payload: serde_json::Value,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopClientMetricsContext {
    device_id: String,
    platform: String,
    platform_version: Option<String>,
    arch: String,
    app_version: String,
    brand_id: String,
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
struct DesktopAuthTokens {
    access_token: String,
    refresh_token: String,
    expires_in: u64,
}

#[derive(Serialize, Deserialize)]
struct DesktopLoginInput {
    identifier: String,
    password: String,
}

#[derive(Serialize, Deserialize)]
struct DesktopRefreshInput {
    refresh_token: String,
}

#[derive(Serialize, Deserialize)]
struct DesktopAuthResponse {
    tokens: DesktopAuthTokens,
    user: serde_json::Value,
}

#[derive(Deserialize)]
struct DesktopErrorEnvelope {
    error: Option<DesktopErrorPayload>,
}

#[derive(Deserialize)]
struct DesktopErrorPayload {
    code: Option<String>,
    message: Option<String>,
    request_id: Option<String>,
}

#[derive(Serialize)]
struct DesktopInvokeErrorPayload {
    code: String,
    message: String,
    request_id: Option<String>,
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

#[cfg(all(target_os = "macos", target_arch = "aarch64"))]
fn current_runtime_target_triple() -> &'static str {
    "aarch64-apple-darwin"
}

#[cfg(all(target_os = "macos", target_arch = "x86_64"))]
fn current_runtime_target_triple() -> &'static str {
    "x86_64-apple-darwin"
}

#[cfg(all(target_os = "windows", target_arch = "aarch64"))]
fn current_runtime_target_triple() -> &'static str {
    "aarch64-pc-windows-msvc"
}

#[cfg(all(target_os = "windows", target_arch = "x86_64"))]
fn current_runtime_target_triple() -> &'static str {
    "x86_64-pc-windows-msvc"
}

#[cfg(all(target_os = "linux", target_arch = "aarch64"))]
fn current_runtime_target_triple() -> &'static str {
    "aarch64-unknown-linux-gnu"
}

#[cfg(all(target_os = "linux", target_arch = "x86_64"))]
fn current_runtime_target_triple() -> &'static str {
    "x86_64-unknown-linux-gnu"
}

#[cfg(not(any(
    all(target_os = "macos", target_arch = "aarch64"),
    all(target_os = "macos", target_arch = "x86_64"),
    all(target_os = "windows", target_arch = "aarch64"),
    all(target_os = "windows", target_arch = "x86_64"),
    all(target_os = "linux", target_arch = "aarch64"),
    all(target_os = "linux", target_arch = "x86_64")
)))]
fn current_runtime_target_triple() -> &'static str {
    "unknown"
}

fn apply_target_runtime_bootstrap_artifact(config: &mut RuntimeBootstrapConfig) {
    let target = current_runtime_target_triple();
    let Some(artifact) = config.artifacts.get(target).cloned() else {
        return;
    };

    if let Some(value) = clean_optional(artifact.artifact_url) {
        config.artifact_url = Some(value);
    }
    if let Some(value) = clean_optional(artifact.artifact_sha256) {
        config.artifact_sha256 = Some(value);
    }
    if let Some(value) = clean_optional(artifact.artifact_format) {
        config.artifact_format = Some(value);
    }
    if let Some(value) = clean_optional(artifact.launcher_relative_path) {
        config.launcher_relative_path = Some(value);
    }
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

    apply_target_runtime_bootstrap_artifact(&mut config);

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

fn resource_runtime_archive_path(
    app: &AppHandle,
    config: &RuntimeBootstrapConfig,
) -> Result<Option<PathBuf>, String> {
    let artifact_url = clean_optional(config.artifact_url.clone());
    let version_label = runtime_version_label(config);
    let extension =
        match runtime_archive_format(config, artifact_url.as_deref().unwrap_or_default()) {
            Ok(value) => {
                if value == "zip" {
                    "zip"
                } else {
                    "tar.gz"
                }
            }
            Err(_) => return Ok(None),
        };

    let direct_name = format!("openclaw-runtime-{version_label}.{extension}");
    if let Ok(resource_dir) = app.path().resource_dir() {
        let direct = resource_dir
            .join("resources")
            .join("runtime-archives")
            .join(&direct_name);
        if direct.exists() {
            return Ok(Some(direct));
        }
    }

    let fallback = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("resources")
        .join("runtime-archives")
        .join(&direct_name);
    if fallback.exists() {
        return Ok(Some(fallback));
    }

    if let Some(url) = artifact_url {
        let artifact_name = url
            .split('/')
            .last()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or(&direct_name);
        if let Ok(resource_dir) = app.path().resource_dir() {
            let direct = resource_dir
                .join("resources")
                .join("runtime-archives")
                .join(artifact_name);
            if direct.exists() {
                return Ok(Some(direct));
            }
        }
        let fallback = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("resources")
            .join("runtime-archives")
            .join(artifact_name);
        if fallback.exists() {
            return Ok(Some(fallback));
        }
    }

    Ok(None)
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
            args_prefix: Vec::new(),
            working_dir: launcher.parent().map(|path| path.to_path_buf()),
            source: String::from("bundled"),
            display_path: launcher,
            version: clean_optional(config.version.clone()),
        });
    }

    if let Some(archive_path) = resource_runtime_archive_path(app, &config)? {
        let installed_dir = install_runtime_internal(app)?;
        if installed_runtime_matches(&installed_dir, &config) {
            let launcher = installed_dir.join(runtime_launcher_relative_path(&config));
            return Ok(ResolvedRuntimeCommand {
                args_prefix: Vec::new(),
                working_dir: launcher.parent().map(|path| path.to_path_buf()),
                source: format!("bundled-archive:{}", archive_path.to_string_lossy()),
                display_path: launcher,
                version: clean_optional(config.version.clone()),
            });
        }
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

fn resolved_runtime_cli_entry_path(runtime_root: &Path) -> PathBuf {
    runtime_root.join("openclaw").join("openclaw.mjs")
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
    fs::create_dir_all(&bin_dir).map_err(|e| {
        format!(
            "failed to create runtime bin dir {}: {e}",
            bin_dir.to_string_lossy()
        )
    })?;
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
        .map_err(|e| {
            format!(
                "failed to read metadata for {}: {e}",
                path.to_string_lossy()
            )
        })?
        .permissions();
    permissions.set_mode(0o755);
    fs::set_permissions(path, permissions).map_err(|e| {
        format!(
            "failed to set executable permissions on {}: {e}",
            path.to_string_lossy()
        )
    })
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
    let cli_path = resolved_runtime_cli_entry_path(&runtime_root);
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

fn runtime_skills_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(openclaw_workspace_dir(app)?.join("skills"))
}

fn resource_bundled_skills_dir(app: &AppHandle) -> PathBuf {
    if let Ok(resource_dir) = app.path().resource_dir() {
        let p = resource_dir.join("resources").join("bundled-skills");
        if p.exists() {
            return p;
        }
    }
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("resources")
        .join("bundled-skills")
}

fn resource_mcp_config_path(app: &AppHandle) -> PathBuf {
    if let Ok(runtime_path) = runtime_mcp_config_source_path(app) {
        if runtime_path.exists() {
            return runtime_path;
        }
    }
    if let Ok(resource_dir) = app.path().resource_dir() {
        let p = resource_dir
            .join("resources")
            .join("baseline")
            .join("mcp")
            .join("mcp.json");
        if p.exists() {
            return p;
        }
    }
    let packaged_path = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("resources")
        .join("baseline")
        .join("mcp")
        .join("mcp.json");
    if packaged_path.exists() {
        return packaged_path;
    }
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

fn runtime_skills_manifest_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(runtime_skills_dir(app)?.join("skills-manifest.json"))
}

fn resource_bundled_skills_manifest_path(app: &AppHandle) -> PathBuf {
    resource_bundled_skills_dir(app).join("skills-manifest.json")
}

fn load_skill_manifest_value(path: &Path) -> Result<Option<serde_json::Value>, String> {
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(path).map_err(|e| {
        format!(
            "failed to read skill manifest {}: {e}",
            path.to_string_lossy()
        )
    })?;
    let parsed = serde_json::from_str::<serde_json::Value>(&raw).map_err(|e| {
        format!(
            "failed to parse skill manifest {}: {e}",
            path.to_string_lossy()
        )
    })?;
    Ok(Some(parsed))
}

fn manifest_skill_dirs(value: &serde_json::Value) -> Vec<String> {
    value
        .get("skills")
        .and_then(|entry| entry.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.as_str().map(|raw| raw.trim().to_string()))
                .filter(|value| !value.is_empty())
                .collect::<Vec<String>>()
        })
        .unwrap_or_default()
}

fn manifest_skill_slugs(value: &serde_json::Value) -> Vec<String> {
    let item_slugs = value
        .get("items")
        .and_then(|entry| entry.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| {
                    item.get("slug")
                        .and_then(|value| value.as_str())
                        .map(|raw| raw.trim().to_string())
                })
                .filter(|value| !value.is_empty())
                .collect::<Vec<String>>()
        })
        .unwrap_or_default();
    if item_slugs.is_empty() {
        manifest_skill_dirs(value)
    } else {
        item_slugs
    }
}

fn current_openclaw_skill_platform() -> &'static str {
    #[cfg(target_os = "windows")]
    {
        "win32"
    }
    #[cfg(target_os = "macos")]
    {
        "darwin"
    }
    #[cfg(target_os = "linux")]
    {
        "linux"
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        "unknown"
    }
}

fn platform_aliases_for_match() -> &'static [&'static str] {
    #[cfg(target_os = "windows")]
    {
        &["win32", "windows", "win"]
    }
    #[cfg(target_os = "macos")]
    {
        &["darwin", "macos", "mac", "osx"]
    }
    #[cfg(target_os = "linux")]
    {
        &["linux"]
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        &["unknown"]
    }
}

fn parse_skill_supported_platforms(skill_root: &Path) -> Result<Option<Vec<String>>, String> {
    let skill_path = skill_root.join("SKILL.md");
    if !skill_path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(&skill_path).map_err(|e| {
        format!(
            "failed to read skill manifest {}: {e}",
            skill_path.to_string_lossy()
        )
    })?;
    let metadata_line = raw
        .lines()
        .map(str::trim)
        .find(|line| line.starts_with("metadata:"));
    let Some(metadata_line) = metadata_line else {
        return Ok(None);
    };
    let metadata_raw = metadata_line.trim_start_matches("metadata:").trim();
    if metadata_raw.is_empty() {
        return Ok(None);
    }
    let parsed = match serde_json::from_str::<serde_json::Value>(metadata_raw) {
        Ok(value) => value,
        Err(_) => return Ok(None),
    };
    let os_values = parsed
        .get("openclaw")
        .and_then(|value| value.get("os"))
        .and_then(|value| value.as_array());
    let Some(os_values) = os_values else {
        return Ok(None);
    };
    let parsed_values = os_values
        .iter()
        .filter_map(|value| value.as_str())
        .map(|value| value.trim().to_ascii_lowercase())
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>();
    if parsed_values.is_empty() {
        Ok(None)
    } else {
        Ok(Some(parsed_values))
    }
}

fn skill_supports_current_platform(skill_root: &Path) -> Result<bool, String> {
    let Some(platforms) = parse_skill_supported_platforms(skill_root)? else {
        return Ok(true);
    };
    let aliases = platform_aliases_for_match();
    Ok(platforms
        .iter()
        .any(|platform| aliases.iter().any(|alias| platform == alias)))
}

fn skill_manifest_matches_snapshot(
    manifest: &serde_json::Value,
    snapshot: &OemRuntimeSnapshot,
    expected_skill_slugs: &[String],
) -> bool {
    let preset = manifest
        .get("preset")
        .and_then(|value| value.as_str())
        .map(|value| value.trim())
        .unwrap_or("");
    if !preset.is_empty() && preset != snapshot.brand_id.trim() {
        return false;
    }

    let published_version = manifest
        .get("publishedVersion")
        .and_then(|value| value.as_u64())
        .unwrap_or(snapshot.published_version);
    if published_version != snapshot.published_version {
        return false;
    }

    manifest_skill_slugs(manifest) == expected_skill_slugs
}

fn normalize_runtime_scope_key(raw: &str) -> String {
    let normalized: String = raw
        .trim()
        .chars()
        .map(|ch| {
            let lower = ch.to_ascii_lowercase();
            if lower.is_ascii_alphanumeric() || matches!(lower, '.' | '_' | '-') {
                lower
            } else {
                '-'
            }
        })
        .collect();
    let trimmed = normalized.trim_matches('-');
    if trimmed.is_empty() {
        String::from("default")
    } else {
        String::from(trimmed)
    }
}

fn openclaw_home_root_dir(app: &AppHandle) -> PathBuf {
    if let Ok(home) = app.path().home_dir() {
        return home.join(".openclaw");
    }
    PathBuf::from(".openclaw")
}

fn legacy_openclaw_workspace_dir(app: &AppHandle) -> PathBuf {
    openclaw_home_root_dir(app).join("workspace")
}

fn runtime_scope_root_dir_raw(app: &AppHandle) -> PathBuf {
    let scope_key = normalize_runtime_scope_key(&resolve_active_oem_brand_id(app));
    openclaw_home_root_dir(app).join("apps").join(scope_key)
}

fn runtime_scope_root_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = runtime_scope_root_dir_raw(app);
    fs::create_dir_all(&dir).map_err(|e| {
        format!(
            "failed to create runtime scope dir {}: {e}",
            dir.to_string_lossy()
        )
    })?;
    Ok(dir)
}

fn legacy_openclaw_state_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_base_dir(app)?.join("state"))
}

fn legacy_openclaw_config_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_base_dir(app)?.join("config").join("openclaw.json"))
}

fn legacy_runtime_skill_sync_state_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_base_dir(app)?
        .join("config")
        .join("runtime-skill-sync-state.json"))
}

fn legacy_runtime_mcp_config_source_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_base_dir(app)?
        .join("config")
        .join("runtime-mcp.json"))
}

fn legacy_runtime_mcp_sync_state_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_base_dir(app)?
        .join("config")
        .join("runtime-mcp-sync-state.json"))
}

fn packaged_runtime_skills_root(app: &AppHandle) -> PathBuf {
    if let Ok(resource_dir) = app.path().resource_dir() {
        let p = resource_dir
            .join("resources")
            .join("baseline")
            .join("skills");
        if p.exists() {
            return p;
        }
    }
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("resources")
        .join("baseline")
        .join("skills")
}

fn packaged_runtime_skills_manifest_path(app: &AppHandle) -> PathBuf {
    packaged_runtime_skills_root(app).join("skills-manifest.json")
}

fn packaged_runtime_mcp_root(app: &AppHandle) -> PathBuf {
    if let Ok(resource_dir) = app.path().resource_dir() {
        let p = resource_dir.join("resources").join("baseline").join("mcp");
        if p.exists() {
            return p;
        }
    }
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("resources")
        .join("baseline")
        .join("mcp")
}

fn packaged_runtime_mcp_manifest_path(app: &AppHandle) -> PathBuf {
    packaged_runtime_mcp_root(app).join("mcp-manifest.json")
}

fn runtime_skill_sync_state_path(app: &AppHandle) -> Result<PathBuf, String> {
    ensure_runtime_scope_migrated(app)?;
    let path = runtime_scope_root_dir_raw(app).join("runtime-skill-sync-state.json");
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("failed to create runtime skill sync state dir: {e}"))?;
    }
    Ok(path)
}

fn runtime_mcp_config_source_path(app: &AppHandle) -> Result<PathBuf, String> {
    ensure_runtime_scope_migrated(app)?;
    let path = runtime_scope_root_dir_raw(app).join("mcp.json");
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("failed to create runtime mcp config dir: {e}"))?;
    }
    Ok(path)
}

fn runtime_mcp_sync_state_path(app: &AppHandle) -> Result<PathBuf, String> {
    ensure_runtime_scope_migrated(app)?;
    let path = runtime_scope_root_dir_raw(app).join("runtime-mcp-sync-state.json");
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("failed to create runtime mcp sync state dir: {e}"))?;
    }
    Ok(path)
}

fn replace_iclaw_servers_dir_placeholders(value: &mut serde_json::Value, servers_dir: &str) {
    match value {
        serde_json::Value::String(raw) => {
            if raw.contains("__ICLAW_SERVERS_DIR__") {
                *raw = raw.replace(
                    "__ICLAW_SERVERS_DIR__",
                    &normalize_windows_path_text(servers_dir),
                );
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

fn runtime_mcp_bindings_from_snapshot(snapshot: &OemRuntimeSnapshot) -> Vec<(String, i64)> {
    let bindings = snapshot
        .config
        .get("mcp_bindings")
        .and_then(|value| value.as_array())
        .cloned()
        .unwrap_or_default();
    let mut parsed = bindings
        .into_iter()
        .filter_map(|value| {
            let object = value.as_object()?;
            let mcp_key = object
                .get("mcp_key")
                .and_then(|value| value.as_str())
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty())?;
            let sort_order = object
                .get("sort_order")
                .and_then(|value| value.as_i64())
                .unwrap_or(0);
            Some((mcp_key, sort_order))
        })
        .collect::<Vec<_>>();
    parsed.sort_by(|left, right| left.1.cmp(&right.1).then_with(|| left.0.cmp(&right.0)));
    parsed
}

fn runtime_mcp_servers_from_snapshot(
    snapshot: &OemRuntimeSnapshot,
) -> serde_json::Map<String, serde_json::Value> {
    if let Some(object) = snapshot
        .config
        .get("resolved_mcp_servers")
        .and_then(|value| value.as_object())
    {
        return object.clone();
    }

    let mut fallback = serde_json::Map::new();
    let bindings = snapshot
        .config
        .get("mcp_bindings")
        .and_then(|value| value.as_array())
        .cloned()
        .unwrap_or_default();
    for value in bindings {
        let Some(object) = value.as_object() else {
            continue;
        };
        let Some(mcp_key) = object
            .get("mcp_key")
            .and_then(|value| value.as_str())
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
        else {
            continue;
        };
        let mut config = object
            .get("config")
            .and_then(|value| value.as_object())
            .cloned()
            .unwrap_or_default();
        config.insert(String::from("enabled"), serde_json::Value::Bool(true));
        fallback.insert(mcp_key, serde_json::Value::Object(config));
    }
    fallback
}

fn merge_custom_mcp_runtime_items(
    config: &mut serde_json::Value,
    items: Vec<CustomMcpRuntimeItem>,
) {
    let Some(root) = config.as_object_mut() else {
        return;
    };

    if !root
        .get("resolved_mcp_servers")
        .map(|value| value.is_object())
        .unwrap_or(false)
    {
        root.insert(
            String::from("resolved_mcp_servers"),
            serde_json::Value::Object(serde_json::Map::new()),
        );
    }
    if !root
        .get("mcp_bindings")
        .map(|value| value.is_array())
        .unwrap_or(false)
    {
        root.insert(
            String::from("mcp_bindings"),
            serde_json::Value::Array(Vec::new()),
        );
    }

    for item in items.into_iter().filter(|item| item.enabled) {
        let mut merged_config = item
            .config
            .as_object()
            .cloned()
            .unwrap_or_default();
        merged_config.insert(
            String::from("transport"),
            serde_json::Value::String(item.transport.clone()),
        );
        merged_config.insert(String::from("enabled"), serde_json::Value::Bool(true));

        if let Some(resolved_servers_object) = root
            .get_mut("resolved_mcp_servers")
            .and_then(|value| value.as_object_mut())
        {
            resolved_servers_object.insert(
                item.mcp_key.clone(),
                serde_json::Value::Object(merged_config.clone()),
            );
        }

        let binding_exists = root
            .get("mcp_bindings")
            .and_then(|value| value.as_array())
            .map(|bindings| {
                bindings.iter().any(|value| {
                    value
                        .as_object()
                        .and_then(|object| object.get("mcp_key"))
                        .and_then(|value| value.as_str())
                        .map(|value| value.trim() == item.mcp_key)
                        .unwrap_or(false)
                })
            })
            .unwrap_or(false);
        if binding_exists {
            continue;
        }

        if let Some(mcp_bindings_array) = root
            .get_mut("mcp_bindings")
            .and_then(|value| value.as_array_mut())
        {
            mcp_bindings_array.push(json!({
                "mcp_key": item.mcp_key,
                "sort_order": item.sort_order,
                "config": serde_json::Value::Object(merged_config),
                "metadata": item.metadata,
            }));
        }
    }
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

fn runtime_skills_dir_contains_unsupported_entries(app: &AppHandle) -> Result<bool, String> {
    let skills_root = runtime_skills_dir(app)?;
    if !skills_root.exists() {
        return Ok(false);
    }
    let entries = fs::read_dir(&skills_root).map_err(|e| {
        format!(
            "failed to scan runtime skills dir {}: {e}",
            skills_root.to_string_lossy()
        )
    })?;
    for entry in entries {
        let entry = entry.map_err(|e| format!("failed to read runtime skill dir entry: {e}"))?;
        let path = entry.path();
        let metadata = entry.metadata().map_err(|e| {
            format!(
                "failed to read runtime skill metadata {}: {e}",
                path.to_string_lossy()
            )
        })?;
        if !metadata.is_dir() || !path.join("SKILL.md").exists() {
            continue;
        }
        if !skill_supports_current_platform(&path)? {
            return Ok(true);
        }
    }
    Ok(false)
}

fn load_runtime_mcp_sync_state(app: &AppHandle) -> Result<Option<RuntimeMcpSyncState>, String> {
    let path = runtime_mcp_sync_state_path(app)?;
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(&path).map_err(|e| {
        format!(
            "failed to read runtime mcp sync state {}: {e}",
            path.to_string_lossy()
        )
    })?;
    let parsed = serde_json::from_str::<RuntimeMcpSyncState>(&raw).map_err(|e| {
        format!(
            "failed to parse runtime mcp sync state {}: {e}",
            path.to_string_lossy()
        )
    })?;
    Ok(Some(parsed))
}

fn save_runtime_mcp_sync_state(app: &AppHandle, state: &RuntimeMcpSyncState) -> Result<(), String> {
    let path = runtime_mcp_sync_state_path(app)?;
    let value = serde_json::to_value(state)
        .map_err(|e| format!("failed to serialize runtime mcp sync state: {e}"))?;
    write_locked_json_file(&path, &value)
}

fn runtime_skills_cache_is_fresh(
    app: &AppHandle,
    snapshot: &OemRuntimeSnapshot,
) -> Result<bool, String> {
    if runtime_skills_dir_contains_unsupported_entries(app)? {
        return Ok(false);
    }
    let expected_skill_slugs = runtime_skill_bindings_from_snapshot(snapshot)
        .into_iter()
        .map(|(slug, _)| slug)
        .collect::<Vec<_>>();
    let runtime_manifest_path = runtime_skills_manifest_path(app)?;
    let manifest_matches = load_skill_manifest_value(&runtime_manifest_path)?
        .as_ref()
        .map(|manifest| skill_manifest_matches_snapshot(manifest, snapshot, &expected_skill_slugs))
        .unwrap_or(false);
    let Some(state) = load_runtime_skill_sync_state(app)? else {
        return Ok(manifest_matches);
    };
    if state.brand_id.trim() != snapshot.brand_id.trim() {
        return Ok(manifest_matches);
    }
    if state.published_version != snapshot.published_version {
        return Ok(manifest_matches);
    }
    if state.skill_slugs != expected_skill_slugs {
        return Ok(manifest_matches);
    }
    Ok(runtime_manifest_path.exists() || manifest_matches)
}

fn runtime_mcp_cache_is_fresh(
    app: &AppHandle,
    snapshot: &OemRuntimeSnapshot,
) -> Result<bool, String> {
    let expected_mcp_keys = runtime_mcp_bindings_from_snapshot(snapshot)
        .into_iter()
        .map(|(mcp_key, _)| mcp_key)
        .collect::<Vec<_>>();
    let Some(state) = load_runtime_mcp_sync_state(app)? else {
        return Ok(false);
    };
    if state.brand_id.trim() != snapshot.brand_id.trim() {
        return Ok(false);
    }
    if state.published_version != snapshot.published_version {
        return Ok(false);
    }
    if state.mcp_keys != expected_mcp_keys {
        return Ok(false);
    }
    Ok(runtime_mcp_config_source_path(app)?.exists())
}

fn load_packaged_runtime_skill_baseline_manifest(
    app: &AppHandle,
) -> Result<Option<PackagedRuntimeSkillBaselineManifest>, String> {
    let path = packaged_runtime_skills_manifest_path(app);
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(&path).map_err(|e| {
        format!(
            "failed to read packaged runtime skill baseline manifest {}: {e}",
            path.to_string_lossy()
        )
    })?;
    let parsed =
        serde_json::from_str::<PackagedRuntimeSkillBaselineManifest>(&raw).map_err(|e| {
            format!(
                "failed to parse packaged runtime skill baseline manifest {}: {e}",
                path.to_string_lossy()
            )
        })?;
    Ok(Some(parsed))
}

fn packaged_runtime_skill_baseline_matches_snapshot(
    manifest: &PackagedRuntimeSkillBaselineManifest,
    snapshot: &OemRuntimeSnapshot,
) -> bool {
    manifest.brand_id.trim() == snapshot.brand_id.trim()
        && manifest.published_version == snapshot.published_version
        && manifest.skill_slugs
            == runtime_skill_bindings_from_snapshot(snapshot)
                .into_iter()
                .map(|(slug, _)| slug)
                .collect::<Vec<_>>()
}

fn activate_packaged_runtime_skill_baseline(
    app: &AppHandle,
    snapshot: &OemRuntimeSnapshot,
) -> Result<bool, String> {
    let Some(manifest) = load_packaged_runtime_skill_baseline_manifest(app)? else {
        return Ok(false);
    };
    if !packaged_runtime_skill_baseline_matches_snapshot(&manifest, snapshot) {
        return Ok(false);
    }

    let packaged_root = packaged_runtime_skills_root(app);
    if !packaged_root.exists() {
        return Ok(false);
    }

    let workspace_dir = openclaw_workspace_dir(app)?;
    fs::create_dir_all(&workspace_dir)
        .map_err(|e| format!("failed to create openclaw workspace dir: {e}"))?;
    let skills_root = runtime_skills_dir(app)?;
    if skills_root.exists() {
        fs::remove_dir_all(&skills_root).map_err(|e| {
            format!(
                "failed to clear existing runtime skills dir {}: {e}",
                skills_root.to_string_lossy()
            )
        })?;
    }
    fs::create_dir_all(&skills_root).map_err(|e| {
        format!(
            "failed to create runtime skills dir {}: {e}",
            skills_root.to_string_lossy()
        )
    })?;
    let mut copied_skill_dirs = Vec::new();
    let entries = fs::read_dir(&packaged_root).map_err(|e| {
        format!(
            "failed to scan packaged runtime skills dir {}: {e}",
            packaged_root.to_string_lossy()
        )
    })?;
    for entry in entries {
        let entry = entry.map_err(|e| format!("failed to read packaged skill dir entry: {e}"))?;
        let source_path = entry.path();
        let metadata = entry.metadata().map_err(|e| {
            format!(
                "failed to read packaged skill metadata {}: {e}",
                source_path.to_string_lossy()
            )
        })?;
        if !metadata.is_dir() || !source_path.join("SKILL.md").exists() {
            continue;
        }
        if !skill_supports_current_platform(&source_path)? {
            append_desktop_bootstrap_log(
                app,
                &format!(
                    "runtime skills: skip packaged unsupported skill dir={} platform={}",
                    source_path
                        .file_name()
                        .and_then(|value| value.to_str())
                        .unwrap_or("unknown"),
                    current_openclaw_skill_platform()
                ),
            );
            continue;
        }
        let dir_name = source_path
            .file_name()
            .and_then(|value| value.to_str())
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
            .ok_or_else(|| {
                format!(
                    "failed to resolve packaged skill dir name from {}",
                    source_path.to_string_lossy()
                )
            })?;
        let target_path = skills_root.join(&dir_name);
        copy_dir_recursive(&source_path, &target_path)?;
        copied_skill_dirs.push(dir_name);
    }
    let bundled_manifest = json!({
        "version": "0.1.0",
        "preset": snapshot.brand_id,
        "publishedVersion": snapshot.published_version,
        "skills": copied_skill_dirs,
    });
    let runtime_skills_manifest_path = runtime_skills_manifest_path(app)?;
    write_locked_json_file(&runtime_skills_manifest_path, &bundled_manifest)?;

    let sync_state = RuntimeSkillSyncState {
        brand_id: snapshot.brand_id.clone(),
        published_version: snapshot.published_version,
        skill_slugs: runtime_skill_bindings_from_snapshot(snapshot)
            .into_iter()
            .map(|(slug, _)| slug)
            .collect(),
        synced_at: current_unix_timestamp_string(),
    };
    save_runtime_skill_sync_state(app, &sync_state)?;
    Ok(true)
}

fn load_packaged_runtime_mcp_baseline_manifest(
    app: &AppHandle,
) -> Result<Option<PackagedRuntimeMcpBaselineManifest>, String> {
    let path = packaged_runtime_mcp_manifest_path(app);
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(&path).map_err(|e| {
        format!(
            "failed to read packaged runtime mcp baseline manifest {}: {e}",
            path.to_string_lossy()
        )
    })?;
    let parsed = serde_json::from_str::<PackagedRuntimeMcpBaselineManifest>(&raw).map_err(|e| {
        format!(
            "failed to parse packaged runtime mcp baseline manifest {}: {e}",
            path.to_string_lossy()
        )
    })?;
    Ok(Some(parsed))
}

fn packaged_runtime_mcp_baseline_matches_snapshot(
    manifest: &PackagedRuntimeMcpBaselineManifest,
    snapshot: &OemRuntimeSnapshot,
) -> bool {
    manifest.brand_id.trim() == snapshot.brand_id.trim()
        && manifest.published_version == snapshot.published_version
        && manifest.mcp_keys
            == runtime_mcp_bindings_from_snapshot(snapshot)
                .into_iter()
                .map(|(mcp_key, _)| mcp_key)
                .collect::<Vec<_>>()
}

fn activate_packaged_runtime_mcp_baseline(
    app: &AppHandle,
    snapshot: &OemRuntimeSnapshot,
) -> Result<bool, String> {
    let Some(manifest) = load_packaged_runtime_mcp_baseline_manifest(app)? else {
        return Ok(false);
    };
    if !packaged_runtime_mcp_baseline_matches_snapshot(&manifest, snapshot) {
        return Ok(false);
    }

    let packaged_path = packaged_runtime_mcp_root(app).join("mcp.json");
    if !packaged_path.exists() {
        return Ok(false);
    }

    let runtime_path = runtime_mcp_config_source_path(app)?;
    let raw = fs::read_to_string(&packaged_path).map_err(|e| {
        format!(
            "failed to read packaged runtime mcp baseline {}: {e}",
            packaged_path.to_string_lossy()
        )
    })?;
    fs::write(&runtime_path, raw).map_err(|e| {
        format!(
            "failed to activate packaged runtime mcp baseline {}: {e}",
            runtime_path.to_string_lossy()
        )
    })?;

    let sync_state = RuntimeMcpSyncState {
        brand_id: snapshot.brand_id.clone(),
        published_version: snapshot.published_version,
        mcp_keys: runtime_mcp_bindings_from_snapshot(snapshot)
            .into_iter()
            .map(|(mcp_key, _)| mcp_key)
            .collect(),
        synced_at: current_unix_timestamp_string(),
    };
    save_runtime_mcp_sync_state(app, &sync_state)?;
    Ok(true)
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

fn copy_dir_recursive_missing(source: &Path, destination: &Path) -> Result<(), String> {
    if !source.exists() {
        return Ok(());
    }
    if destination.exists() && !destination.is_dir() {
        return Err(format!(
            "failed to merge runtime dir {} into {}: destination is not a directory",
            source.to_string_lossy(),
            destination.to_string_lossy()
        ));
    }
    fs::create_dir_all(destination).map_err(|e| {
        format!(
            "failed to create runtime destination dir {}: {e}",
            destination.to_string_lossy()
        )
    })?;
    for entry in fs::read_dir(source).map_err(|e| {
        format!(
            "failed to read runtime source dir {}: {e}",
            source.to_string_lossy()
        )
    })? {
        let entry = entry.map_err(|e| format!("failed to read runtime source entry: {e}"))?;
        let source_path = entry.path();
        let destination_path = destination.join(entry.file_name());
        let metadata = entry.metadata().map_err(|e| {
            format!(
                "failed to read runtime source metadata {}: {e}",
                source_path.to_string_lossy()
            )
        })?;
        if metadata.is_dir() {
            copy_dir_recursive_missing(&source_path, &destination_path)?;
            continue;
        }
        if destination_path.exists() {
            continue;
        }
        if let Some(parent) = destination_path.parent() {
            fs::create_dir_all(parent).map_err(|e| {
                format!(
                    "failed to create runtime destination parent {}: {e}",
                    parent.to_string_lossy()
                )
            })?;
        }
        fs::copy(&source_path, &destination_path).map_err(|e| {
            format!(
                "failed to copy runtime file {} -> {}: {e}",
                source_path.to_string_lossy(),
                destination_path.to_string_lossy()
            )
        })?;
    }
    Ok(())
}

fn copy_file_if_missing(source: &Path, destination: &Path) -> Result<bool, String> {
    if !source.exists() || destination.exists() {
        return Ok(false);
    }
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(|e| {
            format!(
                "failed to create runtime destination parent {}: {e}",
                parent.to_string_lossy()
            )
        })?;
    }
    fs::copy(source, destination).map_err(|e| {
        format!(
            "failed to copy runtime file {} -> {}: {e}",
            source.to_string_lossy(),
            destination.to_string_lossy()
        )
    })?;
    Ok(true)
}

fn ensure_runtime_scope_migrated(app: &AppHandle) -> Result<(), String> {
    let runtime_root = runtime_scope_root_dir(app)?;
    let workspace_dir = runtime_root.join("workspace");
    let state_dir = runtime_root.join("state");
    let config_path = runtime_root.join("openclaw.json");
    let skill_sync_state_path = runtime_root.join("runtime-skill-sync-state.json");
    let mcp_config_path = runtime_root.join("mcp.json");
    let mcp_sync_state_path = runtime_root.join("runtime-mcp-sync-state.json");

    let legacy_workspace_dir = legacy_openclaw_workspace_dir(app);
    if legacy_workspace_dir.exists() {
        copy_dir_recursive_missing(&legacy_workspace_dir, &workspace_dir)?;
    }

    let legacy_state_dir = legacy_openclaw_state_dir(app)?;
    if legacy_state_dir.exists() {
        copy_dir_recursive_missing(&legacy_state_dir, &state_dir)?;
    }

    copy_file_if_missing(&legacy_openclaw_config_path(app)?, &config_path)?;
    copy_file_if_missing(
        &legacy_runtime_skill_sync_state_path(app)?,
        &skill_sync_state_path,
    )?;
    copy_file_if_missing(
        &legacy_runtime_mcp_config_source_path(app)?,
        &mcp_config_path,
    )?;
    copy_file_if_missing(
        &legacy_runtime_mcp_sync_state_path(app)?,
        &mcp_sync_state_path,
    )?;

    Ok(())
}

fn find_skill_root(dir: &Path) -> Result<Option<PathBuf>, String> {
    if dir.join("SKILL.md").exists() {
        return Ok(Some(dir.to_path_buf()));
    }
    let entries = fs::read_dir(dir).map_err(|e| {
        format!(
            "failed to scan extracted skill dir {}: {e}",
            dir.to_string_lossy()
        )
    })?;
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
    let entries = fs::read_dir(dir).map_err(|e| {
        format!(
            "failed to rescan extracted skill dir {}: {e}",
            dir.to_string_lossy()
        )
    })?;
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
    let snapshot = load_oem_runtime_snapshot_internal(app)?.ok_or_else(|| {
        String::from("OEM runtime snapshot is missing; cannot sync runtime skills")
    })?;
    if runtime_skills_cache_is_fresh(app, &snapshot)? {
        return Ok(false);
    }
    if activate_packaged_runtime_skill_baseline(app, &snapshot)? {
        return Ok(true);
    }

    let workspace_dir = openclaw_workspace_dir(app)?;
    fs::create_dir_all(&workspace_dir)
        .map_err(|e| format!("failed to create openclaw workspace dir: {e}"))?;
    let skills_root = runtime_skills_dir(app)?;
    let temp_sync_root =
        workspace_dir.join(format!(".skills-sync-{}", current_unix_timestamp_string()));
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
        if !skill_supports_current_platform(&skill_root)? {
            append_desktop_bootstrap_log(
                app,
                &format!(
                    "runtime skills: skip downloaded unsupported skill slug={} dir={} platform={}",
                    slug,
                    dir_name,
                    current_openclaw_skill_platform()
                ),
            );
            continue;
        }
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

fn sync_current_brand_runtime_mcp(app: &AppHandle) -> Result<bool, String> {
    let snapshot = load_oem_runtime_snapshot_internal(app)?
        .ok_or_else(|| String::from("OEM runtime snapshot is missing; cannot sync runtime mcp"))?;
    if runtime_mcp_cache_is_fresh(app, &snapshot)? {
        return Ok(false);
    }
    if activate_packaged_runtime_mcp_baseline(app, &snapshot)? {
        return Ok(true);
    }

    let runtime_path = runtime_mcp_config_source_path(app)?;
    let mcp_servers = runtime_mcp_servers_from_snapshot(&snapshot);
    let manifest = json!({
        "mcpServers": mcp_servers,
    });
    write_locked_json_file(&runtime_path, &manifest)?;
    let mcp_keys = runtime_mcp_bindings_from_snapshot(&snapshot)
        .into_iter()
        .map(|(mcp_key, _)| mcp_key)
        .collect();

    let sync_state = RuntimeMcpSyncState {
        brand_id: snapshot.brand_id,
        published_version: snapshot.published_version,
        mcp_keys,
        synced_at: current_unix_timestamp_string(),
    };
    save_runtime_mcp_sync_state(app, &sync_state)?;
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
    let skills_dir = runtime_skills_dir(app)?;
    let skills_dir = if skills_dir.exists() {
        skills_dir
    } else {
        let resource_dir = resource_bundled_skills_dir(app);
        if !resource_dir.exists() {
            return Ok(Vec::new());
        }
        resource_dir
    };

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
    if config
        .get("httpUrl")
        .and_then(|value| value.as_str())
        .is_some()
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
    let runtime_root = resolved_runtime_root(&runtime)?;
    let node_path = resolved_runtime_node_path(&runtime_root);
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

fn node_options_safe_path(path: &Path) -> String {
    let raw = path.to_string_lossy();
    let normalized = raw
        .strip_prefix(r"\\?\")
        .or_else(|| raw.strip_prefix("//?/"))
        .unwrap_or(raw.as_ref());
    normalized.replace('\\', "/")
}

fn node_command_safe_path(path: &Path) -> String {
    let raw = path.to_string_lossy();
    raw.strip_prefix(r"\\?\")
        .or_else(|| raw.strip_prefix("//?/"))
        .unwrap_or(raw.as_ref())
        .to_string()
}

fn normalize_windows_path_text(raw: &str) -> String {
    raw.strip_prefix(r"\\?\")
        .or_else(|| raw.strip_prefix("//?/"))
        .unwrap_or(raw)
        .replace('\\', "/")
}

fn configure_runtime_network_env(command: &mut Command, app: &AppHandle) {
    let hook_path = resource_node_fetch_user_agent_hook_path(app);
    if hook_path.exists() {
        let require_arg = format!("--require={}", node_options_safe_path(&hook_path));
        let next_node_options =
            append_node_options_arg(env::var("NODE_OPTIONS").ok(), &require_arg);
        append_desktop_bootstrap_log(
            app,
            &format!(
                "configure_runtime_network_env: hook_path={} node_options={}",
                hook_path.to_string_lossy(),
                next_node_options
            ),
        );
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
    if let Some(bundled_archive) = resource_runtime_archive_path(app, &config)? {
        fs::copy(&bundled_archive, &archive_path).map_err(|e| {
            format!(
                "failed to stage bundled runtime archive {} -> {}: {e}",
                bundled_archive.to_string_lossy(),
                archive_path.to_string_lossy()
            )
        })?;
    } else {
        download_runtime_archive(
            app,
            &artifact_url,
            &archive_path,
            config.artifact_sha256.clone(),
        )?;
    }

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
        Ok(_) | Err(keyring::Error::NoEntry) => entry
            .set_password(token.trim())
            .map_err(|e| format!("failed to sync gateway token keyring: {e}")),
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

fn append_desktop_bootstrap_log(app: &AppHandle, message: &str) {
    let paths = match ensure_runtime_dirs(app) {
        Ok(paths) => paths,
        Err(_) => return,
    };
    let log_path = PathBuf::from(paths.log_dir).join("desktop-bootstrap.log");
    let timestamp = chrono_like_timestamp();
    let line = format!("{timestamp} {message}\n");
    let mut options = fs::OpenOptions::new();
    options.create(true).append(true);
    if let Ok(mut file) = options.open(log_path) {
        let _ = file.write_all(line.as_bytes());
    }
}

fn desktop_fault_report_err<T>(app: &AppHandle, stage: &str, error: impl Into<String>) -> Result<T, String> {
    let error = error.into();
    append_desktop_bootstrap_log(app, &format!("desktop_fault_report:{stage}: error {error}"));
    Err(error)
}

fn chrono_like_timestamp() -> String {
    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_secs())
        .unwrap_or(0);
    format!("[{}]", seconds)
}

fn random_hex_string(byte_len: usize) -> String {
    let mut bytes = vec![0u8; byte_len.max(1)];
    OsRng.fill_bytes(&mut bytes);
    bytes
        .iter()
        .map(|value| format!("{value:02x}"))
        .collect::<String>()
}

fn sidecar_log_paths(app: &AppHandle) -> Result<(PathBuf, PathBuf), String> {
    let paths = ensure_runtime_dirs(app)?;
    let log_dir = PathBuf::from(paths.log_dir);
    Ok((
        log_dir.join("sidecar-stdout.log"),
        log_dir.join("sidecar-stderr.log"),
    ))
}

fn read_log_tail(path: &Path, max_chars: usize) -> Option<String> {
    let raw = fs::read_to_string(path).ok()?;
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    let char_count = trimmed.chars().count();
    if char_count <= max_chars {
        return Some(trimmed.to_string());
    }
    Some(
        trimmed
            .chars()
            .skip(char_count.saturating_sub(max_chars))
            .collect(),
    )
}

fn redact_sensitive_segment(value: &str, marker: &str) -> String {
    let mut output = String::new();
    let mut cursor = 0usize;
    while let Some(relative) = value[cursor..].find(marker) {
        let start = cursor + relative;
        output.push_str(&value[cursor..start]);
        output.push_str(marker);
        let secret_start = start + marker.len();
        let secret_end = value[secret_start..]
            .find(|ch: char| {
                ch.is_whitespace() || ch == '"' || ch == '\'' || ch == '&' || ch == ',' || ch == ';'
            })
            .map(|offset| secret_start + offset)
            .unwrap_or(value.len());
        if secret_end > secret_start {
            output.push_str("[REDACTED]");
        }
        cursor = secret_end;
    }
    output.push_str(&value[cursor..]);
    output
}

fn redact_sensitive_lines(value: &str) -> String {
    value
        .lines()
        .map(|line| {
            let mut current = line.to_string();
            current = redact_sensitive_segment(&current, "Bearer ");
            current = redact_sensitive_segment(&current, "token=");
            current = redact_sensitive_segment(&current, "api_key=");
            current = redact_sensitive_segment(&current, "apiKey=");
            current = redact_sensitive_segment(&current, "Authorization: ");
            current
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn trim_log_by_lines_and_bytes(value: &str, max_lines: usize, max_bytes: usize) -> String {
    let lines: Vec<&str> = value.lines().collect();
    let start = lines.len().saturating_sub(max_lines);
    let joined = lines[start..].join("\n");
    if joined.len() <= max_bytes {
        return joined;
    }
    let start_byte = joined.len().saturating_sub(max_bytes);
    let mut boundary = 0usize;
    for (index, _) in joined.char_indices() {
        if index >= start_byte {
            boundary = index;
            break;
        }
    }
    joined[boundary..].to_string()
}

fn read_fault_report_log(path: &Path) -> Option<String> {
    let raw = fs::read_to_string(path).ok()?;
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    let redacted = redact_sensitive_lines(trimmed);
    let limited = trim_log_by_lines_and_bytes(&redacted, 1000, 300 * 1024);
    Some(limited)
}

fn desktop_fault_report_device_id_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_base_dir(app)?
        .join("config")
        .join("desktop-device-id"))
}

fn load_or_create_desktop_fault_report_device_id(app: &AppHandle) -> Result<String, String> {
    let path = desktop_fault_report_device_id_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| {
            format!(
                "failed to create desktop device id dir {}: {e}",
                parent.to_string_lossy()
            )
        })?;
    }
    if path.exists() {
        let value = fs::read_to_string(&path).map_err(|e| {
            format!(
                "failed to read desktop device id {}: {e}",
                path.to_string_lossy()
            )
        })?;
        let normalized = value.trim().to_string();
        if !normalized.is_empty() {
            return Ok(normalized);
        }
    }
    let value = format!("D-{}", random_hex_string(6).to_uppercase());
    fs::write(&path, format!("{value}\n")).map_err(|e| {
        format!(
            "failed to write desktop device id {}: {e}",
            path.to_string_lossy()
        )
    })?;
    #[cfg(unix)]
    {
        let _ = fs::set_permissions(&path, fs::Permissions::from_mode(0o600));
    }
    Ok(value)
}

fn current_platform_label() -> String {
    if cfg!(target_os = "macos") {
        String::from("macos")
    } else if cfg!(target_os = "windows") {
        String::from("windows")
    } else if cfg!(target_os = "linux") {
        String::from("linux")
    } else {
        env::consts::OS.to_string()
    }
}

fn current_platform_version() -> Option<String> {
    #[cfg(target_os = "macos")]
    {
        let output = Command::new("sw_vers")
            .arg("-productVersion")
            .output()
            .ok()?;
        if !output.status.success() {
            return None;
        }
        let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
        return if value.is_empty() { None } else { Some(value) };
    }
    #[cfg(target_os = "windows")]
    {
        let mut command = Command::new("cmd");
        command.args(["/C", "ver"]);
        configure_background_child_process(&mut command);
        let output = command.output().ok()?;
        if !output.status.success() {
            return None;
        }
        let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
        return if value.is_empty() { None } else { Some(value) };
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        None
    }
}

fn current_arch_label() -> String {
    if cfg!(target_arch = "aarch64") {
        String::from("aarch64")
    } else if cfg!(target_arch = "x86_64") {
        String::from("x64")
    } else {
        env::consts::ARCH.to_string()
    }
}

#[tauri::command]
fn load_startup_diagnostics(app: AppHandle) -> Result<StartupDiagnosticsSnapshot, String> {
    append_desktop_bootstrap_log(&app, "load_startup_diagnostics: begin");
    let paths = ensure_runtime_dirs(&app)
        .map_err(|error| {
            append_desktop_bootstrap_log(
                &app,
                &format!("load_startup_diagnostics: ensure_runtime_dirs failed {error}"),
            );
            error
        })?;
    let bootstrap_log_path = PathBuf::from(&paths.log_dir).join("desktop-bootstrap.log");
    let (sidecar_stdout_log_path, sidecar_stderr_log_path) = sidecar_log_paths(&app)
        .map_err(|error| {
            append_desktop_bootstrap_log(
                &app,
                &format!("load_startup_diagnostics: sidecar_log_paths failed {error}"),
            );
            error
        })?;

    let snapshot = StartupDiagnosticsSnapshot {
        bootstrap_log_path: bootstrap_log_path.to_string_lossy().to_string(),
        sidecar_stdout_log_path: sidecar_stdout_log_path.to_string_lossy().to_string(),
        sidecar_stderr_log_path: sidecar_stderr_log_path.to_string_lossy().to_string(),
        bootstrap_tail: read_log_tail(&bootstrap_log_path, 1200),
        sidecar_stdout_tail: read_log_tail(&sidecar_stdout_log_path, 1200),
        sidecar_stderr_tail: read_log_tail(&sidecar_stderr_log_path, 1200),
    };

    append_desktop_bootstrap_log(
        &app,
        &format!(
            "load_startup_diagnostics: success bootstrapLogExists={} stdoutLogExists={} stderrLogExists={} bootstrapTailPresent={} stdoutTailPresent={} stderrTailPresent={}",
            bootstrap_log_path.exists(),
            sidecar_stdout_log_path.exists(),
            sidecar_stderr_log_path.exists(),
            snapshot.bootstrap_tail.is_some(),
            snapshot.sidecar_stdout_tail.is_some(),
            snapshot.sidecar_stderr_tail.is_some()
        ),
    );

    Ok(snapshot)
}

fn fallback_runtime_diagnosis(app: &AppHandle) -> RuntimeDiagnosis {
    let paths = ensure_runtime_dirs(app).unwrap_or(RuntimePaths {
        work_dir: String::new(),
        log_dir: String::new(),
        cache_dir: String::new(),
    });
    RuntimeDiagnosis {
        runtime_found: false,
        runtime_installable: false,
        runtime_source: None,
        runtime_path: None,
        runtime_version: None,
        runtime_download_url: None,
        skills_dir_ready: false,
        mcp_config_ready: false,
        api_key_configured: false,
        skills_dir: String::new(),
        mcp_config: String::new(),
        work_dir: paths.work_dir,
        log_dir: paths.log_dir,
        cache_dir: paths.cache_dir,
    }
}

fn fallback_startup_diagnostics(app: &AppHandle, log_dir: &str) -> StartupDiagnosticsSnapshot {
    let bootstrap_log_path = if log_dir.trim().is_empty() {
        String::new()
    } else {
        PathBuf::from(log_dir)
            .join("desktop-bootstrap.log")
            .to_string_lossy()
            .to_string()
    };
    let (sidecar_stdout_log_path, sidecar_stderr_log_path) = sidecar_log_paths(app)
        .map(|(stdout, stderr)| {
            (
                stdout.to_string_lossy().to_string(),
                stderr.to_string_lossy().to_string(),
            )
        })
        .unwrap_or_else(|_| (String::new(), String::new()));

    StartupDiagnosticsSnapshot {
        bootstrap_log_path,
        sidecar_stdout_log_path,
        sidecar_stderr_log_path,
        bootstrap_tail: None,
        sidecar_stdout_tail: None,
        sidecar_stderr_tail: None,
    }
}

#[tauri::command]
fn prepare_desktop_fault_report_archive(
    app: AppHandle,
    input: DesktopFaultReportPrepareInput,
) -> Result<PreparedDesktopFaultReportArchive, String> {
    let report_id = input
        .report_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(String::from)
        .unwrap_or_else(|| {
            format!(
                "FR-{}",
                random_hex_string(6).to_uppercase()
            )
        });
    let extra_diagnostics_key_count = input
        .extra_diagnostics
        .as_ref()
        .and_then(|value| value.as_object())
        .map(|value| value.len())
        .unwrap_or(0);
    append_desktop_bootstrap_log(
        &app,
        &format!(
            "desktop_fault_report:prepare begin reportId={} entry={} failureStage={} installSessionIdPresent={} appName={} brandId={} extraDiagnosticsKeys={}",
            report_id,
            input.entry,
            input.failure_stage,
            input
                .install_session_id
                .as_deref()
                .map(str::trim)
                .map(|value| !value.is_empty())
                .unwrap_or(false),
            input.app_name.as_deref().unwrap_or(DESKTOP_BRAND_ID),
            input.brand_id.as_deref().unwrap_or(DESKTOP_BRAND_ID),
            extra_diagnostics_key_count
        ),
    );
    let device_id = load_or_create_desktop_fault_report_device_id(&app).unwrap_or_else(|error| {
        append_desktop_bootstrap_log(
            &app,
            &format!(
                "desktop_fault_report:prepare device_id failed reportId={} error={} fallback=ephemeral",
                report_id, error
            ),
        );
        format!("ephemeral-{}", random_hex_string(8).to_uppercase())
    });
    let runtime_diagnosis = diagnose_runtime(app.clone()).unwrap_or_else(|error| {
        append_desktop_bootstrap_log(
            &app,
            &format!(
                "desktop_fault_report:prepare diagnose_runtime failed reportId={} error={} fallback=true",
                report_id, error
            ),
        );
        fallback_runtime_diagnosis(&app)
    });
    let startup_diagnostics = load_startup_diagnostics(app.clone()).unwrap_or_else(|error| {
        append_desktop_bootstrap_log(
            &app,
            &format!(
                "desktop_fault_report:prepare load_startup_diagnostics failed reportId={} error={} fallback=true",
                report_id, error
            ),
        );
        fallback_startup_diagnostics(&app, &runtime_diagnosis.log_dir)
    });
    let bootstrap_log_path = PathBuf::from(&startup_diagnostics.bootstrap_log_path);
    let stdout_log_path = PathBuf::from(&startup_diagnostics.sidecar_stdout_log_path);
    let stderr_log_path = PathBuf::from(&startup_diagnostics.sidecar_stderr_log_path);
    let logs = vec![
        (
            "logs/desktop-bootstrap.log",
            read_fault_report_log(&bootstrap_log_path),
        ),
        (
            "logs/sidecar-stdout.log",
            read_fault_report_log(&stdout_log_path),
        ),
        (
            "logs/sidecar-stderr.log",
            read_fault_report_log(&stderr_log_path),
        ),
    ];
    append_desktop_bootstrap_log(
        &app,
        &format!(
            "desktop_fault_report:prepare logs reportId={} bootstrapLogExists={} stdoutLogExists={} stderrLogExists={} includedLogs={}",
            report_id,
            bootstrap_log_path.exists(),
            stdout_log_path.exists(),
            stderr_log_path.exists(),
            logs.iter().filter(|(_, content)| content.is_some()).count()
        ),
    );

    let payload = json!({
        "report_id": report_id,
        "entry": input.entry,
        "install_session_id": input.install_session_id,
        "app_name": input.app_name.unwrap_or_else(|| String::from(DESKTOP_BRAND_ID)),
        "brand_id": input.brand_id.unwrap_or_else(|| String::from(DESKTOP_BRAND_ID)),
        "app_version": input.app_version.unwrap_or_else(|| env!("CARGO_PKG_VERSION").to_string()),
        "release_channel": input.release_channel,
        "device_id": device_id,
        "platform": current_platform_label(),
        "platform_version": current_platform_version(),
        "arch": current_arch_label(),
        "failure_stage": input.failure_stage,
        "error_title": input.error_title,
        "error_message": input.error_message,
        "error_code": input.error_code,
        "runtime_found": input.runtime_found.unwrap_or(runtime_diagnosis.runtime_found),
        "runtime_installable": input
            .runtime_installable
            .unwrap_or(runtime_diagnosis.runtime_installable),
        "runtime_version": input.runtime_version.or(runtime_diagnosis.runtime_version.clone()),
        "runtime_path": input.runtime_path.or(runtime_diagnosis.runtime_path.clone()),
        "work_dir": input.work_dir.or(Some(runtime_diagnosis.work_dir.clone())),
        "log_dir": input.log_dir.or(Some(runtime_diagnosis.log_dir.clone())),
        "runtime_download_url": input
            .runtime_download_url
            .or(runtime_diagnosis.runtime_download_url.clone()),
        "install_progress_phase": input.install_progress_phase,
        "install_progress_percent": input.install_progress_percent,
    });
    let runtime_diagnostics_json = json!({
        "runtimeDiagnosis": runtime_diagnosis,
        "startupDiagnostics": startup_diagnostics,
        "extraDiagnostics": input.extra_diagnostics.unwrap_or(serde_json::Value::Null),
    });
    let manifest_json = json!({
        "report_id": payload["report_id"],
        "entry": payload["entry"],
        "device_id": payload["device_id"],
        "platform": payload["platform"],
        "arch": payload["arch"],
        "created_at": timestamp_string(),
        "files": logs
            .iter()
            .filter_map(|(name, content)| content.as_ref().map(|value| json!({
                "name": name,
                "size_bytes": value.as_bytes().len(),
                "truncated": value.lines().count() >= 1000 || value.as_bytes().len() >= 300 * 1024
            })))
            .collect::<Vec<_>>(),
    });

    let cursor = Cursor::new(Vec::<u8>::new());
    let mut archive = zip::ZipWriter::new(cursor);
    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    let manifest_bytes = match serde_json::to_vec_pretty(&manifest_json) {
        Ok(bytes) => bytes,
        Err(e) => {
            return desktop_fault_report_err(
                &app,
                "serialize_manifest",
                format!("failed to serialize fault report manifest: {e}"),
            )
        }
    };
    let summary_bytes = match serde_json::to_vec_pretty(&payload) {
        Ok(bytes) => bytes,
        Err(e) => {
            return desktop_fault_report_err(
                &app,
                "serialize_summary",
                format!("failed to serialize fault report summary: {e}"),
            )
        }
    };
    let diagnostics_bytes = match serde_json::to_vec_pretty(&runtime_diagnostics_json) {
        Ok(bytes) => bytes,
        Err(e) => {
            return desktop_fault_report_err(
                &app,
                "serialize_diagnostics",
                format!("failed to serialize fault report diagnostics: {e}"),
            )
        }
    };
    let files = vec![
        ("manifest.json", manifest_bytes),
        ("error-summary.json", summary_bytes),
        ("runtime-diagnostics.json", diagnostics_bytes),
    ];
    let metadata_bytes: usize = files.iter().map(|(_, bytes)| bytes.len()).sum();
    let log_bytes: usize = logs
        .iter()
        .filter_map(|(_, content)| content.as_ref().map(|value| value.as_bytes().len()))
        .sum();
    append_desktop_bootstrap_log(
        &app,
        &format!(
            "desktop_fault_report:prepare archive reportId={} metadataFiles={} logFiles={} metadataBytes={} logBytes={}",
            report_id,
            files.len(),
            logs.iter().filter(|(_, content)| content.is_some()).count(),
            metadata_bytes,
            log_bytes
        ),
    );
    for (name, bytes) in files {
        if let Err(e) = archive.start_file(name, options) {
            return desktop_fault_report_err(
                &app,
                "start_metadata_file",
                format!("failed to add fault report file {name}: {e}"),
            );
        }
        if let Err(e) = archive.write_all(&bytes) {
            return desktop_fault_report_err(
                &app,
                "write_metadata_file",
                format!("failed to write fault report file {name}: {e}"),
            );
        }
    }
    for (name, content) in logs {
        if let Some(value) = content {
            if let Err(e) = archive.start_file(name, options) {
                return desktop_fault_report_err(
                    &app,
                    "start_log_file",
                    format!("failed to add fault report log {name}: {e}"),
                );
            }
            if let Err(e) = archive.write_all(value.as_bytes()) {
                return desktop_fault_report_err(
                    &app,
                    "write_log_file",
                    format!("failed to write fault report log {name}: {e}"),
                );
            }
        }
    }
    let cursor = match archive.finish() {
        Ok(cursor) => cursor,
        Err(e) => {
            return desktop_fault_report_err(
                &app,
                "finalize_archive",
                format!("failed to finalize fault report archive: {e}"),
            )
        }
    };
    let bytes = cursor.into_inner();
    let file_sha256 = sha256_hex(&bytes);
    let file_name = format!("fault-report-{report_id}.zip");
    append_desktop_bootstrap_log(
        &app,
        &format!(
            "desktop_fault_report:prepare success reportId={} fileName={} archiveBytes={} sha256={}",
            report_id,
            file_name,
            bytes.len(),
            file_sha256
        ),
    );

    Ok(PreparedDesktopFaultReportArchive {
        report_id,
        device_id: payload["device_id"]
            .as_str()
            .unwrap_or_default()
            .to_string(),
        platform: payload["platform"].as_str().unwrap_or_default().to_string(),
        platform_version: payload["platform_version"].as_str().map(String::from),
        arch: payload["arch"].as_str().unwrap_or_default().to_string(),
        file_name,
        file_size_bytes: bytes.len(),
        file_sha256,
        archive_base64: base64::engine::general_purpose::STANDARD.encode(bytes),
        payload,
    })
}

#[tauri::command]
fn load_desktop_client_metrics_context(
    app: AppHandle,
) -> Result<DesktopClientMetricsContext, String> {
    Ok(DesktopClientMetricsContext {
        device_id: load_or_create_desktop_fault_report_device_id(&app)?,
        platform: current_platform_label(),
        platform_version: current_platform_version(),
        arch: current_arch_label(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        brand_id: String::from(DESKTOP_BRAND_ID),
    })
}

fn describe_sidecar_exit(status: ExitStatus, stdout_path: &Path, stderr_path: &Path) -> String {
    let code = status
        .code()
        .map(|value| value.to_string())
        .unwrap_or_else(|| String::from("unknown"));
    let detail = read_log_tail(stderr_path, 400).or_else(|| read_log_tail(stdout_path, 400));
    match detail {
        Some(detail) => format!("openclaw runtime exited before becoming healthy (code {code}): {detail}"),
        None => format!(
            "openclaw runtime exited before becoming healthy (code {code}). Check {} and {} for details.",
            stdout_path.to_string_lossy(),
            stderr_path.to_string_lossy()
        ),
    }
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
    ports
        .into_iter()
        .filter(|port| is_loopback_port_occupied(*port))
        .collect()
}

fn listen_port_targets() -> Vec<u16> {
    let mut ports = vec![configured_sidecar_port()];
    ports.sort_unstable();
    ports.dedup();
    ports
}

#[cfg(not(windows))]
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

#[cfg(windows)]
fn port_listener_pids(port: u16) -> Vec<u32> {
    let mut command = Command::new("netstat");
    command.args(["-ano", "-p", "tcp"]);
    configure_background_child_process(&mut command);
    let output = match command.output() {
        Ok(output) if output.status.success() => output,
        _ => return Vec::new(),
    };

    let port_suffix = format!(":{port}");
    String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter_map(|line| {
            let trimmed = line.trim();
            if !trimmed.contains("LISTENING") {
                return None;
            }
            let columns: Vec<&str> = trimmed.split_whitespace().collect();
            if columns.len() < 5 {
                return None;
            }
            let local_addr = columns[1];
            if !local_addr.ends_with(&port_suffix) {
                return None;
            }
            columns.last()?.trim().parse::<u32>().ok()
        })
        .collect()
}

#[cfg(not(windows))]
fn managed_listener_pids(app: &AppHandle, ports: &[u16]) -> Vec<u32> {
    let mut pids = Vec::new();
    for port in ports {
        for pid in port_listener_pids(*port) {
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
    pids
}

#[cfg(windows)]
fn managed_listener_pids(_app: &AppHandle, ports: &[u16]) -> Vec<u32> {
    let mut pids = Vec::new();
    for port in ports {
        for pid in port_listener_pids(*port) {
            if !pids.contains(&pid) {
                pids.push(pid);
            }
        }
    }
    pids
}

#[cfg(not(windows))]
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

#[cfg(windows)]
fn inspect_process(pid: u32) -> Option<ListeningProcess> {
    let mut command = Command::new("tasklist");
    command.args(["/FI", &format!("PID eq {pid}"), "/FO", "CSV", "/NH"]);
    configure_background_child_process(&mut command);
    let output = command.output().ok()?;
    if !output.status.success() {
        return None;
    }
    let raw = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if raw.is_empty()
        || raw
            .eq_ignore_ascii_case("INFO: No tasks are running which match the specified criteria.")
    {
        return None;
    }
    Some(ListeningProcess {
        pid,
        command: raw,
        details: String::new(),
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

#[cfg(windows)]
fn configure_background_child_process(command: &mut Command) {
    command.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(windows))]
fn configure_background_child_process(_command: &mut Command) {}

#[cfg(not(windows))]
fn terminate_pid(pid: u32) -> bool {
    Command::new("kill")
        .args(["-TERM", &pid.to_string()])
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

#[cfg(windows)]
fn terminate_pid(pid: u32) -> bool {
    let mut command = Command::new("taskkill");
    command.args(["/PID", &pid.to_string(), "/T", "/F"]);
    configure_background_child_process(&mut command);
    command
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

fn reclaim_managed_local_service_ports(app: &AppHandle) {
    let pids = managed_listener_pids(app, &listen_port_targets());
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
    let _ = clear_persisted_sidecar_state(app);
}

fn reclaim_any_local_service_ports(app: &AppHandle) {
    let mut pids = Vec::new();
    for port in listen_port_targets() {
        for pid in port_listener_pids(port) {
            if !pids.contains(&pid) {
                pids.push(pid);
            }
        }
    }
    if pids.is_empty() {
        return;
    }

    append_desktop_bootstrap_log(
        app,
        &format!(
            "start_sidecar: reclaiming listener pids on configured ports: {}",
            pids.iter()
                .map(|pid| pid.to_string())
                .collect::<Vec<_>>()
                .join(",")
        ),
    );

    for pid in pids {
        let _ = terminate_pid(pid);
    }

    for _ in 0..30 {
        if detect_local_service_port_conflicts().is_empty() {
            break;
        }
        std::thread::sleep(Duration::from_millis(150));
    }
    let _ = clear_persisted_sidecar_state(app);
}

fn stop_sidecar_internal(app: &AppHandle, state: &SidecarState) -> Result<bool, String> {
    let mut stopped = false;
    let mut child_guard = state
        .child
        .lock()
        .map_err(|_| String::from("failed to lock sidecar state"))?;

    if let Some(mut child) = child_guard.take() {
        let _ = child.kill();
        stopped = true;
    }

    drop(child_guard);

    let pids = managed_listener_pids(app, &listen_port_targets());
    if !pids.is_empty() {
        for pid in pids {
            let _ = terminate_pid(pid);
            stopped = true;
        }
        for _ in 0..20 {
            if detect_local_service_port_conflicts().is_empty() {
                break;
            }
            std::thread::sleep(Duration::from_millis(150));
        }
    }

    clear_persisted_sidecar_state(app)?;
    Ok(stopped)
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
    ensure_runtime_scope_migrated(app)?;
    let dir = runtime_scope_root_dir_raw(app).join("state");
    fs::create_dir_all(&dir).map_err(|e| format!("failed to create openclaw state dir: {e}"))?;
    Ok(dir)
}

fn openclaw_config_path(app: &AppHandle) -> Result<PathBuf, String> {
    ensure_runtime_scope_migrated(app)?;
    let path = runtime_scope_root_dir_raw(app).join("openclaw.json");
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("failed to create openclaw config dir: {e}"))?;
    }
    Ok(path)
}

fn openclaw_brand_stamp_path(app: &AppHandle) -> Result<PathBuf, String> {
    ensure_runtime_scope_migrated(app)?;
    let path = runtime_scope_root_dir_raw(app).join("desktop-brand-stamp.json");
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("failed to create desktop brand stamp dir: {e}"))?;
    }
    Ok(path)
}

fn desktop_window_state_path(app: &AppHandle) -> Result<PathBuf, String> {
    let path = app_data_base_dir(app)?
        .join("config")
        .join("window-state.json");
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

fn sidecar_state_path(app: &AppHandle) -> Result<PathBuf, String> {
    let path = app_data_base_dir(app)?
        .join("config")
        .join("sidecar-state.json");
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("failed to create sidecar state dir: {e}"))?;
    }
    Ok(path)
}

fn current_app_version() -> String {
    env!("CARGO_PKG_VERSION").trim().to_string()
}

fn build_expected_sidecar_state(
    app: &AppHandle,
    runtime_source: &str,
    args: &[String],
    pid: Option<u32>,
) -> Result<PersistedSidecarState, String> {
    let snapshot = load_oem_runtime_snapshot_internal(app)?.unwrap_or_default();
    let runtime_config_sha256 = serde_json::to_vec(&snapshot.config)
        .map(|bytes| sha256_hex(&bytes))
        .map_err(|e| format!("failed to serialize OEM runtime snapshot config: {e}"))?;
    let brand_id = if snapshot.brand_id.trim().is_empty() {
        DESKTOP_BRAND_ID.trim().to_string()
    } else {
        snapshot.brand_id.trim().to_string()
    };
    Ok(PersistedSidecarState {
        pid,
        port: configured_sidecar_port(),
        brand_id,
        app_version: current_app_version(),
        runtime_published_version: snapshot.published_version,
        runtime_config_sha256,
        sidecar_args: args.join(" "),
        runtime_source: runtime_source.trim().to_string(),
        updated_at: chrono_like_timestamp(),
    })
}

fn load_persisted_sidecar_state(app: &AppHandle) -> Result<Option<PersistedSidecarState>, String> {
    let path = sidecar_state_path(app)?;
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(&path).map_err(|e| {
        format!(
            "failed to read sidecar state {}: {e}",
            path.to_string_lossy()
        )
    })?;
    let parsed = serde_json::from_str::<PersistedSidecarState>(&raw).map_err(|e| {
        format!(
            "failed to parse sidecar state {}: {e}",
            path.to_string_lossy()
        )
    })?;
    Ok(Some(parsed))
}

fn save_persisted_sidecar_state(
    app: &AppHandle,
    state: &PersistedSidecarState,
) -> Result<(), String> {
    let path = sidecar_state_path(app)?;
    let raw = serde_json::to_string_pretty(state)
        .map_err(|e| format!("failed to serialize sidecar state: {e}"))?;
    fs::write(&path, raw).map_err(|e| {
        format!(
            "failed to write sidecar state {}: {e}",
            path.to_string_lossy()
        )
    })?;
    Ok(())
}

fn clear_persisted_sidecar_state(app: &AppHandle) -> Result<(), String> {
    let path = sidecar_state_path(app)?;
    if !path.exists() {
        return Ok(());
    }
    fs::remove_file(&path).map_err(|e| {
        format!(
            "failed to remove sidecar state {}: {e}",
            path.to_string_lossy()
        )
    })?;
    Ok(())
}

fn persisted_sidecar_state_matches(
    existing: &PersistedSidecarState,
    expected: &PersistedSidecarState,
) -> bool {
    existing.port == expected.port
        && existing.brand_id == expected.brand_id
        && existing.app_version == expected.app_version
        && existing.runtime_published_version == expected.runtime_published_version
        && existing.runtime_config_sha256 == expected.runtime_config_sha256
        && existing.sidecar_args == expected.sidecar_args
        && existing.runtime_source == expected.runtime_source
}

fn load_desktop_window_state(
    app: &AppHandle,
) -> Result<Option<DesktopWindowStateSnapshot>, String> {
    let path = desktop_window_state_path(app)?;
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(&path).map_err(|e| {
        format!(
            "failed to read window state {}: {e}",
            path.to_string_lossy()
        )
    })?;
    let parsed = serde_json::from_str::<DesktopWindowStateSnapshot>(&raw).map_err(|e| {
        format!(
            "failed to parse window state {}: {e}",
            path.to_string_lossy()
        )
    })?;
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
    fs::write(&path, format!("{raw}\n")).map_err(|e| {
        format!(
            "failed to write window state {}: {e}",
            path.to_string_lossy()
        )
    })
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
    sync_oem_runtime_snapshot(app.clone(), resolve_desktop_auth_base_url(), brand_id)
}

fn ensure_current_brand_runtime_skills(app: &AppHandle, context: &str) -> Result<bool, String> {
    match sync_current_brand_runtime_skills(app, &resolve_desktop_auth_base_url()) {
        Ok(changed) => Ok(changed),
        Err(error) => {
            if runtime_skills_manifest_path(app)?.exists() {
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

fn ensure_current_brand_runtime_mcps(app: &AppHandle, context: &str) -> Result<bool, String> {
    match sync_current_brand_runtime_mcp(app) {
        Ok(changed) => Ok(changed),
        Err(error) => {
            let cached_path = runtime_mcp_config_source_path(app)?;
            if cached_path.exists() {
                eprintln!(
                    "failed to sync runtime mcp before {context}; reusing last cached runtime mcp config: {error}"
                );
                Ok(false)
            } else {
                Err(format!(
                    "failed to sync runtime mcp before {context}: {error}"
                ))
            }
        }
    }
}

fn load_oem_runtime_snapshot_internal(
    app: &AppHandle,
) -> Result<Option<OemRuntimeSnapshot>, String> {
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
    generate_openclaw_runtime_config(app, gateway_token, &config_path)?;
    if config_path.exists() {
        return Ok(config_path);
    }

    let fallback_dir =
        env::temp_dir().join(format!("iclaw-openclaw-config-{}", timestamp_string()));
    fs::create_dir_all(&fallback_dir)
        .map_err(|e| format!("failed to create fallback openclaw config dir: {e}"))?;
    let fallback_path = fallback_dir.join("openclaw.json");
    generate_openclaw_runtime_config(app, gateway_token, &fallback_path)?;
    if fallback_path.exists() {
        return Ok(fallback_path);
    }

    Err(format!(
        "openclaw config generator completed but no config file was written to {} or {}",
        config_path.to_string_lossy(),
        fallback_path.to_string_lossy()
    ))
}

fn generate_openclaw_runtime_config(
    app: &AppHandle,
    gateway_token: &str,
    config_path: &Path,
) -> Result<(), String> {
    let runtime_config_path = runtime_config_path(app)?;
    let generator_path = resource_runtime_config_generator_path(app);
    let portal_runtime_config_path = resource_portal_runtime_config_path(app);
    let node_path = resolve_runtime_node_path(app)?;
    let workspace_dir = openclaw_workspace_dir(app)?;
    let snapshot_path = oem_runtime_snapshot_path(app)?;
    let brand_stamp_path = openclaw_brand_stamp_path(app)?;
    let mut command = Command::new(&node_path);
    configure_background_child_process(&mut command);
    command.arg(node_command_safe_path(&generator_path));
    command.env("ICLAW_OPENCLAW_CONFIG_PATH", config_path);
    command.env("ICLAW_OPENCLAW_RUNTIME_CONFIG_PATH", &runtime_config_path);
    command.env("ICLAW_OPENCLAW_BRAND_STAMP_PATH", &brand_stamp_path);
    command.env("ICLAW_OPENCLAW_GATEWAY_TOKEN", gateway_token);
    command.env("ICLAW_OPENCLAW_WORKSPACE_DIR", workspace_dir);
    command.env("ICLAW_OPENCLAW_RUNTIME_MODE", "prod");
    command.env("ICLAW_OPENCLAW_ALLOWED_ORIGINS", DESKTOP_GATEWAY_ALLOWED_ORIGINS);
    command.env("ICLAW_DESKTOP_BRAND_ID", DESKTOP_BRAND_ID);
    command.env("ICLAW_DESKTOP_BUILD_ID", DESKTOP_BUILD_ID);
    command.env("ICLAW_DESKTOP_SOURCE_PROFILE_HASH", DESKTOP_SOURCE_PROFILE_HASH);
    command.env("ICLAW_DESKTOP_BUNDLE_IDENTIFIER", DESKTOP_BUNDLE_IDENTIFIER);
    command.env("ICLAW_DESKTOP_ARTIFACT_BASE_NAME", DESKTOP_ARTIFACT_BASE_NAME);
    if portal_runtime_config_path.exists() {
        command.env(
            "ICLAW_OPENCLAW_PORTAL_RUNTIME_CONFIG_PATH",
            portal_runtime_config_path,
        );
    }
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
    Ok(())
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

fn resource_portal_runtime_config_path(app: &AppHandle) -> PathBuf {
    if let Ok(resource_dir) = app.path().resource_dir() {
        let p = resource_dir
            .join("resources")
            .join("config")
            .join("portal-app-runtime.json");
        if p.exists() {
            return p;
        }
    }

    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("resources")
        .join("config")
        .join("portal-app-runtime.json")
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
    append_desktop_bootstrap_log(
        &app,
        &format!("start_sidecar: begin args={}", args.join(" ")),
    );
    let mut child_guard = state
        .child
        .lock()
        .map_err(|_| String::from("failed to lock sidecar state"))?;

    if let Some(child) = child_guard.as_mut() {
        match child.try_wait() {
            Ok(Some(_)) => {
                append_desktop_bootstrap_log(&app, "start_sidecar: previous child already exited");
                *child_guard = None;
                let _ = clear_persisted_sidecar_state(&app);
            }
            Ok(None) => {
                append_desktop_bootstrap_log(&app, "start_sidecar: existing child still running");
                return Ok(true);
            }
            Err(error) => {
                return Err(format!(
                    "failed to inspect existing openclaw runtime process: {error}"
                ));
            }
        }
    }

    let runtime = resolve_runtime_command(&app)?;
    if let Err(error) = sync_current_brand_runtime_snapshot(&app) {
        eprintln!("failed to sync OEM runtime snapshot before sidecar start: {error}");
        append_desktop_bootstrap_log(
            &app,
            &format!("start_sidecar: snapshot sync warning {error}"),
        );
    }
    let mut occupied_ports = detect_local_service_port_conflicts();
    if !occupied_ports.is_empty() {
        reclaim_any_local_service_ports(&app);
        occupied_ports = detect_local_service_port_conflicts();
        if !occupied_ports.is_empty() {
            let ports = occupied_ports
                .iter()
                .map(|port| port.to_string())
                .collect::<Vec<_>>()
                .join("/");
            return Err(format!(
                "检测到本地 OpenClaw API 正在运行，占用了 {ports}。请先关闭 `pnpm dev:api` 或释放该端口后再启动应用。"
            ));
        }
    }
    let expected_sidecar_state = build_expected_sidecar_state(&app, &runtime.source, &args, None)?;
    let gateway_token = load_or_create_gateway_token(&app)?;
    append_desktop_bootstrap_log(&app, "start_sidecar: gateway token ready");
    ensure_openclaw_workspace_seed(&app)?;
    append_desktop_bootstrap_log(&app, "start_sidecar: workspace seed ready");
    ensure_current_brand_runtime_mcps(&app, "sidecar start")?;
    ensure_current_brand_runtime_skills(&app, "sidecar start")?;
    append_desktop_bootstrap_log(&app, "start_sidecar: runtime skills ready");
    let openclaw_state_dir = openclaw_state_dir(&app)?;
    let openclaw_config_path = ensure_openclaw_runtime_config(&app, &gateway_token)?;
    append_desktop_bootstrap_log(
        &app,
        &format!(
            "start_sidecar: config ready path={}",
            openclaw_config_path.to_string_lossy()
        ),
    );
    let config = load_runtime_config_internal(&app)?;
    let paths = ensure_runtime_dirs(&app)?;
    let skills_dir = runtime_skills_dir(&app)?;
    let mcp_config = prepare_runtime_mcp_config(&app, &paths.cache_dir)?;
    append_desktop_bootstrap_log(
        &app,
        &format!(
            "start_sidecar: runtime dirs ready skills_dir={} mcp_config={}",
            skills_dir.to_string_lossy(),
            mcp_config.to_string_lossy()
        ),
    );
    let extra_ca_certs = resource_extra_ca_certs_path(&app);
    let (stdout_log_path, stderr_log_path) = sidecar_log_paths(&app)?;

    let runtime_root = resolved_runtime_root(&runtime)?;
    let node_path = resolved_runtime_node_path(&runtime_root);
    let cli_path = resolved_runtime_cli_entry_path(&runtime_root);
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
    let mut command = Command::new(&node_path);
    configure_background_child_process(&mut command);
    command.current_dir(&runtime_root);
    command.env(
        "ICLAW_OPENCLAW_RUNTIME_ROOT",
        runtime_root.to_string_lossy().to_string(),
    );
    command.arg(&cli_path);
    command.arg("gateway");
    command.args(&runtime.args_prefix);
    command.args(&args);
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
    command.stdout(Stdio::from(File::create(&stdout_log_path).map_err(
        |e| {
            format!(
                "failed to create sidecar stdout log {}: {e}",
                stdout_log_path.to_string_lossy()
            )
        },
    )?));
    command.stderr(Stdio::from(File::create(&stderr_log_path).map_err(
        |e| {
            format!(
                "failed to create sidecar stderr log {}: {e}",
                stderr_log_path.to_string_lossy()
            )
        },
    )?));

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

    let mut child = command
        .spawn()
        .map_err(|e| format!("failed to start openclaw runtime ({}): {e}", runtime.source))?;
    append_desktop_bootstrap_log(
        &app,
        &format!(
            "start_sidecar: spawned runtime source={} program={} entry={}",
            runtime.source,
            node_path.to_string_lossy(),
            cli_path.to_string_lossy()
        ),
    );
    std::thread::sleep(Duration::from_millis(1200));
    if let Some(status) = child
        .try_wait()
        .map_err(|e| format!("failed to inspect launched openclaw runtime: {e}"))?
    {
        append_desktop_bootstrap_log(
            &app,
            &format!(
                "start_sidecar: child exited early status={}",
                status
                    .code()
                    .map(|value| value.to_string())
                    .unwrap_or_else(|| String::from("unknown"))
            ),
        );
        return Err(describe_sidecar_exit(
            status,
            &stdout_log_path,
            &stderr_log_path,
        ));
    }
    *child_guard = Some(child);
    let persisted_state = build_expected_sidecar_state(
        &app,
        &runtime.source,
        &args,
        child_guard.as_ref().map(|running| running.id()),
    )?;
    save_persisted_sidecar_state(&app, &persisted_state)?;
    append_desktop_bootstrap_log(&app, "start_sidecar: child running");
    Ok(true)
}

#[tauri::command]
fn stop_sidecar(app: AppHandle, state: State<'_, SidecarState>) -> Result<bool, String> {
    stop_sidecar_internal(&app, &state)
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
    append_desktop_bootstrap_log(
        &app,
        &format!(
            "save_oem_runtime_snapshot: begin brand_id={} published_version={}",
            snapshot.brand_id, snapshot.published_version
        ),
    );
    let snapshot_path = oem_runtime_snapshot_path(&app)?;
    let raw = serde_json::to_string_pretty(&snapshot)
        .map_err(|e| format!("failed to serialize OEM runtime snapshot: {e}"))?;
    fs::write(&snapshot_path, raw)
        .map_err(|e| format!("failed to write OEM runtime snapshot: {e}"))?;
    let gateway_token = load_or_create_gateway_token(&app)?;
    let config_path = ensure_openclaw_runtime_config(&app, &gateway_token)?;
    append_desktop_bootstrap_log(
        &app,
        &format!(
            "save_oem_runtime_snapshot: config_ready path={}",
            config_path.to_string_lossy()
        ),
    );
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
fn desktop_login(input: DesktopLoginInput) -> Result<DesktopAuthResponse, String> {
    desktop_login_internal(input)
}

#[tauri::command]
fn desktop_me(access_token: Option<String>) -> Result<serde_json::Value, String> {
    desktop_me_internal(access_token)
}

#[tauri::command]
fn desktop_refresh(input: DesktopRefreshInput) -> Result<DesktopAuthTokens, String> {
    desktop_refresh_internal(input)
}

#[tauri::command]
fn sync_oem_runtime_snapshot(
    app: AppHandle,
    auth_base_url: String,
    brand_id: String,
) -> Result<bool, String> {
    append_desktop_bootstrap_log(
        &app,
        &format!(
            "sync_oem_runtime_snapshot: begin brand_id={brand_id} auth_base_url={auth_base_url}"
        ),
    );
    let trimmed_brand_id = brand_id.trim();
    let trimmed_auth_base_url = auth_base_url.trim().trim_end_matches('/');
    if trimmed_brand_id.is_empty() {
        return Err(String::from("brand_id is required"));
    }
    if trimmed_auth_base_url.is_empty() {
        return Err(String::from("auth_base_url is required"));
    }

    let mut private_url = Url::parse(&format!(
        "{trimmed_auth_base_url}/portal/runtime/private-config"
    ))
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
        if resp.status().is_success() {
            resp
        } else {
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
        return Err(format!(
            "OEM runtime config returned unsuccessful response ({status})"
        ));
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
    let mut snapshot = snapshot;

    if let Ok(Some(tokens)) = load_auth_tokens() {
        if !tokens.access_token.trim().is_empty() {
            if let Ok(mut custom_url) =
                Url::parse(&format!("{trimmed_auth_base_url}/mcp/custom/runtime"))
            {
                custom_url
                    .query_pairs_mut()
                    .append_pair("app_name", trimmed_brand_id);
                if let Ok(custom_response) = client
                    .get(custom_url)
                    .bearer_auth(tokens.access_token)
                    .send()
                {
                    if custom_response.status().is_success() {
                        if let Ok(custom_envelope) =
                            custom_response.json::<CustomMcpRuntimeEnvelope>()
                        {
                            if custom_envelope.success {
                                if let Some(custom_data) = custom_envelope.data {
                                    merge_custom_mcp_runtime_items(
                                        &mut snapshot.config,
                                        custom_data.items,
                                    );
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    let result = save_oem_runtime_snapshot(app.clone(), snapshot);
    match &result {
        Ok(_) => append_desktop_bootstrap_log(&app, "sync_oem_runtime_snapshot: success"),
        Err(error) => {
            append_desktop_bootstrap_log(&app, &format!("sync_oem_runtime_snapshot: error {error}"))
        }
    }
    result
}

#[tauri::command]
fn install_runtime(app: AppHandle) -> Result<bool, String> {
    append_desktop_bootstrap_log(&app, "install_runtime: begin");
    match install_runtime_internal(&app) {
        Ok(_) => {
            append_desktop_bootstrap_log(&app, "install_runtime: success");
            Ok(true)
        }
        Err(error) => {
            append_desktop_bootstrap_log(&app, &format!("install_runtime: error {error}"));
            Err(error)
        }
    }
}

#[tauri::command]
fn diagnose_runtime(app: AppHandle) -> Result<RuntimeDiagnosis, String> {
    let runtime = resolve_runtime_command(&app).ok();
    let bootstrap_config = load_runtime_bootstrap_config(&app)?;
    let skills_dir = runtime_skills_dir(&app)?;
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

    let result = RuntimeDiagnosis {
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
    };
    append_desktop_bootstrap_log(
        &app,
        &format!(
            "diagnose_runtime: found={} installable={} skills_dir_ready={} mcp_config_ready={} runtime_path={}",
            result.runtime_found,
            result.runtime_installable,
            result.skills_dir_ready,
            result.mcp_config_ready,
            result.runtime_path.clone().unwrap_or_default()
        ),
    );
    Ok(result)
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

fn openclaw_workspace_dir(app: &AppHandle) -> Result<PathBuf, String> {
    ensure_runtime_scope_migrated(app)?;
    Ok(runtime_scope_root_dir_raw(app).join("workspace"))
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

fn desktop_memory_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(openclaw_workspace_dir(app)?.join("memory"))
}

fn desktop_memory_archive_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(openclaw_workspace_dir(app)?.join(".iclaw-memory-archive"))
}

fn ensure_desktop_memory_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = desktop_memory_dir(app)?;
    fs::create_dir_all(&dir).map_err(|e| format!("failed to create memory dir: {e}"))?;
    Ok(dir)
}

fn ensure_desktop_memory_archive_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = desktop_memory_archive_dir(app)?;
    fs::create_dir_all(&dir).map_err(|e| format!("failed to create memory archive dir: {e}"))?;
    Ok(dir)
}

fn memory_entry_path(app: &AppHandle, id: &str) -> Result<PathBuf, String> {
    Ok(desktop_memory_dir(app)?.join(format!("{id}.md")))
}

fn memory_archive_path(app: &AppHandle, id: &str) -> Result<PathBuf, String> {
    Ok(desktop_memory_archive_dir(app)?.join(format!("{id}.md")))
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
    let dir = desktop_memory_dir(app)?;
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
        append_desktop_bootstrap_log(
            app,
            &format!("memory_runtime_command: snapshot sync warning {error}"),
        );
    }
    let runtime = resolve_runtime_command(app)?;
    let gateway_token = load_or_create_gateway_token(app)?;
    ensure_openclaw_workspace_seed(app)?;
    ensure_current_brand_runtime_mcps(app, "memory runtime command")?;
    ensure_current_brand_runtime_skills(app, "memory runtime command")?;
    let openclaw_state_dir = openclaw_state_dir(app)?;
    let openclaw_config_path = ensure_openclaw_runtime_config(app, &gateway_token)?;
    let config = load_runtime_config_internal(app)?;
    let paths = ensure_runtime_dirs(app)?;
    let skills_dir = runtime_skills_dir(app)?;
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
    parse_memory_cli_json_output(&stdout)
}

fn parse_memory_cli_json_output(stdout: &str) -> Result<serde_json::Value, String> {
    let trimmed = stdout.trim();
    if trimmed.is_empty() {
        return Err(String::from(
            "failed to parse memory cli json: empty stdout",
        ));
    }
    if let Ok(value) = serde_json::from_str::<serde_json::Value>(trimmed) {
        return Ok(value);
    }

    let mut candidate_offsets = Vec::new();
    for (offset, ch) in trimmed.char_indices() {
        if ch != '[' && ch != '{' {
            continue;
        }
        if offset > 0 {
            let previous = trimmed[..offset].chars().next_back();
            if !matches!(previous, Some('\n' | '\r')) {
                continue;
            }
        }
        candidate_offsets.push(offset);
    }

    for offset in candidate_offsets {
        let candidate = &trimmed[offset..];
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(candidate) {
            return Ok(value);
        }
    }

    serde_json::from_str::<serde_json::Value>(trimmed)
        .map_err(|e| format!("failed to parse memory cli json: {e}"))
}

fn run_memory_cli(app: &AppHandle, args: &[&str]) -> Result<std::process::Output, String> {
    let runtime = resolve_runtime_command(app)?;
    let runtime_root = resolved_runtime_root(&runtime)?;
    let node_path = resolved_runtime_node_path(&runtime_root);
    let cli_path = resolved_runtime_cli_entry_path(&runtime_root);

    let mut command = Command::new(&node_path);
    configure_background_child_process(&mut command);
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
        memory_dir: desktop_memory_dir(app)?.to_string_lossy().to_string(),
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

fn load_desktop_memory_runtime_status_with_timeout(
    app: &AppHandle,
) -> Result<DesktopMemoryRuntimeStatus, String> {
    let (sender, receiver) = mpsc::channel();
    let app_handle = app.clone();
    thread::spawn(move || {
        let result = load_desktop_memory_runtime_status(&app_handle);
        let _ = sender.send(result);
    });

    receiver
        .recv_timeout(Duration::from_millis(MEMORY_RUNTIME_STATUS_TIMEOUT_MS))
        .map_err(|_| {
            format!(
                "memory status timed out after {}ms",
                MEMORY_RUNTIME_STATUS_TIMEOUT_MS
            )
        })?
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
    let workspace_dir = openclaw_workspace_dir(app)?;
    fs::create_dir_all(&workspace_dir)
        .map_err(|e| format!("failed to create workspace dir: {e}"))?;
    fs::create_dir_all(workspace_dir.join("skills"))
        .map_err(|e| format!("failed to create workspace skills dir: {e}"))?;
    seed_bundled_skills_into_workspace(app)?;

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

fn seed_bundled_skills_into_workspace(app: &AppHandle) -> Result<(), String> {
    let bundled_manifest_path = resource_bundled_skills_manifest_path(app);
    let Some(bundled_manifest) = load_skill_manifest_value(&bundled_manifest_path)? else {
        return Ok(());
    };

    let bundled_skills_dir = resource_bundled_skills_dir(app);
    if !bundled_skills_dir.exists() {
        return Ok(());
    }

    let runtime_skills_dir = runtime_skills_dir(app)?;
    fs::create_dir_all(&runtime_skills_dir)
        .map_err(|e| format!("failed to create runtime skills dir: {e}"))?;

    let bundled_skill_dirs = manifest_skill_dirs(&bundled_manifest);
    if bundled_skill_dirs.is_empty() {
        let runtime_skills_manifest_path = runtime_skills_manifest_path(app)?;
        write_locked_json_file(&runtime_skills_manifest_path, &bundled_manifest)?;
        return Ok(());
    }

    let runtime_skills_manifest_path = runtime_skills_manifest_path(app)?;
    let existing_manifest = load_skill_manifest_value(&runtime_skills_manifest_path)?;
    let existing_skill_dirs = existing_manifest
        .as_ref()
        .map(manifest_skill_dirs)
        .unwrap_or_default();
    let manifests_match = existing_manifest
        .as_ref()
        .map(|value| value == &bundled_manifest)
        .unwrap_or(false);
    let all_skills_present = bundled_skill_dirs
        .iter()
        .all(|dir_name| runtime_skills_dir.join(dir_name).join("SKILL.md").exists());

    if manifests_match && all_skills_present {
        return Ok(());
    }

    for stale_dir in existing_skill_dirs {
        if bundled_skill_dirs.contains(&stale_dir) {
            continue;
        }
        let target_path = runtime_skills_dir.join(&stale_dir);
        if target_path.exists() {
            let _ = fs::remove_dir_all(target_path);
        }
    }

    for dir_name in &bundled_skill_dirs {
        let source_path = bundled_skills_dir.join(dir_name);
        if !source_path.exists() {
            continue;
        }
        let target_path = runtime_skills_dir.join(dir_name);
        if target_path.exists() {
            let _ = fs::remove_dir_all(&target_path);
        }
        copy_dir_recursive(&source_path, &target_path)?;
    }

    write_locked_json_file(&runtime_skills_manifest_path, &bundled_manifest)?;
    Ok(())
}

#[tauri::command]
fn reset_iclaw_workspace_to_defaults(app: AppHandle) -> Result<bool, String> {
    let workspace_dir = openclaw_workspace_dir(&app)?;
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
    let workspace_dir = openclaw_workspace_dir(&app)?;
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
    let workspace_dir = openclaw_workspace_dir(&app)?;

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
    let workspace_dir = openclaw_workspace_dir(app)?;

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
    let workspace_dir = openclaw_workspace_dir(&app)?;
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
    let raw = fs::read_to_string(&path).map_err(|e| {
        format!(
            "failed to read desktop client config {}: {e}",
            path.to_string_lossy()
        )
    })?;
    let parsed = serde_json::from_str::<serde_json::Value>(&raw).map_err(|e| {
        format!(
            "failed to parse desktop client config {}: {e}",
            path.to_string_lossy()
        )
    })?;
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
    let memory_dir = desktop_memory_dir(&app)?.to_string_lossy().to_string();
    let archive_dir = desktop_memory_archive_dir(&app)?
        .to_string_lossy()
        .to_string();
    match load_desktop_memory_runtime_status_with_timeout(&app) {
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
    let memory_path = memory_entry_path(&app, &normalized.id)?;
    write_text(&memory_path, &content)?;
    Ok(normalized)
}

#[tauri::command]
fn delete_memory_entry(app: AppHandle, id: String) -> Result<bool, String> {
    let active_path = memory_entry_path(&app, &id)?;
    let archive_path = memory_archive_path(&app, &id)?;
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
    let source_path = memory_entry_path(&app, &id)?;
    if !source_path.exists() {
        return Ok(true);
    }
    let target_path = memory_archive_path(&app, &id)?;
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

    let mut stop_flag = state
        .stop_sidecar_on_exit
        .lock()
        .map_err(|_| String::from("failed to lock desktop update sidecar state"))?;
    *stop_flag = true;

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
fn restart_desktop_app(
    app: AppHandle,
    sidecar_state: State<'_, SidecarState>,
    update_state: State<'_, DesktopUpdateState>,
) {
    let should_stop_sidecar = {
        match update_state.stop_sidecar_on_exit.lock() {
            Ok(mut stop_flag) => {
                let should_stop = *stop_flag;
                if should_stop {
                    *stop_flag = false;
                }
                should_stop
            }
            Err(_) => false,
        }
    };
    if should_stop_sidecar {
        let _ = stop_sidecar_internal(&app, &sidecar_state);
    }
    app.restart();
}

#[tauri::command]
fn open_external_url(url: String) -> Result<bool, String> {
    let parsed = Url::parse(url.trim()).map_err(|e| format!("invalid external url: {e}"))?;
    match parsed.scheme() {
        "http" | "https" => {}
        _ => return Err(String::from("unsupported external url scheme")),
    }

    #[cfg(target_os = "macos")]
    let mut command = {
        let mut cmd = Command::new("open");
        cmd.arg(parsed.as_str());
        cmd
    };

    #[cfg(target_os = "windows")]
    let mut command = {
        let mut cmd = Command::new("cmd");
        cmd.args(["/C", "start", "", parsed.as_str()]);
        configure_background_child_process(&mut cmd);
        cmd
    };

    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = {
        let mut cmd = Command::new("xdg-open");
        cmd.arg(parsed.as_str());
        cmd
    };

    command.stdout(Stdio::null()).stderr(Stdio::null());
    command
        .spawn()
        .map_err(|e| format!("failed to open external url: {e}"))?;
    Ok(true)
}

fn desktop_update_downloads_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app_data_base_dir(app)?
        .join("desktop-updates")
        .join("downloads");
    fs::create_dir_all(&dir)
        .map_err(|e| format!("failed to create desktop update downloads dir: {e}"))?;
    Ok(dir)
}

fn sanitize_download_file_name(name: &str, fallback: &str) -> String {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return String::from(fallback);
    }
    let sanitized = trimmed
        .chars()
        .map(|ch| match ch {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            _ => ch,
        })
        .collect::<String>();
    if sanitized.trim().is_empty() {
        String::from(fallback)
    } else {
        sanitized
    }
}

fn resolve_desktop_installer_file_name(url: &str, version: Option<&str>) -> String {
    let fallback = match version.map(str::trim).filter(|value| !value.is_empty()) {
        Some(value) => format!("{DESKTOP_BRAND_ID}-desktop-{value}.exe"),
        None => format!("{DESKTOP_BRAND_ID}-desktop-update.exe"),
    };
    if let Ok(parsed) = Url::parse(url) {
        if let Some(file_name) = Path::new(parsed.path())
            .file_name()
            .and_then(|value| value.to_str())
        {
            return sanitize_download_file_name(file_name, &fallback);
        }
    }
    Path::new(url)
        .file_name()
        .and_then(|value| value.to_str())
        .map(|value| sanitize_download_file_name(value, &fallback))
        .unwrap_or(fallback)
}

fn launch_downloaded_windows_installer(
    app: &AppHandle,
    installer_path: &Path,
    version: Option<String>,
) -> Result<bool, String> {
    #[cfg(not(windows))]
    {
        let _ = app;
        let _ = installer_path;
        let _ = version;
        Err(String::from(
            "desktop installer launch is only supported on windows",
        ))
    }

    #[cfg(windows)]
    {
        let installer = installer_path
            .to_str()
            .ok_or_else(|| String::from("installer path contains invalid utf-8"))?;
        let parent = installer_path
            .parent()
            .and_then(|value| value.to_str())
            .ok_or_else(|| String::from("installer parent path contains invalid utf-8"))?;
        let mut command = Command::new("cmd");
        command.args(["/C", "start", "", "/D", parent, installer]);
        configure_background_child_process(&mut command);
        command.stdout(Stdio::null()).stderr(Stdio::null());
        command
            .spawn()
            .map_err(|e| format!("failed to launch desktop installer: {e}"))?;
        emit_desktop_update_progress(
            app,
            "installer-started",
            100,
            version,
            None,
            None,
            "安装器已启动，当前应用即将退出。",
        );
        let app_handle = app.clone();
        thread::spawn(move || {
            thread::sleep(Duration::from_millis(900));
            app_handle.exit(0);
        });
        Ok(true)
    }
}

fn download_and_launch_desktop_installer_blocking(
    app: &AppHandle,
    input: DesktopInstallerCommandInput,
) -> Result<bool, String> {
    let artifact_url = input.artifact_url.trim();
    if artifact_url.is_empty() {
        return Err(String::from("desktop installer artifact url is required"));
    }

    emit_desktop_update_progress(
        app,
        "preparing-installer",
        4,
        input.version.clone(),
        Some(0),
        None,
        "正在准备下载安装包。",
    );

    let file_name = resolve_desktop_installer_file_name(artifact_url, input.version.as_deref());
    let downloads_dir = desktop_update_downloads_dir(app)?;
    let installer_path = downloads_dir.join(file_name);
    let partial_path = installer_path.with_extension("download");

    if partial_path.exists() {
        fs::remove_file(&partial_path)
            .map_err(|e| format!("failed to clear previous partial installer: {e}"))?;
    }
    if installer_path.exists() {
        fs::remove_file(&installer_path)
            .map_err(|e| format!("failed to clear previous installer: {e}"))?;
    }

    download_file_with_optional_sha256(
        app,
        artifact_url,
        &partial_path,
        input.artifact_sha256.clone(),
    )
    .map_err(|error| error.replace("skill archive", "desktop installer"))?;

    fs::rename(&partial_path, &installer_path)
        .map_err(|e| format!("failed to finalize downloaded installer: {e}"))?;

    emit_desktop_update_progress(
        app,
        "launching-installer",
        92,
        input.version.clone(),
        None,
        None,
        "安装包下载完成，正在启动安装器。",
    );

    launch_downloaded_windows_installer(app, &installer_path, input.version)
}

#[tauri::command]
async fn download_and_launch_desktop_installer(
    app: AppHandle,
    input: DesktopInstallerCommandInput,
) -> Result<bool, String> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        download_and_launch_desktop_installer_blocking(&app_handle, input)
    })
    .await
    .map_err(|e| format!("failed to join desktop installer task: {e}"))?
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
            stop_sidecar_on_exit: Mutex::new(false),
        });
    let builder = if desktop_update_pubkey().is_some() {
        builder.plugin(tauri_plugin_updater::Builder::new().build())
    } else {
        builder
    };
    let app = builder
        .setup(|app| {
            apply_initial_window_layout(app.handle());
            Ok(())
        })
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                persist_desktop_window_state(window);
                let is_focused = window.is_focused().unwrap_or(false);
                if is_focused {
                    api.prevent_close();
                    let _ = window.minimize();
                } else {
                    window.app_handle().exit(0);
                }
            }
            WindowEvent::Resized(_) | WindowEvent::Moved(_) => {
                persist_desktop_window_state(window);
            }
            _ => {}
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
            desktop_login,
            desktop_me,
            desktop_refresh,
            sync_oem_runtime_snapshot,
            install_runtime,
            diagnose_runtime,
            load_startup_diagnostics,
            prepare_desktop_fault_report_archive,
            load_desktop_client_metrics_context,
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
            download_and_launch_desktop_installer,
            restart_desktop_app,
            open_external_url
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");
    app.run(|app_handle, event| {
        if let RunEvent::ExitRequested { .. } = event {
            if let Some(window) = app_handle.get_webview_window("main") {
                persist_desktop_webview_window_state(&window);
            }
            let should_stop_sidecar = {
                let update_state = app_handle.state::<DesktopUpdateState>();
                let next = match update_state.stop_sidecar_on_exit.lock() {
                    Ok(mut stop_flag) => {
                        let should_stop = *stop_flag;
                        if should_stop {
                            *stop_flag = false;
                        }
                        should_stop
                    }
                    Err(_) => false,
                };
                next
            };
            if should_stop_sidecar {
                let sidecar_state = app_handle.state::<SidecarState>();
                let _ = stop_sidecar_internal(app_handle, &sidecar_state);
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::{
        parse_memory_cli_json_output, persisted_sidecar_state_matches,
        PersistedSidecarState, DESKTOP_GATEWAY_ALLOWED_ORIGINS,
    };

    #[test]
    fn parse_memory_cli_json_output_accepts_plain_json() {
        let value = parse_memory_cli_json_output(
            r#"[
  {
    "status": {
      "files": 1
    }
  }
]"#,
        )
        .expect("plain json should parse");

        assert_eq!(value[0]["status"]["files"].as_u64(), Some(1));
    }

    #[test]
    fn parse_memory_cli_json_output_ignores_leading_logs() {
        let value = parse_memory_cli_json_output(
            r#"[openclaw] log file size cap reached
[memory] fts unavailable: no such module: fts5
[
  {
    "status": {
      "files": 3
    }
  }
]"#,
        )
        .expect("json with leading logs should parse");

        assert_eq!(value[0]["status"]["files"].as_u64(), Some(3));
    }

    #[test]
    fn parse_memory_cli_json_output_handles_disabled_memory_search_banner() {
        let value = parse_memory_cli_json_output(
            r#"Memory search disabled.
[]"#,
        )
        .expect("disabled memory search banner should still parse trailing json");

        assert_eq!(value.as_array().map(|items| items.len()), Some(0));
    }

    fn sample_sidecar_state() -> PersistedSidecarState {
        PersistedSidecarState {
            pid: Some(1234),
            port: 2126,
            brand_id: String::from("licaiclaw"),
            app_version: String::from("1.0.4+202604101315"),
            runtime_published_version: 3,
            runtime_config_sha256: String::from("abc123"),
            sidecar_args: String::from("--port 2126"),
            runtime_source: String::from("bundled"),
            updated_at: String::from("[0]"),
        }
    }

    #[test]
    fn persisted_sidecar_state_matches_when_runtime_signature_is_identical() {
        let existing = sample_sidecar_state();
        let expected = sample_sidecar_state();
        assert!(persisted_sidecar_state_matches(&existing, &expected));
    }

    #[test]
    fn persisted_sidecar_state_rejects_app_version_mismatch() {
        let existing = sample_sidecar_state();
        let mut expected = sample_sidecar_state();
        expected.app_version = String::from("1.0.5+202604101500");
        assert!(!persisted_sidecar_state_matches(&existing, &expected));
    }

    #[test]
    fn persisted_sidecar_state_rejects_brand_mismatch() {
        let existing = sample_sidecar_state();
        let mut expected = sample_sidecar_state();
        expected.brand_id = String::from("iclaw");
        assert!(!persisted_sidecar_state_matches(&existing, &expected));
    }

    #[test]
    fn persisted_sidecar_state_rejects_runtime_snapshot_mismatch() {
        let existing = sample_sidecar_state();
        let mut expected = sample_sidecar_state();
        expected.runtime_published_version = 4;
        assert!(!persisted_sidecar_state_matches(&existing, &expected));

        let mut expected_hash = sample_sidecar_state();
        expected_hash.runtime_config_sha256 = String::from("def456");
        assert!(!persisted_sidecar_state_matches(&existing, &expected_hash));
    }

    #[test]
    fn desktop_gateway_allowed_origins_cover_web_and_tauri_shells() {
        let origins: Vec<&str> = DESKTOP_GATEWAY_ALLOWED_ORIGINS.split(',').collect();
        assert!(origins.contains(&"http://127.0.0.1:1520"));
        assert!(origins.contains(&"http://localhost:1520"));
        assert!(origins.contains(&"tauri://localhost"));
        assert!(origins.contains(&"http://tauri.localhost"));
        assert!(origins.contains(&"https://tauri.localhost"));
    }
}
