import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { setChonkyDefaults } from '@aperturerobotics/chonky';
import { ChonkyIconFA } from '@aperturerobotics/chonky-icon-fontawesome';
import { Toaster } from 'react-hot-toast';

import { useAppStore } from './stores/appStore';
import { ProfileSelector } from './components/ProfileSelector';
import { BucketSelector } from './components/BucketSelector';
import { SearchBar } from './components/SearchBar';
import { S3Browser } from './components/S3Browser';
import { ProgressDialog } from './components/ProgressDialog';
import { SettingsDialog } from './components/SettingsDialog';
import { LogsDialog } from './components/LogsDialog';

import './styles.css';

// Set Chonky defaults
setChonkyDefaults({ iconComponent: ChonkyIconFA });

const App: React.FC = () => {
  const {
    activeProfile,
    selectedBucket,
    loadProfiles,
    loadSettings,
    goBack,
    goForward,
    goUp,
    historyIndex,
    navigationHistory,
    currentPath,
    setSettingsOpen,
    setLogsDialogOpen,
    error,
    clearError,
  } = useAppStore();

  useEffect(() => {
    loadProfiles();
    loadSettings();
  }, [loadProfiles, loadSettings]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Backspace to go up (when not in an input)
      if (
        e.key === 'Backspace' &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        goUp();
      }

      // Alt+Left for back
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        goBack();
      }

      // Alt+Right for forward
      if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        goForward();
      }

      // Ctrl+, for settings
      if (e.ctrlKey && e.key === ',') {
        e.preventDefault();
        setSettingsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goBack, goForward, goUp, setSettingsOpen]);

  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < navigationHistory.length - 1;
  const canGoUp =
    selectedBucket && currentPath !== `s3://${selectedBucket.name}/`;

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <ProfileSelector />
          <BucketSelector />
        </div>

        <div className="header-center">
          <div className="navigation-buttons">
            <button
              className="nav-button"
              onClick={goBack}
              disabled={!canGoBack}
              title="Back (Alt+Left)"
            >
              ←
            </button>
            <button
              className="nav-button"
              onClick={goForward}
              disabled={!canGoForward}
              title="Forward (Alt+Right)"
            >
              →
            </button>
            <button
              className="nav-button"
              onClick={goUp}
              disabled={!canGoUp}
              title="Up (Backspace)"
            >
              ↑
            </button>
          </div>

          <div className="address-bar">
            <span className="address-text" title={currentPath}>
              {currentPath || 'No location selected'}
            </span>
          </div>
        </div>

        <div className="header-right">
          <SearchBar />

          <button
            className="icon-button"
            onClick={() => setLogsDialogOpen(true)}
            title="View Logs"
          >
            📋
          </button>

          <button
            className="icon-button"
            onClick={() => setSettingsOpen(true)}
            title="Settings (Ctrl+,)"
          >
            ⚙️
          </button>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={clearError}>×</button>
        </div>
      )}

      {/* Main content */}
      <main className="app-main">
        {activeProfile && selectedBucket ? (
          <S3Browser />
        ) : (
          <div className="welcome-screen">
            <h1>S5cmd GUI</h1>
            <p>Fast S3 file browser powered by s5cmd</p>

            {!activeProfile ? (
              <div className="welcome-message">
                <p>Get started by selecting or creating a profile.</p>
                <p>
                  Click the profile selector in the top left corner to add your
                  AWS credentials or configure SSO.
                </p>
              </div>
            ) : (
              <div className="welcome-message">
                <p>Select a bucket from the dropdown to start browsing.</p>
              </div>
            )}

            <div className="welcome-features">
              <h3>Features</h3>
              <ul>
                <li>Blazing fast transfers with s5cmd</li>
                <li>AWS SSO support</li>
                <li>Secure credential storage</li>
                <li>S3-compatible endpoints (MinIO, etc.)</li>
                <li>Drag and drop uploads</li>
                <li>Batch operations</li>
              </ul>
            </div>
          </div>
        )}
      </main>

      {/* Dialogs */}
      <ProgressDialog />
      <SettingsDialog />
      <LogsDialog />

      {/* Toast notifications */}
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#333',
            color: '#fff',
          },
          success: {
            iconTheme: {
              primary: '#4caf50',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#f44336',
              secondary: '#fff',
            },
          },
        }}
      />
    </div>
  );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);
