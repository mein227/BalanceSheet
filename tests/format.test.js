import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatMoney, wanToYuan, yuanToWan } from '../src/format.js';

test('formatMoney 一律以「萬元」顯示', () => {
  assert.equal(formatMoney(1174400), '117 萬元');
  assert.equal(formatMoney(25600), '2.56 萬元');
  assert.equal(formatMoney(3000), '0.3 萬元');
  assert.equal(formatMoney(123456), '12.3 萬元');
  assert.equal(formatMoney(300000000), '30,000 萬元');
  assert.equal(formatMoney(-10000), '−1 萬元');
  assert.equal(formatMoney(0), '0 萬元');
  assert.equal(formatMoney(40), '< 0.01 萬元');
});

test('formatMoney 特殊值', () => {
  assert.equal(formatMoney(null), '—');
  assert.equal(formatMoney(Number.NaN), '—');
  assert.equal(formatMoney(Infinity), '∞');
});

test('萬元與元互換', () => {
  assert.equal(wanToYuan('12'), 120000);
  assert.equal(wanToYuan(0.35), 3500);
  assert.equal(wanToYuan(''), 0);
  assert.equal(wanToYuan('abc'), 0);
  assert.equal(yuanToWan(1174400), 117.44);
  assert.equal(wanToYuan(yuanToWan(123456)), 123456);
});
