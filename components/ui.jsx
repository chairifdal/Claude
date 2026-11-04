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
    return (
      <span className={`tabular inline-flex items-center gap-1 ${className}`}>
        Rp <span className="tracking-[.12em]">{"•".repeat(dots)}</span>
      </span>
    );
  }
  return <span className={`tabular ${className}`}>{formatIDR(value, { sign, compact })}</span>;
}

export function Sheet({ open, onClose, title, children, footer }) {
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
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 animate-fade-in bg-ink/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative flex max-h-[92dvh] w-full max-w-md animate-sheet-up flex-col rounded-t-[2rem] bg-white shadow-sheet">
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-line" />
        <div className="flex items-center justify-between px-5 pb-2 pt-3">
          <h2 className="text-lg font-extrabold tracking-tight">{title}</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-canvas text-ink-soft" aria-label="Tutup">
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-4 no-scrollbar">{children}</div>
        {footer && <div className="border-t border-line px-5 pt-3 pb-safe">{footer}</div>}
      </div>
    </div>
  );
}

export function CategoryIcon({ category, size = 40, className = "" }) {
  const Icon = CATEGORY_ICONS[category?.icon] || CATEGORY_ICONS.circle;
  const color = category?.color || "#94A3B8";
  return (
    <span className={`grid shrink-0 place-items-center rounded-2xl ${className}`}
      style={{ width: size, height: size, background: `${color}1A`, color }}>
      <Icon style={{ width: size * 0.48, height: size * 0.48 }} strokeWidth={2.2} />
    </span>
  );
}

export function AccountGlyph({ account, size = 40, className = "" }) {
  const Icon = ACCOUNT_KINDS[account?.kind]?.icon || ACCOUNT_KINDS.bank.icon;
  const color = account?.color || "#2440DE";
  return (
    <span className={`grid shrink-0 place-items-center rounded-2xl text-white ${className}`}
      style={{ width: size, height: size, background: `linear-gradient(140deg, ${color}, ${shade(color, -28)})` }}>
      <Icon style={{ width: size * 0.46, height: size * 0.46 }} strokeWidth={2.2} />
    </span>
  );
}

export function Avatar({ profile, size = 32, ring = false }) {
  const name = profile?.full_name || profile?.email || "?";
  const hue = profile?.avatar_hue ?? 220;
  return (
    <span title={name}
      className={`grid shrink-0 place-items-center rounded-full font-bold text-white ${ring ? "ring-2 ring-white" : ""}`}
      style={{ width: size, height: size, fontSize: size * 0.4, background: `linear-gradient(140deg, hsl(${hue} 80% 62%), hsl(${(hue + 40) % 360} 70% 45%))` }}>
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

export function PageHeader({ title, subtitle, back, right }) {
  return (
    <header className="sticky top-0 z-30 -mx-4 mb-2 bg-canvas/85 px-4 pt-safe backdrop-blur-xl">
      <div className="flex h-16 items-center gap-2">
        {back && (
          <Link href={back} className="icon-btn -ml-2" aria-label="Kembali">
            <ChevronLeft className="h-6 w-6" />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          {subtitle && <p className="text-[12px] font-semibold text-ink-mute">{subtitle}</p>}
          <h1 className="truncate text-[22px] font-extrabold leading-tight tracking-tight">{title}</h1>
        </div>
        {right}
      </div>
    </header>
  );
}

export function Empty({ icon: Icon, title, text, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      {Icon && <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600"><Icon className="h-7 w-7" /></span>}
      <p className="mt-4 font-bold">{title}</p>
      {text && <p className="mt-1 text-sm text-ink-mute">{text}</p>}
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
    <div key={toast.id} className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex justify-center px-4 pt-safe">
      <div className={`flex animate-pop-in items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-lift ${err ? "bg-expense" : "bg-ink"}`}>
        <Icon className="h-[18px] w-[18px]" /> {toast.message}
      </div>
    </div>
  );
}

export function Segmented({ value, onChange, options, className = "" }) {
  return (
    <div className={`grid gap-1 rounded-2xl bg-canvas p-1 ${className}`} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={`rounded-xl py-2.5 text-[13px] font-bold transition ${value === o.value ? "bg-white shadow-card " + (o.activeClass || "text-ink") : "text-ink-mute"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** darken/lighten a hex color by percent (-100..100) */
export function shade(hex, pct) {
  const h = hex.replace("#", "");
  const num = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + (pct / 100) * (pct < 0 ? c : 255 - c))));
  const r = f(num >> 16), g = f((num >> 8) & 255), b = f(num & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
