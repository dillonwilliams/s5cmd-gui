import React, { useEffect, useState } from 'react';
import { FileBrowser, ChonkyIconFA, useFileBrowser, FileAction } from 'chonky';
import { ChonkyActions } from 'chonky/lib/types/action-map';
import { FileArray, FileData } from 'chonky/lib/types/files';
import { runS5cmd, removeS3Object, moveS3Object, copyS3Objects } from '../../tauri/api';
import { Secret, Bucket } from '../../types';

interface S3BrowserProps {
    secret: Secret,
    bucket: Bucket,
}

const S3Browser: React.FC<S3BrowserProps> = ({ secret, bucket }) => {
    const { files, setFiles } = useState<FileArray>([]);
    const { selectedFiles, setSelectedFiles, fileMap } = useFileBrowser(files, {});

    useEffect(() => {
        // Fetch bucket content when secret or bucket changes
        if (secret && bucket) {
            runS5cmd(`ls s3://${bucket.name}`, secret)
                .then(result => {
                    const files = result.map(line => {
                        const [size, mtime, name] = line.split('\t');
                        return new FileData({
                            id: name,
                            name,
                            isDir: false,
                            modDate: new Date(mtime),
                            size: parseInt(size, 10),
                        });
                    });
                    setFiles(files);
                });
        }
    }, [secret, bucket]);

    const handleAction = (action: FileAction) => {
        const selectedFiles = action.state.selectedFiles;
        switch (action.id) {
            case ChonkyActions.Delete.id:
                removeS3Object(selectedFiles, secret, bucket)
                    .then(() => {
                        const newFiles = files.filter(file => !selectedFiles.includes(file));
                        setFiles(newFiles);
                    });
                break;
            case ChonkyActions.Move.id:
                const destDir = action.payload.target;
                moveS3Object(selectedFiles, destDir, secret, bucket)
                    .then(() => {
                        const newFiles = files.map(file => {
                            if (selectedFiles.includes(file)) {
                                return new FileData({ ...file, parent: destDir });
                            }
                            return file;
                        });
                        setFiles(newFiles);
                    });
                break;
            // Handle Chonky drag-and-drop
            case ChonkyActions.DragNDrop.id:
                const sourceFiles = selectedFiles;
                const targetDir = action.payload.target;
                if (sourceFiles.length > 1 || fileMap[sourceFiles[0]].isDir) {
                    // Use s5cmd run for directories and multiple files
                    copyS3Objects(sourceFiles, targetDir, secret, bucket)
                        .then(() => {
                            const newFiles = [...files];
                            sourceFiles.forEach(fileId => {
                                const file = newFiles.find(file => file.id === fileId);
                                if (file) {
                                    file.parent = targetDir;
                                }
                            });
                            setFiles(newFiles);
                        });
                } else {
                    // Use s5cmd cp for single files
                    moveS3Object(sourceFiles[0], targetDir, secret, bucket)
                        .then(() => {
                            const file = files.find(file => file.id === sourceFiles[0]);
                            if (file) {
                                file.parent = targetDir;
                            }
                            setFiles([...files]);
                        });
                }
                break;
        }
    };

    return (
        <div id="s3-browser">
            <FileBrowser
                files={files}
                folderChain={[{ id: '/', name: 'Root' }]}
                onFileAction={handleAction}
                fileActions={ChonkyActions}
                icons={ChonkyIconFA}
            />
        </div>
    );
};

export default S3Browser;