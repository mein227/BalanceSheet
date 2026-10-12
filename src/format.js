// 內部計算一律以「元」為單位；介面輸入與顯示一律以「萬元」為單位。
export const WAN = 10000;

export const yuanToWan = (yuan) => Math.round((Number(yuan) / WAN) * 1e4) / 1e4;

export const wanToYuan = (wan) => {
  const n = Number(wan);
  return Number.isFinite(n) ? Math.round(n * WAN) : 0;
};

export function formatMoney(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  if (!Number.isFinite(value)) return '∞';
  const sign = value < 0 ? '−' : '';
  const wan = Math.abs(value) / WAN;
  if (wan === 0) return '0 萬元';
  return `${sign}${trim(wan)} 萬元`;
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
  const digits = n >= 100 ? 0 : n >= 10 ? 1 : 2;
  const rounded = Number(n.toFixed(digits));
  return rounded === 0 ? '< 0.01' : rounded.toLocaleString('zh-TW', { maximumFractionDigits: digits });
}
