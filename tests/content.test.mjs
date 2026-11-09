import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const source = await readFile('extension/content.js', 'utf8');
process.env.TZ = 'Asia/Tokyo';
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
function setup(html) {
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://github.com/' });
  dom.window.eval(source);
  return dom;
}

test('日時はローカル時刻に変換し、日付のみの値は暦日のままにする', () => {
  const dom = setup('<a href="#event"><relative-time datetime="2026-12-31T16:30:00Z">yesterday</relative-time></a><relative-time datetime="2024-02-29">Feb 29</relative-time><relative-time datetime="2023-02-29T00:00:00Z">invalid</relative-time>');
  const times = dom.window.document.querySelectorAll('relative-time');
  assert.equal(times[0].textContent, '2027-01-01 01:30');
  assert.equal(times[0].parentElement.getAttribute('href'), '#event');
  assert.equal(times[1].textContent, '2024-02-29');
  assert.equal(times[2].textContent, 'invalid');
  dom.window.close();
});

test('確認した Projects フィールドだけを変換し、入力や本文は変更しない', () => {
  const dom = setup(`<div id="memex-root"><li><button aria-labelledby="tip"><span><span data-component="Text">Dec 31, 2026</span></span></button><span id="tip">Due: Dec 31, 2026</span></li></div>
    <button aria-label="Edit Due"><span class="issueFieldValueText__test">Feb 29, 2024</span></button>
    <button aria-label="Edit Due"><span class="issueFieldValueText__test">Feb 29, 2023</span></button>
    <p>Dec 31, 2026</p><input value="Dec 31, 2026">`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('[data-component="Text"]').textContent, '2026-12-31');
  assert.equal(doc.querySelector('#tip').textContent, 'Due: 2026-12-31');
  assert.equal(doc.querySelectorAll('[class*=issueFieldValueText]')[0].textContent, '2024-02-29');
  assert.equal(doc.querySelectorAll('[class*=issueFieldValueText]')[1].textContent, 'Feb 29, 2023');
  assert.equal(doc.querySelector('p').textContent, 'Dec 31, 2026');
  assert.equal(doc.querySelector('input').value, 'Dec 31, 2026');
  dom.window.close();
});

test('追加・再描画・datetime 更新にも対応する', async () => {
  const dom = setup('<main></main>');
  const doc = dom.window.document;
  doc.querySelector('main').innerHTML = '<relative-time datetime="2026-01-01T00:00:00Z">now</relative-time>';
  await settle();
  const time = doc.querySelector('relative-time');
  assert.equal(time.textContent, '2026-01-01 09:00');
  time.textContent = '5 minutes ago';
  await settle();
  assert.equal(time.textContent, '2026-01-01 09:00');
  time.setAttribute('datetime', '2026-01-02T00:00:00Z');
  await settle();
  assert.equal(time.textContent, '2026-01-02 09:00');
  dom.window.close();
});

test('夏時間の切り替えをブラウザのタイムゾーンに従って表示する', () => {
  const previous = process.env.TZ;
  process.env.TZ = 'America/New_York';
  try {
    const dom = setup('<relative-time datetime="2026-03-08T06:30:00Z">before</relative-time><relative-time datetime="2026-03-08T07:30:00Z">after</relative-time>');
    const times = dom.window.document.querySelectorAll('relative-time');
    assert.equal(times[0].textContent, '2026-03-08 01:30');
    assert.equal(times[1].textContent, '2026-03-08 03:30');
    dom.window.close();
  } finally {
    process.env.TZ = previous;
  }
});

test('GitHub の Shadow DOM と再描画された表示を変換する', async () => {
  const dom = new JSDOM('<relative-time datetime="2026-11-05T21:28:22.000Z">4d ago</relative-time>', { runScripts: 'outside-only', url: 'https://github.com/' });
  const time = dom.window.document.querySelector('relative-time');
  const shadow = time.attachShadow({ mode: 'open' });
  shadow.innerHTML = '<span part="root">4d ago</span>';
  dom.window.eval(source);
  assert.equal(shadow.textContent, '2026-11-06 06:28');
  shadow.querySelector('span').textContent = '4d ago';
  await settle();
  assert.equal(shadow.textContent, '2026-11-06 06:28');
  time.setAttribute('datetime', '2026-11-06T21:28:22.000Z');
  await settle();
  assert.equal(shadow.textContent, '2026-11-07 06:28');
  dom.window.close();
});

test('遅れて定義される日時要素の Shadow DOM も変換する', async () => {
  const dom = setup('<relative-time datetime="2026-11-05T21:28:22.000Z">4d ago</relative-time>');
  class RelativeTime extends dom.window.HTMLElement {
    connectedCallback() {
      this.attachShadow({ mode: 'open' }).innerHTML = '<span part="root">4d ago</span>';
    }
  }
  dom.window.customElements.define('relative-time', RelativeTime);
  await settle();
  assert.equal(dom.window.document.querySelector('relative-time').shadowRoot.textContent, '2026-11-06 06:28');
  dom.window.close();
});

test('コミット履歴の見出しだけを変換する', () => {
  const dom = setup('<h3 data-testid="commit-group-title" id="group">Commits on Nov 1, 2026</h3><ul aria-labelledby="group"></ul><h3>Commits on Nov 1, 2026</h3>');
  const doc = dom.window.document;
  assert.equal(doc.querySelector('#group').textContent, 'Commits on 2026-11-01');
  assert.equal(doc.querySelector('ul').getAttribute('aria-labelledby'), 'group');
  assert.equal(doc.querySelectorAll('h3')[1].textContent, 'Commits on Nov 1, 2026');
  dom.window.close();
});

test('Projects の表のセルを列名に依存せず変換し、編集欄を保護する', async () => {
  const dom = setup(`<script id="memex-columns-data" type="application/json">[{"id":42,"dataType":"date"},{"id":"Created","dataType":"created"},{"id":99,"dataType":"text"}]</script><div id="memex-root"><div role="gridcell" style="width: calc(var(--column-42-width) * 1px)"><div class="BaseCell__x"><span class="SanitizedHtml__x" data-component="Text" aria-disabled="false">Nov 30, 2026</span></div></div><div role="gridcell" style="width: calc(var(--column-Created-width) * 1px)"><div class="BaseCell__x" title="Sep 18, 2026, 5:18 PM GMT+9"><span class="SanitizedHtml__x" data-component="Text" aria-disabled="true">Sep 18, 2026</span></div></div><div role="gridcell" style="width: calc(var(--column-99-width) * 1px)"><div class="BaseCell__x"><span class="SanitizedHtml__x" data-component="Text">Nov 30, 2026</span></div></div><div role="gridcell"><div class="BaseCell__x"><input value="Nov 30, 2026"></div></div></div>`);
  const doc = dom.window.document;
  const cells = doc.querySelectorAll('[data-component="Text"]');
  assert.equal(cells[0].textContent, '2026-11-30');
  assert.equal(cells[1].textContent, '2026-09-18');
  assert.equal(cells[2].textContent, 'Nov 30, 2026');
  assert.equal(cells[1].parentElement.title, 'Sep 18, 2026, 5:18 PM GMT+9');
  assert.equal(doc.querySelector('input').value, 'Nov 30, 2026');
  cells[0].textContent = 'Dec 31, 2026';
  await settle();
  assert.equal(cells[0].textContent, '2026-12-31');
  dom.window.close();
});


test('列の型を確認できない場合は表の値を変更しない', () => {
  const dom = setup('<div id="memex-root"><div role="gridcell" style="width: calc(var(--column-42-width) * 1px)"><div class="BaseCell__x"><span class="SanitizedHtml__x" data-component="Text">Nov 30, 2026</span></div></div></div>');
  assert.equal(dom.window.document.querySelector('[data-component="Text"]').textContent, 'Nov 30, 2026');
  dom.window.close();
});
