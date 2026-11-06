import { getLocale, translate as t } from "./i18n";
import { rangeLabel } from "./period";

const idInt = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const idDec = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateLocale = () => (getLocale() === "en" ? "en-GB" : "id-ID");

/** Rupiah selalu ditulis gaya Indonesia (Rp 1.250.000,50; ringkas: 12 rb, 1,5 jt, 2 M) di semua bahasa. */
export function formatIDR(value, { sign = false, compact = false } = {}) {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  const short = (v, unit) => `${v.toLocaleString("id-ID", { maximumFractionDigits: 1 })} ${unit}`;
  let body;
  if (compact && abs >= 1_000_000_000) body = short(abs / 1_000_000_000, "M");
  else if (compact && abs >= 1_000_000) body = short(abs / 1_000_000, "jt");
  else if (compact && abs >= 1_000) body = `${idInt.format(Math.round(abs / 1_000))} rb`;
  else body = Number.isInteger(Math.round(abs * 100) / 100) ? idInt.format(abs) : idDec.format(abs);
  const prefix = n < 0 ? "-" : sign && n > 0 ? "+" : "";
  return `${prefix}Rp ${body}`;
}

/** Angka super ringkas tanpa "Rp" untuk sel kalender: 850, 85rb, 1,5jt, 2M */
export function formatShort(value) {
  const abs = Math.abs(Number(value) || 0);
  const f = (v) => v.toLocaleString("id-ID", { maximumFractionDigits: v < 10 ? 1 : 0 });
  if (abs >= 1_000_000_000) return `${f(abs / 1_000_000_000)}M`;
  if (abs >= 1_000_000) return `${f(abs / 1_000_000)}jt`;
  if (abs >= 1_000) return `${Math.round(abs / 1_000)}rb`;
  return String(Math.round(abs));
}

/** "1.250.000,5" → 1250000.5 (titik = ribuan, koma = desimal) */
export function parseAmount(text) {
  const s = String(text || "");
  const [intPart, decPart = ""] = s.split(",");
  const i = intPart.replace(/[^\d]/g, "");
  const d = decPart.replace(/[^\d]/g, "").slice(0, 2);
  if (!i && !d) return 0;
  return Number(`${i || "0"}.${d || "0"}`);
}

/**
 * Format saat mengetik: ribuan dengan titik, desimal dengan koma (maks. 2 angka).
 * Titik yang diketik pengguna di akhir dianggap koma desimal.
 */
export function formatAmountInput(raw, prev = "") {
  let s = String(raw || "");
  if (s.length > prev.length && s.endsWith(".") && !prev.includes(",")) s = s.slice(0, -1) + ",";
  const hasComma = s.includes(",");
  const [intRaw, decRaw = ""] = s.split(",");
  const intDigits = intRaw.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
  const dec = decRaw.replace(/[^\d]/g, "").slice(0, 2);
  if (!intDigits && !hasComma) return "";
  const grouped = intDigits ? idInt.format(Number(intDigits)) : "0";
  return hasComma ? `${grouped},${dec}` : grouped;
}

/** Nilai angka → teks input ("1250000.5" → "1.250.000,50") */
export function amountToInput(n) {
  const v = Number(n) || 0;
  if (!v) return "";
  return Number.isInteger(v) ? idInt.format(v) : idDec.format(v);
}

// kompatibilitas lama
export const groupDigits = (text) => formatAmountInput(text);

export function monthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start, end };
}

/**
 * Rentang periode: week (Senin–Minggu), month (bulan kalender atau siklus gajian bila ctx.cycle),
 * year, atau range (rentang tanggal bebas dari ctx.range = { from, to } dalam format YYYY-MM-DD).
 */
export function periodRange(period, anchor = new Date(), ctx = {}) {
  const d = new Date(anchor);
  if (period === "range" && ctx.range?.from && ctx.range?.to) {
    const from = new Date(`${ctx.range.from}T00:00:00`), to = new Date(`${ctx.range.to}T00:00:00`);
    const [a, b] = from <= to ? [from, to] : [to, from];
    return { start: a, end: new Date(b.getFullYear(), b.getMonth(), b.getDate() + 1) };
  }
  if (period === "week") {
    const day = (d.getDay() + 6) % 7; // Senin = 0
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
    return { start, end: new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7) };
  }
  if (period === "year") return { start: new Date(d.getFullYear(), 0, 1), end: new Date(d.getFullYear() + 1, 0, 1) };
  if (ctx.cycle) { const r = ctx.cycle.rangeOf(d); return { start: r.start, end: r.end }; }
  return monthRange(d);
}

export function shiftPeriod(period, anchor, n, ctx = {}) {
  const d = new Date(anchor);
  if (period === "week") return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7 * n);
  if (period === "year") return new Date(d.getFullYear() + n, 0, 1);
  if (period === "range") return d;
  if (ctx.cycle) return ctx.cycle.shift(d, n);
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function periodLabel(period, anchor, ctx = {}) {
  const { start, end } = periodRange(period, anchor, ctx);
  if (period === "year") return String(start.getFullYear());
  if (period === "month" && ctx.cycle && !ctx.cycle.isCalendar) return rangeLabel(start, end);
  if (period === "week" || period === "range") return rangeLabel(start, end);
  return monthLabel(start);
}

export function dayLabel(d) {
  const date = new Date(d);
  const today = new Date();
  const y = new Date(); y.setDate(today.getDate() - 1);
  const same = (a, b) => a.toDateString() === b.toDateString();
  if (same(date, today)) return t("Hari ini");
  if (same(date, y)) return t("Kemarin");
  return date.toLocaleDateString(dateLocale(), { weekday: "long", day: "numeric", month: "long" });
}

export function timeLabel(d) {
  return new Date(d).toLocaleTimeString(dateLocale(), { hour: "2-digit", minute: "2-digit" });
}

export function monthLabel(d, opts = { month: "long", year: "numeric" }) {
  return new Date(d).toLocaleDateString(dateLocale(), opts);
}

/** value for <input type="datetime-local"> in local time */
export function toLocalInput(d = new Date()) {
  const date = new Date(d);
  const off = date.getTimezoneOffset();
  return new Date(date.getTime() - off * 60000).toISOString().slice(0, 16);
}

export function firstName(profile) {
  const n = profile?.full_name || profile?.email || "";
  return n.split(/[ @]/)[0];
}
