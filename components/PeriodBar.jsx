"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useApp } from "@/lib/app-data";
import { periodLabel, periodRange, shiftPeriod } from "@/lib/format";
import { Segmented } from "./ui";

/** Satu baris: Minggu/Bulan/Tahun + navigator periode. */
export default function PeriodBar({ period, anchor, onChange }) {
  const { t } = useApp();
  const isCurrent = periodRange(period, anchor).end > new Date();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented value={period} onChange={(p) => onChange(p, new Date())} className="w-full sm:w-[300px]" options={[
        { value: "week", label: t("Minggu") },
        { value: "month", label: t("Bulan") },
        { value: "year", label: t("Tahun") },
      ]} />
      <div className="flex flex-1 items-center justify-between rounded-full bg-surface p-1 shadow-card sm:max-w-[320px]">
        <button className="grid h-10 w-10 place-items-center rounded-full text-brand-600 active:bg-fill" onClick={() => onChange(period, shiftPeriod(period, anchor, -1))} aria-label={t("Periode sebelumnya")}>
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-[16px] font-medium capitalize">{periodLabel(period, anchor)}</span>
        <button className="grid h-10 w-10 place-items-center rounded-full text-brand-600 active:bg-fill disabled:text-control" disabled={isCurrent}
          onClick={() => onChange(period, shiftPeriod(period, anchor, 1))} aria-label={t("Periode berikutnya")}>
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
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
