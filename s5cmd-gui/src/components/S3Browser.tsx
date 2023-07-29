import React, { useEffect, useState } from 'react';
import { FileBrowser, FileList, FileArray, FileToolbar, FileData, ChonkyActions, ChonkyFileActionData, FileNavbar } from '@aperturerobotics/chonky';
import { runS5cmd, removeS3Object, downloadS3Objects, uploadS3Objects, /*moveS3Object, copyS3Objects*/ } from '../api';
import { Secret, Bucket, ListResults } from '../types';
import { fixJsonData } from '../utils';
import { open } from '@tauri-apps/api/dialog';
import path from 'path-browserify';


interface S3BrowserProps {
    secret: Secret,
    bucket: Bucket,
}

const S3Browser: React.FC<S3BrowserProps> = ({ secret, bucket }) => {
    const BUCKET_PREFIX = `s3://${bucket.name}`;
    const [files, setFiles] = useState<FileArray>([]);
    const [folderPrefix, setKeyPrefix] = useState<string>(BUCKET_PREFIX);
    const [refreshBucket, setRefreshBucket] = useState<boolean>(false);

    useEffect(() => {
        setKeyPrefix(BUCKET_PREFIX);
    }, [bucket]);

    const folderChain = React.useMemo(() => {
        let folderChain: FileArray;
        if (folderPrefix === BUCKET_PREFIX) {
            folderChain = [];
        } else {
            let currentPrefix = '';
            const folderChainItems = folderPrefix.replace(BUCKET_PREFIX, '').split('/').filter(s => s !== '');
        
            console.log(`folderChainItems: ${JSON.stringify(folderChainItems)}`);
            folderChain = folderChainItems
                .map(
                    (prefixPart): FileData => {
                        currentPrefix = currentPrefix
                            ? path.join(currentPrefix, prefixPart)
                            : prefixPart;
                        return {
                            id: path.join(BUCKET_PREFIX, currentPrefix),
                            name: prefixPart,
                            isDir: true,
                        };
                    }
                );
        }
        folderChain.unshift({
            id: BUCKET_PREFIX,
            name: bucket.name,
            isDir: true,
        });
        console.log(`folderChain: ${JSON.stringify(folderChain)}`)
        return folderChain;
    }, [folderPrefix, bucket]);


    useEffect(() => {
        // Fetch bucket content when secret or bucket changes
        if (secret && bucket) {
            runS5cmd('ls', [folderPrefix])
                .then((rawResults: string) => {
                    const results: ListResults = fixJsonData(rawResults);
                    const files = results.map(result => {
                        const strippedName = result.key.replace(`s3://${bucket.name}/`, '');
                        let fileData: FileData = {
                            id: result.key,
                            name: strippedName,
                            isDir: result.type === 'directory',
                            modDate: result.last_modified,
                            size: result.size,
                        };
                        return fileData;
                    });
                    setFiles(files);
                });
        }
    }, [secret, bucket, folderPrefix, refreshBucket]);

    const handleAction = (action: ChonkyFileActionData) => {
        const selectedFiles = action.state.selectedFiles;
        switch (action.id) {
            case ChonkyActions.OpenFiles.id:
                if (action.payload.files && action.payload.files.length !== 1)
                    return;
                if (!action.payload.targetFile || !action.payload.targetFile.isDir)
                    return;

                const newPrefix = action.payload.targetFile.id;
                setKeyPrefix(newPrefix);
                break;
            case ChonkyActions.DeleteFiles.id:
                removeS3Object(selectedFiles[0])
                // TODO handle multiple files
                //removeS3Object(selectedFiles)
                .then(() => {
                    setRefreshBucket(!refreshBucket);
                });
                break;
            case ChonkyActions.EndDragNDrop.id:
                console.log(action);
                break;
            case ChonkyActions.DownloadFiles.id:
                const downloadFiles = async () => {
                    const filePath = await open({
                        title: 'Choose download directory',
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
                        title: 'Upload files',
                        directory: false,
                        multiple: true,
                    });
                    console.log(`filePaths: ${filePaths}`); 
                    if (filePaths && Array.isArray(filePaths)) {
                        uploadS3Objects(filePaths, folderPrefix);
                    } else if (filePaths && typeof filePaths === 'string') {
                        uploadS3Objects([filePaths], folderPrefix);
                    }
                };
                uploadFiles().then(() => {
                    setRefreshBucket(!refreshBucket);
                });
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
                <FileNavbar />
                <FileToolbar />
                <FileList />
            </FileBrowser>
        </div>
    );
};

export default S3Browser;