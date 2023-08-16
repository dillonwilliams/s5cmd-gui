import { invoke } from '@tauri-apps/api/tauri';
import { ListResults } from './types';
import { FileData } from '@aperturerobotics/chonky';


export async function runS5cmd(command: string, args: string[]): Promise<any> {
  return invoke('run_s5cmd', {command: command, args: args});
}

export async function runS5cmdRun(commands: string[]) {
  // the rust backend creates the run txt file from the args list?
  return invoke('run_s5cmd_run', {commands: commands});
}

export async function setSecret(accessKeyId: string, secretAccessKey: string) {
  return invoke('set_s3_secret', {accessKeyId: accessKeyId, secretAccessKey: secretAccessKey});
}

export async function removeS3Object(path: FileData) {
  if (path.isDir) {
    return runS5cmd('rm', [path.id + '*']);
  }
  return runS5cmd('rm', [path.id]);
}

export async function moveS3Object(source: string, destination: string) {
  return runS5cmd('mv', [source, destination]);
}

export async function listS3Objects(bucket: string, path: string): Promise<ListResults> {
  return runS5cmd('ls', [bucket, path]);
}

export async function downloadS3Objects(sources: FileData[], destination: string) {
  let commands: string[] = [];
  for (let source of sources) {
    if (source.isDir) {
      commands.push(`cp "${source.id}*" "${destination}/${source.name}"`);
    } else {
      commands.push(`cp "${source.id}" "${destination}"`);
    }
  }
  return runS5cmdRun(commands);
}

export async function uploadS3Objects(sources: string[], s3Destination: string) {
  let commands: string[] = [];
  for (let source of sources) {
    commands.push(`cp "${source}" "${s3Destination}"`);
  }
  return runS5cmdRun(commands);
}

// Function to run a list of s5cmd commands
export async function runS5cmdList(commands: string[]) {
  return runS5cmdRun(commands);
}
