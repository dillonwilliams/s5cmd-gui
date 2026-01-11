use log::{debug, error, info};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Command;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SsoConfig {
    pub sso_start_url: String,
    pub sso_region: String,
    pub sso_account_id: String,
    pub sso_role_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SsoStatus {
    NotStarted,
    AwaitingBrowser,
    Authenticated,
    Failed(String),
    Expired,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SsoSession {
    pub status: SsoStatus,
    pub config: SsoConfig,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub access_key_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub secret_access_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expiration: Option<String>,
}

// Store active SSO sessions
lazy_static::lazy_static! {
    static ref SSO_SESSIONS: Mutex<HashMap<String, SsoSession>> = Mutex::new(HashMap::new());
}

impl SsoSession {
    pub fn new(config: SsoConfig) -> Self {
        Self {
            status: SsoStatus::NotStarted,
            config,
            access_key_id: None,
            secret_access_key: None,
            session_token: None,
            expiration: None,
        }
    }
}

/// Start SSO login process using AWS CLI
pub fn start_sso_login(profile_id: &str, config: SsoConfig) -> Result<String, String> {
    info!("Starting SSO login for profile: {}", profile_id);

    // Create a temporary AWS config for SSO
    let config_content = format!(
        r#"[profile s5cmd-gui-sso]
sso_start_url = {}
sso_region = {}
sso_account_id = {}
sso_role_name = {}
region = {}
"#,
        config.sso_start_url,
        config.sso_region,
        config.sso_account_id,
        config.sso_role_name,
        config.sso_region
    );

    debug!("SSO config:\n{}", config_content);

    // Write temporary config
    let temp_dir = std::env::temp_dir().join("s5cmd-gui-sso");
    std::fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;

    let config_path = temp_dir.join("config");
    std::fs::write(&config_path, config_content)
        .map_err(|e| format!("Failed to write SSO config: {}", e))?;

    // Store the session
    let session = SsoSession {
        status: SsoStatus::AwaitingBrowser,
        config: config.clone(),
        access_key_id: None,
        secret_access_key: None,
        session_token: None,
        expiration: None,
    };

    if let Ok(mut sessions) = SSO_SESSIONS.lock() {
        sessions.insert(profile_id.to_string(), session);
    }

    // Run aws sso login
    let output = Command::new("aws")
        .env("AWS_CONFIG_FILE", config_path.to_string_lossy().to_string())
        .args(["sso", "login", "--profile", "s5cmd-gui-sso"])
        .output()
        .map_err(|e| format!("Failed to run AWS CLI: {}", e))?;

    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        error!("SSO login failed: {}", error);

        if let Ok(mut sessions) = SSO_SESSIONS.lock() {
            if let Some(session) = sessions.get_mut(profile_id) {
                session.status = SsoStatus::Failed(error.to_string());
            }
        }

        return Err(format!("SSO login failed: {}", error));
    }

    info!("SSO login completed for profile: {}", profile_id);

    // Get credentials
    get_sso_credentials(profile_id, &config, &config_path)?;

    Ok("SSO login completed".to_string())
}

fn get_sso_credentials(
    profile_id: &str,
    config: &SsoConfig,
    config_path: &std::path::Path,
) -> Result<(), String> {
    // Use aws configure export-credentials to get the credentials
    let output = Command::new("aws")
        .env("AWS_CONFIG_FILE", config_path.to_string_lossy().to_string())
        .args([
            "configure",
            "export-credentials",
            "--profile",
            "s5cmd-gui-sso",
            "--format",
            "env",
        ])
        .output()
        .map_err(|e| format!("Failed to get SSO credentials: {}", e))?;

    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to get SSO credentials: {}", error));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut access_key = None;
    let mut secret_key = None;
    let mut session_token = None;

    for line in stdout.lines() {
        if let Some(value) = line.strip_prefix("export AWS_ACCESS_KEY_ID=") {
            access_key = Some(value.trim().to_string());
        } else if let Some(value) = line.strip_prefix("export AWS_SECRET_ACCESS_KEY=") {
            secret_key = Some(value.trim().to_string());
        } else if let Some(value) = line.strip_prefix("export AWS_SESSION_TOKEN=") {
            session_token = Some(value.trim().to_string());
        }
    }

    if let Ok(mut sessions) = SSO_SESSIONS.lock() {
        if let Some(session) = sessions.get_mut(profile_id) {
            session.access_key_id = access_key;
            session.secret_access_key = secret_key;
            session.session_token = session_token;
            session.status = SsoStatus::Authenticated;
        }
    }

    Ok(())
}

pub fn check_sso_status(profile_id: &str) -> Result<SsoStatus, String> {
    if let Ok(sessions) = SSO_SESSIONS.lock() {
        if let Some(session) = sessions.get(profile_id) {
            return Ok(session.status.clone());
        }
    }
    Ok(SsoStatus::NotStarted)
}

pub fn get_sso_session(profile_id: &str) -> Option<SsoSession> {
    SSO_SESSIONS
        .lock()
        .ok()
        .and_then(|sessions| sessions.get(profile_id).cloned())
}

pub fn clear_sso_session(profile_id: &str) {
    if let Ok(mut sessions) = SSO_SESSIONS.lock() {
        sessions.remove(profile_id);
    }
}
