import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

const manifest = JSON.parse(await readFile('extension/manifest.json', 'utf8'));

test('拡張機能の対象と権限を限定する', () => {
  assert.equal(manifest.manifest_version, 3);
  for (const key of ['permissions', 'host_permissions', 'optional_permissions', 'optional_host_permissions', 'externally_connectable', 'web_accessible_resources', 'background', 'content_security_policy']) {
    assert.equal(manifest[key], undefined, `${key} requires review`);
  }
  assert.equal(manifest.content_scripts.length, 1);
  assert.deepEqual(manifest.content_scripts[0].matches, ['https://github.com/*']);
  assert.equal(manifest.content_scripts[0].all_frames, undefined);
  assert.equal(manifest.content_scripts[0].world, undefined);
});

test('Content Script は拡張機能内のファイルを参照する', async () => {
  const root = resolve('extension');
  const scripts = manifest.content_scripts[0].js;
  assert.ok(Array.isArray(scripts) && scripts.length > 0);
  for (const script of scripts) {
    const path = resolve(root, script);
    assert.ok(path.startsWith(root + sep));
    await access(path);
  }
});
