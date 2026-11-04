"use client";
import Link from "next/link";
import { useMemo } from "react";
import { ArrowUpRight, ArrowDownLeft, ArrowLeftRight, Shapes, Eye, EyeOff, Settings, ChevronRight, Sparkles, PieChart, Plus, MailOpen } from "lucide-react";
import { useApp, useTransactions, rootCategory } from "@/lib/app-data";
import { monthRange, firstName, monthLabel } from "@/lib/format";
import { AccountGlyph, Avatar, Money, Empty } from "@/components/ui";
import { TxGroupedList } from "@/components/TxList";

export default function HomePage() {
  const { profile, accounts, hidden, toggleHidden, openTx, openAccount, categoryById, invites, user, loading } = useApp();
  const { start, end } = useMemo(() => monthRange(), []);
  const { rows: monthRows } = useTransactions({ from: start, to: end });
  const { rows: recent } = useTransactions({ limit: 6 });

  const liquid = accounts.filter((a) => ["cash", "bank", "ewallet"].includes(a.kind));
  const totalLiquid = liquid.reduce((s, a) => s + a.balance, 0);

  const stats = useMemo(() => {
    let income = 0, expense = 0;
    const byRoot = {};
    const byPerson = {};
    for (const t of monthRows) {
      if (t.type === "income") income += t.amount;
      if (t.type === "expense") {
        expense += t.amount;
        const root = rootCategory(categoryById[t.category_id], categoryById);
        const key = root?.name || "Tanpa kategori";
        byRoot[key] = byRoot[key] || { name: key, color: root?.color || "#94A3B8", total: 0 };
        byRoot[key].total += t.amount;
        byPerson[t.created_by] = (byPerson[t.created_by] || 0) + t.amount;
      }
    }
    const comp = Object.values(byRoot).sort((a, b) => b.total - a.total);
    return { income, expense, comp, byPerson };
  }, [monthRows, categoryById]);

  const top = stats.comp[0];
  const partnerSpend = Object.entries(stats.byPerson).filter(([id]) => id !== user?.id);

  return (
    <div className="pt-safe">
      {/* Header */}
      <header className="flex h-16 items-center gap-3">
        <Avatar profile={profile} size={40} />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-ink-mute">{greeting()},</p>
          <p className="truncate text-[18px] font-extrabold leading-tight tracking-tight">{firstName(profile) || "…"}</p>
        </div>
        <button className="icon-btn" onClick={toggleHidden} aria-label="Sembunyikan saldo">
          {hidden ? <EyeOff className="h-[21px] w-[21px]" /> : <Eye className="h-[21px] w-[21px]" />}
        </button>
        <Link href="/pengaturan" className="icon-btn relative" aria-label="Pengaturan">
          <Settings className="h-[21px] w-[21px]" />
          {invites.length > 0 && <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-expense ring-2 ring-canvas" />}
        </Link>
      </header>

      {/* Invitation banner */}
      {invites.length > 0 && (
        <Link href="/pengaturan#undangan" className="mb-3 flex animate-pop-in items-center gap-3 rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-200">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-400 text-white"><MailOpen className="h-5 w-5" /></span>
          <p className="flex-1 text-[13.5px] font-semibold text-amber-900">
            {invites[0].inviter_name} mengundang kamu ke <b>{invites[0].account_name}</b>
            {invites.length > 1 ? ` dan ${invites.length - 1} lainnya` : ""}
          </p>
          <ChevronRight className="h-5 w-5 text-amber-700" />
        </Link>
      )}

      {/* Hero */}
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-500 via-brand-600 to-brand-900 p-5 text-white shadow-lift">
        <div className="pointer-events-none absolute -right-12 -top-20 h-56 w-56 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-white/[.06]" />
        <p className="relative text-[12px] font-bold uppercase tracking-[.14em] text-white/70">Saldo tersedia</p>
        <Money value={totalLiquid} className="relative mt-1 block text-[34px] font-extrabold leading-tight tracking-tight" />
        <p className="relative text-[13px] text-white/70">di {liquid.length} akun lancar</p>

        <div className="relative mt-5 grid grid-cols-4 gap-2 border-t border-white/15 pt-4">
          <QuickAction icon={ArrowUpRight} label="Keluar" onClick={() => openTx({ type: "expense" })} primary />
          <QuickAction icon={ArrowDownLeft} label="Masuk" onClick={() => openTx({ type: "income" })} />
          <QuickAction icon={ArrowLeftRight} label="Transfer" onClick={() => openTx({ type: "transfer" })} />
          <QuickAction icon={Shapes} label="Kategori" href="/kategori" />
        </div>

        <div className="relative mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/10">
            <p className="flex items-center gap-1 text-[12px] text-white/75"><ArrowDownLeft className="h-3.5 w-3.5" /> Pemasukan</p>
            <Money value={stats.income} compact className="mt-0.5 block text-[17px] font-extrabold" dots={5} />
          </div>
          <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/10">
            <p className="flex items-center gap-1 text-[12px] text-white/75"><ArrowUpRight className="h-3.5 w-3.5" /> Pengeluaran</p>
            <Money value={stats.expense} compact className="mt-0.5 block text-[17px] font-extrabold" dots={5} />
          </div>
        </div>
      </section>

      {/* Composition */}
      <section className="card mt-4 p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600"><PieChart className="h-5 w-5" /></span>
          <div className="flex-1">
            <p className="font-extrabold">Komposisi pengeluaran</p>
            <p className="text-[12px] text-ink-mute">{monthLabel(new Date())}</p>
          </div>
          <Link href="/analisis" className="chip bg-brand-50 text-brand-600">Detail</Link>
        </div>
        {stats.comp.length ? (
          <>
            <div className="mt-4 flex h-3 gap-0.5 overflow-hidden rounded-full">
              {stats.comp.map((c) => (
                <div key={c.name} style={{ width: `${(c.total / stats.expense) * 100}%`, background: c.color }} className="min-w-[4px]" />
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
              {stats.comp.slice(0, 6).map((c) => (
                <p key={c.name} className="flex items-center gap-2 truncate text-[13px] text-ink-soft">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                  <span className="truncate">{c.name}</span>
                  <b className="ml-auto text-ink">{Math.round((c.total / stats.expense) * 100)}%</b>
                </p>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-ink-mute">Belum ada pengeluaran bulan ini.</p>
        )}
      </section>

      {/* Insight */}
      {top && (
        <section className="mt-3 flex gap-3 rounded-3xl bg-gradient-to-br from-emerald-50 to-teal-50 p-4 ring-1 ring-emerald-100">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-600 text-white"><Sparkles className="h-5 w-5" /></span>
          <div className="text-[13.5px] leading-relaxed text-emerald-950">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700">Insight bulan ini</p>
            Pengeluaran terbesar: <b>{top.name}</b>, <Money value={top.total} className="font-bold" dots={5} /> ({Math.round((top.total / stats.expense) * 100)}% dari total).
            {partnerSpend.length > 0 && (
              <> Pasanganmu ikut mencatat <Money value={partnerSpend.reduce((s, [, v]) => s + v, 0)} className="font-bold" dots={5} /> di akun bersama.</>
            )}
          </div>
        </section>
      )}

      {/* Accounts */}
      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="section-title">Akun kamu</h2>
          <Link href="/dompet" className="flex items-center text-[13px] font-bold text-brand-600">Dompet <ChevronRight className="h-4 w-4" /></Link>
        </div>
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 no-scrollbar">
          {accounts.map((a) => (
            <Link key={a.id} href={`/dompet/${a.id}`} className="card flex w-[148px] shrink-0 flex-col p-4 transition active:scale-[.98]">
              <div className="flex items-center justify-between">
                <AccountGlyph account={a} size={38} />
                {a.owner_id !== user?.id && <span className="chip bg-brand-50 px-2 py-0.5 text-[10.5px] text-brand-600">Bersama</span>}
              </div>
              <p className="mt-3 truncate text-[14px] font-bold">{a.name}</p>
              <Money value={a.balance} compact className="text-[15px] font-extrabold" dots={5} />
            </Link>
          ))}
          <button onClick={() => openAccount({})}
            className="flex w-[120px] shrink-0 flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-line text-[13px] font-bold text-ink-mute">
            <Plus className="h-6 w-6" /> Tambah
          </button>
        </div>
      </section>

      {/* Recent */}
      <section className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="section-title">Aktivitas terkini</h2>
          <Link href="/aktivitas" className="flex items-center text-[13px] font-bold text-brand-600">Lihat semua <ChevronRight className="h-4 w-4" /></Link>
        </div>
        {!loading && accounts.length === 0 ? (
          <div className="card">
            <Empty icon={Plus} title="Mulai dengan membuat akun" text="Tambahkan rekening bank, e-wallet, atau dompet tunai."
              action={<button className="btn-primary" onClick={() => openAccount({})}>Buat akun pertama</button>} />
          </div>
        ) : (
          <TxGroupedList rows={recent} />
        )}
      </section>
    </div>
  );
}

function QuickAction({ icon: Icon, label, onClick, href, primary }) {
  const inner = (
    <>
      <span className={`grid h-12 w-12 place-items-center rounded-full transition ${primary ? "bg-white text-brand-600 shadow-lg" : "bg-white/15 text-white ring-1 ring-white/20"}`}>
        <Icon className="h-5 w-5" strokeWidth={2.4} />
      </span>
      <span className="text-[12.5px] font-bold">{label}</span>
    </>
  );
  const cls = "flex flex-col items-center gap-1.5 active:scale-95 transition";
  return href ? <Link href={href} className={cls}>{inner}</Link> : <button onClick={onClick} className={cls}>{inner}</button>;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 18) return "Selamat sore";
  return "Selamat malam";
}
