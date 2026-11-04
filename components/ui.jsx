"use client";
import { useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, X, CheckCircle2, AlertCircle } from "lucide-react";
import { useApp } from "@/lib/app-data";
import { formatIDR } from "@/lib/format";
import { ACCOUNT_KINDS, CATEGORY_ICONS } from "@/lib/constants";

export function Money({ value, sign, compact, className = "", dots = 7 }) {
  const { hidden } = useApp();
  if (hidden) {
    return <span className={`tabular ${className}`} aria-label="Saldo disembunyikan">Rp {"•".repeat(dots)}</span>;
  }
  return <span className={`tabular whitespace-nowrap ${className}`}>{formatIDR(value, { sign, compact })}</span>;
}

export function Sheet({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 animate-fade-in bg-ink/40" onClick={onClose} />
      <div className="relative flex max-h-[92dvh] w-full max-w-md animate-sheet-up flex-col rounded-t-card bg-white shadow-float lg:rounded-card">
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-control lg:hidden" />
        <div className="flex items-center justify-between px-5 pb-2 pt-3">
          <h2 className="text-[20px] font-semibold">{title}</h2>
          <button onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full text-ink-soft hover:bg-canvas" aria-label="Tutup">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-safe no-scrollbar">{children}</div>
      </div>
    </div>
  );
}

/** Ikon kategori: outline polos abu di slot tetap, tanpa wadah berwarna. */
export function CategoryIcon({ category, size = 40, className = "" }) {
  const Icon = CATEGORY_ICONS[category?.icon] || CATEGORY_ICONS.circle;
  return (
    <span className={`grid shrink-0 place-items-center text-ink-soft ${className}`} style={{ width: size, height: size }} aria-hidden="true">
      <Icon style={{ width: 22, height: 22 }} strokeWidth={1.6} />
    </span>
  );
}

export function AccountGlyph({ account, size = 40, className = "" }) {
  // Miniatur kartu dalam warna akun: objek uang itu sendiri, bukan ikon dalam lingkaran
  return (
    <span className={`relative shrink-0 rounded-[5px] ${className}`} aria-hidden="true"
      style={{ width: size, height: Math.round(size / 1.586), background: account?.color || "#1d5fd6" }}>
      <span className="absolute left-[18%] top-[30%] h-[28%] w-[24%] rounded-[2px] bg-[#e8c770]" />
    </span>
  );
}

/** Setiap orang punya hue tetap (lihat personHue di app-data), tampil sebagai tint pucat + inisial gelap. */
export function Avatar({ profile, size = 32 }) {
  const { personHue } = useApp();
  const name = profile?.full_name || profile?.email || "?";
  const h = personHue(profile?.id);
  return (
    <span title={name} aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-full font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.42, background: `hsl(${h} 85% 91%)`, color: `hsl(${h} 70% 24%)` }}>
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

export function PageHeader({ title, subtitle, back, right }) {
  return (
    <header className="sticky top-0 z-30 -mx-4 mb-4 bg-canvas px-4 pt-safe lg:static lg:mx-0 lg:px-0">
      <div className="flex min-h-16 items-center gap-2 py-2">
        {back && (
          <Link href={back} className="icon-btn -ml-2" aria-label="Kembali">
            <ChevronLeft className="h-6 w-6" />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[28px] font-semibold leading-tight">{title}</h1>
          {subtitle && <p className="truncate text-[14px] text-ink-soft">{subtitle}</p>}
        </div>
        {right}
      </div>
    </header>
  );
}

/** Blok kosong: bingkai tetap, satu kalimat, satu aksi. */
export function Empty({ title, text, action }) {
  return (
    <div className="rounded-control border border-dashed border-control px-4 py-5">
      <p className="text-[16px] font-medium">{title}</p>
      {text && <p className="mt-1 text-[14px] text-ink-soft">{text}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Toast() {
  const { toast } = useApp();
  if (!toast) return null;
  const err = toast.tone === "err";
  const Icon = err ? AlertCircle : CheckCircle2;
  return (
    <div key={toast.id} className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex justify-center px-4 pt-safe" role="status">
      <div className="flex animate-pop-in items-center gap-2 rounded-full bg-ink px-4 py-3 text-[14px] font-medium text-white shadow-float">
        <Icon className={`h-[18px] w-[18px] ${err ? "text-[#ff8a8a]" : "text-[#8fe3a8]"}`} /> {toast.message}
      </div>
    </div>
  );
}

/** Kontrol segmen: track abu, pill putih aktif, label tinta. */
export function Segmented({ value, onChange, options, className = "" }) {
  return (
    <div role="tablist" className={`grid gap-1 rounded-full bg-[#eef1f4] p-1 ${className}`} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}
          className={`h-10 rounded-full text-[14px] font-medium transition ${value === o.value ? "border border-line bg-white text-ink" : "text-ink-soft"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Tint pucat + tinta gelap dari satu warna (gerak gaya pastel-consumer). */
export function paleOf(hex) {
  const { h, s } = hexToHsl(hex);
  return { bg: `hsl(${h} ${Math.min(90, Math.max(45, s))}% 92%)`, ink: `hsl(${h} ${Math.min(80, Math.max(40, s))}% 26%)` };
}

export function hexToHsl(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}
