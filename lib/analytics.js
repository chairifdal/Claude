import { periodRange, shiftPeriod, monthLabel } from "./format";
import { getLocale } from "./i18n";

/** Ember waktu: tahun → 12 bulan; rentang panjang (> 62 hari) → per minggu; lainnya → per hari. */
export function buckets(period, anchor, ctx = {}) {
  const { start, end } = periodRange(period, anchor, ctx);
  const out = [];
  const loc = getLocale() === "en" ? "en-GB" : "id-ID";
  const spanDays = Math.round((end - start) / 86400000);
  if (period === "year") {
    for (let m = 0; m < 12; m++) {
      const s = new Date(start.getFullYear(), m, 1);
      out.push({ start: s, end: new Date(start.getFullYear(), m + 1, 1), label: monthLabel(s, { month: "short" }), total: 0 });
    }
  } else if (spanDays > 62) {
    for (let d = new Date(start); d < end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7)) {
      const e = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7);
      out.push({ start: d, end: e < end ? e : end, label: d.toLocaleDateString(loc, { day: "numeric", month: "short" }), total: 0 });
    }
  } else {
    for (let d = new Date(start); d < end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      const label = period === "week" ? d.toLocaleDateString(loc, { weekday: "short" }) : String(d.getDate());
      out.push({ start: d, end: new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1), label, total: 0 });
    }
  }
  return out;
}

/** n periode terakhir sampai anchor (termasuk), untuk tren antarperiode. */
export function lastPeriods(period, anchor, n, ctx = {}) {
  const list = [];
  for (let i = n - 1; i >= 0; i--) {
    const a = shiftPeriod(period, anchor, -i, ctx);
    const { start, end } = periodRange(period, a, ctx);
    list.push({ anchor: a, start, end, total: 0 });
  }
  return list;
}

export function daysIn(period, anchor, ctx = {}) {
  const { start, end } = periodRange(period, anchor, ctx);
  const now = new Date();
  const until = end > now && start <= now ? new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) : end;
  return Math.max(1, Math.round((until - start) / 86400000));
}

/** Puncak sumbu yang bulat dan di atas nilai maksimum */
export function niceMax(v) {
  if (v <= 0) return 100000;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  for (const s of [1, 2, 2.5, 5, 10]) if (s * pow > v * 1.05) return s * pow;
  return 10 * pow;
}

export const toISODate = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; // taste-skill-ignore: tanggal ISO
};
