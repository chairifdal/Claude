const idr = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

export function formatIDR(value, { sign = false, compact = false } = {}) {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  let body;
  if (compact && abs >= 1_000_000_000) body = `${(abs / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} M`;
  else if (compact && abs >= 1_000_000) body = `${(abs / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
  else if (compact && abs >= 1_000) body = `${(abs / 1_000).toLocaleString("id-ID", { maximumFractionDigits: 0 })} rb`;
  else body = idr.format(abs);
  const prefix = n < 0 ? "-" : sign && n > 0 ? "+" : "";
  return `${prefix}Rp ${body}`;
}

/** "1.250.000" -> 1250000 */
export function parseAmount(text) {
  const digits = String(text || "").replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

export function groupDigits(text) {
  const n = parseAmount(text);
  return n ? idr.format(n) : "";
}

export function monthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start, end };
}

const dayFmt = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long" });
export function dayLabel(d) {
  const date = new Date(d);
  const today = new Date();
  const y = new Date(); y.setDate(today.getDate() - 1);
  const same = (a, b) => a.toDateString() === b.toDateString();
  if (same(date, today)) return "Hari ini";
  if (same(date, y)) return "Kemarin";
  return dayFmt.format(date);
}

export function timeLabel(d) {
  return new Date(d).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

export function monthLabel(d, opts = { month: "long", year: "numeric" }) {
  return new Date(d).toLocaleDateString("id-ID", opts);
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
