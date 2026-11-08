"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, WalletCards, ChartPie, Plus, Minus, ArrowLeftRight, WalletMinimal, Settings, ReceiptText } from "lucide-react";
import { useApp } from "@/lib/app-data";

// 4 tab + tombol catat. Laporan anggaran ada di Beranda & Analisis; mengatur anggaran di Pengaturan.
const TABS = [
  { href: "/", label: "Beranda", icon: House },
  { href: "/aktivitas", label: "Aktivitas", icon: ReceiptText },
  { href: "/analisis", label: "Analisis", icon: ChartPie },
  { href: "/dompet", label: "Dompet", icon: WalletCards },
];

const ACTIONS = [
  { type: "expense", label: "Pengeluaran", icon: Minus, color: "#FF3B30" },
  { type: "income", label: "Pemasukan", icon: Plus, color: "#34C759" },
  { type: "transfer", label: "Transfer", icon: ArrowLeftRight, color: "#2563EB" },
  { type: "account", label: "Akun / pocket baru", icon: WalletMinimal, color: "#FF9500" },
];

export function Mark({ size = 32 }) {
  return <img src="/icons/icon.svg" alt="" width={size} height={size} style={{ borderRadius: size * 0.23 }} />;
}

export default function AppChrome() {
  const pathname = usePathname();
  const { openTx, openAccount, invites, t } = useApp();
  const [open, setOpen] = useState(false);
  const isActive = (href) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  // Sedang membuka detail wallet (/dompet/<id>) → catatan baru memakai wallet itu sebagai akun
  const walletId = pathname.match(/^\/dompet\/([^/]+)/)?.[1];

  function pick(a) {
    setOpen(false);
    if (a.type === "account") openAccount({});
    else openTx(walletId ? { type: a.type, accountId: walletId } : { type: a.type });
  }

  const addButton = (cls) => (
    <button onClick={() => setOpen((o) => !o)} aria-label={t("Catat")} aria-expanded={open}
      className={`grid place-items-center rounded-full bg-gradient-to-br from-[#22D3EE] via-[#2563EB] to-[#1E40AF] text-white shadow-lift transition-transform duration-300 active:scale-90 ${open ? "rotate-45" : ""} ${cls}`}>
      <Plus className="h-7 w-7" strokeWidth={2.6} />
    </button>
  );

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 animate-fade-in bg-black/25 backdrop-blur-[6px]" onClick={() => setOpen(false)}>
          <div className="absolute inset-x-0 bottom-28 mx-auto flex max-w-md justify-center px-6 pb-safe lg:bottom-auto lg:left-20 lg:right-auto lg:top-20 lg:block lg:px-0">
            <div className="w-full max-w-[300px] animate-pop-in overflow-hidden rounded-[14px] bg-surface/90 shadow-float backdrop-blur-2xl">
              {ACTIONS.map((a, i) => {
                const Icon = a.icon;
                return (
                  <button key={a.type} onClick={(e) => { e.stopPropagation(); pick(a); }}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left active:bg-fill ${i ? "border-t border-line" : ""}`}>
                    <span className="grid h-8 w-8 place-items-center rounded-[8px] text-white" style={{ background: a.color }}>
                      <Icon className="h-[18px] w-[18px]" strokeWidth={2.6} />
                    </span>
                    <span className="text-[17px]">{t(a.label)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* HP: tab bar tembus pandang ala iOS */}
      <nav aria-label="Navigasi utama" className="fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-surface/80 pb-safe backdrop-blur-xl backdrop-saturate-150 lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 items-end px-1 pt-1">
          {[TABS[0], TABS[1], null, TABS[2], TABS[3]].map((tab) => {
            if (!tab) return <div key="add" className="flex justify-center">{addButton("-mt-5 h-[58px] w-[58px] ring-[5px] ring-canvas")}</div>;
            const Icon = tab.icon;
            const active = isActive(tab.href);
            return (
              <Link key={tab.href} href={tab.href} aria-current={active ? "page" : undefined}
                className={`flex h-[52px] flex-col items-center justify-center gap-0.5 ${active ? "text-brand-600" : "text-ink-mute"}`}>
                <Icon className="h-6 w-6" strokeWidth={active ? 2.4 : 1.9} fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.15 : 0} />
                <span className="text-[10.5px] font-medium tracking-normal">{t(tab.label)}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop: sidebar ikon */}
      <nav aria-label="Navigasi utama" className="fixed inset-y-0 left-0 z-40 hidden w-[72px] flex-col items-center border-r border-line/60 bg-surface/70 py-5 backdrop-blur-xl lg:flex">
        <Link href="/" aria-label="Finance Tracker"><Mark size={40} /></Link>
        <div className="mt-6">{addButton("h-12 w-12")}</div>
        <div className="mt-6 flex flex-col gap-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = isActive(tab.href);
            return (
              <Link key={tab.href} href={tab.href} title={t(tab.label)} aria-label={t(tab.label)} aria-current={active ? "page" : undefined}
                className={`grid h-12 w-12 place-items-center rounded-[14px] transition ${active ? "bg-brand-600 text-white shadow-lift" : "text-ink-mute hover:bg-fill"}`}>
                <Icon className="h-[22px] w-[22px]" strokeWidth={2} />
              </Link>
            );
          })}
        </div>
        <Link href="/pengaturan" title={t("Pengaturan")} aria-label={t("Pengaturan")}
          className={`relative mt-auto grid h-12 w-12 place-items-center rounded-[14px] ${isActive("/pengaturan") ? "bg-brand-600 text-white" : "text-ink-mute hover:bg-fill"}`}>
          <Settings className="h-[22px] w-[22px]" />
          {invites.length > 0 && <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-expense ring-2 ring-surface" />}
        </Link>
      </nav>
    </>
  );
}
