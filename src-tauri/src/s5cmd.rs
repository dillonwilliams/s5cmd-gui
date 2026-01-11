use log::{debug, error, info, warn};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex, OnceLock};
use tempfile::NamedTempFile;
use uuid::Uuid;

use crate::profiles::{AuthType, Profile};
use crate::settings::Settings;
use crate::sso;

// Store the resolved sidecar path
static SIDECAR_PATH: OnceLock<PathBuf> = OnceLock::new();

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct S3Object {
    pub key: String,
    #[serde(rename = "type")]
    pub object_type: String,
    #[serde(default)]
    pub size: Option<i64>,
    #[serde(default)]
    pub storage_class: Option<String>,
    #[serde(default)]
    pub etag: Option<String>,
    #[serde(default)]
    pub last_modified: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct S3Bucket {
    pub name: String,
    #[serde(default)]
    pub creation_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationProgress {
    pub id: String,
    pub operation_type: String,
    pub total_files: usize,
    pub completed_files: usize,
    pub total_bytes: i64,
    pub transferred_bytes: i64,
    pub current_file: Option<String>,
    pub status: OperationStatus,
    pub error: Option<String>,
    pub started_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum OperationStatus {
    Running,
    Paused,
    Completed,
    Failed,
    Cancelled,
}

// Store active operations for progress tracking and cancellation
lazy_static::lazy_static! {
    static ref ACTIVE_OPERATIONS: Mutex<HashMap<String, Arc<Mutex<OperationState>>>> = Mutex::new(HashMap::new());
}

struct OperationState {
    progress: OperationProgress,
    child: Option<Child>,
    cancelled: bool,
}

/// Initialize the sidecar path. Call this during app setup.
pub fn init_sidecar_path(app_handle: &tauri::AppHandle) {
    if SIDECAR_PATH.get().is_some() {
        return;
    }

    // Try to resolve the sidecar path
    let sidecar_path = resolve_sidecar_path(app_handle);

    if let Some(path) = sidecar_path {
        info!("s5cmd sidecar path: {:?}", path);
        let _ = SIDECAR_PATH.set(path);
    } else {
        warn!("Could not find bundled s5cmd, will try system PATH");
    }
}

fn resolve_sidecar_path(app_handle: &tauri::AppHandle) -> Option<PathBuf> {
    // Get the path to the current executable
    let exe_path = std::env::current_exe().ok()?;
    let exe_dir = exe_path.parent()?;

    // Determine the sidecar binary name based on platform
    #[cfg(target_os = "windows")]
    let sidecar_name = "s5cmd.exe";

    #[cfg(not(target_os = "windows"))]
    let sidecar_name = "s5cmd";

    // In development, the sidecar might be in different locations
    // Try the standard Tauri sidecar location first
    let possible_paths = vec![
        // Production: next to the executable
        exe_dir.join(sidecar_name),
        // macOS app bundle
        exe_dir.join("../Resources").join(sidecar_name),
        // Development: in the target directory
        exe_dir.join("binaries").join(sidecar_name),
        // Tauri's sidecar location during development
        {
            let mut path = exe_dir.to_path_buf();
            // Go up to find src-tauri/binaries
            for _ in 0..5 {
                path = path.join("..").join("src-tauri").join("binaries").join(sidecar_name);
                if path.exists() {
                    break;
                }
                path = path.parent().unwrap_or(&path).parent().unwrap_or(&path).to_path_buf();
            }
            path
        },
    ];

    for path in possible_paths {
        let canonical = path.canonicalize().ok();
        if let Some(p) = canonical {
            if p.exists() && p.is_file() {
                return Some(p);
            }
        }
        if path.exists() && path.is_file() {
            return Some(path);
        }
    }

    None
}

/// Get the path to the s5cmd binary
pub fn get_s5cmd_path(custom_path: Option<&str>) -> String {
    // First check if user specified a custom path
    if let Some(path) = custom_path {
        if !path.is_empty() {
            return path.to_string();
        }
    }

    // Then check if we have a bundled sidecar
    if let Some(path) = SIDECAR_PATH.get() {
        if path.exists() {
            return path.to_string_lossy().to_string();
        }
    }

    // Fall back to system PATH
    "s5cmd".to_string()
}

pub struct S5cmdRunner {
    profile: Profile,
    settings: Settings,
}

impl S5cmdRunner {
    pub fn new(profile: Profile, settings: Settings) -> Self {
        Self { profile, settings }
    }

    fn get_binary_path(&self) -> String {
        get_s5cmd_path(self.settings.s5cmd_path.as_deref())
    }

    fn build_command(&self) -> Result<Command, String> {
        let binary = self.get_binary_path();
        debug!("Using s5cmd binary: {}", binary);

        let mut cmd = Command::new(&binary);

        // Set environment variables based on auth type
        match &self.profile.auth {
            AuthType::AccessKey {
                access_key_id,
                session_token,
            } => {
                cmd.env("AWS_ACCESS_KEY_ID", access_key_id);

                // Get secret from keychain
                if let Some(secret) =
                    crate::profiles::get_secret_for_profile(&self.profile.id)?
                {
                    cmd.env("AWS_SECRET_ACCESS_KEY", secret);
                } else {
                    return Err("Secret access key not found in keychain".to_string());
                }

                if let Some(token) = session_token {
                    cmd.env("AWS_SESSION_TOKEN", token);
                }
            }
            AuthType::Sso { .. } => {
                // Get credentials from SSO session
                if let Some(session) = sso::get_sso_session(&self.profile.id) {
                    if let (Some(access_key), Some(secret_key)) =
                        (&session.access_key_id, &session.secret_access_key)
                    {
                        cmd.env("AWS_ACCESS_KEY_ID", access_key);
                        cmd.env("AWS_SECRET_ACCESS_KEY", secret_key);

                        if let Some(token) = &session.session_token {
                            cmd.env("AWS_SESSION_TOKEN", token);
                        }
                    } else {
                        return Err("SSO credentials not available".to_string());
                    }
                } else {
                    return Err("SSO session not found. Please login first.".to_string());
                }
            }
        }

        cmd.env("AWS_REGION", &self.profile.region);

        if let Some(endpoint) = &self.profile.endpoint_url {
            cmd.arg("--endpoint-url").arg(endpoint);
        }

        cmd.arg("--json");

        Ok(cmd)
    }

    pub fn list_buckets(&self) -> Result<Vec<S3Bucket>, String> {
        let mut cmd = self.build_command()?;
        cmd.arg("ls");

        debug!("Running s5cmd ls for buckets");

        let output = cmd.output().map_err(|e| {
            let binary = self.get_binary_path();
            format!("Failed to execute s5cmd ({}): {}. Make sure s5cmd is installed.", binary, e)
        })?;

        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            error!("s5cmd ls failed: {}", error);
            return Err(parse_s5cmd_error(&error));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        parse_json_lines(&stdout)
    }

    pub fn list_objects(&self, path: &str) -> Result<Vec<S3Object>, String> {
        let mut cmd = self.build_command()?;
        cmd.arg("ls").arg(path);

        debug!("Running s5cmd ls {}", path);

        let output = cmd.output().map_err(|e| format!("Failed to execute s5cmd: {}", e))?;

        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            if error.contains("no object found") {
                return Ok(Vec::new());
            }
            error!("s5cmd ls failed: {}", error);
            return Err(parse_s5cmd_error(&error));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        parse_json_lines(&stdout)
    }

    pub fn delete_objects(&self, paths: Vec<String>) -> Result<OperationProgress, String> {
        let operation_id = Uuid::new_v4().to_string();
        let total_files = paths.len();

        info!("Starting delete operation {} for {} files", operation_id, total_files);

        // For batch operations, use run command
        let commands: Vec<String> = paths.iter().map(|p| format!("rm \"{}\"", p)).collect();

        self.run_batch_operation(&operation_id, "delete", commands, total_files)
    }

    pub fn copy_objects(
        &self,
        sources: Vec<String>,
        destination: &str,
    ) -> Result<OperationProgress, String> {
        let operation_id = Uuid::new_v4().to_string();
        let total_files = sources.len();

        info!(
            "Starting copy operation {} for {} files to {}",
            operation_id, total_files, destination
        );

        let commands: Vec<String> = sources
            .iter()
            .map(|s| {
                if s.ends_with('/') {
                    format!("cp \"{}*\" \"{}\"", s, destination)
                } else {
                    format!("cp \"{}\" \"{}\"", s, destination)
                }
            })
            .collect();

        self.run_batch_operation(&operation_id, "copy", commands, total_files)
    }

    pub fn move_objects(
        &self,
        sources: Vec<String>,
        destination: &str,
    ) -> Result<OperationProgress, String> {
        let operation_id = Uuid::new_v4().to_string();
        let total_files = sources.len();

        info!(
            "Starting move operation {} for {} files to {}",
            operation_id, total_files, destination
        );

        let commands: Vec<String> = sources
            .iter()
            .map(|s| format!("mv \"{}\" \"{}\"", s, destination))
            .collect();

        self.run_batch_operation(&operation_id, "move", commands, total_files)
    }

    pub fn download_objects(
        &self,
        sources: Vec<(String, bool)>, // (path, is_directory)
        destination: &str,
    ) -> Result<OperationProgress, String> {
        let operation_id = Uuid::new_v4().to_string();
        let total_files = sources.len();

        info!(
            "Starting download operation {} for {} items to {}",
            operation_id, total_files, destination
        );

        let commands: Vec<String> = sources
            .iter()
            .map(|(path, is_dir)| {
                if *is_dir {
                    format!("cp \"{}*\" \"{}\"", path, destination)
                } else {
                    format!("cp \"{}\" \"{}\"", path, destination)
                }
            })
            .collect();

        self.run_batch_operation(&operation_id, "download", commands, total_files)
    }

    pub fn upload_objects(
        &self,
        sources: Vec<String>,
        destination: &str,
    ) -> Result<OperationProgress, String> {
        let operation_id = Uuid::new_v4().to_string();
        let total_files = sources.len();

        info!(
            "Starting upload operation {} for {} files to {}",
            operation_id, total_files, destination
        );

        let commands: Vec<String> = sources
            .iter()
            .map(|s| format!("cp \"{}\" \"{}\"", s, destination))
            .collect();

        self.run_batch_operation(&operation_id, "upload", commands, total_files)
    }

    pub fn create_folder(&self, path: &str) -> Result<(), String> {
        // s5cmd doesn't have a direct mkdir, but we can create an empty object with a trailing slash
        let folder_path = if path.ends_with('/') {
            path.to_string()
        } else {
            format!("{}/", path)
        };

        // Create a zero-byte object to represent the folder
        let temp_file = NamedTempFile::new()
            .map_err(|e| format!("Failed to create temp file: {}", e))?;

        let mut cmd = self.build_command()?;
        cmd.arg("cp")
            .arg(temp_file.path())
            .arg(&folder_path);

        let output = cmd.output().map_err(|e| format!("Failed to execute s5cmd: {}", e))?;

        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            return Err(parse_s5cmd_error(&error));
        }

        Ok(())
    }

    fn run_batch_operation(
        &self,
        operation_id: &str,
        operation_type: &str,
        commands: Vec<String>,
        total_files: usize,
    ) -> Result<OperationProgress, String> {
        // Write commands to temp file
        let temp_file = NamedTempFile::new()
            .map_err(|e| format!("Failed to create temp file: {}", e))?;

        std::fs::write(temp_file.path(), commands.join("\n"))
            .map_err(|e| format!("Failed to write commands: {}", e))?;

        let mut cmd = self.build_command()?;
        cmd.arg("--numworkers")
            .arg(self.settings.concurrent_operations.to_string())
            .arg("run")
            .arg(temp_file.path())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let child = cmd.spawn().map_err(|e| format!("Failed to spawn s5cmd: {}", e))?;

        let progress = OperationProgress {
            id: operation_id.to_string(),
            operation_type: operation_type.to_string(),
            total_files,
            completed_files: 0,
            total_bytes: 0,
            transferred_bytes: 0,
            current_file: None,
            status: OperationStatus::Running,
            error: None,
            started_at: chrono::Utc::now().to_rfc3339(),
        };

        let state = Arc::new(Mutex::new(OperationState {
            progress: progress.clone(),
            child: Some(child),
            cancelled: false,
        }));

        // Store the operation
        if let Ok(mut ops) = ACTIVE_OPERATIONS.lock() {
            ops.insert(operation_id.to_string(), state.clone());
        }

        // Monitor progress in background
        let op_id = operation_id.to_string();
        std::thread::spawn(move || {
            monitor_operation(op_id, state);
        });

        // Keep temp file alive for the duration of the operation
        std::mem::forget(temp_file);

        Ok(progress)
    }
}

fn monitor_operation(operation_id: String, state: Arc<Mutex<OperationState>>) {
    let mut completed = 0;
    let mut stderr_output = String::new();

    loop {
        let (cancelled, child_finished) = {
            let mut guard = match state.lock() {
                Ok(g) => g,
                Err(_) => break,
            };

            if guard.cancelled {
                if let Some(ref mut child) = guard.child {
                    let _ = child.kill();
                }
                guard.progress.status = OperationStatus::Cancelled;
                break;
            }

            if let Some(ref mut child) = guard.child {
                // Check if stderr has output
                if let Some(ref mut stderr) = child.stderr {
                    let reader = BufReader::new(stderr);
                    for line in reader.lines().take(10) {
                        if let Ok(line) = line {
                            stderr_output.push_str(&line);
                            stderr_output.push('\n');

                            // Parse JSON output to count completed operations
                            if line.contains("\"operation\"") {
                                completed += 1;
                            }
                        }
                    }
                }

                match child.try_wait() {
                    Ok(Some(status)) => {
                        guard.progress.completed_files = completed;
                        if status.success() {
                            guard.progress.status = OperationStatus::Completed;
                        } else {
                            guard.progress.status = OperationStatus::Failed;
                            guard.progress.error = Some(stderr_output.clone());
                        }
                        (guard.cancelled, true)
                    }
                    Ok(None) => {
                        guard.progress.completed_files = completed;
                        (guard.cancelled, false)
                    }
                    Err(e) => {
                        guard.progress.status = OperationStatus::Failed;
                        guard.progress.error = Some(format!("Error checking process: {}", e));
                        (guard.cancelled, true)
                    }
                }
            } else {
                (guard.cancelled, true)
            }
        };

        if child_finished || cancelled {
            break;
        }

        std::thread::sleep(std::time::Duration::from_millis(100));
    }

    // Clean up operation from active list after a delay
    std::thread::sleep(std::time::Duration::from_secs(60));
    if let Ok(mut ops) = ACTIVE_OPERATIONS.lock() {
        ops.remove(&operation_id);
    }
}

pub fn cancel_operation(operation_id: &str) -> Result<(), String> {
    if let Ok(ops) = ACTIVE_OPERATIONS.lock() {
        if let Some(state) = ops.get(operation_id) {
            if let Ok(mut guard) = state.lock() {
                guard.cancelled = true;
                if let Some(ref mut child) = guard.child {
                    let _ = child.kill();
                }
                info!("Cancelled operation: {}", operation_id);
                return Ok(());
            }
        }
    }
    Err("Operation not found".to_string())
}

pub fn get_operation_progress(operation_id: &str) -> Option<OperationProgress> {
    if let Ok(ops) = ACTIVE_OPERATIONS.lock() {
        if let Some(state) = ops.get(operation_id) {
            if let Ok(guard) = state.lock() {
                return Some(guard.progress.clone());
            }
        }
    }
    None
}

fn parse_json_lines<T: for<'de> Deserialize<'de>>(output: &str) -> Result<Vec<T>, String> {
    let mut results = Vec::new();

    for line in output.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        match serde_json::from_str::<T>(line) {
            Ok(item) => results.push(item),
            Err(e) => {
                warn!("Failed to parse JSON line: {} - {}", line, e);
            }
        }
    }

    Ok(results)
}

fn parse_s5cmd_error(error: &str) -> String {
    // Map common s5cmd errors to user-friendly messages
    if error.contains("NoCredentialProviders") || error.contains("no valid credential") {
        return "AWS credentials not found or invalid. Please check your profile configuration."
            .to_string();
    }

    if error.contains("AccessDenied") {
        return "Access denied. You don't have permission to perform this operation.".to_string();
    }

    if error.contains("NoSuchBucket") {
        return "Bucket not found. It may have been deleted or you don't have access.".to_string();
    }

    if error.contains("NoSuchKey") {
        return "Object not found.".to_string();
    }

    if error.contains("InvalidAccessKeyId") {
        return "Invalid AWS access key. Please check your credentials.".to_string();
    }

    if error.contains("SignatureDoesNotMatch") {
        return "Invalid AWS secret key. Please check your credentials.".to_string();
    }

    if error.contains("ExpiredToken") {
        return "Your session has expired. Please refresh your credentials.".to_string();
    }

    if error.contains("RequestTimeTooSkewed") {
        return "Your system clock is out of sync. Please correct your system time.".to_string();
    }

    // Return the original error if no mapping found
    error.to_string()
}

pub fn get_s5cmd_version(custom_path: Option<&str>) -> Result<String, String> {
    let binary = get_s5cmd_path(custom_path);

    let output = Command::new(&binary)
        .arg("version")
        .output()
        .map_err(|e| format!("Failed to run s5cmd ({}): {}", binary, e))?;

    if output.status.success() {
        let version = String::from_utf8_lossy(&output.stdout);
        Ok(version.trim().to_string())
    } else {
        Err("Failed to get s5cmd version".to_string())
    }
}

/// Check if s5cmd is available
pub fn check_s5cmd_available() -> Result<String, String> {
    let path = get_s5cmd_path(None);
    get_s5cmd_version(Some(&path))
}
