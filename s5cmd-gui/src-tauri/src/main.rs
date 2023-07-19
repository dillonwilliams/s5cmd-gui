// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}


#[tauri::command]
fn run_s5cmd(command: String, args: Vec<String>) -> String {
  use std::process::Command;

  let output = Command::new("s5cmd")
    .arg(command)
    .arg("--json")
    .args(args)
    .output()
    .expect("Failed to execute s5cmd");

  if output.status.success() {
    String::from_utf8_lossy(&output.stdout).into_owned()
  } else {
    String::from_utf8_lossy(&output.stderr).into_owned()
  }
}


fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
