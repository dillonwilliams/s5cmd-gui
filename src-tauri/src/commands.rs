use log::{debug, error, info};
use serde::{Deserialize, Serialize};
use tauri::Manager;
use uuid::Uuid;

use crate::logging;
use crate::profiles::{self, AuthType, Profile, ProfileStore};
use crate::s5cmd::{self, OperationProgress, S3Bucket, S3Object, S5cmdRunner};
use crate::settings::Settings;
use crate::sso::{self, SsoConfig, SsoStatus};

fn get_app_data_dir(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    app.path_resolver()
        .app_data_dir()
        .ok_or_else(|| "Could not determine app data directory".to_string())
}

fn get_settings(app: &tauri::AppHandle) -> Result<Settings, String> {
    let app_data_dir = get_app_data_dir(app)?;
    Settings::load(&app_data_dir)
}

fn get_active_profile(app: &tauri::AppHandle) -> Result<Profile, String> {
    let app_data_dir = get_app_data_dir(app)?;
    let store = ProfileStore::load(&app_data_dir)?;
    store
        .get_active()
        .cloned()
        .ok_or_else(|| "No active profile. Please select a profile first.".to_string())
}

fn create_runner(app: &tauri::AppHandle) -> Result<S5cmdRunner, String> {
    let profile = get_active_profile(app)?;
    let settings = get_settings(app)?;
    Ok(S5cmdRunner::new(profile, settings))
}

// ============ Profile Management ============

#[derive(Debug, Serialize, Deserialize)]
pub struct ProfileWithoutSecret {
    pub id: String,
    pub name: String,
    pub auth_type: String,
    pub endpoint_url: Option<String>,
    pub region: String,
    pub is_active: bool,
    // SSO fields (only present for SSO profiles)
    pub sso_start_url: Option<String>,
    pub sso_region: Option<String>,
    pub sso_account_id: Option<String>,
    pub sso_role_name: Option<String>,
    // Access Key fields (only access_key_id, not secret)
    pub access_key_id: Option<String>,
    pub has_session_token: bool,
}

impl From<&Profile> for ProfileWithoutSecret {
    fn from(p: &Profile) -> Self {
        match &p.auth {
            AuthType::AccessKey {
                access_key_id,
                session_token,
            } => Self {
                id: p.id.clone(),
                name: p.name.clone(),
                auth_type: "access_key".to_string(),
                endpoint_url: p.endpoint_url.clone(),
                region: p.region.clone(),
                is_active: p.is_active,
                sso_start_url: None,
                sso_region: None,
                sso_account_id: None,
                sso_role_name: None,
                access_key_id: Some(access_key_id.clone()),
                has_session_token: session_token.is_some(),
            },
            AuthType::Sso {
                sso_start_url,
                sso_region,
                sso_account_id,
                sso_role_name,
            } => Self {
                id: p.id.clone(),
                name: p.name.clone(),
                auth_type: "sso".to_string(),
                endpoint_url: p.endpoint_url.clone(),
                region: p.region.clone(),
                is_active: p.is_active,
                sso_start_url: Some(sso_start_url.clone()),
                sso_region: Some(sso_region.clone()),
                sso_account_id: Some(sso_account_id.clone()),
                sso_role_name: Some(sso_role_name.clone()),
                access_key_id: None,
                has_session_token: false,
            },
        }
    }
}

#[tauri::command]
pub fn get_profiles(app: tauri::AppHandle) -> Result<Vec<ProfileWithoutSecret>, String> {
    let app_data_dir = get_app_data_dir(&app)?;
    let store = ProfileStore::load(&app_data_dir)?;

    Ok(store.profiles.iter().map(ProfileWithoutSecret::from).collect())
}

#[derive(Debug, Deserialize)]
pub struct SaveProfileRequest {
    pub id: Option<String>,
    pub name: String,
    pub auth_type: String,
    pub region: String,
    pub endpoint_url: Option<String>,
    // Access Key fields
    pub access_key_id: Option<String>,
    pub secret_access_key: Option<String>,
    pub session_token: Option<String>,
    // SSO fields
    pub sso_start_url: Option<String>,
    pub sso_region: Option<String>,
    pub sso_account_id: Option<String>,
    pub sso_role_name: Option<String>,
}

#[tauri::command]
pub fn save_profile(app: tauri::AppHandle, request: SaveProfileRequest) -> Result<String, String> {
    let app_data_dir = get_app_data_dir(&app)?;
    let mut store = ProfileStore::load(&app_data_dir)?;

    let profile_id = request.id.unwrap_or_else(|| Uuid::new_v4().to_string());

    let auth = if request.auth_type == "sso" {
        AuthType::Sso {
            sso_start_url: request
                .sso_start_url
                .ok_or("SSO Start URL is required")?,
            sso_region: request.sso_region.ok_or("SSO Region is required")?,
            sso_account_id: request.sso_account_id.ok_or("SSO Account ID is required")?,
            sso_role_name: request.sso_role_name.ok_or("SSO Role Name is required")?,
        }
    } else {
        let access_key_id = request.access_key_id.ok_or("Access Key ID is required")?;

        // Store secret in keychain
        if let Some(secret) = &request.secret_access_key {
            profiles::set_secret_for_profile(&profile_id, secret)?;
        }

        AuthType::AccessKey {
            access_key_id,
            session_token: request.session_token,
        }
    };

    let profile = Profile {
        id: profile_id.clone(),
        name: request.name,
        auth,
        endpoint_url: request.endpoint_url,
        region: request.region,
        is_active: false,
    };

    store.add_or_update(profile);
    store.save(&app_data_dir)?;

    info!("Saved profile: {}", profile_id);
    Ok(profile_id)
}

#[tauri::command]
pub fn delete_profile(app: tauri::AppHandle, profile_id: String) -> Result<(), String> {
    let app_data_dir = get_app_data_dir(&app)?;
    let mut store = ProfileStore::load(&app_data_dir)?;

    // Delete secret from keychain
    profiles::delete_secret_for_profile(&profile_id)?;

    store.delete(&profile_id);
    store.save(&app_data_dir)?;

    info!("Deleted profile: {}", profile_id);
    Ok(())
}

#[tauri::command]
pub fn set_active_profile(app: tauri::AppHandle, profile_id: String) -> Result<(), String> {
    let app_data_dir = get_app_data_dir(&app)?;
    let mut store = ProfileStore::load(&app_data_dir)?;

    store.set_active(&profile_id)?;
    store.save(&app_data_dir)?;

    info!("Set active profile: {}", profile_id);
    Ok(())
}

#[tauri::command]
pub fn test_profile_connection(app: tauri::AppHandle, profile_id: String) -> Result<String, String> {
    let app_data_dir = get_app_data_dir(&app)?;
    let store = ProfileStore::load(&app_data_dir)?;

    let profile = store
        .profiles
        .iter()
        .find(|p| p.id == profile_id)
        .ok_or("Profile not found")?
        .clone();

    let settings = Settings::load(&app_data_dir)?;
    let runner = S5cmdRunner::new(profile, settings);

    // Try to list buckets
    let buckets = runner.list_buckets()?;

    Ok(format!(
        "Connection successful! Found {} bucket(s).",
        buckets.len()
    ))
}

// ============ SSO ============

#[tauri::command]
pub fn start_sso_login(app: tauri::AppHandle, profile_id: String) -> Result<String, String> {
    let app_data_dir = get_app_data_dir(&app)?;
    let store = ProfileStore::load(&app_data_dir)?;

    let profile = store
        .profiles
        .iter()
        .find(|p| p.id == profile_id)
        .ok_or("Profile not found")?;

    match &profile.auth {
        AuthType::Sso {
            sso_start_url,
            sso_region,
            sso_account_id,
            sso_role_name,
        } => {
            let config = SsoConfig {
                sso_start_url: sso_start_url.clone(),
                sso_region: sso_region.clone(),
                sso_account_id: sso_account_id.clone(),
                sso_role_name: sso_role_name.clone(),
            };
            sso::start_sso_login(&profile_id, config)
        }
        _ => Err("Profile is not configured for SSO".to_string()),
    }
}

#[tauri::command]
pub fn check_sso_status(profile_id: String) -> Result<String, String> {
    let status = sso::check_sso_status(&profile_id)?;
    Ok(serde_json::to_string(&status).map_err(|e| e.to_string())?)
}

// ============ S3 Operations ============

#[tauri::command]
pub fn list_buckets(app: tauri::AppHandle) -> Result<Vec<S3Bucket>, String> {
    let runner = create_runner(&app)?;
    runner.list_buckets()
}

#[tauri::command]
pub fn list_objects(app: tauri::AppHandle, path: String) -> Result<Vec<S3Object>, String> {
    let runner = create_runner(&app)?;
    runner.list_objects(&path)
}

#[tauri::command]
pub fn delete_objects(app: tauri::AppHandle, paths: Vec<String>) -> Result<OperationProgress, String> {
    let runner = create_runner(&app)?;
    runner.delete_objects(paths)
}

#[tauri::command]
pub fn copy_objects(
    app: tauri::AppHandle,
    sources: Vec<String>,
    destination: String,
) -> Result<OperationProgress, String> {
    let runner = create_runner(&app)?;
    runner.copy_objects(sources, &destination)
}

#[tauri::command]
pub fn move_objects(
    app: tauri::AppHandle,
    sources: Vec<String>,
    destination: String,
) -> Result<OperationProgress, String> {
    let runner = create_runner(&app)?;
    runner.move_objects(sources, &destination)
}

#[tauri::command]
pub fn create_folder(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let runner = create_runner(&app)?;
    runner.create_folder(&path)
}

#[derive(Debug, Deserialize)]
pub struct DownloadSource {
    pub path: String,
    pub is_dir: bool,
}

#[tauri::command]
pub fn download_objects(
    app: tauri::AppHandle,
    sources: Vec<DownloadSource>,
    destination: String,
) -> Result<OperationProgress, String> {
    let runner = create_runner(&app)?;
    let sources: Vec<(String, bool)> = sources.into_iter().map(|s| (s.path, s.is_dir)).collect();
    runner.download_objects(sources, &destination)
}

#[tauri::command]
pub fn upload_objects(
    app: tauri::AppHandle,
    sources: Vec<String>,
    destination: String,
) -> Result<OperationProgress, String> {
    let runner = create_runner(&app)?;
    runner.upload_objects(sources, &destination)
}

#[derive(Debug, Serialize)]
pub struct ObjectMetadata {
    pub key: String,
    pub size: Option<i64>,
    pub last_modified: Option<String>,
    pub storage_class: Option<String>,
    pub etag: Option<String>,
    pub content_type: Option<String>,
}

#[tauri::command]
pub fn get_object_metadata(app: tauri::AppHandle, path: String) -> Result<ObjectMetadata, String> {
    // For now, return basic info from list
    let runner = create_runner(&app)?;
    let objects = runner.list_objects(&path)?;

    if let Some(obj) = objects.first() {
        Ok(ObjectMetadata {
            key: obj.key.clone(),
            size: obj.size,
            last_modified: obj.last_modified.clone(),
            storage_class: obj.storage_class.clone(),
            etag: obj.etag.clone(),
            content_type: None,
        })
    } else {
        Err("Object not found".to_string())
    }
}

// ============ Settings ============

#[tauri::command]
pub fn get_settings(app: tauri::AppHandle) -> Result<Settings, String> {
    let app_data_dir = get_app_data_dir(&app)?;
    Settings::load(&app_data_dir)
}

#[tauri::command]
pub fn save_settings(app: tauri::AppHandle, settings: Settings) -> Result<(), String> {
    let app_data_dir = get_app_data_dir(&app)?;
    settings.save(&app_data_dir)?;
    info!("Settings saved");
    Ok(())
}

// ============ Logging ============

#[tauri::command]
pub fn get_logs(lines: Option<usize>) -> Result<Vec<String>, String> {
    logging::read_logs(lines)
}

#[tauri::command]
pub fn clear_logs() -> Result<(), String> {
    logging::clear()
}

#[tauri::command]
pub fn get_log_path() -> Result<Option<String>, String> {
    Ok(logging::get_log_path().map(|p| p.to_string_lossy().to_string()))
}

// ============ Progress ============

#[tauri::command]
pub fn cancel_operation(operation_id: String) -> Result<(), String> {
    s5cmd::cancel_operation(&operation_id)
}

// ============ Utility ============

#[tauri::command]
pub fn get_s5cmd_version(app: tauri::AppHandle) -> Result<String, String> {
    let settings = get_settings(&app)?;
    s5cmd::get_s5cmd_version(settings.s5cmd_path.as_deref())
}
