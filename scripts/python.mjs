// Development only: find the platform's Python 3.10+ for repository scripts.
// macOS and Linux use python3. On Windows, python3 is often the Microsoft Store placeholder,
// so python and the py launcher come first, in UTF-8 mode so files read as they do on macOS and Linux.
import { spawnSync } from 'node:child_process';

const windows = process.platform === 'win32';
const candidates = windows ? [['python', []], ['py', ['-3']], ['python3', []]] : [['python3', []]];
let found = null;

export function python() {
  if (found) return found;
  for (const [command, args] of candidates) {
    const probe = spawnSync(command, [...args, '-c', 'import sys; sys.exit(sys.version_info < (3, 10))'], { stdio: 'ignore', windowsHide: true });
    if (probe.status === 0) return (found = { command, args });
  }
  throw Error('Python 3.10 or later was not found ' + (windows ? '(tried python, py -3 and python3).' : 'as python3.'));
}

export function pythonEnv(env = process.env) {
  return windows ? { ...env, PYTHONUTF8: '1' } : env;
}
