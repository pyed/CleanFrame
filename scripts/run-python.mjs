// Development only: `node scripts/run-python.mjs [python options] script.py [args]`, used by the npm scripts.
import { spawnSync } from 'node:child_process';
import { python, pythonEnv } from './python.mjs';

const { command, args } = python();
const result = spawnSync(command, [...args, ...process.argv.slice(2)], { stdio: 'inherit', env: pythonEnv() });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
