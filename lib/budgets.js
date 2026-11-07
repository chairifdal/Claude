import { addDays, midnight } from "./period";

export const BUDGET_PERIODS = ["daily", "weekly", "monthly"];
export const PERIOD_LABEL = { daily: "Harian", weekly: "Mingguan", monthly: "Bulanan" };

/** Rentang [start, end) anggaran untuk hari ini: hari ini, minggu ini (Senin–Minggu), atau periode keuangan. */
export function budgetWindow(period, now, cycle) {
  const today = midnight(now);
  if (period === "daily") return { start: today, end: addDays(today, 1) };
  if (period === "weekly") {
    const start = addDays(today, -((today.getDay() + 6) % 7)); // Senin
    return { start, end: addDays(start, 7) };
  }
  return cycle.rangeOf(now);
}

export const periodOf = (b) => b.period || "monthly";

const DAY = 86400000;
const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/**
 * Batas anggaran untuk rentang [start, end): harian × jumlah hari, mingguan × hari/7,
 * bulanan apa adanya bila rentangnya satu periode bulan, selain itu diprorata per hari.
 */
export function budgetLimitFor(b, start, end, wholeMonth) {
  const days = Math.max(1, Math.round((end - start) / DAY));
  const p = periodOf(b);
  if (p === "daily") return b.amount * days;
  if (p === "weekly") return (b.amount * days) / 7;
  return wholeMonth ? b.amount : (b.amount * days) / 30.4375;
}

/** Bagian rentang yang sudah berjalan (per hari, termasuk hari ini): 0..1 */
export function elapsedRatio(start, end, now = new Date()) {
  if (now >= end) return 1;
  if (now < start) return 0;
  const days = Math.max(1, Math.round((end - start) / DAY));
  return Math.min(1, (Math.floor((now - start) / DAY) + 1) / days);
}

/**
 * Laporan anggaran untuk sebuah rentang. Semua jenis anggaran (harian/mingguan/bulanan) dihitung.
 * `rows` = baris pengeluaran (sudah difilter statistik) di rentang itu; `rootOf(categoryId)` → kategori induk.
 * Hasil: { items, limit, spent, rate, pace, state } — state: none | ok | fast | over.
 */
export function budgetReport({ budgets, categoryById, rows, rootOf, start, end, wholeMonth, now = new Date() }) {
  const byCat = {};
  for (const b of budgets) {
    const cat = categoryById[b.category_id];
    if (!cat) continue;
    const x = (byCat[cat.id] = byCat[cat.id] || { id: cat.id, cat, limit: Infinity, budgets: [], spent: 0, days: {} });
    // Satu kategori bisa punya beberapa anggaran (mis. harian & bulanan): pakai batas yang paling ketat
    x.limit = Math.min(x.limit, budgetLimitFor(b, start, end, wholeMonth));
    x.budgets.push(b);
  }
  for (const r of rows) {
    const root = rootOf(r.category_id);
    const x = root && byCat[root.id];
    if (!x) continue;
    x.spent += r.amount;
    const k = dayKey(new Date(r.occurred_at));
    x.days[k] = (x.days[k] || 0) + r.amount;
  }
  const todayK = dayKey(now);
  const todayIn = now >= start && now < end;
  const lastDay = now < end ? now : new Date(end.getTime() - 1);
  const items = Object.values(byCat).map((x) => {
    const daily = x.budgets.find((b) => periodOf(b) === "daily");
    let dailyStats = null;
    if (daily) {
      // Hari-hari yang sudah lewat (sampai hari ini) di rentang ini
      let n = 0, over = 0;
      for (let d = new Date(start); d <= lastDay && d < end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
        n++;
        if ((x.days[dayKey(d)] || 0) > daily.amount) over++;
      }
      dailyStats = { amount: daily.amount, days: n, over, avg: n ? x.spent / n : 0, today: todayIn ? x.days[todayK] || 0 : null };
    }
    return { id: x.id, cat: x.cat, budgets: x.budgets, limit: x.limit, spent: x.spent, rate: x.limit ? x.spent / x.limit : 0, daily: dailyStats };
  }).sort((a, b) => b.rate - a.rate);
  const limit = items.reduce((s, x) => s + x.limit, 0);
  const spent = items.reduce((s, x) => s + x.spent, 0);
  const rate = limit ? spent / limit : null;
  const pace = elapsedRatio(start, end, now);
  const state = rate === null ? "none" : rate > 1 ? "over" : rate > pace + 0.05 ? "fast" : "ok";
  return { items, limit, spent, rate, pace, state, over: items.filter((x) => x.spent > x.limit).length };
}
