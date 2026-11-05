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
