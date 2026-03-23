fn main() {
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").expect("missing CARGO_MANIFEST_DIR");
    let brand_path = std::path::Path::new(&manifest_dir).join("brand.generated.json");
    println!("cargo:rerun-if-changed={}", brand_path.display());

    let brand_json = std::fs::read_to_string(&brand_path)
        .ok()
        .and_then(|raw| serde_json::from_str::<serde_json::Value>(&raw).ok());

    let auth_service = brand_json
        .as_ref()
        .and_then(|value| value.get("authService"))
        .and_then(|entry| entry.as_str())
        .map(str::to_owned)
        .unwrap_or_else(|| String::from("ai.iclaw.desktop"));
    let brand_id = brand_json
        .as_ref()
        .and_then(|value| value.get("brandId"))
        .and_then(|entry| entry.as_str())
        .map(str::to_owned)
        .unwrap_or_else(|| String::from("iclaw"));
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
