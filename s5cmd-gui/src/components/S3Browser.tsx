import React, { useEffect, useState } from 'react';
import { FileBrowser, FileList, FileArray, FileToolbar, FileData, ChonkyActions, ChonkyFileActionData } from '@aperturerobotics/chonky';
import { runS5cmd, removeS3Object, downloadS3Objects, /*moveS3Object, copyS3Objects*/ } from '../api';
import { Secret, Bucket, ListResults } from '../types';
import { fixJsonData } from '../utils';
import { open } from '@tauri-apps/api/dialog';
import path from 'path-browserify';


interface S3BrowserProps {
    secret: Secret,
    bucket: Bucket,
}

const S3Browser: React.FC<S3BrowserProps> = ({ secret, bucket }) => {
    const [files, setFiles] = useState<FileArray>([]);
    const [folderPrefix, setKeyPrefix] = useState<string>('/');
    // TODO copy FolderChain / FolderPrefix stuff from https://github.com/TimboKZ/chonky-website/blob/master/2.x_storybook/src/demos/S3Browser.tsx

    useEffect(() => {
        // Fetch bucket content when secret or bucket changes
        if (secret && bucket) {
            runS5cmd('ls', [`s3://${bucket.name}`])
                .then((rawResults: string) => {
                    const results: ListResults = fixJsonData(rawResults);
                    const files = results.map(result => {

                        let fileData: FileData = {
                            id: result.key,
                            name: result.key,
                            isDir: false,
                            modDate: result.last_modified,
                            size: result.size,
                        };
                        return fileData;
                    });
                    console.log(files);
                    setFiles(files);
                });
        }
    }, [secret, bucket]);

    const folderChain = React.useMemo(() => {
        let folderChain: FileArray;
        if (folderPrefix === '/') {
            folderChain = [];
        } else {
            let currentPrefix = '';
            folderChain = folderPrefix
                .replace(/\/*$/, '')
                .split('/')
                .map(
                    (prefixPart): FileData => {
                        currentPrefix = currentPrefix
                            ? path.join(currentPrefix, prefixPart)
                            : prefixPart;
                        return {
                            id: currentPrefix,
                            name: prefixPart,
                            isDir: true,
                        };
                    }
                );
        }
        folderChain.unshift({
            id: '/',
            name: bucket.name,
            isDir: true,
        });
        return folderChain;
    }, [folderPrefix]);

    const handleAction = (action: ChonkyFileActionData) => {
        const selectedFiles = action.state.selectedFiles;
        switch (action.id) {
            case ChonkyActions.DeleteFiles.id:
                removeS3Object(selectedFiles[0].name)
                    //removeS3Object(selectedFiles)
                    .then(() => {
                        // refetch the bucket contents:
                        const newFiles = files.filter(file => file && !selectedFiles.includes(file));
                        setFiles(newFiles);
                    });
                break;
            case ChonkyActions.EndDragNDrop.id:
                console.log(action);
                break;
            case ChonkyActions.DownloadFiles.id:
                const downloadFiles = async () => {
                    const filePath = await open({
                        directory: true,
                        multiple: false,
                    });
                    if (filePath && typeof filePath === 'string') {
                        downloadS3Objects(selectedFiles, filePath);
                    }
                };
                downloadFiles();
                break;
            case ChonkyActions.UploadFiles.id:
                const uploadFiles = async () => {
                    const filePaths = await open({
                        directory: false,
                        multiple: true,
                    });
                    if (filePaths) {
                        //uploadS3Objects(filePaths, bucket.name)
                    }
                };
                uploadFiles();
                //refreshBucket();
                break;
            case ChonkyActions.OpenFiles.id:
                if (action.payload.files && action.payload.files.length !== 1) return;
                if (!action.payload.targetFile || !action.payload.targetFile.isDir) return;

                const newPrefix = `${action.payload.targetFile.id.replace(/\/*$/, '')}/`;
                console.log(`Key prefix: ${newPrefix}`);
                setKeyPrefix(newPrefix);
                break;
            // case ChonkyActions.MoveFiles.id:
            //     const destDir = action.payload.destination;
            //     moveS3Object(selectedFiles, destDir)
            //         .then(() => {
            //             const newFiles = files.map(file => {
            //                 if (selectedFiles.includes(file)) {
            //                     return new FileData({ ...file, parent: destDir });
            //                 }
            //                 return file;
            //             });
            //             setFiles(newFiles);
            //         });
            //     break;
            // Handle Chonky drag-and-drop
            // case ChonkyActions.DragNDrop.id:
            //     const sourceFiles = selectedFiles;
            //     const targetDir = action.payload.target;
            //     if (sourceFiles.length > 1 || fileMap[sourceFiles[0]].isDir) {
            //         // Use s5cmd run for directories and multiple files
            //         copyS3Objects(sourceFiles, targetDir, secret, bucket)
            //             .then(() => {
            //                 const newFiles = [...files];
            //                 sourceFiles.forEach(fileId => {
            //                     const file = newFiles.find(file => file.id === fileId);
            //                     if (file) {
            //                         file.parent = targetDir;
            //                     }
            //                 });
            //                 setFiles(newFiles);
            //             });
            //     } else {
            //         // Use s5cmd cp for single files
            //         moveS3Object(sourceFiles[0], targetDir, secret, bucket)
            //             .then(() => {
            //                 const file = files.find(file => file.id === sourceFiles[0]);
            //                 if (file) {
            //                     file.parent = targetDir;
            //                 }
            //                 setFiles([...files]);
            //             });
            //     }
            //     break;
        }
    };

    const myFileActions = [
        ChonkyActions.DeleteFiles,
        ChonkyActions.DownloadFiles,
        ChonkyActions.UploadFiles,
    ];

    const actionsToDisable: string[] = [
        ChonkyActions.SelectAllFiles.id,
        ChonkyActions.OpenSelection.id,
        ChonkyActions.ToggleHiddenFiles.id,
    ];
    return (
        <div id="s3-browser">
            <FileBrowser
                files={files}
                folderChain={folderChain}
                onFileAction={handleAction}
                fileActions={myFileActions}
                disableDefaultFileActions={actionsToDisable}
            >
                <FileToolbar />
                <FileList />
            </FileBrowser>
        </div>
    );
};

export default S3Browser;