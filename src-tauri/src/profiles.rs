use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

use crate::keychain;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum AuthType {
    #[serde(rename = "access_key")]
    AccessKey {
        access_key_id: String,
        // Secret is stored in keychain, not here
        #[serde(skip_serializing_if = "Option::is_none")]
        session_token: Option<String>,
    },
    #[serde(rename = "sso")]
    Sso {
        sso_start_url: String,
        sso_region: String,
        sso_account_id: String,
        sso_role_name: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Profile {
    pub id: String,
    pub name: String,
    pub auth: AuthType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub endpoint_url: Option<String>,
    pub region: String,
    #[serde(default)]
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProfileStore {
    pub profiles: Vec<Profile>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_profile_id: Option<String>,
}

impl ProfileStore {
    pub fn load(app_data_dir: &PathBuf) -> Result<Self, String> {
        let path = app_data_dir.join("profiles.json");
        if !path.exists() {
            return Ok(Self::default());
        }

        let content = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read profiles: {}", e))?;

        serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse profiles: {}", e))
    }

    pub fn save(&self, app_data_dir: &PathBuf) -> Result<(), String> {
        fs::create_dir_all(app_data_dir)
            .map_err(|e| format!("Failed to create data directory: {}", e))?;

        let path = app_data_dir.join("profiles.json");
        let content = serde_json::to_string_pretty(self)
            .map_err(|e| format!("Failed to serialize profiles: {}", e))?;

        fs::write(&path, content)
            .map_err(|e| format!("Failed to write profiles: {}", e))
    }

    pub fn add_or_update(&mut self, profile: Profile) {
        if let Some(existing) = self.profiles.iter_mut().find(|p| p.id == profile.id) {
            *existing = profile;
        } else {
            self.profiles.push(profile);
        }
    }

    pub fn delete(&mut self, profile_id: &str) {
        self.profiles.retain(|p| p.id != profile_id);
        if self.active_profile_id.as_deref() == Some(profile_id) {
            self.active_profile_id = None;
        }
    }

    pub fn set_active(&mut self, profile_id: &str) -> Result<(), String> {
        if !self.profiles.iter().any(|p| p.id == profile_id) {
            return Err("Profile not found".to_string());
        }

        for profile in &mut self.profiles {
            profile.is_active = profile.id == profile_id;
        }
        self.active_profile_id = Some(profile_id.to_string());
        Ok(())
    }

    pub fn get_active(&self) -> Option<&Profile> {
        self.active_profile_id
            .as_ref()
            .and_then(|id| self.profiles.iter().find(|p| &p.id == id))
    }
}

pub fn get_secret_for_profile(profile_id: &str) -> Result<Option<String>, String> {
    keychain::get_secret(profile_id)
}

pub fn set_secret_for_profile(profile_id: &str, secret: &str) -> Result<(), String> {
    keychain::set_secret(profile_id, secret)
}

pub fn delete_secret_for_profile(profile_id: &str) -> Result<(), String> {
    keychain::delete_secret(profile_id)
}
