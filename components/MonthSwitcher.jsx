"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { monthLabel } from "@/lib/format";
import { useT } from "@/lib/i18n";

export default function MonthSwitcher({ value, onChange }) {
  const t = useT();
  const shift = (n) => onChange(new Date(value.getFullYear(), value.getMonth() + n, 1));
  const now = new Date();
  const isCurrent = value.getFullYear() === now.getFullYear() && value.getMonth() === now.getMonth();
  return (
    <div className="flex items-center justify-between rounded-full bg-white p-1 shadow-card">
      <button className="grid h-10 w-10 place-items-center rounded-full text-brand-600 active:bg-fill" onClick={() => shift(-1)} aria-label={t("Bulan sebelumnya")}><ChevronLeft className="h-5 w-5" /></button>
      <span className="text-[16px] font-medium capitalize">{monthLabel(value)}</span>
      <button className="grid h-10 w-10 place-items-center rounded-full text-brand-600 active:bg-fill disabled:text-control" onClick={() => shift(1)} disabled={isCurrent} aria-label={t("Bulan berikutnya")}><ChevronRight className="h-5 w-5" /></button>
    </div>
  );
}
