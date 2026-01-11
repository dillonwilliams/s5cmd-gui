use keyring::Entry;
use log::{debug, error, warn};

const SERVICE_NAME: &str = "s5cmd-gui";

pub fn get_secret(profile_id: &str) -> Result<Option<String>, String> {
    let entry = Entry::new(SERVICE_NAME, profile_id)
        .map_err(|e| format!("Failed to access keychain: {}", e))?;

    match entry.get_password() {
        Ok(secret) => {
            debug!("Retrieved secret for profile: {}", profile_id);
            Ok(Some(secret))
        }
        Err(keyring::Error::NoEntry) => {
            debug!("No secret found for profile: {}", profile_id);
            Ok(None)
        }
        Err(e) => {
            error!("Failed to get secret for profile {}: {}", profile_id, e);
            Err(format!("Failed to get secret: {}", e))
        }
    }
}

pub fn set_secret(profile_id: &str, secret: &str) -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, profile_id)
        .map_err(|e| format!("Failed to access keychain: {}", e))?;

    entry
        .set_password(secret)
        .map_err(|e| format!("Failed to store secret: {}", e))?;

    debug!("Stored secret for profile: {}", profile_id);
    Ok(())
}

pub fn delete_secret(profile_id: &str) -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, profile_id)
        .map_err(|e| format!("Failed to access keychain: {}", e))?;

    match entry.delete_credential() {
        Ok(()) => {
            debug!("Deleted secret for profile: {}", profile_id);
            Ok(())
        }
        Err(keyring::Error::NoEntry) => {
            warn!("No secret to delete for profile: {}", profile_id);
            Ok(())
        }
        Err(e) => {
            error!("Failed to delete secret for profile {}: {}", profile_id, e);
            Err(format!("Failed to delete secret: {}", e))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_secret_operations() {
        let profile_id = "test-profile-keychain";
        let secret = "test-secret-12345";

        // Set secret
        set_secret(profile_id, secret).expect("Failed to set secret");

        // Get secret
        let retrieved = get_secret(profile_id)
            .expect("Failed to get secret")
            .expect("Secret not found");
        assert_eq!(retrieved, secret);

        // Delete secret
        delete_secret(profile_id).expect("Failed to delete secret");

        // Verify deletion
        let deleted = get_secret(profile_id).expect("Failed to check secret");
        assert!(deleted.is_none());
    }
}
