"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, WalletCards, ChartPie, Target, Plus, Minus, ArrowLeftRight, WalletMinimal } from "lucide-react";
import { useApp } from "@/lib/app-data";

const TABS = [
  { href: "/", label: "Beranda", icon: House },
  { href: "/dompet", label: "Dompet", icon: WalletCards },
  null,
  { href: "/analisis", label: "Analisis", icon: ChartPie },
  { href: "/anggaran", label: "Anggaran", icon: Target },
];

const ACTIONS = [
  { type: "income", label: "Pemasukan", icon: Plus, bg: "#0F9F6E" },
  { type: "expense", label: "Pengeluaran", icon: Minus, bg: "#E5484D" },
  { type: "transfer", label: "Transfer / Kirim ke pasangan", icon: ArrowLeftRight, bg: "#3654F5" },
  { type: "account", label: "Akun / Pocket baru", icon: WalletMinimal, bg: "#F59E0B" },
];

export default function AppChrome() {
  const pathname = usePathname();
  const { openTx, openAccount } = useApp();
  const [open, setOpen] = useState(false);

  function pick(a) {
    setOpen(false);
    if (a.type === "account") openAccount({});
    else openTx({ type: a.type });
  }

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 animate-fade-in bg-ink/45 backdrop-blur-md" onClick={() => setOpen(false)}>
          <div className="absolute inset-x-0 bottom-28 mx-auto flex max-w-md flex-col items-end gap-3 px-6 pb-safe">
            {ACTIONS.slice().reverse().map((a, i) => {
              const Icon = a.icon;
              return (
                <button key={a.type} onClick={(e) => { e.stopPropagation(); pick(a); }}
                  className="flex animate-pop-in items-center gap-3" style={{ animationDelay: `${(ACTIONS.length - i) * 35}ms` }}>
                  <span className="rounded-full bg-ink/90 px-4 py-2.5 text-[14px] font-bold text-white shadow-lg">{a.label}</span>
                  <span className="grid h-14 w-14 place-items-center rounded-full text-white shadow-lg ring-4 ring-white/20" style={{ background: a.bg }}>
                    <Icon className="h-6 w-6" strokeWidth={2.6} />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md px-3 pb-safe">
        <div className="relative grid grid-cols-5 items-center rounded-[1.75rem] border border-white/60 bg-white/85 px-1 py-1.5 shadow-sheet backdrop-blur-xl">
          {TABS.map((t, i) => {
            if (!t) {
              return (
                <div key="fab" className="flex justify-center">
                  <button onClick={() => setOpen((o) => !o)} aria-label="Tambah"
                    className={`-mt-9 grid h-[60px] w-[60px] place-items-center rounded-full bg-gradient-to-br from-brand-400 to-brand-700 text-white shadow-lift ring-[6px] ring-canvas transition-transform duration-300 active:scale-95 ${open ? "rotate-45" : ""}`}>
                    <Plus className="h-7 w-7" strokeWidth={2.6} />
                  </button>
                </div>
              );
            }
            const active = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
            const Icon = t.icon;
            return (
              <Link key={t.href} href={t.href} className="flex flex-col items-center gap-0.5 py-1.5">
                <span className={`grid h-8 w-14 place-items-center rounded-full transition ${active ? "bg-brand-50 text-brand-600" : "text-ink-mute"}`}>
                  <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 2} />
                </span>
                <span className={`text-[11px] font-bold ${active ? "text-brand-600" : "text-ink-mute"}`}>{t.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
