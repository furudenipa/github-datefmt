import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ESLint } from 'eslint';

const eslint = new ESLint();

async function lint(source) {
  const [result] = await eslint.lintText(source, { filePath: 'extension/policy-example.js' });
  return result.messages;
}

test('拡張コード内の典型的な通信 API を拒否する', async () => {
  for (const source of [
    "fetch('https://example.com')",
    'new XMLHttpRequest()',
    "window['fetch']('https://example.com')",
    "navigator.sendBeacon('https://example.com', 'data')",
    "new WebSocket('wss://example.com')",
    "eval('1')",
  ]) {
    assert.ok((await lint(source)).some(message => message.severity === 2), source);
  }
});

test('通常の DOM 操作を許可する', async () => {
  assert.deepEqual(await lint("document.querySelector('time')?.setAttribute('title', 'date');"), []);
});
