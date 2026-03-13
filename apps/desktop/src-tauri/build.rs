fn main() {
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").expect("missing CARGO_MANIFEST_DIR");
    let brand_path = std::path::Path::new(&manifest_dir).join("brand.generated.json");
    println!("cargo:rerun-if-changed={}", brand_path.display());

    let auth_service = std::fs::read_to_string(&brand_path)
        .ok()
        .and_then(|raw| serde_json::from_str::<serde_json::Value>(&raw).ok())
        .and_then(|value| value.get("authService").and_then(|entry| entry.as_str()).map(str::to_owned))
        .unwrap_or_else(|| String::from("ai.iclaw.desktop"));

    println!("cargo:rustc-env=ICLAW_AUTH_SERVICE={auth_service}");
    tauri_build::build()
}
