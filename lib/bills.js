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
