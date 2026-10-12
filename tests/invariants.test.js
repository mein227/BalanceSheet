// 架構與隱私不變量：讓人和 AI agent 修改時都不會不小心破壞。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const stripComments = (code) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const srcFiles = readdirSync(new URL('../src/', import.meta.url)).filter((f) => f.endsWith('.js'));
const PURE = ['calc.js', 'advice.js', 'format.js', 'examples.js'];

test('純計算模組不得存取瀏覽器 API', () => {
  for (const f of PURE) {
    const code = stripComments(read(`src/${f}`));
    assert.doesNotMatch(code, /\b(document|window|localStorage|fetch)\b/, `src/${f} 不得存取瀏覽器 API`);
  }
});

test('隱私：程式碼不得發出網路請求', () => {
  for (const f of srcFiles) {
    const code = read(`src/${f}`);
    assert.doesNotMatch(code, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|https?:\/\//, `src/${f} 含網路請求`);
  }
});

test('index.html 只載入本地資源（不使用 CDN、追蹤碼）', () => {
  const html = read('index.html');
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  for (const ref of refs) {
    assert.ok(!/^(https?:)?\/\//.test(ref), `index.html 載入了外部資源：${ref}`);
  }
});

test('index.html 引用的本地檔案都存在', () => {
  const html = read('index.html');
  const refs = [...html.matchAll(/(?:src|href)="(src\/[^"]+)"/g)].map((m) => m[1]);
  assert.ok(refs.length >= 2);
  for (const ref of refs) assert.doesNotThrow(() => read(ref), `找不到 ${ref}`);
});
