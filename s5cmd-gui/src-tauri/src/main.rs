use std::env;
use std::io::Write;
use tempfile::tempdir;
use std::fs::File;
use tauri::api::process::Command;
// Prevents additional console window on Windows in release, DO NOT REMOVE!!
//#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn set_s3_secret(access_key_id: String, secret_access_key: String) -> () {
  env::set_var("AWS_ACCESS_KEY_ID", access_key_id);
  env::set_var("AWS_SECRET_ACCESS_KEY", secret_access_key);
}

#[tauri::command]
fn run_s5cmd_run(commands: Vec<String>) ->

Result<String, String> {
  //use std::process::Command;
  let dir = tempdir().unwrap();

  let file_path = dir.path().join("s5cmdrun.txt");
  let mut file = File::create(file_path.clone()).unwrap();

  for command in commands {
    writeln!(file, "{}", command).unwrap();
  }
  let args: Vec<String> = vec!["--json".to_string(), "run".to_string(), file_path.clone().to_str().unwrap().to_string()];
  let output = Command::new("s5cmd")
    .args(args)
    // .arg("--json")
    // .arg("run")
    // .arg(file_path.clone())
    .output()
    .expect("Failed to execute s5cmd");

  println!("{:?}", output.status);
  println!("stdout: {}", output.stdout);
  println!("stderr: {}", (&output.stderr));
  if output.status.success() {
    Ok(output.stdout)
  } else {
    //String::from_utf8_lossy(&output.stderr).into_owned()
    Err(output.stderr)
  }
}

#[tauri::command]
fn run_s5cmd(command: String, args: Vec<String>) -> String {
  //use std::process::Command;
  let mut all_args = args.clone();
  all_args.insert(0, command.clone());
  all_args.insert(0, "--json".to_string());

  let (mut rx, mut child) = Command::new_sidecar("s5cmd")
  .expect("failed to create `my-sidecar` binary command")
  .spawn()
  .expect("Failed to spawn sidecar");


  let output = Command::new("s5cmd")
    //.arg("--json")
    //.arg(command)
    .args(all_args)
    .output()
    .expect("Failed to execute s5cmd");

  println!("{:?}", output.status);
  println!("stdout: {}", &output.stdout);
  println!("stderr: {}", &output.stderr);
  if output.status.success() {
    output.stdout
  } else {
    output.stderr
  }
}


fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![set_s3_secret, run_s5cmd, run_s5cmd_run])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
