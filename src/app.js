import {
  ASSET_FIELDS,
  DEBT_TYPES,
  INCOME_STABILITY,
  STRESS_SCENARIOS,
  analyze,
  leverageSimulation,
  normalize,
} from './calc.js';
import { SEVERITY, generateAdvice, healthScore } from './advice.js';
import { EMPTY_DATA, EXAMPLES } from './examples.js';
import { formatMoney, formatMonths, formatPct, wanToYuan, yuanToWan } from './format.js';

const STORAGE_KEY = 'life-balance-sheet:v1';
const $ = (sel, root = document) => root.querySelector(sel);

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch {
    /* 資料損毀時改用空白資料 */
  }
  return normalize(structuredClone(EMPTY_DATA));
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* 無痕模式等情況可能無法儲存 */
  }
}

function getPath(obj, path) {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

function setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => (o[k] ??= {}), obj);
  target[last] = value;
}

function setHint(input) {
  const hint = input.closest('.field')?.querySelector('.hint');
  if (!hint) return;
  const yuan = wanToYuan(input.value);
  hint.textContent = yuan > 0 ? `＝ ${yuan.toLocaleString('zh-TW')} 元` : '';
}

const readInput = (el) => (el.hasAttribute('data-money') ? wanToYuan(el.value) : Number(el.value));
const showMoney = (yuan) => (yuan ? yuanToWan(yuan) : '');

/* ---------- 表單建立 ---------- */

function buildStaticForm() {
  const stability = $('#stability-select');
  for (const [key, meta] of Object.entries(INCOME_STABILITY)) {
    stability.add(new Option(meta.label, key));
  }

  const assetWrap = $('#asset-fields');
  for (const [key, meta] of Object.entries(ASSET_FIELDS)) {
    const label = document.createElement('label');
    label.className = 'field';
    label.innerHTML = `<span>${meta.label}</span>
      <input type="number" min="0" step="any" inputmode="decimal" data-money data-path="assets.${key}" />
      <small class="hint"></small>`;
    assetWrap.append(label);
  }

  const select = $('#example-select');
  for (const [key, ex] of Object.entries(EXAMPLES)) select.add(new Option(ex.label, key));
}

function fillForm() {
  for (const input of document.querySelectorAll('#balance-form [data-path]')) {
    const value = getPath(state, input.dataset.path);
    if (input.type === 'checkbox') input.checked = Boolean(value);
    else if (input.tagName === 'SELECT') input.value = value;
    else if (input.hasAttribute('data-money')) input.value = showMoney(value);
    else input.value = value || '';
    setHint(input);
  }
  renderDebts();
}

function renderDebts() {
  const list = $('#debt-list');
  list.innerHTML = '';
  const tpl = $('#debt-template');
  state.liabilities.forEach((debt, index) => {
    const row = tpl.content.firstElementChild.cloneNode(true);
    row.dataset.index = index;
    const typeSelect = row.querySelector('[data-debt="type"]');
    for (const [key, meta] of Object.entries(DEBT_TYPES)) typeSelect.add(new Option(meta.label, key));
    for (const input of row.querySelectorAll('[data-debt]')) {
      const v = debt[input.dataset.debt];
      if (input.dataset.debt === 'type' || input.dataset.debt === 'name') input.value = v;
      else if (input.hasAttribute('data-money')) input.value = showMoney(v);
      else input.value = v || '';
    }
    row.classList.toggle('is-market', DEBT_TYPES[debt.type].kind === 'market');
    list.append(row);
  });
  if (!state.liabilities.length) {
    list.innerHTML = '<p class="empty">目前沒有負債。</p>';
  }
}

/* ---------- 事件 ---------- */

function bindEvents() {
  const form = $('#balance-form');
  form.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.path) {
      const value = el.type === 'checkbox' ? el.checked : el.tagName === 'SELECT' ? el.value : readInput(el);
      setPath(state, el.dataset.path, value);
      setHint(el);
    } else if (el.dataset.debt) {
      const index = Number(el.closest('.debt-row').dataset.index);
      const key = el.dataset.debt;
      state.liabilities[index][key] = key === 'type' || key === 'name' ? el.value : readInput(el);
      if (key === 'type') {
        el.closest('.debt-row').classList.toggle('is-market', DEBT_TYPES[el.value].kind === 'market');
      }
    }
    update();
  });

  $('#debt-list').addEventListener('click', (e) => {
    const btn = e.target.closest('.remove');
    if (!btn) return;
    state.liabilities.splice(Number(btn.closest('.debt-row').dataset.index), 1);
    renderDebts();
    update();
  });

  $('#btn-add-debt').addEventListener('click', () => {
    state.liabilities.push({ type: 'personal', name: '', balance: 0, rate: 0, monthlyPayment: 0, collateralValue: 0 });
    renderDebts();
    $('#debt-list .debt-row:last-child input[data-debt="name"]')?.focus();
    update();
  });

  $('#example-select').addEventListener('change', (e) => {
    const ex = EXAMPLES[e.target.value];
    if (!ex) return;
    state = normalize(structuredClone(ex.data));
    e.target.value = '';
    fillForm();
    update();
  });

  $('#btn-reset').addEventListener('click', () => {
    if (!confirm('確定要清除所有資料嗎？')) return;
    state = normalize(structuredClone(EMPTY_DATA));
    fillForm();
    update();
  });

  $('#btn-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `life-balance-sheet-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  $('#file-import').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      state = normalize(JSON.parse(await file.text()));
      fillForm();
      update();
    } catch {
      alert('無法讀取這個檔案，請確認是本工具匯出的 JSON。');
    }
    e.target.value = '';
  });

  $('#lev-form').addEventListener('input', update);
}

/* ---------- 結果渲染 ---------- */

function update() {
  saveState();
  const m = analyze(state);
  const advice = generateAdvice(m);
  const hasData = m.totalAssets > 0 || m.totalLiabilities > 0 || m.data.profile.monthlyIncome > 0;

  renderScore(hasData ? healthScore(advice) : null, advice);
  renderMetrics(m);
  renderSheet(m);
  renderStress(m);
  renderAdvice(hasData ? advice : []);
  renderLeverage(m);
}

function renderScore(result, advice) {
  const ring = $('#score-ring');
  if (!result) {
    $('#score-value').textContent = '—';
    $('#score-grade').textContent = '請先填寫資料';
    $('#score-summary').textContent = '可以從右上角「載入範例」開始。';
    ring.style.setProperty('--score', 0);
    ring.dataset.level = '';
    return;
  }
  const counts = advice.reduce((c, a) => ({ ...c, [a.severity]: (c[a.severity] ?? 0) + 1 }), {});
  $('#score-value').textContent = result.score;
  $('#score-grade').textContent = result.grade;
  $('#score-summary').textContent = `高風險 ${counts.danger ?? 0} 項・注意 ${counts.warning ?? 0} 項・建議 ${
    counts.info ?? 0
  } 項`;
  ring.style.setProperty('--score', result.score);
  ring.dataset.level = result.score >= 85 ? 'good' : result.score >= 65 ? 'ok' : result.score >= 40 ? 'warn' : 'bad';
}

function metricCard(label, value, note, tone = '') {
  return `<div class="metric ${tone}"><p class="metric-label">${label}</p><p class="metric-value">${value}</p><p class="metric-note">${note}</p></div>`;
}

function renderMetrics(m) {
  const tone = (bad, warn) => (bad ? 'bad' : warn ? 'warn' : 'good');
  $('#metrics').innerHTML = [
    metricCard('淨值', formatMoney(m.netWorth), '資產 − 負債', m.netWorth < 0 ? 'bad' : ''),
    metricCard('人生淨值', formatMoney(m.lifeNetWorth), `含未來收入 ${formatMoney(m.humanCapital)}`),
    metricCard(
      '緊急預備金',
      formatMonths(m.emergencyMonths),
      '流動資金 ÷ 每月支出與還款',
      m.monthlyOutflow > 0 ? tone(m.emergencyMonths < 3, m.emergencyMonths < 6) : '',
    ),
    metricCard(
      '還款負擔比',
      formatPct(m.dsr),
      '每月還款 ÷ 收入',
      m.dsr === null ? '' : tone(m.dsr > 0.4, m.dsr > 0.3),
    ),
    metricCard('負債比', formatPct(m.debtRatio), '總負債 ÷ 總資產', m.debtRatio === null ? '' : tone(m.debtRatio > 0.7, m.debtRatio > 0.5)),
    metricCard(
      '追繳距離',
      m.minTriggerDrop === null ? '無市價槓桿' : `跌 ${formatPct(m.minTriggerDrop)}`,
      '質押／融資跌破維持率',
      m.minTriggerDrop === null ? '' : tone(m.minTriggerDrop < 0.4, m.minTriggerDrop < 0.6),
    ),
    metricCard(
      '每月結餘',
      formatMoney(m.monthlySurplus),
      `儲蓄率 ${formatPct(m.savingsRate)}`,
      m.data.profile.monthlyIncome ? tone(m.monthlySurplus < 0, m.savingsRate < 0.1) : '',
    ),
    metricCard(
      '目標進度',
      formatPct(m.targetProgress),
      m.data.profile.targetNetWorth ? `目標 ${formatMoney(m.data.profile.targetNetWorth)}` : '尚未設定目標',
    ),
  ].join('');
}

function sheetRows(rows) {
  return rows
    .filter((r) => r.always || r.value)
    .map(
      (r) =>
        `<div class="sheet-row ${r.cls ?? ''}"><span>${r.label}</span><span>${formatMoney(r.value)}</span></div>`,
    )
    .join('');
}

function renderSheet(m) {
  const a = m.data.assets;
  const assetRows = [];
  const groups = { liquid: '流動資產', risk: '風險投資', invest: '穩健投資', use: '自用資產' };
  for (const [group, title] of Object.entries(groups)) {
    const items = Object.entries(ASSET_FIELDS).filter(([k, meta]) => meta.group === group && a[k]);
    if (!items.length) continue;
    assetRows.push({ label: title, value: items.reduce((s, [k]) => s + a[k], 0), cls: 'group', always: true });
    for (const [k, meta] of items) assetRows.push({ label: meta.label, value: a[k], cls: 'item' });
  }
  assetRows.push({ label: '資產合計', value: m.totalAssets, cls: 'total', always: true });
  assetRows.push({ label: '＋ 人力資本（未來收入折現）', value: m.humanCapital, cls: 'human', always: true });

  const liabRows = m.data.liabilities.map((l) => ({
    label: `${escapeHtml(l.name || DEBT_TYPES[l.type].label)}<em>${DEBT_TYPES[l.type].label}</em>`,
    value: l.balance,
    cls: `item kind-${DEBT_TYPES[l.type].kind}`,
  }));
  liabRows.push({ label: '負債合計', value: m.totalLiabilities, cls: 'total', always: true });
  liabRows.push({ label: '淨值', value: m.netWorth, cls: 'equity', always: true });
  liabRows.push({ label: '人生淨值', value: m.lifeNetWorth, cls: 'human', always: true });

  $('#sheet').innerHTML = `
    <div class="sheet-col"><h3>資產</h3>${sheetRows(assetRows)}</div>
    <div class="sheet-col"><h3>負債與淨值</h3>${sheetRows(liabRows)}</div>`;

  const total = Math.max(m.totalAssets, m.totalLiabilities, 1);
  const seg = (value, cls, label) =>
    value > 0
      ? `<span class="seg ${cls}" style="flex-grow:${value / total}" title="${label} ${formatMoney(value)}"></span>`
      : '';
  const equity = Math.max(0, m.netWorth);
  $('#bars').innerHTML = m.totalAssets + m.totalLiabilities > 0
    ? `<div class="bar-row"><span class="bar-label">資產</span><div class="bar">
        ${seg(m.liquidAssets, 'liquid', '流動資產')}${seg(m.riskAssets, 'risk', '風險投資')}
        ${seg(m.investAssets - m.riskAssets, 'invest', '穩健投資')}${seg(m.useAssets, 'use', '自用資產')}</div></div>
      <div class="bar-row"><span class="bar-label">來源</span><div class="bar">
        ${seg(m.debtByKind.fixed, 'fixed', '固定本息負債')}${seg(m.debtByKind.market, 'market', '市價槓桿')}
        ${seg(m.debtByKind.revolving, 'revolving', '循環負債')}${seg(equity, 'equity', '淨值')}</div></div>
      <div class="legend">
        <span class="liquid">流動</span><span class="risk">風險投資</span><span class="invest">穩健投資</span><span class="use">自用</span>
        <span class="fixed">固定本息負債</span><span class="market">質押／融資</span><span class="revolving">循環負債</span><span class="equity">淨值</span>
      </div>`
    : '';
}

function badge(status) {
  const map = { pass: ['通過', 'good'], warn: ['勉強', 'warn'], fail: ['未通過', 'bad'], na: ['不適用', ''] };
  const [text, cls] = map[status];
  return `<span class="badge ${cls}">${text}</span>`;
}

function renderStress(m) {
  const s = m.stress.severe;
  const p = m.data.profile;
  const hasOutflow = m.monthlyOutflow > 0;
  const triggered = s.marginCalls.filter((c) => c.triggered);

  const q1 = !hasOutflow ? 'na' : s.monthlyCashflowNoIncomeDrop < 0 || s.forcedSell ? 'fail' : s.topUpNeeded > 0 ? 'warn' : 'pass';
  const q2 = !hasOutflow ? 'na' : !s.coversJobLoss ? 'fail' : s.monthlyCashflow < 0 ? 'warn' : 'pass';
  const q3 = s.forcedSell ? 'fail' : triggered.length ? 'warn' : 'pass';
  const q4 = m.riskAssets === 0 ? 'na' : p.wouldPanicSell ? 'fail' : 'pass';

  const items = [
    [
      '明年股票跌三、四成，每月還款還能輕鬆付嗎？',
      q1,
      `每月結餘 ${formatMoney(s.monthlyCashflowNoIncomeDrop)}${s.topUpNeeded ? `，另需補繳追繳 ${formatMoney(s.topUpNeeded)}` : ''}。`,
    ],
    [
      '同一年收入掉三成，甚至被裁員半年，生活費＋還款撐得住嗎？',
      q2,
      `收入 −30% 時每月 ${formatMoney(s.monthlyCashflow)}；完全沒收入可撐 ${formatMonths(s.survivalMonths)}。`,
    ],
    [
      '大跌時有沒有銀行、券商或任何人會逼你賣股？',
      q3,
      triggered.length
        ? `${triggered.map((c) => escapeHtml(c.name)).join('、')} 會被追繳${s.forcedSell ? '，且現金不夠補' : '，現金還補得起'}。`
        : '固定本息借款不會因股價下跌被追繳。',
    ],
    ['帳面跌四成，你自己會不會受不了砍掉？', q4, p.wouldPanicSell ? '你勾選了「可能會賣掉」。' : '你認為自己抱得住。'],
  ];
  $('#stress-questions').innerHTML = items
    .map(([q, st, d]) => `<li><div class="q-head"><span>${q}</span>${badge(st)}</div><p class="muted">${d}</p></li>`)
    .join('');

  const e = m.stress.extreme;
  const row = (label, f) => `<tr><th scope="row">${label}</th><td>${f(s)}</td><td>${f(e)}</td></tr>`;
  $('#stress-table').innerHTML = `
    <thead><tr><th></th><th>${STRESS_SCENARIOS.severe.label}</th><th>${STRESS_SCENARIOS.extreme.label}</th></tr></thead>
    <tbody>
      ${row('風險資產損失', (x) => formatMoney(-x.riskLoss))}
      ${row('淨值變化', (x) => `${formatMoney(x.netWorthAfter)}（${formatPct(x.netWorthChange)}）`)}
      ${row('追繳需補錢', (x) => formatMoney(x.topUpNeeded))}
      ${row('收入下降後每月現金流', (x) => formatMoney(x.monthlyCashflow))}
      ${row('失業可撐', (x) => formatMonths(x.survivalMonths))}
      ${row('被迫賣股', (x) => (x.forcedSell ? '<span class="badge bad">會</span>' : '<span class="badge good">不會</span>'))}
    </tbody>`;
}

function renderAdvice(advice) {
  const list = $('#advice-list');
  if (!advice.length) {
    list.innerHTML = '<li class="empty">填入資料後，這裡會列出分析與建議。</li>';
    return;
  }
  list.innerHTML = advice
    .map((a) => {
      const sources = a.sources
        .map((s) => `<span class="source">${s === 'general' ? '一般理財原則' : `EP435 ${s}`}</span>`)
        .join('');
      return `<li class="advice ${a.severity}">
        <div class="advice-head"><span class="badge ${a.severity}">${SEVERITY[a.severity].label}</span><strong>${a.title}</strong></div>
        <p>${a.detail}</p><div class="sources">${sources}</div></li>`;
    })
    .join('');
}

function renderLeverage(m) {
  const f = new FormData($('#lev-form'));
  const v = (k) => Number(f.get(k));
  const sim = leverageSimulation({
    monthlyAmount: wanToYuan(f.get('monthlyAmount')),
    annualRate: v('annualRate') / 100,
    months: v('months'),
    expectedReturn: v('expectedReturn') / 100,
    holdYears: v('holdYears'),
    worstDrop: v('worstDrop') / 100,
    targetNetWorth: m.data.profile.targetNetWorth,
    netWorth: m.netWorth,
  });

  $('#lev-summary').innerHTML = `
    <div><p class="metric-label">今天最多能借（年金現值）</p><p class="metric-value">${formatMoney(sim.borrowable)}</p>
      <p class="metric-note">總利息 ${formatMoney(sim.totalInterest)}；不能借滿 ${formatMoney(wanToYuan(f.get('monthlyAmount')) * v('months'))} 再另付利息</p></div>
    <div><p class="metric-label">借滿一次買 vs 定期定額（期望值）</p><p class="metric-value">${formatMoney(sim.fullExtra)}</p>
      <p class="metric-note">${v('holdYears')} 年後的期望差距</p></div>
    <div><p class="metric-label">最差情境立刻下跌 ${v('worstDrop')}%</p><p class="metric-value neg">${formatMoney(-sim.fullWorstLoss)}</p>
      <p class="metric-note">借滿時的帳面虧損</p></div>`;

  const ratioLabel = { 0: '不借', 0.3: '借三成', 0.5: '借一半', 1: '借滿' };
  const note = (r) => {
    if (r.ratio === 0) return '零風險，也零加速';
    const notes = [];
    if (r.shareOfTarget !== null && r.shareOfTarget < 0.02) notes.push('對目標影響不到 2%，戰略價值低');
    if (r.worstLossShareOfNetWorth !== null && r.worstLossShareOfNetWorth > 0.3) notes.push('錯一次會傷到淨值三成以上');
    if (r.ratio === 0.5) notes.push('妥協解，不是最佳解');
    return notes.join('；') || '—';
  };
  $('#lev-table').innerHTML = `
    <thead><tr><th>方案</th><th>借款金額</th><th>期望多賺</th><th>占人生目標</th><th>最差情境虧損</th><th>占目前淨值</th><th class="note">提醒</th></tr></thead>
    <tbody>${sim.rows
      .map(
        (r) => `<tr><th scope="row">${ratioLabel[r.ratio]}</th><td>${formatMoney(r.borrowed)}</td>
          <td>${formatMoney(r.extraGain)}</td><td>${formatPct(r.shareOfTarget, 2)}</td>
          <td class="neg">${formatMoney(-r.worstLoss)}</td><td>${formatPct(r.worstLossShareOfNetWorth, 1)}</td>
          <td class="note">${note(r)}</td></tr>`,
      )
      .join('')}</tbody>`;
}

buildStaticForm();
fillForm();
bindEvents();
update();
