import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../stores/appStore';
import * as api from '../api';
import toast from 'react-hot-toast';

export const LogsDialog: React.FC = () => {
  const { isLogsDialogOpen, setLogsDialogOpen } = useAppStore();
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [logPath, setLogPath] = useState<string | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isLogsDialogOpen) {
      loadLogs();
      loadLogPath();
    }
  }, [isLogsDialogOpen]);

  useEffect(() => {
    // Auto-scroll to bottom when logs update
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const logLines = await api.getLogs(500);
      setLogs(logLines);
    } catch (error) {
      toast.error(`Failed to load logs: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const loadLogPath = async () => {
    try {
      const path = await api.getLogPath();
      setLogPath(path);
    } catch (error) {
      console.error('Failed to get log path:', error);
    }
  };

  const handleClearLogs = async () => {
    if (window.confirm('Are you sure you want to clear all logs?')) {
      try {
        await api.clearLogs();
        setLogs([]);
        toast.success('Logs cleared');
      } catch (error) {
        toast.error(`Failed to clear logs: ${error}`);
      }
    }
  };

  const handleExportLogs = () => {
    const content = logs.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `s5cmd-gui-logs-${new Date().toISOString().split('T')[0]}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isLogsDialogOpen) {
    return null;
  }

  return (
    <dialog open className="logs-dialog">
      <div className="logs-header">
        <h2>Application Logs</h2>
        <button className="close-button" onClick={() => setLogsDialogOpen(false)}>
          ×
        </button>
      </div>

      {logPath && (
        <div className="log-path">
          <small>Log file: {logPath}</small>
        </div>
      )}

      <div className="logs-content">
        {loading ? (
          <div className="logs-loading">Loading logs...</div>
        ) : logs.length === 0 ? (
          <div className="logs-empty">No logs available</div>
        ) : (
          <div className="logs-list">
            {logs.map((line, index) => (
              <div
                key={index}
                className={`log-line ${
                  line.includes('ERROR')
                    ? 'error'
                    : line.includes('WARN')
                    ? 'warning'
                    : line.includes('DEBUG')
                    ? 'debug'
                    : ''
                }`}
              >
                {line}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>

      <div className="dialog-actions">
        <button onClick={handleClearLogs}>Clear Logs</button>
        <button onClick={handleExportLogs}>Export Logs</button>
        <button onClick={loadLogs} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
        <button onClick={() => setLogsDialogOpen(false)} className="primary">
          Close
        </button>
      </div>
    </dialog>
  );
};

export default LogsDialog;
