import React from 'react';
import { useAppStore } from '../stores/appStore';
import { cancelOperation } from '../api';
import { formatBytes } from '../api';
import toast from 'react-hot-toast';

export const ProgressDialog: React.FC = () => {
  const { activeOperations, removeOperation } = useAppStore();

  const handleCancel = async (operationId: string) => {
    try {
      await cancelOperation(operationId);
      toast.success('Operation cancelled');
    } catch (error) {
      toast.error(`Failed to cancel: ${error}`);
    }
  };

  const handleDismiss = (operationId: string) => {
    removeOperation(operationId);
  };

  if (activeOperations.length === 0) {
    return null;
  }

  return (
    <div className="progress-dialog">
      <div className="progress-header">
        <h3>Operations</h3>
        <span className="operation-count">{activeOperations.length}</span>
      </div>

      <div className="progress-list">
        {activeOperations.map((op) => {
          const progress =
            op.total_files > 0
              ? Math.round((op.completed_files / op.total_files) * 100)
              : 0;

          return (
            <div key={op.id} className="progress-item">
              <div className="progress-item-header">
                <span className="operation-type">{op.operation_type}</span>
                <span className={`operation-status ${op.status.toLowerCase()}`}>
                  {op.status}
                </span>
              </div>

              <div className="progress-bar-container">
                <div
                  className="progress-bar"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="progress-info">
                <span>
                  {op.completed_files} / {op.total_files} files ({progress}%)
                </span>
                {op.current_file && (
                  <span className="current-file" title={op.current_file}>
                    {op.current_file.split('/').pop()}
                  </span>
                )}
              </div>

              {op.transferred_bytes > 0 && (
                <div className="transfer-info">
                  <span>
                    {formatBytes(op.transferred_bytes)} / {formatBytes(op.total_bytes)}
                  </span>
                </div>
              )}

              {op.error && (
                <div className="progress-error">{op.error}</div>
              )}

              <div className="progress-actions">
                {op.status === 'Running' && (
                  <button onClick={() => handleCancel(op.id)}>Cancel</button>
                )}
                {(op.status === 'Completed' ||
                  op.status === 'Failed' ||
                  op.status === 'Cancelled') && (
                  <button onClick={() => handleDismiss(op.id)}>Dismiss</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProgressDialog;
