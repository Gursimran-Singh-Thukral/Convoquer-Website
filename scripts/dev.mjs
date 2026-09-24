import { spawn } from 'node:child_process';
const children = ['client', 'server'].map((workspace) =>
  spawn(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['run', 'dev', '--workspace', workspace],
    { stdio: 'inherit', shell: process.platform === 'win32', windowsHide: true },
  ),
);
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  process.exitCode = code;
}
for (const child of children) child.on('exit', (code) => stop(code || 0));
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
