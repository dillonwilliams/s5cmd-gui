import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  FileBrowser,
  FileList,
  FileNavbar,
  FileToolbar,
  FileContextMenu,
  FileArray,
  FileData,
  ChonkyActions,
  ChonkyFileActionData,
  defineFileAction,
  ChonkyIconName,
  FileAction,
} from '@aperturerobotics/chonky';
import { open as openDialog, confirm, message } from '@tauri-apps/api/dialog';
import { useAppStore } from '../stores/appStore';
import * as api from '../api';
import { formatBytes, getObjectName, buildS3Path } from '../api';
import { StatusBar } from './StatusBar';
import toast from 'react-hot-toast';
import type { S3Object, ClipboardItem } from '../types';
import { formatDistanceToNow } from 'date-fns';

// Custom file actions
const RefreshAction = defineFileAction({
  id: 'refresh',
  button: {
    name: 'Refresh',
    toolbar: true,
    icon: ChonkyIconName.loading,
  },
  hotkeys: ['f5'],
});

const UploadFilesAction = defineFileAction({
  id: 'upload_files',
  button: {
    name: 'Upload Files',
    toolbar: true,
    icon: ChonkyIconName.upload,
  },
});

const UploadFolderAction = defineFileAction({
  id: 'upload_folder',
  button: {
    name: 'Upload Folder',
    toolbar: true,
    icon: ChonkyIconName.folderOpen,
  },
});

const NewFolderAction = defineFileAction({
  id: 'new_folder',
  button: {
    name: 'New Folder',
    toolbar: true,
    icon: ChonkyIconName.folderCreate,
  },
  hotkeys: ['ctrl+shift+n'],
});

const CopyS3UriAction = defineFileAction({
  id: 'copy_s3_uri',
  requiresSelection: true,
  button: {
    name: 'Copy S3 URI',
    contextMenu: true,
    icon: ChonkyIconName.copy,
  },
});

const PropertiesAction = defineFileAction({
  id: 'properties',
  requiresSelection: true,
  button: {
    name: 'Properties',
    contextMenu: true,
    icon: ChonkyIconName.info,
  },
});

export const S3Browser: React.FC = () => {
  const {
    selectedBucket,
    currentPath,
    navigate,
    goUp,
    clipboard,
    setClipboard,
    clearClipboard,
    sort,
    setSort,
    searchQuery,
    settings,
    addOperation,
    setError,
  } = useAppStore();

  const [objects, setObjects] = useState<S3Object[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<FileData[]>([]);

  // Load objects when path changes
  useEffect(() => {
    if (currentPath) {
      loadObjects();
    }
  }, [currentPath]);

  const loadObjects = async () => {
    if (!currentPath) return;

    setLoading(true);
    try {
      const result = await api.listObjects(currentPath);
      setObjects(result);
    } catch (error) {
      toast.error(`Failed to load objects: ${error}`);
      setError(`Failed to load objects: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  // Convert S3 objects to Chonky files
  const files: FileArray = useMemo(() => {
    if (!selectedBucket) return [];

    let filteredObjects = objects;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const wildcardRegex = new RegExp(
        '^' + query.replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
        'i'
      );

      filteredObjects = objects.filter((obj) => {
        const name = getObjectName(obj.key).toLowerCase();
        return wildcardRegex.test(name) || name.includes(query);
      });
    }

    // Apply hidden files filter
    if (settings && !settings.show_hidden_files) {
      filteredObjects = filteredObjects.filter((obj) => {
        const name = getObjectName(obj.key);
        return !name.startsWith('.');
      });
    }

    // Sort objects
    const sorted = [...filteredObjects].sort((a, b) => {
      const aName = getObjectName(a.key);
      const bName = getObjectName(b.key);
      const aIsDir = a.type === 'directory';
      const bIsDir = b.type === 'directory';

      // Directories first
      if (aIsDir && !bIsDir) return -1;
      if (!aIsDir && bIsDir) return 1;

      let comparison = 0;
      switch (sort.column) {
        case 'name':
          comparison = aName.localeCompare(bName);
          break;
        case 'size':
          comparison = (a.size || 0) - (b.size || 0);
          break;
        case 'modified':
          comparison = (a.last_modified || '').localeCompare(b.last_modified || '');
          break;
        case 'storage_class':
          comparison = (a.storage_class || '').localeCompare(b.storage_class || '');
          break;
      }

      return sort.direction === 'asc' ? comparison : -comparison;
    });

    return sorted.map((obj): FileData => {
      const isDir = obj.type === 'directory';
      const name = getObjectName(obj.key);

      return {
        id: obj.key,
        name,
        isDir,
        size: obj.size,
        modDate: obj.last_modified ? new Date(obj.last_modified) : undefined,
        // Custom properties for display
        ext: isDir ? undefined : name.split('.').pop(),
        thumbnailUrl: undefined,
        // Extra data for context menu
        color: undefined,
        icon: undefined,
        // Custom metadata
        storageClass: obj.storage_class,
      } as FileData & { storageClass?: string };
    });
  }, [objects, searchQuery, sort, settings, selectedBucket]);

  // Build folder chain for breadcrumbs
  const folderChain: FileArray = useMemo(() => {
    if (!selectedBucket || !currentPath) return [];

    const bucketPrefix = `s3://${selectedBucket.name}/`;
    const chain: FileData[] = [
      {
        id: bucketPrefix,
        name: selectedBucket.name,
        isDir: true,
      },
    ];

    const relativePath = currentPath.replace(bucketPrefix, '');
    const parts = relativePath.split('/').filter(Boolean);

    let accumulated = bucketPrefix;
    for (const part of parts) {
      accumulated += part + '/';
      chain.push({
        id: accumulated,
        name: part,
        isDir: true,
      });
    }

    return chain;
  }, [selectedBucket, currentPath]);

  // Handle file actions
  const handleFileAction = useCallback(
    async (data: ChonkyFileActionData) => {
      const { id: actionId, payload, state } = data;
      const selected = state.selectedFilesForAction || [];

      switch (actionId) {
        case ChonkyActions.OpenFiles.id: {
          const targetFile = payload?.targetFile;
          if (targetFile?.isDir) {
            navigate(targetFile.id);
          }
          break;
        }

        case ChonkyActions.DeleteFiles.id: {
          if (selected.length === 0) return;

          const confirmDelete =
            !settings?.confirm_before_delete ||
            (await confirm(
              `Delete ${selected.length} item(s)? This cannot be undone.`,
              { title: 'Confirm Delete', type: 'warning' }
            ));

          if (confirmDelete) {
            try {
              const paths = selected.map((f) => f.id);
              const operation = await api.deleteObjects(paths);
              addOperation(operation);
              toast.success(`Deleting ${selected.length} item(s)...`);
              setTimeout(loadObjects, 1000);
            } catch (error) {
              toast.error(`Delete failed: ${error}`);
            }
          }
          break;
        }

        case ChonkyActions.DownloadFiles.id: {
          if (selected.length === 0) return;

          const destination = await openDialog({
            directory: true,
            title: 'Select download destination',
            defaultPath: settings?.download_location,
          });

          if (destination && typeof destination === 'string') {
            try {
              const sources = selected.map((f) => ({
                path: f.id,
                is_dir: f.isDir || false,
              }));
              const operation = await api.downloadObjects(sources, destination);
              addOperation(operation);
              toast.success(`Downloading ${selected.length} item(s)...`);
            } catch (error) {
              toast.error(`Download failed: ${error}`);
            }
          }
          break;
        }

        case ChonkyActions.CopyFiles.id: {
          if (selected.length === 0) return;

          const items: ClipboardItem[] = selected.map((f) => ({
            path: f.id,
            name: f.name,
            isDir: f.isDir || false,
          }));

          setClipboard({
            items,
            operation: 'copy',
            sourceBucket: selectedBucket?.name,
          });

          toast.success(`Copied ${items.length} item(s) to clipboard`);
          break;
        }

        case ChonkyActions.CutFiles.id: {
          if (selected.length === 0) return;

          const items: ClipboardItem[] = selected.map((f) => ({
            path: f.id,
            name: f.name,
            isDir: f.isDir || false,
          }));

          setClipboard({
            items,
            operation: 'cut',
            sourceBucket: selectedBucket?.name,
          });

          toast.success(`Cut ${items.length} item(s) to clipboard`);
          break;
        }

        case ChonkyActions.PasteFiles.id: {
          if (clipboard.items.length === 0 || !clipboard.operation) {
            toast.error('Nothing to paste');
            return;
          }

          try {
            const sources = clipboard.items.map((item) => item.path);

            if (clipboard.operation === 'copy') {
              const operation = await api.copyObjects(sources, currentPath);
              addOperation(operation);
              toast.success(`Copying ${sources.length} item(s)...`);
            } else {
              const operation = await api.moveObjects(sources, currentPath);
              addOperation(operation);
              toast.success(`Moving ${sources.length} item(s)...`);
              clearClipboard();
            }

            setTimeout(loadObjects, 1000);
          } catch (error) {
            toast.error(`Paste failed: ${error}`);
          }
          break;
        }

        case 'upload_files': {
          const filePaths = await openDialog({
            multiple: true,
            title: 'Select files to upload',
          });

          if (filePaths) {
            const paths = Array.isArray(filePaths) ? filePaths : [filePaths];
            try {
              const operation = await api.uploadObjects(paths, currentPath);
              addOperation(operation);
              toast.success(`Uploading ${paths.length} file(s)...`);
              setTimeout(loadObjects, 1000);
            } catch (error) {
              toast.error(`Upload failed: ${error}`);
            }
          }
          break;
        }

        case 'upload_folder': {
          const folderPath = await openDialog({
            directory: true,
            title: 'Select folder to upload',
          });

          if (folderPath && typeof folderPath === 'string') {
            try {
              const operation = await api.uploadObjects([folderPath], currentPath);
              addOperation(operation);
              toast.success('Uploading folder...');
              setTimeout(loadObjects, 1000);
            } catch (error) {
              toast.error(`Upload failed: ${error}`);
            }
          }
          break;
        }

        case 'new_folder': {
          const folderName = window.prompt('Enter folder name:');
          if (folderName) {
            try {
              const folderPath = currentPath + folderName + '/';
              await api.createFolder(folderPath);
              toast.success('Folder created');
              loadObjects();
            } catch (error) {
              toast.error(`Failed to create folder: ${error}`);
            }
          }
          break;
        }

        case 'refresh': {
          loadObjects();
          break;
        }

        case 'copy_s3_uri': {
          if (selected.length > 0) {
            const uris = selected.map((f) => f.id).join('\n');
            await navigator.clipboard.writeText(uris);
            toast.success('S3 URI copied to clipboard');
          }
          break;
        }

        case 'properties': {
          if (selected.length === 1) {
            const file = selected[0];
            try {
              const metadata = await api.getObjectMetadata(file.id);
              await message(
                `Key: ${metadata.key}\n` +
                  `Size: ${formatBytes(metadata.size)}\n` +
                  `Last Modified: ${metadata.last_modified || 'N/A'}\n` +
                  `Storage Class: ${metadata.storage_class || 'N/A'}\n` +
                  `ETag: ${metadata.etag || 'N/A'}`,
                { title: 'Properties', type: 'info' }
              );
            } catch (error) {
              toast.error(`Failed to get properties: ${error}`);
            }
          }
          break;
        }

        case ChonkyActions.ChangeSelection.id: {
          setSelectedFiles(selected);
          break;
        }

        case ChonkyActions.MoveFiles.id: {
          // Handle drag and drop move within the browser
          const destination = payload?.destination;
          if (destination?.isDir && selected.length > 0) {
            try {
              const sources = selected.map((f) => f.id);
              const operation = await api.moveObjects(sources, destination.id);
              addOperation(operation);
              toast.success(`Moving ${sources.length} item(s)...`);
              setTimeout(loadObjects, 1000);
            } catch (error) {
              toast.error(`Move failed: ${error}`);
            }
          }
          break;
        }

        case ChonkyActions.SortFilesByName.id:
          setSort({ column: 'name', direction: sort.column === 'name' && sort.direction === 'asc' ? 'desc' : 'asc' });
          break;

        case ChonkyActions.SortFilesBySize.id:
          setSort({ column: 'size', direction: sort.column === 'size' && sort.direction === 'asc' ? 'desc' : 'asc' });
          break;

        case ChonkyActions.SortFilesByDate.id:
          setSort({ column: 'modified', direction: sort.column === 'modified' && sort.direction === 'asc' ? 'desc' : 'asc' });
          break;
      }
    },
    [
      currentPath,
      selectedBucket,
      clipboard,
      settings,
      sort,
      navigate,
      setClipboard,
      clearClipboard,
      addOperation,
      setSort,
    ]
  );

  // Define available file actions
  const fileActions: FileAction[] = useMemo(
    () => [
      ChonkyActions.DeleteFiles,
      ChonkyActions.DownloadFiles,
      ChonkyActions.CopyFiles,
      ChonkyActions.CutFiles,
      ChonkyActions.PasteFiles,
      ChonkyActions.SelectAllFiles,
      ChonkyActions.ClearSelection,
      ChonkyActions.SortFilesByName,
      ChonkyActions.SortFilesBySize,
      ChonkyActions.SortFilesByDate,
      ChonkyActions.ToggleHiddenFiles,
      ChonkyActions.EnableListView,
      ChonkyActions.EnableGridView,
      RefreshAction,
      UploadFilesAction,
      UploadFolderAction,
      NewFolderAction,
      CopyS3UriAction,
      PropertiesAction,
    ],
    []
  );

  if (!selectedBucket) {
    return (
      <div className="s3-browser-empty">
        <p>Select a bucket to browse</p>
      </div>
    );
  }

  const s3Objects: S3Object[] = selectedFiles.map((f) => ({
    key: f.id,
    type: f.isDir ? 'directory' : 'file',
    size: f.size,
    storage_class: (f as FileData & { storageClass?: string }).storageClass,
    last_modified: f.modDate?.toISOString(),
  }));

  return (
    <div className="s3-browser">
      <div className="s3-browser-content">
        <FileBrowser
          files={files}
          folderChain={folderChain}
          fileActions={fileActions}
          onFileAction={handleFileAction}
          defaultFileViewActionId={ChonkyActions.EnableListView.id}
          disableDragAndDropProvider={false}
          clearSelectionOnOutsideClick={true}
        >
          <FileNavbar />
          <FileToolbar />
          <FileList />
          <FileContextMenu />
        </FileBrowser>
      </div>

      <StatusBar files={objects} selectedFiles={s3Objects} />
    </div>
  );
};

export default S3Browser;
