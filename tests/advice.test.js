import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RULES, SEVERITY, generateAdvice, healthScore } from '../src/advice.js';
import { analyze } from '../src/calc.js';
import { EXAMPLES } from '../src/examples.js';
import { PERSONAS } from './fixtures/personas.js';

const spec = readFileSync(new URL('../docs/spec.md', import.meta.url), 'utf8');

test('規則 id 不重複', () => {
  const ids = RULES.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('每條規則都有合法的 severity 與來源', () => {
  for (const r of RULES) {
    assert.ok(SEVERITY[r.severity], `${r.id} severity 不合法`);
    assert.ok(r.sources.length > 0, `${r.id} 沒有來源`);
    for (const s of r.sources) assert.match(s, /^(general|\d{2}:\d{2})$/, `${r.id} 來源格式錯誤：${s}`);
  }
});

test('每條規則都記錄在 docs/spec.md', () => {
  for (const r of RULES) assert.ok(spec.includes(`\`${r.id}\``), `docs/spec.md 缺少規則 ${r.id}`);
});

test('每條規則至少被一個評測 persona 覆蓋', () => {
  const covered = new Set(PERSONAS.flatMap((p) => p.mustInclude));
  const uncovered = RULES.map((r) => r.id).filter((id) => !covered.has(id));
  assert.deepEqual(uncovered, [], `沒有評測覆蓋：${uncovered.join(', ')}`);
});

test('建議依嚴重度排序', () => {
  const advice = generateAdvice(analyze(EXAMPLES.leveraged.data));
  const orders = advice.map((a) => SEVERITY[a.severity].order);
  assert.deepEqual(orders, [...orders].sort((a, b) => a - b));
});

test('建議內容不含 undefined / NaN', () => {
  for (const p of PERSONAS) {
    for (const a of generateAdvice(analyze(p.data))) {
      assert.doesNotMatch(a.detail, /undefined|NaN/, `${p.name} / ${a.id}: ${a.detail}`);
    }
  }
});

test('健康分數介於 0–100', () => {
  assert.deepEqual(healthScore([]), { score: 100, grade: '穩健' });
  const many = Array.from({ length: 20 }, () => ({ severity: 'danger' }));
  assert.equal(healthScore(many).score, 0);
});
