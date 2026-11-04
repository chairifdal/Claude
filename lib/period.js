import { getLocale } from "./i18n";

/**
 * Siklus periode keuangan per orang.
 *  - calendar : tanggal 1 s/d akhir bulan
 *  - fixed    : mulai di tanggal tetap (mis. 25 → 25 Okt – 24 Nov)
 *  - salary   : mulai di setiap transaksi gaji. Gaji yang masuk < MIN_GAP hari setelah
 *               awal periode diabaikan (rapel/dipecah). Periode berjalan berakhir di perkiraan
 *               gajian berikutnya (rata-rata 3 jarak terakhir), dan diperpanjang bila gaji telat.
 */
export const MIN_GAP_DAYS = 20;
const DAY = 86400000;

const midnight = (d) => { const x = new Date(d); return new Date(x.getFullYear(), x.getMonth(), x.getDate()); };
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const daysBetween = (a, b) => Math.round((midnight(b) - midnight(a)) / DAY);

/** Tanggal gaji yang memulai periode (urut naik, sudah difilter aturan jarak minimum). */
export function salaryStarts(dates) {
  const sorted = [...new Set(dates.map((d) => midnight(d).getTime()))].sort((a, b) => a - b).map((t) => new Date(t));
  const kept = [];
  for (const d of sorted) if (!kept.length || daysBetween(kept[kept.length - 1], d) >= MIN_GAP_DAYS) kept.push(d);
  return kept;
}

export function makeCycle({ mode = "calendar", day = 25, salaryDates = [] } = {}) {
  const starts = mode === "salary" ? salaryStarts(salaryDates) : [];
  const effective = mode === "salary" && !starts.length ? "calendar" : mode;

  // Rata-rata jarak 3 gajian terakhir untuk memperkirakan gajian berikutnya
  const gaps = starts.slice(-4).map((d, i, a) => (i ? daysBetween(a[i - 1], d) : null)).filter(Boolean);
  const avgGap = gaps.length ? Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length) : null;

  function calendarRange(d) {
    return { start: new Date(d.getFullYear(), d.getMonth(), 1), end: new Date(d.getFullYear(), d.getMonth() + 1, 1) };
  }

  function rangeOf(date) {
    const d = midnight(date);
    if (effective === "fixed") {
      let start = new Date(d.getFullYear(), d.getMonth(), day);
      if (d < start) start = new Date(d.getFullYear(), d.getMonth() - 1, day);
      return { start, end: new Date(start.getFullYear(), start.getMonth() + 1, day) };
    }
    if (effective === "salary") {
      let i = -1;
      for (let k = 0; k < starts.length; k++) if (starts[k] <= d) i = k;
      if (i === -1) {
        // Sebelum gaji pertama tercatat: bulan kalender, dipotong di gaji pertama
        const r = calendarRange(d);
        return { start: r.start, end: starts[0] < r.end ? starts[0] : r.end };
      }
      const start = starts[i];
      if (starts[i + 1]) return { start, end: starts[i + 1] };
      // Periode berjalan: akhir = perkiraan gajian berikutnya; diperpanjang sampai besok kalau gaji telat dicatat
      const predicted = avgGap ? addDays(start, avgGap) : new Date(start.getFullYear(), start.getMonth() + 1, start.getDate());
      const tomorrow = addDays(midnight(new Date()), 1);
      return { start, end: predicted > tomorrow ? predicted : tomorrow, predicted: true, late: daysBetween(predicted, new Date()) > 2 };
    }
    return calendarRange(d);
  }

  function shift(anchor, n) {
    let a = midnight(anchor);
    for (let i = 0; i < Math.abs(n); i++) {
      const r = rangeOf(a);
      a = n < 0 ? addDays(r.start, -1) : r.end;
    }
    return a;
  }

  function label(date, withDays = false) {
    const { start, end } = rangeOf(date);
    if (effective === "calendar") return start.toLocaleDateString(getLocale() === "en" ? "en-GB" : "id-ID", { month: "long", year: "numeric" });
    return rangeLabel(start, end, withDays);
  }

  return { mode: effective, configuredMode: mode, isCalendar: effective === "calendar", rangeOf, shift, label, nextPayday: effective === "salary" && starts.length ? rangeOf(new Date()).end : null };
}

/** "27 Okt – 25 Nov" (+ " · 30 hari") dari rentang [start, end) */
export function rangeLabel(start, end, withDays = false) {
  const loc = getLocale() === "en" ? "en-GB" : "id-ID";
  const last = addDays(end, -1);
  const sameYear = start.getFullYear() === last.getFullYear();
  const f = (x, y) => x.toLocaleDateString(loc, y ? { day: "numeric", month: "short", year: "numeric" } : { day: "numeric", month: "short" });
  const txt = `${f(start, !sameYear)} – ${f(last, !sameYear || last.getFullYear() !== new Date().getFullYear())}`;
  return withDays ? `${txt} · ${daysBetween(start, end)} ${getLocale() === "en" ? "days" : "hari"}` : txt;
}

export { daysBetween, addDays, midnight };
