// JSON parsing utilities for s5cmd output

export function fixJsonData(rawJson: string): any {
  if (!rawJson || rawJson.trim() === '') {
    return [];
  }

  // s5cmd outputs JSON lines, one per object
  // We need to parse each line separately
  const lines = rawJson
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');

  const results: any[] = [];

  for (const line of lines) {
    try {
      results.push(JSON.parse(line));
    } catch (e) {
      console.warn('Failed to parse JSON line:', line, e);
    }
  }

  return results;
}

// Format a file size in bytes to a human-readable string
export function formatFileSize(bytes: number | undefined): string {
  if (bytes === undefined || bytes === null) return '-';
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Format a date to a relative time string
export function formatRelativeTime(date: Date | string | undefined): string {
  if (!date) return '-';

  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

  return d.toLocaleDateString();
}

// Validate S3 path format
export function isValidS3Path(path: string): boolean {
  return /^s3:\/\/[a-z0-9][a-z0-9.-]*[a-z0-9](\/.*)?$/.test(path);
}

// Extract bucket name from S3 path
export function extractBucketFromPath(path: string): string | null {
  const match = path.match(/^s3:\/\/([^/]+)/);
  return match ? match[1] : null;
}

// Extract prefix from S3 path
export function extractPrefixFromPath(path: string): string {
  const match = path.match(/^s3:\/\/[^/]+\/(.*)$/);
  return match ? match[1] : '';
}

// Join S3 path segments
export function joinS3Path(...segments: string[]): string {
  return segments
    .map((s) => s.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');
}

// Get parent path
export function getParentPath(path: string): string {
  const withoutTrailing = path.replace(/\/$/, '');
  const lastSlash = withoutTrailing.lastIndexOf('/');
  return lastSlash > 0 ? withoutTrailing.substring(0, lastSlash + 1) : path;
}

// Check if path is a directory (ends with /)
export function isDirectory(path: string): boolean {
  return path.endsWith('/');
}

// Get file extension
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1 || lastDot === 0) return '';
  return filename.substring(lastDot + 1).toLowerCase();
}

// Debounce function
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function (this: any, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, wait);
  };
}

// Throttle function
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return function (this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}
