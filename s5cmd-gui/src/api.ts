import { invoke } from '@tauri-apps/api/tauri';
import { ListResults } from './types';


export async function runS5cmd(command: string, args: string[]): Promise<any> {
  return invoke('run_s5cmd', {command: command, args: args});
}

export async function runS5cmdRun(commands: string[]) {
  // the rust backend creates the run txt file from the args list?
  return invoke('run_s5cmd_run', {command: 'run', args: commands});
}

export async function setSecret(accessKeyId: string, secretAccessKey: string) {
  return invoke('set_s3_secret', {accessKeyId: accessKeyId, secretAccessKey: secretAccessKey});
}

export async function removeS3Object(path: string) {
  return runS5cmd('rm', [path]);
}

export async function moveS3Object(source: string, destination: string) {
  return runS5cmd('mv', [source, destination]);
}

export async function listS3Objects(bucket: string, path: string): Promise<ListResults> {
  return runS5cmd('ls', [bucket, path]);
}

export async function copyS3Objects(source: string, destination: string) {
  return runS5cmd('cp', [source, destination]);
}

// Function to run a list of s5cmd commands
export async function runS5cmdList(commands: string[]) {
  return runS5cmdRun(commands);
}