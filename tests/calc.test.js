import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyze,
  annuityPresentValue,
  humanCapital,
  leverageSimulation,
  marginCallDrop,
  normalize,
  stressTest,
} from '../src/calc.js';

const close = (actual, expected, tolerance, msg) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${msg ?? ''} expected ≈${expected}, got ${actual}`);

test('年金現值：每月 10 萬、4%、12 期 ≈ 117.4 萬（EP435 [03:46]「117 萬多」）', () => {
  close(annuityPresentValue(100000, 0.04, 12), 1174400, 500);
});

test('年金現值：利率 0 時等於本金加總，期數 0 時為 0', () => {
  assert.equal(annuityPresentValue(100000, 0, 12), 1200000);
  assert.equal(annuityPresentValue(100000, 0.04, 0), 0);
});

test('借得到的錢一定少於 120 萬（不能借 120 萬再另付利息，EP435 [16:46]）', () => {
  assert.ok(annuityPresentValue(100000, 0.04, 12) < 1200000);
});

test('追繳跌幅：借 400 萬、擔保 700 萬、維持率 130%', () => {
  close(marginCallDrop(4_000_000, 7_000_000), 1 - (1.3 * 4) / 7, 1e-9);
});

test('追繳跌幅：沒有擔保品回傳 null，沒有借款回傳 1，超借時為 0', () => {
  assert.equal(marginCallDrop(100, 0), null);
  assert.equal(marginCallDrop(0, 100), 1);
  assert.equal(marginCallDrop(100, 100), 0);
});

test('人力資本：收入越不穩定估值越低，0 年為 0', () => {
  const stable = humanCapital(50000, 20, 'stable');
  const unstable = humanCapital(50000, 20, 'unstable');
  assert.ok(stable > unstable);
  close(unstable / stable, 0.6, 1e-9);
  assert.equal(humanCapital(50000, 0, 'stable'), 0);
});

test('normalize：負數、字串、未知負債種類都會被修正', () => {
  const d = normalize({
    profile: { monthlyIncome: '50000', monthlyExpense: -10, incomeStability: 'weird' },
    assets: { cash: 'abc', stocks: '1000' },
    liabilities: [{ type: 'unknown', balance: '500' }],
  });
  assert.equal(d.profile.monthlyIncome, 50000);
  assert.equal(d.profile.monthlyExpense, 0);
  assert.equal(d.profile.incomeStability, 'normal');
  assert.equal(d.assets.cash, 0);
  assert.equal(d.assets.stocks, 1000);
  assert.equal(d.liabilities[0].type, 'other');
  assert.equal(d.liabilities[0].balance, 500);
});

test('analyze：基本指標', () => {
  const m = analyze({
    profile: { monthlyIncome: 100000, monthlyExpense: 40000, yearsToRetire: 0 },
    assets: { cash: 600000, stocks: 1000000, realEstate: 5000000 },
    liabilities: [{ type: 'mortgage', balance: 3000000, monthlyPayment: 20000 }],
  });
  assert.equal(m.totalAssets, 6600000);
  assert.equal(m.totalLiabilities, 3000000);
  assert.equal(m.netWorth, 3600000);
  assert.equal(m.monthlyOutflow, 60000);
  assert.equal(m.emergencyMonths, 10);
  close(m.dsr, 0.2, 1e-9);
  close(m.savingsRate, 0.4, 1e-9);
  assert.equal(m.debtByKind.fixed, 3000000);
  assert.equal(m.minTriggerDrop, null);
});

test('壓力測試：質押被追繳時要補的錢會從流動資金扣掉', () => {
  const data = {
    profile: { monthlyIncome: 100000, monthlyExpense: 50000 },
    assets: { cash: 500000, stocks: 2000000 },
    liabilities: [{ type: 'pledge', balance: 1000000, monthlyPayment: 0, collateralValue: 2000000 }],
  };
  const s = stressTest(data, { stockDrop: 0.4, incomeDrop: 0, jobLossMonths: 6 });
  // 2,000,000 × 0.6 = 1,200,000；需維持 1,300,000 → 補 100,000
  close(s.topUpNeeded, 100000, 1e-6);
  close(s.liquidAfterTopUp, 400000, 1e-6);
  assert.equal(s.forcedSell, false);
  assert.equal(s.marginCalls[0].triggered, true);
  close(s.survivalMonths, 8, 1e-9);
  assert.equal(s.coversJobLoss, true);
});

test('壓力測試：固定本息負債在大跌時不會產生追繳', () => {
  const s = stressTest(
    { assets: { cash: 100, stocks: 1000 }, liabilities: [{ type: 'personal', balance: 5000 }] },
    { stockDrop: 0.5, incomeDrop: 0, jobLossMonths: 6 },
  );
  assert.equal(s.topUpNeeded, 0);
  assert.equal(s.marginCalls.length, 0);
});

test('借錢試算：借一半的多賺／多賠剛好是借滿的一半（EP435 [17:48]）', () => {
  const sim = leverageSimulation({
    monthlyAmount: 100000,
    annualRate: 0.04,
    months: 12,
    expectedReturn: 0.08,
    holdYears: 1,
    worstDrop: 0.5,
    targetNetWorth: 30000000,
    netWorth: 5000000,
  });
  close(sim.borrowable, 1174400, 500);
  const half = sim.rows.find((r) => r.ratio === 0.5);
  const full = sim.rows.find((r) => r.ratio === 1);
  close(half.extraGain * 2, full.extraGain, 1e-6);
  close(half.worstLoss * 2, full.worstLoss, 1e-6);
  close(full.shareOfTarget, full.extraGain / 30000000, 1e-12);
  assert.ok(full.extraGain > 0, '正期望報酬下，提早一次投入的期望值應高於分批');
  assert.equal(sim.rows.find((r) => r.ratio === 0).borrowed, 0);
});

test('借錢試算：預期報酬低於借款利率時，借錢期望值為負', () => {
  const sim = leverageSimulation({ monthlyAmount: 100000, annualRate: 0.06, months: 12, expectedReturn: 0.02, holdYears: 1 });
  assert.ok(sim.fullExtra < 0);
});
