import { spawn } from 'node:child_process';
import process from 'node:process';

const node = process.execPath;
const server = spawn(node, [
  './node_modules/vite/bin/vite.js',
  '--host',
  '127.0.0.1',
  '--port',
  '4173',
], { stdio: 'inherit' });

const waitForServer = async () => {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error('The local PiPlate server stopped before the tests started.');
    try {
      const response = await fetch('http://127.0.0.1:4173');
      if (response.ok) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('Timed out while starting the local PiPlate server.');
};

let exitCode = 1;
try {
  await waitForServer();
  exitCode = await new Promise((resolve, reject) => {
    const tests = spawn(node, [
      './node_modules/@playwright/test/cli.js',
      'test',
      ...process.argv.slice(2),
    ], { stdio: 'inherit' });
    tests.once('error', reject);
    tests.once('exit', code => resolve(code ?? 1));
  });
} catch (error) {
  console.error(error);
} finally {
  if (server.exitCode === null) server.kill();
}

process.exitCode = exitCode;
