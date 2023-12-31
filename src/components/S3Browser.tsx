import React, { useEffect, useState } from 'react';
import { FileBrowser, FileList, FileArray, FileToolbar, FileData, ChonkyActions, ChonkyFileActionData, FileNavbar, defineFileAction, ChonkyIconName, FileAction, ChonkyActionUnion } from '@aperturerobotics/chonky';
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
    const uploadDirsActionName = 'upload_dirs' as ChonkyActionUnion["id"];

    const [files, setFiles] = useState<FileArray>([]);
    const [folderPrefix, setKeyPrefix] = useState<string>(BUCKET_PREFIX);
    const [refreshBucket, setRefreshBucket] = useState<boolean>(false);

    useEffect(() => {
        setKeyPrefix(BUCKET_PREFIX);
    }, [bucket]);

    const folderChain = React.useMemo(() => {
        // these are the "breadcrumbs" in FileNavbar
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
                            id: `${BUCKET_PREFIX}/${currentPrefix}`,
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
            case uploadDirsActionName:
                const uploadFiles = async () => {
                    const filePaths = await open({
                        title: 'Upload files',
                        directory: action.id === uploadDirsActionName ? true : false,
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
        }
    };



    const customUploadDirs: FileAction = defineFileAction({
        id: uploadDirsActionName,
        button: {
            name: 'Upload folders',
            toolbar: true,
            icon: ChonkyIconName.upload,
        },
    });

    const myFileActions = [
        ChonkyActions.DeleteFiles,
        ChonkyActions.DownloadFiles,
        ChonkyActions.UploadFiles,
        customUploadDirs
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