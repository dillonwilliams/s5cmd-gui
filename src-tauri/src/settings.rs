use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    // General
    #[serde(default = "default_download_location")]
    pub download_location: String,
    #[serde(default = "default_concurrency")]
    pub concurrent_operations: u32,
    #[serde(default)]
    pub show_hidden_files: bool,
    #[serde(default = "default_true")]
    pub confirm_before_delete: bool,
    #[serde(default)]
    pub single_click_to_open: bool,

    // Advanced
    #[serde(default)]
    pub s5cmd_path: Option<String>,
    #[serde(default = "default_retries")]
    pub max_retries: u32,
    #[serde(default = "default_timeout")]
    pub timeout_seconds: u32,
    #[serde(default = "default_log_level")]
    pub log_level: String,
}

fn default_download_location() -> String {
    dirs::download_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "~/Downloads".to_string())
}

fn default_concurrency() -> u32 {
    10
}

fn default_true() -> bool {
    true
}

fn default_retries() -> u32 {
    3
}

fn default_timeout() -> u32 {
    300
}

fn default_log_level() -> String {
    "Info".to_string()
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            download_location: default_download_location(),
            concurrent_operations: default_concurrency(),
            show_hidden_files: false,
            confirm_before_delete: true,
            single_click_to_open: false,
            s5cmd_path: None,
            max_retries: default_retries(),
            timeout_seconds: default_timeout(),
            log_level: default_log_level(),
        }
    }
}

impl Settings {
    pub fn load(app_data_dir: &PathBuf) -> Result<Self, String> {
        let path = app_data_dir.join("settings.json");
        if !path.exists() {
            return Ok(Self::default());
        }

        let content = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read settings: {}", e))?;

        serde_json::from_str(&content).map_err(|e| format!("Failed to parse settings: {}", e))
    }

    pub fn save(&self, app_data_dir: &PathBuf) -> Result<(), String> {
        fs::create_dir_all(app_data_dir)
            .map_err(|e| format!("Failed to create data directory: {}", e))?;

        let path = app_data_dir.join("settings.json");
        let content = serde_json::to_string_pretty(self)
            .map_err(|e| format!("Failed to serialize settings: {}", e))?;

        fs::write(&path, content).map_err(|e| format!("Failed to write settings: {}", e))
    }

    pub fn get_s5cmd_binary(&self) -> String {
        self.s5cmd_path.clone().unwrap_or_else(|| "s5cmd".to_string())
    }
}
