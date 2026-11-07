"use client";
import { useMemo } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useApp } from "@/lib/app-data";
import { formatShort, monthLabel } from "@/lib/format";
import { toISODate } from "@/lib/analytics";

const dayKey = (d) => toISODate(d);
const monthKey = (d) => `${d.getFullYear()}-${d.getMonth()}`;

/**
 * Kalender aktivitas yang mengikuti periode:
 * Minggu → strip 7 hari, Bulan → grid tanggal, Tahun → grid 12 bulan.
 * `rows` = baris statistik (sudah difilter); tiap sel menampilkan total keluar & masuk.
 */
export default function ActivityCalendar({ period, start, end, rows, selected, onSelect, onPickMonth, collapsed, onToggle }) {
  const { hidden, locale, t } = useApp();
  const loc = locale === "en" ? "en-GB" : "id-ID";

  const totals = useMemo(() => {
    const m = {};
    const byMonth = period === "year";
    for (const r of rows) {
      if (r.type !== "expense" && r.type !== "income") continue;
      const d = new Date(r.occurred_at);
      const k = byMonth ? monthKey(d) : dayKey(d);
      m[k] = m[k] || { exp: 0, inc: 0 };
      if (r.type === "expense") m[k].exp += r.amount; else m[k].inc += r.amount;
    }
    return m;
  }, [rows, period]);

  const now = new Date();
  const todayKey = dayKey(now);

  if (period === "year") {
    const y = start.getFullYear();
    return (
      <div className="grid grid-cols-3 gap-2 p-3 sm:grid-cols-4">
        {Array.from({ length: 12 }, (_, m) => {
          const d = new Date(y, m, 1);
          const v = totals[monthKey(d)];
          const future = d > now;
          const current = y === now.getFullYear() && m === now.getMonth();
          return (
            <button key={m} type="button" disabled={future} onClick={() => onPickMonth(new Date(y, m, 15))}
              className={`flex min-h-[72px] flex-col items-start rounded-[14px] px-3 py-2.5 text-left transition active:scale-[.97] disabled:opacity-40 ${current ? "bg-brand-50 ring-1 ring-brand-600" : "bg-fill"}`}>
              <span className={`text-[15px] font-semibold capitalize ${current ? "text-brand-600" : ""}`}>{monthLabel(d, { month: "short" })}</span>
              {v && !hidden && (
                <>
                  {v.exp > 0 && <span className="tabular text-[12px] font-semibold text-expense">−{formatShort(v.exp)}</span>}
                  {v.inc > 0 && <span className="tabular text-[12px] font-semibold text-income">+{formatShort(v.inc)}</span>}
                </>
              )}
              {v && hidden && <span className="mt-1 h-1.5 w-1.5 rounded-full bg-ink-soft" />}
            </button>
          );
        })}
      </div>
    );
  }

  // Minggu / Bulan: grid Senin–Minggu yang mencakup periode (siklus gajian bisa melewati dua bulan)
  const first = new Date(start.getFullYear(), start.getMonth(), start.getDate() - ((start.getDay() + 6) % 7));
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1);
  const cells = [];
  for (let d = new Date(first); d <= last || cells.length % 7; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) cells.push(d);
  let weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  // Diciutkan: hanya minggu yang berisi tanggal terpilih / hari ini
  const focus = selected || (now >= start && now < end ? todayKey : dayKey(start));
  if (collapsed && period === "month") weeks = weeks.filter((w) => w.some((d) => dayKey(d) === focus)).slice(0, 1);
  const weekdays = cells.slice(0, 7).map((d) => d.toLocaleDateString(loc, { weekday: "short" }).replace(".", ""));

  return (
    <div className="px-2 pb-1 pt-3">
      <div className="grid grid-cols-7 pb-1 text-center text-[12px] font-medium uppercase tracking-wide text-ink-soft">
        {weekdays.map((w, i) => <span key={i}>{w}</span>)}
      </div>
      {weeks.map((w, wi) => (
        <div key={wi} className="grid grid-cols-7">
          {w.map((d) => {
            const k = dayKey(d);
            const inRange = d >= start && d < end;
            if (!inRange) return <span key={k} className="h-[60px]" />;
            const v = totals[k];
            const future = d > now && k !== todayKey;
            const sel = selected === k;
            const isToday = k === todayKey;
            const showMonth = d.getDate() === 1 && d > start;
            return (
              <button key={k} type="button" disabled={future} aria-pressed={sel}
                aria-label={d.toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long" })}
                onClick={() => onSelect(sel ? null : k)}
                className="flex h-[60px] flex-col items-center rounded-[12px] pt-1 transition active:scale-95 disabled:opacity-40">
                <span className={`grid h-8 min-w-8 place-items-center rounded-full px-1 text-[16px] tabular ${sel ? "bg-brand-600 font-semibold text-white" : isToday ? "bg-brand-50 font-semibold text-brand-600" : ""}`}>
                  {showMonth ? <span className="text-[13px]">{d.getDate()} {monthLabel(d, { month: "short" })}</span> : d.getDate()}
                </span>
                {v && !hidden && (
                  <span className="mt-0.5 flex flex-col items-center leading-[1.15]">
                    {v.exp > 0 && <span className="tabular text-[10.5px] font-semibold text-expense">−{formatShort(v.exp)}</span>}
                    {v.inc > 0 && <span className="tabular text-[10.5px] font-semibold text-income">+{formatShort(v.inc)}</span>}
                  </span>
                )}
                {v && hidden && <span className="mt-1 h-1.5 w-1.5 rounded-full bg-ink-soft" />}
              </button>
            );
          })}
        </div>
      ))}
      {period === "month" && (
        <button type="button" onClick={onToggle} aria-expanded={!collapsed} aria-label={collapsed ? t("Tampilkan kalender penuh") : t("Ciutkan kalender")}
          className="mx-auto mt-0.5 flex h-7 w-12 items-center justify-center rounded-full text-ink-soft active:bg-fill">
          {collapsed ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
        </button>
      )}
    </div>
  );
}
