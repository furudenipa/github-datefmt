import { readFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

async function checkJavaScript(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await checkJavaScript(path);
    else if (/\.(?:js|mjs|cjs)$/.test(entry.name)) {
      execFileSync(process.execPath, ['--check', path], { stdio: 'inherit' });
    }
  }
}

for (const directory of ['extension', 'scripts', 'tests']) await checkJavaScript(directory);
JSON.parse(await readFile('extension/manifest.json', 'utf8'));
console.log('JavaScript syntax and manifest JSON: OK');
