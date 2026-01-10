import React from 'react';
import { useAppStore } from '../stores/appStore';
import { formatBytes } from '../api';
import type { S3Object } from '../types';

interface StatusBarProps {
  files: S3Object[];
  selectedFiles: S3Object[];
}

export const StatusBar: React.FC<StatusBarProps> = ({ files, selectedFiles }) => {
  const { activeProfile, selectedBucket, activeOperations } = useAppStore();

  const selectedSize = selectedFiles.reduce((sum, f) => sum + (f.size || 0), 0);
  const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0);

  const runningOperations = activeOperations.filter(
    (op) => op.status === 'Running'
  );

  return (
    <div className="status-bar">
      <div className="status-left">
        {activeProfile && (
          <span className="connection-status">
            <span className="status-dot connected" />
            {activeProfile.name} ({activeProfile.region})
            {selectedBucket && ` - ${selectedBucket.name}`}
          </span>
        )}
        {!activeProfile && (
          <span className="connection-status">
            <span className="status-dot disconnected" />
            Not connected
          </span>
        )}
      </div>

      <div className="status-center">
        {runningOperations.length > 0 && (
          <span className="operation-status">
            {runningOperations.length} operation(s) in progress
          </span>
        )}
      </div>

      <div className="status-right">
        {selectedFiles.length > 0 && (
          <span className="selection-info">
            {selectedFiles.length} selected ({formatBytes(selectedSize)})
          </span>
        )}
        <span className="total-info">
          {files.length} items ({formatBytes(totalSize)})
        </span>
      </div>
    </div>
  );
};

export default StatusBar;
