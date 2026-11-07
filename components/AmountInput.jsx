"use client";
import { formatAmountInput } from "@/lib/format";

/** Input nominal Rupiah: titik ribuan otomatis, koma untuk desimal (maks. 2 angka). */
export default function AmountInput({ id, value, onChange, autoFocus, large = false, className = "", tone = "text-ink", ...rest }) {
  if (large) {
    return (
      <div className={`flex items-baseline gap-2 ${tone} ${className}`}>
        <span className="text-[24px] font-semibold">Rp</span>
        <input id={id} autoFocus={autoFocus} inputMode="decimal" placeholder="0" value={value} autoComplete="off"
          onChange={(e) => onChange(formatAmountInput(e.target.value, value))}
          className="tabular min-w-0 flex-1 bg-transparent text-[36px] font-semibold leading-tight outline-none placeholder:text-control focus-visible:outline-none"
          style={{ fontSize: value.length > 13 ? 28 : 36 }} {...rest} />
      </div>
    );
  }
  return (
    <div className={`relative ${className}`}>
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[16px] text-ink-soft">Rp</span>
      <input id={id} autoFocus={autoFocus} inputMode="decimal" placeholder="0" value={value} autoComplete="off"
        onChange={(e) => onChange(formatAmountInput(e.target.value, value))}
        className="field tabular pl-12" {...rest} />
    </div>
  );
}

/** Ubah teks gram ("12,5" atau "12.5") jadi angka */
export const parseGram = (text) => {
  const n = Number(String(text || "").replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
export const gramToInput = (n) => (n ? String(Number(n)).replace(".", ",") : "");

/** Input berat (gram), boleh desimal dengan koma. */
export function GramInput({ id, value, onChange, className = "", ...rest }) {
  return (
    <div className={`relative ${className}`}>
      <input id={id} inputMode="decimal" placeholder="0" value={value} autoComplete="off"
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, "").replace(/([.,].*)[.,]/g, "$1"))}
        className="field tabular pr-12" {...rest} />
      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[16px] text-ink-soft">gr</span>
    </div>
  );
}
