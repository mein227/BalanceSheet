export function formatMoney(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  if (!Number.isFinite(value)) return '∞';
  const sign = value < 0 ? '−' : '';
  const abs = Math.abs(value);
  if (abs >= 1e8) return `${sign}${trim(abs / 1e8)} 億`;
  if (abs >= 1e4) return `${sign}${trim(abs / 1e4)} 萬`;
  return `${sign}${Math.round(abs).toLocaleString('zh-TW')} 元`;
}

export function formatPct(ratio, digits = 0) {
  if (ratio === null || ratio === undefined || Number.isNaN(ratio)) return '—';
  if (!Number.isFinite(ratio)) return '∞';
  return `${(ratio * 100).toFixed(digits)}%`;
}

export function formatMonths(months) {
  if (months === null || months === undefined || Number.isNaN(months)) return '—';
  if (!Number.isFinite(months)) return '無支出';
  return `${months.toFixed(1)} 個月`;
}

function trim(n) {
  return Number(n.toFixed(n >= 100 ? 0 : n >= 10 ? 1 : 2)).toLocaleString('zh-TW');
}
