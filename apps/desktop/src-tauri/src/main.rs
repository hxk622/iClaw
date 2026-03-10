#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use flate2::read::GzDecoder;
use keyring::Entry;
use rand::rngs::OsRng;
use rand::RngCore;
use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::env;
use std::fs::{self, File};
use std::io::{Read, Write};
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::process::{Child, Command};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Manager, State};
use zip::ZipArchive;

struct SidecarState {
    child: Mutex<Option<Child>>,
}

const AUTH_SERVICE: &str = "ai.iclaw.desktop";
const AUTH_ACCESS_KEY: &str = "access_token";
const AUTH_REFRESH_KEY: &str = "refresh_token";
const AUTH_GATEWAY_TOKEN_KEY: &str = "gateway_token";

#[derive(Serialize, Deserialize, Clone)]
struct RuntimeConfig {
    openai_api_key: Option<String>,
    openai_base_url: Option<String>,
    openai_model: Option<String>,
    anthropic_api_key: Option<String>,
    clawhub_url: Option<String>,
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

fn resolve_runtime_command(app: &AppHandle) -> Result<ResolvedRuntimeCommand, String> {
    let config = load_runtime_bootstrap_config(app)?;

    if let Some(dir) = env_override("ICLAW_OPENCLAW_RUNTIME_DIR") {
        let runtime_dir = expand_tilde(app, &dir);
        if let Some(launcher) = find_runtime_launcher(&runtime_dir, &config) {
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
    if let Some(launcher) = find_runtime_launcher(&installed_dir, &config) {
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
    if let Some(launcher) = find_runtime_launcher(&bundled_dir, &config) {
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
    if let Some(local_path) = local_artifact_path(app, url) {
        let mut input = File::open(&local_path)
            .map_err(|e| format!("failed to open local runtime archive {}: {e}", local_path.to_string_lossy()))?;
        let mut output =
            File::create(archive_path).map_err(|e| format!("failed to create runtime archive file: {e}"))?;
        let mut hasher = Sha256::new();
        let mut buffer = [0_u8; 16 * 1024];

        loop {
            let read = input
                .read(&mut buffer)
                .map_err(|e| format!("failed to read local runtime archive: {e}"))?;
            if read == 0 {
                break;
            }
            hasher.update(&buffer[..read]);
            output
                .write_all(&buffer[..read])
                .map_err(|e| format!("failed to write runtime archive file: {e}"))?;
        }

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
    let mut file =
        File::create(archive_path).map_err(|e| format!("failed to create runtime archive file: {e}"))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 16 * 1024];

    loop {
        let read = response
            .read(&mut buffer)
            .map_err(|e| format!("failed to read runtime archive response: {e}"))?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
        file.write_all(&buffer[..read])
            .map_err(|e| format!("failed to write runtime archive file: {e}"))?;
    }

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

        let mut output =
            File::create(&output_path).map_err(|e| format!("failed to create runtime file: {e}"))?;
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
    for entry in fs::read_dir(extracted_dir).map_err(|e| format!("failed to scan runtime dir: {e}"))? {
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
    let config = load_runtime_bootstrap_config(app)?;
    let artifact_url = clean_optional(config.artifact_url.clone())
        .ok_or_else(|| String::from("openclaw runtime download URL is not configured"))?;
    let artifact_format = runtime_archive_format(&config, &artifact_url)?;
    let version_label = runtime_version_label(&config);
    let final_dir = installed_runtime_dir(app, &config)?;

    if find_runtime_launcher(&final_dir, &config).is_some() {
        return Ok(final_dir);
    }

    let archive_ext = if artifact_format == "zip" { "zip" } else { "tar.gz" };
    let archive_path = runtime_downloads_dir(app)?.join(format!("openclaw-runtime-{version_label}.{archive_ext}"));
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

    if artifact_format == "zip" {
        extract_zip_archive(&archive_path, &staging_dir)?;
    } else {
        extract_tar_gz_archive(&archive_path, &staging_dir)?;
    }

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

fn load_or_create_gateway_token() -> Result<String, String> {
    let entry = Entry::new(AUTH_SERVICE, AUTH_GATEWAY_TOKEN_KEY).map_err(|e| e.to_string())?;

    match entry.get_password() {
        Ok(token) if !token.trim().is_empty() => Ok(token),
        Ok(_) | Err(keyring::Error::NoEntry) => {
            let token = generate_gateway_token();
            entry.set_password(&token).map_err(|e| e.to_string())?;
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

fn runtime_config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app_data_base_dir(app)?;
    fs::create_dir_all(&base).map_err(|e| format!("failed to create app_data base dir: {e}"))?;
    Ok(base.join("config.json"))
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

fn ensure_object_value<'a>(
    value: &'a mut serde_json::Value,
) -> &'a mut serde_json::Map<String, serde_json::Value> {
    if !value.is_object() {
        *value = json!({});
    }
    value
        .as_object_mut()
        .expect("json value should be object after normalization")
}

fn ensure_child_object<'a>(
    parent: &'a mut serde_json::Map<String, serde_json::Value>,
    key: &str,
) -> &'a mut serde_json::Map<String, serde_json::Value> {
    let value = parent.entry(String::from(key)).or_insert_with(|| json!({}));
    ensure_object_value(value)
}

fn ensure_openclaw_runtime_config(app: &AppHandle, gateway_token: &str) -> Result<PathBuf, String> {
    let runtime_config = load_runtime_config_internal(app)?;
    let config_path = openclaw_config_path(app)?;
    let mut root = if config_path.exists() {
        let raw = fs::read_to_string(&config_path)
            .map_err(|e| format!("failed to read openclaw config {}: {e}", config_path.to_string_lossy()))?;
        serde_json::from_str::<serde_json::Value>(&raw).map_err(|e| {
            format!(
                "failed to parse openclaw config {}: {e}",
                config_path.to_string_lossy()
            )
        })?
    } else {
        json!({})
    };

    let root_obj = ensure_object_value(&mut root);
    let gateway_obj = ensure_child_object(root_obj, "gateway");
    gateway_obj.insert(String::from("mode"), json!("local"));

    let auth_obj = ensure_child_object(gateway_obj, "auth");
    auth_obj.insert(String::from("mode"), json!("token"));
    auth_obj.insert(String::from("token"), json!(gateway_token));

    if let Some(base_url) = clean_optional(runtime_config.openai_base_url.clone()) {
        let normalized_base_url = normalize_openai_base_url(&base_url);
        if !normalized_base_url.is_empty() {
            let models_root = ensure_child_object(root_obj, "models");
            let providers_obj = ensure_child_object(models_root, "providers");
            let openai_obj = ensure_child_object(providers_obj, "openai");
            openai_obj.insert(String::from("api"), json!("openai-completions"));
            openai_obj.insert(String::from("baseUrl"), json!(normalized_base_url));
            openai_obj
                .entry(String::from("models"))
                .or_insert_with(|| json!([]));
        }
    }

    if let Some(model) = clean_optional(runtime_config.openai_model.clone()) {
        let model_ref = if model.contains('/') {
            model
        } else {
            format!("openai/{model}")
        };

        let agents_obj = ensure_child_object(root_obj, "agents");
        let defaults_obj = ensure_child_object(agents_obj, "defaults");
        defaults_obj.insert(String::from("model"), json!({ "primary": model_ref.clone() }));

        let models_value = defaults_obj
            .entry(String::from("models"))
            .or_insert_with(|| json!({}));
        let models_obj = ensure_object_value(models_value);
        models_obj
            .entry(model_ref)
            .or_insert_with(|| json!({}));
    }

    let normalized = serde_json::to_string_pretty(&root)
        .map_err(|e| format!("failed to serialize openclaw config: {e}"))?;
    write_text(&config_path, &normalized)?;
    Ok(config_path)
}

fn normalize_openai_base_url(raw: &str) -> String {
    let trimmed = raw.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return String::new();
    }
    if trimmed.ends_with("/v1") {
        trimmed.to_string()
    } else {
        format!("{trimmed}/v1")
    }
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

    let runtime = resolve_runtime_command(&app)?;
    let gateway_token = load_or_create_gateway_token()?;
    ensure_openclaw_workspace_seed(&app)?;
    let openclaw_state_dir = openclaw_state_dir(&app)?;
    let openclaw_config_path = ensure_openclaw_runtime_config(&app, &gateway_token)?;
    let config = load_runtime_config_internal(&app)?;
    let paths = ensure_runtime_dirs(&app)?;
    let skills_dir = resource_skills_dir(&app);
    let mcp_config = resource_mcp_config_path(&app);

    let mut command = Command::new(&runtime.program);
    if let Some(working_dir) = runtime.working_dir.as_ref() {
        command.current_dir(working_dir);
    }
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

    if let Some(v) = config.openai_api_key {
        if !v.trim().is_empty() {
            command.env("OPENAI_API_KEY", v);
        }
    }
    if let Some(v) = config.openai_base_url {
        let normalized_base_url = normalize_openai_base_url(&v);
        if !normalized_base_url.is_empty() {
            command.env("OPENAI_BASE_URL", &normalized_base_url);
            command.env("OPENAI_API_BASE", normalized_base_url);
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
fn load_gateway_auth() -> Result<StoredGatewayAuth, String> {
    Ok(StoredGatewayAuth {
        token: Some(load_or_create_gateway_token()?),
        password: None,
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
fn install_runtime(app: AppHandle) -> Result<bool, String> {
    install_runtime_internal(&app)?;
    Ok(true)
}

#[tauri::command]
fn diagnose_runtime(app: AppHandle) -> Result<RuntimeDiagnosis, String> {
    let runtime = resolve_runtime_command(&app).ok();
    let bootstrap_config = load_runtime_bootstrap_config(&app)?;
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

fn write_workspace_files(
    workspace_dir: &Path,
    identity_md: &str,
    user_md: &str,
    soul_md: &str,
    agents_md: &str,
) -> Result<(), String> {
    fs::create_dir_all(workspace_dir).map_err(|e| format!("failed to create workspace dir: {e}"))?;
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

const DEFAULT_IDENTITY_MD: &str = include_str!("../../../../services/openclaw/resources/IDENTITY.md");
const DEFAULT_USER_MD: &str = include_str!("../../../../services/openclaw/resources/USER.md");
const DEFAULT_SOUL_MD: &str = include_str!("../../../../services/openclaw/resources/SOUL.md");
const DEFAULT_AGENTS_MD: &str = include_str!("../../../../services/openclaw/resources/AGENTS.md");
const DEFAULT_FINANCE_DECISION_FRAMEWORK_MD: &str =
    include_str!("../../../../services/openclaw/resources/FINANCE_DECISION_FRAMEWORK.md");

fn ensure_openclaw_workspace_seed(app: &AppHandle) -> Result<(), String> {
    let workspace_dir = openclaw_workspace_dir(app);
    fs::create_dir_all(&workspace_dir).map_err(|e| format!("failed to create workspace dir: {e}"))?;

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

    let identity_md = value_str(settings, &["identity", "markdownContent"], DEFAULT_IDENTITY_MD);
    let user_md = value_str(settings, &["userProfile", "markdownContent"], DEFAULT_USER_MD);
    let soul_md = value_str(settings, &["soulPersona", "markdownContent"], DEFAULT_SOUL_MD);
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
            load_gateway_auth,
            load_runtime_config,
            save_runtime_config,
            install_runtime,
            diagnose_runtime,
            load_iclaw_workspace_files,
            reset_iclaw_workspace_to_defaults,
            apply_iclaw_workspace_backup,
            save_iclaw_settings_and_apply
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
