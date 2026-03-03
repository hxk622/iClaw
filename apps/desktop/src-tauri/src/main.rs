#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::State;

struct SidecarState {
    child: Mutex<Option<Child>>,
}

#[tauri::command]
fn start_sidecar(
    state: State<'_, SidecarState>,
    command: String,
    args: Vec<String>,
) -> Result<bool, String> {
    let mut child_guard = state
        .child
        .lock()
        .map_err(|_| String::from("failed to lock sidecar state"))?;

    if child_guard.is_some() {
        return Ok(true);
    }

    let child = Command::new(command)
        .args(args)
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

fn main() {
    tauri::Builder::default()
        .manage(SidecarState {
            child: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![start_sidecar, stop_sidecar])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
