// 純計算核心：不得存取 DOM、localStorage 或網路，所有函式皆需可在 Node 中測試。

export const DEBT_TYPES = {
  mortgage: { label: '房貸', kind: 'fixed' },
  homeEquity: { label: '房屋增貸', kind: 'fixed' },
  personal: { label: '信用貸款', kind: 'fixed' },
  pledge: { label: '股票質押', kind: 'market' },
  margin: { label: '融資', kind: 'market' },
  card: { label: '信用卡／循環', kind: 'revolving' },
  other: { label: '其他負債', kind: 'fixed' },
};

export const ASSET_FIELDS = {
  cash: { label: '現金／活存', group: 'liquid' },
  deposits: { label: '定存／貨幣基金', group: 'liquid' },
  stocks: { label: '股票／ETF', group: 'risk' },
  bonds: { label: '債券／債券 ETF', group: 'invest' },
  otherInvest: { label: '其他風險投資', group: 'risk' },
  insuranceCash: { label: '儲蓄險解約金', group: 'invest' },
  realEstate: { label: '自住／不動產', group: 'use' },
  otherAssets: { label: '車輛／其他資產', group: 'use' },
};

export const INCOME_STABILITY = {
  stable: { label: '穩定（公職、長期受雇）', factor: 1.0 },
  normal: { label: '普通（一般受雇、有獎金浮動）', factor: 0.8 },
  unstable: { label: '不穩定（接案、業務、創業）', factor: 0.6 },
};

export const DEFAULT_MAINTENANCE_RATIO = 1.3;
export const HUMAN_CAPITAL_DISCOUNT_RATE = 0.03;

export const STRESS_SCENARIOS = {
  severe: {
    label: '最差情境：股市 −40%、收入 −30%、失業半年',
    stockDrop: 0.4,
    incomeDrop: 0.3,
    jobLossMonths: 6,
  },
  extreme: {
    label: '極端情境：股市 −50%、收入 −50%、失業半年',
    stockDrop: 0.5,
    incomeDrop: 0.5,
    jobLossMonths: 6,
  },
};

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const pos = (v) => Math.max(0, num(v));

export const safeDiv = (a, b) => (b > 0 ? a / b : null);

/** 年金現值：每月付 payment、年利率 annualRate、共 months 期，今天最多能借多少。 */
export function annuityPresentValue(payment, annualRate, months) {
  const p = pos(payment);
  const n = Math.max(0, Math.floor(num(months)));
  const i = num(annualRate) / 12;
  if (n === 0) return 0;
  if (i === 0) return p * n;
  return (p * (1 - (1 + i) ** -n)) / i;
}

/** 本金 principal 一次跌 drop 後，維持率剛好等於 maintenance 時的跌幅。回傳 0–1，無擔保品回傳 null。 */
export function marginCallDrop(loan, collateral, maintenance = DEFAULT_MAINTENANCE_RATIO) {
  const L = pos(loan);
  const C = pos(collateral);
  if (C === 0) return null;
  if (L === 0) return 1;
  return Math.min(1, Math.max(0, 1 - (maintenance * L) / C));
}

/** 人力資本：把未來到退休前的收入折現，並依收入穩定度打折。 */
export function humanCapital(monthlyIncome, yearsToRetire, stability = 'normal') {
  const annual = pos(monthlyIncome) * 12;
  const years = Math.max(0, Math.floor(num(yearsToRetire)));
  const factor = INCOME_STABILITY[stability]?.factor ?? INCOME_STABILITY.normal.factor;
  const r = HUMAN_CAPITAL_DISCOUNT_RATE;
  const pv = years === 0 ? 0 : (annual * (1 - (1 + r) ** -years)) / r;
  return pv * factor;
}

export function normalize(data = {}) {
  const profile = data.profile ?? {};
  const assets = {};
  for (const key of Object.keys(ASSET_FIELDS)) assets[key] = pos(data.assets?.[key]);
  const liabilities = (data.liabilities ?? []).map((d) => ({
    type: DEBT_TYPES[d.type] ? d.type : 'other',
    name: String(d.name ?? ''),
    balance: pos(d.balance),
    rate: pos(d.rate),
    monthlyPayment: pos(d.monthlyPayment),
    collateralValue: pos(d.collateralValue),
  }));
  return {
    profile: {
      monthlyIncome: pos(profile.monthlyIncome),
      monthlyExpense: pos(profile.monthlyExpense),
      incomeStability: INCOME_STABILITY[profile.incomeStability] ? profile.incomeStability : 'normal',
      yearsToRetire: pos(profile.yearsToRetire),
      targetNetWorth: pos(profile.targetNetWorth),
      longTermCash: pos(profile.longTermCash),
      wouldPanicSell: Boolean(profile.wouldPanicSell),
      hasAddRules: Boolean(profile.hasAddRules),
    },
    assets,
    liabilities,
  };
}

function groupSum(assets, group) {
  return Object.entries(ASSET_FIELDS)
    .filter(([, meta]) => meta.group === group)
    .reduce((s, [key]) => s + assets[key], 0);
}

export function stressTest(data, scenario) {
  const d = normalize(data);
  const { profile, assets, liabilities } = d;
  const drop = num(scenario.stockDrop);
  const riskAssets = groupSum(assets, 'risk');
  const liquid = groupSum(assets, 'liquid');
  const monthlyDebtPayment = liabilities.reduce((s, l) => s + l.monthlyPayment, 0);
  const monthlyOutflow = profile.monthlyExpense + monthlyDebtPayment;

  const marginCalls = liabilities
    .filter((l) => DEBT_TYPES[l.type].kind === 'market' && l.collateralValue > 0)
    .map((l) => {
      const triggerDrop = marginCallDrop(l.balance, l.collateralValue);
      const collateralAfter = l.collateralValue * (1 - drop);
      const topUp = Math.max(0, DEFAULT_MAINTENANCE_RATIO * l.balance - collateralAfter);
      return { name: l.name || DEBT_TYPES[l.type].label, triggerDrop, triggered: topUp > 0, topUp };
    });
  const topUpNeeded = marginCalls.reduce((s, m) => s + m.topUp, 0);
  const liquidAfterTopUp = liquid - topUpNeeded;

  const incomeAfter = profile.monthlyIncome * (1 - num(scenario.incomeDrop));
  const monthlyCashflowNoIncomeDrop = profile.monthlyIncome - monthlyOutflow;
  const monthlyCashflow = incomeAfter - monthlyOutflow;
  const survivalMonths = monthlyOutflow > 0 ? Math.max(0, liquidAfterTopUp) / monthlyOutflow : Infinity;

  const totalAssets = Object.values(assets).reduce((s, v) => s + v, 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + l.balance, 0);
  const netWorth = totalAssets - totalLiabilities;
  const riskLoss = riskAssets * drop;

  return {
    scenario,
    riskLoss,
    netWorthAfter: netWorth - riskLoss,
    netWorthChange: safeDiv(-riskLoss, netWorth),
    marginCalls,
    topUpNeeded,
    liquidAfterTopUp,
    forcedSell: liquidAfterTopUp < 0,
    monthlyCashflowNoIncomeDrop,
    monthlyCashflow,
    survivalMonths,
    coversJobLoss: survivalMonths >= num(scenario.jobLossMonths),
  };
}

export function analyze(data) {
  const d = normalize(data);
  const { profile, assets, liabilities } = d;

  const liquidAssets = groupSum(assets, 'liquid');
  const riskAssets = groupSum(assets, 'risk');
  const investAssets = riskAssets + groupSum(assets, 'invest');
  const useAssets = groupSum(assets, 'use');
  const totalAssets = liquidAssets + investAssets + useAssets;

  const totalLiabilities = liabilities.reduce((s, l) => s + l.balance, 0);
  const debtByKind = { fixed: 0, market: 0, revolving: 0 };
  for (const l of liabilities) debtByKind[DEBT_TYPES[l.type].kind] += l.balance;

  const monthlyDebtPayment = liabilities.reduce((s, l) => s + l.monthlyPayment, 0);
  const monthlyOutflow = profile.monthlyExpense + monthlyDebtPayment;
  const monthlySurplus = profile.monthlyIncome - monthlyOutflow;

  const netWorth = totalAssets - totalLiabilities;
  const hc = humanCapital(profile.monthlyIncome, profile.yearsToRetire, profile.incomeStability);

  const triggerDrops = liabilities
    .filter((l) => DEBT_TYPES[l.type].kind === 'market')
    .map((l) => marginCallDrop(l.balance, l.collateralValue))
    .filter((v) => v !== null);
  const marketDebtWithoutCollateral = liabilities.some(
    (l) => DEBT_TYPES[l.type].kind === 'market' && l.balance > 0 && l.collateralValue === 0,
  );

  const emergencyReserve = monthlyOutflow * 6;
  const idleLongTermCash = Math.min(profile.longTermCash, Math.max(0, liquidAssets - emergencyReserve));

  return {
    data: d,
    liquidAssets,
    riskAssets,
    investAssets,
    useAssets,
    totalAssets,
    totalLiabilities,
    debtByKind,
    netWorth,
    humanCapital: hc,
    lifeNetWorth: netWorth + hc,
    debtRatio: safeDiv(totalLiabilities, totalAssets),
    monthlyDebtPayment,
    monthlyOutflow,
    monthlySurplus,
    dsr: safeDiv(monthlyDebtPayment, profile.monthlyIncome),
    savingsRate: safeDiv(monthlySurplus, profile.monthlyIncome),
    emergencyMonths: monthlyOutflow > 0 ? liquidAssets / monthlyOutflow : Infinity,
    riskShareOfNetWorth: safeDiv(riskAssets, netWorth),
    minTriggerDrop: triggerDrops.length ? Math.min(...triggerDrops) : null,
    marketDebtWithoutCollateral,
    idleLongTermCash,
    targetProgress: safeDiv(netWorth, profile.targetNetWorth),
    stress: {
      severe: stressTest(d, STRESS_SCENARIOS.severe),
      extreme: stressTest(d, STRESS_SCENARIOS.extreme),
    },
  };
}

/**
 * 借錢一次投入（B）vs 每月定期定額（A）的試算，模型同 EP435 [03:46]：
 * 未來 months 個月每月可拿出 monthlyAmount；B 今天借年金現值一次買，之後每月還款。
 */
export function leverageSimulation({
  monthlyAmount,
  annualRate,
  months,
  expectedReturn,
  holdYears,
  worstDrop = 0.5,
  targetNetWorth = 0,
  netWorth = 0,
  ratios = [0, 0.3, 0.5, 1],
}) {
  const M = pos(monthlyAmount);
  const n = Math.max(0, Math.floor(num(months)));
  const e = num(expectedReturn);
  const Y = Math.max(n / 12, num(holdYears));
  const borrowable = annuityPresentValue(M, num(annualRate), n);
  const totalInterest = M * n - borrowable;

  const growth = (t) => (1 + e) ** t;
  let dcaFuture = 0;
  for (let k = 0; k < n; k += 1) dcaFuture += M * growth(Y - k / 12);
  const lumpFuture = borrowable * growth(Y);
  const fullExtra = lumpFuture - dcaFuture;
  const fullWorstLoss = borrowable * pos(worstDrop);

  const rows = ratios.map((ratio) => {
    const borrowed = borrowable * ratio;
    const extraGain = fullExtra * ratio;
    const worstLoss = fullWorstLoss * ratio;
    return {
      ratio,
      borrowed,
      extraGain,
      worstLoss,
      shareOfTarget: safeDiv(extraGain, pos(targetNetWorth)),
      worstLossShareOfNetWorth: safeDiv(worstLoss, pos(netWorth)),
    };
  });

  return { borrowable, totalInterest, dcaFuture, lumpFuture, fullExtra, fullWorstLoss, rows };
}
