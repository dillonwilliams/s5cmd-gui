import React, { useState, useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
import * as api from '../api';
import type { SaveProfileRequest } from '../types';
import toast from 'react-hot-toast';

const AWS_REGIONS = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1', 'eu-north-1',
  'ap-northeast-1', 'ap-northeast-2', 'ap-northeast-3',
  'ap-southeast-1', 'ap-southeast-2',
  'ap-south-1', 'sa-east-1', 'ca-central-1',
  'me-south-1', 'af-south-1',
];

interface ProfileDialogProps {
  onClose: () => void;
  editProfileId?: string | null;
}

const ProfileDialog: React.FC<ProfileDialogProps> = ({ onClose, editProfileId }) => {
  const { profiles, loadProfiles } = useAppStore();

  const [name, setName] = useState('');
  const [authType, setAuthType] = useState<'access_key' | 'sso'>('access_key');
  const [region, setRegion] = useState('us-east-1');
  const [endpointUrl, setEndpointUrl] = useState('');

  // Access Key fields
  const [accessKeyId, setAccessKeyId] = useState('');
  const [secretAccessKey, setSecretAccessKey] = useState('');
  const [sessionToken, setSessionToken] = useState('');

  // SSO fields
  const [ssoStartUrl, setSsoStartUrl] = useState('');
  const [ssoRegion, setSsoRegion] = useState('us-east-1');
  const [ssoAccountId, setSsoAccountId] = useState('');
  const [ssoRoleName, setSsoRoleName] = useState('');

  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editProfileId) {
      const profile = profiles.find((p) => p.id === editProfileId);
      if (profile) {
        setName(profile.name);
        setAuthType(profile.auth_type);
        setRegion(profile.region);
        setEndpointUrl(profile.endpoint_url || '');

        if (profile.auth_type === 'access_key') {
          setAccessKeyId(profile.access_key_id || '');
        } else {
          setSsoStartUrl(profile.sso_start_url || '');
          setSsoRegion(profile.sso_region || 'us-east-1');
          setSsoAccountId(profile.sso_account_id || '');
          setSsoRoleName(profile.sso_role_name || '');
        }
      }
    }
  }, [editProfileId, profiles]);

  const handleTestConnection = async () => {
    if (!name || !region) {
      toast.error('Please fill in required fields');
      return;
    }

    setTesting(true);
    try {
      // First save the profile
      const request: SaveProfileRequest = {
        id: editProfileId || undefined,
        name,
        auth_type: authType,
        region,
        endpoint_url: endpointUrl || undefined,
      };

      if (authType === 'access_key') {
        request.access_key_id = accessKeyId;
        request.secret_access_key = secretAccessKey;
        request.session_token = sessionToken || undefined;
      } else {
        request.sso_start_url = ssoStartUrl;
        request.sso_region = ssoRegion;
        request.sso_account_id = ssoAccountId;
        request.sso_role_name = ssoRoleName;
      }

      const profileId = await api.saveProfile(request);
      await api.setActiveProfile(profileId);

      if (authType === 'sso') {
        toast.loading('Starting SSO login...', { id: 'sso-login' });
        await api.startSsoLogin(profileId);
        toast.success('SSO login successful', { id: 'sso-login' });
      }

      const result = await api.testProfileConnection(profileId);
      toast.success(result);
    } catch (error) {
      toast.error(`Connection failed: ${error}`);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!name || !region) {
      toast.error('Please fill in required fields');
      return;
    }

    if (authType === 'access_key' && (!accessKeyId || !secretAccessKey)) {
      toast.error('Access Key ID and Secret Access Key are required');
      return;
    }

    if (authType === 'sso' && (!ssoStartUrl || !ssoAccountId || !ssoRoleName)) {
      toast.error('SSO fields are required');
      return;
    }

    setSaving(true);
    try {
      const request: SaveProfileRequest = {
        id: editProfileId || undefined,
        name,
        auth_type: authType,
        region,
        endpoint_url: endpointUrl || undefined,
      };

      if (authType === 'access_key') {
        request.access_key_id = accessKeyId;
        request.secret_access_key = secretAccessKey;
        request.session_token = sessionToken || undefined;
      } else {
        request.sso_start_url = ssoStartUrl;
        request.sso_region = ssoRegion;
        request.sso_account_id = ssoAccountId;
        request.sso_role_name = ssoRoleName;
      }

      await api.saveProfile(request);
      await loadProfiles();
      toast.success('Profile saved');
      onClose();
    } catch (error) {
      toast.error(`Failed to save profile: ${error}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <dialog open className="profile-dialog">
      <h2>{editProfileId ? 'Edit Profile' : 'Add Profile'}</h2>

      <div className="form-group">
        <label htmlFor="profile-name">Name *</label>
        <input
          id="profile-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My AWS Account"
        />
      </div>

      <div className="form-group">
        <label htmlFor="auth-type">Authentication Type</label>
        <select
          id="auth-type"
          value={authType}
          onChange={(e) => setAuthType(e.target.value as 'access_key' | 'sso')}
        >
          <option value="access_key">Access Key</option>
          <option value="sso">AWS SSO</option>
        </select>
      </div>

      {authType === 'access_key' ? (
        <>
          <div className="form-group">
            <label htmlFor="access-key-id">Access Key ID *</label>
            <input
              id="access-key-id"
              type="text"
              value={accessKeyId}
              onChange={(e) => setAccessKeyId(e.target.value)}
              placeholder="AKIAIOSFODNN7EXAMPLE"
            />
          </div>

          <div className="form-group">
            <label htmlFor="secret-access-key">
              Secret Access Key *{editProfileId && ' (leave empty to keep existing)'}
            </label>
            <input
              id="secret-access-key"
              type="password"
              value={secretAccessKey}
              onChange={(e) => setSecretAccessKey(e.target.value)}
              placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
            />
          </div>

          <div className="form-group">
            <label htmlFor="session-token">Session Token (optional)</label>
            <input
              id="session-token"
              type="password"
              value={sessionToken}
              onChange={(e) => setSessionToken(e.target.value)}
              placeholder="Session token for temporary credentials"
            />
          </div>
        </>
      ) : (
        <>
          <div className="form-group">
            <label htmlFor="sso-start-url">SSO Start URL *</label>
            <input
              id="sso-start-url"
              type="url"
              value={ssoStartUrl}
              onChange={(e) => setSsoStartUrl(e.target.value)}
              placeholder="https://my-sso-portal.awsapps.com/start"
            />
          </div>

          <div className="form-group">
            <label htmlFor="sso-region">SSO Region</label>
            <select
              id="sso-region"
              value={ssoRegion}
              onChange={(e) => setSsoRegion(e.target.value)}
            >
              {AWS_REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="sso-account-id">SSO Account ID *</label>
            <input
              id="sso-account-id"
              type="text"
              value={ssoAccountId}
              onChange={(e) => setSsoAccountId(e.target.value)}
              placeholder="123456789012"
            />
          </div>

          <div className="form-group">
            <label htmlFor="sso-role-name">SSO Role Name *</label>
            <input
              id="sso-role-name"
              type="text"
              value={ssoRoleName}
              onChange={(e) => setSsoRoleName(e.target.value)}
              placeholder="AdministratorAccess"
            />
          </div>
        </>
      )}

      <div className="form-group">
        <label htmlFor="region">Region *</label>
        <select
          id="region"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
        >
          {AWS_REGIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="endpoint-url">Endpoint URL (optional)</label>
        <input
          id="endpoint-url"
          type="url"
          value={endpointUrl}
          onChange={(e) => setEndpointUrl(e.target.value)}
          placeholder="https://s3.custom-endpoint.com"
        />
        <small>For S3-compatible services like MinIO</small>
      </div>

      <div className="dialog-actions">
        <button onClick={onClose} disabled={saving || testing}>
          Cancel
        </button>
        <button onClick={handleTestConnection} disabled={saving || testing}>
          {testing ? 'Testing...' : 'Test Connection'}
        </button>
        <button
          onClick={handleSave}
          disabled={saving || testing}
          className="primary"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </dialog>
  );
};

export const ProfileSelector: React.FC = () => {
  const {
    profiles,
    activeProfile,
    profilesLoading,
    selectProfile,
    loadProfiles,
    isProfileDialogOpen,
    setProfileDialogOpen,
  } = useAppStore();

  const [editProfileId, setEditProfileId] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  useEffect(() => {
    // Keyboard shortcut Ctrl+P for profile switcher
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'p') {
        e.preventDefault();
        setShowDropdown((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleProfileSelect = async (profileId: string) => {
    setShowDropdown(false);
    await selectProfile(profileId);
  };

  const handleEditProfile = (profileId: string) => {
    setEditProfileId(profileId);
    setProfileDialogOpen(true);
    setShowDropdown(false);
  };

  const handleDeleteProfile = async (profileId: string) => {
    if (window.confirm('Are you sure you want to delete this profile?')) {
      try {
        await api.deleteProfile(profileId);
        await loadProfiles();
        toast.success('Profile deleted');
      } catch (error) {
        toast.error(`Failed to delete profile: ${error}`);
      }
    }
    setShowDropdown(false);
  };

  const handleAddProfile = () => {
    setEditProfileId(null);
    setProfileDialogOpen(true);
    setShowDropdown(false);
  };

  return (
    <div className="profile-selector">
      <button
        className="profile-button"
        onClick={() => setShowDropdown(!showDropdown)}
        disabled={profilesLoading}
      >
        {profilesLoading
          ? 'Loading...'
          : activeProfile
          ? activeProfile.name
          : 'Select Profile'}
        <span className="dropdown-arrow">▼</span>
      </button>

      {showDropdown && (
        <div className="profile-dropdown">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className={`profile-item ${profile.is_active ? 'active' : ''}`}
            >
              <span onClick={() => handleProfileSelect(profile.id)}>
                {profile.name}
                <small>{profile.region}</small>
              </span>
              <div className="profile-actions">
                <button
                  onClick={() => handleEditProfile(profile.id)}
                  title="Edit"
                >
                  ✎
                </button>
                <button
                  onClick={() => handleDeleteProfile(profile.id)}
                  title="Delete"
                >
                  ×
                </button>
              </div>
            </div>
          ))}

          <div className="profile-item add-profile" onClick={handleAddProfile}>
            + Add Profile
          </div>

          <div className="profile-shortcut">
            <small>Tip: Press Ctrl+P to quick switch</small>
          </div>
        </div>
      )}

      {isProfileDialogOpen && (
        <ProfileDialog
          onClose={() => {
            setProfileDialogOpen(false);
            setEditProfileId(null);
          }}
          editProfileId={editProfileId}
        />
      )}
    </div>
  );
};

export default ProfileSelector;
