import React, { useState, useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
import { open as openDialog } from '@tauri-apps/api/dialog';
import toast from 'react-hot-toast';
import type { Settings } from '../types';

export const SettingsDialog: React.FC = () => {
  const {
    settings,
    loadSettings,
    updateSettings,
    isSettingsOpen,
    setSettingsOpen,
  } = useAppStore();

  const [localSettings, setLocalSettings] = useState<Settings | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'advanced'>('general');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isSettingsOpen && !settings) {
      loadSettings();
    }
  }, [isSettingsOpen, settings, loadSettings]);

  useEffect(() => {
    if (settings) {
      setLocalSettings({ ...settings });
    }
  }, [settings]);

  if (!isSettingsOpen) {
    return null;
  }

  const handleSave = async () => {
    if (!localSettings) return;

    setSaving(true);
    try {
      await updateSettings(localSettings);
      toast.success('Settings saved');
      setSettingsOpen(false);
    } catch (error) {
      toast.error(`Failed to save settings: ${error}`);
    } finally {
      setSaving(false);
    }
  };

  const handleBrowseDownloadLocation = async () => {
    const path = await openDialog({
      directory: true,
      title: 'Select default download location',
    });
    if (path && typeof path === 'string' && localSettings) {
      setLocalSettings({ ...localSettings, download_location: path });
    }
  };

  const handleBrowseS5cmdPath = async () => {
    const path = await openDialog({
      title: 'Select s5cmd binary',
      filters: [{ name: 'Executable', extensions: ['exe', ''] }],
    });
    if (path && typeof path === 'string' && localSettings) {
      setLocalSettings({ ...localSettings, s5cmd_path: path });
    }
  };

  if (!localSettings) {
    return (
      <dialog open className="settings-dialog">
        <p>Loading settings...</p>
      </dialog>
    );
  }

  return (
    <dialog open className="settings-dialog">
      <div className="settings-header">
        <h2>Settings</h2>
        <button className="close-button" onClick={() => setSettingsOpen(false)}>
          ×
        </button>
      </div>

      <div className="settings-tabs">
        <button
          className={activeTab === 'general' ? 'active' : ''}
          onClick={() => setActiveTab('general')}
        >
          General
        </button>
        <button
          className={activeTab === 'advanced' ? 'active' : ''}
          onClick={() => setActiveTab('advanced')}
        >
          Advanced
        </button>
      </div>

      <div className="settings-content">
        {activeTab === 'general' && (
          <div className="settings-panel">
            <div className="form-group">
              <label>Default Download Location</label>
              <div className="input-with-button">
                <input
                  type="text"
                  value={localSettings.download_location}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      download_location: e.target.value,
                    })
                  }
                />
                <button onClick={handleBrowseDownloadLocation}>Browse</button>
              </div>
            </div>

            <div className="form-group">
              <label>Concurrent Operations (1-50)</label>
              <input
                type="number"
                min={1}
                max={50}
                value={localSettings.concurrent_operations}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    concurrent_operations: parseInt(e.target.value) || 10,
                  })
                }
              />
            </div>

            <div className="form-group checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={localSettings.show_hidden_files}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      show_hidden_files: e.target.checked,
                    })
                  }
                />
                Show hidden files (. prefixed)
              </label>
            </div>

            <div className="form-group checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={localSettings.confirm_before_delete}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      confirm_before_delete: e.target.checked,
                    })
                  }
                />
                Confirm before delete
              </label>
            </div>

            <div className="form-group checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={localSettings.single_click_to_open}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      single_click_to_open: e.target.checked,
                    })
                  }
                />
                Single click to open (instead of double click)
              </label>
            </div>
          </div>
        )}

        {activeTab === 'advanced' && (
          <div className="settings-panel">
            <div className="form-group">
              <label>s5cmd Binary Path</label>
              <div className="input-with-button">
                <input
                  type="text"
                  value={localSettings.s5cmd_path || ''}
                  placeholder="Leave empty to use system PATH"
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      s5cmd_path: e.target.value || undefined,
                    })
                  }
                />
                <button onClick={handleBrowseS5cmdPath}>Browse</button>
              </div>
              <small>For custom s5cmd builds or non-standard locations</small>
            </div>

            <div className="form-group">
              <label>Max Retries (1-10)</label>
              <input
                type="number"
                min={1}
                max={10}
                value={localSettings.max_retries}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    max_retries: parseInt(e.target.value) || 3,
                  })
                }
              />
            </div>

            <div className="form-group">
              <label>Timeout (seconds)</label>
              <input
                type="number"
                min={30}
                max={3600}
                value={localSettings.timeout_seconds}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    timeout_seconds: parseInt(e.target.value) || 300,
                  })
                }
              />
            </div>

            <div className="form-group">
              <label>Log Level</label>
              <select
                value={localSettings.log_level}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    log_level: e.target.value as Settings['log_level'],
                  })
                }
              >
                <option value="Error">Error</option>
                <option value="Warning">Warning</option>
                <option value="Info">Info</option>
                <option value="Debug">Debug</option>
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="dialog-actions">
        <button onClick={() => setSettingsOpen(false)}>Cancel</button>
        <button onClick={handleSave} disabled={saving} className="primary">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </dialog>
  );
};

export default SettingsDialog;
