"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, WalletCards, ChartPie, Target, Plus, Minus, ArrowLeftRight, WalletMinimal, Settings } from "lucide-react";
import { useApp } from "@/lib/app-data";

const TABS = [
  { href: "/", label: "Beranda", icon: House },
  { href: "/dompet", label: "Dompet", icon: WalletCards },
  { href: "/analisis", label: "Analisis", icon: ChartPie },
  { href: "/anggaran", label: "Anggaran", icon: Target },
];

// Tint pucat + tinta gelap per aksi; pengeluaran netral (tanpa merah untuk pengeluaran biasa)
const ACTIONS = [
  { type: "expense", label: "Pengeluaran", icon: Minus, bg: "#eef1f4", ink: "#1b1d1f" },
  { type: "income", label: "Pemasukan", icon: Plus, bg: "#dcfae5", ink: "#04250e" },
  { type: "transfer", label: "Transfer / kirim ke pasangan", icon: ArrowLeftRight, bg: "#dcf1ff", ink: "#0a3a80" },
  { type: "account", label: "Akun / pocket baru", icon: WalletMinimal, bg: "#eef1f4", ink: "#1b1d1f" },
];

export function Mark({ size = 32 }) {
  return <img src="/icons/icon.svg" alt="" width={size} height={size} className="rounded-[9px]" />;
}

export default function AppChrome() {
  const pathname = usePathname();
  const { openTx, openAccount, invites, t } = useApp();
  const tr = t;
  const [open, setOpen] = useState(false);
  const isActive = (href) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  function pick(a) {
    setOpen(false);
    if (a.type === "account") openAccount({});
    else openTx({ type: a.type });
  }

  const addButton = (cls) => (
    <button onClick={() => setOpen((o) => !o)} aria-label={t("Catat")} aria-expanded={open}
      className={`grid place-items-center rounded-full bg-brand-600 text-white transition-transform duration-200 active:scale-95 ${open ? "rotate-45" : ""} ${cls}`}>
      <Plus className="h-7 w-7" strokeWidth={2} />
    </button>
  );

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 animate-fade-in bg-ink/50" onClick={() => setOpen(false)}>
          <div className="absolute inset-x-0 bottom-28 mx-auto flex max-w-md flex-col items-end gap-3 px-5 pb-safe lg:bottom-auto lg:left-20 lg:right-auto lg:top-20 lg:items-start lg:px-0">
            {ACTIONS.map((a, i) => {
              const Icon = a.icon;
              return (
                <button key={a.type} onClick={(e) => { e.stopPropagation(); pick(a); }}
                  className="flex animate-pop-in items-center gap-3 rounded-full bg-white py-1.5 pl-1.5 pr-5 shadow-float lg:flex-row"
                  style={{ animationDelay: `${i * 30}ms` }}>
                  <span className="grid h-11 w-11 place-items-center rounded-full" style={{ background: a.bg, color: a.ink }}>
                    <Icon className="h-5 w-5" strokeWidth={2} />
                  </span>
                  <span className="text-[16px] font-medium">{t(a.label)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Phone: bar bawah dengan tombol catat di tengah */}
      <nav aria-label="Navigasi utama" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white pb-safe lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 items-end px-2 pt-1.5">
          {[TABS[0], TABS[1], null, TABS[2], TABS[3]].map((t) => {
            if (!t) return <div key="add" className="flex justify-center pb-1">{addButton("-mt-6 h-14 w-14 ring-4 ring-white")}</div>;
            const Icon = t.icon;
            const active = isActive(t.href);
            return (
              <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined}
                className={`flex h-14 flex-col items-center justify-center gap-0.5 ${active ? "text-ink" : "text-ink-mute"}`}>
                <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2 : 1.6} />
                <span className={`text-[12px] ${active ? "font-semibold" : "font-medium"}`}>{tr(t.label)}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop: icon rail */}
      <nav aria-label="Navigasi utama" className="fixed inset-y-0 left-0 z-40 hidden w-14 flex-col items-center border-r border-line bg-canvas py-4 lg:flex">
        <Link href="/" aria-label="Kantong Kita"><Mark size={32} /></Link>
        <div className="my-4 h-px w-5 bg-line" />
        {addButton("h-10 w-10")}
        <div className="mt-4 flex flex-col gap-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = isActive(t.href);
            return (
              <Link key={t.href} href={t.href} title={tr(t.label)} aria-label={tr(t.label)} aria-current={active ? "page" : undefined}
                className={`grid h-10 w-10 place-items-center rounded-control ${active ? "bg-[#e9ecef] text-ink" : "text-ink-mute hover:text-ink"}`}>
                <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
              </Link>
            );
          })}
        </div>
        <Link href="/pengaturan" title={tr("Pengaturan")} aria-label={tr("Pengaturan")}
          className={`relative mt-auto grid h-10 w-10 place-items-center rounded-control ${isActive("/pengaturan") ? "bg-[#e9ecef] text-ink" : "text-ink-mute hover:text-ink"}`}>
          <Settings className="h-[18px] w-[18px]" strokeWidth={1.75} />
          {invites.length > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-expense" />}
        </Link>
      </nav>
    </>
  );
}
