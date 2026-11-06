"use client";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useApp } from "@/lib/app-data";
import { periodLabel, periodRange, shiftPeriod } from "@/lib/format";
import { Segmented } from "./ui";

/**
 * Minggu / Bulan (atau Periode gajian) / Tahun / Rentang, plus navigator.
 * Rentang menampilkan dua kolom tanggal; `ctx` = { cycle, range }.
 */
export default function PeriodBar({ period, anchor, onChange, ctx = {}, range, onRange, allowRange = false }) {
  const { t } = useApp();
  const isCurrent = periodRange(period, anchor, ctx).end > new Date();
  const monthLabelText = ctx.cycle && !ctx.cycle.isCalendar ? t("Periode") : t("Bulan");
  const options = [
    { value: "week", label: t("Minggu") },
    { value: "month", label: monthLabelText },
    { value: "year", label: t("Tahun") },
    ...(allowRange ? [{ value: "range", label: t("Rentang") }] : []),
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented value={period} onChange={(p) => onChange(p, new Date())} className={`w-full ${allowRange ? "sm:w-[400px]" : "sm:w-[300px]"}`} options={options} />
      {period === "range" ? (
        <div className="grid flex-1 grid-cols-2 gap-2 sm:max-w-[360px]">
          <label className="relative">
            <span className="sr-only">{t("Dari tanggal")}</span>
            <input type="date" className="field h-11 px-3 text-[16px]" value={range?.from || ""} max={range?.to || undefined}
              onChange={(e) => onRange({ ...range, from: e.target.value })} />
          </label>
          <label className="relative">
            <span className="sr-only">{t("Sampai tanggal")}</span>
            <input type="date" className="field h-11 px-3 text-[16px]" value={range?.to || ""} min={range?.from || undefined}
              onChange={(e) => onRange({ ...range, to: e.target.value })} />
          </label>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-between rounded-full bg-surface p-1 shadow-card sm:max-w-[320px]">
          <button className="grid h-10 w-10 place-items-center rounded-full text-brand-600 active:bg-fill" onClick={() => onChange(period, shiftPeriod(period, anchor, -1, ctx))} aria-label={t("Periode sebelumnya")}>
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="truncate px-1 text-[16px] font-medium capitalize">{periodLabel(period, anchor, ctx)}</span>
          <button className="grid h-10 w-10 place-items-center rounded-full text-brand-600 active:bg-fill disabled:text-control" disabled={isCurrent}
            onClick={() => onChange(period, shiftPeriod(period, anchor, 1, ctx))} aria-label={t("Periode berikutnya")}>
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}

/** Select bergaya chip (filter ringkas, satu baris). */
export function FilterChip({ label, value, onChange, options }) {
  const active = options[0] && value !== options[0].value;
  return (
    <label className={`relative inline-flex h-10 flex-none items-center rounded-full border pl-4 pr-8 text-[14px] font-medium ${active ? "border-brand-600 bg-brand-600 text-white" : "border-transparent bg-fill text-ink"}`}>
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <span aria-hidden="true">{options.find((o) => o.value === value)?.label}</span>
      <svg aria-hidden="true" className="pointer-events-none absolute right-3 h-3 w-3" viewBox="0 0 12 12"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
    </label>
  );
}

/**
 * Pil periode ringkas: ‹ [Nov 2026 ▾] ›. Ketuk label untuk memilih Minggu / Bulan / Tahun / Rentang.
 * Satu baris saja, jadi tidak memakan tempat seperti segmented + navigator.
 */
export function PeriodPill({ period, anchor, onChange, ctx = {}, range, onRange, allowRange = true, className = "" }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const away = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const key = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    window.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", away); window.removeEventListener("keydown", key); };
  }, [open]);

  const { end } = periodRange(period, anchor, ctx);
  const isCurrent = end > new Date();
  const options = [
    { value: "week", label: t("Minggu") },
    { value: "month", label: ctx.cycle && !ctx.cycle.isCalendar ? t("Periode") : t("Bulan") },
    { value: "year", label: t("Tahun") },
    ...(allowRange ? [{ value: "range", label: t("Rentang") }] : []),
  ];
  const navBtn = "grid h-10 w-10 flex-none place-items-center rounded-full text-brand-600 active:bg-fill disabled:text-control";

  return (
    <div ref={ref} className={`relative flex items-center rounded-full bg-surface p-1 shadow-card ${className}`}>
      {period !== "range" && (
        <button className={navBtn} onClick={() => onChange(period, shiftPeriod(period, anchor, -1, ctx))} aria-label={t("Periode sebelumnya")}>
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        className="flex h-10 min-w-0 flex-1 items-center justify-center gap-1 rounded-full px-3 text-[16px] font-semibold active:bg-fill">
        <span className="truncate capitalize">{periodLabel(period, anchor, ctx)}</span>
        <ChevronDown className={`h-4 w-4 flex-none text-ink-soft transition ${open ? "rotate-180" : ""}`} />
      </button>
      {period !== "range" && (
        <button className={navBtn} disabled={isCurrent} onClick={() => onChange(period, shiftPeriod(period, anchor, 1, ctx))} aria-label={t("Periode berikutnya")}>
          <ChevronRight className="h-5 w-5" />
        </button>
      )}

      {open && (
        <div role="menu" className="absolute inset-x-0 top-full z-40 mt-2 animate-pop-in rounded-[16px] bg-raised p-1.5 shadow-float">
          {options.map((o) => (
            <button key={o.value} role="menuitemradio" aria-checked={period === o.value}
              onClick={() => { onChange(o.value, new Date()); if (o.value !== "range") setOpen(false); }}
              className="flex h-11 w-full items-center justify-between rounded-[10px] px-3 text-[16px] active:bg-fill">
              {o.label}
              {period === o.value && <Check className="h-4 w-4 text-brand-600" />}
            </button>
          ))}
          {period === "range" && (
            <div className="grid grid-cols-2 gap-2 px-1.5 pb-1.5 pt-1">
              <label>
                <span className="mb-1 block text-[12px] text-ink-soft">{t("Dari tanggal")}</span>
                <input type="date" className="field h-11 px-3 text-[16px]" value={range?.from || ""} max={range?.to || undefined}
                  onChange={(e) => onRange({ ...range, from: e.target.value })} />
              </label>
              <label>
                <span className="mb-1 block text-[12px] text-ink-soft">{t("Sampai tanggal")}</span>
                <input type="date" className="field h-11 px-3 text-[16px]" value={range?.to || ""} min={range?.from || undefined}
                  onChange={(e) => onRange({ ...range, to: e.target.value })} />
              </label>
            </div>
          )}
          {period !== "range" && !isCurrent && (
            <button onClick={() => { onChange(period, new Date()); setOpen(false); }}
              className="mt-1 flex h-11 w-full items-center rounded-[10px] border-t border-line px-3 text-[16px] text-brand-600 active:bg-fill">
              {t("Kembali ke periode ini")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
