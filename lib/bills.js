/** Status tagihan bulan berjalan dari transaksi yang punya bill_id. */
export function billStatus(bill, monthRows, now = new Date()) {
  const paid = monthRows.find((r) => r.bill_id === bill.id);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dueDay = Math.min(bill.due_day, lastDay);
  const due = new Date(now.getFullYear(), now.getMonth(), dueDay);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((due - today) / 86400000);
  if (paid) return { state: "paid", due, days, tx: paid };
  if (days < 0) return { state: "late", due, days };
  if (days <= 3) return { state: "soon", due, days };
  return { state: "open", due, days };
}

/**
 * Tagihan kartu kredit / paylater: muncul selama masih ada utang.
 * Jatuh tempo = tanggal due_day berikutnya (bulan ini, atau bulan depan bila sudah lewat).
 */
export function cardBills(accounts, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return accounts
    .filter((a) => a.kind === "credit" && a.balance < -0.004)
    .map((a) => {
      let due = null, days = null;
      if (a.due_day) {
        const clamp = (y, m) => new Date(y, m, Math.min(a.due_day, new Date(y, m + 1, 0).getDate()));
        due = clamp(today.getFullYear(), today.getMonth());
        if (due < today) due = clamp(today.getFullYear(), today.getMonth() + 1);
        days = Math.round((due - today) / 86400000);
      }
      const state = days === null ? "open" : days <= 3 ? "soon" : "open";
      return { account: a, amount: Math.round(-a.balance * 100) / 100, s: { state, due, days } };
    });
}
