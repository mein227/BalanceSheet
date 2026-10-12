// 評測集（evals）：每個 persona 描述一種財務狀況，以及建議引擎「一定要給」與「一定不能給」的建議。
// 修改規則或門檻後，這些案例必須仍然成立；若刻意改變行為，請在 PR 說明原因。
import { EXAMPLES, EMPTY_DATA } from '../../src/examples.js';

export const PERSONAS = [
  {
    name: '範例：穩健上班族',
    data: EXAMPLES.steady.data,
    mustInclude: ['healthy-structure', 'idle-long-term-cash', 'no-add-rules', 'insurance-cash-review'],
    mustExclude: ['margin-call-near', 'forced-sell', 'compound-risk', 'emergency-critical', 'job-loss-uncovered'],
    score: [85, 100],
  },
  {
    name: '範例：高槓桿積極派',
    data: EXAMPLES.leveraged.data,
    mustInclude: [
      'margin-call-near',
      'forced-sell',
      'job-loss-uncovered',
      'emergency-low',
      'dsr-elevated',
      'panic-seller-leverage',
      'unstable-income-debt',
      'deep-drawdown',
      'compound-risk',
    ],
    mustExclude: ['healthy-structure', 'market-debt-safe', 'idle-long-term-cash', 'panic-seller'],
    score: [0, 40],
  },
  {
    name: '範例：剛起步小資族',
    data: EXAMPLES.starter.data,
    mustInclude: [
      'revolving-debt',
      'emergency-critical',
      'job-loss-uncovered',
      'human-capital-dominant',
      'cashflow-after-income-drop',
    ],
    mustExclude: ['healthy-structure', 'zero-debt-not-goal', 'margin-call-near'],
    score: [0, 70],
  },
  {
    name: '空白資料不應產生任何建議',
    data: EMPTY_DATA,
    mustInclude: [],
    mustExclude: ['negative-net-worth', 'negative-cashflow', 'emergency-critical', 'healthy-structure'],
    exactCount: 0,
  },
  {
    name: '零負債存錢族',
    data: {
      profile: { monthlyIncome: 60000, monthlyExpense: 30000, yearsToRetire: 30, incomeStability: 'stable', hasAddRules: true },
      assets: { cash: 400000, stocks: 300000 },
      liabilities: [],
    },
    mustInclude: ['zero-debt-not-goal', 'healthy-structure'],
    mustExclude: ['no-add-rules', 'dsr-high', 'forced-sell'],
  },
  {
    name: '低比例質押，離追繳很遠（EP435 [26:32]）',
    data: {
      profile: { monthlyIncome: 100000, monthlyExpense: 40000, hasAddRules: true },
      assets: { cash: 1000000, stocks: 10000000 },
      liabilities: [{ type: 'pledge', name: '低比例質押', balance: 2000000, monthlyPayment: 5000, collateralValue: 10000000 }],
    },
    mustInclude: ['market-debt-safe'],
    mustExclude: ['margin-call-near', 'forced-sell', 'market-debt-no-collateral'],
  },
  {
    name: '融資未填擔保品市值',
    data: {
      profile: { monthlyIncome: 80000, monthlyExpense: 30000 },
      assets: { cash: 500000, stocks: 1000000 },
      liabilities: [{ type: 'margin', balance: 500000 }],
    },
    mustInclude: ['market-debt-no-collateral'],
    mustExclude: ['market-debt-safe'],
  },
  {
    name: '房貸壓力大、又怕帳面虧損',
    data: {
      profile: { monthlyIncome: 60000, monthlyExpense: 20000, wouldPanicSell: true, hasAddRules: true },
      assets: { cash: 600000, stocks: 500000, realEstate: 15000000 },
      liabilities: [{ type: 'mortgage', balance: 9000000, monthlyPayment: 30000 }],
    },
    mustInclude: ['dsr-high', 'panic-seller'],
    mustExclude: ['panic-seller-leverage', 'dsr-elevated', 'healthy-structure'],
  },
  {
    name: '入不敷出且淨值為負',
    data: {
      profile: { monthlyIncome: 40000, monthlyExpense: 35000 },
      assets: { cash: 50000 },
      liabilities: [{ type: 'personal', balance: 800000, monthlyPayment: 15000 }],
    },
    mustInclude: ['negative-net-worth', 'negative-cashflow', 'dsr-elevated', 'emergency-critical'],
    mustExclude: ['healthy-structure', 'zero-debt-not-goal'],
  },
];
