// Profile types
export interface Profile {
  id: string;
  name: string;
  auth_type: 'access_key' | 'sso';
  endpoint_url?: string;
  region: string;
  is_active: boolean;
  // SSO fields
  sso_start_url?: string;
  sso_region?: string;
  sso_account_id?: string;
  sso_role_name?: string;
  // Access Key fields
  access_key_id?: string;
  has_session_token: boolean;
}

export interface SaveProfileRequest {
  id?: string;
  name: string;
  auth_type: 'access_key' | 'sso';
  region: string;
  endpoint_url?: string;
  // Access Key fields
  access_key_id?: string;
  secret_access_key?: string;
  session_token?: string;
  // SSO fields
  sso_start_url?: string;
  sso_region?: string;
  sso_account_id?: string;
  sso_role_name?: string;
}

// S3 types
export interface S3Object {
  key: string;
  type: string;
  size?: number;
  storage_class?: string;
  etag?: string;
  last_modified?: string;
}

export interface S3Bucket {
  name: string;
  creation_date?: string;
}

// Operation types
export interface OperationProgress {
  id: string;
  operation_type: string;
  total_files: number;
  completed_files: number;
  total_bytes: number;
  transferred_bytes: number;
  current_file?: string;
  status: 'Running' | 'Paused' | 'Completed' | 'Failed' | 'Cancelled';
  error?: string;
  started_at: string;
}

export interface DownloadSource {
  path: string;
  is_dir: boolean;
}

// Settings types
export interface Settings {
  // General
  download_location: string;
  concurrent_operations: number;
  show_hidden_files: boolean;
  confirm_before_delete: boolean;
  single_click_to_open: boolean;
  // Advanced
  s5cmd_path?: string;
  max_retries: number;
  timeout_seconds: number;
  log_level: 'Error' | 'Warning' | 'Info' | 'Debug';
}

// Object metadata
export interface ObjectMetadata {
  key: string;
  size?: number;
  last_modified?: string;
  storage_class?: string;
  etag?: string;
  content_type?: string;
}

// Clipboard for copy/cut operations
export interface ClipboardItem {
  path: string;
  name: string;
  isDir: boolean;
}

export interface ClipboardState {
  items: ClipboardItem[];
  operation: 'copy' | 'cut' | null;
  sourceBucket?: string;
}

// Sort state
export type SortColumn = 'name' | 'size' | 'modified' | 'storage_class';
export type SortDirection = 'asc' | 'desc';

export interface SortState {
  column: SortColumn;
  direction: SortDirection;
}

// Navigation history
export interface NavigationEntry {
  bucket: string;
  path: string;
}
