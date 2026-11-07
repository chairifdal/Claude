// Perhitungan akun investasi: modal, untung/rugi, dan kapan nilainya terakhir diperbarui.
//
// Modal = saldo awal + transfer masuk − transfer keluar (termasuk biaya transfer dari akun ini).
// Nilai = saldo akun sekarang (untuk emas dalam gram: gram × harga per gram).
// Untung/rugi = nilai − modal. Semua yang bukan transfer (Sesuaikan saldo, dividen yang dicatat
// sebagai pemasukan di akun ini, biaya admin sebagai pengeluaran) otomatis masuk ke untung/rugi.

export const STALE_DAYS = 30;
const DAY = 86400000;

/** `txs` = transaksi yang melibatkan akun ini (semua waktu). */
export function investStats(account, txs, now = new Date()) {
  let modal = Number(account.initial_balance) || 0;
  let lastUpdate = null;
  for (const t of txs) {
    if (t.type === "transfer") {
      if (t.to_account_id === account.id) modal += t.amount;
      if (t.account_id === account.id) modal -= t.amount + (t.fee || 0);
    } else if (t.account_id === account.id && t.is_adjustment) {
      const d = new Date(t.occurred_at);
      if (!lastUpdate || d > lastUpdate) lastUpdate = d;
    }
  }
  const value = account.balance;
  const gain = value - modal;
  // Emas dalam gram dinilai lewat harga per gram, bukan lewat Sesuaikan saldo
  const gram = account.unit === "gram";
  const since = lastUpdate || (account.created_at ? new Date(account.created_at) : null);
  const staleDays = gram || !since ? null : Math.floor((now - since) / DAY);
  return {
    modal, value, gain, pct: modal > 0 ? gain / modal : null, lastUpdate,
    stale: staleDays !== null && staleDays > STALE_DAYS, staleDays,
  };
}

/**
 * Seri bulanan (12 bulan sampai `endMonth`) untuk semua akun investasi:
 * dep = setoran bersih dari luar akun investasi; gain = perubahan nilai (semua yang bukan transfer).
 */
export function monthlyInvestSeries(txs, isInv, endMonth, n = 12, label = (d) => String(d.getMonth() + 1)) {
  const months = [];
  for (let i = n - 1; i >= 0; i--) {
    const s = new Date(endMonth.getFullYear(), endMonth.getMonth() - i, 1);
    months.push({ start: s, end: new Date(s.getFullYear(), s.getMonth() + 1, 1), label: label(s), dep: 0, gain: 0 });
  }
  for (const t of txs) {
    const d = new Date(t.occurred_at);
    const m = months.find((x) => d >= x.start && d < x.end);
    if (!m) continue;
    if (t.type === "transfer") {
      const inTo = isInv(t.to_account_id), inFrom = isInv(t.account_id);
      if (inTo && !inFrom) m.dep += t.amount;
      if (inFrom && !inTo) m.dep -= t.amount;
    } else if (isInv(t.account_id)) {
      m.gain += t.type === "income" ? t.amount : -t.amount;
    }
  }
  return months;
}
