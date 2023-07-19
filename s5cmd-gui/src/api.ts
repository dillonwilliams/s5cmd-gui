import { invoke } from '@tauri-apps/api/tauri';
import { Command } from 's5cmd';

// Function to run s5cmd commands
export async function runS5cmd(command: Command) {
  return invoke('run_s5cmd', command);
}

// Function to remove an S3 object using s5cmd rm
export async function removeS3Object(path: string) {
  return runS5cmd({ name: 'rm', args: [path] });
}

// Function to move an S3 object using s5cmd mv
export async function moveS3Object(source: string, destination: string) {
  return runS5cmd({ name: 'mv', args: [source, destination] });
}

// Function to copy S3 objects using s5cmd cp
export async function copyS3Objects(source: string, destination: string) {
  return runS5cmd({ name: 'cp', args: [source, destination] });
}

// Function to run a list of s5cmd commands
export async function runS5cmdList(commands: Command[]) {
  return invoke('run_s5cmd_list', commands);
}