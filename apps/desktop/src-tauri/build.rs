fn main() {
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").expect("missing CARGO_MANIFEST_DIR");
    let brand_path = std::path::Path::new(&manifest_dir).join("brand.generated.json");
    println!("cargo:rerun-if-changed={}", brand_path.display());

    let env_brand_id = std::env::var("APP_NAME")
        .ok()
        .or_else(|| std::env::var("ICLAW_PORTAL_APP_NAME").ok())
        .or_else(|| std::env::var("ICLAW_BRAND").ok())
        .or_else(|| std::env::var("ICLAW_APP_NAME").ok())
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty());
    let brand_json = std::fs::read_to_string(&brand_path)
        .ok()
        .and_then(|raw| serde_json::from_str::<serde_json::Value>(&raw).ok());

    let brand_id = brand_json
        .as_ref()
        .and_then(|value| value.get("brandId"))
        .and_then(|entry| entry.as_str())
        .map(str::to_owned)
        .or(env_brand_id)
        .unwrap_or_else(|| {
            panic!(
                "missing brandId; set APP_NAME or generate {}",
                brand_path.display()
            )
        });
    let auth_service = brand_json
        .as_ref()
        .and_then(|value| value.get("authService"))
        .and_then(|entry| entry.as_str())
        .map(str::to_owned)
        .or_else(|| Some(format!("ai.{brand_id}.desktop")))
        .unwrap();
    let auth_base_url = brand_json
        .as_ref()
        .and_then(|value| value.get("endpoints"))
        .and_then(|entry| entry.get("authBaseUrl"))
        .and_then(|entry| entry.as_str())
        .map(str::to_owned)
        .unwrap_or_default();

    println!("cargo:rustc-env=ICLAW_AUTH_SERVICE={auth_service}");
    println!("cargo:rustc-env=ICLAW_BRAND_ID={brand_id}");
    println!("cargo:rustc-env=ICLAW_AUTH_BASE_URL={auth_base_url}");
    tauri_build::build()
}
