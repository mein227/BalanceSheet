// 建議規則：每條規則必須有唯一 id、severity、sources（EP435 時間戳或 'general'）。
// 新增規則時，請同步更新 docs/spec.md 與 tests/fixtures/personas.js。
import { formatMoney, formatPct, formatMonths } from './format.js';

export const SEVERITY = {
  danger: { label: '高風險', weight: 15, order: 0 },
  warning: { label: '注意', weight: 7, order: 1 },
  info: { label: '建議', weight: 0, order: 2 },
  good: { label: '良好', weight: 0, order: 3 },
};

const riskFlags = (m) =>
  [
    m.emergencyMonths < 6,
    m.dsr !== null && m.dsr > 0.3,
    m.minTriggerDrop !== null && m.minTriggerDrop < 0.5,
    m.data.profile.incomeStability === 'unstable',
    m.data.profile.wouldPanicSell && m.riskAssets > 0,
    m.stress.severe.forcedSell,
    m.stress.severe.monthlyCashflow < 0,
  ].filter(Boolean).length;

export const RULES = [
  {
    id: 'negative-net-worth',
    severity: 'danger',
    sources: ['general'],
    title: '淨值為負',
    when: (m) => m.totalAssets + m.totalLiabilities > 0 && m.netWorth < 0,
    detail: (m) =>
      `目前負債比資產多 ${formatMoney(-m.netWorth)}。優先處理高利率負債與現金流，暫不適合再增加任何槓桿。`,
  },
  {
    id: 'negative-cashflow',
    severity: 'danger',
    sources: ['general'],
    title: '每月現金流為負',
    when: (m) => m.data.profile.monthlyIncome > 0 && m.monthlySurplus < 0,
    detail: (m) =>
      `每月收入扣掉生活費與還款後短少 ${formatMoney(-m.monthlySurplus)}，正在消耗存款。先把收支打平，再談投資或借貸。`,
  },
  {
    id: 'revolving-debt',
    severity: 'danger',
    sources: ['general'],
    title: '有信用卡循環或高利負債',
    when: (m) => m.debtByKind.revolving > 0,
    detail: (m) =>
      `循環利息通常遠高於股票長期期望報酬，${formatMoney(m.debtByKind.revolving)} 應優先清償，任何投資都很難贏過它。`,
  },
  {
    id: 'emergency-critical',
    severity: 'danger',
    sources: ['31:11'],
    title: '緊急預備金不足 3 個月',
    when: (m) => m.monthlyOutflow > 0 && m.emergencyMonths < 3,
    detail: (m) =>
      `流動資金只夠支付 ${formatMonths(m.emergencyMonths)} 的生活費＋還款。節目壓力測試第二問：被裁員半年沒收入撐得住嗎？建議先存到至少 6 個月。`,
  },
  {
    id: 'emergency-low',
    severity: 'warning',
    sources: ['31:11'],
    title: '緊急預備金未達 6 個月',
    when: (m) => m.monthlyOutflow > 0 && m.emergencyMonths >= 3 && m.emergencyMonths < 6,
    detail: (m) =>
      `目前可撐 ${formatMonths(m.emergencyMonths)}，距離「失業半年也撐得住」還差 ${formatMoney(
        m.monthlyOutflow * 6 - m.liquidAssets,
      )}。`,
  },
  {
    id: 'job-loss-uncovered',
    severity: 'danger',
    sources: ['31:11', '28:32'],
    title: '最差情境下撐不過失業半年',
    when: (m) => m.monthlyOutflow > 0 && !m.stress.severe.coversJobLoss,
    detail: (m) =>
      `股市跌四成（含追繳補錢）後，流動資金只夠撐 ${formatMonths(
        m.stress.severe.survivalMonths,
      )}。真正毀人的是幾件事一起發生，到時只能在低點砍。`,
  },
  {
    id: 'cashflow-after-income-drop',
    severity: 'warning',
    sources: ['31:11'],
    title: '收入掉三成時每月會入不敷出',
    when: (m) => m.monthlySurplus >= 0 && m.stress.severe.monthlyCashflow < 0,
    detail: (m) =>
      `收入減少 30% 時，每月短少 ${formatMoney(-m.stress.severe.monthlyCashflow)}。檢查還款與固定支出是否過高。`,
  },
  {
    id: 'dsr-high',
    severity: 'danger',
    sources: ['general', '21:21'],
    title: '每月還款占收入超過 40%',
    when: (m) => m.dsr !== null && m.dsr > 0.4,
    detail: (m) =>
      `還款負擔比 ${formatPct(m.dsr)}。看負債要連收入、期限一起看，這個比例下收入一有波動就會很吃力。`,
  },
  {
    id: 'dsr-elevated',
    severity: 'warning',
    sources: ['general', '21:21'],
    title: '每月還款占收入 30%–40%',
    when: (m) => m.dsr !== null && m.dsr > 0.3 && m.dsr <= 0.4,
    detail: (m) => `還款負擔比 ${formatPct(m.dsr)}，再增加借款前請先做壓力測試。`,
  },
  {
    id: 'margin-call-near',
    severity: 'danger',
    sources: ['26:32', '15:15'],
    title: '質押／融資離追繳太近',
    when: (m) => m.minTriggerDrop !== null && m.minTriggerDrop < 0.4,
    detail: (m) =>
      `股價只要跌 ${formatPct(m.minTriggerDrop)} 就會跌破 130% 維持率。依市價決定的槓桿最危險：看對趨勢，死在波動。建議降低質押／融資比例，或改用固定本息的借款。`,
  },
  {
    id: 'forced-sell',
    severity: 'danger',
    sources: ['31:11', '28:32'],
    title: '大跌時會被逼著賣股',
    when: (m) => m.stress.severe.forcedSell,
    detail: (m) =>
      `股市跌四成時需補繳 ${formatMoney(m.stress.severe.topUpNeeded)}，超過手上流動資金。壓力測試第三問：大跌時有沒有人會逼你賣股？目前答案是「有」。`,
  },
  {
    id: 'market-debt-no-collateral',
    severity: 'warning',
    sources: ['26:32'],
    title: '質押／融資未填擔保品市值',
    when: (m) => m.marketDebtWithoutCollateral,
    detail: () => '請填入擔保股票的市值，才能計算股價跌多少會被追繳。',
  },
  {
    id: 'market-debt-safe',
    severity: 'good',
    sources: ['26:32'],
    title: '質押比例低，離追繳很遠',
    when: (m) => m.minTriggerDrop !== null && m.minTriggerDrop >= 0.6,
    detail: (m) =>
      `股價要跌 ${formatPct(m.minTriggerDrop)} 才會追繳。低比例、離追繳很遠的質押也可以是安全的，但比較借款時不要只比利率。`,
  },
  {
    id: 'unstable-income-debt',
    severity: 'warning',
    sources: ['29:32', '21:21'],
    title: '收入不穩定卻背負明顯還款',
    when: (m) => m.data.profile.incomeStability === 'unstable' && m.dsr !== null && m.dsr > 0.2,
    detail: () =>
      '借款是把未來現金流搬到今天，關鍵是收入品質。收入波動大時，應保留更多現金並降低固定還款。',
  },
  {
    id: 'deep-drawdown',
    severity: 'warning',
    sources: ['26:01', '35:15'],
    title: '最差情境下淨值縮水超過四成',
    when: (m) => m.stress.severe.netWorthChange !== null && m.stress.severe.netWorthChange <= -0.4,
    detail: (m) =>
      `股市跌四成時淨值會減少 ${formatPct(-m.stress.severe.netWorthChange)}。部位要大到能改變人生軌跡，又不能大到錯一次就毀掉你。`,
  },
  {
    id: 'panic-seller-leverage',
    severity: 'danger',
    sources: ['31:11'],
    title: '自認會「心裡斷頭」卻使用市價槓桿',
    when: (m) => m.data.profile.wouldPanicSell && m.debtByKind.market > 0,
    detail: () => '帳面跌四成你會受不了砍掉，又有質押／融資，等於同時有心理和機制兩種斷頭風險。建議先降槓桿。',
  },
  {
    id: 'panic-seller',
    severity: 'warning',
    sources: ['31:11'],
    title: '帳面跌四成可能會受不了砍掉',
    when: (m) => m.data.profile.wouldPanicSell && m.debtByKind.market === 0 && m.riskAssets > 0,
    detail: () =>
      '壓力測試第四問的答案是「會」。股票比例應調整到自己真的抱得住的程度，不建議借錢投資。',
  },
  {
    id: 'compound-risk',
    severity: 'danger',
    sources: ['28:32', '34:15'],
    title: '多項風險同時存在',
    when: (m) => riskFlags(m) >= 3,
    detail: (m) =>
      `偵測到 ${riskFlags(m)} 項風險因子同時存在。股市大跌＋工作出問題＋貸款繳不出一起發生時，會失去選擇權。長期看好，但資金結構不能讓自己活不到長期。`,
  },
  {
    id: 'no-add-rules',
    severity: 'info',
    sources: ['33:14', '33:44'],
    title: '事先寫好加碼規則',
    when: (m) => !m.data.profile.hasAddRules && m.riskAssets > 0,
    detail: () =>
      '在多頭時就寫好：修正多少時換什麼、換多少、負債最高拉到多少。避免跌下來才臨時腦充血借一大筆錢抄底。',
  },
  {
    id: 'idle-long-term-cash',
    severity: 'info',
    sources: ['34:15', '03:14', '09:59'],
    title: '長期資金已在手，不必等回檔',
    when: (m) => m.idleLongTermCash > 0 && !m.data.profile.wouldPanicSell,
    detail: (m) =>
      `扣掉 6 個月預備金後，約有 ${formatMoney(
        m.idleLongTermCash,
      )} 長期資金閒置。回測中提前一次投入約 7 成時間勝過分 12 個月投入，創新高時也約 74%。新高不是延後的理由，分批只是把擇時風險換成少賺的機會成本。`,
  },
  {
    id: 'human-capital-dominant',
    severity: 'info',
    sources: ['29:32'],
    title: '未來收入是你最大的資產',
    when: (m) => m.humanCapital > 0 && m.humanCapital > Math.max(m.netWorth, 0) * 2,
    detail: (m) =>
      `估計人力資本約 ${formatMoney(m.humanCapital)}，遠大於目前淨值。保護收入（技能、職涯、保險）和投資報酬一樣重要。`,
  },
  {
    id: 'insurance-cash-review',
    severity: 'info',
    sources: ['37:00'],
    title: '檢視儲蓄險是否適合轉為本金',
    when: (m) => m.data.assets.insuranceCash > 0 && m.emergencyMonths >= 6,
    detail: () =>
      '節目聽眾分享：解約儲蓄險增加本金後，本金大就不必冒高風險，容錯率提高。解約前請先確認解約損失與保障需求。',
  },
  {
    id: 'zero-debt-not-goal',
    severity: 'good',
    sources: ['21:21'],
    title: '零負債且現金流健康',
    when: (m) => m.totalLiabilities === 0 && m.emergencyMonths >= 6 && m.monthlySurplus > 0,
    detail: () =>
      '結構很安全。零負債不必是人生終極目標；若有長期投資需求，可用下方試算評估「借多少」，而不是「借不借」。',
  },
  {
    id: 'healthy-structure',
    severity: 'good',
    sources: ['31:11'],
    title: '通過最差情境壓力測試',
    when: (m) =>
      m.monthlyOutflow > 0 &&
      m.stress.severe.coversJobLoss &&
      !m.stress.severe.forcedSell &&
      (m.dsr === null || m.dsr <= 0.3) &&
      m.monthlySurplus >= 0,
    detail: () => '股市跌四成、收入掉三成、失業半年，你仍有選擇權，不會被迫在低點賣出。',
  },
];

export function generateAdvice(metrics) {
  return RULES.filter((r) => r.when(metrics))
    .map((r) => ({
      id: r.id,
      severity: r.severity,
      title: r.title,
      detail: r.detail(metrics),
      sources: r.sources,
    }))
    .sort((a, b) => SEVERITY[a.severity].order - SEVERITY[b.severity].order);
}

export function healthScore(advice) {
  const penalty = advice.reduce((s, a) => s + SEVERITY[a.severity].weight, 0);
  const score = Math.max(0, Math.min(100, 100 - penalty));
  const grade =
    score >= 85 ? '穩健' : score >= 65 ? '尚可' : score >= 40 ? '需要調整' : '高風險';
  return { score, grade };
}
