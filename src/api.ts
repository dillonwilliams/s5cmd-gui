import { invoke } from '@tauri-apps/api/tauri';
import type {
  Profile,
  SaveProfileRequest,
  S3Object,
  S3Bucket,
  OperationProgress,
  DownloadSource,
  Settings,
  ObjectMetadata,
} from './types';

// ============ Profile Management ============

export async function getProfiles(): Promise<Profile[]> {
  return invoke('get_profiles');
}

export async function saveProfile(request: SaveProfileRequest): Promise<string> {
  return invoke('save_profile', { request });
}

export async function deleteProfile(profileId: string): Promise<void> {
  return invoke('delete_profile', { profileId });
}

export async function setActiveProfile(profileId: string): Promise<void> {
  return invoke('set_active_profile', { profileId });
}

export async function testProfileConnection(profileId: string): Promise<string> {
  return invoke('test_profile_connection', { profileId });
}

// ============ SSO ============

export async function startSsoLogin(profileId: string): Promise<string> {
  return invoke('start_sso_login', { profileId });
}

export async function checkSsoStatus(profileId: string): Promise<string> {
  return invoke('check_sso_status', { profileId });
}

// ============ S3 Operations ============

export async function listBuckets(): Promise<S3Bucket[]> {
  return invoke('list_buckets');
}

export async function listObjects(path: string): Promise<S3Object[]> {
  return invoke('list_objects', { path });
}

export async function deleteObjects(paths: string[]): Promise<OperationProgress> {
  return invoke('delete_objects', { paths });
}

export async function copyObjects(
  sources: string[],
  destination: string
): Promise<OperationProgress> {
  return invoke('copy_objects', { sources, destination });
}

export async function moveObjects(
  sources: string[],
  destination: string
): Promise<OperationProgress> {
  return invoke('move_objects', { sources, destination });
}

export async function createFolder(path: string): Promise<void> {
  return invoke('create_folder', { path });
}

export async function downloadObjects(
  sources: DownloadSource[],
  destination: string
): Promise<OperationProgress> {
  return invoke('download_objects', { sources, destination });
}

export async function uploadObjects(
  sources: string[],
  destination: string
): Promise<OperationProgress> {
  return invoke('upload_objects', { sources, destination });
}

export async function getObjectMetadata(path: string): Promise<ObjectMetadata> {
  return invoke('get_object_metadata', { path });
}

// ============ Settings ============

export async function getSettings(): Promise<Settings> {
  return invoke('get_settings');
}

export async function saveSettings(settings: Settings): Promise<void> {
  return invoke('save_settings', { settings });
}

// ============ Logging ============

export async function getLogs(lines?: number): Promise<string[]> {
  return invoke('get_logs', { lines });
}

export async function clearLogs(): Promise<void> {
  return invoke('clear_logs');
}

export async function getLogPath(): Promise<string | null> {
  return invoke('get_log_path');
}

// ============ Progress ============

export async function cancelOperation(operationId: string): Promise<void> {
  return invoke('cancel_operation', { operationId });
}

// ============ Utility ============

export async function getS5cmdVersion(): Promise<string> {
  return invoke('get_s5cmd_version');
}

// ============ Helpers ============

export function parseS3Path(path: string): { bucket: string; prefix: string } {
  const match = path.match(/^s3:\/\/([^/]+)\/?(.*)$/);
  if (!match) {
    throw new Error(`Invalid S3 path: ${path}`);
  }
  return {
    bucket: match[1],
    prefix: match[2] || '',
  };
}

export function buildS3Path(bucket: string, prefix: string): string {
  if (prefix) {
    return `s3://${bucket}/${prefix}`;
  }
  return `s3://${bucket}/`;
}

export function getObjectName(key: string): string {
  const parts = key.replace(/\/$/, '').split('/');
  return parts[parts.length - 1] || key;
}

export function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined || bytes === null) return '-';
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
