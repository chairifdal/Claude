"use client";
import { useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, CheckCircle2, AlertCircle, Inbox } from "lucide-react";
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

/**
 * Sheet ala iOS: grabber, "Batal" di kiri, judul di tengah.
 * `full` = page sheet hampir setinggi layar (di HP); di desktop selalu dialog di tengah.
 */
export function Sheet({ open, onClose, title, children, footer, full = false }) {
  const { t } = useApp();
  useEffect(() => {
    if (!open) return;
    // Kunci halaman di belakang dengan position:fixed. overflow:hidden saja tidak cukup di iOS Safari:
    // saat keyboard muncul, halaman belakang ikut bergeser sehingga ketukan meleset ke elemen lain.
    const y = window.scrollY;
    const b = document.body.style;
    const prev = { position: b.position, top: b.top, left: b.left, right: b.right, width: b.width, overflow: b.overflow };
    Object.assign(b, { position: "fixed", top: `-${y}px`, left: "0", right: "0", width: "100%", overflow: "hidden" });
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => {
      Object.assign(b, prev);
      window.scrollTo(0, y);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  const panel = full
    ? "h-[calc(100dvh-env(safe-area-inset-top)-10px)] lg:h-auto lg:max-h-[90dvh]"
    : "max-h-[92dvh]";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 animate-fade-in bg-black/35" onClick={onClose} />
      <div className={`relative flex w-full max-w-md animate-sheet-up flex-col rounded-t-[14px] bg-canvas shadow-float lg:max-w-lg lg:rounded-[14px] ${panel}`}>
        <div className="mx-auto mt-[6px] h-[5px] w-9 rounded-full bg-control lg:hidden" />
        <div className="grid grid-cols-[1fr_auto_1fr] items-center px-4 pb-2 pt-2.5">
          <button onClick={onClose} className="justify-self-start text-[17px] text-brand-600 active:opacity-50">{t("Batal")}</button>
          <h2 className="max-w-[60vw] truncate text-[17px] font-semibold">{title}</h2>
          <span />
        </div>
        <div className={`flex-1 overflow-y-auto px-4 no-scrollbar ${footer || full ? "" : "pb-safe"}`}>{children}</div>
        {footer && <div className="border-t border-line bg-surface/80 px-4 pt-3 pb-safe backdrop-blur-xl">{footer}</div>}
      </div>
    </div>
  );
}

/** Ikon kategori: tile kotak membulat berwarna dengan glyph putih (seperti app Settings iOS). */
export function CategoryIcon({ category, size = 40, className = "" }) {
  const Icon = CATEGORY_ICONS[category?.icon] || CATEGORY_ICONS.circle;
  const c = category?.color || "#8E8E93";
  return (
    <span className={`grid shrink-0 place-items-center text-white ${className}`} aria-hidden="true"
      style={{ width: size, height: size, borderRadius: size * 0.27, background: `linear-gradient(160deg, ${shade(c, 14)}, ${c})` }}>
      <Icon style={{ width: size * 0.56, height: size * 0.56 }} strokeWidth={2.1} />
    </span>
  );
}

/** Ikon akun: tile bergradien warna kartu dengan ikon jenis akun. */
export function AccountGlyph({ account, size = 40, className = "" }) {
  const Icon = ACCOUNT_KINDS[account?.kind]?.icon || ACCOUNT_KINDS.bank.icon;
  const c = account?.color || "#007AFF";
  return (
    <span className={`grid shrink-0 place-items-center text-white ${className}`} aria-hidden="true"
      style={{ width: size, height: size, borderRadius: size * 0.27, background: `linear-gradient(150deg, ${shade(c, 18)}, ${shade(c, -18)})` }}>
      <Icon style={{ width: size * 0.52, height: size * 0.52 }} strokeWidth={2.1} />
    </span>
  );
}

/** Avatar bergradien per orang (hue tetap, minimal 60° berjauhan). */
export function Avatar({ profile, size = 32 }) {
  const { personHue } = useApp();
  const name = profile?.full_name || profile?.email || "?";
  const h = personHue(profile?.id);
  return (
    <span title={name} aria-hidden="true" className="grid shrink-0 place-items-center rounded-full font-semibold text-white ring-2 ring-canvas"
      style={{ width: size, height: size, fontSize: size * 0.42, background: `linear-gradient(145deg, hsl(${h} 90% 64%), hsl(${(h + 30) % 360} 80% 46%))` }}>
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/** Navigation bar iOS: tombol kembali biru + judul besar 34px, latar blur. */
export function PageHeader({ title, subtitle, back, right }) {
  const { t } = useApp();
  return (
    <header className="sticky top-0 z-30 -mx-4 mb-3 bg-canvas/80 px-4 pt-safe backdrop-blur-xl backdrop-saturate-150 lg:static lg:mx-0 lg:bg-transparent lg:px-0 lg:backdrop-blur-none">
      <div className="flex h-11 items-center justify-between">
        {back ? (
          <Link href={back} className="-ml-2 flex items-center text-[17px] text-brand-600 active:opacity-50" aria-label={t("Kembali")}>
            <ChevronLeft className="h-7 w-7" strokeWidth={2.2} /> <span className="-ml-0.5">{t("Kembali")}</span>
          </Link>
        ) : <span />}
        <div className="flex items-center gap-2">{right}</div>
      </div>
      <div className="pb-2">
        <h1 className="truncate text-[34px] font-bold leading-tight tracking-tight">{title}</h1>
        {subtitle && <p className="truncate text-[15px] text-ink-soft">{subtitle}</p>}
      </div>
    </header>
  );
}

export function Empty({ title, text, action, icon: Icon = Inbox }) {
  return (
    <div className="flex flex-col items-center rounded-card bg-surface px-5 py-8 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-[16px] bg-gradient-to-br from-brand-400 to-transfer text-white"><Icon className="h-7 w-7" /></span>
      <p className="mt-3 text-[17px] font-semibold">{title}</p>
      {text && <p className="mt-1 max-w-[280px] text-[15px] text-ink-soft">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
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
      <div className="flex animate-pop-in items-center gap-2 rounded-full bg-[#1C1C1E]/85 px-4 py-3 text-[15px] font-medium text-white shadow-float backdrop-blur-xl">
        <Icon className={`h-5 w-5 ${err ? "text-[#FF6961]" : "text-[#30D158]"}`} /> {toast.message}
      </div>
    </div>
  );
}

/** Segmented control iOS. */
export function Segmented({ value, onChange, options, className = "" }) {
  return (
    <div role="tablist" className={`grid gap-0.5 rounded-[10px] bg-fill p-[2px] ${className}`} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}
          className={`h-8 truncate rounded-[8px] px-2 text-[14px] transition ${value === o.value ? "bg-seg font-semibold text-ink shadow-seg" : "font-medium text-ink"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Switch iOS (hijau saat aktif). */
export function Switch({ id, checked, onChange, label, description }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p id={`${id}-label`} className="text-[17px]">{label}</p>
        {description && <p id={`${id}-desc`} className="mt-1 text-[14px] text-ink-soft">{description}</p>}
      </div>
      <button id={id} type="button" role="switch" aria-checked={checked} aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-desc` : undefined} onClick={() => onChange(!checked)}
        className={`relative h-[31px] w-[51px] flex-none rounded-full transition-colors duration-200 ${checked ? "bg-income-bright" : "bg-switchoff"}`}>
        <span className={`absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-seg transition-[left] duration-200 ${checked ? "left-[22px]" : "left-[2px]"}`} />
      </button>
    </div>
  );
}

/** Gelap/terangkan warna hex (-100..100) */
export function shade(hex, pct) {
  const h = String(hex || "#8E8E93").replace("#", "");
  const num = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + (pct / 100) * (pct < 0 ? c : 255 - c))));
  const r = f(num >> 16), g = f((num >> 8) & 255), b = f(num & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
