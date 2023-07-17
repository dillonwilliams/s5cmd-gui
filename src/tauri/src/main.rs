use tauri::{Command, Manager};

#[tauri::command]
fn run_s5cmd(command: String, args: Vec<String>) -> String {
  use std::process::Command;

  let output = Command::new("s5cmd")
    .arg(command)
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
    .invoke_handler(tauri::generate_handler![run_s5cmd])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
